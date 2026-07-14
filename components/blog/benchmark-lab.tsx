"use client";

import { useState } from "react";

const historic = [
  { label: "Original OpenMP result", seconds: 2_077_200, note: "24 days, 1 hour" },
  { label: "CUDA before column skipper", seconds: 48.434, note: "48.434 seconds" },
  { label: "CUDA with column skipper", seconds: 9.923, note: "9.923 seconds" },
];

const skipper = [
  { label: "Before column skipper", seconds: 48.434, note: "362.2 billion candidates" },
  { label: "After column skipper", seconds: 9.923, note: "157.5 billion candidates" },
];

export function BenchmarkLab() {
  const [view, setView] = useState<"history" | "skipper">("history");
  const rows = view === "history" ? historic : skipper;
  const maxLog = Math.log10(Math.max(...rows.map((row) => row.seconds)) + 1);

  return (
    <figure className="blog-lab" aria-labelledby="benchmark-title">
      <div className="blog-lab-heading">
        <div>
          <p className="blog-kicker">Measured on 8 × 8</p>
          <h3 id="benchmark-title">The same exact 11,974,112 solutions</h3>
        </div>
        <div className="blog-view-switch" aria-label="Benchmark view">
          <button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>Full history</button>
          <button type="button" aria-pressed={view === "skipper"} onClick={() => setView("skipper")}>Skipper only</button>
        </div>
      </div>
      <div className="benchmark-chart">
        {rows.map((row) => {
          const width = Math.max(7, (Math.log10(row.seconds + 1) / maxLog) * 100);
          return (
            <div className="benchmark-row" key={row.label}>
              <div className="benchmark-label">
                <span>{row.label}</span>
                <strong>{row.note}</strong>
              </div>
              <div className="benchmark-track" aria-label={`${row.label}: ${row.note}`}>
                <span style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <figcaption>The bar length uses a logarithmic scale so days and seconds can remain visible together.</figcaption>
    </figure>
  );
}
