// Scenery from OpenFreeMap vector tiles (OpenMapTiles schema).
//
// The public Overpass servers often take 20 to 60 seconds or time out, so the
// scenery for a corridor now comes from the same CDN tiles a map would draw:
// parks, woods, meadows, lakes, rivers, and named landmarks. A corridor needs
// a few dozen small tiles, which usually arrive in one to three seconds.

const TILEJSON = 'https://tiles.openfreemap.org/planet';
const MAX_TILES = 48;
const CONCURRENCY = 8;

let tileTemplate = null;
async function template(signal) {
  if (tileTemplate) return tileTemplate;
  const res = await fetch(TILEJSON, { signal });
  if (!res.ok) throw new Error(`Tiles ${res.status}`);
  const data = await res.json();
  tileTemplate = data.tiles[0];
  return tileTemplate;
}

/* ---------- minimal protobuf + Mapbox Vector Tile decoder ---------- */

class Reader {
  constructor(buf) { this.buf = buf; this.pos = 0; }
  varint() {
    let result = 0, shift = 0, byte;
    do {
      byte = this.buf[this.pos++];
      // Multiply instead of shifting so values above 2^31 stay correct.
      result += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    return result;
  }
  bytes() {
    const len = this.varint();
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }
  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.pos += this.varint();
    else if (wire === 5) this.pos += 4;
    else throw new Error('Bad tile data');
  }
  *fields(end = this.buf.length) {
    while (this.pos < end) {
      const key = this.varint();
      yield [key >> 3, key & 7];
    }
  }
}

const utf8 = new TextDecoder();

function readValue(bytes) {
  const r = new Reader(bytes);
  let value = null;
  for (const [field, wire] of r.fields()) {
    if (field === 1) value = utf8.decode(r.bytes());
    else if (field === 2) { value = new DataView(bytes.buffer, bytes.byteOffset + r.pos, 4).getFloat32(0, true); r.pos += 4; }
    else if (field === 3) { value = new DataView(bytes.buffer, bytes.byteOffset + r.pos, 8).getFloat64(0, true); r.pos += 8; }
    else if (field === 4 || field === 5) value = r.varint();
    else if (field === 6) { const v = r.varint(); value = v % 2 ? -(v + 1) / 2 : v / 2; }
    else if (field === 7) value = Boolean(r.varint());
    else r.skip(wire);
  }
  return value;
}

function packed(bytes) {
  const r = new Reader(bytes);
  const out = [];
  while (r.pos < bytes.length) out.push(r.varint());
  return out;
}

function decodeGeometry(cmds) {
  const parts = [];
  let part = null, x = 0, y = 0, i = 0;
  while (i < cmds.length) {
    const cmd = cmds[i] & 7;
    const count = cmds[i] >> 3;
    i++;
    if (cmd === 7) { if (part && part.length) part.closed = true; continue; }
    for (let k = 0; k < count; k++) {
      const dx = cmds[i++], dy = cmds[i++];
      x += (dx >> 1) ^ -(dx & 1);
      y += (dy >> 1) ^ -(dy & 1);
      if (cmd === 1) { part = [[x, y]]; parts.push(part); }
      else part.push([x, y]);
    }
  }
  return parts;
}

const WANTED = new Set(['park', 'landcover', 'water', 'waterway', 'poi', 'water_name']);

export function decodeTile(buf) {
  const layers = {};
  const r = new Reader(buf);
  for (const [field, wire] of r.fields()) {
    if (field !== 3 || wire !== 2) { r.skip(wire); continue; }
    const lr = new Reader(r.bytes());
    let name = '', extent = 4096;
    const keys = [], values = [], rawFeatures = [];
    for (const [f, w] of lr.fields()) {
      if (f === 1) name = utf8.decode(lr.bytes());
      else if (f === 2) rawFeatures.push(lr.bytes());
      else if (f === 3) keys.push(utf8.decode(lr.bytes()));
      else if (f === 4) values.push(readValue(lr.bytes()));
      else if (f === 5) extent = lr.varint();
      else lr.skip(w);
    }
    if (!WANTED.has(name)) continue;
    layers[name] = {
      extent,
      features: rawFeatures.map(bytes => {
        const fr = new Reader(bytes);
        let tags = [], type = 0, geom = [];
        for (const [f, w] of fr.fields()) {
          if (f === 2) tags = packed(fr.bytes());
          else if (f === 3) type = fr.varint();
          else if (f === 4) geom = packed(fr.bytes());
          else fr.skip(w);
        }
        const props = {};
        for (let t = 0; t + 1 < tags.length; t += 2) props[keys[tags[t]]] = values[tags[t + 1]];
        return { type, props, geom };
      }),
    };
  }
  return layers;
}

