"use client";

import { useMemo, useState } from "react";

type Cell = 0 | 1;

const SIZES = [8, 20, 40] as const;

function makeBoard(size: number): Cell[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      if (row % 2 === 0) return col === 0 ? 0 : 1;
      return col === size - 1 ? 1 : 0;
    }),
  );
}

function rotate(board: Cell[][]) {
  const size = board.length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => board[size - 1 - col][row]),
  );
}

function connected(board: Cell[][], color: Cell) {
  const size = board.length;
  let start: [number, number] | null = null;
  let total = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row][col] === color) {
        total += 1;
        start ??= [row, col];
      }
    }
  }
  if (!start) return false;
  const seen = new Set<string>([start.join(":")]);
  const queue = [start];
  for (let i = 0; i < queue.length; i += 1) {
    const [row, col] = queue[i];
    for (const [nextRow, nextCol] of [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ]) {
      const key = `${nextRow}:${nextCol}`;
      if (
        nextRow >= 0 &&
        nextCol >= 0 &&
        nextRow < size &&
        nextCol < size &&
        board[nextRow][nextCol] === color &&
        !seen.has(key)
      ) {
        seen.add(key);
        queue.push([nextRow, nextCol]);
      }
    }
  }
  return seen.size === total;
}

function clearTwoByTwo(board: Cell[][]) {
  for (let row = 0; row < board.length - 1; row += 1) {
    for (let col = 0; col < board.length - 1; col += 1) {
      const sum =
        board[row][col] +
        board[row + 1][col] +
        board[row][col + 1] +
        board[row + 1][col + 1];
      if (sum === 0 || sum === 4) return false;
    }
  }
  return true;
}

export function BoardLab() {
  const [size, setSize] = useState<(typeof SIZES)[number]>(8);
  const [board, setBoard] = useState<Cell[][]>(() => makeBoard(8));
  const rules = useMemo(
    () => ({ connected: connected(board, 0) && connected(board, 1), squares: clearTwoByTwo(board) }),
    [board],
  );
  const editable = size === 8;

  const chooseSize = (next: (typeof SIZES)[number]) => {
    setSize(next);
    setBoard(makeBoard(next));
  };

  const transform = (kind: "rotate" | "flip" | "invert" | "reset") => {
    setBoard((current) => {
      if (kind === "rotate") return rotate(current);
      if (kind === "flip") return current.map((row) => [...row].reverse());
      if (kind === "invert") return current.map((row) => row.map((cell) => (cell === 0 ? 1 : 0)));
      return makeBoard(size);
    });
  };

  const toggle = (row: number, col: number) => {
    if (!editable) return;
    setBoard((current) =>
      current.map((line, rowIndex) =>
        line.map((cell, colIndex) =>
          rowIndex === row && colIndex === col ? (cell === 0 ? 1 : 0) : cell,
        ),
      ),
    );
  };

  return (
    <figure className="blog-lab" aria-labelledby="board-lab-title">
      <div className="blog-lab-heading">
        <div>
          <p className="blog-kicker">Interactive board</p>
          <h3 id="board-lab-title">The rules survive every symmetry</h3>
        </div>
        <div className="blog-size-switch" aria-label="Board size">
          {SIZES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={size === item}
              onClick={() => chooseSize(item)}
            >
              {item} × {item}
            </button>
          ))}
        </div>
      </div>

      <div className="blog-board-layout">
        <div
          className="blog-board"
          role="grid"
          aria-label={`${size} by ${size} Yin Yang solution`}
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {board.flatMap((row, rowIndex) =>
            row.map((cell, colIndex) =>
              editable ? (
                <button
                  type="button"
                  role="gridcell"
                  aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, ${cell ? "black" : "white"}`}
                  className={cell ? "is-black" : "is-white"}
                  key={`${rowIndex}:${colIndex}`}
                  onClick={() => toggle(rowIndex, colIndex)}
                />
              ) : (
                <span
                  role="gridcell"
                  aria-label={cell ? "black" : "white"}
                  className={cell ? "is-black" : "is-white"}
                  key={`${rowIndex}:${colIndex}`}
                />
              ),
            ),
          )}
        </div>

        <div className="blog-board-controls">
          <p>{editable ? "Click a cell and try to break a rule." : "This is the same construction at a larger scale."}</p>
          <div className="blog-control-row">
            <button type="button" onClick={() => transform("rotate")}>Rotate 90°</button>
            <button type="button" onClick={() => transform("flip")}>Flip</button>
            <button type="button" onClick={() => transform("invert")}>Invert colors</button>
            <button type="button" onClick={() => transform("reset")}>Reset</button>
          </div>
          <div className="blog-rule-status" aria-live="polite">
            <span data-valid={rules.connected}>Both colors connected</span>
            <span data-valid={rules.squares}>No solid 2 × 2 block</span>
          </div>
        </div>
      </div>
      <figcaption>One valid construction at three scales. The 40 by 40 view contains 1,600 cells.</figcaption>
    </figure>
  );
}
