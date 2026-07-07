import { geocode, resolveSuggestion, reverseGeocode } from './engines.js';
import { findRoutes } from './routes.js';

/* ---------- persisted state ---------- */

const STORE_KEY = 'scenic.state.v2';
const RECENTS_KEY = 'scenic.recents.v1';
const FAVS_KEY = 'scenic.favorites.v1';

function loadStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
const saved = loadStore(STORE_KEY, {});
const recents = loadStore(RECENTS_KEY, []);
const favorites = loadStore(FAVS_KEY, []);

// The app's purpose is unusual routes, so "avoid main roads", "different
// path", and avoiding freeways/highways are on by default. Apply these once
// for returning users whose saved settings predate the defaults, without
// touching their start/end, favorites, or theme.
const DEFAULTS_REV = 4;
if (Object.keys(saved).length > 0 && saved.defaultsRev !== DEFAULTS_REV) {
  if (saved.prefs) {
    saved.prefs.quietStreets = true;
    saved.prefs.preferDifferent = true;
  }
  saved.highway = 0; // avoid freeways & highways by default
}

function saveFavorites() {
  localStorage.setItem(FAVS_KEY, JSON.stringify(favorites));
}

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    prefs: state.prefs,
    defaultsRev: DEFAULTS_REV,
    highway: Number(highwayInput.value),
    budget: Number(budgetInput.value),
    theme: state.theme,
    start: state.start, end: state.end,
    startLabel: startInput.value, endLabel: endInput.value,
    view: { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() },
  }));
}

function addRecent(item) {
  const filtered = recents.filter(r => r.label !== item.label);
  filtered.unshift(item);
  recents.length = 0;
  recents.push(...filtered.slice(0, 6));
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
}

/* ---------- map + theme ---------- */

const initView = saved.view || { center: [35.2226, -97.4395], zoom: 13 }; // Norman, OK
const map = L.map('map', { zoomControl: false }).setView(initView.center, initView.zoom);
L.control.zoom({ position: 'topright' }).addTo(map);

// One tile source for both themes; dark mode dims and inverts the tiles via
// a CSS filter so the map keeps the exact same detail (street names
// included), just in muted grey.
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.getElementById('theme-btn').textContent = theme === 'dark' ? '☀️' : '🌙';
}

const startInput = document.getElementById('start-input');
const endInput = document.getElementById('end-input');
const highwayInput = document.getElementById('highway');
const budgetInput = document.getElementById('budget');

const state = {
  start: saved.start || null, end: saved.end || null,   // [lat, lon]
  myLocation: null,
  startMarker: null, endMarker: null,
  routeLayers: [],
  routes: [],
  theme: saved.theme ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  prefs: Object.assign(
    { greenery: true, water: false, historic: false, quietStreets: true, preferDifferent: true },
    saved.prefs),
};

applyTheme(state.theme);
map.on('moveend', persist);
document.getElementById('theme-btn').addEventListener('click', () => {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  persist();
});

function makeMarker(latlng, kind) {
  const color = kind === 'start' ? '#2f7d32' : '#c62828';
  return L.circleMarker(latlng, {
    radius: 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1,
  }).addTo(map);
}

function setPoint(kind, lat, lon, label) {
  state[kind] = [lat, lon];
  const mk = kind + 'Marker';
  if (state[mk]) state[mk].remove();
  state[mk] = makeMarker([lat, lon], kind);
  if (label) document.getElementById(kind + '-input').value = label;
  persist();
}

// Restore saved points; fall back to coordinates if the label was lost.
const coordLabel = p => `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`;
if (state.start) setPoint('start', state.start[0], state.start[1], saved.startLabel || coordLabel(state.start));
if (state.end) setPoint('end', state.end[0], state.end[1], saved.endLabel || coordLabel(state.end));

// Right-click / long-press to set points.
map.on('contextmenu', async (e) => {
  const kind = !state.start ? 'start' : 'end';
  const { lat, lng } = e.latlng;
  setPoint(kind, lat, lng, coordLabel([lat, lng]));
  try {
    const label = await reverseGeocode(lat, lng);
    document.getElementById(kind + '-input').value = shortLabel(label);
    persist();
  } catch { /* coordinates already shown */ }
});

