// src/App.jsx
// Live scan state is managed here so anomalies from NASA FIRMS
// also appear in the Dashboard stats bar and anomaly list.

import { useState }      from "react";
import StarField         from "./components/effects/StarField";
import ScanLine          from "./components/effects/ScanLine";
import TopNav            from "./components/layout/TopNav";
import StatsBar          from "./components/layout/StatsBar";
import AnomalyList       from "./components/anomaly/AnomalyList";
import DetailPanel       from "./components/anomaly/DetailPanel";
import ActivityLog       from "./components/activity/ActivityLog";
import UploadZone        from "./components/activity/UploadZone";
import EmptyState        from "./components/EmptyState";
import ToastContainer    from "./components/Toast";
import LiveFeedPage      from "./pages/LiveFeedPage";
import ReportsPage       from "./pages/ReportsPage";
import AlertsPage        from "./pages/AlertsPage";
import AuthoritiesPage   from "./pages/AuthoritiesPage";
import { uploadDataset } from "./services/api";
import "./styles/globals.css";

const nowUTC    = () => new Date().toISOString().replace("T", " ").slice(11, 19);
const SEV_COLOR = { CRITICAL: "#ff3b3b", HIGH: "#ff8c00", MODERATE: "#e8d44d", LOW: "#5eead4" };
let   toastId   = 0;

const DEFAULT_AUTHORITIES = [
  { id: "naval",        type: "Naval Movement",            icon: "⬡", color: "#60a5fa", authority: "Naval Command / Coast Guard", email: "", channels: { email: true,  pdf: true  }, priority: "HIGH",     log: [] },
  { id: "mining",       type: "Illegal Mining",            icon: "◈", color: "#f59e0b", authority: "Forest & Environment Dept",    email: "", channels: { email: true,  pdf: true  }, priority: "HIGH",     log: [] },
  { id: "border",       type: "Border Intrusion",          icon: "◇", color: "#ff3b3b", authority: "Border Security Force",        email: "", channels: { email: true,  pdf: true  }, priority: "CRITICAL", log: [] },
  { id: "construction", type: "Unauthorized Construction", icon: "□", color: "#a78bfa", authority: "Urban Development Authority",  email: "", channels: { email: true,  pdf: false }, priority: "MODERATE", log: [] },
];

