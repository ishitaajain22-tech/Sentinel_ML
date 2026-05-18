# api/routes/research.py
# Research endpoints exposing the 4 novel contributions:
#   GET  /research/model          - current model info (RF vs rules, feature importances)
#   POST /research/train          - train RF from scan history
#   GET  /research/persistence    - persistence map for latest scan
#   GET  /research/explain/{id}   - SHAP explanation for a specific anomaly
#   GET  /research/explain        - all explanations for latest scan
#   GET  /research/evaluate       - evaluation metrics (RF vs rules comparison)
#   GET  /research/global_importance - global feature importance chart data

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ml.hybrid_classifier import (
    train_from_history, get_model_info, FEATURE_NAMES, CLASSES
)
from ml.explainability    import global_feature_importance
from ml.persistence       import load_history, build_coord_index

router      = APIRouter()
LATEST_PATH = Path("ml_registry") / "latest_livescan.json"
HISTORY_PATH= Path("ml_registry") / "scan_history.json"


# ── Model info ────────────────────────────────────────────────────────────────

@router.get("/model")
def get_model():
    """Current classifier state — RF or rules, feature importances."""
    return get_model_info()


# ── Train RF from history ─────────────────────────────────────────────────────

@router.post("/train")
def train_model():
    """
    Bootstrap Random Forest from scan history + latest scan using weak supervision.
    Works as long as there are 20+ anomalies total across all available data.
    """
    history = load_history()

    # Also seed from latest_livescan.json if history is sparse
    if LATEST_PATH.exists():
        import json as _json
        with open(LATEST_PATH) as f:
            latest = _json.load(f)
        latest_anomalies = latest.get("anomalies", [])
        # Create a synthetic scan record from latest if not already in history
        if latest_anomalies and (not history or history[0].get("scan_utc") != latest.get("scan_utc")):
            synthetic = {
                "region":          latest.get("region", "india"),
                "source":          latest.get("source", "VIIRS_SNPP_NRT"),
                "scan_utc":        latest.get("scan_utc", ""),
                "anomalies_found": len(latest_anomalies),
                "anomalies":       latest_anomalies,
            }
            history = [synthetic] + history

    if not history:
        raise HTTPException(400, "No scan data available. Run a scan first via POST /livescan/scan/sync")

    result = train_from_history(history)
    return result


# ── Seed: re-enrich latest scan with persistence + SHAP ─────────────────────

@router.post("/seed")
def seed_latest():
    """
    Re-enriches the latest scan with persistence features and SHAP explanations
    without hitting the NASA FIRMS API again. Run this once after deploying the
    new ML pipeline if you already have scan data from before the upgrade.
    """
    if not LATEST_PATH.exists():
        raise HTTPException(404, "No scan data. Run a scan first.")

    import json as _json
    from ml.persistence       import build_coord_index, load_history, enrich_hotspot
    from ml.hybrid_classifier import hybrid_classify, _rule_classify, _extract_brightness, _extract_frp
    from ml.explainability    import explain_anomaly

    with open(LATEST_PATH) as f:
        latest = _json.load(f)

    history   = load_history()
    coord_idx = build_coord_index(history)
    anomalies = latest.get("anomalies", [])
    enriched  = []

    for a in anomalies:
        lat = a.get("lat")
        lon = a.get("lon")
        if lat is None or lon is None:
            enriched.append(a)
            continue

        desc    = a.get("description", "")
        hotspot = {
            "brightness": _extract_brightness(desc) if desc else 300.0,
            "frp":        _extract_frp(desc)        if desc else 20.0,
            "confidence": float(a.get("confidence", 50.0)),
            "lat":        float(lat),
            "lon":        float(lon),
            "daynight":   "N" if "nocturnal" in desc.lower() else "D",
        }
        persist          = enrich_hotspot(float(lat), float(lon), coord_idx)
        atype            = a.get("type") or _rule_classify(hotspot, persist)
        _, rf_prob, stage = hybrid_classify(hotspot, persist)
        explanation      = explain_anomaly(hotspot, persist, atype)

        enriched.append({
            **a,
            "persistence":       persist,
            "explanation":       explanation,
            "classifier_stage":  stage,
            "rf_probability":    round(rf_prob, 4),
        })

    latest["anomalies"] = enriched
    with open(LATEST_PATH, "w") as f:
        _json.dump(latest, f, indent=2)

    return {
        "status":   "seeded",
        "enriched": len(enriched),
        "scan_utc": latest.get("scan_utc"),
    }


