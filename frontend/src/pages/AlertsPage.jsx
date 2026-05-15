// src/pages/AlertsPage.jsx
// Props:
//   anomalies      - detected anomalies array
//   authorities    - authority config array (with emails set in AuthoritiesPage)
//   onAlertSent    - (anomaly) => void

import { useState }        from "react";
import { SEVERITY_CONFIG } from "../constants/severity";
import { triggerAlert }    from "../services/api";

// Maps anomaly type → authority id
const TYPE_TO_AUTH_ID = {
  "Naval Movement":           "naval",
  "Illegal Mining":           "mining",
  "Border Intrusion":         "border",
  "Unauthorized Construction":"construction",
};

export default function AlertsPage({ anomalies = [], authorities = [], onAlertSent }) {
  const [sending,  setSending]  = useState({});
  const [sent,     setSent]     = useState({});
  const [error,    setError]    = useState({});

  // Look up the configured email for this anomaly type
  const getAuthority = (anomalyType) => {
    const id   = TYPE_TO_AUTH_ID[anomalyType];
    return authorities.find(a => a.id === id) || null;
  };

  const handleEscalate = async (anomaly) => {
    const auth = getAuthority(anomaly.type);

    if (!auth?.email) {
      setError(e => ({
        ...e,
        [anomaly.id]: `No email configured for ${anomaly.type}. Go to AUTHORITIES → set an email first.`,
      }));
      return;
    }

    setSending(s => ({ ...s, [anomaly.id]: true }));
    setError(e  => ({ ...e,  [anomaly.id]: null }));

    const channels = Object.entries(auth.channels).filter(([, v]) => v).map(([k]) => k);

    try {
      await triggerAlert(anomaly, channels, [auth.email]);
      setSent(s => ({ ...s, [anomaly.id]: { email: auth.email, authority: auth.authority } }));
      if (onAlertSent) onAlertSent(anomaly);
    } catch (e) {
      setError(err => ({ ...err, [anomaly.id]: e.message || "Failed to send" }));
    } finally {
      setSending(s => ({ ...s, [anomaly.id]: false }));
    }
  };

  const sorted = [...anomalies].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: 4, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
        ALERT MANAGEMENT
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#ffffff", marginBottom: 8 }}>
        Escalate to Authorities
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5, marginBottom: 28, lineHeight: 1.8 }}>
        Each anomaly type routes to the email you configured in the{" "}
        <span style={{ color: "#ffffff", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: 1 }}>AUTHORITIES</span>{" "}
        tab. If no email is set, escalation will prompt you to configure it first.
      </div>

      {anomalies.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: 3 }}>
          NO ANOMALIES TO ESCALATE — UPLOAD A DATASET FIRST
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(a => {
            const sev    = SEVERITY_CONFIG[a.severity];
            const auth   = getAuthority(a.type);
            const isSent = sent[a.id];
            const isErr  = error[a.id];
            const isBusy = sending[a.id];

            return (
              <div key={a.id} style={{
                padding: "18px 22px",
                border: `1px solid ${isSent ? "#4ade8030" : isErr ? "rgba(255,59,59,0.2)" : "rgba(255,255,255,0.07)"}`,
                background: isSent ? "rgba(74,222,128,0.04)" : isErr ? "rgba(255,59,59,0.03)" : "rgba(255,255,255,0.02)",
                borderLeft: `2px solid ${isSent ? "#4ade80" : sev.color}`,
                transition: "all 0.3s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ flex: 1 }}>

                    {/* Anomaly info */}
                    <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: "#ffffff", fontWeight: 500 }}>{a.type}</span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.45)" }}>{a.id}</span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2, color: sev.color, fontWeight: 700 }}>{a.severity}</span>
                    </div>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
                      {a.region} · {a.coords}
                    </div>

                    {/* Routing info — shows WHERE the alert will go */}
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "5px 12px",
                      border: `1px solid ${auth?.email ? "rgba(255,255,255,0.12)" : "rgba(255,59,59,0.2)"}`,
                      background: auth?.email ? "rgba(255,255,255,0.03)" : "rgba(255,59,59,0.05)",
                      marginBottom: 10,
                    }}>
                      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", fontFamily: "'Courier New', monospace", letterSpacing: 1 }}>
                        ROUTES TO:
                      </span>
                      {auth?.email ? (
                        <>
                          <span style={{ fontSize: 10, color: "#ffffff", fontFamily: "'Courier New', monospace" }}>
                            {auth.email}
                          </span>
                          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "'Courier New', monospace" }}>
                            ({auth.authority})
                          </span>
                          {/* Channel badges */}
                          {Object.entries(auth.channels).filter(([, v]) => v).map(([ch]) => (
                            <span key={ch} style={{
                              padding: "1px 6px",
                              border: `1px solid ${auth.color}40`,
                              background: `${auth.color}12`,
                              fontFamily: "'Courier New', monospace",
                              fontSize: 7, letterSpacing: 1,
                              color: auth.color,
                            }}>
                              {ch.toUpperCase()}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span style={{ fontSize: 10, color: "#ff6b6b", fontFamily: "'Courier New', monospace" }}>
                          Not configured — go to AUTHORITIES tab
                        </span>
                      )}
                    </div>

                    {/* Success banner */}
                    {isSent && (
                      <div style={{
                        padding: "8px 12px",
                        border: "1px solid rgba(74,222,128,0.3)",
                        background: "rgba(74,222,128,0.08)",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <span style={{ color: "#4ade80", fontSize: 12 }}>✓</span>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#4ade80", letterSpacing: 0.5, lineHeight: 1.6 }}>
                          ESCALATED — Alert dispatched to <strong>{isSent.email}</strong> ({isSent.authority})
                        </span>
                      </div>
                    )}

                    {/* Error banner */}
                    {isErr && (
                      <div style={{
                        padding: "8px 12px",
                        border: "1px solid rgba(255,59,59,0.3)",
                        background: "rgba(255,59,59,0.07)",
                      }}>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#ff6b6b", letterSpacing: 0.3, lineHeight: 1.6 }}>
                          {isErr}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Escalate button */}
                  <button
                    onClick={() => !isSent && !isBusy && handleEscalate(a)}
                    disabled={isSent || isBusy}
                    style={{
                      padding: "10px 20px", flexShrink: 0,
                      border: `1px solid ${isSent ? "#4ade8050" : !auth?.email ? "rgba(255,59,59,0.4)" : `${sev.color}50`}`,
                      background: isSent ? "rgba(74,222,128,0.12)" : !auth?.email ? "rgba(255,59,59,0.08)" : `${sev.color}12`,
                      color: isSent ? "#4ade80" : !auth?.email ? "#ff6b6b" : sev.color,
                      fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2,
                      cursor: isSent || isBusy ? "not-allowed" : "pointer",
                      transition: "all 0.2s", whiteSpace: "nowrap",
                      opacity: isBusy ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!isSent && !isBusy && auth?.email) e.currentTarget.style.background = `${sev.color}25`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSent ? "rgba(74,222,128,0.12)" : `${sev.color}12`; }}
                  >
                    {isBusy ? "SENDING..." : isSent ? "✓ ESCALATED" : !auth?.email ? "NOT CONFIGURED" : "ESCALATE"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}