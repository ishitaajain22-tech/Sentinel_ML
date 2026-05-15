# ml/severity.py
import numpy as np

TYPE_BASE = {
    "Naval Movement":           0.78,
    "Illegal Mining":           0.63,
    "Border Intrusion":         0.85,
    "Unauthorized Construction":0.52,
}


def score_severity(features: list, anomaly_type: str) -> tuple:
    f         = np.array(features, dtype=np.float32)
    base      = TYPE_BASE.get(anomaly_type, 0.55)
    intensity = float(np.clip(f.mean() + f.std() * 0.4, 0.0, 1.0))
    score     = float(np.clip(base * 0.65 + intensity * 0.35, 0.0, 1.0))

    if score >= 0.80:
        severity = "CRITICAL"
    elif score >= 0.62:
        severity = "HIGH"
    elif score >= 0.44:
        severity = "MODERATE"
    else:
        severity = "LOW"

    rng        = np.random.default_rng(int(abs(f.sum()) * 1000) % (2**31))
    confidence = float(np.clip(score + rng.uniform(-0.05, 0.05), 0.50, 0.99))
    return severity, round(confidence, 3)
