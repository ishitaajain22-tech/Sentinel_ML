// src/components/effects/ScanLine.jsx
// A single horizontal line that sweeps top-to-bottom on repeat — radar scan feel

export default function ScanLine() {
  return (
    <div
      style={{
        position:      "fixed",
        left:          0,
        right:         0,
        top:           0,
        height:        "100vh",
        pointerEvents: "none",
        zIndex:        1,
        overflow:      "hidden",
      }}
    >
      <div
        style={{
          position:   "absolute",
          left:       0,
          right:      0,
          height:     1,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 70%, transparent 100%)",
          animation:  "scanDown 8s linear infinite",
        }}
      />
    </div>
  );
}