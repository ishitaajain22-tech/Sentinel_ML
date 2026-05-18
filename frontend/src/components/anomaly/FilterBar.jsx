// src/components/anomaly/FilterBar.jsx
const FILTERS = ["ALL", "CRITICAL", "HIGH", "MODERATE"];

export default function FilterBar({ filter, setFilter, search, setSearch }) {
  return (
    <div style={{
      display: "flex", gap: 8, padding: "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      alignItems: "center",
    }}>
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 12px",
            border: `1px solid ${filter === f ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)"}`,
            background: filter === f ? "rgba(255,255,255,0.1)" : "transparent",
            color: filter === f ? "#ffffff" : "rgba(255,255,255,0.5)",
            fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: 2,
            cursor: "pointer", transition: "all 0.15s",
          }}>
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}