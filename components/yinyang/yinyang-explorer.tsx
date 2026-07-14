"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { complexTwenty, squareCatalogs } from "@/lib/yinyang-lab-data";

type Cell = "." | "0" | "1";
type Tool = Cell;
type SearchState = "idle" | "running" | "complete" | "timeout" | "error";
type Result = { solutions: number; samples: string[]; truncated: boolean; checked: number; elapsedMs: number; keyMatches?: number };

const format = new Intl.NumberFormat("en-US");
const orbitLabels = ["Original", "Rotate 90", "Rotate 180", "Rotate 270", "Flip left", "Flip up", "Main diagonal", "Other diagonal"];

function mapCell(row: number, col: number, size: number, operation: number) {
  if (operation === 1) return [col, size - 1 - row];
  if (operation === 2) return [size - 1 - row, size - 1 - col];
  if (operation === 3) return [size - 1 - col, row];
  if (operation === 4) return [row, size - 1 - col];
  if (operation === 5) return [size - 1 - row, col];
  if (operation === 6) return [col, row];
  if (operation === 7) return [size - 1 - col, size - 1 - row];
  return [row, col];
}

function transform(rows: string[], operation: number, swap = false) {
  const size = rows.length;
  const output = Array.from({ length: size }, () => Array(size).fill("0"));
  rows.forEach((row, r) => Array.from(row).forEach((value, c) => {
    const [nextRow, nextCol] = mapCell(r, c, size, operation);
    output[nextRow][nextCol] = swap ? (value === "1" ? "0" : "1") : value;
  }));
  return output.map((row) => row.join(""));
}

function hexRows(hex: string, size: number) {
  const value = BigInt(`0x${hex}`);
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) =>
    String(Number((value >> BigInt(row * size + col)) & BigInt(1))),
  ).join(""));
}

