# api/routes/reports.py
from fastapi              import APIRouter, HTTPException
from fastapi.responses    import FileResponse
from starlette.background import BackgroundTask
import os, tempfile

from services.pdf_service import generate_pdf
from api.models.anomaly   import Anomaly

router = APIRouter()


@router.post("/generate")
def generate_report(anomaly: Anomaly):
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.close()
        generate_pdf(anomaly, tmp.name)
        return FileResponse(
            path       = tmp.name,
            media_type = "application/pdf",
            filename   = f"SENTINEL_Report_{anomaly.id}.pdf",
            background = BackgroundTask(
                lambda: os.remove(tmp.name) if os.path.exists(tmp.name) else None
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
