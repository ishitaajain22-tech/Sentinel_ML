// src/components/anomaly/AnomalyList.jsx
// Left column panel: Globe + FilterBar + scrollable AnomalyCard list
// Props: anomalies, selectedId, onSelect

import GlobeViz   from "../globe/GlobeViz";
import FilterBar  from "./FilterBar";
import AnomalyCard from "./AnomalyCard";
import { useState } from "react";

export default function AnomalyList({ anomalies, selectedId, onSelect }) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch]  = useState("");

  const filtered = anomalies.filter((a) => {
    if (filter !== "ALL" && a.severity !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !a.type.toLowerCase().includes(q) &&
        !a.region.toLowerCase().includes(q) &&
        !a.id.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div
      style={{
        width:          320,
        display:        "flex",
        flexDirection:  "column",
        borderRight:    "1px solid rgba(255,255,255,0.05)",
        background:     "rgba(0,0,0,0.2)",
        height:         "100%",
      }}
    >
      {/* Globe */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <GlobeViz anomalies={anomalies} selectedId={selectedId} />
      </div>

      {/* Filters */}
      <div style={{ flexShrink: 0 }}>
        <FilterBar
          filter={filter} setFilter={setFilter}
          search={search}  setSearch={setSearch}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.map((a) => (
          <div key={a.id} className="card-fade">
            <AnomalyCard
              anomaly={a}
              selected={selectedId === a.id}
              onClick={() => onSelect(a)}
            />
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{
            padding:       32,
            textAlign:     "center",
            fontSize:      9,
            color:         "rgba(255,255,255,0.2)",
            letterSpacing: 2,
            fontFamily:    "'Courier New', monospace",
          }}>
            NO ANOMALIES MATCH FILTER
          </div>
        )}
      </div>
    </div>
  );
}
