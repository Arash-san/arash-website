// Scenic scoring: given a route polyline and the scenery around it, measure
// how much of the ride passes greenery, water, and landmarks, and combine that
// with the user's preferences into one 0 to 100 score.

import { pointSegDist2, pointInPolygon, samplePolyline, dist2 } from './geo.js';

const SAMPLE_STEP = 150;      // meters between route sample points
const RADIUS = { green: 120, water: 180, historic: 300 };
const CELL = 400;             // spatial index cell size, meters

// Precompute projected geometry and bounding boxes for a feature list, and a
// grid index so each route sample only checks the features near it.
export function prepareFeatures(features, project, kind) {
  const radius = RADIUS[kind];
  const items = features.map((f) => {
    const pCenter = project(f.center);
    let pPoly = null, bb;
    if (f.coords) {
      pPoly = f.coords.map(project);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pPoly) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      bb = [minX, minY, maxX, maxY];
    } else {
      bb = [pCenter[0], pCenter[1], pCenter[0], pCenter[1]];
    }
    return { ...f, pCenter, pPoly, bb };
  });
  const grid = new Map();
  for (const f of items) {
    const x0 = Math.floor((f.bb[0] - radius) / CELL), x1 = Math.floor((f.bb[2] + radius) / CELL);
    const y0 = Math.floor((f.bb[1] - radius) / CELL), y1 = Math.floor((f.bb[3] + radius) / CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = x * 100003 + y;
      let cell = grid.get(key);
      if (!cell) grid.set(key, (cell = []));
      cell.push(f);
    }
  }
  return { items, grid, radius };
}

function nearFeature(p, f, radius) {
  const r2 = radius * radius;
  if (!f.pPoly) return dist2(p, f.pCenter) <= r2;
  const [minX, minY, maxX, maxY] = f.bb;
  if (p[0] < minX - radius || p[0] > maxX + radius || p[1] < minY - radius || p[1] > maxY + radius) return false;
  if (f.closed && pointInPolygon(p, f.pPoly)) return true;
  for (let i = 1; i < f.pPoly.length; i++) {
    if (pointSegDist2(p, f.pPoly[i - 1], f.pPoly[i]) <= r2) return true;
  }
  return false;
}

/**
 * Analyze one route. Returns per-category coverage (share of sample points
 * near that category), the named places passed, the stretches of road that
 * run beside scenery, and the landmarks along the way.
 */
export function analyzeRoute(coords, prepared) {
  const latlon = samplePolyline(coords, SAMPLE_STEP);
  const samples = latlon.map(prepared.project);
  const n = samples.length || 1;
  const counts = { green: 0, water: 0, historic: 0 };
  const passed = { green: new Map(), water: new Map(), historic: new Map() };
  const landmarks = new Map();
  const sampleKind = new Array(samples.length).fill(null);

  samples.forEach((p, i) => {
    const key = Math.floor(p[0] / CELL) * 100003 + Math.floor(p[1] / CELL);
    for (const kind of ['green', 'water', 'historic']) {
      const { grid, radius } = prepared[kind];
      const cell = grid.get(key);
      if (!cell) continue;
      let hit = false;
      for (const f of cell) {
        if (!nearFeature(p, f, radius)) continue;
        hit = true;
        if (f.name) passed[kind].set(f.name, (passed[kind].get(f.name) || 0) + 1);
        if (kind === 'historic' && f.name && !landmarks.has(f.name)) landmarks.set(f.name, f.center);
      }
      if (!hit) continue;
      counts[kind]++;
      // Water wins over green when both are in view; landmarks are drawn as dots.
      if (kind === 'water' || (kind === 'green' && !sampleKind[i])) sampleKind[i] = kind;
    }
  });

  // Runs of consecutive samples beside the same scenery, for the map glow.
  const segments = [];
  let run = null;
  sampleKind.forEach((kind, i) => {
    if (kind && run && run.kind === kind) run.coords.push(latlon[i]);
    else {
      if (run) { run.coords.push(latlon[i]); segments.push(run); }
      run = kind ? { kind, coords: [latlon[i]] } : null;
    }
  });
  if (run) segments.push(run);

  // Name the places the route spends the most time beside first.
  const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name]) => name);
  return {
    greenCoverage: counts.green / n,
    waterCoverage: counts.water / n,
    historicCoverage: counts.historic / n,
    landmarkCount: passed.historic.size,
    highlights: { green: top(passed.green, 5), water: top(passed.water, 4), historic: top(passed.historic, 6) },
    segments: segments.filter((r) => r.coords.length > 1),
    landmarks: [...landmarks.entries()].slice(0, 30).map(([name, at]) => ({ name, at })),
  };
}

// Weighted 0 to 100 scenic score from coverage metrics and preferences.
// prefs: { greenery, water, historic, quietStreets, preferDifferent } booleans
// plus highwayUse in [0, 1], the share of the trip the user is happy to spend
// on highways. Only highway use beyond that allowance is penalized.
// uniqueness in [0, 1] is the share of the route that does not overlap the
// fastest route, since the app's point is to take a different path.
export function scenicScore(metrics, { highwayFraction, mainRoadFraction, uniqueness = 0 }, prefs) {
  const w = {
    green: prefs.greenery ? 1.0 : 0.35,
    water: prefs.water ? 0.9 : 0.2,
    historic: prefs.historic ? 0.9 : 0.15,
  };
  const positive =
    w.green * metrics.greenCoverage +
    w.water * Math.min(1, metrics.waterCoverage * 1.5) +
    w.historic * Math.min(1, metrics.historicCoverage * 2);
  const base = positive / (w.green + w.water + w.historic);
  let scenic = base * 1.6;
  if (prefs.preferDifferent) scenic += uniqueness * 0.45;
  const excess = Math.max(0, highwayFraction - (prefs.highwayUse ?? 0.2));
  let penalty = excess * 1.5;
  // Avoid-main-roads mode also penalizes time on arterials beyond a small
  // allowance, since you can rarely leave a neighborhood without one.
  if (prefs.quietStreets) penalty += Math.max(0, (mainRoadFraction ?? 0) - 0.25) * 1.0;
  return Math.round(Math.max(0, Math.min(1, scenic - penalty)) * 100);
}