/* ---------- tiles to scenic features ---------- */

function lonToX(lon, z) { return ((lon + 180) / 360) * 2 ** z; }
function latToY(lat, z) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}
function toLatLon(tx, ty, z, px, py, extent) {
  const n = 2 ** z;
  const lon = ((tx + px / extent) / n) * 360 - 180;
  const yy = (ty + py / extent) / n;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * yy))) * 180) / Math.PI;
  return [lat, lon];
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return a;
}

// Oklahoma's dam inventory names many farm ponds "Oknoname 02711 Reservoir".
const PLACEHOLDER_NAME = /^Oknoname\b/i;

const GREEN_LANDCOVER = new Set(['wood', 'forest', 'park', 'garden', 'meadow', 'grassland', 'heath', 'golf_course', 'grass',
  'recreation_ground', 'village_green', 'nature_reserve', 'scrub', 'wetland', 'marsh', 'wet_meadow']);
const LANDMARK_CLASS = new Set(['attraction', 'museum', 'monument', 'castle', 'art_gallery', 'historic']);
const LANDMARK_SUBCLASS = new Set(['viewpoint', 'memorial', 'monument', 'ruins', 'archaeological_site', 'castle',
  'attraction', 'museum', 'artwork', 'gallery', 'fort', 'battlefield', 'wayside_shrine', 'manor', 'city_gate']);

function classify(layer, props, type) {
  // Some tribal land boundaries are tagged as nature reserves; they cover
  // whole counties and say nothing about the view from the road.
  if (layer === 'park') return type === 3 && !/\b(nation|tribe|tribal|reservation)\b/i.test(props.name || '') ? 'green' : null;
  if (layer === 'landcover') {
    const sub = props.subclass || props.class;
    return type === 3 && (GREEN_LANDCOVER.has(sub) || props.class === 'wood' || props.class === 'wetland') ? 'green' : null;
  }
  if (layer === 'water') return type === 3 && props.class !== 'swimming_pool' ? 'water' : null;
  if (layer === 'waterway') return type === 2 && /^(river|canal)$/.test(props.class || '') ? 'water' : null;
  if (layer === 'poi') {
    return type === 1 && props.name && (LANDMARK_CLASS.has(props.class) || LANDMARK_SUBCLASS.has(props.subclass)) ? 'historic' : null;
  }
  return null;
}

function tileFeatures(layers, tx, ty, z, out, waterNames) {
  for (const [layerName, layer] of Object.entries(layers)) {
    if (layerName === 'water_name') {
      for (const f of layer.features) {
        if (f.type !== 1 || !f.props.name) continue;
        const [x, y] = decodeGeometry(f.geom)[0]?.[0] || [];
        if (x !== undefined && !PLACEHOLDER_NAME.test(f.props.name)) waterNames.push({ name: f.props.name, at: toLatLon(tx, ty, z, x, y, layer.extent) });
      }
      continue;
    }
    for (const f of layer.features) {
      const kind = classify(layerName, f.props, f.type);
      if (!kind) continue;
      const rawName = f.props['name:en'] || f.props.name || null;
      const name = rawName && !PLACEHOLDER_NAME.test(rawName) ? rawName : null;
      const parts = decodeGeometry(f.geom);
      if (f.type === 1) {
        for (const part of parts) for (const [x, y] of part) {
          out[kind].push({ name, kind, center: toLatLon(tx, ty, z, x, y, layer.extent), coords: null, closed: false });
        }
        continue;
      }
      for (const part of parts) {
        if (part.length < 2) continue;
        // Polygon holes have negative area in tile space; only outer rings matter here.
        if (f.type === 3 && ringArea(part) < 0) continue;
        const coords = part.map(([x, y]) => toLatLon(tx, ty, z, x, y, layer.extent));
        if (f.type === 3) coords.push(coords[0]);
        let sLat = 0, sLon = 0;
        for (const c of coords) { sLat += c[0]; sLon += c[1]; }
        out[kind].push({
          name, kind, coords, closed: f.type === 3,
          center: [sLat / coords.length, sLon / coords.length],
          source: layerName,
        });
      }
    }
  }
}

function tileRange(box, z) {
  const [s, w, n, e] = box;
  const x0 = Math.floor(lonToX(w, z)), x1 = Math.floor(lonToX(e, z));
  const y0 = Math.floor(latToY(n, z)), y1 = Math.floor(latToY(s, z));
  return { x0, x1, y0, y1, count: (x1 - x0 + 1) * (y1 - y0 + 1) };
}

