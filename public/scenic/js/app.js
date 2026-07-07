import { geocode, reverseGeocode } from './engines.js';
import { findRoutes } from './routes.js';

/* ---------- persisted state ---------- */

const STORE_KEY = 'scenic.state.v2';
const RECENTS_KEY = 'scenic.recents.v1';

function loadStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
const saved = loadStore(STORE_KEY, {});
const recents = loadStore(RECENTS_KEY, []);

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    prefs: state.prefs,
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

const TILES = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
};
let tileLayer = null;

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.getElementById('theme-btn').textContent = theme === 'dark' ? '☀️' : '🌙';
  if (tileLayer) tileLayer.remove();
  tileLayer = L.tileLayer(TILES[theme].url, TILES[theme].options).addTo(map);
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
    { greenery: true, water: false, historic: false, quietStreets: false },
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

function renderSuggestions(box, items, kind, isRecent) {
  box.innerHTML = '';
  if (!items.length) { box.style.display = 'none'; return; }
  for (const r of items) {
    const div = document.createElement('div');
    const dist = r.distKm > 1 ? `<span class="dist">${r.distKm} km</span>` : '';
    const tag = isRecent ? '<span class="recent-tag">↺</span>' : '';
    div.innerHTML = `${tag}${escapeHtml(shortLabel(r.label))}${dist}`;
    div.addEventListener('click', () => {
      setPoint(kind, r.lat, r.lon, shortLabel(r.label));
      addRecent({ label: r.label, lat: r.lat, lon: r.lon, distKm: 0 });
      box.style.display = 'none';
      map.panTo([r.lat, r.lon]);
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
    if (input.value.trim().length < 3 && recents.length) {
      renderSuggestions(box, recents, kind, true);
    }
  });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) {
      renderSuggestions(box, recents, kind, true);
      return;
    }
    timer = setTimeout(async () => {
      try {
        const results = await geocode(q, biasPoint());
        renderSuggestions(box, results, kind, false);
      } catch { box.style.display = 'none'; }
    }, 350);
  });
  input.addEventListener('blur', () => setTimeout(() => { box.style.display = 'none'; }, 250));
}
wireAutocomplete('start');
wireAutocomplete('end');

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
  if (v === 0) return 'none';
  if (v >= 100) return 'no limit';
  return `up to ${v}%`;
}
if (Number.isFinite(saved.highway)) highwayInput.value = saved.highway;
if (Number.isFinite(saved.budget)) budgetInput.value = saved.budget;
document.getElementById('highway-label').textContent = highwayLabel(Number(highwayInput.value));
document.getElementById('budget-label').textContent = `+${budgetInput.value}%`;

highwayInput.addEventListener('input', () => {
  document.getElementById('highway-label').textContent = highwayLabel(Number(highwayInput.value));
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
    setStatus(String(err.message || err), true);
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
// intermediate waypoints along it.
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

const SCENIC_COLORS = ['#2f7d32', '#00838f', '#6a1b9a'];
const SCENIC_COLORS_DARK = ['#7ee383', '#4dd0e1', '#ce93d8'];

function renderResults(data) {
  const dark = state.theme === 'dark';
  const palette = dark ? SCENIC_COLORS_DARK : SCENIC_COLORS;
  const routes = [];
  if (data.fastest) routes.push({ ...data.fastest, label: 'Fastest', color: dark ? '#b0bec5' : '#78909c' });
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
    if (r.highwayFraction > 0.05) badges.push(`<span class="badge gray">🛣️ ${Math.round(r.highwayFraction * 100)}% highway</span>`);
    if (state.prefs.quietStreets) badges.push(`<span class="badge gray">🏘️ ${Math.round((1 - r.mainRoadFraction) * 100)}% quiet streets</span>`);
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
      <a class="nav-link" href="${googleMapsUrl(r)}" target="_blank" rel="noopener">Navigate in Google Maps ↗</a>`;
    card.addEventListener('click', () => selectRoute(idx));
    card.querySelector('.nav-link').addEventListener('click', e => e.stopPropagation());
    resultsEl.appendChild(card);
  });

  if (group.length) {
    map.fitBounds(L.featureGroup(group).getBounds(), { padding: [40, 40] });
  }
  selectRoute(routes.length > 1 ? 1 : 0);
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
