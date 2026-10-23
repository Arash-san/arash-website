import { geocode, resolveSuggestion, reverseGeocode } from './engines.js';
import { findRoutes } from './routes.js';

/* ---------- icons ---------- */

const ICONS = {
  locate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><path d="M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>',
  leaf: '<svg viewBox="0 0 24 24"><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19c3-4 6-6 9-8"/></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  landmark: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6z"/></svg>',
  house: '<svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M3 7h4c4 0 6 10 10 10h4M3 17h4c1.5 0 2.7-1.4 3.7-3.2M14 10.2C15 8.4 16 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};
document.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = ICONS[el.dataset.icon]; });
document.getElementById('locate-btn').innerHTML = ICONS.locate;
document.getElementById('start-save').innerHTML = ICONS.star;
document.getElementById('end-save').innerHTML = ICONS.star;
document.getElementById('swap-btn').innerHTML = ICONS.swap;

/* ---------- persisted state ---------- */

const STORE_KEY = 'scenic.state.v3';
const RECENTS_KEY = 'scenic.recents.v1';
const FAVS_KEY = 'scenic.favorites.v1';

function loadStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
// Carry over places and settings saved by the previous version of the app.
const saved = loadStore(STORE_KEY, null) || loadStore('scenic.state.v2', {});
const recents = loadStore(RECENTS_KEY, []);
const favorites = loadStore(FAVS_KEY, []);

const state = {
  start: saved.start || null,
  end: saved.end || null, // [lat, lon]
  myLocation: null,
  markers: { start: null, end: null },
  routes: [],
  selected: -1,
  theme: saved.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  prefs: Object.assign({ greenery: true, water: false, historic: false, quietStreets: true, preferDifferent: true }, saved.prefs),
};

const $ = (id) => document.getElementById(id);
const startInput = $('start-input');
const endInput = $('end-input');
const highwayInput = $('highway');
const budgetInput = $('budget');
const inputs = { start: startInput, end: endInput };

function persist() {
  const c = map.getCenter();
  localStorage.setItem(STORE_KEY, JSON.stringify({
    prefs: state.prefs,
    highway: Number(highwayInput.value),
    budget: Number(budgetInput.value),
    theme: state.theme,
    start: state.start, end: state.end,
    startLabel: startInput.value, endLabel: endInput.value,
    view: { center: [c.lat, c.lng], zoom: map.getZoom() },
  }));
}

function addRecent(item) {
  const next = [item, ...recents.filter((r) => r.label !== item.label)].slice(0, 6);
  recents.length = 0;
  recents.push(...next);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
}

/* ---------- map ---------- */

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const ROUTE_COLORS = ['#dc143c', '#0f8b8d', '#b7791f'];
const FASTEST_COLOR = '#7b8494';
const isPhone = () => matchMedia('(max-width: 760px)').matches;

const initView = saved.view || { center: [35.2226, -97.4395], zoom: 12.5 }; // Norman, OK
const map = new maplibregl.Map({
  container: 'map',
  style: STYLES[state.theme],
  center: [initView.center[1], initView.center[0]],
  zoom: initView.zoom,
  attributionControl: { compact: true },
  dragRotate: false,
  pitchWithRotate: false,
});
map.touchZoomRotate.disableRotation();
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'top-right');
map.on('moveend', persist);

