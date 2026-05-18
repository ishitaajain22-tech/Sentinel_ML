# ml/hybrid_classifier.py
# Stage 2 Hybrid Classifier
#
# Feature vector (10 dims):
#   [0] brightness_norm      from firms_to_anomaly_input
#   [1] frp_norm
#   [2] confidence_norm
#   [3] lat_norm
#   [4] lon_norm
#   [5] b_x_conf             interaction term
#   [6] frp_x_conf           interaction term
#   [7] persistence_score    from persistence engine
#   [8] confidence_slope     from persistence engine
#   [9] night_ratio          from persistence engine
#
# Training data: weak supervision bootstrapped from rule-based labels,
# iteratively refined. When no trained model exists on disk, falls back
# to the rule-based classifier (Stage 1) so the system always works.

import json
import os
import pickle
from pathlib import Path

import numpy as np

MODEL_PATH      = Path("ml_registry") / "hybrid_clf.pkl"
TRAINING_PATH   = Path("ml_registry") / "training_data.json"
MIN_SAMPLES     = 20   # minimum samples before we trust the RF over rules
FEATURE_NAMES   = [
    "brightness_norm", "frp_norm", "confidence_norm",
    "lat_norm", "lon_norm",
    "brightness_x_confidence", "frp_x_confidence",
    "persistence_score", "confidence_slope", "night_ratio",
]
CLASSES = ["Naval Movement", "Illegal Mining",
           "Border Intrusion", "Unauthorized Construction"]


# ── Rule-based fallback (Stage 1) ─────────────────────────────────────────────

def _rule_classify(hotspot: dict, persist: dict) -> str:
    brightness  = hotspot.get("brightness",  0.0)
    frp         = hotspot.get("frp",         0.0)
    lat         = hotspot.get("lat",         0.0)
    lon         = hotspot.get("lon",         0.0)
    confidence  = hotspot.get("confidence",  50.0)
    is_day      = hotspot.get("daynight", "D") == "D"
    night_ratio = persist.get("night_ratio", 0.5)

    if brightness > 380 and frp > 100:
        return "Illegal Mining"
    if not is_day and brightness > 330 and confidence > 70:
        if (28 <= lat <= 37 and 70 <= lon <= 80) or \
           (20 <= lat <= 28 and 88 <= lon <= 97):
            return "Border Intrusion"
    # Persistent night detections near coasts → naval
    if night_ratio > 0.7 and (lat < 15 or lon < 70 or lon > 90):
        return "Naval Movement"
    if lat < 15 or lon < 70 or lon > 90:
        if brightness > 320:
            return "Naval Movement"
    return "Unauthorized Construction"


# ── Feature vector builder ─────────────────────────────────────────────────────

def build_feature_vector(hotspot: dict, persist: dict) -> np.ndarray:
    """
    Build the 10-dim feature vector for a single hotspot.
    hotspot: dict from fetch_firms_data (brightness, frp, confidence, lat, lon, daynight)
    persist: dict from persistence.enrich_hotspot
    """
    b    = min(hotspot.get("brightness", 0.0) / 500.0, 1.0)
    frp  = min(hotspot.get("frp",        0.0) / 200.0, 1.0)
    conf = hotspot.get("confidence", 50.0) / 100.0
    lat  = (hotspot.get("lat",  0.0) + 90)  / 180.0
    lon  = (hotspot.get("lon",  0.0) + 180) / 360.0

    ps   = persist.get("persistence_score",    0.0)
    cs   = persist.get("confidence_slope",      0.0)
    nr   = persist.get("night_ratio",          0.5)

    return np.array([b, frp, conf, lat, lon, b * conf, frp * conf, ps, cs, nr],
                    dtype=np.float32)


# ── Model persistence ──────────────────────────────────────────────────────────

def load_model():
    """Load trained RF model from disk. Returns None if not yet trained."""
    if not MODEL_PATH.exists():
        return None
    try:
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    except Exception:
        return None


def save_model(model) -> None:
    MODEL_PATH.parent.mkdir(exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)


# ── Training ───────────────────────────────────────────────────────────────────