function Board({ rows, clues, editable = false, tool = ".", onCell, label, small = false }: {
  rows: string[]; clues?: Cell[]; editable?: boolean; tool?: Tool; onCell?: (index: number, value: Cell) => void; label: string; small?: boolean;
}) {
  const size = rows.length;
  return (
    <div className={`yy-grid-board${small ? " is-small" : ""}`} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} role="grid" aria-label={label}>
      {rows.flatMap((row, rowIndex) => Array.from(row).map((value, colIndex) => {
        const index = rowIndex * size + colIndex;
        const isClue = clues?.[index] !== ".";
        return editable ? (
          <button key={index} className={`yy-cell value-${value === "." ? "empty" : value} ${isClue ? "is-clue" : "is-empty"}`} onClick={() => onCell?.(index, tool)} aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}`} />
        ) : <i key={index} className={`yy-cell value-${value === "." ? "empty" : value}`} />;
      }))}
    </div>
  );
}

function empty(size: number): Cell[] { return Array(size * size).fill("."); }
function asRows(cells: readonly string[], size: number) { return Array.from({ length: size }, (_, row) => cells.slice(row * size, (row + 1) * size).join("")); }

export function YinYangExplorer() {
  const [size, setSize] = useState(8);
  const [tool, setTool] = useState<Tool>("1");
  const [clues, setClues] = useState<Cell[]>(empty(8));
  const [result, setResult] = useState<Result | null>(null);
  const [state, setState] = useState<SearchState>("idle");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [progress, setProgress] = useState({ checked: 0, solutions: 0, elapsedMs: 0 });
  const [error, setError] = useState("");
  const worker = useRef<Worker | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  const currentRows = useMemo(() => {
    if (result?.samples[sampleIndex]) return size <= 8 ? hexRows(result.samples[sampleIndex], size) : asRows(Array.from(result.samples[sampleIndex]), size);
    if (size === 20) return [...complexTwenty.solution];
    return asRows(clues.map((cell) => cell === "." ? "0" : cell), size);
  }, [clues, result, sampleIndex, size]);

  const orbit = useMemo(() => {
    const seen = new Set<string>();
    const items: { label: string; rows: string[] }[] = [];
    for (let swap = 0; swap < 2; swap += 1) for (let operation = 0; operation < 8; operation += 1) {
      const rows = transform(currentRows, operation, Boolean(swap));
      const key = rows.join("");
      if (!seen.has(key)) { seen.add(key); items.push({ label: `${orbitLabels[operation]}${swap ? ", colors exchanged" : ""}`, rows }); }
    }
    return items;
  }, [currentRows]);

  function chooseSize(next: number) {
    worker.current?.terminate();
    setSize(next); setClues(empty(next)); setResult(null); setState("idle"); setSampleIndex(0); setError("");
  }

  function loadTwenty() {
    worker.current?.terminate();
    setSize(20); setClues(complexTwenty.puzzle.join("").split("") as Cell[]); setResult(null); setState("idle"); setSampleIndex(0); setError("");
  }

  function run() {
    worker.current?.terminate();
    const nextWorker = new Worker(size <= 8 ? "/workers/yinyang-catalog.js" : "/workers/yinyang-clue-solver.js");
    worker.current = nextWorker;
    setState("running"); setResult(null); setSampleIndex(0); setError(""); setProgress({ checked: 0, solutions: 0, elapsedMs: 0 });
    nextWorker.onmessage = ({ data }) => {
      if (data.type === "progress") { setProgress({ checked: data.checked, solutions: data.solutions, elapsedMs: data.elapsedMs }); return; }
      if (data.type === "error") { setError(data.message); setState("error"); nextWorker.terminate(); return; }
      setResult(data); setProgress({ checked: data.checked, solutions: data.solutions, elapsedMs: data.elapsedMs }); setState(data.type); nextWorker.terminate();
    };
    nextWorker.onerror = () => { setError("The browser calculation stopped unexpectedly."); setState("error"); nextWorker.terminate(); };
    nextWorker.postMessage({ size, clues });
  }

  const puzzleRows = asRows(clues.map((cell) => cell === "." ? "." : cell), size);
  const exactCatalog = size <= 8;

  return (
    <div className="yy-tool-wrap yy-lab">
      <header className="yy-tool-hero yy-lab-hero">
        <p>Puzzle laboratory</p>
        <h1>Yin Yang puzzle viewer</h1>
        <div><p>Place black and white pieces, remove them again, and find every solution that agrees with your puzzle. The original Flutter viewer stays unchanged on GitHub. This version uses the real solution catalogs directly.</p><span>Exact catalogs from 3 by 3 through 8 by 8</span></div>
      </header>

      <section className="yy-lab-grid">
        <div className="yy-editor-card">
          <div className="yy-card-head"><div><p className="yy-eyebrow">Puzzle editor</p><h2>{size} by {size}</h2></div><label>Size<select value={size} onChange={(event) => chooseSize(Number(event.target.value))}>{Array.from({ length: 18 }, (_, index) => index + 3).map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <div className="yy-tool-palette" aria-label="Piece tool">{(["1", "0", "."] as Tool[]).map((value) => <button key={value} className={`${tool === value ? "is-active" : ""} value-${value === "." ? "empty" : value}`} onClick={() => setTool(value)}><i />{value === "1" ? "Black" : value === "0" ? "White" : "Remove"}</button>)}</div>
          <div className="yy-editor-board"><Board rows={puzzleRows} clues={clues} editable tool={tool} onCell={(index, value) => { const next = clues.slice(); next[index] = value; setClues(next); setResult(null); setState("idle"); }} label="Editable Yin Yang puzzle" /></div>
          <div className="yy-editor-actions"><button className="yy-primary" onClick={run} disabled={state === "running"}>{state === "running" ? "Searching…" : "Find all solutions"}</button><button onClick={() => { setClues(empty(size)); setResult(null); setState("idle"); }}>Clear board</button><button onClick={loadTwenty}>Load complex 20 by 20</button></div>
          <p className="yy-data-note">{exactCatalog ? "This search filters the complete precomputed catalog, so the count is exact." : "For sizes above 8, the browser solves the clues from scratch. It stops after one hour and reports a partial count if the search is still open."}</p>
        </div>

        <aside className="yy-result-card">
          <div className="yy-card-head"><div><p className="yy-eyebrow">Matching solutions</p><h2>{result ? format.format(result.solutions) : "Ready"}</h2></div>{result?.keyMatches !== undefined ? <span>{format.format(result.keyMatches)} key groups</span> : null}</div>
          <Board rows={currentRows} label="Selected Yin Yang solution" />
          <div className="yy-result-meta"><span>Status <b>{state}</b></span><span>Checked <b>{format.format(progress.checked)}</b></span><span>Time <b>{progress.elapsedMs < 1000 ? `${progress.elapsedMs.toFixed(0)} ms` : `${(progress.elapsedMs / 1000).toFixed(2)} s`}</b></span></div>
          {result?.samples.length ? <div className="yy-sample-nav"><button disabled={sampleIndex === 0} onClick={() => setSampleIndex((value) => value - 1)}>Previous</button><span>Stored solution {sampleIndex + 1} of {result.samples.length}{result.truncated ? " samples" : ""}</span><button disabled={sampleIndex === result.samples.length - 1} onClick={() => setSampleIndex((value) => value + 1)}>Next</button></div> : null}
          {state === "timeout" ? <p className="yy-warning">The one hour limit was reached. The number shown is partial.</p> : null}{error ? <p className="yy-warning">{error}</p> : null}
        </aside>
      </section>

      <section className="yy-orbit-section">
        <header><div><p className="yy-eyebrow">One key, its related boards</p><h2>The symmetry orbit</h2></div><p>Rotation, reflection, diagonal reflection, and exchanging black with white can produce up to 16 distinct boards. This is true for odd and even square sizes. Repeated boards are removed here.</p></header>
        <div className="yy-orbit-strip">{orbit.map((item, index) => <article key={item.label}><Board rows={item.rows} label={item.label} small /><span>{String(index + 1).padStart(2, "0")}</span><p>{item.label}</p></article>)}</div>
      </section>

      <section className="yy-square-record">
        <header><div><p className="yy-eyebrow">Square catalog map</p><h2>What has been calculated</h2></div><p>A key solution is the smallest representative of one symmetry orbit. The totals through 8 by 8 were checked against the original full files. Larger empty boards are not presented as solved.</p></header>
        <div className="yy-record-table"><div className="yy-record-row is-head"><span>n by n</span><span>All solutions</span><span>Key solutions</span><span>Data</span></div>{Array.from({ length: 18 }, (_, index) => index + 3).map((value) => { const item = squareCatalogs.find((record) => record.size === value); return <div className="yy-record-row" key={value}><b>{value} × {value}</b><span>{item ? format.format(item.solutions) : "Not calculated"}</span><span>{item ? format.format(item.keys) : "Not calculated"}</span><i className={item ? "is-ready" : ""}>{item ? "Exact catalog" : "Clue solver only"}</i></div>; })}</div>
      </section>

      <footer className="yy-tool-footer"><p>The 20 by 20 example has 80 empty cells and one verified solution. It was generated from a randomized valid boundary path, then checked with the clue solver.</p><div><a href="https://github.com/Arash-san/Yin-Yang-viewer" target="_blank" rel="noreferrer">Original viewer on GitHub ↗</a><a href="https://x.com/user_arash" target="_blank" rel="noreferrer">Follow me on X ↗</a></div></footer>
    </div>
  );
}
