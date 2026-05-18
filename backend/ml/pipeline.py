# ml/pipeline.py

from datetime import datetime, timezone

from api.models.anomaly import Anomaly
from ml.preprocessor    import preprocess
from ml.detector        import detect_anomalies
from ml.classifier      import classify
from ml.severity        import score_severity


def run_pipeline(file_path: str) -> list:
    data, metadata = preprocess(file_path)
    regions        = detect_anomalies(data)

    anomalies = []
    for i, region in enumerate(regions):
        anomaly_type        = classify(region["features"])
        severity, confidence = score_severity(region["features"], anomaly_type)

        lat = region.get("lat", 0.0)
        lon = region.get("lon", 0.0)

        anomaly = Anomaly(
            id          = f"ANO-{str(i + 1).zfill(4)}",
            type        = anomaly_type,
            coords      = f"{abs(lat):.4f}° {'N' if lat >= 0 else 'S'}, {abs(lon):.4f}° {'E' if lon >= 0 else 'W'}",
            lat         = round(lat, 4),
            lon         = round(lon, 4),
            region      = metadata.get("region", _infer_region(lat, lon)),
            severity    = severity,
            confidence  = round(confidence * 100, 1),
            status      = "UNRESOLVED",
            description = _build_description(anomaly_type, region),
            spectral    = [round(float(v), 3) for v in region.get("spectral", [0.0] * 7)],
            timestamp   = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        )
        anomalies.append(anomaly)

    _order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
    anomalies.sort(key=lambda a: _order.get(a.severity, 4))
    return anomalies


def _build_description(anomaly_type: str, region: dict) -> str:
    area = region.get("area_km2", "?")
    templates = {
        "Naval Movement":
            "Unregistered vessel activity detected. Spectral and motion signatures consistent with unauthorized maritime presence.",
        "Illegal Mining":
            f"Excavation signatures detected. Estimated affected area: {area} km². No authorization on record.",
        "Border Intrusion":
            "Thermal and motion anomaly detected crossing demarcated boundary. Multiple signatures identified.",
        "Unauthorized Construction":
            "Progressive structural change detected in a no-build zone. Footprint expansion identified.",
    }
    return templates.get(anomaly_type, "Anomalous activity detected. Manual review recommended.")


def _infer_region(lat: float, lon: float) -> str:
    if 8 <= lat <= 37 and 68 <= lon <= 97:
        return "Indian Subcontinent"
    elif lat > 60:
        return "Arctic Region"
    elif lat < -30:
        return "Southern Hemisphere"
    elif 0 <= lat <= 30 and 30 <= lon <= 60:
        return "Middle East"
    elif 30 <= lat <= 70 and -10 <= lon <= 40:
        return "European Region"
    else:
        return f"Region ({lat:.1f}°, {lon:.1f}°)"