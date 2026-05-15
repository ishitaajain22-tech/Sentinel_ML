// src/components/activity/ActivityLog.jsx
export default function ActivityLog({ logs = [] }) {
  if (logs.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 12 }}>
        <div style={{ fontSize: 24, opacity: 0.15, color: "#fff" }}>◎</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textAlign: "center", fontFamily: "'Courier New', monospace", lineHeight: 1.8 }}>
          AWAITING<br />DATASET UPLOAD
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
      {logs.map((log, i) => (
        <div key={i} style={{ padding: "9px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", opacity: Math.max(0.35, 1 - i * 0.055) }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 3, fontFamily: "'Courier New', monospace" }}>
            {log.time} UTC
          </div>
          <div style={{ fontSize: 11, color: log.color, lineHeight: 1.5, fontFamily: "'Courier New', monospace" }}>
            {log.msg}
          </div>
        </div>
      ))}
    </div>
  );
}