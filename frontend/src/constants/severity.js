// src/constants/severity.js

export const SEVERITY_CONFIG = {
  CRITICAL: { color: "#ff3b3b", glow: "rgba(255,59,59,0.4)",   label: "CRITICAL" },
  HIGH:     { color: "#ff8c00", glow: "rgba(255,140,0,0.4)",   label: "HIGH"     },
  MODERATE: { color: "#e8d44d", glow: "rgba(232,212,77,0.35)", label: "MODERATE" },
  LOW:      { color: "#5eead4", glow: "rgba(94,234,212,0.3)",  label: "LOW"      },
};

export const STATUS_CONFIG = {
  UNRESOLVED: { color: "#ff3b3b" },
  FLAGGED:    { color: "#ff8c00" },
  ESCALATED:  { color: "#c084fc" },
  MONITORING: { color: "#60a5fa" },
  RESOLVED:   { color: "#4ade80" },
};

export const TYPE_ICONS = {
  "Naval Movement":           "⬡",
  "Illegal Mining":           "◈",
  "Border Intrusion":         "◇",
  "Unauthorized Construction":"□",
};
