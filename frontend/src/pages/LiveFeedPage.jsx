// src/pages/LiveFeedPage.jsx
// Real-time satellite data from NASA FIRMS (VIIRS + MODIS).
// Features:
//   - Region selector (India, Northeast, Western Ghats, etc.)
//   - Satellite source selector (VIIRS S-NPP, VIIRS NOAA-20, MODIS)
//   - Day range selector (last 24h / 48h / 72h)
//   - Min confidence filter slider
//   - Scan now button + auto-refresh toggle
//   - Live countdown to next auto-scan
//   - Results feed with expandable rows
//   - Watch list filter tab
//   - Severity distribution bar

import { useState, useEffect, useCallback } from "react";
import {
  getLiveScanStatus,
  getLiveScanRegions,
  runLiveScan,
  getLatestScan,
  startSchedule,
  stopSchedule,
} from "../services/api";
import { SEVERITY_CONFIG } from "../constants/severity";

// ── Satellite source labels ────────────────────────────────────────────────
const SOURCE_LABELS = {
  "VIIRS_SNPP_NRT":   "VIIRS S-NPP · 375m · ~3hr lag",
  "VIIRS_NOAA20_NRT": "VIIRS NOAA-20 · 375m · ~3hr lag",
  "MODIS_NRT":        "MODIS Terra/Aqua · 1km · ~3hr lag",
};

const DAY_OPTIONS = [
  { value: 1, label: "Last 24 hours" },
  { value: 2, label: "Last 48 hours" },
  { value: 3, label: "Last 72 hours" },
];