const empty = { type: 'FeatureCollection', features: [] };
function addOverlay() {
  if (map.getSource('routes')) return;
  map.addSource('scenery', { type: 'geojson', data: sceneryGeoJSON() });
  map.addSource('routes', { type: 'geojson', data: routesGeoJSON() });
  const dark = state.theme === 'dark';
  map.addLayer({
    id: 'scenery-glow', type: 'line', source: 'scenery', filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get', 'kind'], 'water', dark ? '#4f97e3' : '#3d8bdc', dark ? '#4cc282' : '#2fa866'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 20, 14, 38],
      'line-opacity': dark ? 0.5 : 0.42,
      'line-blur': 7,
    },
  });
  map.addLayer({
    id: 'route-casing', type: 'line', source: 'routes', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['get', 'order'] },
    paint: { 'line-color': dark ? '#0e1013' : '#ffffff', 'line-width': ['case', ['get', 'selected'], 11, 7], 'line-opacity': ['case', ['get', 'selected'], 1, 0.75] },
  });
  map.addLayer({
    id: 'route-line', type: 'line', source: 'routes', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['get', 'order'] },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'selected'], 6.5, 4], 'line-opacity': ['case', ['get', 'selected'], 1, 0.5] },
  });
  map.addLayer({
    id: 'landmark-dot', type: 'circle', source: 'scenery', filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 15, 6],
      'circle-color': dark ? '#e0a656' : '#b7791f',
      'circle-stroke-color': dark ? '#17191e' : '#ffffff',
      'circle-stroke-width': 2,
    },
  });
}
let routeEventsWired = false;
map.on('style.load', () => {
  addOverlay();
  if (routeEventsWired) return;
  routeEventsWired = true;
  map.on('click', 'route-line', (e) => { if (e.features?.length) selectRoute(e.features[0].properties.idx); });
  map.on('mouseenter', 'route-line', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'route-line', () => { map.getCanvas().style.cursor = ''; });
  const popup = new maplibregl.Popup({ closeButton: false, offset: 10 });
  map.on('mouseenter', 'landmark-dot', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    popup.setLngLat(e.features[0].geometry.coordinates).setText(e.features[0].properties.name).addTo(map);
  });
  map.on('mouseleave', 'landmark-dot', () => { map.getCanvas().style.cursor = ''; popup.remove(); });
  map.on('click', 'landmark-dot', (e) => {
    popup.setLngLat(e.features[0].geometry.coordinates).setText(e.features[0].properties.name).addTo(map);
  });
});

const toLngLat = ([lat, lon]) => [lon, lat];

function routesGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: state.routes.map((r, idx) => ({
      type: 'Feature',
      properties: { idx, color: r.color, selected: idx === state.selected, order: idx === state.selected ? 99 : r.isFastest ? 0 : 10 - idx },
      geometry: { type: 'LineString', coordinates: r.coords.map(toLngLat) },
    })),
  };
}

function sceneryGeoJSON() {
  const r = state.routes[state.selected];
  if (!r) return empty;
  return {
    type: 'FeatureCollection',
    features: [
      ...r.metrics.segments.map((seg) => ({
        type: 'Feature',
        properties: { kind: seg.kind },
        geometry: { type: 'LineString', coordinates: seg.coords.map(toLngLat) },
      })),
      ...r.metrics.landmarks.map((lm) => ({
        type: 'Feature',
        properties: { name: lm.name },
        geometry: { type: 'Point', coordinates: toLngLat(lm.at) },
      })),
    ],
  };
}

function refreshOverlay() {
  // During a theme switch the old style is gone and the new one is loading;
  // the style.load handler redraws the overlay from state once it is ready.
  if (!map.style || !map.getSource('routes')) return;
  map.getSource('routes').setData(routesGeoJSON());
  map.getSource('scenery').setData(sceneryGeoJSON());
}

function fitPadding() {
  if (isPhone()) {
    const visible = window.innerHeight - sheetOffset();
    return { top: 70, left: 28, right: 28, bottom: Math.min(visible + 24, window.innerHeight * 0.6) };
  }
  return { top: 60, right: 70, bottom: 60, left: $('panel').offsetWidth + 60 };
}

/* ---------- theme ---------- */

function applyTheme(theme, { restyle = true } = {}) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#17191e' : '#ffffff';
  $('theme-btn').innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
  $('theme-btn').title = theme === 'dark' ? 'Light map' : 'Dark map';
  if (restyle) map.setStyle(STYLES[theme]);
}
applyTheme(state.theme, { restyle: false });
$('theme-btn').addEventListener('click', () => { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); persist(); });

/* ---------- start / end points ---------- */

const coordLabel = (p) => `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`;
const shortLabel = (s) => s.split(',').slice(0, 3).join(',');