function shortLabel(s) { return s.split(',').slice(0, 3).join(','); }

function biasPoint() {
  if (state.myLocation) return state.myLocation;
  const c = map.getCenter();
  return [c.lat, c.lng];
}

/* ---------- geocoding: autocomplete + recents ---------- */

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Saved places matching the typed text (matches name or label substring).
function matchingFavorites(q) {
  const needle = q.toLowerCase();
  return favorites
    .filter(f => !needle || f.name.toLowerCase().includes(needle) || f.label.toLowerCase().includes(needle))
    .map(f => ({ label: f.name, sub: f.label, lat: f.lat, lon: f.lon, distKm: 0, fav: true }));
}

function renderSuggestions(box, items, kind, isRecent) {
  box.innerHTML = '';
  if (!items.length) { box.style.display = 'none'; return; }
  for (const r of items) {
    const div = document.createElement('div');
    const dist = r.distKm > 1 ? `<span class="dist">${r.distKm} km</span>` : '';
    const tag = r.fav ? '<span class="fav-tag">⭐</span>'
      : isRecent ? '<span class="recent-tag">↺</span>' : '';
    div.innerHTML = `${tag}${escapeHtml(shortLabel(r.label))}${dist}`;
    div.addEventListener('click', async () => {
      box.style.display = 'none';
      let item = r;
      if (!Number.isFinite(item.lat)) {
        // ArcGIS suggestion: resolve to coordinates on selection.
        setStatus('Locating "' + shortLabel(item.label) + '"…');
        try {
          item = await resolveSuggestion(item, biasPoint());
          setStatus('');
        } catch (err) {
          return setStatus(String(err.message || err), true);
        }
      }
      setPoint(kind, item.lat, item.lon, shortLabel(item.label));
      if (!item.fav) addRecent({ label: item.label, lat: item.lat, lon: item.lon, distKm: 0 });
      map.panTo([item.lat, item.lon]);
    });
    box.appendChild(div);
  }
  box.style.display = 'block';
}

function wireAutocomplete(kind) {
  const input = document.getElementById(kind + '-input');
  const box = document.getElementById(kind + '-suggestions');
  let timer = null;

  input.addEventListener('focus', () => {
    if (input.value.trim().length < 3) {
      renderSuggestions(box, [...matchingFavorites(''), ...recents], kind, true);
    }
  });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) {
      renderSuggestions(box, [...matchingFavorites(q), ...recents], kind, true);
      return;
    }
    timer = setTimeout(async () => {
      try {
        const results = await geocode(q, biasPoint());
        renderSuggestions(box, [...matchingFavorites(q), ...results], kind, false);
      } catch { box.style.display = 'none'; }
    }, 350);
  });
  input.addEventListener('blur', () => setTimeout(() => { box.style.display = 'none'; }, 250));
}
wireAutocomplete('start');
wireAutocomplete('end');

// ⭐ Save the current start/end point as a named place, so complexes and
// buildings missing from the map directories (e.g. apartment communities)
// become searchable after saving them once.
function wireSaveButton(kind) {
  document.getElementById(kind + '-save').addEventListener('click', () => {
    const point = state[kind];
    if (!point) return setStatus('Set a ' + (kind === 'start' ? 'start' : 'destination') + ' point first, then save it.', true);
    const current = document.getElementById(kind + '-input').value;
    const name = window.prompt('Name this place (e.g. "Home", "Overlook"):', current);
    if (!name) return;
    const trimmed = name.trim();
    const existing = favorites.findIndex(f => f.name.toLowerCase() === trimmed.toLowerCase());
    if (existing >= 0) favorites.splice(existing, 1);
    favorites.unshift({ name: trimmed, label: current, lat: point[0], lon: point[1] });
    if (favorites.length > 20) favorites.length = 20;
    saveFavorites();
    setStatus(`Saved ⭐ "${trimmed}" — it will show up when you search.`);
  });
}
wireSaveButton('start');
wireSaveButton('end');