/** Pick the most detailed zoom whose tile count stays within the limit. */
export function chooseZoom(box, maxTiles = MAX_TILES, maxZoom = 14) {
  for (let z = maxZoom; z >= 10; z--) if (tileRange(box, z).count <= maxTiles) return z;
  return 10;
}

function boxTiles(box, z) {
  const { x0, x1, y0, y1 } = tileRange(box, z);
  const jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
  return jobs;
}

/** Tiles at zoom z within padMeters of any of the polylines. */
function corridorTiles(lines, z, padMeters) {
  const keys = new Set();
  for (const coords of lines) {
    for (let i = 0; i < coords.length; i += 1) {
      const [lat, lon] = coords[i];
      const dLat = padMeters / 110540;
      const dLon = padMeters / (111320 * Math.cos((lat * Math.PI) / 180));
      for (const [a, b] of [[lat - dLat, lon - dLon], [lat - dLat, lon + dLon], [lat + dLat, lon - dLon], [lat + dLat, lon + dLon]]) {
        keys.add(`${Math.floor(lonToX(b, z))}/${Math.floor(latToY(a, z))}`);
      }
    }
  }
  return [...keys].map((k) => k.split('/').map(Number));
}

const tileCache = new Map();

async function sceneryForTiles(z, jobs, { onProgress, signal } = {}) {
  const url = await template(signal);
  const out = { green: [], water: [], historic: [] };
  const waterNames = [];
  let done = 0, failed = 0, next = 0;

  async function worker() {
    while (next < jobs.length) {
      const [x, y] = jobs[next++];
      const key = `${z}/${x}/${y}`;
      try {
        let layers = tileCache.get(key);
        if (!layers) {
          const res = await fetch(url.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal });
          if (!res.ok) throw new Error(`Tile ${res.status}`);
          layers = decodeTile(new Uint8Array(await res.arrayBuffer()));
          tileCache.set(key, layers);
        }
        tileFeatures(layers, x, y, z, out, waterNames);
      } catch (err) {
        if (signal?.aborted) throw err;
        failed++;
      }
      done++;
      onProgress?.(done, jobs.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  if (jobs.length && failed === jobs.length) throw new Error('Scenery tiles are unavailable right now.');

  // Lakes and ponds carry their names on separate label points; attach the
  // nearest label so a route can say which lake it passes.
  if (waterNames.length) {
    for (const f of out.water) {
      if (f.name || !f.closed) continue;
      let best = null, bestD = Infinity;
      for (const wn of waterNames) {
        const d = (wn.at[0] - f.center[0]) ** 2 + (wn.at[1] - f.center[1]) ** 2;
        if (d < bestD) { bestD = d; best = wn; }
      }
      if (best && bestD < 0.0004) f.name = best.name; // about 2 km
    }
  }
  return { ...filterSmall(out), zoom: z, tiles: jobs.length, failedTiles: failed };
}

// Lawns, flowerbeds, and farm ponds are everywhere and say little about how
// pretty a drive is, so tiny polygons are dropped. Rivers and canals stay.
const MIN_GREEN_M2 = 5000;
const MIN_WATER_M2 = 10000;

function areaM2(coords) {
  const lat0 = (coords[0][0] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0), ky = 110540;
  let a = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    a += (coords[j][1] * kx - coords[i][1] * kx) * (coords[j][0] * ky + coords[i][0] * ky);
  }
  return Math.abs(a / 2);
}

function filterSmall(out) {
  const keep = (f, min) => !f.closed || areaM2(f.coords) >= min;
  for (const f of [...out.green, ...out.water]) if (f.closed) f.area = areaM2(f.coords);
  return {
    green: out.green.filter((f) => keep(f, MIN_GREEN_M2)),
    water: out.water.filter((f) => keep(f, MIN_WATER_M2)),
    historic: out.historic,
  };
}

/** Scenery for a bounding box [south, west, north, east] at the best zoom that fits. */
export function sceneryForBox(box, opts = {}) {
  const z = chooseZoom(box, opts.maxTiles ?? MAX_TILES, opts.maxZoom ?? 13);
  return sceneryForTiles(z, boxTiles(box, z), opts);
}

/**
 * Full-detail scenery (zoom 14, which also carries landmarks) in a strip
 * around each candidate route. Falls back to zoom 13 for very long corridors.
 */
export function sceneryAlongRoutes(lines, opts = {}) {
  const pad = opts.padMeters ?? 350;
  let z = 14;
  let jobs = corridorTiles(lines, z, pad);
  if (jobs.length > (opts.maxTiles ?? 90)) {
    z = 13;
    jobs = corridorTiles(lines, z, pad);
  }
  return sceneryForTiles(z, jobs, opts);
}
