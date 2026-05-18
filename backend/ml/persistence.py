# ml/persistence.py
# Temporal Persistence Engine
# Matches hotspots across VIIRS/MODIS passes by coordinate proximity,
# builds trajectory vectors used by the hybrid classifier and SHAP layer.
#
# Key outputs per hotspot:
#   persistence_score   - how many consecutive passes this coordinate appeared (0-1 normalised)
#   confidence_slope    - linear regression slope of confidence across passes (-1 to +1)
#   night_ratio         - fraction of detections that were nocturnal (0-1)
#   interval_consistency- how regular the inter-pass timing is (1=perfectly regular, 0=random)
#   recurrence_count    - raw integer count of appearances

import json
import math
from pathlib import Path
from datetime import datetime

HISTORY_PATH     = Path("ml_registry") / "scan_history.json"
COORD_RADIUS_KM  = 1.5    # treat two hotspots as the same location if within 1.5 km
VIIRS_REVISIT_H  = 12.0   # VIIRS nominal revisit time in hours
MAX_HISTORY      = 20     # matches MAX_HISTORY_SCANS in livescan.py


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two lat/lon points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _parse_utc(s: str) -> datetime | None:
    """Parse scan_utc string → datetime. Returns None on failure."""
    for fmt in ("%Y-%m-%d %H:%M UTC", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s.replace(" UTC", ""), fmt.replace(" UTC", ""))
        except ValueError:
            continue
    return None


def _linear_slope(values: list[float]) -> float:
    """Least-squares slope of a list of values. Returns 0 if < 2 points."""
    n = len(values)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2.0
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    den = sum((i - x_mean) ** 2 for i in range(n))
    return float(num / den) if den else 0.0


def load_history() -> list[dict]:
    """Load scan history JSON. Returns [] if file missing."""
    if not HISTORY_PATH.exists():
        return []
    try:
        with open(HISTORY_PATH) as f:
            return json.load(f).get("scans", [])
    except Exception:
        return []


def build_coord_index(scans: list[dict]) -> dict[str, list[dict]]:
    """
    Build a spatial index: coord_key → list of occurrence dicts.
    coord_key = f"{lat:.2f},{lon:.2f}" (roughly 1.1 km grid)

    Each occurrence dict:
      scan_utc, confidence, severity, type, daynight, scan_index
    """
    index: dict[str, list[dict]] = {}
    for scan_idx, scan in enumerate(scans):
        scan_utc = scan.get("scan_utc", "")
        for a in scan.get("anomalies", []):
            lat = a.get("lat")
            lon = a.get("lon")
            if lat is None or lon is None:
                continue
            key = f"{lat:.2f},{lon:.2f}"
            if key not in index:
                index[key] = []
            index[key].append({
                "scan_utc":   scan_utc,
                "confidence": float(a.get("confidence", 50.0)),
                "severity":   a.get("severity", "LOW"),
                "type":       a.get("type", "Unknown"),
                "daynight":   a.get("daynight", "D"),
                "scan_index": scan_idx,
            })
    return index


def find_trajectory(lat: float, lon: float,
                    coord_index: dict[str, list[dict]]) -> list[dict]:
    """
    Find all historical occurrences within COORD_RADIUS_KM of (lat, lon).
    Returns list sorted oldest→newest.
    """
    matches: list[dict] = []
    for key, occurrences in coord_index.items():
        parts = key.split(",")
        if len(parts) != 2:
            continue
        try:
            klat, klon = float(parts[0]), float(parts[1])
        except ValueError:
            continue
        if _haversine_km(lat, lon, klat, klon) <= COORD_RADIUS_KM:
            matches.extend(occurrences)

    # Sort oldest first (highest scan_index = oldest since index 0 is newest)
    matches.sort(key=lambda x: x["scan_index"], reverse=True)
    return matches


def compute_persistence_features(trajectory: list[dict]) -> dict:
    """
    Given a trajectory (list of historical occurrences), compute the
    4 persistence features used by the hybrid classifier.

    Returns dict with:
      persistence_score       float [0, 1]
      confidence_slope        float [-1, +1]   (positive = confidence rising)
      night_ratio             float [0, 1]
      interval_consistency    float [0, 1]     (1 = perfectly regular timing)
      recurrence_count        int
      trajectory              list             (for frontend chart)
    """
    n = len(trajectory)

    # ── persistence_score ────────────────────────────────────────────────────
    # Normalise against MAX_HISTORY. 1 occurrence = 0.05, 20 = 1.0
    persistence_score = float(min(n / MAX_HISTORY, 1.0))

    # ── confidence_slope ─────────────────────────────────────────────────────
    confidences = [t["confidence"] for t in trajectory]
    raw_slope   = _linear_slope(confidences)
    # Normalise: typical range is ~-5 to +5 per pass; clip to [-1, 1]
    confidence_slope = float(max(-1.0, min(1.0, raw_slope / 5.0)))

    # ── night_ratio ───────────────────────────────────────────────────────────
    night_count = sum(1 for t in trajectory if t.get("daynight", "D") == "N")
    night_ratio = float(night_count / n) if n > 0 else 0.0

    # ── interval_consistency ─────────────────────────────────────────────────
    # Parse timestamps and compute std of inter-pass intervals
    interval_consistency = 0.5  # default if we can't parse times
    times = []
    for t in trajectory:
        dt = _parse_utc(t.get("scan_utc", ""))
        if dt:
            times.append(dt)

    if len(times) >= 3:
        times.sort()
        intervals = [(times[i+1] - times[i]).total_seconds() / 3600.0
                     for i in range(len(times) - 1)]
        mean_iv = sum(intervals) / len(intervals)
        std_iv  = math.sqrt(sum((iv - mean_iv) ** 2 for iv in intervals) / len(intervals))
        # Score: 1 if std=0 (perfectly regular), approaches 0 as std grows
        # Normalise against VIIRS_REVISIT_H
        interval_consistency = float(max(0.0, 1.0 - std_iv / VIIRS_REVISIT_H))

    return {
        "persistence_score":    round(persistence_score,    4),
        "confidence_slope":     round(confidence_slope,     4),
        "night_ratio":          round(night_ratio,          4),
        "interval_consistency": round(interval_consistency, 4),
        "recurrence_count":     n,
        "trajectory":           trajectory,   # full list for frontend chart
    }


def enrich_hotspot(lat: float, lon: float,
                   coord_index: dict[str, list[dict]]) -> dict:
    """
    Main entry point used by livescan._run_scan().
    Returns persistence feature dict for a single hotspot coordinate.
    """
    trajectory = find_trajectory(lat, lon, coord_index)
    return compute_persistence_features(trajectory)


def build_persistence_map(anomalies: list[dict]) -> dict[str, dict]:
    """
    Batch enrich a list of anomaly dicts with persistence features.
    Returns a dict keyed by anomaly id.
    """
    scans      = load_history()
    coord_idx  = build_coord_index(scans)
    result     = {}
    for a in anomalies:
        lat = a.get("lat")
        lon = a.get("lon")
        if lat is not None and lon is not None:
            result[a["id"]] = enrich_hotspot(float(lat), float(lon), coord_idx)
    return result