function setPoint(kind, lat, lon, label) {
  state[kind] = [lat, lon];
  if (!state.markers[kind]) {
    const el = document.createElement('div');
    el.className = `mk mk-${kind}`;
    const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([lon, lat]).addTo(map);
    marker.on('dragend', async () => {
      const { lat: la, lng: lo } = marker.getLngLat();
      state[kind] = [la, lo];
      inputs[kind].value = coordLabel(state[kind]);
      persist();
      try { inputs[kind].value = shortLabel(await reverseGeocode(la, lo)); persist(); } catch { /* keep coordinates */ }
    });
    state.markers[kind] = marker;
  } else {
    state.markers[kind].setLngLat([lon, lat]);
  }
  if (label) inputs[kind].value = label;
  updateSaveButtons();
  persist();
}

function clearPoint(kind) {
  state[kind] = null;
  state.markers[kind]?.remove();
  state.markers[kind] = null;
}

if (state.start) setPoint('start', state.start[0], state.start[1], saved.startLabel || coordLabel(state.start));
if (state.end) setPoint('end', state.end[0], state.end[1], saved.endLabel || coordLabel(state.end));

async function dropPoint(lngLat) {
  const kind = !state.start ? 'start' : !state.end ? 'end' : 'end';
  const { lat, lng } = lngLat;
  setPoint(kind, lat, lng, coordLabel([lat, lng]));
  try { inputs[kind].value = shortLabel(await reverseGeocode(lat, lng)); persist(); } catch { /* coordinates stay */ }
}
map.on('contextmenu', (e) => dropPoint(e.lngLat));

// Press and hold on touch screens.
let holdTimer = null;
map.on('touchstart', (e) => {
  if (e.originalEvent.touches.length !== 1) return;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => { navigator.vibrate?.(15); dropPoint(e.lngLat); }, 550);
});
for (const ev of ['touchend', 'touchcancel', 'touchmove', 'movestart', 'zoomstart']) map.on(ev, () => clearTimeout(holdTimer));

function biasPoint() {
  if (state.myLocation) return state.myLocation;
  const c = map.getCenter();
  return [c.lat, c.lng];
}

/* ---------- autocomplete ---------- */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function matchingFavorites(q) {
  const needle = q.toLowerCase();
  return favorites
    .filter((f) => !needle || f.name.toLowerCase().includes(needle) || f.label.toLowerCase().includes(needle))
    .map((f) => ({ label: f.name, sub: f.label, lat: f.lat, lon: f.lon, fav: true }));
}