export default function LiveFeedPage({ watching = {}, onToggleWatch, logs = [] }) {
  // ── API state ──────────────────────────────────────────────────────────────
  const [apiStatus,    setApiStatus]    = useState(null);
  const [regions,      setRegions]      = useState([]);
  const [anomalies,    setAnomalies]    = useState([]);
  const [scanMeta,     setScanMeta]     = useState(null);   // { scan_utc, source, region }
  const [scanning,     setScanning]     = useState(false);
  const [scanError,    setScanError]    = useState(null);
  const [loadingLatest,setLoadingLatest]= useState(true);

  // ── Config state ───────────────────────────────────────────────────────────
  const [region,      setRegion]       = useState("india");
  const [pendingChange,setPendingChange] = useState(false); // region/source changed since last scan
  const [source,      setSource]       = useState("VIIRS_SNPP_NRT");
  const [dayRange,    setDayRange]     = useState(1);
  const [minConf,     setMinConf]      = useState(50);
  const [autoRefresh, setAutoRefresh]  = useState(false);
  const [intervalMin, setIntervalMin]  = useState(30);
  const [countdown,   setCountdown]    = useState(0);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [expanded,    setExpanded]     = useState(null);
  const [filter,      setFilter]       = useState("ALL");

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [status, regData, latest] = await Promise.all([
        getLiveScanStatus(),
        getLiveScanRegions(),
        getLatestScan(),
      ]);
      if (status)  setApiStatus(status);
      if (regData) setRegions(regData.regions || []);
      if (latest?.anomalies?.length) {
        setAnomalies(latest.anomalies);
        setScanMeta({ scan_utc: latest.scan_utc, source: latest.source, region: latest.region });
      }
      setLoadingLatest(false);
    })();
  }, []);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRefresh) { setCountdown(0); return; }
    setCountdown(intervalMin * 60);
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { handleScan(); return intervalMin * 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [autoRefresh, intervalMin]);

  // ── Scan ───────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const result = await runLiveScan({ region, source, dayRange, minConfidence: minConf });
      setAnomalies(result.anomalies || []);
      setPendingChange(false);
      setScanMeta({
        scan_utc: result.scan_utc,
        source:   result.source,
        region:   result.region,
        total:    result.anomalies_found,
      });
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  }, [region, source, dayRange, minConf]);

  // ── Auto-refresh toggle ────────────────────────────────────────────────────
  const handleAutoRefreshToggle = async () => {
    if (autoRefresh) {
      await stopSchedule();
      setAutoRefresh(false);
    } else {
      await startSchedule({ region, source, intervalMin });
      setAutoRefresh(true);
    }
  };

  // ── Filtered anomalies ─────────────────────────────────────────────────────
  const filtered = anomalies.filter(a => {
    if (filter === "WATCHED")  return watching[a.id];
    if (filter === "ALL")      return true;
    return a.severity === filter;
  });

  // ── Severity distribution ──────────────────────────────────────────────────
  const total = anomalies.length || 1;
  const dist  = ["CRITICAL","HIGH","MODERATE","LOW"].map(s => ({
    s, count: anomalies.filter(a => a.severity === s).length,
    color: SEVERITY_CONFIG[s]?.color || "#fff",
  }));

  const hasKey = apiStatus?.api?.status === "ok";

  // ── Input style ────────────────────────────────────────────────────────────
  const sel = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#ffffff",
    fontFamily: "'Courier New', monospace",
    fontSize: 11, padding: "7px 10px",
    outline: "none", width: "100%", cursor: "pointer",
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

      {/* ── LEFT: Controls ────────────────────────────────────────── */}
      <div style={{
        width: 260, borderRight: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.25)",
        display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0,
      }}>
        <div style={{ padding: "20px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 3, marginBottom: 4 }}>
            LIVE SATELLITE SCAN
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#fff" }}>
            NASA FIRMS
          </div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 4, lineHeight: 1.7 }}>
            VIIRS · MODIS · Real thermal anomalies
          </div>
        </div>

        {/* API status badge */}
        <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: hasKey ? "#4ade80" : "#ff3b3b",
              boxShadow: `0 0 6px ${hasKey ? "#4ade80" : "#ff3b3b"}`,
            }} />
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: hasKey ? "#4ade80" : "#ff6b6b", letterSpacing: 1 }}>
              {hasKey ? "API KEY ACTIVE" : "API KEY NOT SET"}
            </span>
          </div>
          {!hasKey && (
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 5, lineHeight: 1.7 }}>
              Get free key at:<br />
              firms.modaps.eosdis.nasa.gov<br />
              Add NASA_FIRMS_KEY to .env
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Region */}
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 5 }}>REGION</div>
            <select value={region} onChange={e => { setRegion(e.target.value); setPendingChange(true); }} style={sel}>
              {regions.map(r => (
                <option key={r.id} value={r.id} style={{ background: "#0a0a0f" }}>
                  {r.label}
                </option>
              ))}
              {regions.length === 0 && <option value="india" style={{ background: "#0a0a0f" }}>India</option>}
            </select>
          </div>

          {/* Source */}
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 5 }}>SATELLITE SOURCE</div>
            <select value={source} onChange={e => { setSource(e.target.value); setPendingChange(true); }} style={sel}>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k} style={{ background: "#0a0a0f" }}>{v}</option>
              ))}
            </select>
          </div>

          {/* Day range */}
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 5 }}>TIME WINDOW</div>
            <select value={dayRange} onChange={e => setDayRange(+e.target.value)} style={sel}>
              {DAY_OPTIONS.map(o => (
                <option key={o.value} value={o.value} style={{ background: "#0a0a0f" }}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Min confidence */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>MIN CONFIDENCE</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#ffffff" }}>{minConf}%</span>
            </div>
            <input type="range" min={10} max={95} step={5} value={minConf}
              onChange={e => setMinConf(+e.target.value)}
              style={{ width: "100%", accentColor: "#60a5fa" }}
            />
          </div>

          {/* Pending change warning */}
          {pendingChange && anomalies.length > 0 && (
            <div style={{
              padding: '7px 10px',
              border: '1px solid rgba(255,200,60,0.35)',
              background: 'rgba(255,200,60,0.07)',
              fontFamily: "'Courier New', monospace",
              fontSize: 9, color: 'rgba(255,200,60,0.85)', lineHeight: 1.7,
            }}>
              ⚠ Settings changed.<br/>
              Results below are from the previous scan.<br/>
              Press SCAN NOW to apply.
            </div>
          )}

          {/* Scan button */}
          <button
            onClick={handleScan}
            disabled={scanning || !hasKey}
            style={{
              padding: "10px 0",
              border: `1px solid ${!hasKey ? "rgba(255,255,255,0.1)" : "rgba(60,255,100,0.4)"}`,
              background: scanning ? "rgba(60,255,100,0.06)" : !hasKey ? "transparent" : "rgba(60,255,100,0.1)",
              color: !hasKey ? "rgba(255,255,255,0.3)" : scanning ? "rgba(60,255,100,0.5)" : "rgba(60,255,100,0.9)",
              fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: 2,
              cursor: scanning || !hasKey ? "not-allowed" : "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!scanning && hasKey) e.currentTarget.style.background = "rgba(60,255,100,0.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = scanning ? "rgba(60,255,100,0.06)" : "rgba(60,255,100,0.1)"; }}
          >
            {scanning ? "◉ SCANNING..." : "▶ SCAN NOW"}
          </button>

          {/* Error */}
          {scanError && (
            <div style={{ padding: "8px 10px", border: "1px solid rgba(255,59,59,0.3)", background: "rgba(255,59,59,0.06)", fontFamily: "'Courier New', monospace", fontSize: 9, color: "#ff6b6b", lineHeight: 1.6 }}>
              {scanError}
            </div>
          )}

          {/* Auto-refresh */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 8 }}>AUTO-REFRESH</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: autoRefresh ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                {autoRefresh ? `Every ${intervalMin}m` : "Off"}
              </span>
              <div
                onClick={hasKey ? handleAutoRefreshToggle : undefined}
                style={{
                  width: 36, height: 18, borderRadius: 9,
                  background: autoRefresh ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)",
                  border: `1px solid ${autoRefresh ? "#4ade80" : "rgba(255,255,255,0.2)"}`,
                  position: "relative", cursor: hasKey ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: 2,
                  left: autoRefresh ? 19 : 2,
                  width: 12, height: 12, borderRadius: "50%",
                  background: autoRefresh ? "#4ade80" : "rgba(255,255,255,0.4)",
                  transition: "left 0.2s",
                }} />
              </div>
            </div>

            {!autoRefresh && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>INTERVAL</span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#fff" }}>{intervalMin}m</span>
                </div>
                <input type="range" min={5} max={120} step={5} value={intervalMin}
                  onChange={e => setIntervalMin(+e.target.value)}
                  style={{ width: "100%", accentColor: "#4ade80" }}
                />
              </div>
            )}

            {autoRefresh && countdown > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 1 }}>
                  <div style={{
                    height: "100%",
                    width: `${(countdown / (intervalMin * 60)) * 100}%`,
                    background: "#4ade80", borderRadius: 1,
                    transition: "width 1s linear",
                  }} />
                </div>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#4ade80", minWidth: 30 }}>
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Last scan info */}
        {scanMeta && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "auto" }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 6 }}>LAST SCAN</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
              {scanMeta.scan_utc}<br />
              {scanMeta.region?.replace(/_/g, " ").toUpperCase()}<br />
              <span style={{ color: "#60a5fa" }}>{scanMeta.total ?? anomalies.length} detections</span>
            </div>
          </div>
        )}
      </div>

      {/* ── CENTRE + RIGHT: Feed ──────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Feed header */}
        <div style={{
          padding: "14px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, background: "rgba(0,0,0,0.2)",
        }}>
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 3, marginBottom: 3 }}>
              THERMAL ANOMALY FEED · NASA FIRMS
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#fff" }}>
              {loadingLatest ? "Loading..." : `${anomalies.length} Active Detection${anomalies.length !== 1 ? "s" : ""}`}
            </div>
            {scanMeta?.region && (
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>SHOWING RESULTS FOR:</span>
                <span style={{ color: '#60a5fa', letterSpacing: 1 }}>
                  {scanMeta.region.replace(/_/g, ' ').toUpperCase()}
                </span>
                {pendingChange && (
                  <span style={{ color: 'rgba(255,200,60,0.8)', marginLeft: 4 }}>⚠ STALE</span>
                )}
              </div>
            )}
          </div>
          {scanMeta?.scan_utc && (
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", textAlign: "right" }}>
              <div>LAST UPDATED</div>
              <div style={{ color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{scanMeta.scan_utc}</div>
            </div>
          )}
        </div>

        {/* Severity distribution bar */}
        {anomalies.length > 0 && (
          <div style={{ padding: "10px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginBottom: 6 }}>
              SEVERITY DISTRIBUTION
            </div>
            <div style={{ display: "flex", height: 5, gap: 2, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
              {dist.filter(d => d.count > 0).map(d => (
                <div key={d.s} style={{ flex: d.count / total, background: d.color, boxShadow: `0 0 5px ${d.color}50` }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {dist.filter(d => d.count > 0).map(d => (
                <div key={d.s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: d.color }} />
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.55)" }}>
                    {d.s} ({d.count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 2, padding: "8px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          {["ALL","CRITICAL","HIGH","MODERATE","WATCHED"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 12px",
              border: `1px solid ${filter === f ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
              background: filter === f ? "rgba(255,255,255,0.08)" : "transparent",
              color: filter === f ? "#ffffff" : "rgba(255,255,255,0.4)",
              fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer",
            }}>
              {f}{f === "WATCHED" && Object.values(watching).filter(Boolean).length > 0
                ? ` (${Object.values(watching).filter(Boolean).length})` : ""}
            </button>
          ))}
        </div>

        {/* Feed list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingLatest ? (
            <div style={{ padding: "40px 24px", fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 3 }}>
              LOADING LATEST SCAN...
            </div>
          ) : !hasKey ? (
            <div style={{ padding: "40px 24px" }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 2, marginBottom: 16 }}>
                NASA FIRMS API KEY REQUIRED
              </div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 2 }}>
                1. Go to firms.modaps.eosdis.nasa.gov/api/area/<br />
                2. Enter your email — key arrives instantly (free)<br />
                3. Add to backend/.env → NASA_FIRMS_KEY=your_key<br />
                4. Restart backend → press SCAN NOW
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 24px", fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 3 }}>
              {filter === "WATCHED" ? "NO WATCHED ANOMALIES" : "NO DETECTIONS — PRESS SCAN NOW"}
            </div>
          ) : filtered.map((a, i) => {
            const sev    = SEVERITY_CONFIG[a.severity];
            const isOpen = expanded === a.id;
            const isWatched = watching[a.id];

            return (
              <div key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "13px 24px",
                    background: isOpen ? "rgba(255,255,255,0.03)" : "transparent",
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                >
                  <div style={{
                    width: 9, height: 9, borderRadius: "50%",
                    background: sev?.color || "#fff",
                    boxShadow: `0 0 ${isWatched ? "12px" : "6px"} ${sev?.color || "#fff"}`,
                    animation: "pulse 2s ease-in-out infinite", flexShrink: 0,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 3 }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "#fff", fontWeight: 500 }}>
                        {a.type}
                      </span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                        {a.id}
                      </span>
                      {isWatched && (
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 7, color: "#60a5fa", letterSpacing: 1 }}>◉ WATCH</span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
                      {a.region} · {a.coords}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: sev?.color, fontWeight: 700, letterSpacing: 2, textShadow: `0 0 8px ${sev?.color}` }}>
                      {a.severity}
                    </div>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {a.confidence.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>▶</div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ padding: "0 24px 16px 49px", animation: "fadeIn 0.2s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                      {[
                        { label: "TIMESTAMP",  value: a.timestamp },
                        { label: "COORDINATES",value: a.coords },
                        { label: "STATUS",     value: a.status },
                      ].map(item => (
                        <div key={item.label}>
                          <div style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", fontFamily: "'Courier New', monospace", letterSpacing: 2, marginBottom: 3 }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: "#fff", fontFamily: "'Courier New', monospace" }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: 12 }}>
                      {a.description}
                    </p>

                    {/* Spectral mini chart */}
                    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 20, marginBottom: 12 }}>
                      {a.spectral.map((v, i) => (
                        <div key={i} style={{ width: 8, height: `${Math.max(2, Math.round(v * 20))}px`, background: sev?.color || "#fff", opacity: 0.5 + i * 0.07, borderRadius: 1 }} />
                      ))}
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", marginLeft: 6, alignSelf: "flex-end" }}>B1–B7</span>
                    </div>

                    <button
                      onClick={() => onToggleWatch && onToggleWatch(a.id)}
                      style={{
                        padding: "5px 14px",
                        border: `1px solid ${isWatched ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.15)"}`,
                        background: isWatched ? "rgba(96,165,250,0.1)" : "transparent",
                        color: isWatched ? "#60a5fa" : "rgba(255,255,255,0.5)",
                        fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer",
                      }}
                    >
                      {isWatched ? "◉ REMOVE FROM WATCH LIST" : "◎ ADD TO WATCH LIST"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}