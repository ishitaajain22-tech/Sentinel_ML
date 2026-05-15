// src/components/charts/SpectralBars.jsx
// B1–B7 band signal bar chart
// Props: data (number[]), color (string)

export default function SpectralBars({ data, color }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 32 }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            width:      6,
            height:     `${(v / 100) * 32}px`,
            background: color,
            opacity:    0.65 + (i / data.length) * 0.35,
            borderRadius: 1,
            transition: "height 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}
