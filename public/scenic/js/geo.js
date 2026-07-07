const R_EARTH = 6371000; // meters

function toRad(d) { return d * Math.PI / 180; }

// Haversine distance in meters between [lat, lon] pairs.
export function haversine(a, b) {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}

// Equirectangular projection to local meters around a reference latitude.
// Good enough for corridor-scale (< ~100 km) distance work and much faster
// than repeated haversine trig.
export function makeProjector(refLat) {
  const cosLat = Math.cos(toRad(refLat));
  return ([lat, lon]) => [lon * 111320 * cosLat, lat * 110540];
}

export function dist2(p, q) {
  const dx = p[0] - q[0], dy = p[1] - q[1];
  return dx * dx + dy * dy;
}

// Squared distance from point p to segment [a, b] (projected coords).
export function pointSegDist2(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return dist2(p, a);
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, [a[0] + t * abx, a[1] + t * aby]);
}

// Point-in-polygon (ray casting) on projected coords.
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) &&
        p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Resample a [lat, lon] polyline to points spaced ~stepMeters apart.
export function samplePolyline(coords, stepMeters) {
  if (coords.length === 0) return [];
  const samples = [coords[0]];
  let carried = 0;
  for (let i = 1; i < coords.length; i++) {
    let a = coords[i - 1];
    const b = coords[i];
    let segLen = haversine(a, b);
    while (carried + segLen >= stepMeters) {
      const need = stepMeters - carried;
      const t = need / segLen;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      samples.push(a);
      segLen -= need;
      carried = 0;
    }
    carried += segLen;
  }
  samples.push(coords[coords.length - 1]);
  return samples;
}

export function polylineLength(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversine(coords[i - 1], coords[i]);
  return d;
}

// Bounding box [south, west, north, east] of coords, padded by padMeters.
export function bbox(coords, padMeters = 0) {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const [lat, lon] of coords) {
    if (lat < s) s = lat;
    if (lat > n) n = lat;
    if (lon < w) w = lon;
    if (lon > e) e = lon;
  }
  const dLat = padMeters / 110540;
  const dLon = padMeters / (111320 * Math.cos(toRad((s + n) / 2)));
  return [s - dLat, w - dLon, n + dLat, e + dLon];
}

