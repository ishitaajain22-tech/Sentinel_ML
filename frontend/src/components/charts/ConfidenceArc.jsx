// src/components/charts/ConfidenceArc.jsx
// Circular SVG arc showing confidence percentage
// Props: value (0–100), color (string)

export default function ConfidenceArc({ value, color }) {
  const r    = 20;
  const cx   = 26;
  const cy   = 26;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <svg width={52} height={52} style={{ transform: "rotate(-90deg)" }}>
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={3}
      />
      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      {/* Label (counter-rotated so text reads upright) */}
      <text
        x={cx} y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize={9}
        fontFamily="'Courier New', monospace"
        style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px` }}
      >
        {value}%
      </text>
    </svg>
  );
}
