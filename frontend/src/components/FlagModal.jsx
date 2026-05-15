// src/components/FlagModal.jsx
// Opens when analyst clicks FLAG on an anomaly.
// Lets them write a reason, assign to a team member, set follow-up date.
// Props: anomaly, onSave(flagData), onClose

import { useState } from "react";

const TEAM_MEMBERS = [
  "Unassigned",
  "Analyst — Sector North",
  "Analyst — Sector South",
  "Senior Analyst",
  "Intelligence Officer",
  "Field Commander",
];

const FLAG_REASONS = [
  "Requires verification",
  "Possible false positive",
  "Escalation pending clearance",
  "Under investigation",
  "Pattern match — historical",
  "Custom note...",
];

export default function FlagModal({ anomaly, existingFlag, onSave, onClose }) {
  const [reason,   setReason]   = useState(existingFlag?.reason   || FLAG_REASONS[0]);
  const [custom,   setCustom]   = useState(existingFlag?.custom   || "");
  const [assignee, setAssignee] = useState(existingFlag?.assignee || "Unassigned");
  const [followUp, setFollowUp] = useState(existingFlag?.followUp || "");
  const [urgency,  setUrgency]  = useState(existingFlag?.urgency  || "NORMAL");

  const handleSave = () => {
    onSave({
      anomalyId: anomaly.id,
      reason:    reason === "Custom note..." ? custom : reason,
      custom,
      assignee,
      followUp,
      urgency,
      flaggedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
    });
    onClose();
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#ffffff",
    fontFamily: "'Courier New', monospace",
    fontSize: 11, padding: "8px 12px",
    outline: "none", width: "100%",
  };

  const labelStyle = {
    fontSize: 8, color: "rgba(255,255,255,0.45)",
    fontFamily: "'Courier New', monospace",
    letterSpacing: 2, marginBottom: 6, display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 500, padding: 24,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 480, maxHeight: "85vh", overflowY: "auto",
        background: "#0a0a0f",
        border: "1px solid rgba(255,255,255,0.12)",
        padding: "28px 28px",
        animation: "slideUp 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "'Courier New', monospace", letterSpacing: 3, marginBottom: 6 }}>
              FLAG ANOMALY
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#ffffff" }}>
              {anomaly.type}
            </div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
              {anomaly.id} · {anomaly.region}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
        </div>

        {/* Urgency */}
        <div style={{ marginBottom: 18 }}>
          <span style={labelStyle}>URGENCY</span>
          <div style={{ display: "flex", gap: 6 }}>
            {["NORMAL", "WATCH", "URGENT"].map(u => (
              <button key={u} onClick={() => setUrgency(u)} style={{
                flex: 1, padding: "8px 0",
                border: `1px solid ${urgency === u ? (u === "URGENT" ? "#ff3b3b" : u === "WATCH" ? "#ff8c00" : "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.1)"}`,
                background: urgency === u ? (u === "URGENT" ? "rgba(255,59,59,0.15)" : u === "WATCH" ? "rgba(255,140,0,0.15)" : "rgba(255,255,255,0.08)") : "transparent",
                color: urgency === u ? "#ffffff" : "rgba(255,255,255,0.35)",
                fontFamily: "'Courier New', monospace",
                fontSize: 9, letterSpacing: 2, cursor: "pointer",
              }}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 18 }}>
          <span style={labelStyle}>REASON FOR FLAG</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {FLAG_REASONS.map(r => (
              <div key={r} onClick={() => setReason(r)} style={{
                padding: "8px 12px",
                border: `1px solid ${reason === r ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.07)"}`,
                background: reason === r ? "rgba(255,255,255,0.06)" : "transparent",
                color: reason === r ? "#ffffff" : "rgba(255,255,255,0.45)",
                fontFamily: "'Courier New', monospace",
                fontSize: 10, cursor: "pointer", transition: "all 0.12s",
              }}>
                {r}
              </div>
            ))}
          </div>
        </div>

        {/* Custom note */}
        {reason === "Custom note..." && (
          <div style={{ marginBottom: 18 }}>
            <span style={labelStyle}>CUSTOM NOTE</span>
            <textarea
              value={custom}
              onChange={e => setCustom(e.target.value)}
              rows={3}
              placeholder="Describe the reason for flagging..."
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
            />
          </div>
        )}

        {/* Assignee */}
        <div style={{ marginBottom: 18 }}>
          <span style={labelStyle}>ASSIGN TO</span>
          <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
            {TEAM_MEMBERS.map(m => <option key={m} value={m} style={{ background: "#0a0a0f" }}>{m}</option>)}
          </select>
        </div>

        {/* Follow-up date */}
        <div style={{ marginBottom: 24 }}>
          <span style={labelStyle}>FOLLOW-UP DATE</span>
          <input
            type="date"
            value={followUp}
            onChange={e => setFollowUp(e.target.value)}
            style={{ ...inputStyle, colorScheme: "dark" }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "transparent", color: "rgba(255,255,255,0.5)",
            fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: 2, cursor: "pointer",
          }}>
            CANCEL
          </button>
          <button onClick={handleSave} style={{
            flex: 2, padding: "10px 0",
            border: "1px solid rgba(255,140,0,0.5)",
            background: "rgba(255,140,0,0.12)", color: "#ff8c00",
            fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: 2, cursor: "pointer",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,140,0,0.22)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,140,0,0.12)"}
          >
            SAVE FLAG
          </button>
        </div>
      </div>
    </div>
  );
}