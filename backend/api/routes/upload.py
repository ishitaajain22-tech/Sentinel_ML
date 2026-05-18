# api/routes/upload.py

from fastapi      import APIRouter, UploadFile, File, HTTPException
import shutil, os, uuid

from ml.pipeline        import run_pipeline
from api.models.anomaly import UploadResponse

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED = {".tif", ".tiff", ".csv", ".zip", ".png", ".jpg", ".jpeg"}


@router.post("/", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, detail=f"Unsupported file type '{ext}'.")

    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        anomalies = run_pipeline(tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return UploadResponse(
        filename        = file.filename or tmp_path,
        anomalies_found = len(anomalies),
        anomalies       = anomalies,
    )