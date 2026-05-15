# backend/api/routes/livescan.py
# Live satellite scan endpoints:
#
#   GET  /livescan/status          — API key status + last scan info
#   POST /livescan/scan            — trigger a fresh scan for a region
#   GET  /livescan/latest          — get results from the most recent scan
#   GET  /livescan/regions         — list available region presets
#   POST /livescan/schedule/start  — start auto-refresh every N minutes
#   POST /livescan/schedule/stop   — stop auto-refresh

import asyncio
import json
from datetime import datetime, timezone
from pathlib  import Path
from typing   import Optional

from fastapi  import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from services.nasa_firms  import (
    fetch_firms_data,
    firms_to_anomaly_input,
    check_api_status,
    REGION_BBOXES,
    SOURCES,
)
from ml.classifier  import classify
from ml.severity    import score_severity
from api.models.anomaly import Anomaly

router = APIRouter()

# ── Persistent scan state (in-memory, resets on server restart) ───────────────
SCAN_STATE = {
    "last_scan_utc":    None,
    "last_region":      None,
    "last_source":      None,
    "anomaly_count":    0,
    "is_running":       False,
    "schedule_active":  False,
    "schedule_task":    None,
    "error":            None,
}
LATEST_RESULTS_PATH = Path("ml_registry") / "latest_livescan.json"
Path("ml_registry").mkdir(exist_ok=True)


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def livescan_status():
    api_status = await check_api_status()
    return {
        "api":             api_status,
        "last_scan_utc":   SCAN_STATE["last_scan_utc"],
        "last_region":     SCAN_STATE["last_region"],
        "anomaly_count":   SCAN_STATE["anomaly_count"],
        "is_running":      SCAN_STATE["is_running"],
        "schedule_active": SCAN_STATE["schedule_active"],
        "available_regions": list(REGION_BBOXES.keys()),
        "available_sources": list(SOURCES.keys()),
    }


# ── Available regions ─────────────────────────────────────────────────────────

@router.get("/regions")
def list_regions():
    return {
        "regions": [
            {"id": k, "bbox": v, "label": k.replace("_", " ").title()}
            for k, v in REGION_BBOXES.items()
        ]
    }


# ── Trigger a scan ────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    region:    str = "india"
    source:    str = "VIIRS_SNPP_NRT"
    day_range: int = 1                # 1 = last 24h
    min_confidence: float = 50.0     # filter out low-confidence detections


@router.post("/scan")
async def trigger_scan(body: ScanRequest, background_tasks: BackgroundTasks):
    """
    Trigger a fresh scan of a region using NASA FIRMS data.
    Runs in background — returns immediately.
    Poll GET /livescan/latest for results.
    """
    if SCAN_STATE["is_running"]:
        raise HTTPException(409, "Scan already in progress — wait for it to finish")

    if body.region not in REGION_BBOXES:
        raise HTTPException(400, f"Unknown region '{body.region}'. Use GET /livescan/regions")

    if body.source not in SOURCES:
        raise HTTPException(400, f"Unknown source '{body.source}'.")

    background_tasks.add_task(
        _run_scan,
        region       = body.region,
        source       = body.source,
        day_range    = body.day_range,
        min_confidence = body.min_confidence,
    )

    return {
        "status":  "started",
        "region":  body.region,
        "source":  body.source,
        "message": "Scan started. Poll GET /livescan/latest for results.",
    }


@router.post("/scan/sync")
async def trigger_scan_sync(body: ScanRequest):
    """
    Same as /scan but waits for results before returning.
    Use this from the frontend for immediate feedback.
    """
    if body.region not in REGION_BBOXES:
        raise HTTPException(400, f"Unknown region '{body.region}'")

    anomalies = await _run_scan(
        region         = body.region,
        source         = body.source,
        day_range      = body.day_range,
        min_confidence = body.min_confidence,
    )

    return {
        "region":        body.region,
        "source":        body.source,
        "anomalies_found": len(anomalies),
        "anomalies":     [a.dict() for a in anomalies],
        "scan_utc":      SCAN_STATE["last_scan_utc"],
        "satellite_source_desc": SOURCES.get(body.source, body.source),
    }


