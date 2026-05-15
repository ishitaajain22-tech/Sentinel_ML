// src/components/layout/StatsBar.jsx
import { SEVERITY_CONFIG } from "../../constants/severity";

const BANDS = ["SAR", "OPTICAL", "THERMAL", "MULTISPECTRAL"];

export default function StatsBar({ anomalies = [] }) {
  const counts = anomalies.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(0,0,0,0.5)",
      flexShrink: 0,
    }}>
      {[
        { label: "CRITICAL", key: "CRITICAL", color: SEVERITY_CONFIG.CRITICAL.color },
        { label: "HIGH",     key: "HIGH",     color: SEVERITY_CONFIG.HIGH.color },
        { label: "MODERATE", key: "MODERATE", color: SEVERITY_CONFIG.MODERATE.color },
        { label: "TOTAL",    key: null,        color: "#ffffff" },
      ].map((s) => {
        const val = s.key ? (counts[s.key] || 0) : anomalies.length;
        const active = val > 0;
        return (
          <div key={s.label} style={{
            flex: 1, padding: "14px 20px",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              fontSize: 10, fontFamily: "'Courier New', monospace",
              letterSpacing: 3, color: "rgba(255,255,255,0.55)",
              marginBottom: 6,
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: 28,
              fontFamily: "'Playfair Display', Georgia, serif",
              color: active ? s.color : "rgba(255,255,255,0.25)",
              textShadow: active && s.key ? `0 0 24px ${s.color}` : "none",
              lineHeight: 1,
            }}>
              {val}
            </div>
          </div>
        );
      })}

      {/* Coverage bands */}
      <div style={{ flex: 3, padding: "14px 20px", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 10, fontFamily: "'Courier New', monospace", letterSpacing: 3, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
          COVERAGE BANDS
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {BANDS.map(b => (
            <div key={b} style={{
              padding: "3px 10px",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 10, fontFamily: "'Courier New', monospace",
              letterSpacing: 1, color: "rgba(255,255,255,0.7)",
            }}>
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* System status */}
      <div style={{ flex: 2, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 10px #4ade80", animation: "pulse 2s ease-in-out infinite", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10, fontFamily: "'Courier New', monospace", letterSpacing: 2, color: "rgba(255,255,255,0.55)", marginBottom: 3 }}>
            SYSTEM STATUS
          </div>
          <div style={{ fontSize: 13, fontFamily: "'Courier New', monospace", color: "#4ade80", fontWeight: 700 }}>
            OPERATIONAL
          </div>
        </div>
      </div>
    </div>
  );
}