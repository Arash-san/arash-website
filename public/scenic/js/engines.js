// Clients for the public OSM-ecosystem APIs. Everything runs in the browser;
// all of these endpoints send Access-Control-Allow-Origin: *.

import { haversine } from './geo.js';

const OSRM_BASE = 'https://router.project-osrm.org';
const VALHALLA_BASE = 'https://valhalla1.openstreetmap.de';

// Road-speed thresholds (m/s) against routing-profile speeds. OSRM's default
// car profile: motorway ~25, trunk ~23.6, primary ~18, secondary ~15.3,
// tertiary ~11, residential ~7.
const HIGHWAY_SPEED = 21;    // motorway / trunk
const MAIN_ROAD_SPEED = 14;  // anything arterial and up

function timeout(ms) { return AbortSignal.timeout(ms); }

/* ---------- OSRM ---------- */

export async function osrmRoute(points, { alternatives = false } = {}) {
  const coordStr = points.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    annotations: 'speed,distance,duration',
    alternatives: alternatives ? '3' : 'false',
  });
  const res = await fetch(`${OSRM_BASE}/route/v1/driving/${coordStr}?${params}`, { signal: timeout(20000) });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(`OSRM: ${data.code || 'no routes'} ${data.message || ''}`.trim());
  }
  return data.routes.map(normalizeOsrmRoute);
}

function normalizeOsrmRoute(r) {
  const coords = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  let fastDist = 0, mainDist = 0, totalDist = 0;
  for (const leg of r.legs || []) {
    const ann = leg.annotation;
    if (ann && ann.speed && ann.distance) {
      for (let i = 0; i < ann.distance.length; i++) {
        totalDist += ann.distance[i];
        if (ann.speed[i] >= HIGHWAY_SPEED) fastDist += ann.distance[i];
        if (ann.speed[i] >= MAIN_ROAD_SPEED) mainDist += ann.distance[i];
      }
    }
  }
  const roads = [];
  for (const leg of r.legs || []) {
    for (const step of leg.steps || []) {
      const label = step.ref || step.name;
      if (label && step.distance > 500 && !roads.includes(label)) roads.push(label);
    }
  }
  return {
    coords,
    distance: r.distance,
    duration: r.duration,
    highwayFraction: totalDist > 0 ? fastDist / totalDist : 0,
    mainRoadFraction: totalDist > 0 ? mainDist / totalDist : 0,
    roads: roads.slice(0, 6),
  };
}

/* ---------- Valhalla ---------- */

function decodePolyline6(str) {
  const coords = [];
  let index = 0, lat = 0, lon = 0;
  while (index < str.length) {
    for (const target of ['lat', 'lon']) {
      let result = 0, shift = 0, byte;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = (result & 1) ? ~(result >> 1) : (result >> 1);
      if (target === 'lat') lat += delta; else lon += delta;
    }
    coords.push([lat / 1e6, lon / 1e6]);
  }
  return coords;
}