# ── Latest results ────────────────────────────────────────────────────────────

@router.get("/latest")
def get_latest():
    """Return the most recent scan results."""
    if not LATEST_RESULTS_PATH.exists():
        return {
            "anomalies": [],
            "scan_utc":  None,
            "message":   "No scan yet — POST /livescan/scan to start one",
        }
    with open(LATEST_RESULTS_PATH) as f:
        return json.load(f)


# ── Auto-refresh scheduler ────────────────────────────────────────────────────

class ScheduleRequest(BaseModel):
    region:         str   = "india"
    source:         str   = "VIIRS_SNPP_NRT"
    interval_min:   int   = 30       # refresh every N minutes (min 5)
    min_confidence: float = 50.0


@router.post("/schedule/start")
async def start_schedule(body: ScheduleRequest):
    if SCAN_STATE["schedule_active"]:
        return {"status": "already_running", "interval_min": body.interval_min}

    if body.interval_min < 5:
        raise HTTPException(400, "Minimum interval is 5 minutes")

    SCAN_STATE["schedule_active"] = True
    asyncio.create_task(_scheduled_loop(body))

    return {
        "status":       "started",
        "interval_min": body.interval_min,
        "region":       body.region,
        "message":      f"Auto-scan every {body.interval_min} min for {body.region}",
    }


@router.post("/schedule/stop")
def stop_schedule():
    SCAN_STATE["schedule_active"] = False
    return {"status": "stopped"}


# ── Core scan logic ───────────────────────────────────────────────────────────