def train_from_history(scans: list[dict]) -> dict:
    """
    Bootstrap a Random Forest from scan history using weak supervision:
      1. Apply rule-based classifier to all historical hotspots → noisy labels
      2. Build feature vectors including persistence features
      3. Train Random Forest
      4. Save model to disk

    Returns training summary dict.
    """
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import cross_val_score
    except ImportError:
        return {"error": "scikit-learn not installed"}

    from ml.persistence import build_coord_index, enrich_hotspot

    X_list, y_list = [], []
    coord_idx = build_coord_index(scans)

    for scan in scans:
        for a in scan.get("anomalies", []):
            lat = a.get("lat")
            lon = a.get("lon")
            if lat is None or lon is None:
                continue

            # Build a pseudo-hotspot dict from stored anomaly fields
            desc = a.get("description", "")
            hotspot = {
                "brightness": _extract_brightness(desc) if desc else 300.0,
                "frp":        _extract_frp(desc)        if desc else 20.0,
                "confidence": float(a.get("confidence", 50.0)),
                "lat":        lat,
                "lon":        lon,
                "daynight":   "N" if "nocturnal" in desc.lower() else "D",
            }
            persist = enrich_hotspot(float(lat), float(lon), coord_idx)
            fv      = build_feature_vector(hotspot, persist)
            # Use stored type as weak label; fall back to rule classify if missing
            label = a.get("type") or _rule_classify(hotspot, persist)

            if label in CLASSES:
                X_list.append(fv)
                y_list.append(label)

    if len(X_list) < MIN_SAMPLES:
        return {
            "status":  "insufficient_data",
            "samples": len(X_list),
            "message": f"Need {MIN_SAMPLES} samples, have {len(X_list)}. Run more scans first.",
        }

    X = np.array(X_list)
    y = np.array(y_list)

    clf = RandomForestClassifier(
        n_estimators     = 200,
        max_depth        = 8,
        min_samples_leaf = 3,
        class_weight     = "balanced",
        random_state     = 42,
        n_jobs           = -1,
    )
    clf.fit(X, y)

    # Cross-validation score
    cv_scores = cross_val_score(clf, X, y, cv=min(5, len(set(y))), scoring="f1_macro")

    save_model(clf)

    return {
        "status":        "trained",
        "samples":       len(X_list),
        "classes":       list(set(y_list)),
        "cv_f1_macro":   round(float(cv_scores.mean()), 4),
        "cv_f1_std":     round(float(cv_scores.std()),  4),
        "feature_names": FEATURE_NAMES,
        "feature_importances": dict(zip(
            FEATURE_NAMES,
            [round(float(v), 4) for v in clf.feature_importances_]
        )),
    }


# ── Classification ─────────────────────────────────────────────────────────────

def hybrid_classify(hotspot: dict, persist: dict) -> tuple[str, float, str]:
    """
    Classify a hotspot using Stage 2 (RF) if model exists, else Stage 1 (rules).
    Returns: (anomaly_type, probability, stage_used)
    """
    model = load_model()
    fv    = build_feature_vector(hotspot, persist)

    if model is not None:
        try:
            proba = model.predict_proba([fv])[0]
            idx   = int(np.argmax(proba))
            return model.classes_[idx], round(float(proba[idx]), 4), "rf"
        except Exception:
            pass  # fall through to rules

    # Stage 1 fallback
    label = _rule_classify(hotspot, persist)
    return label, 0.70, "rules"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_brightness(description: str) -> float:
    """Pull brightness value from description string like 'Brightness: 340.5K'."""
    import re
    m = re.search(r"[Bb]rightness[:\s]+([0-9.]+)", description)
    return float(m.group(1)) if m else 300.0


def _extract_frp(description: str) -> float:
    """Pull FRP value from description string like 'Fire Radiative Power: 45.2 MW'."""
    import re
    m = re.search(r"[Ff]ire Radiative Power[:\s]+([0-9.]+)", description)
    if not m:
        m = re.search(r"FRP[:\s]+([0-9.]+)", description)
    return float(m.group(1)) if m else 10.0


def get_model_info() -> dict:
    """Return info about the current model state."""
    model = load_model()
    if model is None:
        return {
            "stage":   "rules",
            "trained": False,
            "message": "No RF model trained yet. POST /research/train to train.",
        }
    try:
        return {
            "stage":             "rf",
            "trained":           True,
            "n_estimators":      model.n_estimators,
            "classes":           list(model.classes_),
            "feature_names":     FEATURE_NAMES,
            "feature_importances": dict(zip(
                FEATURE_NAMES,
                [round(float(v), 4) for v in model.feature_importances_]
            )),
        }
    except Exception as e:
        return {"stage": "rf", "trained": True, "error": str(e)}
