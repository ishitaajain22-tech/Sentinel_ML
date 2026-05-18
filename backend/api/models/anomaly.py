# api/models/anomaly.py
from pydantic import BaseModel
from typing   import List


class Anomaly(BaseModel):
    id:          str
    type:        str
    coords:      str
    lat:         float
    lon:         float
    region:      str
    severity:    str
    confidence:  float
    status:      str
    description: str
    spectral:    List[float]
    timestamp:   str


class UploadResponse(BaseModel):
    filename:        str
    anomalies_found: int
    anomalies:       List[Anomaly]


class AlertResponse(BaseModel):
    anomaly_id: str
    sent_via:   List[str]
    success:    bool
    message:    str
