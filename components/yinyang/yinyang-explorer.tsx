"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CryptoBoard } from "@/components/blog/crypto-board";
import { yinYangEnumerations, yinYangSweep } from "@/lib/yinyang-enumeration-data";

type View = "modern" | "classic" | "record";
type SearchState = "idle" | "running" | "complete" | "timeout" | "stopped" | "error";
type SearchResult = {
  solutions: number;
  elapsedMs: number;
  nodes: number;
  samples: string[][];
  skips: { solid: number; rows: number; columns: number; conjecture: number };
};

const number = new Intl.NumberFormat("en-US");

function makeSolution(rows: number, cols: number) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      if (row % 2 === 0) return col === 0 ? "0" : "1";
      return col === cols - 1 ? "1" : "0";
    }).join(""),
  );
}

function transform(rows: string[], operation: string) {
  if (operation === "invert") return rows.map((row) => Array.from(row, (cell) => cell === "1" ? "0" : "1").join(""));
  if (operation === "flipHorizontal") return rows.map((row) => Array.from(row).reverse().join(""));
  if (operation === "flipVertical") return [...rows].reverse();
  if (operation === "rotate180") return [...rows].reverse().map((row) => Array.from(row).reverse().join(""));
  if (operation === "rotate90" && rows.length === rows[0].length) {
    return Array.from({ length: rows.length }, (_, row) =>
      Array.from({ length: rows.length }, (_, col) => rows[rows.length - 1 - col][row]).join(""),
    );
  }
  return rows;
}

