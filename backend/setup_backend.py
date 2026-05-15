"""
setup_backend.py
----------------
Run this ONCE from inside your backend/ folder:

    python setup_backend.py

It will:
1. Create all folders and __init__.py files
2. Overwrite every backend Python file with the correct version
3. Print a confirmation for each file written

After it finishes, run:
    uvicorn main:app --reload --port 8000
"""

import os

# ── Helpers ───────────────────────────────────────────────────────────────────

def write(path, content):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  wrote  {path}")


def touch(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write("")
    print(f"  touch  {path}")


# ── __init__.py files ─────────────────────────────────────────────────────────

for p in [
    "api/__init__.py",
    "api/routes/__init__.py",
    "api/models/__init__.py",
    "core/__init__.py",
    "ml/__init__.py",
    "services/__init__.py",
]:
    touch(p)


# ── main.py ───────────────────────────────────────────────────────────────────

write("main.py", '''\
# main.py
# Run: uvicorn main:app --reload --port 8000

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import upload, alerts, reports

app = FastAPI(title="SENTINEL API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,  prefix="/upload",  tags=["Upload"])
app.include_router(alerts.router,  prefix="/alerts",  tags=["Alerts"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])

@app.get("/health")
def health():
    return {"status": "operational"}
''')


# ── core/config.py ────────────────────────────────────────────────────────────

write("core/config.py", '''\
# core/config.py
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST     = os.getenv("SMTP_HOST",     "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER",     "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
ALERT_FROM    = os.getenv("ALERT_FROM",    "sentinel@yourdomain.com")

AUTHORITY_NAVAL        = os.getenv("AUTHORITY_NAVAL",        "naval@example.com")
AUTHORITY_MINING       = os.getenv("AUTHORITY_MINING",       "mining@example.gov")
AUTHORITY_BORDER       = os.getenv("AUTHORITY_BORDER",       "border@example.gov")
AUTHORITY_CONSTRUCTION = os.getenv("AUTHORITY_CONSTRUCTION", "urban@example.gov")
''')


# ── api/models/anomaly.py ─────────────────────────────────────────────────────

write("api/models/anomaly.py", '''\
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
''')


# ── api/routes/upload.py ──────────────────────────────────────────────────────

write("api/routes/upload.py", '''\
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
        raise HTTPException(400, detail=f"Unsupported file type \'{ext}\'.")

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
''')


# ── api/routes/alerts.py ──────────────────────────────────────────────────────

write("api/routes/alerts.py", '''\
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
            message    = f"Alert dispatched via: {\', \'.join(sent_via)}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
''')


# ── api/routes/reports.py ─────────────────────────────────────────────────────

write("api/routes/reports.py", '''\
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
''')


# ── ml/preprocessor.py ───────────────────────────────────────────────────────

write("ml/preprocessor.py", '''\
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
''')


# ── ml/detector.py ────────────────────────────────────────────────────────────

write("ml/detector.py", '''\
# ml/detector.py
import numpy as np
from sklearn.ensemble import IsolationForest

PATCH_SIZE    = 32
CONTAMINATION = 0.05


def detect_anomalies(data: np.ndarray) -> list:
    if data.ndim == 3:
        return _detect_image(data)
    elif data.ndim == 2:
        return _detect_tabular(data)
    else:
        raise ValueError(f"Unexpected data shape: {data.shape}")


def _detect_image(data):
    H, W, bands = data.shape
    patches, coords = [], []
    for y in range(0, H - PATCH_SIZE + 1, PATCH_SIZE):
        for x in range(0, W - PATCH_SIZE + 1, PATCH_SIZE):
            patch = data[y:y+PATCH_SIZE, x:x+PATCH_SIZE, :]
            feat  = np.concatenate([patch.mean(axis=(0,1)), patch.std(axis=(0,1))])
            patches.append(feat)
            coords.append((y, x))
    if not patches:
        return []
    features = np.array(patches)
    labels   = _iforest(features)
    results  = []
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
            })
    return results


def _detect_tabular(data):
    if data.shape[0] < 10:
        raise ValueError("Dataset needs at least 10 rows.")
    labels  = _iforest(data)
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
            })
    return results


def _iforest(features):
    return IsolationForest(
        n_estimators=100, contamination=CONTAMINATION, random_state=42
    ).fit_predict(features)
''')


# ── ml/classifier.py ──────────────────────────────────────────────────────────

write("ml/classifier.py", '''\
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
''')


# ── ml/severity.py ────────────────────────────────────────────────────────────

write("ml/severity.py", '''\
# ml/severity.py
import numpy as np

TYPE_BASE = {
    "Naval Movement":           0.78,
    "Illegal Mining":           0.63,
    "Border Intrusion":         0.85,
    "Unauthorized Construction":0.52,
}


def score_severity(features: list, anomaly_type: str) -> tuple:
    f         = np.array(features, dtype=np.float32)
    base      = TYPE_BASE.get(anomaly_type, 0.55)
    intensity = float(np.clip(f.mean() + f.std() * 0.4, 0.0, 1.0))
    score     = float(np.clip(base * 0.65 + intensity * 0.35, 0.0, 1.0))

    if score >= 0.80:
        severity = "CRITICAL"
    elif score >= 0.62:
        severity = "HIGH"
    elif score >= 0.44:
        severity = "MODERATE"
    else:
        severity = "LOW"

    rng        = np.random.default_rng(int(abs(f.sum()) * 1000) % (2**31))
    confidence = float(np.clip(score + rng.uniform(-0.05, 0.05), 0.50, 0.99))
    return severity, round(confidence, 3)
''')


# ── ml/pipeline.py ────────────────────────────────────────────────────────────

write("ml/pipeline.py", '''\
# ml/pipeline.py
from datetime import datetime, timezone

from api.models.anomaly import Anomaly
from ml.preprocessor    import preprocess
from ml.detector        import detect_anomalies
from ml.classifier      import classify
from ml.severity        import score_severity


def run_pipeline(file_path: str) -> list:
    data, metadata = preprocess(file_path)
    regions        = detect_anomalies(data)

    anomalies = []
    for i, region in enumerate(regions):
        atype            = classify(region["features"])
        severity, conf   = score_severity(region["features"], atype)
        lat              = region.get("lat", 0.0)
        lon              = region.get("lon", 0.0)

        anomalies.append(Anomaly(
            id          = f"ANO-{str(i+1).zfill(4)}",
            type        = atype,
            coords      = f"{abs(lat):.4f}° {\'N\' if lat>=0 else \'S\'}, {abs(lon):.4f}° {\'E\' if lon>=0 else \'W\'}",
            lat         = round(lat, 4),
            lon         = round(lon, 4),
            region      = metadata.get("region", f"Region ({lat:.1f}, {lon:.1f})"),
            severity    = severity,
            confidence  = round(conf * 100, 1),
            status      = "UNRESOLVED",
            description = _desc(atype, region),
            spectral    = [round(float(v), 3) for v in region.get("spectral", [0.0]*7)],
            timestamp   = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        ))

    order = {"CRITICAL":0,"HIGH":1,"MODERATE":2,"LOW":3}
    anomalies.sort(key=lambda a: order.get(a.severity, 4))
    return anomalies


def _desc(atype, region):
    area = region.get("area_km2", "?")
    return {
        "Naval Movement":
            "Unregistered vessel activity detected. Spectral signatures consistent with unauthorized maritime presence.",
        "Illegal Mining":
            f"Excavation signatures detected. Estimated affected area: {area} km2. No authorization on record.",
        "Border Intrusion":
            "Thermal and motion anomaly crossing demarcated boundary. Multiple signatures identified.",
        "Unauthorized Construction":
            "Progressive structural change detected in a no-build zone. Footprint expansion identified.",
    }.get(atype, "Anomalous activity detected. Manual review recommended.")
''')


# ── services/authority_mapper.py ──────────────────────────────────────────────

write("services/authority_mapper.py", '''\
# services/authority_mapper.py
import core.config as cfg

TYPE_MAP = {
    "Naval Movement":           "AUTHORITY_NAVAL",
    "Illegal Mining":           "AUTHORITY_MINING",
    "Border Intrusion":         "AUTHORITY_BORDER",
    "Unauthorized Construction":"AUTHORITY_CONSTRUCTION",
}


def get_authority_emails(anomaly_type: str) -> list:
    key = TYPE_MAP.get(anomaly_type)
    if not key:
        return []
    raw = getattr(cfg, key, "")
    return [e.strip() for e in raw.split(",") if e.strip()]
''')


# ── services/alert_router.py ──────────────────────────────────────────────────

write("services/alert_router.py", '''\
# services/alert_router.py
import os
from services.email_service    import send_email_alert
from services.pdf_service      import generate_pdf
from services.authority_mapper import get_authority_emails

os.makedirs("reports", exist_ok=True)


def route_alert(anomaly, channels: list, recipients=None) -> list:
    sent_via = []
    emails   = recipients or get_authority_emails(anomaly.type)

    pdf_path = None
    if "pdf" in channels or "email" in channels:
        pdf_path = os.path.join("reports", f"{anomaly.id}.pdf")
        try:
            generate_pdf(anomaly, pdf_path)
            if "pdf" in channels:
                sent_via.append("pdf")
        except Exception as e:
            print(f"[PDF] Failed: {e}")
            pdf_path = None

    if "email" in channels and emails:
        try:
            send_email_alert(anomaly, emails,
                             attachment=pdf_path if pdf_path and os.path.exists(pdf_path) else None)
            sent_via.append("email")
        except Exception as e:
            print(f"[EMAIL] Failed: {e}")

    return sent_via
''')


# ── services/email_service.py ─────────────────────────────────────────────────

write("services/email_service.py", '''\
# services/email_service.py
import smtplib, os
from email.mime.multipart import MIMEMultipart
from email.mime.text      import MIMEText
from email.mime.base      import MIMEBase
from email                import encoders
import core.config as cfg


def send_email_alert(anomaly, recipients: list, attachment=None):
    subject = f"[SENTINEL] {anomaly.severity} — {anomaly.type} | {anomaly.id}"
    html = f"""
    <html><body style="background:#06060a;color:#fff;font-family:monospace;padding:32px;">
      <h2 style="color:#ff3b3b;">SENTINEL ALERT</h2>
      <table>
        <tr><td style="color:#888;padding:4px 8px;">ID</td><td>{anomaly.id}</td></tr>
        <tr><td style="color:#888;padding:4px 8px;">TYPE</td><td>{anomaly.type}</td></tr>
        <tr><td style="color:#888;padding:4px 8px;">SEVERITY</td><td style="color:#ff3b3b;">{anomaly.severity}</td></tr>
        <tr><td style="color:#888;padding:4px 8px;">CONFIDENCE</td><td>{anomaly.confidence}%</td></tr>
        <tr><td style="color:#888;padding:4px 8px;">REGION</td><td>{anomaly.region}</td></tr>
        <tr><td style="color:#888;padding:4px 8px;">COORDS</td><td>{anomaly.coords}</td></tr>
        <tr><td style="color:#888;padding:4px 8px;">TIME</td><td>{anomaly.timestamp}</td></tr>
      </table>
      <p style="color:#aaa;margin-top:16px;">{anomaly.description}</p>
    </body></html>"""

    msg            = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"]    = cfg.ALERT_FROM
    msg["To"]      = ", ".join(recipients)
    msg.attach(MIMEText(html, "html"))

    if attachment and os.path.exists(attachment):
        with open(attachment, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition",
                        f\'attachment; filename="SENTINEL_{anomaly.id}.pdf"\')
        msg.attach(part)

    with smtplib.SMTP(cfg.SMTP_HOST, cfg.SMTP_PORT) as s:
        s.ehlo(); s.starttls()
        s.login(cfg.SMTP_USER, cfg.SMTP_PASSWORD)
        s.sendmail(cfg.ALERT_FROM, recipients, msg.as_string())
    print(f"[EMAIL] Sent to {recipients}")
''')


# ── services/pdf_service.py ───────────────────────────────────────────────────

write("services/pdf_service.py", '''\
# services/pdf_service.py
from reportlab.lib.pagesizes import A4
from reportlab.lib.units     import mm
from reportlab.lib           import colors
from reportlab.platypus      import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles    import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums     import TA_CENTER
import datetime

BG      = colors.HexColor("#06060a")
WHITE   = colors.HexColor("#ffffff")
DIM     = colors.HexColor("#888888")
ACCENT  = colors.HexColor("#cccccc")

SEV_COLORS = {
    "CRITICAL": colors.HexColor("#ff3b3b"),
    "HIGH":     colors.HexColor("#ff8c00"),
    "MODERATE": colors.HexColor("#e8d44d"),
    "LOW":      colors.HexColor("#5eead4"),
}


def generate_pdf(anomaly, output_path: str) -> str:
    doc = SimpleDocTemplate(output_path, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm,  bottomMargin=20*mm)

    def sty(name, **kw):
        b = getSampleStyleSheet()["Normal"]
        return ParagraphStyle(name, parent=b, **kw)

    sev = SEV_COLORS.get(anomaly.severity, WHITE)
    story = [
        Paragraph("SENTINEL — ANOMALY REPORT",
                  sty("h", fontName="Helvetica-Bold", fontSize=16, textColor=WHITE, spaceAfter=4*mm)),
        HRFlowable(width="100%", thickness=0.5, color=DIM),
        Spacer(1, 4*mm),
        Paragraph(anomaly.type,
                  sty("t", fontName="Helvetica-Bold", fontSize=20, textColor=WHITE, spaceAfter=2*mm)),
        Paragraph(anomaly.id,
                  sty("id", fontName="Helvetica", fontSize=9, textColor=DIM, spaceAfter=6*mm)),
    ]

    metrics = [
        ["SEVERITY", "STATUS", "CONFIDENCE"],
        [Paragraph(anomaly.severity, sty("s", fontName="Helvetica-Bold", fontSize=11, textColor=sev)),
         Paragraph(anomaly.status,   sty("st", fontName="Helvetica-Bold", fontSize=11, textColor=WHITE)),
         Paragraph(f"{anomaly.confidence}%", sty("c", fontName="Helvetica-Bold", fontSize=11, textColor=WHITE))],
    ]
    t = Table(metrics, colWidths=["33%"]*3)
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,0), colors.HexColor("#111111")),
        ("TEXTCOLOR",    (0,0),(-1,0), DIM),
        ("FONTNAME",     (0,0),(-1,0), "Helvetica"),
        ("FONTSIZE",     (0,0),(-1,0), 7),
        ("BACKGROUND",   (0,1),(-1,1), colors.HexColor("#0d0d0d")),
        ("TOPPADDING",   (0,0),(-1,-1), 6),
        ("BOTTOMPADDING",(0,0),(-1,-1), 6),
        ("LEFTPADDING",  (0,0),(-1,-1), 8),
        ("GRID",         (0,0),(-1,-1), 0.25, colors.HexColor("#333")),
    ]))
    story += [t, Spacer(1,5*mm)]

    geo = [["COORDINATES", anomaly.coords], ["REGION", anomaly.region],
           ["TIMESTAMP", anomaly.timestamp]]
    gt = Table(geo, colWidths=["30%","70%"])
    gt.setStyle(TableStyle([
        ("FONTNAME",     (0,0),(0,-1), "Helvetica-Bold"),
        ("FONTNAME",     (1,0),(1,-1), "Helvetica"),
        ("FONTSIZE",     (0,0),(-1,-1), 9),
        ("TEXTCOLOR",    (0,0),(0,-1), DIM),
        ("TEXTCOLOR",    (1,0),(1,-1), ACCENT),
        ("BACKGROUND",   (0,0),(-1,-1), colors.HexColor("#0a0a0a")),
        ("TOPPADDING",   (0,0),(-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING",  (0,0),(-1,-1), 8),
        ("LINEBELOW",    (0,0),(-1,-2), 0.25, colors.HexColor("#222")),
    ]))
    story += [gt, Spacer(1,5*mm),
              Paragraph(anomaly.description,
                        sty("b", fontName="Helvetica", fontSize=10, textColor=ACCENT, leading=16)),
              Spacer(1,10*mm),
              HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#222")),
              Spacer(1,3*mm),
              Paragraph(f"SENTINEL · {datetime.datetime.utcnow().strftime(\'%Y-%m-%d %H:%M UTC\')} · CONFIDENTIAL",
                        sty("f", fontName="Helvetica", fontSize=7,
                            textColor=colors.HexColor("#444"), alignment=TA_CENTER))]

    doc.build(story, onFirstPage=_bg, onLaterPages=_bg)
    return output_path


def _bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, A4[0], A4[1], fill=True, stroke=False)
    canvas.restoreState()
''')


# ── Done ──────────────────────────────────────────────────────────────────────

print("\n✓ All files written successfully.")
print("\nNow run:")
print("  uvicorn main:app --reload --port 8000")