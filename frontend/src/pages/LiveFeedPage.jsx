// src/pages/LiveFeedPage.jsx
// Features: FEED tab (filter, select, report, CSV export) · MAP tab (Leaflet) · HISTORY tab (scan log, confidence trend)

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getLiveScanStatus, getLiveScanRegions,
  runLiveScan, getLatestScan,
  startSchedule, stopSchedule,
  downloadReport,
  triggerAlert,
  getScanHistory, getHistoryScan,
} from "../services/api";
import { SEVERITY_CONFIG } from "../constants/severity";

const SOURCE_LABELS = {
  "VIIRS_SNPP_NRT":   "VIIRS S-NPP · 375m · ~3hr lag",
  "VIIRS_NOAA20_NRT": "VIIRS NOAA-20 · 375m · ~3hr lag",
  "MODIS_NRT":        "MODIS Terra/Aqua · 1km · ~3hr lag",
};
const DAY_OPTIONS = [{ value:1,label:"Last 24 hours"},{value:2,label:"Last 48 hours"},{value:3,label:"Last 72 hours"}];
const TABS = ["FEED","MAP","HISTORY"];
const sel = { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontFamily:"'Courier New',monospace", fontSize:11, padding:"7px 10px", outline:"none", width:"100%", cursor:"pointer" };
const coordKey = (lat, lon) => `${(+lat).toFixed(2)},${(+lon).toFixed(2)}`;

