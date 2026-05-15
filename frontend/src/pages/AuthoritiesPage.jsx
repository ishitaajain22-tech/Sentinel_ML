// src/pages/AuthoritiesPage.jsx

import { useState } from "react";
import { triggerAlert } from "../services/api";

const PRIORITIES      = ["CRITICAL", "HIGH", "MODERATE", "LOW"];
const PRIORITY_COLORS = { CRITICAL: "#ff3b3b", HIGH: "#ff8c00", MODERATE: "#e8d44d", LOW: "#5eead4" };

const TEST_ANOMALY_FOR = (type) => ({
  id: "TEST-PING", type,
  coords: "0.0000° N, 0.0000° E", lat: 0, lon: 0,
  region: "TEST REGION", severity: "LOW", confidence: 99,
  status: "UNRESOLVED",
  description: "This is a test ping from SENTINEL to verify your alert configuration.",
  spectral: [0.1, 0.2, 0.3, 0.4, 0.3, 0.2, 0.1],
  timestamp: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
});

const nowUTC = () => new Date().toISOString().replace("T", " ").slice(0, 19);

export default function AuthoritiesPage({ authorities, onUpdateAuthority, onToggleChannel, onPingSent }) {
  const [editing,    setEditing]    = useState(null);
  const [pinging,    setPinging]    = useState({});
  const [pingResult, setPingResult] = useState({});
  const [activeTab,  setActiveTab]  = useState("contacts");

  const sendPing = async (auth) => {
    if (!auth.email) {
      setPingResult(r => ({ ...r, [auth.id]: { ok: false, msg: "No email set — add an email address first." } }));
      return;
    }
    setPinging(p => ({ ...p, [auth.id]: true }));
    setPingResult(r => ({ ...r, [auth.id]: null }));

    const channels = Object.entries(auth.channels).filter(([, v]) => v).map(([k]) => k);
    try {
      await triggerAlert(TEST_ANOMALY_FOR(auth.type), channels, [auth.email]);
      const entry = { time: nowUTC(), msg: `Test ping sent to ${auth.email}`, ok: true };
      onPingSent && onPingSent(auth.id, entry);
      setPingResult(r => ({ ...r, [auth.id]: { ok: true, msg: `✓ Test email sent to ${auth.email}` } }));
    } catch (e) {
      const entry = { time: nowUTC(), msg: `Ping failed: ${e.message}`, ok: false };
      onPingSent && onPingSent(auth.id, entry);
      setPingResult(r => ({ ...r, [auth.id]: { ok: false, msg: `✕ ${e.message || "Failed. Check SMTP."}` } }));
    } finally {
      setPinging(p => ({ ...p, [auth.id]: false }));
    }
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#ffffff", fontFamily: "'Courier New', monospace",
    fontSize: 11, padding: "8px 10px",
    outline: "none", width: "100%",
  };

  const TABS = [
    { id: "contacts", label: "AUTHORITY CONTACTS" },
    { id: "log",      label: "ALERT HISTORY" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Tab bar */}
      <div style={{ display: "flex", padding: "0 36px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.3)", flexShrink: 0 }}>
        {TABS.map(tab => (
          <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "14px 20px",
            fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: 2,
            color: activeTab === tab.id ? "#ffffff" : "rgba(255,255,255,0.35)",
            borderBottom: activeTab === tab.id ? "1px solid rgba(255,255,255,0.7)" : "1px solid transparent",
            cursor: "pointer", marginBottom: -1,
          }}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* ── CONTACTS TAB ──────────────────────────────────── */}
      {activeTab === "contacts" && (
        <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#ffffff", marginBottom: 6 }}>
            Authority Contact Management
          </div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 28, lineHeight: 1.8 }}>
            Set a recipient email for each anomaly type. When you press <span style={{ color: "#ffffff" }}>ESCALATE</span> on the Alerts page,
            the alert goes <span style={{ color: "#ffffff" }}>directly to that address</span> </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {authorities.map(auth => {
              const isEditing = editing === auth.id;
              const ping      = pingResult[auth.id];
              const hasEmail  = !!auth.email;

              return (
                <div key={auth.id} style={{
                  padding: "20px 22px",
                  border: `1px solid ${isEditing ? auth.color + "40" : hasEmail ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}`,
                  background: isEditing ? `${auth.color}08` : "rgba(255,255,255,0.02)",
                  borderTop: `2px solid ${auth.color}`,
                  transition: "all 0.2s",
                }}>

                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20, color: auth.color, filter: `drop-shadow(0 0 6px ${auth.color})` }}>{auth.icon}</span>
                      <div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "#ffffff" }}>{auth.type}</div>
                        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: auth.color, letterSpacing: 1, marginTop: 2 }}>{auth.authority}</div>
                      </div>
                    </div>
                    {/* Live status indicator */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: hasEmail ? "#4ade80" : "rgba(255,255,255,0.2)", boxShadow: hasEmail ? "0 0 6px #4ade80" : "none" }} />
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: hasEmail ? "#4ade80" : "rgba(255,255,255,0.3)", letterSpacing: 1 }}>
                        {hasEmail ? "CONFIGURED" : "NOT SET"}
                      </span>
                    </div>
                  </div>

                  {/* Email field */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "'Courier New', monospace", letterSpacing: 2, marginBottom: 5 }}>
                      RECIPIENT EMAIL — alerts go here on ESCALATE
                    </div>
                    {isEditing ? (
                      <input
                        style={inputStyle}
                        value={auth.email}
                        onChange={e => onUpdateAuthority(auth.id, "email", e.target.value)}
                        placeholder="authority@example.gov"
                        autoFocus
                      />
                    ) : (
                      <div style={{
                        fontFamily: "'Courier New', monospace", fontSize: 11,
                        color: hasEmail ? "#ffffff" : "rgba(255,255,255,0.25)",
                        padding: "8px 10px",
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${hasEmail ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
                      }}>
                        {hasEmail ? auth.email : "— click EDIT to configure —"}
                      </div>
                    )}
                  </div>

                  {/* Priority selector (edit mode) */}
                  {isEditing && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "'Courier New', monospace", letterSpacing: 2, marginBottom: 5 }}>PRIORITY LEVEL</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {PRIORITIES.map(p => (
                          <button key={p} onClick={() => onUpdateAuthority(auth.id, "priority", p)} style={{
                            flex: 1, padding: "5px 0",
                            border: `1px solid ${auth.priority === p ? PRIORITY_COLORS[p] + "80" : "rgba(255,255,255,0.1)"}`,
                            background: auth.priority === p ? `${PRIORITY_COLORS[p]}20` : "transparent",
                            color: auth.priority === p ? PRIORITY_COLORS[p] : "rgba(255,255,255,0.35)",
                            fontFamily: "'Courier New', monospace", fontSize: 7, letterSpacing: 1, cursor: "pointer",
                          }}>{p}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Channel toggles */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "'Courier New', monospace", letterSpacing: 2, marginBottom: 6 }}>ACTIVE CHANNELS</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ key: "email", label: "EMAIL" }, { key: "pdf", label: "PDF REPORT" }].map(ch => (
                        <div key={ch.key} onClick={() => onToggleChannel(auth.id, ch.key)} style={{
                          padding: "4px 12px",
                          border: `1px solid ${auth.channels[ch.key] ? auth.color + "60" : "rgba(255,255,255,0.1)"}`,
                          background: auth.channels[ch.key] ? `${auth.color}18` : "transparent",
                          color: auth.channels[ch.key] ? auth.color : "rgba(255,255,255,0.3)",
                          fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 1,
                          cursor: "pointer", transition: "all 0.15s", userSelect: "none",
                        }}>
                          {auth.channels[ch.key] ? "✓ " : ""}{ch.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ping result */}
                  {ping && (
                    <div style={{
                      padding: "7px 10px", marginBottom: 10,
                      border: `1px solid ${ping.ok ? "rgba(74,222,128,0.3)" : "rgba(255,59,59,0.3)"}`,
                      background: ping.ok ? "rgba(74,222,128,0.07)" : "rgba(255,59,59,0.07)",
                      fontFamily: "'Courier New', monospace", fontSize: 9,
                      color: ping.ok ? "#4ade80" : "#ff6b6b", lineHeight: 1.6,
                    }}>
                      {ping.msg}
                    </div>
                  )}

                  {/* Buttons */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditing(isEditing ? null : auth.id)} style={{
                      flex: 1, padding: "8px 0",
                      border: `1px solid ${isEditing ? auth.color + "60" : "rgba(255,255,255,0.15)"}`,
                      background: isEditing ? `${auth.color}15` : "transparent",
                      color: isEditing ? auth.color : "rgba(255,255,255,0.7)",
                      fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer",
                    }}>
                      {isEditing ? "SAVE" : "EDIT"}
                    </button>
                    <button onClick={() => sendPing(auth)} disabled={pinging[auth.id]} style={{
                      flex: 1, padding: "8px 0",
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "transparent",
                      color: pinging[auth.id] ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
                      fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2,
                      cursor: pinging[auth.id] ? "not-allowed" : "pointer",
                    }}
                      onMouseEnter={e => { if (!pinging[auth.id]) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {pinging[auth.id] ? "SENDING..." : "TEST PING"}
                    </button>
                  </div>

                  {/* Last log entry */}
                  {auth.log?.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: auth.log[0].ok ? "rgba(74,222,128,0.7)" : "rgba(255,59,59,0.7)", letterSpacing: 0.5 }}>
                        {auth.log[0].time} — {auth.log[0].msg}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LOG TAB ─────────────────────────────────────────── */}
      {activeTab === "log" && (
        <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#ffffff", marginBottom: 24 }}>Alert History</div>
          {authorities.every(a => !a.log?.length) ? (
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 3 }}>
              NO ALERTS SENT YET
            </div>
          ) : authorities.filter(a => a.log?.length).map(auth => (
            <div key={auth.id} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ color: auth.color, fontSize: 14 }}>{auth.icon}</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "#ffffff" }}>{auth.type}</span>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: auth.color, letterSpacing: 1 }}>{auth.log.length} event{auth.log.length !== 1 ? "s" : ""}</span>
              </div>
              {auth.log.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 14px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: entry.ok ? "#4ade80" : "#ff3b3b", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", minWidth: 150 }}>{entry.time} UTC</span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: entry.ok ? "rgba(255,255,255,0.8)" : "#ff6b6b" }}>{entry.msg}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}