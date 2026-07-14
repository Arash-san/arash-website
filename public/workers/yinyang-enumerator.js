/* Exact Yin Yang enumerator. It fixes the first cell to white, then restores
   color complements at the end. Each candidate is still checked against the
   two puzzle rules before it is counted. */
self.onmessage = (event) => {
  const { rows, cols, options = {} } = event.data;
  const started = performance.now();
  const timeoutMs = Math.min(Number(options.timeoutMs) || 3_600_000, 3_600_000);
  const patterns = 2 ** cols;
  const grid = new Array(rows).fill(0);
  const samples = [];
  let halfCount = 0;
  let nodes = 0;
  let solidSkips = 0;
  let rowSkips = 0;
  let columnSkips = 0;
  let conjectureSkips = 0;
  let stopped = false;
  let lastProgress = started;

  function transitions(pattern) {
    let count = 0;
    for (let col = 1; col < cols; col += 1) {
      if (((pattern >> col) & 1) !== ((pattern >> (col - 1)) & 1)) count += 1;
    }
    return count;
  }

  function rowsCanTouch(previous, current) {
    for (let col = 0; col < cols - 1; col += 1) {
      const pair = 3 << col;
      if ((previous & pair) === 0 && (current & pair) === 0) return false;
      if ((previous & pair) === pair && (current & pair) === pair) return false;
    }
    return true;
  }

  function edgeTransitions(col) {
    let count = 0;
    for (let row = 1; row < rows; row += 1) {
      if (((grid[row] >> col) & 1) !== ((grid[row - 1] >> col) & 1)) count += 1;
    }
    return count;
  }

  function conjectureRejects() {
    if (!options.conjecture || rows % 2 || cols % 2) return false;
    let black = 0;
    let loneBlack = null;
    let loneWhite = null;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if ((grid[row] >> col) & 1) {
          black += 1;
          loneBlack = [row, col];
        } else {
          loneWhite = [row, col];
        }
      }
    }
    const white = rows * cols - black;
    const lone = black === 1 ? loneBlack : white === 1 ? loneWhite : null;
    if (!lone) return false;
    return lone[0] === 0 || lone[1] === 0 || lone[0] === rows - 1 || lone[1] === cols - 1;
  }

  function connected(color) {
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (((grid[row] >> col) & 1) === color) cells.push(row * cols + col);
      }
    }
    if (!cells.length) return false;
    const queue = [cells[0]];
    const seen = new Set(queue);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      const row = Math.floor(cell / cols);
      const col = cell % cols;
      const neighbors = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
      for (const [nextRow, nextCol] of neighbors) {
        if (nextRow < 0 || nextCol < 0 || nextRow >= rows || nextCol >= cols) continue;
        const next = nextRow * cols + nextCol;
        if (!seen.has(next) && ((grid[nextRow] >> nextCol) & 1) === color) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen.size === cells.length;
  }

  function serialize(invert = false) {
    return grid.map((pattern) => Array.from({ length: cols }, (_, col) => {
      const value = (pattern >> col) & 1;
      return String(invert ? 1 - value : value);
    }).join(""));
  }

  function reportProgress(force = false) {
    const now = performance.now();
    if (!force && now - lastProgress < 180) return;
    lastProgress = now;
    self.postMessage({ type: "progress", nodes, solutions: halfCount * 2, elapsedMs: now - started });
  }

  function visit(row) {
    if (stopped) return;
    nodes += 1;
    if ((nodes & 8191) === 0) {
      if (performance.now() - started >= timeoutMs) {
        stopped = true;
        return;
      }
      reportProgress();
    }

    if (row === rows) {
      if (options.edgeColumns !== false && (edgeTransitions(0) > 2 || edgeTransitions(cols - 1) > 2)) {
        columnSkips += 1;
        return;
      }
      if (conjectureRejects()) {
        conjectureSkips += 1;
        return;
      }
      if (!connected(0) || !connected(1)) return;
      halfCount += 1;
      if (samples.length < 12) {
        samples.push(serialize(false));
        samples.push(serialize(true));
      }
      return;
    }

    for (let pattern = 0; pattern < patterns && !stopped; pattern += 1) {
      if (row === 0 && (pattern & 1)) continue;
      if (options.edgeRows !== false && (row === 0 || row === rows - 1) && transitions(pattern) > 2) {
        rowSkips += 1;
        continue;
      }
      if (row > 0 && !rowsCanTouch(grid[row - 1], pattern)) {
        solidSkips += 1;
        continue;
      }
      grid[row] = pattern;
      visit(row + 1);
    }
  }

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2 || cols > 21) {
    self.postMessage({ type: "error", message: "The browser enumerator accepts 2 to 21 columns." });
    return;
  }

  visit(0);
  const elapsedMs = performance.now() - started;
  reportProgress(true);
  self.postMessage({
    type: stopped ? "timeout" : "complete",
    rows,
    cols,
    solutions: halfCount * 2,
    elapsedMs,
    nodes,
    samples,
    skips: { solid: solidSkips, rows: rowSkips, columns: columnSkips, conjecture: conjectureSkips },
  });
};
