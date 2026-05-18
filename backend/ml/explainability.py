# ml/explainability.py
# SHAP-based Explainability Layer
#
# For each classified anomaly, computes SHAP values that show
# which features drove the classification decision.
#
# Output per anomaly:
#   shap_values     - per-feature contribution to the prediction
#   base_value      - expected model output (baseline)
#   top_features    - sorted list of (feature_name, shap_value, direction)
#   explanation_text - natural language summary for the analyst UI
#
# Falls back to rule-based feature importance if SHAP not available
# or if the RF model hasn't been trained yet.

import numpy as np
from ml.hybrid_classifier import (
    FEATURE_NAMES, CLASSES, load_model, build_feature_vector
)

# Natural language templates for each feature
_FEATURE_LABELS = {
    "brightness_norm":           "thermal brightness",
    "frp_norm":                  "fire radiative power",
    "confidence_norm":           "single-pass detection confidence",
    "lat_norm":                  "latitude position",
    "lon_norm":                  "longitude position",
    "brightness_x_confidence":   "brightness × confidence interaction",
    "frp_x_confidence":          "FRP × confidence interaction",
    "persistence_score":         "temporal persistence (multi-pass)",
    "confidence_slope":          "confidence trend across passes",
    "night_ratio":               "nocturnal detection ratio",
}

_DIRECTION_LABELS = {
    "persistence_score":  ("repeated detections strengthen classification",
                           "single-pass detection weakens confidence"),
    "confidence_slope":   ("rising confidence trend supports classification",
                           "falling confidence trend weakens classification"),
    "night_ratio":        ("predominantly nocturnal activity",
                           "predominantly daytime activity"),
    "brightness_norm":    ("high thermal brightness supports classification",
                           "low thermal brightness weakens classification"),
    "frp_norm":           ("high fire radiative power supports classification",
                           "low fire radiative power weakens classification"),
}


def _rule_based_shap(hotspot: dict, persist: dict,
                     anomaly_type: str) -> dict:
    """
    Fallback: approximate feature importance without SHAP,
    using normalised feature values weighted by known rule thresholds.
    """
    fv = build_feature_vector(hotspot, persist)
    weights = {
        "Naval Movement":            [0.05, 0.08, 0.10, 0.10, 0.15, 0.05, 0.08, 0.12, 0.10, 0.17],
        "Illegal Mining":            [0.25, 0.30, 0.10, 0.05, 0.05, 0.10, 0.10, 0.02, 0.01, 0.02],
        "Border Intrusion":          [0.15, 0.05, 0.15, 0.20, 0.10, 0.05, 0.02, 0.08, 0.05, 0.15],
        "Unauthorized Construction": [0.10, 0.08, 0.12, 0.08, 0.08, 0.08, 0.08, 0.15, 0.12, 0.11],
    }
    w = np.array(weights.get(anomaly_type, weights["Unauthorized Construction"]))
    shap_values = (fv * w).tolist()
    total       = sum(abs(v) for v in shap_values) or 1.0
    return {
        "shap_values":  [round(v, 4) for v in shap_values],
        "base_value":   0.25,
        "total_effect": round(sum(shap_values), 4),
        "method":       "rule_approximation",
        "feature_names": FEATURE_NAMES,
    }


