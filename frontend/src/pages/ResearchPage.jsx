// src/pages/ResearchPage.jsx
// Research Dashboard — exposes the 4 novel contributions for the paper:
//   TAB 1: PERSISTENCE  — temporal trajectory charts per hotspot
//   TAB 2: EXPLAINABILITY — SHAP feature importance per anomaly
//   TAB 3: CLASSIFIER    — RF vs rules comparison, training controls
//   TAB 4: EVALUATION    — accuracy metrics, false positive comparison

import { useState, useEffect } from "react";
import {
  getModelInfo, trainModel,
  getPersistenceMap, getAllExplanations,
  getEvaluation, getGlobalImportance,
  getResearchSummary, seedResearch,
} from "../services/api";

const TABS = ["PERSISTENCE", "EXPLAINABILITY", "CLASSIFIER", "EVALUATION"];

const mono = { fontFamily: "'Courier New', monospace" };
const serif = { fontFamily: "'Playfair Display', serif" };

const SCOLOR = {
  CRITICAL: "#ff3b3b", HIGH: "#ff8c00", MODERATE: "#e8d44d", LOW: "#5eead4",
};

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ values, color = "#60a5fa", width = 120, height = 32 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values); const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} opacity={0.8} />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
      })}
    </svg>
  );
}

// ── Horizontal bar for SHAP ───────────────────────────────────────────────────
function ShapBar({ label, value, pct, direction, maxPct = 100 }) {
  const color = direction === "positive" ? "#4ade80" : "#ff6b6b";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{label}</span>
        <span style={{ ...mono, fontSize: 9, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
        <div style={{
          height: "100%", width: `${(pct / maxPct) * 100}%`,
          background: color, borderRadius: 3,
          boxShadow: `0 0 6px ${color}60`,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ── Accuracy bar ─────────────────────────────────────────────────────────────
function AccuracyBar({ label, rules, rf }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: 1 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", width: 36 }}>RULES</span>
        <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${rules * 100}%`, background: "#ff8c00", borderRadius: 2 }} />
        </div>
        <span style={{ ...mono, fontSize: 9, color: "#ff8c00", width: 36 }}>{(rules * 100).toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
        <span style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", width: 36 }}>RF</span>
        <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${rf * 100}%`, background: "#4ade80", borderRadius: 2 }} />
        </div>
        <span style={{ ...mono, fontSize: 9, color: "#4ade80", width: 36 }}>{(rf * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState("PERSISTENCE");

  // Data states
  const [summary,     setSummary]     = useState(null);
  const [modelInfo,   setModelInfo]   = useState(null);
  const [persistence, setPersistence] = useState(null);
  const [explanations,setExplanations]= useState(null);
  const [evaluation,  setEvaluation]  = useState(null);
  const [importance,  setImportance]  = useState(null);

  // UI states
  const [training,    setTraining]    = useState(false);
  const [seeding,     setSeeding]     = useState(false);
  const [seedResult,  setSeedResult]  = useState(null);
  const [trainResult, setTrainResult] = useState(null);
  const [loading,     setLoading]     = useState({});
  const [selectedId,  setSelectedId]  = useState(null);

  useEffect(() => {
    (async () => {
      const [s, m] = await Promise.all([getResearchSummary(), getModelInfo()]);
      setSummary(s);
      setModelInfo(m);
    })();
  }, []);

  const load = async (tab) => {
    setActiveTab(tab);
    if (tab === "PERSISTENCE" && !persistence) {
      setLoading(l => ({ ...l, persistence: true }));
      setPersistence(await getPersistenceMap());
      setLoading(l => ({ ...l, persistence: false }));
    }
    if (tab === "EXPLAINABILITY" && !explanations) {
      setLoading(l => ({ ...l, explanations: true }));
      setExplanations(await getAllExplanations());
      setLoading(l => ({ ...l, explanations: false }));
    }
    if (tab === "EVALUATION" && !evaluation) {
      setLoading(l => ({ ...l, evaluation: true }));
      const [ev, imp] = await Promise.all([getEvaluation(), getGlobalImportance()]);
      setEvaluation(ev);
      setImportance(imp);
      setLoading(l => ({ ...l, evaluation: false }));
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setTrainResult(null);
    const result = await trainModel();
    setTrainResult(result);
    setTraining(false);
    if (result?.status === "trained") {
      const m = await getModelInfo();
      setModelInfo(m);
    }
  };

  const handleSeed = async () => {
    setSeeding(true); setSeedResult(null);
    const r = await seedResearch();
    setSeedResult(r);
    setSeeding(false);
    // Refresh summary
    const s = await getResearchSummary();
    setSummary(s);
  };

  const isRF = modelInfo?.stage === "rf";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)", flexShrink: 0 }}>
        <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 4 }}>
          RESEARCH MODULE · NOVEL CONTRIBUTIONS
        </div>
        <div style={{ ...serif, fontSize: 20, color: "#fff", marginBottom: 8 }}>
          Temporal Persistence-Augmented Anomaly Classification
        </div>

        {/* Summary stats row */}
        {summary && (
          <div style={{ display: "flex", gap: 24 }}>
            {[
              ["SCANS RECORDED",     summary.scans_recorded],
              ["TOTAL ANOMALIES",    summary.total_anomalies],
              ["PERSISTENT HOTSPOTS",summary.persistent_hotspots],
              ["NIGHT DETECTIONS",   summary.night_detections],
              ["RISING CONFIDENCE",  summary.rising_confidence],
              ["CLASSIFIER",         summary.classifier_stage === "rf" ? "RANDOM FOREST" : "RULE-BASED"],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: 2 }}>{label}</div>
                <div style={{ ...mono, fontSize: 13, color: label === "CLASSIFIER" && val === "RANDOM FOREST" ? "#4ade80" : "#fff", marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)", flexShrink: 0 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => load(tab)} style={{
            padding: "11px 22px", border: "none",
            borderBottom: activeTab === tab ? "2px solid #fff" : "2px solid transparent",
            background: "transparent",
            color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
            ...mono, fontSize: 9, letterSpacing: 3, cursor: "pointer",
          }}>
            {tab}
          </button>
        ))}
        <div style={{ marginLeft: "auto", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: isRF ? "#4ade80" : "#f59e0b" }} />
          <span style={{ ...mono, fontSize: 8, color: isRF ? "#4ade80" : "#f59e0b", letterSpacing: 1 }}>
            {isRF ? "RF ACTIVE" : "RULES ACTIVE"}
          </span>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

        {/* ── Seed banner — shown when scan exists but isn't enriched ────── */}
      {summary && summary.total_anomalies > 0 && summary.persistent_hotspots === 0 && !seeding && !seedResult && (
        <div style={{ margin:"0 0 20px 0", padding:"12px 16px", border:"1px solid rgba(245,158,11,0.3)", background:"rgba(245,158,11,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ ...mono, fontSize:9, color:"rgba(245,158,11,0.9)", lineHeight:1.8 }}>
            ⚠ Existing scan data detected but not yet enriched with persistence + SHAP features.<br/>
            Click ENRICH NOW to compute temporal features on your current scan data without re-scanning.
          </div>
          <button onClick={handleSeed} style={{ padding:"8px 16px", border:"1px solid rgba(245,158,11,0.4)", background:"rgba(245,158,11,0.1)", color:"rgba(245,158,11,0.9)", ...mono, fontSize:9, letterSpacing:2, cursor:"pointer", flexShrink:0, marginLeft:16 }}>
            ▶ ENRICH NOW
          </button>
        </div>
      )}
      {seeding && (
        <div style={{ margin:"0 0 20px 0", padding:"12px 16px", border:"1px solid rgba(96,165,250,0.3)", background:"rgba(96,165,250,0.06)", ...mono, fontSize:9, color:"#60a5fa" }}>
          ⟳ Enriching scan data with persistence + SHAP features...
        </div>
      )}
      {seedResult?.status === "seeded" && (
        <div style={{ margin:"0 0 20px 0", padding:"12px 16px", border:"1px solid rgba(74,222,128,0.3)", background:"rgba(74,222,128,0.06)", ...mono, fontSize:9, color:"#4ade80" }}>
          ✓ {seedResult.enriched} anomalies enriched. Now click TRAIN RF in the CLASSIFIER tab.
        </div>
      )}

      {/* ── PERSISTENCE TAB ─────────────────────────────────────────────── */}
        {activeTab === "PERSISTENCE" && (
          <div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 4 }}>FEATURE 1</div>
            <div style={{ ...serif, fontSize: 17, color: "#fff", marginBottom: 6 }}>Temporal Persistence Engine</div>
            <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1.9, marginBottom: 20, maxWidth: 700 }}>
              Hotspots are tracked across VIIRS/MODIS satellite passes (~12h revisit). Each coordinate
              accumulates a persistence vector: recurrence count, confidence slope, nocturnal ratio,
              and inter-pass timing consistency. These features extend the single-pass spectral features
              used by the base classifier.
            </p>

            {loading.persistence ? (
              <Loader text="LOADING PERSISTENCE MAP..." />
            ) : !persistence ? (
              <Empty text="RUN A LIVE SCAN FIRST TO POPULATE PERSISTENCE DATA" />
            ) : (
              <>
                {/* Persistence summary boxes */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
                  {[
                    ["PERSISTENT HOTSPOTS", persistence.persistent, "#f59e0b",
                     `${persistence.persistent} of ${persistence.total} appeared in 2+ scans`],
                    ["TOTAL TRACKED", persistence.total, "#60a5fa", "anomalies in latest scan"],
                    ["SCANS IN HISTORY", summary?.scans_recorded || "—", "#a78bfa", "satellite passes recorded"],
                    ["COORD RADIUS", "1.5 km", "#4ade80", "spatial matching threshold (VIIRS 375m res)"],
                  ].map(([label, val, color, sub]) => (
                    <div key={label} style={{ padding: "14px 16px", border: `1px solid ${color}30`, background: `${color}08` }}>
                      <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 6 }}>{label}</div>
                      <div style={{ ...mono, fontSize: 20, color, marginBottom: 4 }}>{val}</div>
                      <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.35)" }}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Per-anomaly persistence cards */}
                <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 12 }}>
                  ANOMALY PERSISTENCE RECORDS — {persistence.scan_utc}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
                  {Object.entries(persistence.anomalies || {}).map(([id, p]) => {
                    const traj    = (p.trajectory || []).map(t => t.confidence).reverse();
                    const rc      = p.recurrence_count || 0;
                    const slope   = p.confidence_slope || 0;
                    const slopeDir = slope > 0.02 ? "↑ GROWING" : slope < -0.02 ? "↓ WEAKENING" : "→ STABLE";
                    const slopeColor = slope > 0.02 ? "#ff3b3b" : slope < -0.02 ? "#4ade80" : "rgba(255,255,255,0.4)";
                    const sevColor = SCOLOR[p.severity] || "#fff";
                    return (
                      <div key={id} style={{ padding: "12px 14px", border: `1px solid ${rc >= 2 ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)"}`, background: rc >= 2 ? "rgba(245,158,11,0.04)" : "rgba(0,0,0,0.2)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ ...mono, fontSize: 9, color: sevColor }}>{p.severity} · {id}</span>
                          <span style={{ ...mono, fontSize: 8, color: slopeColor }}>{slopeDir}</span>
                        </div>
                        <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>{p.type}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                          {[
                            ["RECURRENCE",  rc === 0 ? "First detection" : `${rc} passes`],
                            ["PERSISTENCE", ((p.persistence_score || 0) * 100).toFixed(0) + "%"],
                            ["NIGHT RATIO", ((p.night_ratio || 0) * 100).toFixed(0) + "%"],
                            ["INTERVAL",    ((p.interval_consistency || 0) * 100).toFixed(0) + "% regular"],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <div style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>{k}</div>
                              <div style={{ ...mono, fontSize: 10, color: "#fff" }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {traj.length >= 2 && (
                          <Sparkline values={traj} color={slopeColor === "rgba(255,255,255,0.4)" ? "#60a5fa" : slopeColor} width={270} height={28} />
                        )}
                        {rc === 0 && <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.25)" }}>First detection — no trajectory yet</div>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── EXPLAINABILITY TAB ──────────────────────────────────────────── */}
        {activeTab === "EXPLAINABILITY" && (
          <div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 4 }}>FEATURE 2</div>
            <div style={{ ...serif, fontSize: 17, color: "#fff", marginBottom: 6 }}>SHAP Feature Explainability</div>
            <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1.9, marginBottom: 20, maxWidth: 700 }}>
              Each anomaly classification is explained using SHAP (SHapley Additive exPlanations).
              Feature contributions show which factors drove the classification — temporal persistence,
              thermal brightness, FRP, or nocturnal ratio. When the RF model is trained, Tree SHAP
              is used; otherwise rule-based approximation provides explainability from day one.
            </p>

            {loading.explanations ? (
              <Loader text="COMPUTING SHAP VALUES..." />
            ) : !explanations ? (
              <Empty text="RUN A LIVE SCAN FIRST TO GENERATE EXPLANATIONS" />
            ) : (
              <div style={{ display: "flex", gap: 16 }}>
                {/* Left: anomaly selector */}
                <div style={{ width: 240, flexShrink: 0 }}>
                  <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 8 }}>SELECT ANOMALY</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 500, overflowY: "auto" }}>
                    {Object.entries(explanations.anomalies || {}).map(([id, exp]) => (
                      <div key={id} onClick={() => setSelectedId(id)} style={{
                        padding: "8px 10px",
                        border: `1px solid ${selectedId === id ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.07)"}`,
                        background: selectedId === id ? "rgba(96,165,250,0.08)" : "rgba(0,0,0,0.2)",
                        cursor: "pointer",
                      }}>
                        <div style={{ ...mono, fontSize: 9, color: SCOLOR[exp.severity] || "#fff", marginBottom: 2 }}>{exp.severity} · {id}</div>
                        <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.6)" }}>{exp.type}</div>
                        <div style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                          {exp.method === "shap_tree" ? "🔬 Tree SHAP" : "📐 Approximation"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: SHAP detail */}
                <div style={{ flex: 1 }}>
                  {!selectedId ? (
                    <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", padding: "40px 0" }}>← SELECT AN ANOMALY TO VIEW ITS EXPLANATION</div>
                  ) : (() => {
                    const exp = explanations.anomalies?.[selectedId];
                    if (!exp) return null;
                    return (
                      <div>
                        {/* Explanation headline */}
                        <div style={{ padding: "14px 16px", border: "1px solid rgba(96,165,250,0.2)", background: "rgba(96,165,250,0.06)", marginBottom: 20 }}>
                          <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 6 }}>ANALYST EXPLANATION</div>
                          <div style={{ ...mono, fontSize: 10, color: "#fff", lineHeight: 1.8 }}>{exp.explanation_text}</div>
                        </div>

                        {/* SHAP bars */}
                        <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 12 }}>
                          TOP FEATURE CONTRIBUTIONS ({exp.method === "shap_tree" ? "Tree SHAP" : "Rule Approximation"})
                        </div>
                        {(exp.top_features || []).map(f => (
                          <ShapBar key={f.feature} label={f.label} value={f.shap_value} pct={f.pct} direction={f.direction} />
                        ))}

                        {/* Persistence sub-section */}
                        {exp.persistence && (
                          <div style={{ marginTop: 20, padding: "12px 14px", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)" }}>
                            <div style={{ ...mono, fontSize: 8, color: "rgba(245,158,11,0.8)", letterSpacing: 2, marginBottom: 10 }}>TEMPORAL PERSISTENCE FEATURES</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                              {[
                                ["PERSISTENCE SCORE",  (exp.persistence.score * 100).toFixed(0) + "%"],
                                ["RECURRENCE",         exp.persistence.recurrence_count + " passes"],
                                ["CONF SLOPE",         (exp.persistence.confidence_slope > 0 ? "+" : "") + (exp.persistence.confidence_slope * 100).toFixed(1) + "%/pass"],
                                ["NIGHT RATIO",        (exp.persistence.night_ratio * 100).toFixed(0) + "%"],
                              ].map(([k, v]) => (
                                <div key={k}>
                                  <div style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 3 }}>{k}</div>
                                  <div style={{ ...mono, fontSize: 11, color: "#f59e0b" }}>{v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CLASSIFIER TAB ──────────────────────────────────────────────── */}
        {activeTab === "CLASSIFIER" && (
          <div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 4 }}>FEATURE 3</div>
            <div style={{ ...serif, fontSize: 17, color: "#fff", marginBottom: 6 }}>Hybrid Classifier — Rules → Random Forest</div>
            <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1.9, marginBottom: 20, maxWidth: 700 }}>
              Stage 1: rule-based classifier (threshold rules on brightness, FRP, lat/lon, day/night).
              Stage 2: Random Forest trained on 10-dim feature vectors including persistence features,
              bootstrapped via weak supervision from Stage 1 labels. Once trained, Stage 2 overrides
              Stage 1 for all new classifications.
            </p>

            {/* Model status */}
            <div style={{ padding: "16px 18px", border: `1px solid ${isRF ? "rgba(74,222,128,0.3)" : "rgba(245,158,11,0.3)"}`, background: isRF ? "rgba(74,222,128,0.05)" : "rgba(245,158,11,0.05)", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 4 }}>ACTIVE CLASSIFIER</div>
                  <div style={{ ...mono, fontSize: 16, color: isRF ? "#4ade80" : "#f59e0b" }}>
                    {isRF ? "RANDOM FOREST (Stage 2)" : "RULE-BASED (Stage 1)"}
                  </div>
                  {modelInfo?.trained && (
                    <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                      {modelInfo.n_estimators} estimators · {modelInfo.classes?.length} classes
                    </div>
                  )}
                </div>
                <button onClick={handleTrain} disabled={training} style={{
                  padding: "10px 20px",
                  border: "1px solid rgba(96,165,250,0.4)",
                  background: training ? "rgba(96,165,250,0.05)" : "rgba(96,165,250,0.1)",
                  color: training ? "rgba(255,255,255,0.4)" : "#60a5fa",
                  ...mono, fontSize: 9, letterSpacing: 2, cursor: training ? "not-allowed" : "pointer",
                }}>
                  {training ? "⟳ TRAINING..." : isRF ? "⟳ RETRAIN RF" : "▶ TRAIN RF"}
                </button>
              </div>
            </div>

            {/* Train result */}
            {trainResult && (
              <div style={{ padding: "14px 16px", border: `1px solid ${trainResult.status === "trained" ? "rgba(74,222,128,0.3)" : "rgba(255,59,59,0.3)"}`, background: trainResult.status === "trained" ? "rgba(74,222,128,0.05)" : "rgba(255,59,59,0.05)", marginBottom: 20 }}>
                {trainResult.status === "trained" ? (
                  <>
                    <div style={{ ...mono, fontSize: 9, color: "#4ade80", letterSpacing: 2, marginBottom: 8 }}>✓ MODEL TRAINED SUCCESSFULLY</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                      {[
                        ["SAMPLES",    trainResult.samples],
                        ["CV F1 MACRO",  trainResult.cv_f1_macro],
                        ["CV STD",       trainResult.cv_f1_std],
                        ["CLASSES",      trainResult.classes?.length],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 3 }}>{k}</div>
                          <div style={{ ...mono, fontSize: 13, color: "#fff" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ ...mono, fontSize: 9, color: "#f59e0b", lineHeight: 1.8 }}>
                    {trainResult.message || trainResult.error || "Training failed"}
                  </div>
                )}
              </div>
            )}

            {/* Feature importance */}
            {isRF && modelInfo?.feature_importances && (
              <div>
                <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 12 }}>FEATURE IMPORTANCES (RF)</div>
                {Object.entries(modelInfo.feature_importances)
                  .sort(([,a],[,b]) => b - a)
                  .map(([fname, imp]) => (
                    <div key={fname} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{fname}</span>
                        <span style={{ ...mono, fontSize: 9, color: "#60a5fa" }}>{(imp * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${imp * 100}%`, background: "#60a5fa", borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Feature vector diagram */}
            <div style={{ marginTop: 24, padding: "16px 18px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.2)" }}>
              <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 12 }}>10-DIM FEATURE VECTOR COMPOSITION</div>
              <div style={{ display: "flex", gap: 0 }}>
                {[
                  { label: "SPECTRAL\n(0-6)", dims: 7, color: "#60a5fa", desc: "brightness, FRP, confidence, lat, lon, interactions" },
                  { label: "TEMPORAL\n(7-9)", dims: 3, color: "#f59e0b", desc: "persistence, confidence slope, night ratio" },
                ].map(({ label, dims, color, desc }) => (
                  <div key={label} style={{ flex: dims, padding: "10px 12px", border: `1px solid ${color}30`, background: `${color}08`, marginRight: 4 }}>
                    <div style={{ ...mono, fontSize: 8, color, letterSpacing: 1, whiteSpace: "pre-line", marginBottom: 4 }}>{label}</div>
                    <div style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>{desc}</div>
                    <div style={{ ...mono, fontSize: 11, color, marginTop: 6 }}>{dims} dims</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── EVALUATION TAB ──────────────────────────────────────────────── */}
        {activeTab === "EVALUATION" && (
          <div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 4 }}>FEATURE 4</div>
            <div style={{ ...serif, fontSize: 17, color: "#fff", marginBottom: 6 }}>Evaluation — RF vs Rule-Based Comparison</div>
            <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1.9, marginBottom: 20, maxWidth: 700 }}>
              Agreement rates computed on scan history using the stored anomaly type as ground truth
              (weak supervision). For publication-quality metrics, validate against FIRMS fire archive
              with confirmed event labels. Train the RF model first for meaningful comparison.
            </p>

            {loading.evaluation ? (
              <Loader text="RUNNING EVALUATION..." />
            ) : !evaluation ? (
              <Empty text="NEED AT LEAST 3 SCANS FOR EVALUATION" />
            ) : evaluation.error ? (
              <div style={{ ...mono, fontSize: 9, color: "#ff6b6b" }}>{evaluation.error || evaluation.detail}</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Overall accuracy */}
                <div style={{ padding: "16px 18px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
                  <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 14 }}>OVERALL ACCURACY</div>
                  <AccuracyBar label="OVERALL" rules={evaluation.overall_accuracy?.rules || 0} rf={evaluation.overall_accuracy?.rf || 0} />
                  <div style={{ padding: "10px 12px", border: "1px solid rgba(74,222,128,0.2)", background: "rgba(74,222,128,0.05)", marginTop: 8 }}>
                    <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 3 }}>IMPROVEMENT</div>
                    <div style={{ ...mono, fontSize: 16, color: (evaluation.overall_accuracy?.improvement || 0) >= 0 ? "#4ade80" : "#ff6b6b" }}>
                      {(evaluation.overall_accuracy?.improvement || 0) >= 0 ? "+" : ""}
                      {((evaluation.overall_accuracy?.improvement || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.35)", marginTop: 10, lineHeight: 1.7 }}>
                    Samples: {evaluation.total_samples} · Scans used: {evaluation.scans_used}
                  </div>
                </div>

                {/* Per-class accuracy */}
                <div style={{ padding: "16px 18px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
                  <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 14 }}>PER-CLASS ACCURACY</div>
                  {Object.entries(evaluation.per_class_accuracy || {}).map(([cls, acc]) => (
                    <AccuracyBar key={cls} label={cls.toUpperCase()} rules={acc.rules || 0} rf={acc.rf || 0} />
                  ))}
                </div>

                {/* Global feature importance */}
                {importance && (
                  <div style={{ padding: "16px 18px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)", gridColumn: "1 / -1" }}>
                    <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 14 }}>
                      GLOBAL FEATURE IMPORTANCE · {importance.method === "rf_importance" ? "Random Forest" : "Rule Approximation"}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                      {Object.entries(importance.importances || {})
                        .sort(([,a],[,b]) => b - a)
                        .map(([fname, imp]) => {
                          const isTemporal = ["persistence_score","confidence_slope","night_ratio","interval_consistency"].includes(fname);
                          return (
                            <div key={fname} style={{ padding: "8px 10px", border: `1px solid ${isTemporal ? "rgba(245,158,11,0.25)" : "rgba(96,165,250,0.15)"}`, background: isTemporal ? "rgba(245,158,11,0.04)" : "rgba(96,165,250,0.04)" }}>
                              <div style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.4)", marginBottom: 4, lineHeight: 1.5 }}>{fname.replace(/_/g," ")}</div>
                              <div style={{ ...mono, fontSize: 14, color: isTemporal ? "#f59e0b" : "#60a5fa" }}>{(imp * 100).toFixed(1)}%</div>
                              {isTemporal && <div style={{ ...mono, fontSize: 7, color: "rgba(245,158,11,0.6)", marginTop: 2 }}>★ NOVEL</div>}
                            </div>
                          );
                        })}
                    </div>
                    <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 10 }}>
                      ★ Novel temporal features · Blue = existing spectral features
                    </div>
                  </div>
                )}

                {/* Paper note */}
                <div style={{ padding: "14px 16px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)", gridColumn: "1 / -1" }}>
                  <div style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 8 }}>NOTE FOR PAPER</div>
                  <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1.9 }}>
                    {evaluation.note}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function Loader({ text }) {
  return <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.2)", letterSpacing:3, padding:"40px 0" }}>{text}</div>;
}
function Empty({ text }) {
  return <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.2)", letterSpacing:3, padding:"40px 0" }}>{text}</div>;
}