export default function LiveFeedPage({ watching = {}, onToggleWatch, onEscalated, authorities = [], onNavigate }) {
  // scan state
  const [apiStatus,     setApiStatus]     = useState(null);
  const [regions,       setRegions]       = useState([]);
  const [anomalies,     setAnomalies]     = useState([]);
  const [scanMeta,      setScanMeta]      = useState(null);
  const [scanning,      setScanning]      = useState(false);
  const [scanError,     setScanError]     = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  // config
  const [region,       setRegion]       = useState("india");
  const [source,       setSource]       = useState("VIIRS_SNPP_NRT");
  const [dayRange,     setDayRange]     = useState(1);
  const [minConf,      setMinConf]      = useState(50);
  const [autoRefresh,  setAutoRefresh]  = useState(false);
  const [intervalMin,  setIntervalMin]  = useState(30);
  const [countdown,    setCountdown]    = useState(0);
  const [pendingChange,setPendingChange]= useState(false);
  // feed UI
  const [activeTab,  setActiveTab]  = useState("FEED");
  const [expanded,   setExpanded]   = useState(null);
  const [filter,     setFilter]     = useState("ALL");
  const [selected,   setSelected]   = useState(new Set());
  // reporting
  const [reporting,  setReporting]  = useState({});
  const [reported,   setReported]   = useState({});
  const [escalating,   setEscalating]   = useState({});  // anomalyId → bool
  const [escalated,    setEscalated]    = useState({});  // anomalyId → bool (success flash)
  const [escalateErr,  setEscalateErr]  = useState({});  // anomalyId → error string
  // history
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedScan,   setExpandedScan]   = useState(null);
  const [scanDetail,     setScanDetail]     = useState({});
  // map
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [status, regData, latest] = await Promise.all([getLiveScanStatus(), getLiveScanRegions(), getLatestScan()]);
      if (status)  setApiStatus(status);
      if (regData) setRegions(regData.regions || []);
      if (latest?.anomalies?.length) {
        setAnomalies(latest.anomalies);
        setScanMeta({ scan_utc: latest.scan_utc, source: latest.source, region: latest.region });
      }
      setLoadingLatest(false);
    })();
  }, []);

  // ── History load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "HISTORY") return;
    (async () => {
      setHistoryLoading(true);
      const data = await getScanHistory();
      setHistory(data.scans || []);
      setHistoryLoading(false);
    })();
  }, [activeTab]);

  // ── Leaflet init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "MAP") return;
    const t = setTimeout(() => _initMap(), 100);
    return () => clearTimeout(t);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "MAP" && leafletRef.current) _plotMarkers();
  }, [anomalies, activeTab]);

  const _initMap = () => {
    if (!mapRef.current) return;
    if (leafletRef.current) { _plotMarkers(); return; }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }
    if (window.L) { _createMap(); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = _createMap;
    document.head.appendChild(script);
  };

  const _createMap = () => {
    if (!mapRef.current || leafletRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl:true, attributionControl:false }).setView([20,80],4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom:18 }).addTo(map);
    leafletRef.current = map;
    _plotMarkers();
  };

  const _plotMarkers = () => {
    const L = window.L; const map = leafletRef.current;
    if (!L || !map) return;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    const toPlot = anomalies.filter(a => a.lat != null && a.lon != null);
    if (!toPlot.length) return;
    toPlot.forEach(a => {
      const color  = SEVERITY_CONFIG[a.severity]?.color || "#fff";
      const radius = a.severity === "CRITICAL" ? 14 : a.severity === "HIGH" ? 10 : 7;
      const circle = window.L.circleMarker([a.lat, a.lon], { radius, fillColor:color, color, weight:1, opacity:0.9, fillOpacity:0.55 }).addTo(map);
      // Show actual bbox-filtered coordinates — region label from coords directly
      const regionLabel = a.region || a.coords;
      circle.bindPopup(`<div style="font-family:'Courier New',monospace;font-size:11px;color:#fff;background:#0a0a0f;padding:8px;min-width:200px"><div style="color:${color};font-weight:700;margin-bottom:6px">${a.severity} · ${a.type}</div><div style="color:rgba(255,255,255,0.7);margin-bottom:2px">${a.id}</div><div style="color:rgba(255,255,255,0.5);margin-bottom:2px">${regionLabel}</div><div style="color:rgba(255,255,255,0.6);margin-bottom:2px">${a.coords}</div><div style="color:rgba(255,255,255,0.4);margin-bottom:6px">Confidence: ${a.confidence?.toFixed(1)}%</div><div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:6px"><span style="color:rgba(255,255,255,0.4);font-size:9px">Satellite: ${a.description?.match(/Source: (\w+)/)?.[1] || 'FIRMS'}</span></div></div>`);
      markersRef.current.push(circle);
    });
    const bounds = L.latLngBounds(toPlot.map(a => [a.lat, a.lon]));
    map.fitBounds(bounds, { padding:[40,40], maxZoom:8 });
  };

  useEffect(() => { return () => { if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; } }; }, []);

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRefresh) { setCountdown(0); return; }
    setCountdown(intervalMin * 60);
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { handleScan(); return intervalMin * 60; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [autoRefresh, intervalMin]);

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    setScanning(true); setScanError(null);
    try {
      const result = await runLiveScan({ region, source, dayRange, minConfidence: minConf });
      setAnomalies(result.anomalies || []);
      setScanMeta({ scan_utc: result.scan_utc, source: result.source, region: result.region, total: result.anomalies_found });
      setPendingChange(false);
      setSelected(new Set());
      const hist = await getScanHistory();
      setHistory(hist.scans || []);
    } catch (e) { setScanError(e.message); }
    finally { setScanning(false); }
  }, [region, source, dayRange, minConf]);

  // ── Auto-refresh toggle ───────────────────────────────────────────────────
  const handleAutoRefreshToggle = async () => {
    if (autoRefresh) { await stopSchedule(); setAutoRefresh(false); }
    else { await startSchedule({ region, source, intervalMin }); setAutoRefresh(true); }
  };

  // ── Reporting ─────────────────────────────────────────────────────────────
  const handleReport = async (anomaly) => {
    setReporting(r => ({ ...r, [anomaly.id]: true }));
    try {
      await downloadReport(anomaly);
      setReported(r => ({ ...r, [anomaly.id]: true }));
      setTimeout(() => setReported(r => ({ ...r, [anomaly.id]: false })), 3000);
    } catch (e) { console.error("Report error:", e); }
    finally { setReporting(r => ({ ...r, [anomaly.id]: false })); }
  };

  const handleBulkReport = async () => {
    for (const id of selected) {
      const a = anomalies.find(x => x.id === id);
      if (a) await handleReport(a);
    }
    setSelected(new Set());
  };

  // ── Escalate to authority ────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    setSelected(selected.size === filteredAnomalies.length ? new Set() : new Set(filteredAnomalies.map(a => a.id)));
  };

  // ── Escalate to authority — checks Authorities config first ────────────────
  const TYPE_TO_AUTHORITY = {
    'Naval Movement':            'naval',
    'Illegal Mining':            'mining',
    'Border Intrusion':          'border',
    'Unauthorized Construction': 'construction',
  };

  const getAuthority = (type) => {
    const id = TYPE_TO_AUTHORITY[type];
    return authorities.find(a => a.id === id) || null;
  };

  const handleEscalate = async (anomaly) => {
    setEscalateErr(e => ({ ...e, [anomaly.id]: null }));

    // ── Gate: authority must be configured first ─────────────────────────────
    const auth = getAuthority(anomaly.type);
    if (!auth?.email) {
      setEscalateErr(e => ({ ...e, [anomaly.id]: 'NO_EMAIL' }));
      // Auto-clear after 6 seconds
      setTimeout(() => setEscalateErr(e => ({ ...e, [anomaly.id]: null })), 6000);
      return;
    }

    setEscalating(e => ({ ...e, [anomaly.id]: true }));
    try {
      const channels = Object.entries(auth.channels).filter(([,v]) => v).map(([k]) => k);
      await triggerAlert(anomaly, channels, [auth.email]);
      setEscalated(e => ({ ...e, [anomaly.id]: { email: auth.email, authority: auth.authority } }));
      onEscalated && onEscalated(anomaly);
      setTimeout(() => setEscalated(e => ({ ...e, [anomaly.id]: null })), 5000);
    } catch (err) {
      setEscalateErr(e => ({ ...e, [anomaly.id]: err.message || 'Send failed' }));
    } finally {
      setEscalating(e => ({ ...e, [anomaly.id]: false }));
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const toExport = filteredAnomalies;
    if (!toExport.length) return;
    const headers = ["id","type","severity","confidence","region","coords","lat","lon","status","timestamp","description"];
    const rows = toExport.map(a => headers.map(h => { const v = a[h] ?? ""; return typeof v === "string" && v.includes(",") ? `"${v}"` : v; }).join(","));
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const el   = document.createElement("a");
    el.href = url; el.download = `SENTINEL_LiveScan_${scanMeta?.region || "export"}_${new Date().toISOString().slice(0,10)}.csv`;
    el.click(); URL.revokeObjectURL(url);
  };

  // ── History ───────────────────────────────────────────────────────────────
  const toggleScanDetail = async (idx) => {
    if (expandedScan === idx) { setExpandedScan(null); return; }
    setExpandedScan(idx);
    if (!scanDetail[idx]) {
      const data = await getHistoryScan(idx);
      if (data) setScanDetail(prev => ({ ...prev, [idx]: data.anomalies || [] }));
    }
  };

  // ── Confidence trends ─────────────────────────────────────────────────────
  const confidenceTrends = (() => {
    if (!history.length) return {};
    const trends = {};
    history.forEach((scan) => {
      (scan.anomalies || []).forEach(a => {
        const key = coordKey(a.lat, a.lon);
        if (!trends[key]) trends[key] = [];
        trends[key].push({ scanUtc: scan.scan_utc, confidence: a.confidence, severity: a.severity, type: a.type });
      });
    });
    return trends;
  })();

  const recurringSpots = Object.entries(confidenceTrends).filter(([,e]) => e.length >= 2).sort((a,b) => b[1].length - a[1].length).slice(0,8);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredAnomalies = anomalies.filter(a => {
    if (filter === "WATCHED") return watching[a.id];
    if (filter === "ALL")     return true;
    return a.severity === filter;
  });

  const total = anomalies.length || 1;
  const dist  = ["CRITICAL","HIGH","MODERATE","LOW"].map(s => ({ s, count: anomalies.filter(a => a.severity === s).length, color: SEVERITY_CONFIG[s]?.color || "#fff" }));
  const hasKey = apiStatus?.api?.status === "ok";

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

      {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
      <div style={{ width:260, borderRight:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.25)", display:"flex", flexDirection:"column", overflowY:"auto", flexShrink:0 }}>
        <div style={{ padding:"20px 18px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:3, marginBottom:4 }}>LIVE SATELLITE SCAN</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#fff" }}>NASA FIRMS</div>
          <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.35)", marginTop:4, lineHeight:1.7 }}>VIIRS · MODIS · Real thermal anomalies</div>
        </div>

        <div style={{ padding:"10px 18px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background: hasKey ? "#4ade80" : "#ff3b3b", boxShadow:`0 0 6px ${hasKey ? "#4ade80" : "#ff3b3b"}` }} />
            <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color: hasKey ? "#4ade80" : "#ff6b6b", letterSpacing:1 }}>
              {hasKey ? "API KEY ACTIVE" : "API KEY NOT SET"}
            </span>
          </div>
          {!hasKey && <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", marginTop:5, lineHeight:1.7 }}>firms.modaps.eosdis.nasa.gov<br/>Add NASA_FIRMS_KEY to .env</div>}
        </div>

        <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)", letterSpacing:2, marginBottom:5 }}>REGION</div>
            <select value={region} onChange={e => { setRegion(e.target.value); setPendingChange(true); }} style={sel}>
              {regions.map(r => <option key={r.id} value={r.id} style={{ background:"#0a0a0f" }}>{r.label}</option>)}
              {regions.length === 0 && <option value="india" style={{ background:"#0a0a0f" }}>India</option>}
            </select>
          </div>
          <div>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)", letterSpacing:2, marginBottom:5 }}>SATELLITE SOURCE</div>
            <select value={source} onChange={e => { setSource(e.target.value); setPendingChange(true); }} style={sel}>
              {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k} style={{ background:"#0a0a0f" }}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)", letterSpacing:2, marginBottom:5 }}>TIME WINDOW</div>
            <select value={dayRange} onChange={e => setDayRange(+e.target.value)} style={sel}>
              {DAY_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background:"#0a0a0f" }}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)", letterSpacing:2 }}>MIN CONFIDENCE</span>
              <span style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"#fff" }}>{minConf}%</span>
            </div>
            <input type="range" min={10} max={95} step={5} value={minConf} onChange={e => setMinConf(+e.target.value)} style={{ width:"100%", accentColor:"#60a5fa" }} />
          </div>

          {pendingChange && anomalies.length > 0 && (
            <div style={{ padding:"7px 10px", border:"1px solid rgba(255,200,60,0.35)", background:"rgba(255,200,60,0.07)", fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,200,60,0.85)", lineHeight:1.7 }}>
              ⚠ Settings changed.<br/>Results below are from the previous scan.<br/>Press SCAN NOW to apply.
            </div>
          )}

          <button onClick={handleScan} disabled={scanning || !hasKey} style={{ padding:"10px 0", border:`1px solid ${!hasKey ? "rgba(255,255,255,0.1)" : "rgba(60,255,100,0.4)"}`, background: scanning ? "rgba(60,255,100,0.06)" : !hasKey ? "transparent" : "rgba(60,255,100,0.1)", color: !hasKey ? "rgba(255,255,255,0.3)" : scanning ? "rgba(60,255,100,0.5)" : "rgba(60,255,100,0.9)", fontFamily:"'Courier New',monospace", fontSize:10, letterSpacing:2, cursor: scanning || !hasKey ? "not-allowed" : "pointer" }}>
            {scanning ? "◉ SCANNING..." : "▶ SCAN NOW"}
          </button>

          {scanError && <div style={{ padding:"8px 10px", border:"1px solid rgba(255,59,59,0.3)", background:"rgba(255,59,59,0.06)", fontFamily:"'Courier New',monospace", fontSize:9, color:"#ff6b6b", lineHeight:1.6 }}>{scanError}</div>}

          <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:14 }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)", letterSpacing:2, marginBottom:8 }}>AUTO-REFRESH</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontFamily:"'Courier New',monospace", fontSize:10, color: autoRefresh ? "#4ade80" : "rgba(255,255,255,0.4)" }}>{autoRefresh ? `Every ${intervalMin}m` : "Off"}</span>
              <div onClick={hasKey ? handleAutoRefreshToggle : undefined} style={{ width:36, height:18, borderRadius:9, background: autoRefresh ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)", border:`1px solid ${autoRefresh ? "#4ade80" : "rgba(255,255,255,0.2)"}`, position:"relative", cursor: hasKey ? "pointer" : "not-allowed" }}>
                <div style={{ position:"absolute", top:2, left: autoRefresh ? 19 : 2, width:12, height:12, borderRadius:"50%", background: autoRefresh ? "#4ade80" : "rgba(255,255,255,0.4)", transition:"left 0.2s" }} />
              </div>
            </div>
            {!autoRefresh && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)" }}>INTERVAL</span>
                  <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"#fff" }}>{intervalMin}m</span>
                </div>
                <input type="range" min={5} max={120} step={5} value={intervalMin} onChange={e => setIntervalMin(+e.target.value)} style={{ width:"100%", accentColor:"#4ade80" }} />
              </div>
            )}
            {autoRefresh && countdown > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.08)", borderRadius:1 }}>
                  <div style={{ height:"100%", width:`${(countdown/(intervalMin*60))*100}%`, background:"#4ade80", borderRadius:1, transition:"width 1s linear" }} />
                </div>
                <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"#4ade80", minWidth:30 }}>{Math.floor(countdown/60)}:{String(countdown%60).padStart(2,"0")}</span>
              </div>
            )}
          </div>
        </div>

        {scanMeta && (
          <div style={{ padding:"12px 18px", borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:"auto" }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:6 }}>LAST SCAN</div>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.6)", lineHeight:1.8 }}>
              {scanMeta.scan_utc}<br/>
              {scanMeta.region?.replace(/_/g," ").toUpperCase()}<br/>
              <span style={{ color:"#60a5fa" }}>{scanMeta.total ?? anomalies.length} detections</span>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Tabs ───────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Tab bar */}
        <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.2)", flexShrink:0, alignItems:"center" }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding:"12px 24px", border:"none", borderBottom: activeTab===tab ? "2px solid #fff" : "2px solid transparent", background:"transparent", color: activeTab===tab ? "#fff" : "rgba(255,255,255,0.4)", fontFamily:"'Courier New',monospace", fontSize:10, letterSpacing:3, cursor:"pointer" }}>
              {tab}
              {tab === "HISTORY" && history.length > 0 && <span style={{ marginLeft:6, fontSize:8, color:"rgba(255,255,255,0.35)" }}>({history.length})</span>}
            </button>
          ))}

          {/* Toolbar buttons — FEED only */}
          {activeTab === "FEED" && anomalies.length > 0 && (
            <div style={{ marginLeft:"auto", marginRight:16, display:"flex", gap:8, alignItems:"center" }}>
              {/* Select-all */}
              <button onClick={selectAll} style={{ padding:"6px 12px", border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(255,255,255,0.5)", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:2, cursor:"pointer" }}>
                {selected.size === filteredAnomalies.length && filteredAnomalies.length > 0 ? "DESELECT ALL" : "SELECT ALL"}
              </button>
              {/* Bulk report */}
              {selected.size > 0 && (
                <button onClick={handleBulkReport} style={{ padding:"6px 14px", border:"1px solid rgba(255,140,0,0.4)", background:"rgba(255,140,0,0.08)", color:"rgba(255,140,0,0.9)", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:2, cursor:"pointer" }}>
                  ↓ REPORT SELECTED ({selected.size})
                </button>
              )}
              {/* Export CSV */}
              <button onClick={handleExportCSV} style={{ padding:"6px 14px", border:"1px solid rgba(96,165,250,0.3)", background:"rgba(96,165,250,0.07)", color:"rgba(96,165,250,0.85)", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:2, cursor:"pointer" }}>
                ↓ EXPORT CSV ({filteredAnomalies.length})
              </button>
            </div>
          )}
        </div>

        {/* ── FEED TAB ────────────────────────────────────────────────────── */}
        {activeTab === "FEED" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Header */}
            <div style={{ padding:"14px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, background:"rgba(0,0,0,0.2)" }}>
              <div>
                <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:3, marginBottom:3 }}>THERMAL ANOMALY FEED · NASA FIRMS</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"#fff" }}>
                  {loadingLatest ? "Loading..." : `${anomalies.length} Active Detection${anomalies.length !== 1 ? "s" : ""}`}
                </div>
                {scanMeta?.region && (
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)", marginTop:4, display:"flex", alignItems:"center", gap:6 }}>
                    <span>SHOWING RESULTS FOR:</span>
                    <span style={{ color:"#60a5fa", letterSpacing:1 }}>{scanMeta.region.replace(/_/g," ").toUpperCase()}</span>
                    {pendingChange && <span style={{ color:"rgba(255,200,60,0.8)" }}>⚠ STALE</span>}
                  </div>
                )}
              </div>
              {scanMeta?.scan_utc && (
                <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.35)", textAlign:"right" }}>
                  <div>LAST UPDATED</div>
                  <div style={{ color:"rgba(255,255,255,0.6)", marginTop:2 }}>{scanMeta.scan_utc}</div>
                </div>
              )}
            </div>

            {/* Severity bar */}
            {anomalies.length > 0 && (
              <div style={{ padding:"10px 24px", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
                <div style={{ display:"flex", height:5, gap:2, borderRadius:3, overflow:"hidden", marginBottom:6 }}>
                  {dist.filter(d => d.count > 0).map(d => <div key={d.s} style={{ flex: d.count/total, background:d.color, boxShadow:`0 0 5px ${d.color}50` }} />)}
                </div>
                <div style={{ display:"flex", gap:14 }}>
                  {dist.filter(d => d.count > 0).map(d => (
                    <div key={d.s} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:d.color }} />
                      <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.55)" }}>{d.s} ({d.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter tabs */}
            <div style={{ display:"flex", gap:2, padding:"8px 24px", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
              {["ALL","CRITICAL","HIGH","MODERATE","WATCHED"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding:"5px 12px", border:`1px solid ${filter===f ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`, background: filter===f ? "rgba(255,255,255,0.08)" : "transparent", color: filter===f ? "#fff" : "rgba(255,255,255,0.4)", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:2, cursor:"pointer" }}>
                  {f}{f==="WATCHED" && Object.values(watching).filter(Boolean).length > 0 ? ` (${Object.values(watching).filter(Boolean).length})` : ""}
                </button>
              ))}
            </div>

            {/* Anomaly list */}
            <div style={{ flex:1, overflowY:"auto" }}>
              {loadingLatest ? (
                <div style={{ padding:"40px 24px", fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.2)", letterSpacing:3 }}>LOADING LATEST SCAN...</div>
              ) : !hasKey ? (
                <NoKeyMessage />
              ) : filteredAnomalies.length === 0 ? (
                <div style={{ padding:"40px 24px", fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.2)", letterSpacing:3 }}>
                  {filter === "WATCHED" ? "NO WATCHED ANOMALIES" : "NO DETECTIONS — PRESS SCAN NOW"}
                </div>
              ) : filteredAnomalies.map(a => {
                const sev        = SEVERITY_CONFIG[a.severity];
                const isOpen     = expanded === a.id;
                const isWatched  = watching[a.id];
                const isSelected = selected.has(a.id);
                const key        = coordKey(a.lat, a.lon);
                const trend      = confidenceTrends[key];
                const isRecurring = trend && trend.length >= 2;
                const isReporting  = reporting[a.id];
                const wasReported  = reported[a.id];
                const isEscalating  = escalating[a.id];
                const wasEscalated  = escalated[a.id];   // object {email, authority} or null
                const escalErr      = escalateErr[a.id]; // 'NO_EMAIL' | string | null
                const authConfig    = getAuthority(a.type);
                const authMissing   = !authConfig?.email;

                return (
                  <div key={a.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 24px", background: isOpen ? "rgba(255,255,255,0.03)" : isSelected ? "rgba(255,140,0,0.03)" : "transparent", transition:"background 0.15s" }}>

                      {/* Checkbox */}
                      <div onClick={() => toggleSelect(a.id)} style={{ width:13, height:13, flexShrink:0, border:`1px solid ${isSelected ? "rgba(255,140,0,0.7)" : "rgba(255,255,255,0.2)"}`, background: isSelected ? "rgba(255,140,0,0.2)" : "transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {isSelected && <div style={{ width:5, height:5, background:"rgba(255,140,0,0.9)", borderRadius:1 }} />}
                      </div>

                      {/* Pulse dot */}
                      <div style={{ width:9, height:9, borderRadius:"50%", background:sev?.color || "#fff", boxShadow:`0 0 ${isWatched ? "12px" : "6px"} ${sev?.color || "#fff"}`, flexShrink:0 }} />

                      {/* Info */}
                      <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => setExpanded(isOpen ? null : a.id)}>
                        <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:3 }}>
                          <span style={{ fontFamily:"'Playfair Display',serif", fontSize:14, color:"#fff", fontWeight:500 }}>{a.type}</span>
                          <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)" }}>{a.id}</span>
                          {isWatched   && <span style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"#60a5fa", letterSpacing:1 }}>◉ WATCH</span>}
                          {isRecurring && <span style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"#f59e0b", letterSpacing:1 }}>⟳ RECURRING</span>}
                        </div>
                        <div style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.55)" }}>{a.region} · {a.coords}</div>
                      </div>

                      {/* Severity + confidence */}
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:sev?.color, fontWeight:700, letterSpacing:2, textShadow:`0 0 8px ${sev?.color}` }}>{a.severity}</div>
                        <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{a.confidence?.toFixed(1)}%</div>
                      </div>

                      {/* Report button — inline per row */}
                      <button onClick={() => handleReport(a)} disabled={isReporting} title="Generate PDF report" style={{ padding:"6px 12px", border:`1px solid ${wasReported ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.15)"}`, background: wasReported ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", color: wasReported ? "#4ade80" : isReporting ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:2, cursor: isReporting ? "not-allowed" : "pointer", flexShrink:0, whiteSpace:"nowrap" }}>
                        {wasReported ? "✓ SAVED" : isReporting ? "..." : "↓ PDF"}
                      </button>

                      <button onClick={() => handleEscalate(a)} disabled={isEscalating || !!wasEscalated} title={authMissing ? "Configure authority email first (AUTHORITIES tab)" : "Escalate to authority"} style={{ padding:"6px 10px", border:"1px solid " + (wasEscalated ? "rgba(74,222,128,0.4)" : escalErr === 'NO_EMAIL' ? "rgba(255,200,60,0.5)" : authMissing ? "rgba(255,255,255,0.12)" : "rgba(255,59,59,0.35)"), background: wasEscalated ? "rgba(74,222,128,0.08)" : escalErr === 'NO_EMAIL' ? "rgba(255,200,60,0.07)" : "rgba(255,59,59,0.07)", color: wasEscalated ? "#4ade80" : isEscalating ? "rgba(255,255,255,0.3)" : escalErr === 'NO_EMAIL' ? "rgba(255,200,60,0.9)" : authMissing ? "rgba(255,255,255,0.3)" : "#ff6b6b", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:1, cursor: isEscalating || !!wasEscalated ? "not-allowed" : "pointer", flexShrink:0, whiteSpace:"nowrap" }}>
                        {wasEscalated ? "✓ SENT" : isEscalating ? "..." : escalErr === 'NO_EMAIL' ? "⚠ SET EMAIL" : authMissing ? "⚑ —" : "⚑ ESC"}
                      </button>
                      <div onClick={() => setExpanded(isOpen ? null : a.id)} style={{ color:"rgba(255,255,255,0.3)", fontSize:10, transform: isOpen ? "rotate(90deg)" : "none", transition:"transform 0.2s", cursor:"pointer", flexShrink:0 }}>▶</div>
                    </div>

                    {isOpen && (
                      <div style={{ padding:"0 24px 16px 80px" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                          {[["TIMESTAMP",a.timestamp],["COORDINATES",a.coords],["STATUS",a.status]].map(([label,value]) => (
                            <div key={label}>
                              <div style={{ fontSize:7, color:"rgba(255,255,255,0.35)", fontFamily:"'Courier New',monospace", letterSpacing:2, marginBottom:3 }}>{label}</div>
                              <div style={{ fontSize:11, color:"#fff", fontFamily:"'Courier New',monospace" }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <p style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom:12 }}>{a.description}</p>

                        {/* Spectral bars */}
                        <div style={{ display:"flex", gap:3, alignItems:"flex-end", height:20, marginBottom:12 }}>
                          {(a.spectral||[]).map((v,i) => <div key={i} style={{ width:8, height:`${Math.max(2,Math.round(v*20))}px`, background:sev?.color||"#fff", opacity:0.5+i*0.07, borderRadius:1 }} />)}
                          <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", marginLeft:6, alignSelf:"flex-end" }}>B1–B7</span>
                        </div>

                        {/* Confidence trend if recurring */}
                        {isRecurring && <ConfidenceTrendSparkline trend={trend} color={sev?.color||"#fff"} />}

                        <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                          <button onClick={() => onToggleWatch && onToggleWatch(a.id)} style={{ padding:"5px 14px", border:`1px solid ${isWatched ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.15)"}`, background: isWatched ? "rgba(96,165,250,0.1)" : "transparent", color: isWatched ? "#60a5fa" : "rgba(255,255,255,0.5)", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:2, cursor:"pointer" }}>
                            {isWatched ? "◉ REMOVE FROM WATCH LIST" : "◎ ADD TO WATCH LIST"}
                          </button>
                          <button onClick={() => handleReport(a)} disabled={isReporting} style={{ padding:"5px 14px", border:`1px solid ${wasReported ? "rgba(74,222,128,0.4)" : "rgba(255,140,0,0.3)"}`, background: wasReported ? "rgba(74,222,128,0.08)" : "rgba(255,140,0,0.07)", color: wasReported ? "#4ade80" : isReporting ? "rgba(255,255,255,0.3)" : "rgba(255,140,0,0.9)", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:2, cursor: isReporting ? "not-allowed" : "pointer" }}>
                            {wasReported ? "✓ REPORT SAVED" : isReporting ? "GENERATING..." : "↓ GENERATE PDF REPORT"}
                          </button>
                          <button onClick={() => handleEscalate(a)} disabled={isEscalating || !!wasEscalated} style={{ padding:"5px 14px", border:`1px solid ${wasEscalated ? "rgba(74,222,128,0.4)" : escalErr==='NO_EMAIL' ? "rgba(255,200,60,0.4)" : authMissing ? "rgba(255,255,255,0.1)" : "rgba(255,59,59,0.35)"}`, background: wasEscalated ? "rgba(74,222,128,0.08)" : escalErr==='NO_EMAIL' ? "rgba(255,200,60,0.07)" : "rgba(255,59,59,0.08)", color: wasEscalated ? "#4ade80" : isEscalating ? "rgba(255,255,255,0.3)" : escalErr==='NO_EMAIL' ? "rgba(255,200,60,0.9)" : authMissing ? "rgba(255,255,255,0.25)" : "#ff6b6b", fontFamily:"'Courier New',monospace", fontSize:8, letterSpacing:2, cursor: isEscalating || !!wasEscalated ? "not-allowed" : "pointer" }}>
                            {wasEscalated ? `✓ SENT TO ${wasEscalated.authority}` : isEscalating ? "ESCALATING..." : authMissing ? "⚑ ESCALATE (email not set)" : "⚑ ESCALATE TO AUTHORITY"}
                          </button>
                        </div>
                        {/* Authority routing row */}
                        <div style={{ marginTop:8, padding:"8px 12px", border:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.2)", fontFamily:"'Courier New',monospace", fontSize:8, lineHeight:2 }}>
                          <div style={{ color:"rgba(255,255,255,0.35)", letterSpacing:2, marginBottom:2 }}>ESCALATION WORKFLOW</div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            <span style={{ color:"rgba(255,255,255,0.5)" }}>Live Feed</span>
                            <span style={{ color:"rgba(255,255,255,0.25)" }}>→</span>
                            <span style={{ color:"rgba(255,255,255,0.5)" }}>Alerts</span>
                            <span style={{ color:"rgba(255,255,255,0.25)" }}>→</span>
                            <span style={{ color: authMissing ? "#f59e0b" : "#4ade80" }}>{authConfig?.authority || "Authority (not configured)"}</span>
                            {authConfig?.email && <span style={{ color:"rgba(255,255,255,0.4)" }}>· {authConfig.email}</span>}
                          </div>
                          {/* NO_EMAIL error with navigate link */}
                          {escalErr === 'NO_EMAIL' && (
                            <div style={{ marginTop:6, padding:"6px 8px", border:"1px solid rgba(255,200,60,0.3)", background:"rgba(255,200,60,0.06)", color:"rgba(255,200,60,0.9)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <span>No email set for {authConfig?.authority || a.type}.</span>
                              <span onClick={() => onNavigate && onNavigate("AUTHORITIES")} style={{ color:"#60a5fa", cursor:"pointer", textDecoration:"underline", marginLeft:8 }}>
                                Go to AUTHORITIES →
                              </span>
                            </div>
                          )}
                          {escalErr && escalErr !== 'NO_EMAIL' && (
                            <div style={{ marginTop:6, color:"#ff6b6b" }}>Error: {escalErr}</div>
                          )}
                          {wasEscalated && (
                            <div style={{ marginTop:6, color:"#4ade80" }}>✓ Alert dispatched to {wasEscalated.email}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MAP TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "MAP" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"12px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0, background:"rgba(0,0,0,0.2)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:3, marginBottom:2 }}>GEOSPATIAL VIEW · THERMAL DETECTIONS</div>
                <div style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:"#fff" }}>{anomalies.length} plotted · click marker for details</div>
              </div>
              <div style={{ display:"flex", gap:12 }}>
                {["CRITICAL","HIGH","MODERATE","LOW"].map(s => (
                  <div key={s} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:SEVERITY_CONFIG[s]?.color }} />
                    <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.5)" }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            {!hasKey ? <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}><NoKeyMessage /></div>
              : anomalies.length === 0 ? <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.2)", letterSpacing:3 }}>NO DETECTIONS — RUN A SCAN FIRST</div></div>
              : <div ref={mapRef} style={{ flex:1 }} />}
          </div>
        )}

        {/* ── HISTORY TAB ──────────────────────────────────────────────────── */}
        {activeTab === "HISTORY" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"14px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.2)", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
              <div>
                <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:3, marginBottom:3 }}>SCAN HISTORY · LAST {history.length} SCANS</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"#fff" }}>Historical Record</div>
              </div>
              {recurringSpots.length > 0 && <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(245,158,11,0.8)", letterSpacing:1 }}>⟳ {recurringSpots.length} recurring hotspot{recurringSpots.length!==1?"s":""} detected</div>}
            </div>
            <div style={{ flex:1, overflowY:"auto" }}>
              {historyLoading ? (
                <div style={{ padding:"40px 24px", fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.2)", letterSpacing:3 }}>LOADING HISTORY...</div>
              ) : history.length === 0 ? (
                <div style={{ padding:"40px 24px", fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.2)", letterSpacing:3 }}>NO SCAN HISTORY YET — RUN YOUR FIRST SCAN</div>
              ) : (
                <>
                  {recurringSpots.length > 0 && (
                    <div style={{ margin:"16px 24px", padding:"14px 16px", border:"1px solid rgba(245,158,11,0.25)", background:"rgba(245,158,11,0.05)" }}>
                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(245,158,11,0.8)", letterSpacing:2, marginBottom:10 }}>⟳ PERSISTENT HOTSPOTS</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
                        {recurringSpots.map(([key, entries]) => {
                          const latest = entries[0];
                          const sev = SEVERITY_CONFIG[latest.severity];
                          const vals = entries.map(e => e.confidence).slice().reverse();
                          const delta = vals[vals.length-1] - vals[0];
                          const dir = delta > 2 ? "↑ GROWING" : delta < -2 ? "↓ WEAKENING" : "→ STABLE";
                          const dirColor = delta > 2 ? "#ff3b3b" : delta < -2 ? "#4ade80" : "rgba(255,255,255,0.4)";
                          return (
                            <div key={key} style={{ padding:"8px 10px", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.2)" }}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                                <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:sev?.color }}>{latest.severity}</span>
                                <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:dirColor, fontWeight:700 }}>{dir}</span>
                              </div>
                              <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.7)", marginBottom:2 }}>{latest.type}</div>
                              <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)" }}>{key}</div>
                              <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", marginTop:2 }}>Seen in {entries.length} scan{entries.length!==1?"s":""}</div>
                              <MiniSparkline values={vals} color={sev?.color||"#fff"} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {history.map((scan, idx) => {
                    const isOpen = expandedScan === idx;
                    const counts = scan.severity_counts || {};
                    const scanAnomalies = scanDetail[idx] || [];
                    return (
                      <div key={idx} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                        <div onClick={() => toggleScanDetail(idx)} style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 24px", background: isOpen ? "rgba(255,255,255,0.02)" : "transparent", cursor:"pointer" }}>
                          <div style={{ width:7, height:7, borderRadius:"50%", background: idx===0 ? "#4ade80" : "rgba(255,255,255,0.25)", flexShrink:0 }} />
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:3 }}>
                              <span style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:"#fff" }}>{scan.scan_utc}</span>
                              {idx===0 && <span style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"#4ade80", letterSpacing:1 }}>LATEST</span>}
                            </div>
                            <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.5)" }}>{scan.region?.replace(/_/g," ").toUpperCase()} · {scan.source} · {scan.anomalies_found} detections</div>
                          </div>
                          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                            {Object.entries(counts).filter(([,v])=>v>0).map(([s,count]) => (
                              <div key={s} style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:SEVERITY_CONFIG[s]?.color, padding:"2px 6px", border:`1px solid ${SEVERITY_CONFIG[s]?.color}40` }}>{s[0]} {count}</div>
                            ))}
                          </div>
                          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, transform: isOpen?"rotate(90deg)":"none", transition:"transform 0.2s" }}>▶</div>
                        </div>
                        {isOpen && (
                          <div style={{ padding:"0 24px 16px 47px" }}>
                            {scanAnomalies.length === 0 ? (
                              <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.3)", padding:"8px 0" }}>Loading...</div>
                            ) : (
                              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:280, overflowY:"auto" }}>
                                {scanAnomalies.map(a => {
                                  const sev = SEVERITY_CONFIG[a.severity];
                                  const k = coordKey(a.lat, a.lon);
                                  const tr = confidenceTrends[k];
                                  const isRep = reporting[a.id]; const wasRep = reported[a.id];
                                  return (
                                    <div key={a.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"6px 10px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
                                      <div style={{ width:6, height:6, borderRadius:"50%", background:sev?.color, flexShrink:0 }} />
                                      <div style={{ flex:1, fontFamily:"'Courier New',monospace", fontSize:9 }}>
                                        <span style={{ color:"#fff" }}>{a.type}</span>
                                        <span style={{ color:"rgba(255,255,255,0.4)", marginLeft:8 }}>{a.region} · {a.coords}</span>
                                      </div>
                                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:sev?.color }}>{a.severity}</div>
                                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)", minWidth:36, textAlign:"right" }}>{a.confidence?.toFixed(1)}%</div>
                                      {tr && tr.length >= 2 && <MiniSparkline values={tr.map(e=>e.confidence).slice().reverse()} color={sev?.color||"#fff"} width={40} height={16} />}
                                      <button onClick={() => handleReport(a)} disabled={isRep} style={{ padding:"4px 10px", border:`1px solid ${wasRep?"rgba(74,222,128,0.4)":"rgba(255,255,255,0.12)"}`, background:"transparent", color: wasRep?"#4ade80":isRep?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.5)", fontFamily:"'Courier New',monospace", fontSize:7, letterSpacing:1, cursor:isRep?"not-allowed":"pointer", flexShrink:0 }}>
                                        {wasRep?"✓":"↓ PDF"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoKeyMessage() {
  return (
    <div style={{ padding:"40px 24px" }}>
      <div style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:"rgba(255,255,255,0.5)", letterSpacing:2, marginBottom:16 }}>NASA FIRMS API KEY REQUIRED</div>
      <div style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.35)", lineHeight:2 }}>
        1. Go to firms.modaps.eosdis.nasa.gov/api/area/<br/>
        2. Enter your email — key arrives instantly (free)<br/>
        3. Add to backend/.env → NASA_FIRMS_KEY=your_key<br/>
        4. Restart backend → press SCAN NOW
      </div>
    </div>
  );
}

function MiniSparkline({ values, color, width=60, height=20 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values); const max = Math.max(...values); const range = max-min||1;
  const pts = values.map((v,i) => { const x=(i/(values.length-1))*width; const y=height-((v-min)/range)*(height-2)-1; return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ");
  return (
    <svg width={width} height={height} style={{ display:"block", marginTop:6 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      {values.map((v,i) => { const x=(i/(values.length-1))*width; const y=height-((v-min)/range)*(height-2)-1; return <circle key={i} cx={x} cy={y} r={2} fill={color} opacity={0.9} />; })}
    </svg>
  );
}

function ConfidenceTrendSparkline({ trend, color }) {
  if (!trend || trend.length < 2) return null;
  const values = trend.map(t => t.confidence).slice().reverse();
  const delta  = values[values.length-1] - values[0];
  const trendColor = delta > 2 ? "#ff3b3b" : delta < -2 ? "#4ade80" : "rgba(255,255,255,0.5)";
  const trendLabel = delta > 2 ? `↑ +${delta.toFixed(1)}% (GROWING)` : delta < -2 ? `↓ ${delta.toFixed(1)}% (WEAKENING)` : "→ STABLE";
  return (
    <div style={{ marginBottom:12, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.07)", background:"rgba(0,0,0,0.2)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)", letterSpacing:2 }}>CONFIDENCE TREND · {trend.length} SCANS</span>
        <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:trendColor, fontWeight:700 }}>{trendLabel}</span>
      </div>
      <MiniSparkline values={values} color={color} width={200} height={32} />
    </div>
  );
}
