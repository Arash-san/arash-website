const cache = new Map();
let activeSearch = null;

function operationCount(rows, cols) {
  return rows === cols ? 8 : 4;
}

function mapIndex(index, rows, cols, operation) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  if (operation === 1) return (rows - 1 - row) * cols + (cols - 1 - col);
  if (operation === 2) return row * cols + (cols - 1 - col);
  if (operation === 3) return (rows - 1 - row) * cols + col;
  if (operation === 4) return col * cols + (rows - 1 - row);
  if (operation === 5) return (cols - 1 - col) * cols + row;
  if (operation === 6) return col * cols + row;
  if (operation === 7) return (cols - 1 - col) * cols + (rows - 1 - row);
  return index;
}

function transform(value, rows, cols, operation, invert = false) {
  let result = 0n;
  for (let index = 0; index < rows * cols; index += 1) {
    let bit = Number((value >> BigInt(index)) & 1n);
    if (invert) bit ^= 1;
    if (bit) result |= 1n << BigInt(mapIndex(index, rows, cols, operation));
  }
  return result;
}

function orbit(value, rows, cols) {
  const values = new Map();
  const operations = operationCount(rows, cols);
  for (let invert = 0; invert < 2; invert += 1) {
    for (let operation = 0; operation < operations; operation += 1) {
      const candidate = transform(value, rows, cols, operation, Boolean(invert));
      values.set(candidate.toString(16), candidate);
    }
  }
  return [...values.values()];
}

async function load(rows, cols) {
  const board = `${rows}x${cols}`;
  if (cache.has(board)) return cache.get(board);
  const response = await fetch(`/yinyang/orbits/${board}.bin.gz`);
  if (!response.ok) throw new Error("The exact catalog could not be loaded.");
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const signature = new TextDecoder().decode(bytes.slice(0, 8));
  if (signature !== "YYORBIT2" || bytes[8] !== rows || bytes[9] !== cols) {
    throw new Error("The catalog header is not valid.");
  }
  const count = view.getUint32(10, true);
  const total = Number(view.getBigUint64(14, true));
  const records = new Array(count);
  let offset = 22;
  for (let index = 0; index < count; index += 1) {
    records[index] = [view.getBigUint64(offset, true), bytes[offset + 8]];
    offset += 9;
  }
  const catalog = { rows, cols, records, total };
  cache.set(board, catalog);
  return catalog;
}

function upperBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function page(search, start, count) {
  const safeStart = Math.max(0, Math.min(start, Math.max(0, search.solutions - 1)));
  const end = Math.min(search.solutions, safeStart + count);
  if (!search.solutions || end <= safeStart) return [];
  const output = [];
  let matchIndex = upperBound(search.prefixes, safeStart);
  let previousTotal = matchIndex ? search.prefixes[matchIndex - 1] : 0;
  let skip = safeStart - previousTotal;
  while (matchIndex < search.recordIndices.length && safeStart + output.length < end) {
    const recordIndex = search.recordIndices[matchIndex];
    const representative = search.catalog.records[recordIndex][0];
    const matches = orbit(representative, search.rows, search.cols)
      .filter((candidate) => (candidate & search.clueMask) === search.clueValue);
    for (let index = skip; index < matches.length && safeStart + output.length < end; index += 1) {
      output.push(matches[index].toString(16));
    }
    skip = 0;
    matchIndex += 1;
  }
  return output;
}

async function search(data) {
  const { rows, cols, clues, requestId } = data;
  const started = performance.now();
  const catalog = await load(rows, cols);
  let clueMask = 0n;
  let clueValue = 0n;
  clues.forEach((cell, index) => {
    if (cell === ".") return;
    clueMask |= 1n << BigInt(index);
    if (cell === "1") clueValue |= 1n << BigInt(index);
  });

  const transformedClues = [];
  const operations = operationCount(rows, cols);
  for (let invert = 0; invert < 2; invert += 1) {
    for (let operation = 0; operation < operations; operation += 1) {
      const mask = transform(clueMask, rows, cols, operation);
      const value = transform(clueValue, rows, cols, operation, Boolean(invert)) & mask;
      transformedClues.push([mask, value]);
    }
  }

  let solutions = 0;
  const recordIndices = [];
  const prefixes = [];
  const groupSize = operations * 2;
  for (let index = 0; index < catalog.records.length; index += 1) {
    const [representative, orbitSize] = catalog.records[index];
    let symmetricMatches = 0;
    for (const [mask, value] of transformedClues) {
      if ((representative & mask) === value) symmetricMatches += 1;
    }
    const distinctMatches = symmetricMatches / (groupSize / orbitSize);
    if (distinctMatches) {
      solutions += distinctMatches;
      recordIndices.push(index);
      prefixes.push(solutions);
    }
    if (index && index % 50000 === 0) {
      self.postMessage({ type: "progress", requestId, checked: index, keySolutions: catalog.records.length, solutions, elapsedMs: performance.now() - started });
    }
  }

  activeSearch = { rows, cols, catalog, clueMask, clueValue, recordIndices, prefixes, solutions, requestId };
  const items = page(activeSearch, 0, 120);
  self.postMessage({
    type: "complete",
    requestId,
    solutions,
    keyMatches: recordIndices.length,
    checked: catalog.records.length,
    keySolutions: catalog.records.length,
    catalogSolutions: catalog.total,
    elapsedMs: performance.now() - started,
    page: { start: 0, items },
  });
}

self.onmessage = async (event) => {
  const data = event.data;
  try {
    if (data.type === "page") {
      if (!activeSearch || data.searchId !== activeSearch.requestId) return;
      self.postMessage({ type: "page", requestId: data.requestId, searchId: data.searchId, start: data.start, items: page(activeSearch, data.start, data.count) });
      return;
    }
    await search(data);
  } catch (error) {
    self.postMessage({ type: "error", requestId: data.requestId, message: error instanceof Error ? error.message : "The catalog search failed." });
  }
};
