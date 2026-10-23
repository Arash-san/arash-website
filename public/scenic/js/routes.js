// Route search: fetch the fastest and alternative routes, add candidates
// through scenic waypoints and quiet back streets, read the scenery along
// every candidate, score them, and return a ranked list within the user's
// extra-time budget.

import { valhallaRoute, osrmRoute, getScenicFeatures } from './engines.js';
import { sceneryForBox, sceneryAlongRoutes } from './tiles.js';
import { prepareFeatures, analyzeRoute, scenicScore } from './scoring.js';
import { haversine, bbox, makeProjector, samplePolyline, pointSegDist2 } from './geo.js';

const MAX_TRIP_KM = 80;

// Share of a candidate route that does not run along the fastest route.
// 1 = a completely different path, 0 = the same roads.
function routeUniqueness(coords, fastestProjected, project) {
  const samples = samplePolyline(coords, 150).map(project);
  if (samples.length === 0 || fastestProjected.length < 2) return 0;
  const thresh2 = 35 * 35; // within 35 m counts as the same road
  let near = 0;
  for (const p of samples) {
    for (let i = 1; i < fastestProjected.length; i++) {
      if (pointSegDist2(p, fastestProjected[i - 1], fastestProjected[i]) <= thresh2) {
        near++;
        break;
      }
    }
  }
  return 1 - near / samples.length;
}

function pickWaypoints(features, start, end, directDist, budgetFactor, prefs) {
  const pool = [];
  if (prefs.greenery) pool.push(...features.green.filter((f) => f.closed && (f.area ?? 1e9) > 40000));
  if (prefs.water) pool.push(...features.water.filter((f) => !f.closed || (f.area ?? 1e9) > 40000));
  if (prefs.historic) pool.push(...features.historic.filter((f) => f.name));

  const scored = [];
  for (const f of pool) {
    const detour = haversine(start, f.center) + haversine(f.center, end);
    const overhead = detour / directDist;
    if (overhead > 1 + budgetFactor * 1.2) continue;
    const size = f.area ? Math.min(60, Math.log10(f.area) * 10) : 25;
    const named = f.name ? 20 : 0;
    scored.push({ f, rank: size + named - overhead * 30 });
  }
  scored.sort((a, b) => b.rank - a.rank);

  const picked = [];
  for (const { f } of scored) {
    if (picked.length >= 4) break;
    if (picked.every((p) => haversine(p.center, f.center) > 800)) picked.push(f);
  }
  return picked;
}

function sameShape(a, b) {
  for (const t of [0.25, 0.5, 0.75]) {
    if (haversine(a[Math.floor(a.length * t)], b[Math.floor(b.length * t)]) > 300) return false;
  }
  return true;
}

function dedupeRoutes(routes) {
  const kept = [];
  for (const r of routes) {
    const dup = kept.find((k) =>
      Math.abs(k.distance - r.distance) < 200 &&
      Math.abs(k.duration - r.duration) < 45 &&
      sameShape(k.coords, r.coords));
    if (!dup) kept.push(r);
  }
  return kept;
}

// Quiet-streets candidate: highways off and a capped top speed push the route
// onto neighborhood streets, but the cap inflates the reported time, so the
// same corridor is re-timed at normal speed through a few interior points.
async function quietRoute(start, end) {
  const quiet = (await valhallaRoute([start, end], { use_highways: 0, top_speed: 50 }))[0];
  const pts = quiet.coords;
  const vias = [0.2, 0.4, 0.6, 0.8].map((t) => pts[Math.floor(pts.length * t)]);
  try {
    const retimed = (await valhallaRoute([start, ...vias, end]))[0];
    retimed.quiet = true;
    return retimed;
  } catch {
    quiet.quiet = true;
    return quiet;
  }
}

async function corridorScenery(box) {
  try {
    return await sceneryForBox(box);
  } catch {
    // The tile CDN failed; the Overpass mirrors are slower but independent.
    try { return await getScenicFeatures(box); }
    catch (err) { return { green: [], water: [], historic: [], error: String(err.message || err) }; }
  }
}

/**
 * onStage(stage, detail) is called as the search moves through
 * 'routing', 'scenery', and 'scoring'.
 */
