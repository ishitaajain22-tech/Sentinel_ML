# backend/services/nasa_firms.py
# NASA FIRMS — fetches real satellite thermal hotspots.
# FIRMS data is already pre-detected by NASA's own algorithms.
# We do NOT run Isolation Forest on this — just classify + score directly.
# Filtering is aggressive to keep only genuinely significant detections.

import csv
import io
import httpx
from datetime import datetime, timezone
from core.config import NASA_FIRMS_KEY

FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

SOURCES = {
    "VIIRS_SNPP_NRT":   "VIIRS S-NPP · 375m · ~3hr lag",
    "VIIRS_NOAA20_NRT": "VIIRS NOAA-20 · 375m · ~3hr lag",
    "MODIS_NRT":        "MODIS Terra/Aqua · 1km · ~3hr lag",
}

REGION_BBOXES = {
    "india":           "67.0,6.0,98.0,37.0",
    "india_northeast": "88.0,22.0,98.0,30.0",
    "india_northwest": "67.0,23.0,78.0,37.0",
    "western_ghats":   "73.0,8.0,78.0,22.0",
    "himalayas":       "72.0,28.0,97.0,37.0",
    "bay_of_bengal":   "80.0,5.0,100.0,22.0",
    "arabian_sea":     "55.0,8.0,78.0,25.0",
    "south_asia":      "60.0,5.0,100.0,40.0",
    "global":          "-180,-90,180,90",
}

# ── Hard limits — prevents thousands of low-quality detections ────────────────
DEFAULT_MIN_CONFIDENCE = 75    # ignore anything below 75% confidence
DEFAULT_MIN_FRP        = 10.0  # ignore anything below 10 MW fire radiative power
DEFAULT_MAX_RESULTS    = 100   # cap at 100 results maximum per scan


async def check_api_status() -> dict:
    """Validate API key with a tiny real request."""
    if not NASA_FIRMS_KEY or NASA_FIRMS_KEY == "your_firms_key_here":
        return {"status": "no_key", "message": "Add NASA_FIRMS_KEY to .env"}

    test_url = f"{FIRMS_BASE}/{NASA_FIRMS_KEY}/VIIRS_SNPP_NRT/76.0,27.0,78.0,29.0/1"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(test_url)

        if r.status_code == 200:
            text = r.text.strip()
            if "Invalid MAP_KEY" in text or "not authorized" in text.lower():
                return {"status": "invalid_key", "message": "API key rejected by FIRMS."}
            return {"status": "ok", "message": "API key valid"}

        elif r.status_code == 400:
            return {
                "status":  "invalid_key",
                "message": "400 — key wrong or not yet activated. Wait 10 min after registration.",
                "code":    400,
            }
        else:
            return {"status": "error", "message": f"HTTP {r.status_code}", "code": r.status_code}

    except httpx.TimeoutException:
        return {"status": "timeout", "message": "FIRMS API timed out"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def fetch_firms_data(
    source:         str   = "VIIRS_SNPP_NRT",
    bbox:           str   = "67.0,6.0,98.0,37.0",
    day_range:      int   = 1,
    min_confidence: float = DEFAULT_MIN_CONFIDENCE,
    min_frp:        float = DEFAULT_MIN_FRP,
    max_results:    int   = DEFAULT_MAX_RESULTS,
) -> list[dict]:
    """
    Fetch and FILTER thermal hotspots from NASA FIRMS.
    Returns at most max_results high-quality detections.
    """
    if not NASA_FIRMS_KEY or NASA_FIRMS_KEY == "your_firms_key_here":
        return []

    url = f"{FIRMS_BASE}/{NASA_FIRMS_KEY}/{source}/{bbox}/{day_range}"
    print(f"[FIRMS] GET {url}")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url)

        if r.status_code != 200:
            print(f"[FIRMS] HTTP {r.status_code}: {r.text[:200]}")
            return []

        text = r.text.strip()
        if not text or "Invalid MAP_KEY" in text:
            print(f"[FIRMS] Bad response: {text[:100]}")
            return []

        all_rows = _parse_firms_csv(text, source)
        print(f"[FIRMS] Raw rows: {len(all_rows)}")

        # ── Apply filters — this is what prevents 17k results ────────────────
        # Also enforce bbox boundary so global scans don't bleed into wrong regions
        bbox_parts = [float(x) for x in bbox.split(",")]
        lon_min, lat_min, lon_max, lat_max = bbox_parts[0], bbox_parts[1], bbox_parts[2], bbox_parts[3]

        filtered = [
            r for r in all_rows
            if r["confidence"] >= min_confidence
            and r["frp"]        >= min_frp
            and lat_min <= r["lat"] <= lat_max
            and lon_min <= r["lon"] <= lon_max
        ]
        print(f"[FIRMS] After filter (conf≥{min_confidence}%, frp≥{min_frp}MW): {len(filtered)}")

        # Sort by FRP descending — highest energy events first
        filtered.sort(key=lambda r: r["frp"], reverse=True)

        # Hard cap
        result = filtered[:max_results]
        print(f"[FIRMS] Returning top {len(result)} detections")
        return result

    except httpx.TimeoutException:
        print("[FIRMS] Timeout")
        return []
    except Exception as e:
        print(f"[FIRMS] Error: {e}")
        return []


