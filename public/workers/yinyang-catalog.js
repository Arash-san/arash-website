const cache = new Map();

function mapIndex(index, size, operation) {
  const row = Math.floor(index / size);
  const col = index % size;
  if (operation === 1) return col * size + (size - 1 - row);
  if (operation === 2) return (size - 1 - row) * size + (size - 1 - col);
  if (operation === 3) return (size - 1 - col) * size + row;
  if (operation === 4) return row * size + (size - 1 - col);
  if (operation === 5) return (size - 1 - row) * size + col;
  if (operation === 6) return col * size + row;
  if (operation === 7) return (size - 1 - col) * size + (size - 1 - row);
  return index;
}

function transform(value, size, operation, invert = false) {
  let result = 0n;
  for (let index = 0; index < size * size; index += 1) {
    let bit = Number((value >> BigInt(index)) & 1n);
    if (invert) bit ^= 1;
    if (bit) result |= 1n << BigInt(mapIndex(index, size, operation));
  }
  return result;
}

function orbit(value, size) {
  const values = new Set();
  for (let invert = 0; invert < 2; invert += 1) {
    for (let operation = 0; operation < 8; operation += 1) {
      values.add(transform(value, size, operation, Boolean(invert)).toString(16));
    }
  }
  return [...values];
}

async function load(size) {
  if (cache.has(size)) return cache.get(size);
  const response = await fetch(`/yinyang/orbits/${size}x${size}.bin.gz`);
  if (!response.ok) throw new Error("The exact catalog could not be loaded.");
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const signature = new TextDecoder().decode(bytes.slice(0, 8));
  if (signature !== "YYORBIT1" || bytes[8] !== size) throw new Error("The catalog header is not valid.");
  const count = view.getUint32(9, true);
  const total = Number(view.getBigUint64(13, true));
  const records = new Array(count);
  let offset = 21;
  for (let index = 0; index < count; index += 1) {
    records[index] = [view.getBigUint64(offset, true), bytes[offset + 8]];
    offset += 9;
  }
  const catalog = { records, total };
  cache.set(size, catalog);
  return catalog;
}

self.onmessage = async (event) => {
  const { size, clues } = event.data;
  try {
    const started = performance.now();
    const catalog = await load(size);
    let clueMask = 0n;
    let clueValue = 0n;
    clues.forEach((cell, index) => {
      if (cell === ".") return;
      clueMask |= 1n << BigInt(index);
      if (cell === "1") clueValue |= 1n << BigInt(index);
    });
    const transformedClues = [];
    for (let invert = 0; invert < 2; invert += 1) {
      for (let operation = 0; operation < 8; operation += 1) {
        transformedClues.push([
          transform(clueMask, size, operation),
          transform(clueValue, size, operation, Boolean(invert)) & transform(clueMask, size, operation),
        ]);
      }
    }
    let solutions = 0;
    let keyMatches = 0;
    const samples = [];
    for (let index = 0; index < catalog.records.length; index += 1) {
      const [representative, orbitSize] = catalog.records[index];
      let symmetricMatches = 0;
      for (const [mask, value] of transformedClues) {
        if ((representative & mask) === value) symmetricMatches += 1;
      }
      const distinctMatches = symmetricMatches / (16 / orbitSize);
      if (distinctMatches) {
        solutions += distinctMatches;
        keyMatches += 1;
        if (samples.length < 96) {
          for (const hex of orbit(representative, size)) {
            const candidate = BigInt(`0x${hex}`);
            if ((candidate & clueMask) === clueValue && !samples.includes(hex)) samples.push(hex);
            if (samples.length >= 96) break;
          }
        }
      }
      if (index && index % 50000 === 0) {
        self.postMessage({ type: "progress", checked: index, keySolutions: catalog.records.length, solutions, elapsedMs: performance.now() - started });
      }
    }
    self.postMessage({
      type: "complete",
      solutions,
      keyMatches,
      samples,
      truncated: solutions > samples.length,
      checked: catalog.records.length,
      keySolutions: catalog.records.length,
      catalogSolutions: catalog.total,
      elapsedMs: performance.now() - started,
    });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "The catalog search failed." });
  }
};
