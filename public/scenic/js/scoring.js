// Scenic scoring: given a route polyline and the corridor's scenic features,
// measure how much of the ride passes greenery / water / landmarks, and
// combine with the user's preferences into a single scenic score.

import { makeProjector, pointSegDist2, pointInPolygon, samplePolyline, dist2 } from './geo.js';

const SAMPLE_STEP = 200;      // meters between route sample points
const GREEN_RADIUS = 150;     // "next to greenery" distance
const WATER_RADIUS = 200;
const HISTORIC_RADIUS = 300;

// Precompute projected geometry + bounding boxes for a feature list.
export function prepareFeatures(features, project) {
  return features.map(f => {
    const center = project(f.center);
    let poly = null, bb = null;
    if (f.coords) {
      poly = f.coords.map(project);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of poly) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      bb = [minX, minY, maxX, maxY];
    }
    return { ...f, pCenter: center, pPoly: poly, bb };
  });
}

function nearFeature(p, f, radius) {
  const r2 = radius * radius;
  if (!f.pPoly) return dist2(p, f.pCenter) <= r2;
  const [minX, minY, maxX, maxY] = f.bb;
  if (p[0] < minX - radius || p[0] > maxX + radius ||
      p[1] < minY - radius || p[1] > maxY + radius) return false;
  if (f.closed && pointInPolygon(p, f.pPoly)) return true;
  for (let i = 1; i < f.pPoly.length; i++) {
    if (pointSegDist2(p, f.pPoly[i - 1], f.pPoly[i]) <= r2) return true;
  }
  return false;
}

// Analyze one route against prepared features. Returns per-category coverage
// (fraction of sample points near that category) and the named features passed.
export function analyzeRoute(coords, prepared) {
  const project = prepared.project;
  const samples = samplePolyline(coords, SAMPLE_STEP).map(project);
  const n = samples.length || 1;

  const counts = { green: 0, water: 0, historic: 0 };
  const passed = { green: new Set(), water: new Set(), historic: new Set() };
  const radii = { green: GREEN_RADIUS, water: WATER_RADIUS, historic: HISTORIC_RADIUS };

  for (const p of samples) {
    for (const kind of ['green', 'water', 'historic']) {
      let hit = false;
      for (const f of prepared[kind]) {
        if (nearFeature(p, f, radii[kind])) {
          hit = true;
          if (f.name) passed[kind].add(f.name);
        }
      }
      if (hit) counts[kind]++;
    }
  }

  return {
    greenCoverage: counts.green / n,
    waterCoverage: counts.water / n,
    historicCoverage: counts.historic / n,
    highlights: {
      green: [...passed.green].slice(0, 5),
      water: [...passed.water].slice(0, 4),
      historic: [...passed.historic].slice(0, 5),
    },
  };
}

// Weighted 0-100 scenic score from coverage metrics + user preferences.
// prefs: { greenery, water, historic, quietStreets, preferDifferent } booleans
// plus highwayUse in [0, 1] — the share of the trip the user is happy to spend
// on highways. Only highway use beyond that allowance is penalized.
// route fields: { highwayFraction, mainRoadFraction, uniqueness } where
// uniqueness in [0, 1] is the fraction of the route that does NOT overlap the
// fastest route — the app's whole point is to take a different path.
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
  const wSum = w.green + w.water + w.historic;
  const base = positive / wSum;                    // 0..1
  let scenic = base * 1.6;
  // Different-path mode: reward routes that diverge from the usual fastest
  // road, so the app sends you somewhere genuinely new rather than the
  // shortest street with a tiny detour.
  if (prefs.preferDifferent) scenic += uniqueness * 0.45;
  const excess = Math.max(0, highwayFraction - (prefs.highwayUse ?? 0.2));
  let penalty = excess * 1.5;
  // Avoid-main-roads mode: also penalize time on main roads (primary /
  // secondary arterials) beyond a small allowance — you can rarely leave a
  // neighborhood without touching one.
  if (prefs.quietStreets) {
    penalty += Math.max(0, (mainRoadFraction ?? 0) - 0.25) * 1.0;
  }
  return Math.round(Math.max(0, Math.min(1, scenic - penalty)) * 100);
}