# ── Persistence analysis ──────────────────────────────────────────────────────

@router.get("/persistence")
def get_persistence_map():
    """
    Persistence features for all anomalies in the latest scan.
    Shows recurrence_count, confidence_slope, night_ratio per hotspot.
    """
    if not LATEST_PATH.exists():
        raise HTTPException(404, "No scan yet")

    with open(LATEST_PATH) as f:
        latest = json.load(f)

    anomalies = latest.get("anomalies", [])
    result = {}
    for a in anomalies:
        p = a.get("persistence")
        if p:
            result[a["id"]] = {
                "type":               a.get("type"),
                "severity":           a.get("severity"),
                "coords":             a.get("coords"),
                "persistence_score":  p.get("persistence_score", 0),
                "confidence_slope":   p.get("confidence_slope", 0),
                "night_ratio":        p.get("night_ratio", 0.5),
                "interval_consistency": p.get("interval_consistency", 0.5),
                "recurrence_count":   p.get("recurrence_count", 0),
                "trajectory":         p.get("trajectory", []),
            }
        else:
            result[a["id"]] = {
                "type":     a.get("type"),
                "severity": a.get("severity"),
                "note":     "persistence data not yet available — rescan to compute",
            }

    return {
        "scan_utc":   latest.get("scan_utc"),
        "region":     latest.get("region"),
        "total":      len(result),
        "persistent": sum(1 for v in result.values() if v.get("recurrence_count", 0) >= 2),
        "anomalies":  result,
    }


# ── SHAP explanations ─────────────────────────────────────────────────────────

@router.get("/explain")
def get_all_explanations():
    """SHAP explanations for all anomalies in the latest scan."""
    if not LATEST_PATH.exists():
        raise HTTPException(404, "No scan yet")

    with open(LATEST_PATH) as f:
        latest = json.load(f)

    anomalies = latest.get("anomalies", [])
    result = {}
    for a in anomalies:
        exp = a.get("explanation")
        if exp:
            result[a["id"]] = {
                "type":             a.get("type"),
                "severity":         a.get("severity"),
                "explanation_text": exp.get("explanation_text", ""),
                "top_features":     exp.get("top_features", []),
                "shap_values":      exp.get("shap_values", []),
                "base_value":       exp.get("base_value", 0),
                "method":           exp.get("method", "rule_approximation"),
                "feature_names":    FEATURE_NAMES,
            }
        else:
            result[a["id"]] = {
                "note": "explanation not yet available — rescan to compute"
            }

    return {
        "scan_utc":  latest.get("scan_utc"),
        "total":     len(result),
        "anomalies": result,
    }


@router.get("/explain/{anomaly_id}")
def get_explanation(anomaly_id: str):
    """SHAP explanation for a single anomaly by ID."""
    if not LATEST_PATH.exists():
        raise HTTPException(404, "No scan yet")

    with open(LATEST_PATH) as f:
        latest = json.load(f)

    for a in latest.get("anomalies", []):
        if a.get("id") == anomaly_id:
            exp = a.get("explanation")
            if exp:
                return {**exp, "anomaly_id": anomaly_id, "feature_names": FEATURE_NAMES}
            raise HTTPException(404, f"Explanation not computed for {anomaly_id}. Rescan.")

    raise HTTPException(404, f"Anomaly {anomaly_id} not found in latest scan")


# ── Evaluation: RF vs rules comparison ───────────────────────────────────────

