// src/components/anomaly/AnomalyCard.jsx
import { SEVERITY_CONFIG, STATUS_CONFIG, TYPE_ICONS } from "../../constants/severity";

export default function AnomalyCard({ anomaly, selected, onClick }) {
  const sev = SEVERITY_CONFIG[anomaly.severity];
  const sta = STATUS_CONFIG[anomaly.status];

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 18px",
        border: `1px solid ${selected ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)"}`,
        borderLeft: `3px solid ${sev.color}`,
        background: selected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative", overflow: "hidden",
      }}
    >
      {selected && (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${sev.glow} 0%, transparent 60%)`, opacity: 0.15, pointerEvents: "none" }} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: sev.color, fontSize: 18, filter: `drop-shadow(0 0 5px ${sev.color})` }}>
            {TYPE_ICONS[anomaly.type] || "○"}
          </span>
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: 2, marginBottom: 3 }}>
              {anomaly.id}
            </div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, color: "#ffffff", fontWeight: 500 }}>
              {anomaly.type}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontFamily: "'Courier New', monospace", letterSpacing: 2, color: sev.color, fontWeight: 700, textShadow: `0 0 10px ${sev.color}` }}>
            {anomaly.severity}
          </div>
          <div style={{ fontSize: 11, color: sta.color, fontFamily: "'Courier New', monospace", letterSpacing: 1, marginTop: 3 }}>
            {anomaly.status}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "'Courier New', monospace" }}>
        {anomaly.region}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "'Courier New', monospace", marginTop: 3 }}>
        {anomaly.timestamp}
      </div>
    </div>
  );
}