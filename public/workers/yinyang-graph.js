const cache = new Map();
let activeSearch = null;

async function load(rows, cols) {
  const board = `${rows}x${cols}`;
  if (cache.has(board)) return cache.get(board);
  const response = await fetch(`/yinyang/graphs/${board}.dag.gz`);
  if (!response.ok) throw new Error("The decision graph could not be loaded.");
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const signature = new TextDecoder().decode(bytes.slice(0, 8));
  if (signature !== "YYDAG001" || bytes[8] !== rows || bytes[9] !== cols) throw new Error("The decision graph header is not valid.");
  const height = bytes[10];
  const width = bytes[11];
  const nodeCount = view.getUint32(12, true);
  const edgeCount = view.getUint32(16, true);
  const total = view.getBigUint64(20, true);
  const nodeOffset = 28;
  const edgeOffset = nodeOffset + nodeCount * 6;
  const graph = { rows, cols, height, width, nodeCount, edgeCount, total, view, nodeOffset, edgeOffset };
  cache.set(board, graph);
  return graph;
}

function nodeEdges(graph, node) {
  const offset = graph.nodeOffset + node * 6;
  return [graph.view.getUint32(offset, true), graph.view.getUint16(offset + 4, true)];
}

function edge(graph, index) {
  const offset = graph.edgeOffset + index * 14;
  return [graph.view.getUint16(offset, true), graph.view.getUint32(offset + 2, true), graph.view.getBigUint64(offset + 6, true)];
}

function clueSlices(graph, clues) {
  const slices = [];
  for (let step = 0; step < graph.height; step += 1) {
    let mask = 0;
    let value = 0;
    for (let bit = 0; bit < graph.width; bit += 1) {
      const index = graph.rows >= graph.cols ? step * graph.cols + bit : bit * graph.cols + step;
      const clue = clues[index];
      if (clue === ".") continue;
      mask |= 1 << bit;
      if (clue === "1") value |= 1 << bit;
    }
    slices.push([mask, value]);
  }
  return slices;
}

function completionCount(search, node, depth) {
  if (depth === search.graph.height) return 1n;
  if (search.memo.has(node)) return search.memo.get(node);
  const [mask, value] = search.slices[depth];
  const [start, degree] = nodeEdges(search.graph, node);
  let total = 0n;
  for (let offset = 0; offset < degree; offset += 1) {
    const [pattern, child] = edge(search.graph, start + offset);
    if ((pattern & mask) === value) total += completionCount(search, child, depth + 1);
  }
  search.memo.set(node, total);
  return total;
}

function boardHex(graph, patterns) {
  let board = 0n;
  for (let row = 0; row < graph.rows; row += 1) {
    for (let col = 0; col < graph.cols; col += 1) {
      const bit = graph.rows >= graph.cols ? (patterns[row] >> col) & 1 : (patterns[col] >> row) & 1;
      if (bit) board |= 1n << BigInt(row * graph.cols + col);
    }
  }
  return board.toString(16);
}

function unrank(search, rank) {
  let node = 0;
  const patterns = [];
  for (let depth = 0; depth < search.graph.height; depth += 1) {
    const [mask, value] = search.slices[depth];
    const [start, degree] = nodeEdges(search.graph, node);
    let selected = false;
    for (let offset = 0; offset < degree; offset += 1) {
      const [pattern, child, storedCount] = edge(search.graph, start + offset);
      if ((pattern & mask) !== value) continue;
      const count = search.hasClues ? completionCount(search, child, depth + 1) : storedCount;
      if (rank < count) {
        patterns.push(pattern);
        node = child;
        selected = true;
        break;
      }
      rank -= count;
    }
    if (!selected) throw new Error("The requested solution rank is outside the graph.");
  }
  return boardHex(search.graph, patterns);
}

function page(search, start, count) {
  const safeStart = Math.max(0, Math.min(start, Math.max(0, Number(search.total) - 1)));
  const end = Math.min(Number(search.total), safeStart + count);
  const items = [];
  for (let index = safeStart; index < end; index += 1) items.push(unrank(search, BigInt(index)));
  return { start: safeStart, items };
}

self.onmessage = async (event) => {
  const data = event.data;
  try {
    if (data.type === "page") {
      if (!activeSearch || data.searchId !== activeSearch.requestId) return;
      self.postMessage({ type: "page", requestId: data.requestId, searchId: data.searchId, ...page(activeSearch, data.start, data.count) });
      return;
    }
    const started = performance.now();
    const graph = await load(data.rows, data.cols);
    const slices = clueSlices(graph, data.clues);
    const hasClues = slices.some(([mask]) => mask !== 0);
    const search = { graph, slices, hasClues, memo: new Map(), requestId: data.requestId, total: graph.total };
    search.total = hasClues ? completionCount(search, 0, 0) : graph.total;
    activeSearch = search;
    self.postMessage({
      type: "complete",
      requestId: data.requestId,
      solutions: Number(search.total),
      checked: graph.nodeCount,
      graphNodes: graph.nodeCount,
      graphEdges: graph.edgeCount,
      elapsedMs: performance.now() - started,
      page: page(search, 0, 120),
    });
  } catch (error) {
    self.postMessage({ type: "error", requestId: data.requestId, message: error instanceof Error ? error.message : "The decision graph search failed." });
  }
};
