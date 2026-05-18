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
                        f'attachment; filename="SENTINEL_{anomaly.id}.pdf"')
        msg.attach(part)

    with smtplib.SMTP(cfg.SMTP_HOST, cfg.SMTP_PORT) as s:
        s.ehlo(); s.starttls()
        s.login(cfg.SMTP_USER, cfg.SMTP_PASSWORD)
        s.sendmail(cfg.ALERT_FROM, recipients, msg.as_string())
    print(f"[EMAIL] Sent to {recipients}")
