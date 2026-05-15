// src/components/anomaly/DetailPanel.jsx
import { useState }      from "react";
import SpectralBars      from "../charts/SpectralBars";
import ConfidenceArc     from "../charts/ConfidenceArc";
import FlagModal         from "../FlagModal";
import { SEVERITY_CONFIG, STATUS_CONFIG } from "../../constants/severity";
import { triggerAlert, downloadReport }   from "../../services/api";

export default function DetailPanel({ anomaly, onEscalated, onFlagged, flags = {}, watching = {}, onToggleWatch }) {
  const sev = SEVERITY_CONFIG[anomaly.severity];
  const sta = STATUS_CONFIG[anomaly.status];
  const [alertStatus,  setAlertStatus]  = useState(null);
  const [reportStatus, setReportStatus] = useState(null);
  const [showFlag,     setShowFlag]     = useState(false);
  const flag      = flags[anomaly.id];
  const isWatched = watching[anomaly.id];

  const handleEscalate = async () => {
    setAlertStatus("sending");
    try { await triggerAlert(anomaly, ["email", "pdf"]); setAlertStatus("sent"); if (onEscalated) onEscalated(anomaly); }
    catch (e) { console.error(e); setAlertStatus("error"); }
  };
  const handleReport = async () => {
    setReportStatus("generating");
    try { await downloadReport(anomaly); setReportStatus("done"); }
    catch (e) { console.error(e); setReportStatus("error"); }
  };

  const card = { padding: "20px 24px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)" };
  const secLabel = { fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "'Courier New', monospace", letterSpacing: 3, marginBottom: 14, display: "block" };

  return (
    <>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", paddingRight: 4 }}>

        {/* Header */}
        <div style={{ ...card, border: "1px solid rgba(255,255,255,0.12)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${sev.color}, transparent)`, opacity: 0.9 }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 3 }}>
                  ANOMALY REPORT
                </div>
                <div
                  onClick={() => onToggleWatch && onToggleWatch(anomaly.id)}
                  style={{
                    padding: "3px 10px",
                    border: `1px solid ${isWatched ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.2)"}`,
                    background: isWatched ? "rgba(96,165,250,0.15)" : "transparent",
                    color: isWatched ? "#60a5fa" : "rgba(255,255,255,0.5)",
                    fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: 2,
                    cursor: "pointer",
                  }}
                >
                  {isWatched ? "◉ WATCHING" : "◎ WATCH"}
                </div>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, color: "#ffffff", marginBottom: 6, fontWeight: 500 }}>
                {anomaly.type}
              </div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 13, color: "rgba(255,255,255,0.65)", letterSpacing: 1 }}>
                {anomaly.id}
              </div>
            </div>
            <ConfidenceArc value={anomaly.confidence} color={sev.color} />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            {[
              { label: "SEVERITY",   value: anomaly.severity,         color: sev.color },
              { label: "STATUS",     value: anomaly.status,           color: sta.color },
              { label: "CONFIDENCE", value: `${anomaly.confidence}%`, color: "#ffffff" },
            ].map(tag => (
              <div key={tag.label} style={{ padding: "8px 16px", border: `1px solid ${tag.color}45`, background: `${tag.color}15`, borderRadius: 2 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'Courier New', monospace", letterSpacing: 2, marginBottom: 4 }}>{tag.label}</div>
                <div style={{ fontSize: 14, color: tag.color, fontFamily: "'Courier New', monospace", letterSpacing: 1, fontWeight: 700 }}>{tag.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Flag banner */}
        {flag && (
          <div style={{ padding: "12px 18px", border: "1px solid rgba(255,140,0,0.35)", background: "rgba(255,140,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#ff8c00", letterSpacing: 2, marginBottom: 4 }}>
                ⚑ FLAGGED · {flag.urgency} · {flag.flaggedAt}
              </div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#ffffff" }}>{flag.reason}</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
                Assigned: {flag.assignee}{flag.followUp ? ` · Follow-up: ${flag.followUp}` : ""}
              </div>
            </div>
            <button onClick={() => setShowFlag(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 11, fontFamily: "'Courier New', monospace", letterSpacing: 1 }}>EDIT</button>
          </div>
        )}

        {/* Geodata */}
        <div style={card}>
          <span style={secLabel}>GEOSPATIAL DATA</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {[
              { label: "COORDINATES",    value: anomaly.coords },
              { label: "REGION",         value: anomaly.region },
              { label: "TIMESTAMP",      value: anomaly.timestamp },
              { label: "DETECTION MODE", value: "MULTISPECTRAL" },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'Courier New', monospace", letterSpacing: 2, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: "#ffffff", fontFamily: "'Courier New', monospace", lineHeight: 1.5 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis */}
        <div style={card}>
          <span style={secLabel}>ANALYSIS SUMMARY</span>
          <p style={{ fontSize: 15, color: "#ffffff", fontFamily: "'Playfair Display', serif", lineHeight: 1.9, margin: 0, fontStyle: "italic" }}>
            {anomaly.description}
          </p>
        </div>

        {/* Spectral */}
        <div style={card}>
          <span style={secLabel}>SPECTRAL SIGNATURE</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <SpectralBars data={anomaly.spectral.map(v => Math.round(v * 100))} color={sev.color} />
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "'Courier New', monospace", textAlign: "right", lineHeight: 2 }}>
              <div>BANDS: B1–B7</div>
              <div>SAR + OPTICAL</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            {
              label: alertStatus === "sending" ? "SENDING..." : alertStatus === "sent" ? "✓ ESCALATED" : alertStatus === "error" ? "FAILED" : "ESCALATE",
              color: alertStatus === "sent" ? "#4ade80" : alertStatus === "error" ? "#ff3b3b" : "#ff3b3b",
              onClick: handleEscalate, disabled: alertStatus === "sending" || alertStatus === "sent",
            },
            {
              label: flag ? "⚑ FLAGGED" : "FLAG",
              color: flag ? "#ff8c00" : "#7f1d1d",  // <- match escalate style
              onClick: () => setShowFlag(true), disabled: false,
            },
            {
              label: reportStatus === "generating" ? "GENERATING..." : reportStatus === "done" ? "✓ SAVED" : "EXPORT PDF",
              color: reportStatus === "done" ? "#4ade80" : "#7f1d1d",  // <- match escalate style
              onClick: handleReport, disabled: reportStatus === "generating",
            },
          ].map(btn => (
            <button key={btn.label} onClick={btn.disabled ? undefined : btn.onClick} style={{
              flex: 1, padding: "13px 0",
              border: `1px solid ${btn.color}55`,
              background: `${btn.color}15`,
              color: btn.color,
              fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: 2,
              cursor: btn.disabled ? "not-allowed" : "pointer",
              opacity: btn.disabled ? 0.5 : 1, transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (!btn.disabled) { e.currentTarget.style.background = `${btn.color}28`; e.currentTarget.style.boxShadow = `0 0 16px ${btn.color}30`; } }}
              onMouseLeave={e => { e.currentTarget.style.background = `${btn.color}15`; e.currentTarget.style.boxShadow = "none"; }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {showFlag && (
        <FlagModal anomaly={anomaly} existingFlag={flag} onSave={data => { onFlagged && onFlagged(data); setShowFlag(false); }} onClose={() => setShowFlag(false)} />
      )}
    </>
  );
}