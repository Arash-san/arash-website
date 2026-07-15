let deadline = 0;
let started = 0;
let nodes = 0;
let solutions = 0;
let samples = [];
let rows = 0;
let cols = 0;
let blocks = [];
let blocksForCell = [];
let requestId = 0;

function forbidden(board, block) {
  const [a, b, c, d] = block.map((index) => board[index]);
  if (a < 0 || b < 0 || c < 0 || d < 0) return false;
  return a === b && b === c && c === d;
}

function locallyAllowed(board, position, color) {
  const old = board[position];
  board[position] = color;
  const allowed = blocksForCell[position].every((index) => !forbidden(board, blocks[index]));
  board[position] = old;
  return allowed;
}

function canConnect(board, color, complete = false) {
  const targets = [];
  for (let index = 0; index < board.length; index += 1) if (board[index] === color) targets.push(index);
  if (!targets.length) return !complete;
  const seen = new Set([targets[0]]);
  const queue = [targets[0]];
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const row = Math.floor(index / cols);
    const col = index % cols;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) continue;
      const next = nextRow * cols + nextCol;
      if (!seen.has(next) && board[next] !== 1 - color) { seen.add(next); queue.push(next); }
    }
  }
  return targets.every((index) => seen.has(index));
}

function propagate(board) {
  let changed = true;
  while (changed) {
    if (performance.now() >= deadline) throw new Error("timeout");
    changed = false;
    for (let position = 0; position < board.length; position += 1) {
      if (board[position] !== -1) continue;
      const zero = locallyAllowed(board, position, 0);
      const one = locallyAllowed(board, position, 1);
      if (!zero && !one) return false;
      if (zero !== one) { board[position] = zero ? 0 : 1; changed = true; }
    }
  }
  return true;
}

function choose(board) {
  let best = -1;
  let score = -1;
  for (let position = 0; position < board.length; position += 1) {
    if (board[position] !== -1) continue;
    let nextScore = 0;
    for (const blockIndex of blocksForCell[position]) nextScore += blocks[blockIndex].filter((cell) => board[cell] !== -1).length;
    if (nextScore > score) { score = nextScore; best = position; }
  }
  return best;
}

function boardHex(board) {
  let value = 0n;
  for (let index = 0; index < board.length; index += 1) if (board[index]) value |= 1n << BigInt(index);
  return value.toString(16);
}

function search(input) {
  if (performance.now() >= deadline) throw new Error("timeout");
  nodes += 1;
  const board = input.slice();
  if (!propagate(board) || !canConnect(board, 0) || !canConnect(board, 1)) return;
  const position = choose(board);
  if (position < 0) {
    if (canConnect(board, 0, true) && canConnect(board, 1, true)) {
      solutions += 1;
      if (samples.length < 160) samples.push(boardHex(board));
    }
    return;
  }
  for (const color of [0, 1]) {
    if (locallyAllowed(board, position, color)) {
      const branch = board.slice();
      branch[position] = color;
      search(branch);
    }
  }
  if (nodes % 1000 === 0) self.postMessage({ type: "progress", requestId, checked: nodes, solutions, elapsedMs: performance.now() - started });
}

self.onmessage = (event) => {
  started = performance.now();
  requestId = event.data.requestId;
  rows = event.data.rows;
  cols = event.data.cols;
  deadline = started + Math.min(1_800_000, event.data.timeoutMs || 1_800_000);
  nodes = 0; solutions = 0; samples = []; blocks = []; blocksForCell = Array.from({ length: rows * cols }, () => []);
  for (let row = 0; row < rows - 1; row += 1) for (let col = 0; col < cols - 1; col += 1) {
    const block = [row * cols + col, row * cols + col + 1, (row + 1) * cols + col, (row + 1) * cols + col + 1];
    const blockIndex = blocks.push(block) - 1;
    block.forEach((cell) => blocksForCell[cell].push(blockIndex));
  }
  try {
    search(event.data.clues.map((cell) => cell === "." ? -1 : Number(cell)));
    self.postMessage({ type: "complete", requestId, solutions, samples, truncated: solutions > samples.length, checked: nodes, elapsedMs: performance.now() - started });
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") self.postMessage({ type: "timeout", requestId, solutions, samples, truncated: true, checked: nodes, elapsedMs: performance.now() - started });
    else self.postMessage({ type: "error", requestId, message: "The live clue search could not finish." });
  }
};