// costingOptions e.g. { use_highways: 0 } or { use_highways: 0, top_speed: 50 }.
export async function valhallaRoute(points, costingOptions = {}) {
  const body = {
    locations: points.map(([lat, lon]) => ({ lat, lon })),
    costing: 'auto',
    costing_options: { auto: { use_tolls: 0, ...costingOptions } },
    units: 'kilometers',
  };
  const res = await fetch(`${VALHALLA_BASE}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeout(20000),
  });
  if (!res.ok) throw new Error(`Valhalla ${res.status}`);
  const data = await res.json();
  const trip = data.trip;
  if (!trip || !trip.legs || trip.legs.length === 0) throw new Error('Valhalla: no route');

  const coords = [];
  const roads = [];
  let fastDist = 0, mainDist = 0, totalDist = 0;
  for (const leg of trip.legs) {
    coords.push(...decodePolyline6(leg.shape));
    for (const m of leg.maneuvers || []) {
      const distM = (m.length || 0) * 1000;
      totalDist += distM;
      if (m.time > 0) {
        const v = distM / m.time;
        if (v >= HIGHWAY_SPEED) fastDist += distM;
        if (v >= MAIN_ROAD_SPEED) mainDist += distM;
      }
      const name = (m.street_names && m.street_names[0]) || null;
      if (name && distM > 500 && !roads.includes(name)) roads.push(name);
    }
  }
  return {
    coords,
    distance: trip.summary.length * 1000,
    duration: trip.summary.time,
    highwayFraction: totalDist > 0 ? fastDist / totalDist : 0,
    mainRoadFraction: totalDist > 0 ? mainDist / totalDist : 0,
    roads: roads.slice(0, 6),
  };
}

/* ---------- Overpass ---------- */

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const overpassCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function overpassQuery([s, w, n, e]) {
  const bb = `${s},${w},${n},${e}`;
  return `
[out:json][timeout:40];
(
  way["leisure"~"^(park|garden|nature_reserve|golf_course|common)$"](${bb});
  way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|orchard|vineyard)$"](${bb});
  way["natural"~"^(wood|scrub|grassland|heath|tree_row)$"](${bb});
  way["natural"="water"](${bb});
  way["waterway"~"^(river|canal|stream)$"](${bb});
  node["historic"](${bb});
  way["historic"](${bb});
  node["tourism"~"^(attraction|viewpoint|museum|artwork|gallery)$"](${bb});
  way["tourism"~"^(attraction|viewpoint|museum)$"](${bb});
);
out geom 6000;`;
}

function classifyFeature(tags) {
  if (!tags) return null;
  if (tags.historic || /^(attraction|viewpoint|museum|artwork|gallery)$/.test(tags.tourism || '')) {
    return 'historic';
  }
  if (tags.natural === 'water' || tags.waterway) return 'water';
  return 'green';
}

export async function getScenicFeatures(box) {
  const key = box.map(v => v.toFixed(3)).join(',');
  const hit = overpassCache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) return hit.promise;

  const promise = (async () => {
    let lastErr;
    let data = null;
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(overpassQuery(box)),
          signal: timeout(35000),
        });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        data = await res.json();
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!data) throw lastErr;

    const out = { green: [], water: [], historic: [] };
    for (const el of data.elements || []) {
      const kind = classifyFeature(el.tags);
      if (!kind) continue;
      let center = null, coords = null, closed = false;
      if (el.type === 'node') {
        center = [el.lat, el.lon];
      } else if (el.geometry && el.geometry.length > 1) {
        coords = el.geometry.map(g => [g.lat, g.lon]);
        closed = coords.length > 3 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1];
        let sLat = 0, sLon = 0;
        for (const c of coords) { sLat += c[0]; sLon += c[1]; }
        center = [sLat / coords.length, sLon / coords.length];
      } else {
        continue;
      }
      out[kind].push({ name: (el.tags && el.tags.name) || null, kind, center, coords, closed });
    }
    return out;
  })();

  overpassCache.set(key, { time: Date.now(), promise });
  promise.catch(() => overpassCache.delete(key));
  return promise;
}

/* ---------- geocoding ---------- */

function photonLabel(p) {
  const parts = [p.name];
  if (p.street) parts.push(p.housenumber ? `${p.housenumber} ${p.street}` : p.street);
  if (p.city && p.city !== p.name) parts.push(p.city);
  if (p.state) parts.push(p.state);
  return parts.filter(Boolean).join(', ');
}

// Photon (OSM) with location bias; results re-ranked into distance buckets
// so nearby matches come first while Photon's relevance order is kept
// within each bucket.
async function photonSearch(q, bias) {
  const params = new URLSearchParams({ q, limit: '10' });
  if (bias) {
    params.set('lat', bias[0]);
    params.set('lon', bias[1]);
    params.set('location_bias_scale', '0.4');
    params.set('zoom', '11');
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: timeout(10000) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const data = await res.json();
  const items = (data.features || [])
    .filter(f => f.geometry && f.properties && f.properties.name)
    .map((f, i) => {
      const [lon, lat] = f.geometry.coordinates;
      const distKm = bias ? haversine(bias, [lat, lon]) / 1000 : 0;
      const bucket = distKm < 30 ? 0 : distKm < 120 ? 1 : distKm < 600 ? 2 : 3;
      return {
        label: photonLabel(f.properties),
        lat, lon,
        distKm: Math.round(distKm),
        sortKey: bucket * 1000 + i,
      };
    });
  items.sort((a, b) => a.sortKey - b.sortKey);
  return items;
}

// ArcGIS World Geocoder suggestions — a second directory that covers street
// addresses and commercial POIs that are missing from OSM. Suggestions carry
// no coordinates; resolve on selection via resolveSuggestion().
const ARCGIS_BASE = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';

async function arcgisSuggest(q, bias) {
  const params = new URLSearchParams({ f: 'json', text: q, maxSuggestions: '5' });
  if (bias) params.set('location', `${bias[1]},${bias[0]}`);
  const res = await fetch(`${ARCGIS_BASE}/suggest?${params}`, { signal: timeout(8000) });
  if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
  const data = await res.json();
  return (data.suggestions || []).map(s => ({
    label: s.text,
    magicKey: s.magicKey,
    distKm: 0,
  }));
}

// Resolve an ArcGIS suggestion (or any free-text label) to coordinates.
export async function resolveSuggestion(item, bias) {
  if (Number.isFinite(item.lat)) return item;
  const params = new URLSearchParams({
    f: 'json', maxLocations: '1', singleLine: item.label,
  });
  if (item.magicKey) params.set('magicKey', item.magicKey);
  if (bias) params.set('location', `${bias[1]},${bias[0]}`);
  const res = await fetch(`${ARCGIS_BASE}/findAddressCandidates?${params}`, { signal: timeout(10000) });
  if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
  const data = await res.json();
  const c = data.candidates && data.candidates[0];
  if (!c) throw new Error('Could not locate this place.');
  return { ...item, lat: c.location.y, lon: c.location.x };
}

const normalizeLabel = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);

// Combined directory: OSM (Photon) merged with ArcGIS, deduplicated.
export async function geocode(q, bias) {
  const [photon, arcgis] = await Promise.all([
    photonSearch(q, bias).catch(() => []),
    arcgisSuggest(q, bias).catch(() => []),
  ]);
  const merged = [];
  const seen = new Set();
  const nearby = photon.filter(i => i.distKm < 30);
  const far = photon.filter(i => i.distKm >= 30);
  for (const item of [...nearby, ...arcgis, ...far]) {
    const key = normalizeLabel(item.label);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, 8);
}

export async function reverseGeocode(lat, lon) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
    { signal: timeout(15000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  return data.display_name || `${lat}, ${lon}`;
}
