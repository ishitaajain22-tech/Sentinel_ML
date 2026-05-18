// src/components/layout/TopNav.jsx
import { useClock } from "../../hooks/useClock";

const NAV_ITEMS = ["DASHBOARD", "LIVE FEED", "REPORTS", "ALERTS", "AUTHORITIES", "RESEARCH"];

export default function TopNav({ activePage = "DASHBOARD", onNavigate }) {
  const time = useClock();

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 32px",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(20px)",
      flexShrink: 0, zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => onNavigate("DASHBOARD")}>
          <div style={{
            width: 34, height: 34,
            border: "1px solid rgba(255,255,255,0.5)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, color: "#ffffff",
            boxShadow: "0 0 16px rgba(255,255,255,0.15)",
          }}>⊕</div>
          <div>
            <div style={{ fontSize: 14, letterSpacing: 5, color: "#ffffff", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
              SENTINEL
            </div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.6)", fontFamily: "'Courier New', monospace" }}>
              SATELLITE SURVEILLANCE SYSTEM
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.15)" }} />

        {/* Nav links */}
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item;
          return (
            <div
              key={item}
              onClick={() => onNavigate(item)}
              style={{
                fontSize: 11, letterSpacing: 2,
                color: isActive ? "#ffffff" : "rgba(255,255,255,0.55)",
                cursor: "pointer",
                paddingBottom: 2,
                borderBottom: isActive ? "1px solid #ffffff" : "1px solid transparent",
                fontFamily: "'Courier New', monospace",
                fontWeight: isActive ? 700 : 400,
                transition: "color 0.15s",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {/* Clock + status */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", letterSpacing: 2, fontFamily: "'Courier New', monospace" }}>
          {time.toISOString().replace("T", " ").slice(0, 19)} UTC
        </div>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 10px #4ade80", animation: "pulse 2s ease-in-out infinite" }} />
      </div>
    </nav>
  );
}