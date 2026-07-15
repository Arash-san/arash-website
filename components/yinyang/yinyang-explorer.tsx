"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { yinYangEnumerations } from "@/lib/yinyang-enumeration-data";
import { RectangleCountMap } from "@/components/yinyang/rectangle-count-map";
import rectangleCounts from "@/public/yinyang/rectangle-counts.json";
import decisionGraphs from "@/public/yinyang/graphs/manifest.json";

type Cell = "." | "0" | "1";
type Tool = Cell;
type SearchState = "idle" | "running" | "complete" | "timeout" | "error";
type Result = { solutions: number; keyMatches?: number; checked: number; elapsedMs: number; truncated?: boolean; graphNodes?: number; graphEdges?: number };
type ResultPage = { start: number; items: string[] };
type BoardMode = "catalog" | "graph" | "live";
type BoardOption = { board: string; rows: number; cols: number; mode: BoardMode; solutions?: string };

const format = new Intl.NumberFormat("en-US");
const pageSize = 160;
const orbitLabels = ["Original", "Rotate 180", "Flip left to right", "Flip top to bottom", "Rotate 90", "Rotate 270", "Main diagonal", "Other diagonal"];
const completeBoards = new Set(yinYangEnumerations.map((record) => record.board));
const exactCounts = new Map(rectangleCounts.records.map((record) => [record.board, record.solutions]));
const graphRecords = new Map(decisionGraphs.records.map((record) => [record.board, record]));
const boardOptions: BoardOption[] = Array.from({ length: 13 }, (_, rowIndex) => rowIndex + 3).flatMap((rows) =>
  Array.from({ length: 16 - rows }, (_, colIndex) => {
    const cols = rows + colIndex;
    const board = `${rows}x${cols}`;
    const solutions = exactCounts.get(board);
    return { board, rows, cols, solutions, mode: completeBoards.has(board) ? "catalog" as const : graphRecords.has(board) ? "graph" as const : "live" as const };
  }),
);

function operationCount(rows: number, cols: number) { return rows === cols ? 8 : 4; }

function mapCell(row: number, col: number, rows: number, cols: number, operation: number) {
  if (operation === 1) return [rows - 1 - row, cols - 1 - col];
  if (operation === 2) return [row, cols - 1 - col];
  if (operation === 3) return [rows - 1 - row, col];
  if (operation === 4) return [col, rows - 1 - row];
  if (operation === 5) return [cols - 1 - col, row];
  if (operation === 6) return [col, row];
  if (operation === 7) return [cols - 1 - col, rows - 1 - row];
  return [row, col];
}

function transform(source: string[], operation: number, swap = false) {
  const rows = source.length;
  const cols = source[0]?.length ?? 0;
  const output = Array.from({ length: rows }, () => Array(cols).fill("0"));
  source.forEach((line, row) => Array.from(line).forEach((value, col) => {
    const [nextRow, nextCol] = mapCell(row, col, rows, cols, operation);
    output[nextRow][nextCol] = swap ? (value === "1" ? "0" : "1") : value;
  }));
  return output.map((line) => line.join(""));
}

function hexRows(hex: string, rows: number, cols: number) {
  const value = BigInt(`0x${hex || "0"}`);
  return Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) =>
    String(Number((value >> BigInt(row * cols + col)) & BigInt(1))),
  ).join(""));
}

