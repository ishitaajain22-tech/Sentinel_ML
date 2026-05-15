// src/data/mockAnomalies.js
// Replace these with API calls to GET /anomalies once backend is ready

export const MOCK_ANOMALIES = [
  {
    id: "ANO-2024-0041",
    type: "Naval Movement",
    coords: "24.8615° N, 67.0099° E",
    lat: 24.86,
    lon: 67.01,
    region: "Arabian Sea — Sector 7",
    severity: "CRITICAL",
    confidence: 97,
    timestamp: "2024-01-15 03:42 UTC",
    status: "UNRESOLVED",
    description:
      "Unregistered vessel cluster detected in restricted maritime corridor. Formation suggests coordinated movement.",
    spectral: [88, 72, 95, 61, 83, 77, 90],
  },
  {
    id: "ANO-2024-0038",
    type: "Illegal Mining",
    coords: "12.3714° N, 76.8194° E",
    lat: 12.37,
    lon: 76.82,
    region: "Western Ghats Buffer Zone",
    severity: "HIGH",
    confidence: 91,
    timestamp: "2024-01-15 01:18 UTC",
    status: "FLAGGED",
    description:
      "Spectral signatures consistent with large-scale excavation. Estimated 2.3km² affected. No authorization on record.",
    spectral: [45, 78, 56, 89, 43, 67, 72],
  },
  {
    id: "ANO-2024-0035",
    type: "Border Intrusion",
    coords: "33.7294° N, 74.8573° E",
    lat: 33.73,
    lon: 74.86,
    region: "Line of Control — Segment 14",
    severity: "CRITICAL",
    confidence: 88,
    timestamp: "2024-01-14 22:55 UTC",
    status: "ESCALATED",
    description:
      "Thermal and motion anomaly detected. Multiple signatures crossing demarcated boundary. Alert routed to authority.",
    spectral: [92, 85, 78, 91, 88, 76, 94],
  },
  {
    id: "ANO-2024-0031",
    type: "Unauthorized Construction",
    coords: "28.6139° N, 77.2090° E",
    lat: 28.61,
    lon: 77.21,
    region: "No-Build Zone Delta — NCR",
    severity: "MODERATE",
    confidence: 74,
    timestamp: "2024-01-14 18:30 UTC",
    status: "MONITORING",
    description:
      "Progressive structural changes detected over 14-day analysis window. Footprint expansion of ~0.8km² identified.",
    spectral: [34, 52, 41, 68, 55, 49, 60],
  },
  {
    id: "ANO-2024-0028",
    type: "Naval Movement",
    coords: "19.0760° N, 72.8777° E",
    lat: 19.08,
    lon: 72.88,
    region: "Mumbai Coastal Exclusion Zone",
    severity: "HIGH",
    confidence: 82,
    timestamp: "2024-01-14 14:11 UTC",
    status: "RESOLVED",
    description:
      "Anomalous vessel trajectory identified. Subsequent verification confirmed registered naval exercise.",
    spectral: [60, 55, 70, 48, 63, 58, 66],
  },
];

export const ACTIVITY_LOG = [
  { time: "03:42", msg: "Critical anomaly detected: ANO-0041", color: "#ff3b3b" },
  { time: "03:39", msg: "Alert routed to Naval Command", color: "#ff8c00" },
  { time: "03:35", msg: "Spectral analysis complete: Mining", color: "#e8d44d" },
  { time: "03:28", msg: "Satellite pass initiated — Sector 7", color: "rgba(255,255,255,0.5)" },
  { time: "03:15", msg: "ANO-0035 escalated to authorities", color: "#c084fc" },
  { time: "02:58", msg: "System calibration complete", color: "rgba(255,255,255,0.5)" },
  { time: "02:44", msg: "New SAR data ingested", color: "rgba(255,255,255,0.5)" },
  { time: "02:31", msg: "ANO-0028 status: RESOLVED", color: "#4ade80" },
  { time: "02:20", msg: "Thermal band anomaly — LOW", color: "#5eead4" },
  { time: "02:07", msg: "Orbital sync confirmed", color: "rgba(255,255,255,0.5)" },
];
