// src/components/activity/UploadZone.jsx
import { useState, useRef } from "react";

const ACCEPTED = ".tif, .tiff, .csv, .zip, .png, .jpg, .jpeg";

export default function UploadZone({ onUpload, isLoading = false, error = null }) {
  const [hover, setHover] = useState(false);
  const inputRef          = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setHover(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  const borderColor = error
    ? "rgba(255,59,59,0.6)"
    : hover ? "rgba(255,255,255,0.4)"
    : "rgba(255,255,255,0.12)";

  return (
    <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{
        fontSize: 8, letterSpacing: 3,
        color: "rgba(255,255,255,0.45)",
        marginBottom: 8,
        fontFamily: "'Courier New', monospace",
      }}>
        DATA INGESTION
      </div>

      <div
        onClick={() => !isLoading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); !isLoading && setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={!isLoading ? handleDrop : undefined}
        style={{
          border: `1px dashed ${borderColor}`,
          padding: "16px", textAlign: "center",
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          background: hover ? "rgba(255,255,255,0.04)" : "transparent",
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? (
          <>
            <div style={{ fontSize: 16, marginBottom: 6, color: "rgba(255,255,255,0.6)", animation: "pulse 1.5s ease-in-out infinite" }}>⟳</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", letterSpacing: 2, lineHeight: 1.8, fontFamily: "'Courier New', monospace" }}>
              PROCESSING<br />PIPELINE RUNNING...
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, marginBottom: 6, color: "rgba(255,255,255,0.45)" }}>↑</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", letterSpacing: 1, lineHeight: 1.8, fontFamily: "'Courier New', monospace" }}>
              DROP SATELLITE<br />DATASET HERE
            </div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginTop: 4, fontFamily: "'Courier New', monospace" }}>
              {ACCEPTED.toUpperCase()}
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 8, fontSize: 8, color: "#ff6b6b",
          fontFamily: "'Courier New', monospace", letterSpacing: 0.5, lineHeight: 1.6,
          padding: "6px 8px",
          border: "1px solid rgba(255,59,59,0.25)",
          background: "rgba(255,59,59,0.08)",
        }}>
          {error}
        </div>
      )}

      <input ref={inputRef} type="file" accept={ACCEPTED} style={{ display: "none" }} onChange={handleChange} />
    </div>
  );
}