function Board({ rows, clues, editable = false, tool = ".", onCell, label, small = false }: {
  rows: string[]; clues?: Cell[]; editable?: boolean; tool?: Tool; onCell?: (index: number, value: Cell) => void; label: string; small?: boolean;
}) {
  const cols = rows[0]?.length ?? 1;
  return (
    <div className={`yy-grid-board${small ? " is-small" : ""}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${rows.length}` }} role="grid" aria-label={label}>
      {rows.flatMap((line, rowIndex) => Array.from(line).map((value, colIndex) => {
        const index = rowIndex * cols + colIndex;
        const isClue = clues ? clues[index] !== "." : false;
        return editable ? (
          <button key={index} className={`yy-cell value-${value === "." ? "empty" : value} ${isClue ? "is-clue" : "is-empty"}`} onClick={() => onCell?.(index, tool)} aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}`} />
        ) : <i key={index} className={`yy-cell value-${value === "." ? "empty" : value}${isClue ? " is-source-clue" : ""}`} />;
      }))}
    </div>
  );
}

function empty(rows: number, cols: number): Cell[] { return Array(rows * cols).fill("."); }
function asRows(cells: readonly string[], rows: number, cols: number) { return Array.from({ length: rows }, (_, row) => cells.slice(row * cols, (row + 1) * cols).join("")); }

function SolutionBrowser({ rows, cols, clues, total, reportedTotal, page, selected, loading, paged, onRequest, onSelect }: {
  rows: number; cols: number; clues: Cell[]; total: number; reportedTotal?: number; page: ResultPage; selected: string; loading: boolean; paged: boolean; onRequest: (start: number) => void; onSelect: (hex: string, index: number) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const lastWheel = useRef(0);
  const [columns, setColumns] = useState(4);
  const [jump, setJump] = useState("1");

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const cardWidth = cols > rows * 1.6 ? 210 : rows <= 5 && cols <= 5 ? 118 : 150;
    const observer = new ResizeObserver(([entry]) => setColumns(Math.max(1, Math.floor(entry.contentRect.width / cardWidth))));
    observer.observe(element);
    return () => observer.disconnect();
  }, [cols, rows]);

  function move(delta: number) {
    if (!total) return;
    onRequest(Math.max(0, Math.min(total - 1, page.start + delta)));
  }

  return (
    <div className="yy-solution-browser">
      <div className="yy-solution-toolbar">
        <div><b>{total ? paged ? `${format.format(page.start + 1)} to ${format.format(Math.min(total, page.start + page.items.length))}` : `${format.format(page.items.length)} visualized` : "No matches"}</b><span>{paged ? `of ${format.format(total)} solutions` : reportedTotal !== undefined ? `from ${format.format(reportedTotal)} found during this search` : "live search examples"}</span></div>
        {paged ? <div className="yy-solution-jump">
          <button type="button" onClick={() => move(-columns)} disabled={page.start === 0}>Previous row</button>
          <form onSubmit={(event) => { event.preventDefault(); onRequest(Math.max(0, Math.min(total - 1, Number(jump || 1) - 1))); }}><label>Jump to solution<input value={jump} inputMode="numeric" onChange={(event) => setJump(event.target.value.replace(/\D/g, ""))} /></label><button type="submit" disabled={!total}>Go</button></form>
          <button type="button" onClick={() => move(columns)} disabled={!total || page.start >= total - 1}>Next row</button>
        </div> : null}
      </div>
      {paged ? <input className="yy-solution-range" aria-label="Solution position" type="range" min="0" max={Math.max(0, total - 1)} step={Math.max(1, columns)} value={Math.min(page.start, Math.max(0, total - 1))} onChange={(event) => onRequest(Number(event.target.value))} disabled={!total} /> : null}
      <div
        ref={viewport}
        className={`yy-solution-viewport${loading ? " is-loading" : ""}${paged ? "" : " is-static"}`}
        tabIndex={0}
        aria-label={paged ? "All matching solutions. Scroll to move through the complete result set." : "Solutions retained by the live constrained search."}
        onWheel={(event) => {
          if (!paged) return;
          event.preventDefault();
          const now = performance.now();
          if (now - lastWheel.current < 42) return;
          lastWheel.current = now;
          const rowsToMove = Math.max(1, Math.min(8, Math.round(Math.abs(event.deltaY) / 70)));
          move(Math.sign(event.deltaY) * columns * rowsToMove);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); move(columns); }
          if (event.key === "ArrowUp") { event.preventDefault(); move(-columns); }
          if (event.key === "PageDown") { event.preventDefault(); move(columns * 4); }
          if (event.key === "PageUp") { event.preventDefault(); move(columns * -4); }
        }}
      >
        {page.items.length ? <div className="yy-solution-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{page.items.map((hex, offset) => {
          const index = page.start + offset;
          return <button type="button" key={`${index}-${hex}`} className={hex === selected ? "is-selected" : ""} onClick={() => onSelect(hex, index)} aria-label={`Select solution ${format.format(index + 1)}`}><Board rows={hexRows(hex, rows, cols)} clues={clues} label={`Solution ${format.format(index + 1)}`} small /><span>{format.format(index + 1)}</span></button>;
        })}</div> : <div className="yy-solution-empty"><b>{loading ? "Loading the visible solution window" : "No solution matches these pieces"}</b><span>{loading ? "The catalog stays outside the page while this window is prepared." : "Remove one or more pieces and search again."}</span></div>}
      </div>
      <p className="yy-scroll-help">{paged ? "Scroll over the boards, use the keyboard, drag the position control, or jump to an exact solution number. Only the visible window is kept in the page." : "These are the solutions retained by the live constrained search. Add more pieces when a large board needs a smaller result space."}</p>
    </div>
  );
}

export function YinYangExplorer() {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [tool, setTool] = useState<Tool>("1");
  const [clues, setClues] = useState<Cell[]>(empty(3, 3));
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState<ResultPage>({ start: 0, items: [] });
  const [state, setState] = useState<SearchState>("idle");
  const [selected, setSelected] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [progress, setProgress] = useState({ checked: 0, solutions: 0, elapsedMs: 0 });
  const [error, setError] = useState("");
  const worker = useRef<Worker | null>(null);
  const searchId = useRef(0);
  const pageRequestId = useRef(0);

  function launchSearch(nextRows: number, nextCols: number, nextClues: Cell[]) {
    worker.current?.terminate();
    const board = `${nextRows}x${nextCols}`;
    const catalogMode = completeBoards.has(board);
    const graphMode = graphRecords.has(board) && !catalogMode;
    const pagedMode = catalogMode || graphMode;
    const nextWorker = new Worker(catalogMode ? "/workers/yinyang-catalog.js" : graphMode ? "/workers/yinyang-graph.js" : "/workers/yinyang-clue-solver.js");
    worker.current = nextWorker;
    const requestId = ++searchId.current;
    setState("running"); setResult(null); setPage({ start: 0, items: [] }); setSelected(""); setSelectedIndex(0); setError(""); setProgress({ checked: 0, solutions: 0, elapsedMs: 0 });
    nextWorker.onmessage = ({ data }) => {
      if (pagedMode && data.type === "page") {
        if (data.searchId !== searchId.current || data.requestId !== pageRequestId.current) return;
        setPage({ start: data.start, items: data.items });
        return;
      }
      if (data.requestId !== searchId.current) return;
      if (data.type === "progress") { setProgress({ checked: data.checked, solutions: data.solutions, elapsedMs: data.elapsedMs }); return; }
      if (data.type === "error") { setError(data.message); setState("error"); return; }
      const nextPage = pagedMode ? data.page as ResultPage : { start: 0, items: data.samples as string[] };
      setResult({ solutions: data.solutions, keyMatches: data.keyMatches, checked: data.checked, elapsedMs: data.elapsedMs, truncated: data.truncated, graphNodes: data.graphNodes, graphEdges: data.graphEdges });
      setProgress({ checked: data.checked, solutions: data.solutions, elapsedMs: data.elapsedMs });
      setPage(nextPage); setSelected(nextPage.items[0] ?? ""); setSelectedIndex(0); setState(data.type === "timeout" ? "timeout" : "complete");
    };
    nextWorker.onerror = () => { setError("The browser calculation stopped unexpectedly."); setState("error"); };
    nextWorker.postMessage({ type: "search", rows: nextRows, cols: nextCols, clues: nextClues, requestId, timeoutMs: 1_800_000 });
  }

  useEffect(() => {
    launchSearch(3, 3, empty(3, 3));
    return () => worker.current?.terminate();
  }, []);

  function chooseBoard(board: string) {
    const [nextRows, nextCols] = board.split("x").map(Number);
    const nextClues = empty(nextRows, nextCols);
    setRows(nextRows); setCols(nextCols); setClues(nextClues);
    if (completeBoards.has(board) || graphRecords.has(board)) launchSearch(nextRows, nextCols, nextClues);
    else { worker.current?.terminate(); setResult(null); setPage({ start: 0, items: [] }); setSelected(""); setSelectedIndex(0); setState("idle"); setProgress({ checked: 0, solutions: 0, elapsedMs: 0 }); setError(""); }
  }

  function requestPage(start: number) {
    if (!worker.current || !result?.solutions) return;
    const safeStart = Math.max(0, Math.min(result.solutions - 1, Math.floor(start)));
    const requestId = ++pageRequestId.current;
    worker.current.postMessage({ type: "page", requestId, searchId: searchId.current, start: safeStart, count: pageSize });
  }

  const puzzleRows = asRows(clues, rows, cols);
  const board = `${rows}x${cols}`;
  const currentOption = boardOptions.find((option) => option.board === board)!;
  const catalogMode = currentOption.mode === "catalog";
  const graphMode = currentOption.mode === "graph";
  const pagedMode = catalogMode || graphMode;
  const exactTotal = currentOption.solutions ? Number(currentOption.solutions) : undefined;
  const selectedRows = useMemo(() => selected ? hexRows(selected, rows, cols) : [], [cols, rows, selected]);
  const orbit = useMemo(() => {
    if (!selectedRows.length) return [];
    const items: { label: string; rows: string[] }[] = [];
    for (let swap = 0; swap < 2; swap += 1) for (let operation = 0; operation < operationCount(rows, cols); operation += 1) {
      const transformed = transform(selectedRows, operation, Boolean(swap));
      items.push({ label: `${orbitLabels[operation]}${swap ? ", colors exchanged" : ""}`, rows: transformed });
    }
    return items;
  }, [cols, rows, selectedRows]);

  return (
    <div className="yy-tool-wrap yy-lab">
      <header className="yy-tool-hero yy-lab-hero">
        <p>Puzzle laboratory</p>
        <h1>Yin Yang puzzle viewer</h1>
        <div><p>Edit square and rectangular boards through 15 by 15. Stored catalogs and compressed decision graphs provide complete virtual scrolling. Boards beyond the exact graph boundary use live constrained search.</p><span>91 board sizes through 15 × 15</span></div>
      </header>

      <section className="yy-catalog-workspace">
        <aside className="yy-editor-card">
          <div className="yy-card-head"><div><p className="yy-eyebrow">Puzzle editor</p><h2>{rows} by {cols}</h2></div><label>Board size<select value={board} onChange={(event) => chooseBoard(event.target.value)}>
            <optgroup label="Complete scrolling catalogs">{boardOptions.filter((option) => option.mode === "catalog").map((option) => <option key={option.board} value={option.board}>{option.rows} × {option.cols} · {format.format(Number(option.solutions))}</option>)}</optgroup>
            <optgroup label="Complete compressed graph catalogs">{boardOptions.filter((option) => option.mode === "graph").map((option) => <option key={option.board} value={option.board}>{option.rows} × {option.cols} · {format.format(Number(option.solutions))}</option>)}</optgroup>
            <optgroup label="Large live clue search">{boardOptions.filter((option) => option.mode === "live").map((option) => <option key={option.board} value={option.board}>{option.rows} × {option.cols}</option>)}</optgroup>
          </select></label></div>
          <div className={`yy-mode-note is-${currentOption.mode}`}><b>{catalogMode ? "Complete catalog" : graphMode ? "Complete decision graph" : "Large live clue search"}</b><span>{catalogMode ? "Every solution is available in the virtual scroll." : graphMode ? `${format.format(exactTotal ?? 0)} solutions share ${format.format(graphRecords.get(board)?.nodes ?? 0)} graph states. Every solution remains directly accessible.` : "This board is available in the editor. Add enough pieces to make the live search practical."}</span></div>
          <div className="yy-tool-palette" aria-label="Piece tool">{(["1", "0", "."] as Tool[]).map((value) => <button key={value} className={`${tool === value ? "is-active" : ""} value-${value === "." ? "empty" : value}`} onClick={() => setTool(value)}><i />{value === "1" ? "Black" : value === "0" ? "White" : "Remove"}</button>)}</div>
          <div className="yy-editor-board"><Board rows={puzzleRows} clues={clues} editable tool={tool} onCell={(index, value) => { const next = clues.slice(); next[index] = value; setClues(next); setResult(null); setPage({ start: 0, items: [] }); setSelected(""); setState("idle"); }} label="Editable Yin Yang puzzle" /></div>
          <div className="yy-editor-actions"><button className="yy-primary" onClick={() => launchSearch(rows, cols, clues)} disabled={state === "running"}>{state === "running" ? "Searching…" : pagedMode ? "Find all solutions" : "Search matching solutions"}</button><button onClick={() => { const next = empty(rows, cols); setClues(next); if (pagedMode) launchSearch(rows, cols, next); else { worker.current?.terminate(); setResult(null); setPage({ start: 0, items: [] }); setSelected(""); setState("idle"); } }}>{pagedMode ? "Clear and show all" : "Clear board"}</button></div>
          <div className="yy-result-meta"><span>Status <b>{state}</b></span><span>Keys checked <b>{format.format(progress.checked)}</b></span><span>Time <b>{progress.elapsedMs < 1000 ? `${progress.elapsedMs.toFixed(0)} ms` : `${(progress.elapsedMs / 1000).toFixed(2)} s`}</b></span></div>
          {state === "timeout" ? <p className="yy-warning">The 30 minute limit was reached. The visualized boards were found before the search stopped.</p> : null}
          {error ? <p className="yy-warning">{error}</p> : null}
        </aside>

        <div className="yy-solution-panel">
          <div className="yy-card-head"><div><p className="yy-eyebrow">{catalogMode ? "Complete solution catalog" : graphMode ? "Complete solution graph" : "Large board search"}</p><h2>{result ? format.format(result.solutions) : state === "running" ? format.format(progress.solutions) : exactTotal !== undefined ? format.format(exactTotal) : "Add pieces, then search"}</h2></div>{catalogMode && result?.keyMatches !== undefined ? <span>{format.format(result.keyMatches)} symmetry groups</span> : graphMode ? <span>{format.format(result?.graphNodes ?? graphRecords.get(board)?.nodes ?? 0)} shared states</span> : <span>Live constrained search</span>}</div>
          {!pagedMode && !result && state !== "running" ? <div className="yy-large-search-intro"><b>The editor is ready.</b><p>A complete graph is not available beyond 100 cells yet. Place black and white pieces, then the browser will search the remaining state space for up to 30 minutes.</p></div> : <SolutionBrowser rows={rows} cols={cols} clues={clues} total={pagedMode ? result?.solutions ?? 0 : page.items.length} reportedTotal={result?.solutions} page={page} selected={selected} loading={state === "running"} paged={pagedMode} onRequest={requestPage} onSelect={(hex, index) => { setSelected(hex); setSelectedIndex(index); }} />}
        </div>
      </section>

      <section className="yy-orbit-section">
        <header><div><p className="yy-eyebrow">Selected solution {selected ? format.format(selectedIndex + 1) : ""}</p><h2>Every symmetry operation</h2></div><p>{selected ? `All ${orbit.length} operations are shown. If two operations produce the same board, both remain visible with their own labels.` : "Select any solution above to see its complete symmetry family."}</p></header>
        {orbit.length ? <div className="yy-orbit-grid">{orbit.map((item, index) => <article key={item.label}><Board rows={item.rows} label={item.label} small /><span>{String(index + 1).padStart(2, "0")}</span><p>{item.label}</p></article>)}</div> : <div className="yy-orbit-empty">The symmetry boards will appear here after a solution is selected.</div>}
      </section>

      <RectangleCountMap />

      <footer className="yy-tool-footer"><p>The editor includes every distinct rectangle from 3 by 3 through 15 by 15. Stored catalogs cover the Flutter era sizes. Ranked decision graphs provide complete scrolling through every exact board with at most 100 cells. Larger boards continue with live clue search.</p><div><a href="https://arash-san.github.io/Yin-Yang-viewer/" target="_blank" rel="noreferrer">Open the original Flutter viewer ↗</a><a href="https://x.com/user_arash" target="_blank" rel="noreferrer">Follow me on X ↗</a></div></footer>
    </div>
  );
}
