# SENTINEL — Satellite Surveillance System

> AI-powered satellite anomaly detection platform using NASA FIRMS thermal data, ML classification, and a real-time React dashboard.

---

## What It Does

Sentinel ingests satellite imagery (uploaded datasets or live NASA FIRMS thermal feeds) and runs an ML pipeline to detect and classify anomalies — illegal mining, border intrusions, naval movements, unauthorized construction — scored by severity and surfaced in an operational dashboard.

**Dashboard** — upload a geospatial dataset (CSV/GeoTIFF), run the ML pipeline, inspect anomalies with spectral analysis and severity scoring.

**Live Feed** — pull real thermal hotspot data directly from NASA FIRMS (VIIRS / MODIS satellites) for any region of India / South Asia. Results are plotted on an interactive map, tracked across scans for confidence trends, and exportable as CSV.

**Reports** — generate PDF incident reports per anomaly.

**Alerts** — threshold-based alert management.

**Authorities** — contact directory for escalation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Leaflet (maps) |
| Backend | FastAPI, Uvicorn, Python 3.10 |
| ML | scikit-learn (Isolation Forest), NumPy, Pandas, Rasterio |
| Satellite data | NASA FIRMS API (VIIRS S-NPP, VIIRS NOAA-20, MODIS) |
| Reports | ReportLab (PDF generation) |
| HTTP client | httpx (async NASA API calls) |

---

## Project Structure

```
Sentinel_ML/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env                     # NASA_FIRMS_KEY goes here (not committed)
│   ├── api/
│   │   ├── models/              # Pydantic models (Anomaly, Alert, etc.)
│   │   └── routes/
│   │       ├── upload.py        # Dataset upload + ML pipeline trigger
│   │       ├── livescan.py      # NASA FIRMS live scan + history
│   │       ├── alerts.py
│   │       └── reports.py
│   ├── ml/
│   │   ├── pipeline.py          # Upload dataset ML pipeline
│   │   ├── classifier.py        # Anomaly type classifier
│   │   ├── detector.py          # Isolation Forest detector
│   │   └── severity.py          # Severity scorer
│   ├── services/
│   │   └── nasa_firms.py        # NASA FIRMS API client + firms_to_anomaly_input
│   └── ml_registry/
│       ├── latest_livescan.json # Latest scan results
│       └── scan_history.json    # Historical scan log (last 20 scans)
└── frontend/
    ├── src/
    │   ├── App.jsx              # Root — routing, global state
    │   ├── pages/
    │   │   ├── LiveFeedPage.jsx # Live feed (Feed / Map / History tabs)
    │   │   ├── ReportsPage.jsx
    │   │   ├── AlertsPage.jsx
    │   │   └── AuthoritiesPage.jsx
    │   ├── components/
    │   │   ├── layout/          # TopNav, StatsBar
    │   │   ├── dashboard/       # Upload panel, anomaly list, spectral viz
    │   │   └── globe/           # GlobeViz canvas
    │   ├── services/
    │   │   └── api.js           # All backend API calls
    │   └── constants/
    │       └── severity.js      # Severity colours and icons
    └── package.json
```

---

## Setup

### Prerequisites
- Python 3.10
- Node.js 18+
- A free NASA FIRMS API key → [register here](https://firms.modaps.eosdis.nasa.gov/api/area/)

---

### Backend

```powershell
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create .env and add your NASA FIRMS key
New-Item .env
Add-Content .env "NASA_FIRMS_KEY=your_key_here"

# Start the server
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

---

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Environment Variables

Create `backend/.env`:

```
NASA_FIRMS_KEY=your_nasa_firms_api_key
```

The NASA FIRMS key is **free** and arrives instantly via email. Without it the Live Feed tab will show "API KEY NOT SET" and scanning will be disabled. The Dashboard (dataset upload) works without it.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload dataset, run ML pipeline |
| `GET` | `/livescan/status` | API key status + last scan info |
| `GET` | `/livescan/regions` | Available scan regions |
| `POST` | `/livescan/scan/sync` | Run scan, wait for results |
| `POST` | `/livescan/scan` | Run scan in background |
| `GET` | `/livescan/latest` | Most recent scan results |
| `GET` | `/livescan/history` | List of past scan summaries |
| `GET` | `/livescan/history/{n}` | Full anomaly list for scan N (0=latest) |
| `POST` | `/livescan/schedule/start` | Start auto-refresh loop |
| `POST` | `/livescan/schedule/stop` | Stop auto-refresh |
| `GET` | `/alerts` | All alerts |
| `POST` | `/reports/generate` | Generate PDF report |

---

## Features

### Dashboard
- Upload CSV or GeoTIFF satellite datasets
- Isolation Forest anomaly detection
- Spectral band visualisation per anomaly
- Severity scoring (CRITICAL / HIGH / MODERATE / LOW)
- StatsBar hidden on Live Feed — dashboard stats are upload-only

### Live Feed (3 tabs)

**FEED tab**
- Real NASA FIRMS thermal data (VIIRS S-NPP, VIIRS NOAA-20, MODIS)
- Region selector: India, Bay of Bengal, Himalayan Region, Arabian Sea, Northeast India, South Asia
- Confidence threshold slider, time window (24h / 48h / 72h)
- Severity filter (ALL / CRITICAL / HIGH / MODERATE / WATCHED)
- ⟳ RECURRING badge on anomalies seen across multiple scans
- Confidence trend sparkline inside each expanded anomaly
- Export filtered results as CSV (one click, no backend needed)
- Auto-refresh with configurable interval and countdown timer

**MAP tab**
- Leaflet dark-theme interactive map
- Circle markers coloured by severity, sized by intensity
- Click any marker for anomaly popup (type, severity, coordinates, confidence, timestamp)
- Auto-fits bounds to current detections

**HISTORY tab**
- Persistent scan log — last 20 scans stored in `ml_registry/scan_history.json`
- Expand any past scan to see its full anomaly list
- PERSISTENT HOTSPOTS panel — coordinates appearing in 2+ scans
- Per-hotspot confidence trend with sparkline and GROWING / WEAKENING / STABLE label

---

## How the Live Scan Works

1. User selects region + satellite source + time window + confidence threshold
2. Frontend calls `POST /livescan/scan/sync`
3. Backend fetches CSV from NASA FIRMS API (real satellite thermal detections)
4. Hotspots filtered by confidence threshold
5. Rule-based classifier assigns anomaly type (Illegal Mining / Border Intrusion / Naval Movement / Unauthorized Construction) based on brightness, FRP, lat/lon, day/night
6. Severity scorer applies weighted formula → CRITICAL / HIGH / MODERATE / LOW
7. Results saved to `latest_livescan.json` and prepended to `scan_history.json`
8. Response returned to frontend — map, feed, and history all update

> NASA FIRMS data is already pre-detected by satellite algorithms. The classifier adds domain-specific typing and severity scoring on top.

---

## Known Limitations

- Live scan classification is rule-based (not ML) — NASA pre-detects the thermal anomalies, rules assign operational type
- `scan_history.json` keeps the last 20 scans; older entries are dropped automatically
- Leaflet loaded from CDN — map requires internet connection
- Confidence trend requires at least 2 scans of the same region to appear

---

## License

MIT