function wireAutocomplete(kind) {
  const input = inputs[kind];
  const box = $(`${kind}-suggestions`);
  let items = [], active = -1, timer = null, seq = 0;

  function close() {
    box.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  }

  function render(list, mode) {
    items = list;
    active = -1;
    box.innerHTML = '';
    if (!list.length) {
      if (mode === 'search') {
        box.innerHTML = '<li class="s-empty">No places found. Try a nearby street or city.</li>';
        box.classList.add('open');
      } else close();
      return;
    }
    list.forEach((r, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      const icon = r.fav ? ICONS.star : r.recent ? ICONS.clock : ICONS.pin;
      const main = r.fav ? r.label : shortLabel(r.label);
      const sub = r.fav ? shortLabel(r.sub || '') : r.label.split(',').slice(3, 5).join(',').trim();
      li.innerHTML = `${icon}<span class="s-text"><span class="s-main">${escapeHtml(main)}</span>${sub ? `<span class="s-sub">${escapeHtml(sub)}</span>` : ''}</span>${r.distKm > 1 ? `<span class="s-dist">${r.distKm} km</span>` : ''}`;
      li.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(i); });
      box.appendChild(li);
    });
    box.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  }

  function highlight(i) {
    active = (i + items.length) % items.length;
    [...box.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === active)));
  }

  async function choose(i) {
    const r = items[i];
    if (!r) return;
    close();
    let item = r;
    if (!Number.isFinite(item.lat)) {
      setStatus(`Locating ${shortLabel(item.label)}…`);
      try { item = await resolveSuggestion(item, biasPoint()); setStatus(''); }
      catch (err) { return setStatus(String(err.message || err), true); }
    }
    setPoint(kind, item.lat, item.lon, r.fav ? r.label : shortLabel(item.label));
    if (!r.fav) addRecent({ label: item.label, lat: item.lat, lon: item.lon });
    const other = kind === 'start' ? state.end : state.start;
    if (other) fitPoints(); else map.easeTo({ center: [item.lon, item.lat], zoom: Math.max(map.getZoom(), 13) });
    if (kind === 'start' && !state.end) endInput.focus();
  }

  const showSaved = () => render([...matchingFavorites(input.value.trim()), ...recents.map((r) => ({ ...r, recent: true }))].slice(0, 8), 'saved');

  input.addEventListener('focus', () => { if (input.value.trim().length < 3 || /^-?\d/.test(input.value)) showSaved(); });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) return showSaved();
    const mine = ++seq;
    timer = setTimeout(async () => {
      try {
        const results = await geocode(q, biasPoint());
        if (mine === seq) render([...matchingFavorites(q), ...results], 'search');
      } catch { close(); }
    }, 280);
  });
  input.addEventListener('keydown', (e) => {
    if (!box.classList.contains('open') || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(Math.max(0, active)); }
    else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
}
wireAutocomplete('start');
wireAutocomplete('end');

function fitPoints() {
  if (!state.start || !state.end) return;
  const b = new maplibregl.LngLatBounds(toLngLat(state.start), toLngLat(state.start)).extend(toLngLat(state.end));
  map.fitBounds(b, { padding: fitPadding(), maxZoom: 14, duration: 700 });
}

/* ---------- saved places ---------- */

function favoriteAt(point) {
  return point && favorites.find((f) => Math.abs(f.lat - point[0]) < 1e-5 && Math.abs(f.lon - point[1]) < 1e-5);
}
function updateSaveButtons() {
  for (const kind of ['start', 'end']) {
    const fav = favoriteAt(state[kind]);
    const btn = $(`${kind}-save`);
    btn.classList.toggle('is-saved', !!fav);
    btn.title = fav ? `Saved as "${fav.name}". Click to remove.` : 'Save this place with a name';
  }
}
function wireSaveButton(kind) {
  $(`${kind}-save`).addEventListener('click', () => {
    const point = state[kind];
    if (!point) return setStatus(`Choose a ${kind === 'start' ? 'starting point' : 'destination'} first, then save it.`, true);
    const existing = favoriteAt(point);
    if (existing) {
      favorites.splice(favorites.indexOf(existing), 1);
      localStorage.setItem(FAVS_KEY, JSON.stringify(favorites));
      updateSaveButtons();
      return setStatus(`Removed "${existing.name}" from saved places.`);
    }
    const current = inputs[kind].value;
    const name = window.prompt('Name this place (for example "Home"):', current);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const same = favorites.findIndex((f) => f.name.toLowerCase() === trimmed.toLowerCase());
    if (same >= 0) favorites.splice(same, 1);
    favorites.unshift({ name: trimmed, label: current, lat: point[0], lon: point[1] });
    if (favorites.length > 20) favorites.length = 20;
    localStorage.setItem(FAVS_KEY, JSON.stringify(favorites));
    updateSaveButtons();
    setStatus(`Saved "${trimmed}". It now shows up when you search.`);
  });
}
wireSaveButton('start');
wireSaveButton('end');
updateSaveButtons();

$('locate-btn').addEventListener('click', () => {
  if (!navigator.geolocation) return setStatus('This browser cannot share your location.', true);
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    state.myLocation = [lat, lon];
    setPoint('start', lat, lon, 'My location');
    map.easeTo({ center: [lon, lat], zoom: 14 });
    setStatus('');
    try { startInput.value = shortLabel(await reverseGeocode(lat, lon)); persist(); } catch { /* keep "My location" */ }
  }, (err) => setStatus(`Could not get your location: ${err.message}`, true), { enableHighAccuracy: true, timeout: 12000 });
});

$('swap-btn').addEventListener('click', () => {
  const [s, e] = [state.start, state.end];
  const [sl, el] = [startInput.value, endInput.value];
  clearPoint('start');
  clearPoint('end');
  if (e) setPoint('start', e[0], e[1], el);
  if (s) setPoint('end', s[0], s[1], sl);
  startInput.value = el;
  endInput.value = sl;
  updateSaveButtons();
  persist();
});

/* ---------- preferences ---------- */

document.querySelectorAll('.chip').forEach((chip) => {
  const pref = chip.dataset.pref;
  chip.setAttribute('aria-pressed', String(!!state.prefs[pref]));
  chip.addEventListener('click', () => {
    state.prefs[pref] = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(state.prefs[pref]));
    persist();
  });
});

