"use client";

import { useEffect, useMemo, useState } from "react";

type FixedCount = {
  operation: string;
  colorExchange: boolean;
  fixedSolutions: string;
};

type RectangleCount = {
  board: string;
  rows: number;
  cols: number;
  cells: number;
  stateSpace: string;
  solutions: string;
  symmetryGroupSize: number;
  keySolutions: string;
  elapsedSeconds: number;
  fixed: FixedCount[];
};

type CountPayload = {
  generatedAt: string;
  maxCells: number;
  records: RectangleCount[];
};

type Parity = "all" | "odd" | "even" | "mixed";

const exact = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

function number(value: string) {
  return BigInt(value);
}

function parityOf(record: RectangleCount): Parity {
  if (record.rows % 2 && record.cols % 2) return "odd";
  if (record.rows % 2 === 0 && record.cols % 2 === 0) return "even";
  return "mixed";
}

export function RectangleCountMap() {
  const [payload, setPayload] = useState<CountPayload | null>(null);
  const [selectedBoard, setSelectedBoard] = useState("10x10");
  const [parity, setParity] = useState<Parity>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/yinyang/rectangle-counts.json")
      .then((response) => {
        if (!response.ok) throw new Error("The exact rectangle data could not be loaded.");
        return response.json() as Promise<CountPayload>;
      })
      .then((data) => {
        if (!active) return;
        setPayload(data);
        if (!data.records.some((record) => record.board === "10x10")) {
          setSelectedBoard(data.records[data.records.length - 1]?.board ?? "3x3");
        }
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "The exact rectangle data could not be loaded."));
    return () => { active = false; };
  }, []);

  const records = payload?.records ?? [];
  const lookup = useMemo(() => new Map(records.map((record) => [record.board, record])), [records]);
  const selected = lookup.get(selectedBoard) ?? records[records.length - 1];
  const columns = Array.from({ length: 31 }, (_, index) => index + 3);
  const rows = Array.from({ length: 8 }, (_, index) => index + 3);
  const maxFixed = selected ? selected.fixed.reduce((largest, item) => {
    const value = number(item.fixedSolutions);
    return value > largest ? value : largest;
  }, BigInt(1)) : BigInt(1);

  return (
    <section className="yy-square-record yy-rectangle-record">
      <header>
        <div><p className="yy-eyebrow">Rectangle solution map</p><h2>Every state space through 2¹⁰⁰</h2></div>
        <p>This includes odd by odd, even by even, and mixed rectangles. Each value is an exact count. A rectangle and its transpose have the same count, so each pair appears once. Key solutions combine every valid geometric symmetry with exchanging black and white.</p>
      </header>

      <div className="yy-parity-controls" aria-label="Filter rectangle parity">
        {(["all", "odd", "even", "mixed"] as Parity[]).map((value) => (
          <button key={value} type="button" aria-pressed={parity === value} onClick={() => setParity(value)}>
            {value === "all" ? "All rectangles" : value === "odd" ? "Odd by odd" : value === "even" ? "Even by even" : "Odd by even"}
          </button>
        ))}
      </div>

      {error ? <p className="yy-warning">{error}</p> : !payload ? <div className="yy-count-loading" aria-label="Loading exact rectangle counts"><i /><i /><i /></div> : (
        <div className="yy-count-layout">
          <div className="yy-count-matrix-wrap">
            <table className="yy-count-matrix">
              <thead><tr><th>m × n</th>{columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
              <tbody>{rows.map((row) => <tr key={row}><th>{row}</th>{columns.map((col) => {
                const record = col >= row ? lookup.get(`${row}x${col}`) : undefined;
                const visible = record && (parity === "all" || parityOf(record) === parity);
                return <td key={col}>{record ? <button type="button" className={`${record.board === selected?.board ? "is-selected" : ""}${visible ? "" : " is-muted"}`} onClick={() => { setSelectedBoard(record.board); if (parity !== "all" && parityOf(record) !== parity) setParity("all"); }} title={`${record.rows} by ${record.cols}: ${exact.format(number(record.solutions))} solutions`}><span>{record.rows}×{record.cols}</span><b>{compact.format(number(record.solutions))}</b></button> : null}</td>;
              })}</tr>)}</tbody>
            </table>
          </div>

          {selected ? <aside className="yy-count-detail">
            <div className="yy-count-detail-head"><div><span>Selected rectangle</span><h3>{selected.rows} × {selected.cols}</h3></div><i>{selected.cells} cells</i></div>
            <dl>
              <div><dt>State space</dt><dd>{exact.format(number(selected.stateSpace))}</dd></div>
              <div><dt>Valid solutions</dt><dd>{exact.format(number(selected.solutions))}</dd></div>
              <div><dt>Symmetry keys</dt><dd>{exact.format(number(selected.keySolutions))}</dd></div>
              <div><dt>Symmetry group</dt><dd>{selected.symmetryGroupSize} operations</dd></div>
              <div><dt>Exact calculation</dt><dd>{selected.elapsedSeconds < 1 ? `${Math.round(selected.elapsedSeconds * 1000)} ms` : `${selected.elapsedSeconds.toFixed(2)} s`}</dd></div>
            </dl>
            <div className="yy-fixed-chart"><h4>Solutions fixed by each operation</h4>{selected.fixed.map((item) => {
              const value = number(item.fixedSolutions);
              const width = value === BigInt(0) ? 0 : Math.max(2, Number((value * BigInt(10000)) / maxFixed) / 100);
              return <div key={`${item.operation}-${item.colorExchange}`}><p><span>{item.operation}{item.colorExchange ? ", colors exchanged" : ""}</span><b>{compact.format(value)}</b></p><i style={{ width: `${width}%` }} /></div>;
            })}</div>
          </aside> : null}
        </div>
      )}
    </section>
  );
}
