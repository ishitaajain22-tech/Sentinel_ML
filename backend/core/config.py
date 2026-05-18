# backend/core/config.py
import os
from dotenv import load_dotenv

load_dotenv()

# SMTP
SMTP_HOST     = os.getenv("SMTP_HOST",     "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER",     "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
ALERT_FROM    = os.getenv("ALERT_FROM",    "sentinel@yourdomain.com")

# Authority contacts
AUTHORITY_NAVAL        = os.getenv("AUTHORITY_NAVAL",        "naval@example.com")
AUTHORITY_MINING       = os.getenv("AUTHORITY_MINING",       "mining@example.gov")
AUTHORITY_BORDER       = os.getenv("AUTHORITY_BORDER",       "border@example.gov")
AUTHORITY_CONSTRUCTION = os.getenv("AUTHORITY_CONSTRUCTION", "urban@example.gov")

# NASA FIRMS — free API key from https://firms.modaps.eosdis.nasa.gov/api/area/
NASA_FIRMS_KEY = os.getenv("NASA_FIRMS_KEY", "your_firms_key_here")