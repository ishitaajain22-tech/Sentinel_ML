# backend/main.py
# Run: uvicorn main:app --reload --port 8000

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import upload, alerts, reports, livescan, research

app = FastAPI(title="SENTINEL API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://sentinel-frontend-three.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,    prefix="/upload",    tags=["Upload"])
app.include_router(alerts.router,    prefix="/alerts",    tags=["Alerts"])
app.include_router(reports.router,   prefix="/reports",   tags=["Reports"])
app.include_router(livescan.router,  prefix="/livescan",  tags=["Live Scan"])
app.include_router(research.router,  prefix="/research",  tags=["Research"])

@app.get("/health")
def health():
    return {"status": "operational", "version": "3.0.0"}