def explain_anomaly(hotspot: dict, persist: dict, anomaly_type: str) -> dict:
    """
    Compute SHAP explanation for a single classified anomaly.

    Returns:
      shap_values       list[float]  per-feature SHAP contribution
      base_value        float        expected output baseline
      top_features      list[dict]   sorted by |shap|, with labels
      explanation_text  str          one-sentence natural language summary
      method            str          'shap_tree' | 'rule_approximation'
    """
    model    = load_model()
    fv       = build_feature_vector(hotspot, persist)
    shap_raw = None

    if model is not None:
        try:
            import shap
            explainer  = shap.TreeExplainer(model)
            shap_out   = explainer.shap_values(fv.reshape(1, -1))

            # shap_values is list[array] (one per class) — pick the predicted class
            class_idx  = list(model.classes_).index(anomaly_type) \
                         if anomaly_type in model.classes_ else 0
            sv         = shap_out[class_idx][0] if isinstance(shap_out, list) else shap_out[0]
            base_val   = float(explainer.expected_value[class_idx]) \
                         if hasattr(explainer.expected_value, '__len__') \
                         else float(explainer.expected_value)

            shap_raw = {
                "shap_values":  [round(float(v), 4) for v in sv],
                "base_value":   round(base_val, 4),
                "total_effect": round(float(sv.sum()), 4),
                "method":       "shap_tree",
                "feature_names": FEATURE_NAMES,
            }
        except ImportError:
            pass   # shap not installed — use approximation
        except Exception:
            pass   # any other error — use approximation

    if shap_raw is None:
        shap_raw = _rule_based_shap(hotspot, persist, anomaly_type)

    # ── Build top_features (sorted by |shap|) ────────────────────────────────
    paired = sorted(
        zip(FEATURE_NAMES, shap_raw["shap_values"]),
        key=lambda x: abs(x[1]),
        reverse=True,
    )

    top_features = []
    for fname, sval in paired[:6]:   # top 6 for UI display
        direction  = "positive" if sval >= 0 else "negative"
        dir_labels = _DIRECTION_LABELS.get(fname, ("supports classification",
                                                    "weakens classification"))
        top_features.append({
            "feature":     fname,
            "label":       _FEATURE_LABELS.get(fname, fname),
            "shap_value":  round(sval, 4),
            "direction":   direction,
            "direction_label": dir_labels[0] if sval >= 0 else dir_labels[1],
            "pct":         0.0,   # filled below
        })

    # Normalise to percentages (|shap| / sum|shap|)
    total_abs = sum(abs(f["shap_value"]) for f in top_features) or 1.0
    for f in top_features:
        f["pct"] = round(abs(f["shap_value"]) / total_abs * 100, 1)

    # ── Natural language explanation ──────────────────────────────────────────
    top1  = top_features[0] if top_features else None
    top2  = top_features[1] if len(top_features) > 1 else None

    if top1 and top2:
        explanation_text = (
            f"Classified as {anomaly_type} primarily because "
            f"{top1['label']} ({top1['pct']}%) "
            f"and {top2['label']} ({top2['pct']}%). "
            f"{top1['direction_label'].capitalize()}."
        )
    elif top1:
        explanation_text = (
            f"Classified as {anomaly_type} primarily because "
            f"{top1['label']} ({top1['pct']}%). "
            f"{top1['direction_label'].capitalize()}."
        )
    else:
        explanation_text = f"Classified as {anomaly_type} based on spectral analysis."

    # Persistence note
    ps = persist.get("persistence_score", 0.0)
    rc = persist.get("recurrence_count",  0)
    if ps > 0.1 and rc >= 2:
        slope_dir = "rising" if persist.get("confidence_slope", 0) > 0.02 \
                    else "falling" if persist.get("confidence_slope", 0) < -0.02 \
                    else "stable"
        explanation_text += (
            f" Detected in {rc} satellite passes with {slope_dir} confidence trend."
        )

    return {
        **shap_raw,
        "top_features":      top_features,
        "explanation_text":  explanation_text,
        "anomaly_type":      anomaly_type,
        "persistence": {
            "score":             ps,
            "recurrence_count":  rc,
            "confidence_slope":  persist.get("confidence_slope", 0.0),
            "night_ratio":       persist.get("night_ratio", 0.5),
        },
    }


def batch_explain(anomalies: list[dict],
                  hotspots:  list[dict],
                  persists:  list[dict]) -> dict[str, dict]:
    """
    Batch explain a list of anomalies.
    Returns dict keyed by anomaly id.
    """
    result = {}
    for anomaly, hotspot, persist in zip(anomalies, hotspots, persists):
        try:
            result[anomaly["id"]] = explain_anomaly(
                hotspot      = hotspot,
                persist      = persist,
                anomaly_type = anomaly.get("type", "Unauthorized Construction"),
            )
        except Exception as e:
            result[anomaly["id"]] = {"error": str(e)}
    return result


def global_feature_importance(scans: list[dict]) -> dict:
    """
    Compute global feature importance across all historical anomalies.
    Uses RF feature_importances_ if model is trained, else aggregates
    rule approximations.
    """
    model = load_model()
    if model is not None:
        try:
            return {
                "method":      "rf_importance",
                "importances": dict(zip(
                    FEATURE_NAMES,
                    [round(float(v), 4) for v in model.feature_importances_]
                )),
                "per_class": {
                    cls: dict(zip(FEATURE_NAMES, [round(float(v), 4) for v in model.feature_importances_]))
                    for cls in CLASSES
                },
            }
        except Exception:
            pass

    # Fallback: average of rule-based approximations
    return {
        "method":      "rule_approximation",
        "importances": dict(zip(FEATURE_NAMES, [
            0.10, 0.12, 0.10, 0.09, 0.09, 0.08, 0.08, 0.13, 0.11, 0.10
        ])),
        "note": "Train the RF model for accurate importances (POST /research/train)",
    }
