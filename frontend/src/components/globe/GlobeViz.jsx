// src/components/globe/GlobeViz.jsx
import { useEffect, useRef } from "react";
import { SEVERITY_CONFIG }   from "../../constants/severity";

export default function GlobeViz({ anomalies, selectedId }) {
  const canvasRef = useRef(null);
  const frameRef  = useRef(null);
  const rotRef    = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const r  = Math.min(W, H) * 0.38;

    const project = (lat, lon, rot) => {
      const phi   = (90 - lat) * Math.PI / 180;
      const theta = (lon + rot) * Math.PI / 180;
      return {
        x: cx + r * Math.sin(phi) * Math.cos(theta),
        y: cy - r * Math.cos(phi),
        z: r  * Math.sin(phi) * Math.sin(theta),
      };
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      rotRef.current += 0.08;
      const rot = rotRef.current;

      // Globe body — subtle fill
      const globe = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r);
      globe.addColorStop(0, "rgba(255,255,255,0.05)");
      globe.addColorStop(1, "rgba(255,255,255,0.01)");
      ctx.fillStyle = globe;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Globe border — pure white
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth   = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Latitude lines — pure white
      ctx.lineWidth = 0.5;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.strokeStyle = lat === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)";
        ctx.beginPath();
        let first = true;
        for (let lon = -180; lon <= 180; lon += 2) {
          const p = project(lat, lon, rot);
          if (p.z >= 0) {
            if (first) { ctx.moveTo(p.x, p.y); first = false; }
            else ctx.lineTo(p.x, p.y);
          } else first = true;
        }
        ctx.stroke();
      }

      // Longitude lines — pure white
      for (let lon = 0; lon < 360; lon += 30) {
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth   = 0.5;
        ctx.beginPath();
        let first = true;
        for (let lat = -90; lat <= 90; lat += 2) {
          const p = project(lat, lon, rot);
          if (p.z >= 0) {
            if (first) { ctx.moveTo(p.x, p.y); first = false; }
            else ctx.lineTo(p.x, p.y);
          } else first = true;
        }
        ctx.stroke();
      }

      // Anomaly pings
      anomalies.forEach((a) => {
        const p          = project(a.lat, a.lon, rot);
        if (p.z < 0) return;
        const color      = SEVERITY_CONFIG[a.severity]?.color || "#fff";
        const isSelected = a.id === selectedId;
        const sz         = isSelected ? 6 : 3.5;

        // Outer animated ring
        const ringR = sz + 7 + Math.sin(Date.now() / 350 + a.lat) * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = color + "55";
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Inner core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fillStyle   = color;
        ctx.shadowColor = color;
        ctx.shadowBlur  = isSelected ? 20 : 10;
        ctx.fill();
        ctx.shadowBlur  = 0;
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [anomalies, selectedId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <canvas ref={canvasRef} width={260} height={260} style={{ display: "block" }} />
      <div style={{
        textAlign: "center", paddingTop: 8,
        fontSize: 9, color: "rgba(255,255,255,0.45)",
        letterSpacing: 2, fontFamily: "'Courier New', monospace",
      }}>
        LIVE ORBITAL VIEW · {anomalies.length} ACTIVE SIGNATURES
      </div>
    </div>
  );
}