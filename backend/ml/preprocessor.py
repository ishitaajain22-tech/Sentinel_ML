# ml/preprocessor.py
import os
import numpy  as np
import pandas as pd
from PIL import Image


def preprocess(file_path: str):
    ext = os.path.splitext(file_path)[1].lower()
    if ext in (".tif", ".tiff"):
        return _load_geotiff(file_path)
    elif ext == ".csv":
        return _load_csv(file_path)
    elif ext in (".png", ".jpg", ".jpeg"):
        return _load_image(file_path)
    elif ext == ".zip":
        return _load_zip(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def _load_geotiff(path):
    try:
        import rasterio
    except ImportError:
        raise RuntimeError("rasterio not installed. Run: pip install rasterio")
    with rasterio.open(path) as src:
        data = src.read().astype(np.float32)
        data = np.transpose(data, (1, 2, 0))
        data = _normalise_bands(data)
        metadata = {"region": "Satellite GeoTIFF Region", "source_file": path}
    return data, metadata


def _load_image(path):
    img  = Image.open(path).convert("RGB")
    data = np.array(img, dtype=np.float32) / 255.0
    return data, {"region": "Image Region", "source_file": path}


def _load_csv(path):
    df      = pd.read_csv(path)
    region  = df["region"].iloc[0] if "region" in df.columns else "CSV Dataset"
    numeric = df.select_dtypes(include=[np.number])
    data    = numeric.values.astype(np.float32)
    data    = _normalise_cols(data)
    return data, {"region": region, "source_file": path}


def _load_zip(path):
    import zipfile, tempfile
    with zipfile.ZipFile(path, "r") as z:
        names  = z.namelist()
        target = next(
            (n for n in names if os.path.splitext(n)[1].lower()
             in {".tif", ".tiff", ".csv", ".png", ".jpg", ".jpeg"}), None)
        if not target:
            raise ValueError("ZIP contains no supported file.")
        with tempfile.TemporaryDirectory() as tmp:
            z.extract(target, tmp)
            return preprocess(os.path.join(tmp, target))


def _normalise_bands(data):
    for b in range(data.shape[2]):
        bmin, bmax = data[:, :, b].min(), data[:, :, b].max()
        if bmax > bmin:
            data[:, :, b] = (data[:, :, b] - bmin) / (bmax - bmin)
    return data


def _normalise_cols(data):
    col_min = data.min(axis=0)
    col_max = data.max(axis=0)
    rng     = np.where(col_max > col_min, col_max - col_min, 1.0)
    return (data - col_min) / rng
