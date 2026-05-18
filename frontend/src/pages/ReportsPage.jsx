// src/pages/ReportsPage.jsx
// Session statistics, sortable table, comparison view, bulk export

import { useState }        from "react";
import { SEVERITY_CONFIG } from "../constants/severity";
import { downloadReport }  from "../services/api";

const SORT_KEYS = ["severity", "confidence", "type", "region"];

export default function ReportsPage({ anomalies = [] }) {
  const [sortBy,      setSortBy]      = useState("severity");
  const [sortDir,     setSortDir]     = useState(1);
  const [selected,    setSelected]    = useState(new Set());
  const [downloading, setDownloading] = useState({});
  const [compareIds,  setCompareIds]  = useState([]);
  const [view,        setView]        = useState("table"); // "table" | "compare" | "stats"

  // Sort
  const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
  const sorted = [...anomalies].sort((a, b) => {
    if (sortBy === "severity") return (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) * sortDir;
    if (sortBy === "confidence") return (b.confidence - a.confidence) * sortDir;
    return (a[sortBy] > b[sortBy] ? 1 : -1) * sortDir;
  });

  const toggleSort = key => {
    if (sortBy === key) setSortDir(d => d * -1);
    else { setSortBy(key); setSortDir(1); }
  };

  const toggleSelect = id => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => setSelected(selected.size === anomalies.length ? new Set() : new Set(anomalies.map(a => a.id)));

  const handleDownload = async (anomaly) => {
    setDownloading(d => ({ ...d, [anomaly.id]: true }));
    try { await downloadReport(anomaly); } catch (e) { console.error(e); }
    finally { setDownloading(d => ({ ...d, [anomaly.id]: false })); }
  };

  const handleBulkDownload = async () => {
    for (const id of selected) {
      const a = anomalies.find(x => x.id === id);
      if (a) await handleDownload(a);
    }
  };

  const toggleCompare = id => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev);
  };

  // Stats
  const avgConf = anomalies.length ? Math.round(anomalies.reduce((s, a) => s + a.confidence, 0) / anomalies.length) : 0;
  const topType = anomalies.length ? Object.entries(anomalies.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {})).sort((a,b)=>b[1]-a[1])[0]?.[0] : "—";

  const TABS = [
    { id: "table",   label: "ANOMALY TABLE" },
    { id: "compare", label: "COMPARE" },
    { id: "stats",   label: "SESSION STATS" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Tab bar */}
      <div style={{ display: "flex", padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)", flexShrink: 0 }}>
        {TABS.map(tab => (
          <div key={tab.id} onClick={() => setView(tab.id)} style={{
            padding: "14px 18px",
            fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: 2,
            color: view === tab.id ? "#ffffff" : "rgba(255,255,255,0.35)",
            borderBottom: view === tab.id ? "1px solid rgba(255,255,255,0.7)" : "1px solid transparent",
            cursor: "pointer", marginBottom: -1,
          }}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* ── TABLE VIEW ─────────────────────────────────────────── */}
      {view === "table" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Toolbar */}
          {anomalies.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              <button onClick={selectAll} style={{ padding: "5px 12px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer" }}>
                {selected.size === anomalies.length ? "DESELECT ALL" : "SELECT ALL"}
              </button>
              {selected.size > 0 && (
                <>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                    {selected.size} selected
                  </div>
                  <button onClick={handleBulkDownload} style={{ padding: "5px 14px", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)", color: "#ffffff", fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer" }}>
                    ↓ BULK EXPORT PDF
                  </button>
                  <button onClick={() => { setView("compare"); setCompareIds(Array.from(selected).slice(0, 3)); }} style={{ padding: "5px 14px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer" }}>
                    COMPARE SELECTED
                  </button>
                </>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1, alignSelf: "center" }}>SORT BY:</div>
                {SORT_KEYS.map(k => (
                  <button key={k} onClick={() => toggleSort(k)} style={{
                    padding: "4px 10px",
                    border: `1px solid ${sortBy === k ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                    background: sortBy === k ? "rgba(255,255,255,0.08)" : "transparent",
                    color: sortBy === k ? "#ffffff" : "rgba(255,255,255,0.35)",
                    fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 1, cursor: "pointer",
                  }}>
                    {k.toUpperCase()}{sortBy === k ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px" }}>
            {anomalies.length === 0 ? (
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 3, paddingTop: 40 }}>
                NO REPORTS — UPLOAD A DATASET FIRST
              </div>
            ) : sorted.map(a => {
              const sev      = SEVERITY_CONFIG[a.severity];
              const isSel    = selected.has(a.id);
              const isComp   = compareIds.includes(a.id);

              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "14px 18px", marginBottom: 8,
                  border: `1px solid ${isSel ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"}`,
                  background: isSel ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                  borderLeft: `2px solid ${sev.color}`,
                  transition: "all 0.15s",
                }}>
                  {/* Checkbox */}
                  <div onClick={() => toggleSelect(a.id)} style={{
                    width: 14, height: 14, flexShrink: 0,
                    border: `1px solid ${isSel ? "#ffffff" : "rgba(255,255,255,0.2)"}`,
                    background: isSel ? "#ffffff" : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isSel && <div style={{ width: 6, height: 6, background: "#000" }} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "#ffffff", fontWeight: 500 }}>{a.type}</span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{a.id}</span>
                    </div>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
                      {a.region} · {a.coords} · {a.timestamp}
                    </div>
                  </div>

                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: sev.color, fontWeight: 700, letterSpacing: 2, minWidth: 80, textAlign: "right" }}>
                    {a.severity}
                  </div>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#ffffff", minWidth: 50, textAlign: "right" }}>
                    {a.confidence}%
                  </div>

                  <button onClick={() => toggleCompare(a.id)} style={{
                    padding: "5px 10px",
                    border: `1px solid ${isComp ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.12)"}`,
                    background: isComp ? "rgba(96,165,250,0.12)" : "transparent",
                    color: isComp ? "#60a5fa" : "rgba(255,255,255,0.4)",
                    fontFamily: "'Courier New', monospace", fontSize: 7, letterSpacing: 1, cursor: "pointer",
                  }}>
                    {isComp ? "✓ CMP" : "+ CMP"}
                  </button>

                  <button onClick={() => handleDownload(a)} disabled={downloading[a.id]} style={{
                    padding: "7px 14px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.05)",
                    color: downloading[a.id] ? "rgba(255,255,255,0.3)" : "#ffffff",
                    fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2,
                    cursor: downloading[a.id] ? "not-allowed" : "pointer",
                  }}>
                    {downloading[a.id] ? "..." : "↓ PDF"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── COMPARE VIEW ───────────────────────────────────────── */}
      {view === "compare" && (
        <div style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#ffffff", marginBottom: 6 }}>
            Compare Anomalies
          </div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
            Select up to 3 anomalies from the table to compare side-by-side.
          </div>

          {compareIds.length === 0 ? (
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 3 }}>
              GO TO TABLE → CLICK + CMP ON UP TO 3 ANOMALIES
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${compareIds.length}, 1fr)`, gap: 16 }}>
              {compareIds.map(id => {
                const a   = anomalies.find(x => x.id === id);
                if (!a) return null;
                const sev = SEVERITY_CONFIG[a.severity];
                return (
                  <div key={id} style={{ padding: "20px", border: `1px solid ${sev.color}30`, background: `${sev.color}06`, borderTop: `2px solid ${sev.color}` }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: "#ffffff", marginBottom: 4 }}>{a.type}</div>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>{a.id}</div>
                    {[
                      ["SEVERITY",    a.severity,          sev.color],
                      ["CONFIDENCE",  `${a.confidence}%`,  "#ffffff"],
                      ["REGION",      a.region,            "#ffffff"],
                      ["COORDINATES", a.coords,            "#ffffff"],
                      ["TIMESTAMP",   a.timestamp,         "#ffffff"],
                      ["STATUS",      a.status,            "#ffffff"],
                    ].map(([label, value, color]) => (
                      <div key={label} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", fontFamily: "'Courier New', monospace", letterSpacing: 2, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 11, color, fontFamily: "'Courier New', monospace", lineHeight: 1.4 }}>{value}</div>
                      </div>
                    ))}
                    {/* Mini spectral */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", fontFamily: "'Courier New', monospace", letterSpacing: 2, marginBottom: 6 }}>SPECTRAL</div>
                      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 24 }}>
                        {a.spectral.map((v, i) => (
                          <div key={i} style={{ flex: 1, height: `${v * 100}%`, background: sev.color, opacity: 0.5 + i * 0.07, borderRadius: 1 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STATS VIEW ─────────────────────────────────────────── */}
      {view === "stats" && (
        <div style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#ffffff", marginBottom: 24 }}>
            Session Statistics
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { label: "TOTAL ANOMALIES",   value: anomalies.length,       color: "#ffffff" },
              { label: "AVG CONFIDENCE",    value: `${avgConf}%`,          color: "#ffffff" },
              { label: "MOST COMMON TYPE",  value: topType,                color: "#ffffff" },
              { label: "CRITICAL COUNT",    value: anomalies.filter(a => a.severity === "CRITICAL").length, color: "#ff3b3b" },
            ].map(s => (
              <div key={s.label} style={{ padding: "18px 20px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: s.color }}>{s.value || "—"}</div>
              </div>
            ))}
          </div>

          {/* Type breakdown */}
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 3, marginBottom: 14 }}>TYPE BREAKDOWN</div>
          {["Naval Movement", "Illegal Mining", "Border Intrusion", "Unauthorized Construction"].map(type => {
            const count = anomalies.filter(a => a.type === type).length;
            const pct   = anomalies.length ? count / anomalies.length : 0;
            return (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#ffffff" }}>{type}</span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{count}</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pct * 100}%`, background: "rgba(255,255,255,0.5)", borderRadius: 2, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}