def _parse_firms_csv(raw_csv: str, source: str) -> list[dict]:
    rows   = []
    reader = csv.DictReader(io.StringIO(raw_csv))

    for row in reader:
        try:
            lat = float(row.get("latitude",  0))
            lon = float(row.get("longitude", 0))

            brightness = float(
                row.get("brightness")  or
                row.get("bright_ti4")  or
                row.get("bright_t31")  or 0
            )
            confidence = _parse_confidence(row.get("confidence", "50"))
            frp        = float(row.get("frp", 0) or 0)

            acq_date = row.get("acq_date", "")
            acq_time = str(row.get("acq_time", "0000")).zfill(4)
            try:
                dt      = datetime.strptime(f"{acq_date} {acq_time}", "%Y-%m-%d %H%M")
                acq_str = dt.strftime("%Y-%m-%d %H:%M UTC")
            except Exception:
                acq_str = acq_date or "Unknown"

            rows.append({
                "lat":          lat,
                "lon":          lon,
                "brightness":   brightness,
                "confidence":   confidence,
                "frp":          frp,
                "satellite":    row.get("satellite", source),
                "instrument":   row.get("instrument", "VIIRS"),
                "acq_datetime": acq_str,
                "daynight":     row.get("daynight", "D"),
                "source":       source,
            })
        except Exception:
            continue

    return rows


def firms_to_anomaly_input(hotspots: list[dict]) -> list[dict]:
    """
    Convert NASA FIRMS hotspot dicts into the region-dict format
    expected by the ML classifier and severity scorer.

    Each returned dict has:
      lat, lon, features (list of floats), spectral (7 floats)
    """
    results = []
    for h in hotspots:
        brightness = h.get("brightness", 300.0)
        frp        = h.get("frp", 0.0)
        confidence = h.get("confidence", 50.0)
        lat        = h.get("lat", 0.0)
        lon        = h.get("lon", 0.0)

        # Normalise to roughly [0, 1] for the severity scorer
        b_norm    = float(min(brightness / 500.0, 1.0))
        frp_norm  = float(min(frp / 200.0, 1.0))
        conf_norm = float(confidence / 100.0)
        lat_norm  = float((lat + 90) / 180.0)
        lon_norm  = float((lon + 180) / 360.0)

        # Build a 7-element spectral proxy so SpectralBars renders correctly
        spectral = [
            round(b_norm, 3),
            round(frp_norm, 3),
            round(conf_norm, 3),
            round(lat_norm, 3),
            round(lon_norm, 3),
            round(b_norm * conf_norm, 3),
            round(frp_norm * conf_norm, 3),
        ]

        features = spectral + [b_norm, frp_norm, conf_norm]

        results.append({
            "lat":      lat,
            "lon":      lon,
            "features": features,
            "spectral": spectral,
            "area_km2": round(frp * 0.1, 2),
        })
    return results


def _parse_confidence(val: str) -> float:
    v = str(val).strip().lower()
    if v in ("h", "high"):    return 85.0
    if v in ("n", "nominal"): return 55.0
    if v in ("l", "low"):     return 30.0
    try:
        return min(100.0, max(0.0, float(v)))
    except Exception:
        return 50.0