function paintRange(input) {
  const min = Number(input.min), max = Number(input.max);
  input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}
function updateSliders() {
  const v = Number(highwayInput.value);
  $('highway-label').textContent = v === 0 ? 'Avoid' : v >= 100 ? 'No limit' : `Up to ${v}%`;
  $('highway-note').textContent = v === 0
    ? 'Used only when no other road fits your time budget.'
    : v >= 100 ? 'Freeways and highways are used freely.' : 'A little freeway driving is fine to save time.';
  $('budget-label').textContent = `+${budgetInput.value}%`;
  paintRange(highwayInput);
  paintRange(budgetInput);
}
if (Number.isFinite(saved.highway)) highwayInput.value = saved.highway;
if (Number.isFinite(saved.budget)) budgetInput.value = saved.budget;
updateSliders();
for (const el of [highwayInput, budgetInput]) el.addEventListener('input', () => { updateSliders(); persist(); });

/* ---------- bottom sheet on phones ---------- */

const panel = $('panel');
const SNAP = { peek: 0, half: 1, full: 2 };
let sheetState = SNAP.full;

function sheetHeights() {
  const full = panel.offsetHeight;
  const peek = Math.min(full, panel.querySelector('.panel-head').offsetHeight + 34);
  const half = Math.min(full, Math.round(window.innerHeight * 0.52));
  return [peek, half, full];
}
function sheetOffset() {
  if (!isPhone()) return 0;
  const heights = sheetHeights();
  return panel.offsetHeight - heights[sheetState];
}
function setSheet(next) {
  sheetState = next;
  panel.style.setProperty('--sheet-offset', `${sheetOffset()}px`);
}
(() => {
  let startY = null, startOffset = 0, lastY = 0, lastT = 0, velocity = 0;
  const grabbers = [$('sheet-grip'), panel.querySelector('.panel-head')];
  const onDown = (e) => {
    if (!isPhone() || e.target.closest('button, a')) return;
    startY = lastY = e.clientY;
    lastT = performance.now();
    startOffset = sheetOffset();
    velocity = 0;
    panel.classList.add('dragging');
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (startY === null) return;
    const now = performance.now();
    velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
    lastY = e.clientY;
    lastT = now;
    const max = panel.offsetHeight - sheetHeights()[0];
    const offset = Math.max(0, Math.min(max, startOffset + (e.clientY - startY)));
    panel.style.setProperty('--sheet-offset', `${offset}px`);
  };
  const onUp = (e) => {
    if (startY === null) return;
    const moved = Math.abs(e.clientY - startY);
    panel.classList.remove('dragging');
    startY = null;
    if (moved < 6) return setSheet(sheetState === SNAP.full ? SNAP.peek : SNAP.full);
    const visible = panel.offsetHeight - parseFloat(panel.style.getPropertyValue('--sheet-offset'));
    const heights = sheetHeights();
    let best = 0;
    // A quick flick moves one step in its direction; otherwise snap to nearest.
    if (Math.abs(velocity) > 0.6) best = velocity > 0 ? Math.max(0, sheetState - 1) : Math.min(2, sheetState + 1);
    else heights.forEach((h, i) => { if (Math.abs(h - visible) < Math.abs(heights[best] - visible)) best = i; });
    setSheet(best);
  };
  for (const g of grabbers) {
    g.addEventListener('pointerdown', onDown);
    g.addEventListener('pointermove', onMove);
    g.addEventListener('pointerup', onUp);
    g.addEventListener('pointercancel', onUp);
  }
  addEventListener('resize', () => setSheet(sheetState));
})();

/* ---------- routing ---------- */

const goBtn = $('go-btn');
const statusEl = $('status');
const resultsEl = $('results');
const progressEl = $('progress');

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'error' : '';
}

function setStage(stage, detail = {}) {
  const order = ['routing', 'scenery', 'scoring', 'done'];
  const at = order.indexOf(stage);
  progressEl.hidden = stage === 'done';
  progressEl.querySelectorAll('li').forEach((li) => {
    const i = order.indexOf(li.dataset.stage);
    li.className = i < at ? 'done' : i === at ? 'active' : '';
    let small = li.querySelector('small');
    if (li.dataset.stage === 'scenery' && stage === 'scenery' && detail.total) {
      if (!small) li.appendChild((small = document.createElement('small')));
      small.textContent = `${detail.done} of ${detail.total} map tiles`;
    } else if (small && i !== at) small.remove();
  });
  if (stage === 'scenery' && detail.candidates) previewCandidates(detail.candidates);
}

