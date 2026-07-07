// Route search orchestration: fetch fastest + alternative routes, generate
// extra candidates through scenic waypoints and quiet back streets, score
// everything, and return a ranked list within the user's detour budget.

import { osrmRoute, valhallaRoute, getScenicFeatures } from './engines.js';
import { prepareFeatures, analyzeRoute, scenicScore } from './scoring.js';
import { haversine, bbox, makeProjector } from './geo.js';

const MAX_TRIP_KM = 80;

function pickWaypoints(features, start, end, directDist, budgetFactor, prefs) {
  const pool = [];
  if (prefs.greenery) pool.push(...features.green.filter(f => f.coords && f.closed));
  if (prefs.water) pool.push(...features.water);
  if (prefs.historic) pool.push(...features.historic.filter(f => f.name));

  const scored = [];
  for (const f of pool) {
    const detour = haversine(start, f.center) + haversine(f.center, end);
    const overhead = detour / directDist;
    if (overhead > 1 + budgetFactor * 1.2) continue;
    const size = f.coords ? Math.min(f.coords.length, 60) : 5;
    const named = f.name ? 20 : 0;
    scored.push({ f, rank: size + named - overhead * 30 });
  }
  scored.sort((a, b) => b.rank - a.rank);

  const picked = [];
  for (const { f } of scored) {
    if (picked.length >= 4) break;
    if (picked.every(p => haversine(p.center, f.center) > 800)) picked.push(f);
  }
  return picked;
}

function sameShape(a, b) {
  for (const t of [0.25, 0.5, 0.75]) {
    const pa = a[Math.floor(a.length * t)];
    const pb = b[Math.floor(b.length * t)];
    if (haversine(pa, pb) > 300) return false;
  }
  return true;
}

function dedupeRoutes(routes) {
  const kept = [];
  for (const r of routes) {
    const dup = kept.find(k =>
      Math.abs(k.distance - r.distance) < 200 &&
      Math.abs(k.duration - r.duration) < 45 &&
      sameShape(k.coords, r.coords));
    if (!dup) kept.push(r);
  }
  return kept;
}

// Quiet-streets candidate: Valhalla with highways off and capped top speed
// pushes the route onto neighborhood streets, but the speed cap inflates its
// reported duration. Re-route the same corridor through OSRM via a few
// interior points to get realistic timing (and consistent road metrics).
async function quietRoute(start, end) {
  const quiet = await valhallaRoute([start, end], { use_highways: 0, top_speed: 50 });
  try {
    const pts = quiet.coords;
    const vias = [0.2, 0.4, 0.6, 0.8].map(t => pts[Math.floor(pts.length * t)]);
    const retimed = (await osrmRoute([start, ...vias, end]))[0];
    retimed.quiet = true;
    return retimed;
  } catch {
    quiet.quiet = true;
    return quiet;
  }
}

export async function findRoutes({ start, end, prefs, detourBudget }) {
  const directDist = haversine(start, end);
  if (directDist < 50) throw new Error('Start and destination are the same place.');
  if (directDist > MAX_TRIP_KM * 1000) {
    throw new Error(`Trip is too long for scenic analysis (max ~${MAX_TRIP_KM} km as the crow flies).`);
  }
  const budgetFactor = Math.max(0.05, Math.min(1.0, detourBudget ?? 0.3));

  // 1. Baseline candidates, all in parallel: fastest + OSRM alternatives, a
  // highway-limited Valhalla variant, a quiet-streets variant.
  const limitHighways = prefs.highwayUse < 0.95;
  const basePromises = [osrmRoute([start, end], { alternatives: true })];
  if (limitHighways) {
    basePromises.push(
      valhallaRoute([start, end], { use_highways: prefs.highwayUse }).then(r => [r]).catch(() => [])
    );
  }
  if (prefs.quietStreets) {
    basePromises.push(quietRoute(start, end).then(r => [r]).catch(() => []));
  }

  // 2. Scenic features for the corridor (single cached Overpass call).
  const corridorPad = Math.min(4000, Math.max(1500, directDist * 0.25));
  const box = bbox([start, end], corridorPad);
  const featuresPromise = getScenicFeatures(box)
    .catch(err => ({ green: [], water: [], historic: [], error: String(err.message || err) }));

  const [baseResults, features] = await Promise.all([Promise.all(basePromises), featuresPromise]);
  const baseRoutes = baseResults.flat();
  const fastest = baseRoutes.reduce((m, r) => (r.duration < m.duration ? r : m), baseRoutes[0]);

  // 3. Extra candidates via scenic waypoints.
  const waypoints = pickWaypoints(features, start, end, directDist, budgetFactor, prefs);
  const viaCalls = waypoints.map(wp => ({ wp, promise: osrmRoute([start, wp.center, end]) }));
  if (limitHighways && waypoints[0]) {
    viaCalls.push({
      wp: waypoints[0],
      promise: valhallaRoute([start, waypoints[0].center, end], { use_highways: prefs.highwayUse }).then(r => [r]),
    });
  }
  const viaResults = await Promise.allSettled(viaCalls.map(c => c.promise));
  const viaRoutes = [];
  viaResults.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      const r = res.value[0];
      r.via = viaCalls[i].wp.name || null;
      viaRoutes.push(r);
    }
  });

  // 4. Score all unique candidates.
  const candidates = dedupeRoutes([...baseRoutes, ...viaRoutes]);
  const project = makeProjector((start[0] + end[0]) / 2);
  const prepared = {
    project,
    green: prepareFeatures(features.green, project),
    water: prepareFeatures(features.water, project),
    historic: prepareFeatures(features.historic, project),
  };

  const maxDuration = fastest.duration * (1 + budgetFactor);
  const results = candidates.map(r => {
    const metrics = analyzeRoute(r.coords, prepared);
    return {
      coords: r.coords,
      distance: r.distance,
      duration: r.duration,
      extraSeconds: Math.round(r.duration - fastest.duration),
      highwayFraction: r.highwayFraction,
      mainRoadFraction: r.mainRoadFraction,
      roads: r.roads,
      via: r.via || null,
      quiet: !!r.quiet,
      metrics,
      score: scenicScore(metrics, r, prefs),
      isFastest: r === fastest,
      withinBudget: r.duration <= maxDuration,
    };
  });

  const scenic = results
    .filter(r => !r.isFastest && r.withinBudget)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    fastest: results.find(r => r.isFastest),
    scenic,
    featureCounts: {
      green: features.green.length,
      water: features.water.length,
      historic: features.historic.length,
    },
    overpassError: features.error || null,
  };
}
