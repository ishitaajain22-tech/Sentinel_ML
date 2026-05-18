// src/services/api.js
// All backend API calls — upload, alerts, reports, live scan

const BASE = import.meta.env.VITE_API_URL || "/api";

// ── Upload dataset ─────────────────────────────────────────────────────────
export async function uploadDataset(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/upload/`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// ── Trigger alert ──────────────────────────────────────────────────────────
export async function triggerAlert(anomaly, channels = ["email", "pdf"], recipients = []) {
  const res = await fetch(`${BASE}/alerts/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anomaly, channels, recipients }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Alert failed: ${res.status}`);
  }
  return res.json();
}

// ── Download PDF report ────────────────────────────────────────────────────
export async function downloadReport(anomaly) {
  const res = await fetch(`${BASE}/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(anomaly),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Report failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `SENTINEL_Report_${anomaly.id}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ── Live Scan — NASA FIRMS ─────────────────────────────────────────────────

/** Check API key status and last scan info */
export async function getLiveScanStatus() {
  const res = await fetch(`${BASE}/livescan/status`);
  return res.ok ? res.json() : null;
}

/** Get list of available region presets */
export async function getLiveScanRegions() {
  const res = await fetch(`${BASE}/livescan/regions`);
  return res.ok ? res.json() : { regions: [] };
}

/**
 * Trigger a synchronous live scan and wait for results.
 * Returns { anomalies, anomalies_found, scan_utc, region, source }
 */
export async function runLiveScan({ region = "india", source = "VIIRS_SNPP_NRT", dayRange = 1, minConfidence = 50 }) {
  const res = await fetch(`${BASE}/livescan/scan/sync`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      region,
      source,
      day_range:      dayRange,
      min_confidence: minConfidence,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Live scan failed: ${res.status}`);
  }
  return res.json();
}

/** Get results from the most recent scan (no new fetch) */
export async function getLatestScan() {
  const res = await fetch(`${BASE}/livescan/latest`);
  return res.ok ? res.json() : { anomalies: [], scan_utc: null };
}

/** Start auto-refresh scheduler */
export async function startSchedule({ region = "india", source = "VIIRS_SNPP_NRT", intervalMin = 30 }) {
  const res = await fetch(`${BASE}/livescan/schedule/start`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ region, source, interval_min: intervalMin }),
  });
  return res.ok ? res.json() : null;
}

/** Stop auto-refresh scheduler */
export async function stopSchedule() {
  const res = await fetch(`${BASE}/livescan/schedule/stop`, { method: "POST" });
  return res.ok ? res.json() : null;
}

// ── Scan history ───────────────────────────────────────────────────────────

/** Get list of past scan summaries */
export async function getScanHistory() {
  const res = await fetch(`${BASE}/livescan/history`);
  return res.ok ? res.json() : { scans: [] };
}

/** Get full anomaly list for a specific historical scan (0 = most recent) */
export async function getHistoryScan(index) {
  const res = await fetch(`${BASE}/livescan/history/${index}`);
  if (!res.ok) return null;
  return res.json();
}

// ── Research endpoints ────────────────────────────────────────────────────────

export async function getModelInfo()         { const r = await fetch(`${BASE}/research/model`);            return r.ok ? r.json() : null; }
export async function trainModel()           { const r = await fetch(`${BASE}/research/train`, {method:"POST"}); return r.json(); }
export async function getPersistenceMap()    { const r = await fetch(`${BASE}/research/persistence`);      return r.ok ? r.json() : null; }
export async function getAllExplanations()   { const r = await fetch(`${BASE}/research/explain`);          return r.ok ? r.json() : null; }
export async function getExplanation(id)    { const r = await fetch(`${BASE}/research/explain/${id}`);    return r.ok ? r.json() : null; }
export async function getEvaluation()       { const r = await fetch(`${BASE}/research/evaluate`);         return r.ok ? r.json() : null; }
export async function getGlobalImportance() { const r = await fetch(`${BASE}/research/global_importance`);return r.ok ? r.json() : null; }
export async function getResearchSummary()  { const r = await fetch(`${BASE}/research/summary`);          return r.ok ? r.json() : null; }
export async function seedResearch() {
  const r = await fetch(`${BASE}/research/seed`, { method: "POST" });
  return r.json();
}