// While scenery loads, show the candidate roads faintly so the map is not idle.
function previewCandidates(lines) {
  state.routes = lines.map((coords) => ({ coords, color: FASTEST_COLOR, isFastest: true, metrics: { segments: [], landmarks: [] } }));
  state.selected = -1;
  refreshOverlay();
  fitRoutes(lines);
}

function fitRoutes(lines) {
  const all = lines.flat();
  if (!all.length) return;
  const b = new maplibregl.LngLatBounds(toLngLat(all[0]), toLngLat(all[0]));
  for (const p of all) b.extend(toLngLat(p));
  map.fitBounds(b, { padding: fitPadding(), duration: 800 });
}

function fmtTime(sec) {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
function fmtDist(m) {
  const mi = m / 1609.34;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

goBtn.addEventListener('click', async () => {
  if (!state.start || !state.end) {
    setStatus('Choose a starting point and a destination first.', true);
    (state.start ? endInput : startInput).focus();
    return;
  }
  goBtn.disabled = true;
  goBtn.firstElementChild.textContent = 'Searching…';
  setStatus('');
  resultsEl.innerHTML = '';
  document.querySelectorAll('.note').forEach((n) => n.remove());
  state.routes = [];
  state.selected = -1;
  refreshOverlay();
  const t0 = performance.now();
  try {
    const data = await findRoutes({
      start: state.start,
      end: state.end,
      prefs: { ...state.prefs, highwayUse: Number(highwayInput.value) / 100 },
      detourBudget: Number(budgetInput.value) / 100,
      onStage: setStage,
    });
    setStage('done');
    renderResults(data, (performance.now() - t0) / 1000);
  } catch (err) {
    setStage('done');
    state.routes = [];
    refreshOverlay();
    const raw = String(err.message || err);
    setStatus(/timed out|timeout|aborted|network|failed to fetch/i.test(raw)
      ? 'A map service took too long to answer. Please try again in a moment.'
      : raw, true);
  } finally {
    goBtn.disabled = false;
    goBtn.firstElementChild.textContent = 'Find scenic routes';
  }
});

// Google Maps can follow the route through a few pinned waypoints. Apple Maps
// and Waze links carry the start and destination only.
function googleMapsUrl(route) {
  const pts = route.coords;
  const n = Math.min(5, Math.max(1, Math.floor(pts.length / 40)));
  const waypoints = [];
  for (let i = 1; i <= n; i++) {
    const p = pts[Math.floor((pts.length * i) / (n + 1))];
    waypoints.push(`${p[0].toFixed(5)},${p[1].toFixed(5)}`);
  }
  const a = pts[0], b = pts[pts.length - 1];
  const params = new URLSearchParams({
    api: '1', travelmode: 'driving', waypoints: waypoints.join('|'),
    origin: `${a[0].toFixed(5)},${a[1].toFixed(5)}`, destination: `${b[0].toFixed(5)},${b[1].toFixed(5)}`,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
function appleMapsUrl(route) {
  const a = route.coords[0], b = route.coords[route.coords.length - 1];
  return `https://maps.apple.com/?saddr=${a[0].toFixed(5)},${a[1].toFixed(5)}&daddr=${b[0].toFixed(5)},${b[1].toFixed(5)}&dirflg=d`;
}
function wazeUrl(route) {
  const b = route.coords[route.coords.length - 1];
  return `https://waze.com/ul?ll=${b[0].toFixed(5)},${b[1].toFixed(5)}&navigate=yes`;
}

function renderResults(data, seconds) {
  const routes = data.scenic.map((r, i) => ({ ...r, label: i === 0 ? 'Most scenic' : `Scenic option ${i + 1}`, color: ROUTE_COLORS[i] }));
  if (data.fastest) routes.push({ ...data.fastest, label: 'Fastest', color: FASTEST_COLOR });
  state.routes = routes;

  const f = data.featureCounts;
  if (!data.scenic.length) {
    setStatus(data.sceneryError
      ? 'Scenery data was unavailable, so only the fastest route is shown.'
      : 'No scenic alternative fit your time budget. Try allowing more extra time.', !!data.sceneryError);
  } else {
    setStatus(`Checked ${routes.length} routes against ${f.green} green areas, ${f.water} water features, and ${f.historic} landmarks in ${seconds.toFixed(1)} s.`);
  }
  if (data.highwayUnavoidable) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'No freeway-free route fits your time budget here, so these options still use one. Allow more extra time to search for a longer way around.';
    statusEl.after(note);
  }

  resultsEl.innerHTML = '';
  routes.forEach((r, idx) => {
    const m = r.metrics;
    const card = document.createElement('article');
    card.className = 'route-card';
    card.style.setProperty('--route', r.color);
    const extra = r.extraSeconds > 30 ? `<em>+${fmtTime(r.extraSeconds)}</em>` : r.isFastest ? '' : '<em>same time</em>';
    const roads = r.roads.length ? ` · via ${r.roads.slice(0, 2).map(escapeHtml).join(', ')}` : '';
    const tags = [];
    m.highlights.green.slice(0, 3).forEach((h) => tags.push(`<span class="t-green">${escapeHtml(h)}</span>`));
    m.highlights.water.slice(0, 2).forEach((h) => tags.push(`<span class="t-water">${escapeHtml(h)}</span>`));
    m.highlights.historic.slice(0, 3).forEach((h) => tags.push(`<span class="t-landmark">${escapeHtml(h)}</span>`));
    tags.splice(5);
    if (r.quiet) tags.push('<span class="t-muted">Back streets</span>');
    if (r.highwayFraction > 0.05) tags.push(`<span class="t-muted">${Math.round(r.highwayFraction * 100)}% freeway</span>`);
    const bar = (label, value, color) => `<div class="rc-bar">${label}<b>${Math.round(value * 100)}%</b><i style="--v:${Math.round(Math.min(1, value) * 100)}%;--c:${color}"></i></div>`;
    card.innerHTML = `
      <div class="rc-top">
        <div class="rc-ring" style="--p:${r.score}" title="Scenic score ${r.score} out of 100"><span>${r.score}</span></div>
        <div class="rc-head">
          <div class="rc-label">${r.label}</div>
          <div class="rc-time">${fmtTime(r.duration)}${extra}</div>
          <div class="rc-sub">${fmtDist(r.distance)}${roads}</div>
        </div>
      </div>
      <div class="rc-bars">
        ${bar('Green', m.greenCoverage, 'var(--green)')}
        ${bar('Water', m.waterCoverage, 'var(--water)')}
        ${r.isFastest ? bar('Quiet', 1 - r.mainRoadFraction, 'var(--muted)') : bar('New roads', r.uniqueness, r.color)}
      </div>
      ${tags.length ? `<div class="rc-tags">${tags.join('')}</div>` : ''}
      <div class="rc-nav">
        <a href="${googleMapsUrl(r)}" target="_blank" rel="noopener" title="Follows this route through pinned waypoints">Google Maps</a>
        <a href="${appleMapsUrl(r)}" target="_blank" rel="noopener">Apple Maps</a>
        <a href="${wazeUrl(r)}" target="_blank" rel="noopener">Waze</a>
      </div>`;
    card.addEventListener('click', (e) => { if (!e.target.closest('a')) selectRoute(idx, { scroll: false }); });
    resultsEl.appendChild(card);
  });

  selectRoute(0, { scroll: false });
  fitRoutes(routes.map((r) => r.coords));
  if (isPhone()) setSheet(SNAP.half);
  requestAnimationFrame(() => {
    const body = $('panel-body');
    body.scrollTo({ top: Math.max(0, statusEl.offsetTop - 12), behavior: 'smooth' });
  });
}

function selectRoute(idx, { scroll = true } = {}) {
  state.selected = idx;
  refreshOverlay();
  resultsEl.querySelectorAll('.route-card').forEach((card, i) => card.classList.toggle('selected', i === idx));
  if (scroll) resultsEl.children[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

if (isPhone()) setSheet(state.start && state.end ? SNAP.half : SNAP.full);