async def _run_scan(
    region:         str,
    source:         str,
    day_range:      int,
    min_confidence: float,
) -> list[Anomaly]:
    """
    1. Fetch FIRMS hotspots for the region
    2. Filter by confidence threshold
    3. Convert to feature vectors
    4. Run through classifier + severity scorer
    5. Save results and return anomaly list
    """
    SCAN_STATE["is_running"]   = True
    SCAN_STATE["error"]        = None

    try:
        bbox = REGION_BBOXES.get(region, REGION_BBOXES["india"])

        # 1. Fetch from NASA FIRMS
        hotspots = await fetch_firms_data(
            source    = source,
            bbox      = bbox,
            day_range = day_range,
        )

        # 2. Filter by confidence
        hotspots = [h for h in hotspots if h["confidence"] >= min_confidence]

        if not hotspots:
            _save_results([], region, source)
            return []

        # 3. Convert to region dicts
        regions = firms_to_anomaly_input(hotspots)

        # 4. Classify + score each hotspot
        anomalies = []
        for i, region_dict in enumerate(regions):
            hotspot   = hotspots[i]
            atype     = _classify_firms(hotspot, region_dict)
            sev, conf = score_severity(region_dict["features"], atype)

            lat = region_dict["lat"]
            lon = region_dict["lon"]

            anomalies.append(Anomaly(
                id          = f"LIVE-{str(i + 1).zfill(4)}",
                type        = atype,
                coords      = f"{abs(lat):.4f}° {'N' if lat >= 0 else 'S'}, {abs(lon):.4f}° {'E' if lon >= 0 else 'W'}",
                lat         = round(lat, 4),
                lon         = round(lon, 4),
                region      = _region_name(lat, lon),
                severity    = sev,
                confidence  = round(hotspot["confidence"], 1),
                status      = "UNRESOLVED",
                description = _build_description(atype, hotspot),
                spectral    = [round(float(v), 3) for v in region_dict["spectral"]],
                timestamp   = hotspot["acq_datetime"],
            ))

        # Sort by severity
        _order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
        anomalies.sort(key=lambda a: _order.get(a.severity, 4))

        # 5. Save and update state
        _save_results(anomalies, region, source)
        return anomalies

    except Exception as e:
        SCAN_STATE["error"] = str(e)
        print(f"[LiveScan] Error: {e}")
        return []

    finally:
        SCAN_STATE["is_running"]  = False
        SCAN_STATE["last_region"] = region
        SCAN_STATE["last_source"] = source
        SCAN_STATE["last_scan_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _classify_firms(hotspot: dict, region_dict: dict) -> str:
    """
    FIRMS-specific classification based on brightness + FRP + location.
    Overrides the generic spectral classifier with domain knowledge.
    """
    brightness = hotspot.get("brightness", 0)
    frp        = hotspot.get("frp", 0)
    lat        = hotspot.get("lat", 0)
    lon        = hotspot.get("lon", 0)
    confidence = hotspot.get("confidence", 0)
    is_day     = hotspot.get("daynight", "D") == "D"

    # Very high temperature + high FRP → likely industrial/mining burning
    if brightness > 380 and frp > 100:
        return "Illegal Mining"

    # High brightness at night in border regions → Border Intrusion
    if not is_day and brightness > 330 and confidence > 70:
        if (28 <= lat <= 37 and 70 <= lon <= 80) or \
           (20 <= lat <= 28 and 88 <= lon <= 97):
            return "Border Intrusion"

    # High brightness near coastlines/water → Naval activity
    if lat < 15 or lon < 70 or lon > 90:
        if brightness > 320:
            return "Naval Movement"

    # Default: Unauthorized Construction / burning
    return "Unauthorized Construction"


def _build_description(atype: str, hotspot: dict) -> str:
    b   = hotspot.get("brightness", 0)
    frp = hotspot.get("frp", 0)
    sat = hotspot.get("satellite", "VIIRS")
    acq = hotspot.get("acq_datetime", "")

    base = {
        "Naval Movement":
            f"Thermal anomaly detected near maritime region. Brightness: {b:.1f}K. Detected by {sat} at {acq}.",
        "Illegal Mining":
            f"High-intensity thermal signature consistent with industrial burning or excavation activity. Brightness: {b:.1f}K, FRP: {frp:.1f} MW. Detected by {sat}.",
        "Border Intrusion":
            f"Nocturnal thermal anomaly in border-adjacent region. Brightness: {b:.1f}K. Detected by {sat} at {acq}.",
        "Unauthorized Construction":
            f"Thermal hotspot detected. Brightness: {b:.1f}K, Fire Radiative Power: {frp:.1f} MW. Source: {sat}.",
    }
    return base.get(atype, f"Thermal anomaly. Brightness: {b:.1f}K. Source: {sat}.")


def _region_name(lat: float, lon: float) -> str:
    # Himalayas first (overlaps NW India lat range)
    if 28 <= lat <= 37 and 70 <= lon <= 97:   return "Himalayan Region"
    if 23 <= lat <= 37 and 67 <= lon <= 78:   return "Northwestern India"
    if 22 <= lat <= 30 and 88 <= lon <= 98:   return "Northeast India"
    if 18 <= lat <= 28 and 75 <= lon <= 88:   return "Central India"
    if 8  <= lat <= 22 and 72 <= lon <= 85:   return "Southern India"
    if lat <= 25 and lon <= 72:               return "Arabian Sea"
    if lat <= 22 and lon >= 80:               return "Bay of Bengal"
    if 5 <= lat <= 40 and 60 <= lon <= 105:   return "South Asia"
    return f"({lat:.1f}°N, {lon:.1f}°E)"


def _save_results(anomalies: list, region: str, source: str):
    SCAN_STATE["anomaly_count"] = len(anomalies)
    data = {
        "region":          region,
        "source":          source,
        "scan_utc":        datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "anomalies_found": len(anomalies),
        "anomalies":       [a.dict() for a in anomalies],
    }
    with open(LATEST_RESULTS_PATH, "w") as f:
        json.dump(data, f, indent=2)


async def _scheduled_loop(body: ScheduleRequest):
    """Background task that re-scans every N minutes."""
    while SCAN_STATE["schedule_active"]:
        await _run_scan(
            region         = body.region,
            source         = body.source,
            day_range      = 1,
            min_confidence = body.min_confidence,
        )
        await asyncio.sleep(body.interval_min * 60)
