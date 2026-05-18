# ml/classifier.py
import numpy as np


def classify(features: list) -> str:
    f         = np.array(features, dtype=np.float32)
    half      = len(f) // 2
    means     = f[:half] if half > 0 else f
    stds      = f[half:] if half > 0 else np.array([f.std()])
    mean_val  = float(means.mean()) if len(means) else float(f.mean())
    std_val   = float(stds.mean())  if len(stds)  else float(f.std())
    band_peak = int(np.argmax(means)) if len(means) >= 3 else 0

    if mean_val > 0.70 and std_val < 0.12:
        return "Naval Movement"
    if band_peak in (2, 3, 4) and std_val > 0.22:
        return "Illegal Mining"
    if mean_val > 0.58 and std_val > 0.18:
        return "Border Intrusion"
    return "Unauthorized Construction"
