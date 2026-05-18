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