document.getElementById('locate-btn').addEventListener('click', () => {
  if (!navigator.geolocation) return setStatus('Geolocation not supported by this browser.', true);
  setStatus('Locating…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    state.myLocation = [lat, lon];
    setPoint('start', lat, lon, 'My location');
    map.setView([lat, lon], 14);
    setStatus('');
    try {
      const label = await reverseGeocode(lat, lon);
      startInput.value = shortLabel(label);
      persist();
    } catch { /* keep "My location" */ }
  }, (err) => {
    setStatus('Could not get location: ' + err.message +
      (location.protocol === 'http:' ? ' (geolocation needs HTTPS)' : ''), true);
  }, { enableHighAccuracy: true, timeout: 12000 });
});

document.getElementById('swap-btn').addEventListener('click', () => {
  const [s, e] = [state.start, state.end];
  const [sl, el] = [startInput.value, endInput.value];
  if (state.startMarker) state.startMarker.remove();
  if (state.endMarker) state.endMarker.remove();
  state.start = state.end = state.startMarker = state.endMarker = null;
  if (e) setPoint('start', e[0], e[1], el);
  if (s) setPoint('end', s[0], s[1], sl);
  startInput.value = el;
  endInput.value = sl;
  persist();
});

/* ---------- panel collapse: button, tap, and drag ---------- */

const panel = document.getElementById('panel');
const handle = document.getElementById('panel-handle');

function setCollapsed(collapsed) {
  panel.classList.toggle('collapsed', collapsed);
}
document.getElementById('collapse-btn').addEventListener('click',
  () => setCollapsed(!panel.classList.contains('collapsed')));

// The handle supports both tap (toggle) and drag (down = hide, up = show).
let dragStartY = null, dragMoved = false;
handle.addEventListener('pointerdown', (e) => {
  dragStartY = e.clientY;
  dragMoved = false;
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener('pointermove', (e) => {
  if (dragStartY === null) return;
  const dy = e.clientY - dragStartY;
  if (Math.abs(dy) > 12) dragMoved = true;
  if (dy > 36) { setCollapsed(true); dragStartY = null; }
  else if (dy < -36) { setCollapsed(false); dragStartY = null; }
});
handle.addEventListener('pointerup', () => {
  if (dragStartY !== null && !dragMoved) {
    setCollapsed(!panel.classList.contains('collapsed'));
  }
  dragStartY = null;
});

/* ---------- preferences ---------- */

document.querySelectorAll('.chip').forEach(chip => {
  const pref = chip.dataset.pref;
  chip.classList.toggle('active', !!state.prefs[pref]);
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    state.prefs[pref] = chip.classList.contains('active');
    persist();
  });
});

function highwayLabel(v) {
  if (v === 0) return 'avoid';
  if (v >= 100) return 'no limit';
  return `up to ${v}%`;
}
function updateHighwayNote(v) {
  const note = document.getElementById('highway-note');
  if (!note) return;
  note.textContent = v === 0
    ? "Only used if it's the only way within your extra-time budget."
    : v >= 100 ? 'Freeways and highways are used freely.'
    : 'A little freeway/highway is allowed to save time.';
}
if (Number.isFinite(saved.highway)) highwayInput.value = saved.highway;
if (Number.isFinite(saved.budget)) budgetInput.value = saved.budget;
document.getElementById('highway-label').textContent = highwayLabel(Number(highwayInput.value));
updateHighwayNote(Number(highwayInput.value));
document.getElementById('budget-label').textContent = `+${budgetInput.value}%`;

highwayInput.addEventListener('input', () => {
  document.getElementById('highway-label').textContent = highwayLabel(Number(highwayInput.value));
  updateHighwayNote(Number(highwayInput.value));
  persist();
});
budgetInput.addEventListener('input', () => {
  document.getElementById('budget-label').textContent = `+${budgetInput.value}%`;
  persist();
});

/* ---------- routing ---------- */

const goBtn = document.getElementById('go-btn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'error' : '';
}

