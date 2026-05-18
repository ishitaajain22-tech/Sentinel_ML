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
