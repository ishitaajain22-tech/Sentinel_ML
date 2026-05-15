# api/routes/alerts.py
from fastapi  import APIRouter, HTTPException
from pydantic import BaseModel
from typing   import List

from services.alert_router import route_alert
from api.models.anomaly    import Anomaly, AlertResponse

router = APIRouter()


class TriggerRequest(BaseModel):
    anomaly:    Anomaly
    channels:   List[str]
    recipients: List[str] = []


@router.post("/trigger", response_model=AlertResponse)
def trigger_alert(body: TriggerRequest):
    try:
        sent_via = route_alert(
            anomaly    = body.anomaly,
            channels   = body.channels,
            recipients = body.recipients or None,
        )
        return AlertResponse(
            anomaly_id = body.anomaly.id,
            sent_via   = sent_via,
            success    = True,
            message    = f"Alert dispatched via: {', '.join(sent_via)}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
