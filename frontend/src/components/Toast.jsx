// src/components/Toast.jsx
// Floating confirmation notification shown after escalation.
// Props: toasts (array of { id, message, type: "success"|"error"|"info" })
//        onDismiss (id) => void

import { useEffect } from "react";

const TYPE_STYLES = {
  success: { border: "rgba(74,222,128,0.4)",  bg: "rgba(74,222,128,0.1)",  color: "#4ade80",  icon: "✓" },
  error:   { border: "rgba(255,59,59,0.4)",   bg: "rgba(255,59,59,0.1)",   color: "#ff6b6b",  icon: "✕" },
  info:    { border: "rgba(255,255,255,0.2)",  bg: "rgba(255,255,255,0.06)",color: "#ffffff",  icon: "◎" },
};

function Toast({ toast, onDismiss }) {
  const s = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "14px 18px",
      border: `1px solid ${s.border}`,
      background: s.bg,
      backdropFilter: "blur(20px)",
      minWidth: 320, maxWidth: 420,
      animation: "fadeIn 0.2s ease",
      position: "relative",
    }}>
      <span style={{ color: s.color, fontSize: 14, marginTop: 1, flexShrink: 0 }}>{s.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: s.color, letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>
          {toast.title}
        </div>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.65)", letterSpacing: 0.5, lineHeight: 1.6 }}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", cursor: "pointer",
          fontSize: 12, padding: 0, flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      display: "flex", flexDirection: "column", gap: 8,
      zIndex: 1000,
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}