export async function findRoutes({ start, end, prefs, detourBudget, onStage = () => {} }) {
  const directDist = haversine(start, end);
  if (directDist < 50) throw new Error('Start and destination are the same place.');
  if (directDist > MAX_TRIP_KM * 1000) {
    throw new Error(`This trip is too long for scenic analysis. Try one under about ${MAX_TRIP_KM} km.`);
  }
  const budgetFactor = Math.max(0.05, Math.min(1.0, detourBudget ?? 0.3));

  // 1. Baseline candidates and corridor scenery, all in parallel.
  onStage('routing');
  const limitHighways = prefs.highwayUse < 0.95;
  const basePromises = [valhallaRoute([start, end], {}, { alternates: 2 }).catch(() => [])];
  if (limitHighways) {
    basePromises.push(valhallaRoute([start, end], { use_highways: prefs.highwayUse }).catch(() => []));
  }
  if (prefs.quietStreets) basePromises.push(quietRoute(start, end).then((r) => [r]).catch(() => []));

  const corridorPad = Math.min(4000, Math.max(1500, directDist * 0.25));
  const featuresPromise = corridorScenery(bbox([start, end], corridorPad));

  let baseRoutes = (await Promise.all(basePromises)).flat();
  if (baseRoutes.length === 0) {
    // Valhalla is down; the OSRM demo server is a slower second choice.
    baseRoutes = await osrmRoute([start, end], { alternatives: true }).catch(() => []);
  }
  if (baseRoutes.length === 0) {
    throw new Error('The routing service is not answering right now. Please try again in a minute.');
  }
  const fastest = baseRoutes.reduce((m, r) => (r.duration < m.duration ? r : m), baseRoutes[0]);
  const features = await featuresPromise;

  // 2. Extra candidates through scenic waypoints.
  const waypoints = pickWaypoints(features, start, end, directDist, budgetFactor, prefs);
  const viaOpts = limitHighways ? { use_highways: prefs.highwayUse } : {};
  const viaResults = await Promise.allSettled(waypoints.map((wp) => valhallaRoute([start, wp.center, end], viaOpts)));
  const viaRoutes = [];
  viaResults.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    const r = res.value[0];
    r.via = waypoints[i].name || null;
    viaRoutes.push(r);
  });
  const candidates = dedupeRoutes([...baseRoutes, ...viaRoutes]);
  const maxDuration = fastest.duration * (1 + budgetFactor);
  const inBudget = candidates.filter((r) => r === fastest || r.duration <= maxDuration);
  onStage('scenery', { candidates: inBudget.map((r) => r.coords) });

  // 3. Full-detail scenery in a strip along every candidate still in budget.
  let detail = null;
  try {
    detail = await sceneryAlongRoutes(inBudget.map((r) => r.coords), {
      onProgress: (done, total) => onStage('scenery', { done, total }),
    });
  } catch { /* fall back to the corridor scenery below */ }
  const scenery = detail && detail.green.length + detail.water.length + detail.historic.length > 0 ? detail : features;

  // 4. Score.
  onStage('scoring');
  const project = makeProjector((start[0] + end[0]) / 2);
  const prepared = {
    project,
    green: prepareFeatures(scenery.green, project, 'green'),
    water: prepareFeatures(scenery.water, project, 'water'),
    historic: prepareFeatures(scenery.historic, project, 'historic'),
  };
  const fastestProjected = fastest.coords.map(project);
  const results = inBudget.map((r) => {
    const metrics = analyzeRoute(r.coords, prepared);
    const uniqueness = r === fastest ? 0 : routeUniqueness(r.coords, fastestProjected, project);
    return {
      coords: r.coords,
      distance: r.distance,
      duration: r.duration,
      extraSeconds: Math.round(r.duration - fastest.duration),
      highwayFraction: r.highwayFraction,
      mainRoadFraction: r.mainRoadFraction,
      uniqueness,
      roads: r.roads,
      via: r.via || null,
      quiet: !!r.quiet,
      metrics,
      score: scenicScore(metrics, { ...r, uniqueness }, prefs),
      isFastest: r === fastest,
    };
  });

  const scenic = results
    .filter((r) => !r.isFastest)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // When freeways should be avoided, say so if no option in budget manages it.
  const fastestResult = results.find((r) => r.isFastest);
  const avoidingHighways = (prefs.highwayUse ?? 1) < 0.3;
  const highwayFreeOption = [fastestResult, ...scenic].some((r) => r.highwayFraction < 0.05);

  return {
    fastest: fastestResult,
    scenic,
    avoidingHighways,
    highwayUnavoidable: avoidingHighways && !highwayFreeOption,
    featureCounts: {
      green: scenery.green.length,
      water: scenery.water.length,
      historic: scenery.historic.length,
    },
    sceneryError: features.error || null,
  };
}
