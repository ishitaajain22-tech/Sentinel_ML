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
              Paragraph(f"SENTINEL · {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} · CONFIDENTIAL",
                        sty("f", fontName="Helvetica", fontSize=7,
                            textColor=colors.HexColor("#444"), alignment=TA_CENTER))]

    doc.build(story, onFirstPage=_bg, onLaterPages=_bg)
    return output_path


def _bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, A4[0], A4[1], fill=True, stroke=False)
    canvas.restoreState()