export default function App() {
  // ── Upload-based anomalies ─────────────────────────────────────────────────
  const [uploadAnomalies,  setUploadAnomalies]  = useState([]);
  const [selected,         setSelected]         = useState(null);
  const [isLoading,        setIsLoading]        = useState(false);
  const [uploadError,      setUploadError]      = useState(null);

  // ── Live scan anomalies (NASA FIRMS) ───────────────────────────────────────
  // Live Feed is self-contained; these are ONLY used for Reports and Alerts pages
  const [liveScanAnomalies, setLiveScanAnomalies] = useState([]);

  // ── allAnomalies: used for Reports/Alerts — both upload + live combined ───
  // Dashboard stats bar ONLY shows upload anomalies (live feed is self-contained)
  const allAnomalies = [...uploadAnomalies, ...liveScanAnomalies];

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [activePage,   setActivePage]   = useState("DASHBOARD");

  // ── Analyst workflow ───────────────────────────────────────────────────────
  const [logs,         setLogs]         = useState([]);
  const [toasts,       setToasts]       = useState([]);
  const [flags,        setFlags]        = useState({});
  const [watching,     setWatching]     = useState({});
  const [authorities,  setAuthorities]  = useState(DEFAULT_AUTHORITIES);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addToast = (title, message, type = "info") => {
    const id = ++toastId;
    setToasts(t => [...t, { id, title, message, type }]);
  };
  const dismissToast = (id) => setToasts(t => t.filter(x => x.id !== id));
  const pushLog      = (msg, color) =>
    setLogs(prev => [{ time: nowUTC(), msg, color }, ...prev].slice(0, 60));

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    setIsLoading(true);
    setUploadError(null);
    setUploadAnomalies([]);
    setSelected(null);
    setFlags({});
    setWatching({});

    pushLog(`Dataset received: ${file.name}`, "rgba(255,255,255,0.6)");
    pushLog("Preprocessing — normalising bands...", "rgba(255,255,255,0.4)");
    pushLog("Running Isolation Forest detection...", "rgba(255,255,255,0.4)");

    try {
      const result = await uploadDataset(file);

      pushLog("Detection complete", "rgba(255,255,255,0.5)");
      pushLog(`${result.anomalies_found} anomaly(s) classified`, "rgba(255,255,255,0.65)");
      result.anomalies.forEach(a =>
        pushLog(`${a.severity} — ${a.type}`, SEV_COLOR[a.severity] || "#fff")
      );
      pushLog("Pipeline complete.", "#4ade80");

      // Silent MLOps note only
      if (result.mlops?.drift?.drift_detected) {
        pushLog("System: model drift noted.", "rgba(255,255,255,0.22)");
      }

      setUploadAnomalies(result.anomalies);
      if (result.anomalies.length > 0) setSelected(result.anomalies[0]);
      addToast("DETECTION COMPLETE", `${result.anomalies_found} anomaly(s) found in ${file.name}`, "success");

    } catch (err) {
      const msg = err.message || "Upload failed";
      setUploadError(msg);
      pushLog(`ERROR: ${msg}`, "#ff3b3b");
      addToast("UPLOAD FAILED", msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Live scan results arrive from LiveFeedPage ─────────────────────────────
  const handleLiveScanResult = (anomalies, meta) => {
    setLiveScanAnomalies(anomalies);
    if (anomalies.length > 0) {
      pushLog(`Live scan: ${anomalies.length} thermal anomaly(s) · ${meta?.region || "India"}`, "#60a5fa");
      const critCount = anomalies.filter(a => a.severity === "CRITICAL").length;
      if (critCount > 0) {
        addToast("CRITICAL DETECTIONS", `${critCount} CRITICAL thermal anomaly(s) from NASA FIRMS`, "error");
      }
    }
  };

  // ── Authority management ───────────────────────────────────────────────────
  const handleUpdateAuthority = (id, field, value) =>
    setAuthorities(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

  const handleToggleChannel = (id, ch) =>
    setAuthorities(prev => prev.map(a =>
      a.id === id ? { ...a, channels: { ...a.channels, [ch]: !a.channels[ch] } } : a
    ));

  const handlePingSent = (authId, entry) => {
    setAuthorities(prev => prev.map(a =>
      a.id === authId ? { ...a, log: [entry, ...(a.log || [])].slice(0, 20) } : a
    ));
    pushLog(`Test ping → ${entry.msg}`, entry.ok ? "#4ade80" : "#ff6b6b");
  };

  // ── Alert sent ─────────────────────────────────────────────────────────────
  const handleAlertSent = (anomaly) => {
    pushLog(`ESCALATED: ${anomaly.type} → authority notified`, "#4ade80");
    addToast("AUTHORITY NOTIFIED", `Alert dispatched for ${anomaly.id} — ${anomaly.type}`, "success");
    const TYPE_TO_ID = {
      "Naval Movement":           "naval",
      "Illegal Mining":           "mining",
      "Border Intrusion":         "border",
      "Unauthorized Construction":"construction",
    };
    const authId = TYPE_TO_ID[anomaly.type];
    if (authId) {
      const auth  = authorities.find(a => a.id === authId);
      const entry = { time: nowUTC(), msg: `Escalation sent for ${anomaly.id} to ${auth?.email || "authority"}`, ok: true };
      setAuthorities(prev => prev.map(a =>
        a.id === authId ? { ...a, log: [entry, ...(a.log || [])].slice(0, 20) } : a
      ));
    }
  };

  const handleFlagged = (flagData) => {
    setFlags(prev => ({ ...prev, [flagData.anomalyId]: flagData }));
    pushLog(`Flagged ${flagData.anomalyId}: ${flagData.reason}`, "#ff8c00");
    addToast("ANOMALY FLAGGED", `${flagData.anomalyId} → ${flagData.reason}`, "info");
  };

  const handleToggleWatch = (id) => {
    setWatching(prev => {
      const next = { ...prev, [id]: !prev[id] };
      pushLog(`${next[id] ? "Added to" : "Removed from"} watch: ${id}`, "#60a5fa");
      return next;
    });
  };

  // ── Page renderer ──────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (activePage) {

      case "LIVE FEED":
        return (
          <LiveFeedPage
            watching={watching}
            onToggleWatch={handleToggleWatch}
            logs={logs}
            onScanResult={handleLiveScanResult}
          />
        );

      case "REPORTS":
        // Reports shows both upload + live anomalies combined
        return <ReportsPage anomalies={allAnomalies} />;

      case "ALERTS":
        return (
          <AlertsPage
            anomalies={allAnomalies}
            authorities={authorities}
            onAlertSent={handleAlertSent}
          />
        );

      case "AUTHORITIES":
        return (
          <AuthoritiesPage
            authorities={authorities}
            onUpdateAuthority={handleUpdateAuthority}
            onToggleChannel={handleToggleChannel}
            onPingSent={handlePingSent}
          />
        );

      default: // DASHBOARD
        return (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

            {/* LEFT */}
            <div style={{
              width: 320, display: "flex", flexDirection: "column",
              borderRight: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.2)",
            }}>
              {uploadAnomalies.length > 0 ? (
                <AnomalyList
                  anomalies={uploadAnomalies}
                  selectedId={selected?.id}
                  onSelect={setSelected}
                />
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    fontSize: 10, letterSpacing: 3,
                    color: "rgba(255,255,255,0.18)",
                    fontFamily: "'Courier New', monospace",
                    textAlign: "center", lineHeight: 1.8,
                  }}>
                    {isLoading ? "PIPELINE RUNNING..." : "NO DATA LOADED"}
                  </div>
                </div>
              )}
            </div>

            {/* CENTER */}
            <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto", background: "rgba(255,255,255,0.003)" }}>
              {isLoading ? <LoadingState /> : selected ? (
                <div key={selected.id} style={{ animation: "fadeIn 0.25s ease" }}>
                  <DetailPanel
                    anomaly={selected}
                    onEscalated={handleAlertSent}
                    onFlagged={handleFlagged}
                    flags={flags}
                    watching={watching}
                    onToggleWatch={handleToggleWatch}
                  />
                </div>
              ) : (
                <EmptyState />
              )}
            </div>

            {/* RIGHT */}
            <div style={{
              width: 245, borderLeft: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.2)", display: "flex", flexDirection: "column",
            }}>
              <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.4)", fontFamily: "'Courier New', monospace" }}>
                  ACTIVITY LOG
                </div>
              </div>
              <ActivityLog logs={logs} />
              <UploadZone onUpload={handleUpload} isLoading={isLoading} error={uploadError} />
            </div>

          </div>
        );
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#06060a", overflow: "hidden", position: "relative" }}>
      <StarField />
      <ScanLine />
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100vh" }}>
        <TopNav activePage={activePage} onNavigate={setActivePage} />
        {/* Stats bar: hidden on Live Feed (it has its own feed header), Dashboard shows upload only */}
        {activePage !== "LIVE FEED" && (
          <StatsBar anomalies={activePage === "DASHBOARD" ? uploadAnomalies : allAnomalies} />
        )}
        {renderPage()}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24 }}>
      <div style={{ position: "relative", width: 80, height: 80 }}>
        {[80, 56, 32].map((size, i) => (
          <div key={i} style={{
            position: "absolute", top: "50%", left: "50%",
            width: size, height: size,
            marginTop: -size / 2, marginLeft: -size / 2,
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: "50%",
            animation: `pulse ${1.2 + i * 0.4}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.6)", fontFamily: "'Courier New', monospace", marginBottom: 8 }}>
          RUNNING PIPELINE
        </div>
        <div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,0.3)", fontFamily: "'Courier New', monospace", lineHeight: 1.8 }}>
          PREPROCESSING → DETECTION<br />CLASSIFICATION → SEVERITY
        </div>
      </div>
    </div>
  );
}