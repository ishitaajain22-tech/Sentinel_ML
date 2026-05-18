// src/components/effects/StarField.jsx
// Renders 120 randomly placed twinkling star particles as a fixed background layer

import { useMemo } from "react";

export default function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => ({
        id: i,
        x:       Math.random() * 100,
        y:       Math.random() * 100,
        size:    Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.6 + 0.1,
        delay:   Math.random() * 4,
      })),
    []
  );

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {stars.map((s) => (
        <div
          key={s.id}
          style={{
            position:     "absolute",
            left:         `${s.x}%`,
            top:          `${s.y}%`,
            width:        s.size,
            height:       s.size,
            borderRadius: "50%",
            background:   "#fff",
            opacity:      s.opacity,
            animation:    `twinkle ${2 + s.delay}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}