function fmtTime(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
function fmtDist(m) {
  const mi = m / 1609.34;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

goBtn.addEventListener('click', async () => {
  if (!state.start || !state.end) {
    return setStatus('Set both a start and a destination first.', true);
  }
  goBtn.disabled = true;
  setStatus('Finding routes and checking scenery along each one…');
  resultsEl.innerHTML = '';
  clearRoutes();
  try {
    const data = await findRoutes({
      start: state.start, end: state.end,
      prefs: { ...state.prefs, highwayUse: Number(highwayInput.value) / 100 },
      detourBudget: Number(budgetInput.value) / 100,
    });
    renderResults(data);
  } catch (err) {
    const raw = String(err.message || err);
    // Translate low-level fetch/abort errors into something actionable.
    const friendly = /timed out|timeout|aborted|network|failed to fetch/i.test(raw)
      ? 'The map service took too long to respond. Please try again in a moment.'
      : raw;
    setStatus(friendly, true);
  } finally {
    goBtn.disabled = false;
  }
});

function clearRoutes() {
  state.routeLayers.forEach(l => l.remove());
  state.routeLayers = [];
  state.routes = [];
}

// Google Maps directions link that approximates this route by pinning a few
// intermediate waypoints along it. (Apple Maps and Waze URL schemes don't
// support via-waypoints, so those links carry start/destination only.)
function googleMapsUrl(route) {
  const pts = route.coords;
  const n = Math.min(5, Math.max(1, Math.floor(pts.length / 40)));
  const waypoints = [];
  for (let i = 1; i <= n; i++) {
    const p = pts[Math.floor(pts.length * i / (n + 1))];
    waypoints.push(`${p[0].toFixed(5)},${p[1].toFixed(5)}`);
  }
  const params = new URLSearchParams({
    api: '1',
    origin: `${pts[0][0].toFixed(5)},${pts[0][1].toFixed(5)}`,
    destination: `${pts[pts.length - 1][0].toFixed(5)},${pts[pts.length - 1][1].toFixed(5)}`,
    travelmode: 'driving',
    waypoints: waypoints.join('|'),
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

function appleMapsUrl(route) {
  const a = route.coords[0], b = route.coords[route.coords.length - 1];
  return `https://maps.apple.com/?saddr=${a[0].toFixed(5)},${a[1].toFixed(5)}` +
    `&daddr=${b[0].toFixed(5)},${b[1].toFixed(5)}&dirflg=d`;
}

function wazeUrl(route) {
  const b = route.coords[route.coords.length - 1];
  return `https://waze.com/ul?ll=${b[0].toFixed(5)},${b[1].toFixed(5)}&navigate=yes`;
}

const SCENIC_COLORS = ['#2f7d32', '#00838f', '#6a1b9a'];

function renderResults(data) {
  document.querySelectorAll('.status-note').forEach(n => n.remove());
  const palette = SCENIC_COLORS;
  const routes = [];
  if (data.fastest) routes.push({ ...data.fastest, label: 'Fastest', color: '#546e7a' });
  data.scenic.forEach((r, i) => routes.push({
    ...r,
    label: i === 0 ? 'Most scenic' : `Scenic option ${i + 1}`,
    color: palette[i % palette.length],
  }));
  state.routes = routes;

  if (data.scenic.length === 0) {
    setStatus(data.overpassError
      ? 'Scenery data was unavailable; showing the fastest route only.'
      : 'No scenic alternative beat the fastest route within your time budget. Try allowing more extra time.', !!data.overpassError);
  } else {
    const f = data.featureCounts;
    setStatus(`Compared against ${f.green} green spaces, ${f.water} waterways and ${f.historic} landmarks in this area.`);
  }
  // Freeway/highway fallback note.
  if (data.highwayUnavoidable) {
    const extra = document.createElement('p');
    extra.className = 'status-note';
    extra.textContent = '🛣️ No freeway-free route fits your time budget here, so the options below still use one. Increase the extra-time budget to search for a longer way around.';
    statusEl.after(extra);
  }

  const group = [];
  routes.forEach((r, idx) => {
    const line = L.polyline(r.coords, { color: r.color, weight: 4, opacity: 0.9 }).addTo(map);
    line.on('click', () => selectRoute(idx));
    state.routeLayers.push(line);
    group.push(line);

    const card = document.createElement('div');
    card.className = 'route-card';
    card.id = `route-card-${idx}`;
    const extras = r.extraSeconds > 30
      ? `<span class="extra">+${fmtTime(r.extraSeconds)}</span>` : '';
    const m = r.metrics;

    // Badges only for the categories the user actually selected.
    const badges = [];
    if (state.prefs.greenery && m.greenCoverage > 0.02) badges.push(`<span class="badge">🌳 ${Math.round(m.greenCoverage * 100)}% green</span>`);
    if (state.prefs.water && m.waterCoverage > 0.02) badges.push(`<span class="badge water">💧 ${Math.round(m.waterCoverage * 100)}% water</span>`);
    if (state.prefs.historic) m.highlights.historic.forEach(h => badges.push(`<span class="badge historic">🏛️ ${escapeHtml(h)}</span>`));
    if (state.prefs.greenery) m.highlights.green.slice(0, 3).forEach(h => badges.push(`<span class="badge">${escapeHtml(h)}</span>`));
    if (r.highwayFraction > 0.05) badges.push(`<span class="badge gray">🛣️ ${Math.round(r.highwayFraction * 100)}% freeway/highway</span>`);
    if (state.prefs.quietStreets) badges.push(`<span class="badge gray">🏘️ ${Math.round((1 - r.mainRoadFraction) * 100)}% off main roads</span>`);
    if (state.prefs.preferDifferent && !r.isFastest && r.uniqueness != null)
      badges.push(`<span class="badge">🔀 ${Math.round(r.uniqueness * 100)}% different roads</span>`);
    if (r.quiet) badges.push(`<span class="badge">back-streets route</span>`);
    if (r.via) badges.push(`<span class="badge">via ${escapeHtml(r.via)}</span>`);

    card.innerHTML = `
      <div class="title">
        <span style="color:${r.color}">&#9632; ${r.label}</span>
        <span class="time">${fmtTime(r.duration)} ${extras}</span>
      </div>
      <div class="sub">${fmtDist(r.distance)} · scenic score ${r.score}/100${r.roads.length ? ' · ' + r.roads.slice(0, 3).map(escapeHtml).join(', ') : ''}</div>
      <div class="scorebar"><div style="width:${r.score}%"></div></div>
      <div class="badges">${badges.join('')}</div>
      <div class="nav-row">
        <span class="nav-label">Navigate:</span>
        <a class="nav-link" href="${googleMapsUrl(r)}" target="_blank" rel="noopener" title="Follows this route via pinned waypoints">Google Maps ↗</a>
        <a class="nav-link" href="${appleMapsUrl(r)}" target="_blank" rel="noopener" title="Apple Maps (start to destination)">Apple Maps ↗</a>
        <a class="nav-link" href="${wazeUrl(r)}" target="_blank" rel="noopener" title="Waze (to destination)">Waze ↗</a>
      </div>`;
    card.addEventListener('click', () => selectRoute(idx));
    card.querySelectorAll('.nav-link').forEach(a =>
      a.addEventListener('click', e => e.stopPropagation()));
    resultsEl.appendChild(card);
  });

  if (group.length) {
    map.fitBounds(L.featureGroup(group).getBounds(), { padding: [40, 40] });
  }
  selectRoute(routes.length > 1 ? 1 : 0);

  // Bring the results into view with a visible scroll animation — on phones
  // the cards land below the fold and are easy to miss otherwise. Animated
  // by hand: native smooth scrolling is disabled in some browsers.
  setCollapsed(false);
  setTimeout(() => {
    const body = document.getElementById('panel-body');
    animateScroll(body, Math.max(0, statusEl.offsetTop - 10), 550);
  }, 150);
}

function animateScroll(el, target, durationMs) {
  const from = el.scrollTop;
  const delta = target - from;
  if (Math.abs(delta) < 2) return;
  const t0 = performance.now();
  const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  function step(now) {
    const t = Math.min(1, (now - t0) / durationMs);
    el.scrollTop = from + delta * easeInOut(t);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  // rAF doesn't tick in hidden/background tabs; land on the target anyway.
  setTimeout(() => { el.scrollTop = target; }, durationMs + 120);
}

function selectRoute(idx) {
  state.routes.forEach((r, i) => {
    const layer = state.routeLayers[i];
    if (layer) layer.setStyle({ weight: i === idx ? 7 : 4, opacity: i === idx ? 1 : 0.45 });
    if (layer && i === idx) layer.bringToFront();
    const card = document.getElementById(`route-card-${i}`);
    if (card) card.classList.toggle('selected', i === idx);
  });
}