@router.get("/evaluate")
def evaluate_classifier():
    """
    Compare RF classifier vs rule-based on historical data.
    Returns per-class metrics and overall false positive reduction estimate.
    """
    history = load_history()
    if len(history) < 3:
        raise HTTPException(400, "Need at least 3 scans for evaluation")

    from ml.hybrid_classifier import load_model, build_feature_vector, _rule_classify
    from ml.persistence       import enrich_hotspot

    model     = load_model()
    coord_idx = build_coord_index(history)

    rule_preds, rf_preds, true_labels = [], [], []

    for scan in history:
        for a in scan.get("anomalies", []):
            lat  = a.get("lat")
            lon  = a.get("lon")
            true = a.get("type")
            if not lat or not lon or not true:
                continue

            pseudo_hotspot = {
                "brightness": 300.0,
                "frp":        20.0,
                "confidence": a.get("confidence", 50.0),
                "lat":        lat,
                "lon":        lon,
                "daynight":   "D",
            }
            persist       = enrich_hotspot(float(lat), float(lon), coord_idx)
            rule_pred     = _rule_classify(pseudo_hotspot, persist)
            rule_preds.append(rule_pred)
            true_labels.append(true)

            if model:
                try:
                    import numpy as np
                    fv       = build_feature_vector(pseudo_hotspot, persist)
                    rf_pred  = model.predict([fv])[0]
                    rf_preds.append(rf_pred)
                except Exception:
                    rf_preds.append(rule_pred)
            else:
                rf_preds.append(rule_pred)

    if not true_labels:
        raise HTTPException(400, "No labelled data in history for evaluation")

    # Compute per-class agreement rates
    classes = list(set(true_labels))
    rule_agreement = {}
    rf_agreement   = {}

    for cls in classes:
        cls_indices = [i for i, t in enumerate(true_labels) if t == cls]
        if cls_indices:
            rule_agreement[cls] = round(
                sum(1 for i in cls_indices if rule_preds[i] == cls) / len(cls_indices), 3
            )
            rf_agreement[cls] = round(
                sum(1 for i in cls_indices if i < len(rf_preds) and rf_preds[i] == cls) / len(cls_indices), 3
            )

    overall_rule = round(sum(1 for r, t in zip(rule_preds, true_labels) if r == t) / len(true_labels), 3)
    overall_rf   = round(sum(1 for r, t in zip(rf_preds, true_labels) if r == t)   / len(true_labels), 3) if rf_preds else overall_rule

    return {
        "total_samples":     len(true_labels),
        "scans_used":        len(history),
        "overall_accuracy":  {
            "rules": overall_rule,
            "rf":    overall_rf,
            "improvement": round(overall_rf - overall_rule, 3),
        },
        "per_class_accuracy": {
            cls: {"rules": rule_agreement.get(cls, 0), "rf": rf_agreement.get(cls, 0)}
            for cls in classes
        },
        "model_trained": model is not None,
        "note": "Accuracy computed on weak labels (rule-based outputs). "
                "For peer-review quality metrics, validate against FIRMS fire archive ground truth.",
    }


# ── Global feature importance ─────────────────────────────────────────────────

@router.get("/global_importance")
def get_global_importance():
    """
    Global feature importance for the paper's Figure 3.
    Returns RF importances if trained, else rule approximation.
    """
    history = load_history()
    return global_feature_importance(history)


# ── Summary stats for research dashboard ─────────────────────────────────────

@router.get("/summary")
def get_research_summary():
    """High-level research stats for the frontend dashboard tab."""
    history = load_history()
    model   = get_model_info()

    total_anomalies = sum(s.get("anomalies_found", 0) for s in history)
    persistent = 0
    night_detections = 0
    rising_confidence = 0

    for scan in history:
        for a in scan.get("anomalies", []):
            p = a.get("persistence", {})
            if p.get("recurrence_count", 0) >= 2:
                persistent += 1
            if p.get("night_ratio", 0) > 0.6:
                night_detections += 1
            if p.get("confidence_slope", 0) > 0.02:
                rising_confidence += 1

    return {
        "scans_recorded":      len(history),
        "total_anomalies":     total_anomalies,
        "persistent_hotspots": persistent,
        "night_detections":    night_detections,
        "rising_confidence":   rising_confidence,
        "classifier_stage":    model.get("stage", "rules"),
        "model_trained":       model.get("trained", False),
        "feature_names":       FEATURE_NAMES,
        "classes":             CLASSES,
    }