function duration(ms: number) {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

export function YinYangExplorer() {
  const [view, setView] = useState<View>("modern");
  const [board, setBoard] = useState("5x5");
  const [operation, setOperation] = useState("original");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [edgeRows, setEdgeRows] = useState(true);
  const [edgeColumns, setEdgeColumns] = useState(true);
  const [conjecture, setConjecture] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [progress, setProgress] = useState({ nodes: 0, solutions: 0, elapsedMs: 0 });
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");
  const workerRef = useRef<Worker | null>(null);

  const selected = yinYangEnumerations.find((item) => item.board === board) ?? yinYangEnumerations[0];
  const baseRows = result?.samples[sampleIndex] ?? makeSolution(selected.rows, selected.cols);
  const displayRows = transform(baseRows, operation);
  const exactMatch = result && searchState === "complete" && result.solutions === selected.solutions;

  const maxCount = useMemo(() => Math.max(...yinYangEnumerations.map((item) => item.solutions)), []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  function stopSearch() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setSearchState("stopped");
  }

  function runSearch() {
    workerRef.current?.terminate();
    const worker = new Worker("/workers/yinyang-enumerator.js");
    workerRef.current = worker;
    setSearchState("running");
    setProgress({ nodes: 0, solutions: 0, elapsedMs: 0 });
    setResult(null);
    setSampleIndex(0);
    setError("");
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "progress") {
        setProgress({ nodes: message.nodes, solutions: message.solutions, elapsedMs: message.elapsedMs });
        return;
      }
      if (message.type === "error") {
        setError(message.message);
        setSearchState("error");
        worker.terminate();
        return;
      }
      if (message.type === "complete" || message.type === "timeout") {
        setResult(message);
        setProgress({ nodes: message.nodes, solutions: message.solutions, elapsedMs: message.elapsedMs });
        setSearchState(message.type);
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setError("The browser worker could not finish this calculation.");
      setSearchState("error");
      worker.terminate();
    };
    worker.postMessage({
      rows: selected.rows,
      cols: selected.cols,
      options: { timeoutMs: 3_600_000, edgeRows, edgeColumns, conjecture },
    });
  }

  function chooseBoard(nextBoard: string) {
    if (searchState === "running") stopSearch();
    setBoard(nextBoard);
    setOperation("original");
    setResult(null);
    setSearchState("idle");
    setSampleIndex(0);
  }

  return (
    <div className="yy-tool-wrap">
      <header className="yy-tool-hero">
        <p>Research tool 01</p>
        <h1>Yin Yang puzzle explorer</h1>
        <div>
          <p>The original viewer is preserved here. A new native explorer lets you inspect solutions, symmetry, exact counts, and the search rules from the paper.</p>
          <span>49 board sizes calculated from scratch · 0 timeouts</span>
        </div>
      </header>

      <div className="yy-view-tabs" role="tablist" aria-label="Explorer views">
        {([
          ["modern", "Modern explorer"],
          ["classic", "Original viewer"],
          ["record", "Enumeration record"],
        ] as const).map(([value, label]) => (
          <button key={value} className={view === value ? "is-active" : ""} onClick={() => setView(value)} role="tab" aria-selected={view === value}>
            {label}
          </button>
        ))}
      </div>

      {view === "classic" ? (
        <section className="yy-classic-panel">
          <div>
            <p className="yy-eyebrow">Archive</p>
            <h2>The viewer from the paper</h2>
            <p>This is the published Flutter viewer from my GitHub Pages archive. It can load the original solution catalogs from 3 by 3 through 8 by 8.</p>
            <p className="yy-classic-key"><span>Viewer password</span><code>he73gn43</code></p>
            <a href="https://arash-san.github.io/Yin-yang-tools/" target="_blank" rel="noreferrer">Open the original in a new tab ↗</a>
          </div>
          <iframe src="https://arash-san.github.io/Yin-yang-tools/" title="Original Yin Yang puzzle viewer" loading="lazy" />
        </section>
      ) : null}

      {view === "modern" ? (
        <>
          <section className="yy-modern-grid">
            <div className="yy-board-stage">
              <div className="yy-stage-head">
                <div>
                  <p className="yy-eyebrow">Solution view</p>
                  <h2>{selected.rows} by {selected.cols}</h2>
                </div>
                <label>
                  Board size
                  <select value={board} onChange={(event) => chooseBoard(event.target.value)}>
                    {yinYangEnumerations.map((item) => <option key={item.board}>{item.board}</option>)}
                  </select>
                </label>
              </div>
              <div className="yy-board-frame">
                <CryptoBoard rows={displayRows} label={`Yin Yang solution for ${selected.board}`} />
              </div>
              <div className="yy-transform-strip" aria-label="Board transformations">
                {[
                  ["original", "Original"],
                  ["rotate90", "Rotate 90"],
                  ["rotate180", "Rotate 180"],
                  ["flipHorizontal", "Flip left"],
                  ["flipVertical", "Flip up"],
                  ["invert", "Swap colors"],
                ].map(([value, label]) => (
                  <button key={value} disabled={value === "rotate90" && selected.rows !== selected.cols} className={operation === value ? "is-active" : ""} onClick={() => setOperation(value)}>{label}</button>
                ))}
              </div>
              {result?.samples.length ? (
                <div className="yy-samples">
                  <span>Calculated samples</span>
                  {result.samples.map((_, index) => <button key={index} className={sampleIndex === index ? "is-active" : ""} onClick={() => { setSampleIndex(index); setOperation("original"); }}>{index + 1}</button>)}
                </div>
              ) : null}
            </div>

            <aside className="yy-count-panel">
              <p className="yy-eyebrow">Verified record</p>
              <strong>{number.format(selected.solutions)}</strong>
              <span>exact solutions</span>
              <div className="yy-rule-list">
                <div><i>01</i><p><b>One region per color</b><span>Every black cell connects to black. Every white cell connects to white.</span></p></div>
                <div><i>02</i><p><b>No solid 2 by 2</b><span>Every 2 by 2 window contains both colors.</span></p></div>
              </div>
              <p className="yy-count-note">The displayed record came from a fresh exact calculation. The board shown before a local run is a valid constructed sample, not a random catalog entry.</p>
            </aside>
          </section>

          <section className="yy-search-lab">
            <div className="yy-search-intro">
              <p className="yy-eyebrow">Live exact calculation</p>
              <h2>Calculate this board from zero</h2>
              <p>The calculation runs in a separate browser worker. It checks every remaining candidate after the selected safe skips. A hard timer stops the worker after one hour.</p>
            </div>
            <div className="yy-skip-controls">
              <label><input type="checkbox" checked={edgeRows} onChange={(event) => setEdgeRows(event.target.checked)} disabled={searchState === "running"} /><span><b>Edge row ranges</b>Reject top and bottom rows with more than two color transitions.</span></label>
              <label><input type="checkbox" checked={edgeColumns} onChange={(event) => setEdgeColumns(event.target.checked)} disabled={searchState === "running"} /><span><b>Edge column ranges</b>Apply the same transition test to the left and right columns.</span></label>
              <label><input type="checkbox" checked={conjecture} onChange={(event) => setConjecture(event.target.checked)} disabled={searchState === "running"} /><span><b>Even edge conjecture</b>Reject a state when its only piece of one color sits on an outer edge.</span></label>
            </div>
            <div className="yy-search-console">
              <div>
                <span>Status</span>
                <strong>{searchState === "idle" ? "Ready" : searchState}</strong>
              </div>
              <div>
                <span>Search nodes</span>
                <strong>{number.format(progress.nodes)}</strong>
              </div>
              <div>
                <span>Solutions found</span>
                <strong>{number.format(progress.solutions)}</strong>
              </div>
              <div>
                <span>Elapsed</span>
                <strong>{duration(progress.elapsedMs)}</strong>
              </div>
            </div>
            <div className="yy-search-actions">
              {searchState === "running" ? <button className="yy-primary" onClick={stopSearch}>Stop calculation</button> : <button className="yy-primary" onClick={runSearch}>Calculate {selected.board}</button>}
              <span>Automatic cutoff 60 minutes</span>
              {exactMatch ? <b className="yy-pass">Exact count confirmed</b> : null}
              {searchState === "complete" && !exactMatch ? <b className="yy-fail">Count differs from the verified record</b> : null}
              {searchState === "timeout" ? <b className="yy-fail">Stopped at the one hour limit. The count is partial.</b> : null}
              {error ? <b className="yy-fail">{error}</b> : null}
            </div>
            {result ? (
              <div className="yy-skip-readout">
                <div><span>2 by 2 skips</span><b>{number.format(result.skips.solid)}</b></div>
                <div><span>Row skips</span><b>{number.format(result.skips.rows)}</b></div>
                <div><span>Column skips</span><b>{number.format(result.skips.columns)}</b></div>
                <div><span>Conjecture skips</span><b>{number.format(result.skips.conjecture)}</b></div>
              </div>
            ) : null}
          </section>

          <section className="yy-skipper-map">
            <div>
              <p className="yy-eyebrow">Search map</p>
              <h2>What each skipper removes</h2>
              <p>The first cell fixes color complement symmetry. Edge ranges remove impossible prefixes. The local rule rejects a whole branch as soon as two adjacent rows form a solid square. Connectivity remains an exact final test.</p>
            </div>
            <ol>
              <li><span>2<sup>mn</sup></span><p><b>Binary state space</b><small>Every board starts as a binary number.</small></p></li>
              <li><span>÷ 2</span><p><b>Color complement</b><small>Black and white exchange in pairs.</small></p></li>
              <li><span>edge</span><p><b>Rows and columns</b><small>Boundary transitions define valid ranges.</small></p></li>
              <li><span>2 × 2</span><p><b>Local branch skip</b><small>A solid square rejects the current prefix.</small></p></li>
              <li><span>2 BFS</span><p><b>Exact validation</b><small>Both colors must remain connected.</small></p></li>
            </ol>
          </section>
        </>
      ) : null}

      {view === "record" ? (
        <section className="yy-record">
          <header>
            <div>
              <p className="yy-eyebrow">Fresh enumeration</p>
              <h2>49 exact board records</h2>
            </div>
            <div className="yy-record-summary">
              <span><b>{yinYangSweep.completed}</b> completed</span>
              <span><b>{yinYangSweep.timedOut}</b> timeouts</span>
              <span><b>60 min</b> cutoff per board</span>
            </div>
          </header>
          <div className="yy-count-chart" aria-label="Solution count chart">
            {yinYangEnumerations.map((item) => {
              const width = 8 + Math.log10(item.solutions) / Math.log10(maxCount) * 92;
              return (
                <button key={item.board} onClick={() => { chooseBoard(item.board); setView("modern"); }} title={`${item.board}: ${number.format(item.solutions)} solutions`}>
                  <span>{item.board}</span><i style={{ width: `${width}%` }} /><b>{number.format(item.solutions)}</b>
                </button>
              );
            })}
          </div>
          <p className="yy-record-note">The chart uses a logarithmic width because the records range from 34 to almost 12 million solutions. Select any bar to inspect that board or start a new browser calculation.</p>
        </section>
      ) : null}

      <footer className="yy-tool-footer">
        <p>Built from the rules and conjectures in <a href="https://doi.org/10.1007/s11227-023-05565-w" target="_blank" rel="noreferrer">Efficient Brute-Force State Space Search for Yin-Yang Puzzle</a>.</p>
        <a href="https://github.com/Arash-san/Yin-Yang-viewer" target="_blank" rel="noreferrer">Original GitHub archive ↗</a>
      </footer>
    </div>
  );
}
