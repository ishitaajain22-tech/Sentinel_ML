// src/components/EmptyState.jsx
export default function EmptyState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "100%", gap: 20, userSelect: "none",
    }}>
      <div style={{ position: "relative", width: 100, height: 100 }}>
        {[100, 70, 44].map((size, i) => (
          <div key={i} style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: size, height: size,
            marginTop: -size / 2, marginLeft: -size / 2,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "50%",
          }} />
        ))}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 8, height: 8, marginTop: -4, marginLeft: -4,
          background: "rgba(255,255,255,0.25)", borderRadius: "50%",
          boxShadow: "0 0 12px rgba(255,255,255,0.15)",
        }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 11, letterSpacing: 4,
          color: "rgba(255,255,255,0.3)",
          fontFamily: "'Courier New', monospace", marginBottom: 8,
        }}>
          NO ANOMALIES DETECTED
        </div>
        <div style={{
          fontSize: 9, letterSpacing: 2,
          color: "rgba(255,255,255,0.2)",
          fontFamily: "'Courier New', monospace", lineHeight: 1.8,
        }}>
          UPLOAD A SATELLITE DATASET<br />TO BEGIN ANALYSIS
        </div>
      </div>
    </div>
  );
}