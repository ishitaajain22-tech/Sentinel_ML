# backend/ml/detector.py
# Changes from original:
#   - Added build_model() — creates a fresh IsolationForest with given params
#   - detect_anomalies() now accepts an optional pre-loaded model
#     (for versioned model support from the registry)
#   - Each region dict now includes pixel_y, pixel_x for camera overlay

import numpy as np
from sklearn.ensemble import IsolationForest

PATCH_SIZE    = 32
CONTAMINATION = 0.05


def build_model(n_estimators: int = 100, contamination: float = CONTAMINATION) -> IsolationForest:
    """Build a fresh Isolation Forest. Used by pipeline and /mlops/retrain."""
    return IsolationForest(
        n_estimators  = n_estimators,
        contamination = contamination,
        random_state  = 42,
    )


def detect_anomalies(data: np.ndarray, model: IsolationForest = None) -> list:
    """
    Detect anomalous regions.
    model: if provided (loaded from registry), reuses it.
           if None, builds and fits a fresh model.
    """
    if data.ndim == 3:
        return _detect_image(data, model)
    elif data.ndim == 2:
        return _detect_tabular(data, model)
    else:
        raise ValueError(f"Unexpected data shape: {data.shape}")


def _detect_image(data: np.ndarray, model: IsolationForest = None) -> list:
    H, W, bands = data.shape
    patches, coords = [], []

    for y in range(0, H - PATCH_SIZE + 1, PATCH_SIZE):
        for x in range(0, W - PATCH_SIZE + 1, PATCH_SIZE):
            patch = data[y:y + PATCH_SIZE, x:x + PATCH_SIZE, :]
            feat  = np.concatenate([patch.mean(axis=(0, 1)), patch.std(axis=(0, 1))])
            patches.append(feat)
            coords.append((y, x))

    if not patches:
        return []

    features = np.array(patches)
    labels   = _fit_predict(features, model)

    results = []
    for i, label in enumerate(labels):
        if label == -1:
            y, x     = coords[i]
            feat     = features[i]
            spectral = list(feat[:min(7, bands)].round(4))
            spectral += [0.0] * (7 - len(spectral))
            results.append({
                "features": feat.tolist(),
                "spectral": spectral,
                "lat":      round(20.0 + (y / H) * 20.0, 4),
                "lon":      round(68.0 + (x / W) * 15.0, 4),
                "area_km2": round(PATCH_SIZE * PATCH_SIZE * 0.0001, 3),
                "pixel_y":  int(y),
                "pixel_x":  int(x),
            })
    return results


def _detect_tabular(data: np.ndarray, model: IsolationForest = None) -> list:
    if data.shape[0] < 10:
        raise ValueError("Dataset needs at least 10 rows.")

    labels  = _fit_predict(data, model)
    results = []

    for i, label in enumerate(labels):
        if label == -1:
            row      = data[i]
            spectral = list(row[:7].round(4)) if len(row) >= 7 else list(row.round(4))
            spectral += [0.0] * (7 - len(spectral))
            results.append({
                "features": row.tolist(),
                "spectral": spectral,
                "lat":      float(row[0]) if len(row) > 0 else 0.0,
                "lon":      float(row[1]) if len(row) > 1 else 0.0,
                "area_km2": 0.5,
                "pixel_y":  int(i),
                "pixel_x":  0,
            })
    return results


def _fit_predict(features: np.ndarray, model: IsolationForest = None) -> np.ndarray:
    """Fit (or reuse) a model and return predictions."""
    if model is None:
        model = build_model()
    return model.fit_predict(features)