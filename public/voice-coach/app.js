/* Voice Coach front end (vanilla JS + Chart.js).
   Routes: #/ (record)  #/recordings  #/progress  #/compare?ids=  #/r/<id>   Shared pages: /s/<token> */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const API = String(window.VOICE_API || '').replace(/\/$/, '');      // '' = same server (tailnet app)
const PUBLIC = !!window.VOICE_PUBLIC;                               // public page on arash-ahmadi.com
const SHARE = document.body.dataset.share || new URLSearchParams(location.search).get('s') || '';
const SITE_PAGE = PUBLIC ? location.origin + location.pathname : (document.body.dataset.sitePage || '');
const shareUrl = t => SITE_PAGE ? SITE_PAGE + '?s=' + t : location.origin + '/s/' + t;
const U = path => API + path;                                       // absolute API url for links and media
const view = $('#view');
let cleanup = [], charts = [];
const SERIES = ['#5b4cdb', '#16936b', '#e08a00', '#e5484d', '#0b84c6', '#a84fd6'];

/* ---------------- tiny helpers ---------------- */
function cookie(n) { const m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
async function api(url, opt = {}) {
  if (url.startsWith('/')) url = API + url;
  opt.credentials = 'include';
  opt.headers = Object.assign({ 'X-CSRFToken': cookie('csrftoken'), 'X-Voice': '1' }, opt.headers || {});
  if (opt.json !== undefined) { opt.body = JSON.stringify(opt.json); opt.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(url, opt);
  const data = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
  if (!r.ok) throw new Error((data && data.error) || r.statusText);
  return data;
}
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(3)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmtClock = s => { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
const fmtLen = s => s < 60 ? `${Math.round(s)} sec` : s < 3600 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} sec` : `${(s / 3600).toFixed(1)} hours`;
function fmtWhen(iso) {
  const d = new Date(iso), now = new Date(), day = 864e5;
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Today, ' + t;
  if (d.toDateString() === new Date(now - day).toDateString()) return 'Yesterday, ' + t;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ', ' + t;
}
function leave() { cleanup.forEach(f => { try { f(); } catch (e) { } }); cleanup = []; charts.forEach(c => c.destroy()); charts = []; }
function mkChart(cv, cfg) {
  Chart.defaults.color = css('--muted'); Chart.defaults.borderColor = css('--line');
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.font.size = 12;
  const c = new Chart(cv, cfg); charts.push(c); return c;
}
/* shaded "comfortable range" band behind a chart */
const bandPlugin = (lo, hi, label) => ({
  id: 'band', beforeDatasetsDraw(c) {
    const { ctx, chartArea: a, scales: { y } } = c; if (!a) return;
    const y0 = y.getPixelForValue(hi), y1 = y.getPixelForValue(lo);
    ctx.save(); ctx.fillStyle = css('--good-soft'); ctx.fillRect(a.left, Math.max(a.top, y0), a.right - a.left, Math.min(a.bottom, y1) - Math.max(a.top, y0));
    ctx.fillStyle = css('--good'); ctx.font = '600 11px ' + Chart.defaults.font.family; ctx.fillText(label, a.left + 8, Math.max(a.top, y0) + 14); ctx.restore();
  }
});

/* ---------------- icons ---------------- */
const IC = {
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', chev: '<path d="M9 5l7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/>',
  pace: '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 14l4-5"/><circle cx="12" cy="14.5" r="1.2" fill="currentColor"/>',
  rate: '<path d="M9.5 3h5l4 18h-13z"/><path d="M12 16l5-9"/><path d="M7.5 16h9"/>',
  pauses: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
  variety: '<path d="M2 13c1.5-5 3-5 4.5 0s3 5 4.5 0 3-9 4.5-4 3 9 4.5 4"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  fillers: '<path d="M4 5.5h16v10H10l-5 4v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="2.6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.6.6.8 1.3.8 2.4h6c0-1.1.2-1.8.8-2.4A6 6 0 0 0 12 3z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>', note: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>', refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  compare: '<path d="M8 3v18M16 3v18M3 8h5M16 16h5"/>', scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 20 18M8.5 16.5 20 6"/>',
};
function icon(n, size = 20, sw = 2) { return h('span', { class: 'ic', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>` }); }

/* ---------------- toasts ---------------- */
function toast(msg, action, ms = 4200) {
  const t = h('div', { class: 'toast' }, msg, action && h('button', { onclick: () => { action[1](); t.remove(); } }, action[0]));
  $('#toasts').append(t); setTimeout(() => t.remove(), ms); return t;
}

/* ---------------- theme ---------------- */
function paintThemeBtn() { const dark = css('--bg') === '#14131b'; $('#themeBtn').replaceChildren(icon(dark ? 'sun' : 'moon', 20)); }
(function () {
  try { const s = localStorage.getItem('theme'); if (s) document.documentElement.dataset.theme = s; } catch (e) { }
  paintThemeBtn();
  $('#themeBtn').onclick = () => {
    const n = css('--bg') === '#14131b' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n; try { localStorage.setItem('theme', n); } catch (e) { }
    paintThemeBtn(); route();
  };
})();

// Any page that cannot reach the server says so once, instead of staying empty without a word.
let lastDown = 0;
addEventListener('unhandledrejection', e => {
  if (!(e.reason instanceof TypeError) || Date.now() - lastDown < 10000) return;
  lastDown = Date.now();
  toast(navigator.onLine === false ? 'You seem to be offline.' : 'Voice Coach is not answering right now. Please try again in a few minutes.', null, 7000);
});

/* ---------------- router ---------------- */
function route() {
  leave();
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || ''); let name = 'home', m;
  if (SHARE) { name = ''; renderResult(null, true); }
  else if ((m = path.match(/^\/r\/(\d+)/))) { name = 'recordings'; renderResult(+m[1]); }
  else if (path === '/recordings') { name = 'recordings'; renderRecordings(); }
  else if (path === '/progress') { name = 'progress'; renderProgress(); }
  else if (path === '/compare') { name = 'progress'; renderCompare(params.get('ids')); }
  else renderHome(path === '/record');
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.r === name));
  window.scrollTo(0, 0);
}
addEventListener('hashchange', route);
if (SHARE) { $('#nav').classList.add('hidden'); $('#foot').classList.add('hidden'); }
if (PUBLIC && !SHARE) $('#foot').replaceChildren('Voice Coach by ', h('a', { href: '/' }, 'Arash Ahmadi'), '. Recordings are private to this browser and stored only so you can come back to them.');
if (SHARE && PUBLIC) { const b = document.querySelector('.brand'); if (b) b.setAttribute('href', SITE_PAGE); }

/* ---------------- upload with progress (button, drag & drop) ---------------- */
function uploadFiles(files, extra = {}) {
  files = [...files].filter(f => f.size);
  if (!files.length) return Promise.resolve([]);
  const bar = h('i'), t = h('div', { class: 'toast' }, `Uploading ${files.length > 1 ? files.length + ' files' : '“' + files[0].name + '”'}`, h('div', { class: 'bar' }, bar));
  $('#toasts').append(t);
  return new Promise(res => {
    const fd = new FormData(); files.forEach(f => fd.append('files', f)); Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    const x = new XMLHttpRequest(); x.open('POST', U('/api/recordings')); x.withCredentials = true;
    x.setRequestHeader('X-CSRFToken', cookie('csrftoken')); x.setRequestHeader('X-Voice', '1');
    x.upload.onprogress = e => { if (e.lengthComputable) bar.style.width = (e.loaded / e.total * 100) + '%'; };
    // uploadFiles.why tells the caller why nothing was saved: 'offline' (this device), 'server' (no answer), or the server's own words
    const fail = (why, msg) => { t.remove(); uploadFiles.why = why; toast(msg, null, 7000); res([]); };
    uploadFiles.why = '';
    x.onload = () => {
      let d = null; try { d = JSON.parse(x.responseText); } catch (e) { }
      if (d && x.status < 300) { t.remove(); return res(d.ids); }
      if (d && d.error) return fail(d.error, 'Upload failed: ' + d.error);
      fail('server', 'Upload failed. The Voice Coach server did not answer properly. Please try again in a few minutes.');
    };
    x.onerror = () => navigator.onLine === false ? fail('offline', 'Upload failed. You seem to be offline. Check your connection.')
      : fail('server', 'Upload failed. The Voice Coach server did not answer. Please try again in a few minutes.');
    x.send(fd);
  });
}
function pickFiles() {
  const inp = h('input', { type: 'file', multiple: true, accept: 'audio/*,video/*,.m4a,.mp3,.wav,.ogg,.webm,.flac,.aac,.mp4,.mov' });
  inp.onchange = async () => { const ids = await uploadFiles(inp.files); afterUpload(ids); };
  inp.click();
}
function afterUpload(ids) { if (ids.length === 1) location.hash = '#/r/' + ids[0]; else if (ids.length) { toast(`${ids.length} files uploaded. They are being analysed.`); location.hash === '#/recordings' ? route() : location.hash = '#/recordings'; } }
if (!SHARE) {
  let n = 0;
  addEventListener('dragenter', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { n++; $('#drop').classList.remove('hidden'); } });
  addEventListener('dragleave', () => { if (--n <= 0) { n = 0; $('#drop').classList.add('hidden'); } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', async e => { e.preventDefault(); n = 0; $('#drop').classList.add('hidden'); if (e.dataTransfer.files.length) afterUpload(await uploadFiles(e.dataTransfer.files)); });
}

/* ---------------- shared bits ---------------- */
function drawMiniWave(cv, thumb, w = 120, hh = 40) {
  const dpr = devicePixelRatio || 1; cv.width = w * dpr; cv.height = hh * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = css('--wave-played'); g.globalAlpha = .55;
  if (!thumb) return; const [mn, mx] = thumb, n = Math.min(40, mn.length), step = mn.length / n, bw = w / n;
  for (let i = 0; i < n; i++) {
    let a = 0; for (let j = Math.floor(i * step); j < Math.floor((i + 1) * step); j++) a = Math.max(a, mx[j] - mn[j]);
    const bh = Math.max(3, Math.min(1, a * 1.1) * hh); g.beginPath(); g.roundRect(i * bw + 1, (hh - bh) / 2, Math.max(2, bw - 2.5), bh, 2); g.fill();
  }
}
function levelChip(l) { return l ? h('span', { class: 'chip lv-' + l.level }, l.label) : null; }
function recItem(r, opts = {}) {
  const cv = h('canvas', { 'aria-hidden': 'true' }), s = r.summary;
  const sub = r.status === 'ready' ? `${fmtWhen(r.created)} · ${fmtLen(r.duration)}` : r.status === 'error' ? 'Could not read this file' : 'Analysing…';
  const el = h('a', { class: 'item', href: '#/r/' + r.id },
    opts.select ? h('input', { type: 'checkbox', 'aria-label': 'Select ' + r.title, checked: opts.selected, onclick: e => { e.stopPropagation(); }, onchange: e => opts.select(r.id, e.target.checked) }) : null,
    cv,
    h('div', { class: 'main' }, h('div', { class: 't' }, r.title), h('div', { class: 'sub' }, r.status === 'processing' ? [h('span', { class: 'spin', style: 'width:12px;height:12px;vertical-align:-1px;margin-right:6px' }), sub] : sub)),
    h('div', { class: 'chips' }, s && s.labels.pace ? levelChip({ label: s.labels.pace.label + ' pace', level: s.labels.pace.level }) : null, r.shared ? h('span', { class: 'chip lv-none' }, icon('link', 13), 'Shared') : null));
  requestAnimationFrame(() => drawMiniWave(cv, r.thumb));
  return el;
}
function menu(btn, items) {
  $$('.menu-pop').forEach(p => p.remove());
  const pop = h('div', { class: 'menu-pop', role: 'menu' }, items.filter(Boolean).map(it => it === '-' ? h('hr') :
    it.href ? h('a', { href: it.href, download: it.download ? '' : null, role: 'menuitem', onclick: () => pop.remove() }, icon(it.icon || 'doc', 18), h('span', {}, it.label, it.sub && h('small', {}, it.sub)))
      : h('button', { role: 'menuitem', onclick: () => { pop.remove(); it.fn(); } }, icon(it.icon || 'doc', 18), h('span', {}, it.label, it.sub && h('small', {}, it.sub)))));
  btn.parentElement.append(pop);
  setTimeout(() => addEventListener('click', function f(e) { if (!pop.contains(e.target)) { pop.remove(); removeEventListener('click', f); } }), 0);
}

function confirmDelete(ids, done) {
  const dlg = $('#modal'), n = ids.length;
  dlg.replaceChildren(h('h2', {}, n === 1 ? 'Delete this recording?' : `Delete ${n} recordings?`),
    h('p', { class: 'muted' }, 'The audio, transcript and results are removed from the server for good. Share links stop working. This cannot be undone.'),
    h('div', { class: 'row', style: 'margin-top:20px' }, h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
      h('button', { class: 'btn primary', style: 'background:var(--warn);border-color:var(--warn)', onclick: async () => {
        for (const id of ids) { try { await api('/api/recordings/' + id, { method: 'DELETE' }); } catch (e) { toast('Could not delete: ' + e.message); } }
        dlg.close(); toast(n === 1 ? 'Deleted.' : `Deleted ${n}.`); done && done();
      } }, 'Delete')));
  dlg.showModal();
}

/* ---------------- home: record ---------------- */
const PROMPTS = [
  'Describe your morning so far, from the moment you woke up.',
  'Tell someone about a place you would love to visit, and why.',
  'Explain how to cook a meal you like, step by step.',
  'Talk about a film, book or show you enjoyed recently.',
  'Introduce yourself as if you were meeting a new colleague.',
  'Explain your research or your major to someone outside your field.',
  'Open a class presentation: say what the topic is and why it matters.',
  'Read aloud: “The morning train was late again, so Maya bought a coffee and watched the platform fill up. A man with a bright yellow umbrella was arguing with a pigeon about a sandwich. By the time the train arrived, half the crowd was laughing, and nobody seemed to mind the delay any more.”',
];
let keptTake = null;    // a recorded take whose upload failed; kept in memory (not in browser storage) until saved or discarded
let leaveGuard = null;  // true while leaving the page would lose a recording
addEventListener('beforeunload', e => { if (keptTake || (leaveGuard && leaveGuard())) { e.preventDefault(); e.returnValue = ''; } });
async function renderHome(autostart) {
  view.innerHTML = '';
  let stream, rec, chunks = [], t0 = 0, acc = 0, state = 'idle', raf, ctx, an, pi = Math.floor(Math.random() * PROMPTS.length);
  const timer = h('div', { class: 'timer hidden' }, '0:00');
  const live = h('canvas', { class: 'live-wave hidden', 'aria-hidden': 'true' });
  const recBtn = h('button', { class: 'rec-btn', 'aria-label': 'Start recording' }, icon('mic', 46, 2));
  const label = h('div', { class: 'rec-label' }, 'Tap to start recording');
  const pauseBtn = h('button', { class: 'btn' }, icon('pause', 18), 'Pause');
  const cancelBtn = h('button', { class: 'btn ghost' }, 'Cancel');
  const actions = h('div', { class: 'rec-actions hidden' }, pauseBtn, cancelBtn);
  const retryBtn = h('button', { class: 'btn primary' }, icon('upload', 18), 'Try again');
  const fileBtn = h('button', { class: 'btn' }, 'Save the file');
  const dropBtn = h('button', { class: 'btn ghost' }, 'Discard');
  const keep = h('div', { class: 'rec-actions hidden' }, retryBtn, fileBtn, dropBtn);
  const err = h('div', { class: 'err hidden', role: 'alert' });
  const off = h('div', { class: 'err hidden', role: 'status' });
  const promptBox = h('div', { class: 'prompt hidden' });
  const showPrompt = () => { promptBox.classList.remove('hidden'); promptBox.replaceChildren(h('div', { class: 'muted' }, 'Something to talk about'), h('div', {}, PROMPTS[pi]), h('button', { class: 'link-btn small', style: 'margin-top:8px', onclick: () => { pi = (pi + 1) % PROMPTS.length; showPrompt(); } }, 'Another idea')); };
  const alt = h('div', { class: 'alt' },
    h('button', { class: 'btn', onclick: pickFiles }, icon('upload', 18), 'Upload a file'),
    h('button', { class: 'btn ghost', onclick: showPrompt }, icon('sparkle', 18), 'Give me something to say'));
  const hero = h('section', { class: 'card hero' },
    h('h1', {}, 'How do you sound?'),
    h('p', { class: 'lead' }, 'Talk for about 30 seconds, like the start of a class presentation. You get friendly feedback on your pace, pauses and voice, plus a written transcript.'),
    PUBLIC ? h('p', { class: 'muted small', style: 'margin-top:10px' }, 'Free, no sign-up. Your recordings are private to this browser; nobody else can see them unless you share a link. You can delete them any time.') : null,
    off, h('div', { class: 'rec-wrap' }, recBtn, label, timer, live, actions, keep), err, promptBox, alt);
  const features = h('div', { class: 'features' },
    [['pace', 'Speaking pace', 'Are you rushing, or easy to follow?'], ['variety', 'Voice melody', 'Lively and expressive, or a bit flat?'], ['text', 'Transcript', 'See every word, with “um”s highlighted.']]
      .map(([i, t, d]) => h('div', { class: 'card feature' }, icon(i, 20), h('div', {}, h('h3', {}, t), h('p', {}, d)))));
  const recent = h('div');
  view.append(hero, features, recent);

  // recent recordings
  api('/api/recordings?sort=new').then(({ recordings }) => {
    if (!recordings.length) return;
    recent.append(h('div', { class: 'section-head' }, h('h2', {}, 'Recent recordings'), h('div', { class: 'spacer' }), h('a', { class: 'btn sm ghost', href: '#/recordings' }, 'See all', icon('chev', 16))),
      h('div', { class: 'list' }, recordings.slice(0, 3).map(r => recItem(r))));
  }).catch(e => { if (e instanceof TypeError) serverDown(); });
  // The server is a computer that can be switched off: say so before someone records, and notice when it is back.
  let downTimer = 0;
  function serverDown() {
    off.textContent = navigator.onLine === false ? 'You seem to be offline. You can record once your connection is back.'
      : 'Voice Coach is offline at the moment, so a recording cannot be analysed right now. This page will notice when it is back.';
    off.classList.remove('hidden');
    clearTimeout(downTimer);
    downTimer = setTimeout(() => api('/api/recordings?sort=new').then(() => { off.classList.add('hidden'); }).catch(serverDown), 15000);
  }
  cleanup.push(() => clearTimeout(downTimer));

  const elapsed = () => acc + (state === 'rec' ? (performance.now() - t0) / 1000 : 0);
  function draw() {
    raf = requestAnimationFrame(draw);
    timer.textContent = fmtClock(elapsed());
    if (!an) return;
    const dpr = devicePixelRatio || 1, w = live.clientWidth, hh = live.clientHeight;
    if (live.width !== Math.round(w * dpr)) { live.width = Math.round(w * dpr); live.height = Math.round(hh * dpr); }
    const g = live.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hh);
    const buf = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(buf);
    const bars = 36, bw = w / bars; g.fillStyle = state === 'rec' ? css('--rec') : css('--muted');
    for (let i = 0; i < bars; i++) {
      const k = Math.floor(Math.pow(i / bars, 1.6) * buf.length * .5), v = buf[k] / 255;
      const bh = Math.max(4, v * hh * .95); g.beginPath(); g.roundRect(i * bw + 2, (hh - bh) / 2, bw - 4, bh, 3); g.fill();
    }
  }
  function micError(e) {
    let msg = 'We could not start the microphone. ' + (e.message || '');
    if (!window.isSecureContext) msg = 'Microphones only work on a secure page. Open the https:// address of this site and try again.';
    else if (e.name === 'NotAllowedError') msg = 'Your browser blocked the microphone. Click the lock or microphone icon next to the address bar, choose “Allow”, then try again.';
    else if (e.name === 'NotFoundError') msg = 'No microphone was found. Plug one in, or upload a recording instead.';
    else if (e.name === 'NotReadableError') msg = 'Another app is using your microphone. Close it and try again.';
    err.textContent = msg; err.classList.remove('hidden');
  }
  async function start() {
    err.classList.add('hidden');
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } }); }
    catch (e) { micError(e); return; }
    ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream); an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = .7; src.connect(an);
    rec = new MediaRecorder(stream); chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = save;
    rec.start(250); state = 'rec'; t0 = performance.now(); acc = 0;
    recBtn.classList.add('live'); recBtn.replaceChildren(icon('stop', 40)); recBtn.setAttribute('aria-label', 'Stop and get feedback');
    label.textContent = 'Recording… tap to stop'; timer.classList.remove('hidden'); live.classList.remove('hidden'); actions.classList.remove('hidden'); alt.classList.add('hidden');
  }
  function stopAll() { if (stream) stream.getTracks().forEach(t => t.stop()); if (ctx && ctx.state !== 'closed') ctx.close(); an = null; }
  async function save() {
    stopAll();
    if (state === 'cancel') { reset(); return; }
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    label.textContent = 'Saving…'; recBtn.disabled = true; actions.classList.add('hidden');
    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
    const title = 'Recording, ' + new Date().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    keptTake = { file: new File([blob], 'recording.' + ext, { type: blob.type }), title };
    send();
  }
  // A take is never thrown away because the upload failed: it stays on the page until it is saved, downloaded or discarded.
  async function send() {
    state = 'saving'; label.textContent = 'Saving…'; recBtn.disabled = true; actions.classList.add('hidden'); keep.classList.add('hidden'); err.classList.add('hidden');
    timer.classList.add('hidden'); live.classList.add('hidden'); alt.classList.add('hidden');
    const ids = await uploadFiles([keptTake.file], { source: 'record', title: keptTake.title });
    if (ids.length) { keptTake = null; location.hash = '#/r/' + ids[0]; return; }
    showKept(uploadFiles.why);
  }
  function showKept(why) {
    state = 'kept'; recBtn.disabled = true; label.textContent = 'Not saved yet';
    recBtn.classList.remove('live'); recBtn.replaceChildren(icon('mic', 46, 2));
    timer.classList.add('hidden'); live.classList.add('hidden'); actions.classList.add('hidden'); alt.classList.add('hidden');
    err.textContent = (why === 'offline' ? 'You seem to be offline. ' : why === 'server' || !why ? 'The Voice Coach server did not answer. ' : 'The recording could not be saved (' + why + '). ')
      + 'Your recording is still here. Try again in a minute, or save the file and upload it later.';
    err.classList.remove('hidden'); keep.classList.remove('hidden');
  }
  retryBtn.onclick = send;
  fileBtn.onclick = () => {
    const a = h('a', { href: URL.createObjectURL(keptTake.file), download: keptTake.file.name }); document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
  dropBtn.onclick = () => { if (!confirm('Discard this recording? It has not been saved.')) return; keptTake = null; reset(); toast('Recording discarded.'); };
  function reset() {
    keep.classList.add('hidden'); err.classList.add('hidden');
    state = 'idle'; recBtn.disabled = false; recBtn.classList.remove('live'); recBtn.replaceChildren(icon('mic', 46, 2)); recBtn.setAttribute('aria-label', 'Start recording');
    label.textContent = 'Tap to start recording'; timer.classList.add('hidden'); live.classList.add('hidden'); actions.classList.add('hidden'); alt.classList.remove('hidden');
    pauseBtn.replaceChildren(icon('pause', 18), 'Pause');
  }
  recBtn.onclick = () => {
    if (state === 'idle') return start();
    acc = elapsed();
    if (acc < 1.5) { toast('That was very short. Keep talking a little longer.'); return; }
    state = 'stopping'; rec.stop();
  };
  pauseBtn.onclick = () => {
    if (state === 'rec') { acc = elapsed(); state = 'pause'; rec.pause(); pauseBtn.replaceChildren(icon('mic', 18), 'Resume'); label.textContent = 'Paused'; }
    else if (state === 'pause') { t0 = performance.now(); state = 'rec'; rec.resume(); pauseBtn.replaceChildren(icon('pause', 18), 'Pause'); label.textContent = 'Recording… tap to stop'; }
  };
  cancelBtn.onclick = () => { state = 'cancel'; rec.stop(); toast('Recording discarded.'); };
  draw();
  leaveGuard = () => state === 'rec' || state === 'pause' || state === 'stopping' || state === 'saving' || state === 'kept';
  if (keptTake) showKept('');   // came back to this page with a take that is still waiting to be saved
  cleanup.push(() => { leaveGuard = null; cancelAnimationFrame(raf); if (state === 'rec' || state === 'pause') { state = 'cancel'; try { rec.stop(); } catch (e) { } } stopAll(); });
}

/* ---------------- recordings ---------------- */
async function renderRecordings() {
  const st = { q: '', archived: false, sel: new Set() };
  view.innerHTML = '';
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Search recordings', 'aria-label': 'Search recordings', oninput: e => { st.q = e.target.value; load(); } });
  const listEl = h('div', { class: 'list' }), bulk = h('div', { class: 'bulkbar hidden' });
  const archBtn = h('button', { class: 'link-btn small', onclick: () => { st.archived = !st.archived; st.sel.clear(); load(); } });
  view.append(
    h('div', { class: 'row' }, h('h1', {}, 'My recordings'), h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: pickFiles }, icon('upload', 18), 'Upload'),
      h('a', { class: 'btn primary', href: '#/record' }, icon('mic', 18), 'New recording')),
    h('div', { class: 'row', style: 'margin:22px 0 14px' }, search, h('div', { class: 'spacer' }),
      h('div', { class: 'menu' }, h('button', { class: 'btn sm ghost', onclick: e => menu(e.currentTarget, [
        { label: 'Download everything', sub: 'Audio, transcripts and results (ZIP)', icon: 'download', href: U('/api/export?format=zip'), download: true },
        { label: 'Results table', sub: 'One row per recording (CSV, opens in Excel)', icon: 'doc', href: U('/api/export?format=csv'), download: true }]) }, icon('download', 17), 'Download all'))),
    listEl, h('div', { style: 'text-align:center;margin-top:22px' }, archBtn), bulk);
  let timer;
  async function load() {
    clearTimeout(timer);
    archBtn.textContent = st.archived ? '← Back to my recordings' : 'Show archived recordings';
    const { recordings } = await api('/api/recordings?' + new URLSearchParams({ q: st.q, archived: st.archived ? 1 : 0, sort: 'new' }));
    listEl.replaceChildren();
    if (!recordings.length) listEl.append(h('div', { class: 'card empty' }, st.q ? 'Nothing matches your search.' : st.archived ? 'No archived recordings.' :
      [h('h2', { style: 'color:var(--ink);margin-bottom:6px' }, 'No recordings yet'), 'Make your first recording, or drop an audio file anywhere on this page.', h('div', { style: 'margin-top:16px' }, h('a', { class: 'btn primary', href: '#/record' }, icon('mic', 18), 'Record now'))]));
    recordings.forEach(r => listEl.append(recItem(r, { selected: st.sel.has(r.id), select: (id, on) => { on ? st.sel.add(id) : st.sel.delete(id); bar(); } })));
    bar();
    if (recordings.some(r => r.status === 'processing')) timer = setTimeout(load, 1500);
  }
  function bar() {
    const ids = [...st.sel].join(','), n = st.sel.size; bulk.classList.toggle('hidden', !n);
    bulk.replaceChildren(h('b', {}, `${n} selected`), h('div', { class: 'spacer' }),
      n > 1 ? h('a', { class: 'btn sm', href: '#/compare?ids=' + ids }, icon('compare', 16), 'Compare') : null,
      h('a', { class: 'btn sm', href: U('/api/export?format=zip&ids=' + ids) }, icon('download', 16), 'Download'),
      h('button', { class: 'btn sm', onclick: async () => { const sel = [...st.sel]; for (const id of sel) await api('/api/recordings/' + id, { method: 'PATCH', json: { archived: !st.archived } }); st.sel.clear(); load();
        toast(st.archived ? 'Restored.' : `Archived ${sel.length}.`, st.archived ? null : ['Undo', async () => { for (const id of sel) await api('/api/recordings/' + id, { method: 'PATCH', json: { archived: false } }); load(); }]); } }, icon('archive', 16), st.archived ? 'Restore' : 'Archive'),
      PUBLIC ? h('button', { class: 'btn sm', onclick: () => confirmDelete([...st.sel], () => { st.sel.clear(); load(); }) }, icon('x', 16), 'Delete') : null,
      h('button', { class: 'btn sm', 'aria-label': 'Clear selection', onclick: () => { st.sel.clear(); load(); } }, icon('x', 16)));
  }
  cleanup.push(() => clearTimeout(timer));
  load();
}

/* ---------------- result ---------------- */
function gauge(sc) {
  const span = sc.max - sc.min, pct = v => Math.max(0, Math.min(100, (v - sc.min) / span * 100));
  const zones = sc.zones.map(([lo, hi, lv, lab]) => ({ w: pct(Math.min(hi, sc.max)) - pct(Math.max(lo, sc.min)), lv, lab })).filter(z => z.w > 0);
  return h('div', { class: 'gauge-wrap' },
    h('div', { class: 'gauge' }, zones.map(z => h('i', { class: 'z-' + z.lv, style: `width:${z.w}%` }))),
    h('div', { class: 'marker', style: `left:${pct(sc.value)}%`, title: sc.value + (sc.suffix ? ' ' + sc.suffix : '') }),
    h('div', { class: 'gauge-labels' }, zones.map(z => h('span', { style: `width:${z.w}%` }, z.w > 12 ? z.lab : ''))));
}
function insightCard(it) {
  return h('div', { class: 'card ins' },
    h('div', { class: 'ins-head' }, icon(it.id, 20), h('h3', {}, it.title), h('div', { class: 'spacer' }), levelChip(it)),
    h('div', { class: 'ins-val' }, h('b', {}, it.value), h('span', {}, it.unit)),
    gauge(it.scale), h('p', {}, it.explain), it.tip ? h('div', { class: 'tipline' }, icon('bulb', 18), h('span', {}, it.tip)) : null,
    it.source ? h('div', { class: 'source' }, it.source) : null);
}
function scoreRing(score) {
  const r = 32, c = 2 * Math.PI * r, col = score >= 70 ? css('--good') : score >= 40 ? css('--ok') : css('--warn');
  return h('div', { class: 'ring', title: 'How many areas look good' }, h('span', { html: `<svg viewBox="0 0 76 76" width="76" height="76"><circle cx="38" cy="38" r="${r}" fill="none" stroke="${css('--line')}" stroke-width="8"/><circle cx="38" cy="38" r="${r}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c * score / 100} ${c}" transform="rotate(-90 38 38)"/></svg>` }), h('b', {}, score));
}

async function renderResult(id, shared = false) {
  leave();
  const base = U(shared ? `/api/shared/${SHARE}` : `/api/recordings/${id}`);
  let meta, A, timer, tTimer;
  cleanup.push(() => { clearTimeout(timer); clearTimeout(tTimer); });
  view.innerHTML = '<div class="processing"><span class="spin"></span></div>';
  try { if (shared) { A = await api(base); meta = A.meta; } else { meta = await api(base); if (meta.status === 'ready') A = await api(base + '/analysis'); } }
  catch (e) { view.replaceChildren(h('div', { class: 'card empty' }, h('h2', { style: 'color:var(--ink)' }, 'This recording is not available'), h('p', { style: 'margin-top:6px' }, shared ? 'The link may have been switched off.' : 'It may have been removed.'), !shared && h('a', { class: 'btn', href: '#/recordings', style: 'margin-top:16px' }, 'My recordings'))); return; }

  if (meta.status !== 'ready') {
    const failed = meta.status === 'error';
    view.replaceChildren(h('div', { class: 'card processing' },
      failed ? [h('h2', {}, 'We could not read this file'), h('p', { class: 'muted', style: 'margin-top:8px' }, 'It may not contain audio, or the format is not supported. Try another file.'), h('a', { class: 'btn', href: '#/', style: 'margin-top:18px' }, 'Back')]
        : [h('h2', {}, 'Listening to your recording…'), h('div', { class: 'steps' },
          h('div', { class: 'step done' }, icon('check', 20), 'Uploaded'), h('div', { class: 'step now' }, h('span', { class: 'spin' }), 'Checking pace, pauses and voice'),
          h('div', { class: 'step' }, icon('text', 20), 'Writing the transcript'))]));
    if (!failed) timer = setTimeout(() => renderResult(id, shared), 1200);
    return;
  }

  const dur = A.duration;
  const audio = h('audio', { src: base + '/audio', preload: 'auto' });
  const ticks = [];   // functions called with currentTime while playing / on seek
  let raf;
  function tick() { ticks.forEach(f => f(audio.currentTime)); if (!audio.paused) raf = requestAnimationFrame(tick); }
  cleanup.push(() => { audio.pause(); cancelAnimationFrame(raf); });

  /* --- title & actions --- */
  const titleEl = shared ? h('h1', {}, meta.title) : h('input', { class: 'title-edit', value: meta.title, 'aria-label': 'Recording name', onchange: async e => { const v = e.target.value.trim() || 'Untitled'; await api(base, { method: 'PATCH', json: { title: v } }); meta.title = v; toast('Name saved.'); }, onkeydown: e => { if (e.key === 'Enter') e.target.blur(); } });
  const dl = f => `${base}/export?format=${f}`;
  const downloadItems = () => [
    { label: 'Audio', sub: 'MP3 file', icon: 'note', href: dl('mp3'), download: true },
    { label: 'Report', sub: 'PDF with your results', icon: 'doc', href: dl('pdf'), download: true },
    A.transcript ? { label: 'Transcript', sub: 'Plain text', icon: 'text', href: dl('txt'), download: true } : null,
    A.transcript ? { label: 'Subtitles', sub: 'SRT, for video editors', icon: 'text', href: dl('srt'), download: true } : null,
    '-',
    { label: 'More formats', sub: 'WAV, data files, original', icon: 'more', fn: () => menu(dlBtn, [
      { label: 'WAV audio', sub: 'Uncompressed', icon: 'note', href: dl('wav'), download: true },
      !shared ? { label: 'Original file', sub: 'Exactly as uploaded', icon: 'note', href: dl('original'), download: true } : null,
      { label: 'Results (JSON)', sub: 'For developers', icon: 'doc', href: dl('json'), download: true },
      { label: 'Pauses (CSV)', sub: 'Start, end and length of every pause', icon: 'doc', href: dl('pauses'), download: true },
      { label: 'Measurements (CSV)', sub: 'Every 10 ms, for spreadsheets', icon: 'doc', href: dl('csv'), download: true },
      A.transcript ? { label: 'Subtitles (VTT)', sub: 'For the web', icon: 'text', href: dl('vtt'), download: true } : null].filter(Boolean)) }].filter(Boolean);
  const dlBtn = h('button', { class: 'btn', onclick: e => menu(e.currentTarget, downloadItems()) }, icon('download', 18), 'Download');
  const moreBtn = h('button', { class: 'btn', 'aria-label': 'More options', onclick: e => menu(e.currentTarget, [
    { label: 'Rename', icon: 'edit', fn: () => { titleEl.focus(); titleEl.select(); } },
    { label: 'Compare with others', icon: 'compare', fn: () => location.hash = '#/compare?ids=' + id },
    { label: 'Analyse again', sub: 'Run the analysis from scratch', icon: 'refresh', fn: async () => { await api(base + '/reanalyze', { method: 'POST' }); renderResult(id); } },
    '-',
    PUBLIC ? { label: 'Delete permanently', sub: 'Removes the audio and results from the server', icon: 'x', fn: () => confirmDelete([id], () => { location.hash = '#/recordings'; }) } : null,
    { label: meta.archived ? 'Restore' : 'Archive', sub: meta.archived ? 'Back to your list' : 'Hide it from your list (you can undo)', icon: 'archive', fn: async () => {
      await api(base, { method: 'PATCH', json: { archived: !meta.archived } });
      if (meta.archived) { toast('Restored.'); renderResult(id); return; }
      location.hash = '#/recordings'; toast('Archived.', ['Undo', async () => { await api(base, { method: 'PATCH', json: { archived: false } }); location.hash = '#/r/' + id; }]);
    } }]) }, icon('more', 18));
  const actions = h('div', { class: 'actions' }, !shared && h('button', { class: 'btn', onclick: () => shareDialog() }, icon(meta.shared ? 'link' : 'share', 18), meta.shared ? 'Shared' : 'Share'),
    h('div', { class: 'menu' }, dlBtn), !shared && h('div', { class: 'menu' }, moreBtn));

  /* --- player --- */
  const playBtn = h('button', { class: 'play-btn', 'aria-label': 'Play' }, icon('play', 26));
  const waveCv = h('canvas'), waveBox = h('div', { class: 'wave-main', role: 'slider', tabindex: 0, 'aria-label': 'Playback position', 'aria-valuemin': 0, 'aria-valuemax': Math.round(dur) }, waveCv);
  const tNow = h('span', {}, '0:00'), speeds = [1, 1.25, 1.5, 0.75];
  const speedBtn = h('button', { class: 'btn sm ghost speed', title: 'Playback speed', onclick: () => { const i = (speeds.indexOf(audio.playbackRate) + 1) % speeds.length; audio.playbackRate = speeds[i]; speedBtn.textContent = speeds[i] + '×'; } }, '1×');
  const player = h('div', { class: 'card', style: 'padding:18px 20px' }, h('div', { class: 'player', style: 'margin:0' }, playBtn, h('div', { style: 'flex:1;min-width:0' }, waveBox, h('div', { class: 'ptime' }, tNow, h('span', {}, fmtClock(dur)))), speedBtn));
  const bins = 140;
  const amp = (() => { const n = A.peaks_min.length, out = []; for (let i = 0; i < bins; i++) { let a = 0; for (let j = Math.floor(i * n / bins); j < Math.floor((i + 1) * n / bins); j++) a = Math.max(a, A.peaks_max[j] - A.peaks_min[j]); out.push(a); } const mx = Math.max(...out, .01); return out.map(v => v / mx); })();
  function drawWave(t) {
    const dpr = devicePixelRatio || 1, w = waveBox.clientWidth, hh = 72; if (!w) return;
    if (waveCv.width !== Math.round(w * dpr)) { waveCv.width = Math.round(w * dpr); waveCv.height = hh * dpr; }
    const g = waveCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hh);
    const bw = w / bins, played = t / dur * w;
    for (let i = 0; i < bins; i++) { const bh = Math.max(4, amp[i] * hh * .92); g.fillStyle = i * bw < played ? css('--wave-played') : css('--wave'); g.beginPath(); g.roundRect(i * bw + 1, (hh - bh) / 2, Math.max(2, bw - 2.5), bh, 2); g.fill(); }
    tNow.textContent = fmtClock(t); waveBox.setAttribute('aria-valuenow', Math.round(t));
  }
  ticks.push(drawWave);
  waveBox.addEventListener('pointerdown', e => { const r = waveBox.getBoundingClientRect(); audio.currentTime = Math.max(0, Math.min(dur, (e.clientX - r.left) / r.width * dur)); tick(); });
  waveBox.addEventListener('keydown', e => { if (e.key === 'ArrowRight') audio.currentTime = Math.min(dur, audio.currentTime + 5); if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5); tick(); });
  playBtn.onclick = () => audio.paused ? audio.play() : audio.pause();
  audio.onplay = () => { playBtn.replaceChildren(icon('pause', 26, 2.6)); playBtn.setAttribute('aria-label', 'Pause'); tick(); };
  audio.onpause = () => { playBtn.replaceChildren(icon('play', 26)); playBtn.setAttribute('aria-label', 'Play'); };
  audio.onended = () => { audio.currentTime = 0; tick(); };
  audio.onseeked = tick;
  const key = e => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return; if (e.code === 'Space') { e.preventDefault(); playBtn.click(); } };
  addEventListener('keydown', key); cleanup.push(() => removeEventListener('keydown', key));
  const onResize = () => tick(); addEventListener('resize', onResize); cleanup.push(() => removeEventListener('resize', onResize));

  /* --- summary + insights (re-rendered when the transcript arrives) --- */
  const summaryBox = h('div');
  function paintSummary() {
    const I = A.insights;
    if (I && A.intonation && A.intonation.level === 'warn' && I.tips.length < 3 && !I.tips.some(t => t.includes('statement'))) I.tips.push('Let your voice go down on the last word of each statement. It sounds more sure.');
    if (I && A.intonation && A.intonation.emphasis && A.intonation.emphasis.level === 'warn' && I.tips.length < 3 && !I.tips.some(t => t.includes('key word'))) I.tips.push('Few words stood out. Choose the key word in each phrase and make it longer, with more movement in your voice.');
    if (!I || !I.items.length) { summaryBox.replaceChildren(h('div', { class: 'card headline' }, h('div', { class: 'big' }, (I && I.headline) || 'This recording is too short to analyse.'))); return; }
    summaryBox.replaceChildren(
      h('div', { class: 'headline' }, scoreRing(I.score),
        h('div', { style: 'flex:1' }, h('div', { class: 'muted small', style: 'font-weight:700;letter-spacing:.04em;text-transform:uppercase' }, 'Summary'), h('div', { class: 'big' }, I.headline),
          I.tips.length ? h('div', { class: 'tips' }, I.tips.map(t => h('div', { class: 'tip' }, icon('bulb', 18), h('span', {}, t)))) : h('div', { class: 'tip', style: 'margin-top:10px' }, icon('check', 18), h('span', {}, 'Nothing to fix. Nice work!')))),
      h('div', { class: 'insights' }, I.items.map(insightCard)),
      h('div', { class: 'profile-note' }, icon('sparkle', 16), h('span', {}, 'Ranges are set for academic English spoken by international students and scholars: presentations, lectures and teaching. '), h('button', { class: 'link-btn small', onclick: sourcesDialog }, 'Where do these ranges come from?')));
  }

  /* --- transcript --- */
  const trBox = h('div', { class: 'card' }); let words = [], lastW = -1;
  const FILL = new Set(['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm']);
  const emTitle = w => (w.em === 2 ? 'Heavily emphasized' : 'Slightly emphasized') + (w.why && w.why.length ? ': ' + w.why.join(', ') : '');
  function paintTranscript() {
    words = []; lastW = -1;
    const head = h('div', { class: 'row', style: 'margin-bottom:12px' }, icon('text', 20), h('h2', {}, 'Transcript'));
    const t = A.transcript;
    if (!t) {
      const running = meta.tstatus === 'running';
      trBox.replaceChildren(head, running ? h('div', { class: 'row muted' }, h('span', { class: 'spin' }), 'Writing the transcript… this usually takes a few seconds.')
        : shared ? h('p', { class: 'muted' }, 'No transcript for this recording.')
          : h('div', { class: 'row' }, h('p', { class: 'muted' }, meta.tstatus === 'error' ? 'The transcript could not be created.' : 'No transcript yet.'),
            h('button', { class: 'btn sm', onclick: async () => { await api(base + '/transcribe', { method: 'POST' }); meta.tstatus = 'running'; paintTranscript(); pollTranscript(); } }, meta.tstatus === 'error' ? 'Try again' : 'Create transcript')));
      return;
    }
    head.append(h('div', { class: 'spacer' }), h('span', { class: 'muted small' }, `${t.word_count} words · tap a word to jump there`));
    const box = h('div', { class: 'transcript' });
    const EW = (A.intonation && A.intonation.words) || []; let wi = 0, anyEm = false;
    if (!t.word_count) box.append(h('span', { class: 'muted' }, 'No words were recognised.'));
    t.segments.forEach(sg => {
      const p = h('p', { style: 'margin:0 0 6px' });
      sg.words.forEach(w => {
        const clean = w.w.toLowerCase().replace(/[^a-z']/g, ''), ew = EW[wi++], em = ew && !FILL.has(clean) ? (ew.em || 0) : 0;
        if (em) anyEm = true;
        const s = h('span', { class: 'w' + (FILL.has(clean) ? ' filler' : '') + (em ? ' e' + em : ''), title: em ? emTitle(ew) : null, onclick: () => { audio.currentTime = w.s; audio.play(); } }, w.w);
        words.push({ s: w.s, e: w.e, el: s }); p.append(s, ' ');
      });
      box.append(p);
    });
    trBox.replaceChildren(head, box, h('p', { class: 'muted small tr-legend' },
      anyEm ? h('span', {}, h('b', { class: 'lg-e2' }, 'Bold'), ' heavily emphasized') : null,
      anyEm ? h('span', {}, h('span', { class: 'lg-e1' }, 'Underlined'), ' slightly emphasized') : null,
      Object.keys(t.fillers || {}).length ? h('span', {}, h('span', { class: 'chip lv-ok' }, 'um'), ' filler word') : null));
  }
  ticks.push(t => {
    if (!words.length) return; let lo = 0, hi = words.length - 1, idx = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (words[m].s <= t) { idx = m; lo = m + 1; } else hi = m - 1; }
    if (idx >= 0 && t > words[idx].e + .35) idx = -1;
    if (idx !== lastW) { if (lastW >= 0) words[lastW].el.classList.remove('now'); if (idx >= 0) words[idx].el.classList.add('now'); lastW = idx; }
  });
  function pollTranscript() {
    clearTimeout(tTimer);
    tTimer = setTimeout(async () => {
      if (shared) { const d = await api(base); if (d.meta.tstatus === 'running') return pollTranscript(); meta = d.meta; A = d; }
      else {
        meta = Object.assign(meta, await api(base));
        if (meta.tstatus === 'running') return pollTranscript();
        A = Object.assign(A, await api(base + '/analysis'));
      }
      paintTranscript(); paintSummary(); paintPace(); paintMelody();
      if (meta.tstatus === 'ready') toast('Transcript ready.');
    }, 2000);
  }

  /* --- pace through the recording --- */
  const paceCard = h('div', { class: 'card' }), paceCv = h('canvas');
  let paceChart;
  function paceSeries() {
    if (A.transcript && A.transcript.word_count > 8) {   // words per minute from word timestamps
      const ws = A.transcript.segments.flatMap(s => s.words), win = Math.min(6, dur), out = [];
      for (let t = win / 2; t <= dur - win / 2 + 1e-6; t += .5) out.push({ x: t, y: ws.filter(w => w.s >= t - win / 2 && w.s < t + win / 2).length / win * 60 });
      return { pts: out, how: 'words per minute' };
    }
    return { pts: (A.pace || []).map(([t, v]) => ({ x: t, y: v * 40 })), how: 'estimated words per minute' };
  }
  function paintPace() {
    if (dur < 8) { paceCard.classList.add('hidden'); return; }
    const { pts, how } = paceSeries();
    paceCard.replaceChildren(h('div', { class: 'row' }, icon('chart', 20), h('h2', {}, 'Your pace through the recording')),
      h('p', { class: 'muted small', style: 'margin-top:4px' }, `The green band is the range that is easiest to follow in academic talks (110–160 ${how}). Tap the chart to jump there.`), h('div', { class: 'chart-box' }, paceCv));
    if (paceChart) { paceChart.destroy(); charts = charts.filter(c => c !== paceChart); }
    paceChart = mkChart(paceCv, {
      type: 'line', plugins: [bandPlugin(110, 160, 'easy to follow')],
      data: { datasets: [{ data: pts, borderColor: css('--accent'), backgroundColor: css('--accent') + '18', fill: true, pointRadius: 0, tension: .35, borderWidth: 2.5 }] },
      options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: c => fmtClock(c[0].raw.x), label: c => Math.round(c.raw.y) + ' words/min' } } },
        scales: { x: { type: 'linear', min: 0, max: dur, ticks: { callback: v => fmtClock(v) }, grid: { display: false } }, y: { min: 0, suggestedMax: 220, title: { display: true, text: 'words / min' } } },
        onClick: (e, el, c) => { const x = c.scales.x.getValueForPixel(e.x); if (x >= 0) { audio.currentTime = x; tick(); } } }
    });
  }

  /* --- pitch and emphasis, word by word --- */
  const melCard = h('div', { class: 'card' });
  let melTexts = [];
  function paintMelody() {
    const M = A.intonation;
    melTexts = [];
    const head = h('div', { class: 'row' }, icon('variety', 20), h('h2', {}, 'Pitch and emphasis'));
    if (!M) {
      melCard.replaceChildren(head, h('p', { class: 'muted', style: 'margin-top:8px' },
        A.transcript ? 'There was not enough voiced speech to follow your melody.' : meta.tstatus === 'running' ? 'Waiting for the transcript…' : 'This needs the transcript. Create it in the Transcript section above.'));
      return;
    }
    const C = { rise: css('--rise'), fall: css('--fall'), level: css('--muted') };
    const stack = (parts, unit) => {
      const total = parts.reduce((a, x) => a + x.n, 0) || 1;
      return h('div', {},
        h('div', { class: 'stack', role: 'img', 'aria-label': parts.map(x => `${x.label}: ${x.n}`).join(', ') },
          parts.filter(x => x.n).map(x => h('i', { style: `flex:${x.n};background:${x.c}${x.ink ? ';color:' + x.ink : ''}`, title: `${x.label}: ${x.n} ${unit}` }, x.n / total >= 0.1 ? `${x.arrow ? x.arrow + ' ' : ''}${Math.round(x.n / total * 100)}%` : ''))),
        h('div', { class: 'stack-legend' }, parts.map(x => h('span', {}, h('span', { class: 'dot', style: `background:${x.c}` }), `${x.label} `, h('b', {}, x.n)))));
    };
    const ec = M.endings, E = M.emphasis || { counts: { heavy: 0, slight: 0, none: M.words.length }, verdict: '', level: 'none' };
    const emOf = w => FILL.has(w.w.toLowerCase().replace(/[^a-z']/g, '')) ? 0 : (w.em || 0);
    const graphs = h('div', { class: 'split', style: 'margin-top:14px' },
      h('div', { class: 'mel-box' }, h('div', { class: 'sub-head', style: 'margin-top:0' }, 'Emphasis on words'),
        stack([{ label: 'Heavily emphasized', n: E.counts.heavy, c: css('--accent'), ink: css('--accent-ink') }, { label: 'Slightly emphasized', n: E.counts.slight, c: css('--em-slight'), ink: css('--ink') },
          { label: 'Not emphasized', n: E.counts.none, c: css('--em-none'), ink: css('--muted') }], 'words')),
      h('div', { class: 'mel-box' }, h('div', { class: 'sub-head', style: 'margin-top:0' }, 'Final pitch movements'),
        stack([{ label: 'Down', n: ec.fall, c: C.fall, arrow: '↘' }, { label: 'Level', n: ec.level, c: C.level, arrow: '→' }, { label: 'Up', n: ec.rise, c: C.rise, arrow: '↗' }], 'sentences')));
    const verdict = h('div', { style: 'margin-top:12px;display:flex;flex-direction:column;gap:6px' },
      E.verdict ? h('div', { class: 'tipline' }, icon(E.level === 'good' ? 'check' : 'bulb', 18), h('span', {}, E.verdict)) : null,
      h('div', { class: 'tipline' }, icon(M.level === 'good' ? 'check' : 'bulb', 18), h('span', {}, M.verdict)));
    const lines = h('div', { class: 'mel-lines' });
    melCard.replaceChildren(head,
      h('p', { class: 'muted small', style: 'margin-top:4px' },
        'Words in ', h('b', { class: 'lg-e2' }, 'bold'), ' were heavily emphasized and ', h('span', { class: 'lg-e1' }, 'underlined'), ' words slightly. ',
        'A word stands out when you hold it longer, move your pitch on it, or say it higher or louder than the words around it. ',
        'The label after each sentence shows its final pitch movement: in English a statement usually ends going down, and a yes/no question often ends going up. Tap a word to hear it.'),
      graphs, verdict, lines);
    M.sentences.forEach(sn => {
      const box = h('div', { class: 'mel-sentence' }), row = h('div', { class: 'mel-words' });
      for (let i = sn.i0; i < sn.i1; i++) {
        const w = M.words[i];
        const em = emOf(w);
        const el = h('button', { class: 'mw e' + em, title: em ? emTitle(w) : 'Not emphasized',
          onclick: () => { audio.currentTime = Math.max(0, w.s - 0.05); audio.play(); } }, w.w);
        melTexts[i] = el; row.append(el);
      }
      box.append(row);
      const endTxt = { fall: ['↘ Ends going down', sn.question ? 'lv-none' : 'lv-good'], rise: ['↗ Ends going up', sn.question ? 'lv-good' : 'lv-ok'], level: ['→ Ends level', 'lv-ok'] }[sn.end];
      if (endTxt) box.append(h('div', { class: 'mel-end' }, sn.question ? h('span', { class: 'muted small' }, 'question') : null, h('span', { class: 'chip ' + endTxt[1] }, endTxt[0])));
      lines.append(box);
    });
  }
  let melLast = -1;
  ticks.push(t => {
    const M = A.intonation; if (!M || !melTexts.length) return;
    if (audio.paused && t === 0) t = -1;
    let lo = 0, hi = M.words.length - 1, idx = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (M.words[m].s <= t) { idx = m; lo = m + 1; } else hi = m - 1; }
    if (idx >= 0 && t > M.words[idx].e + .35) idx = -1;
    if (idx !== melLast) { if (melLast >= 0 && melTexts[melLast]) melTexts[melLast].classList.remove('now'); if (idx >= 0 && melTexts[idx]) melTexts[idx].classList.add('now'); melLast = idx; }
  });

  /* --- pauses: one connected chart over time; long recordings get a moving window + an overview strip --- */
  const pauseCard = h('div', { class: 'card' });
  function paintPauses() {
    // ranges: under 0.25 s too brief | 0.25-0.5 short | 0.5-1.5 good | 1.5-2 a bit long | over 2 long
    const ZONES = [[0, 0.25, 'warn', 'too brief', 'under 0.25 s'], [0.25, 0.5, 'ok', 'short', '0.25–0.5 s'], [0.5, 1.5, 'good', 'good', '0.5–1.5 s'],
      [1.5, 2, 'ok', 'a bit long', '1.5–2 s'], [2, 99, 'warn', 'long', 'over 2 s']];
    const zoneOf = d => ZONES.find(z => d >= z[0] && d < z[1]) || ZONES[ZONES.length - 1];
    const P = (A.pause_list || A.pauses.map(([s, e]) => ({ s, e, d: e - s })).filter(p => p.d >= 0.15)).map(p => ({ s: p.s, e: p.e, d: p.d }));
    const lv = d => zoneOf(d)[2];
    const word = d => zoneOf(d)[3];
    const col = d => css({ good: '--good', ok: '--ok', warn: '--warn' }[lv(d)]);
    const head = h('div', { class: 'row' }, icon('pauses', 20), h('h2', {}, 'Your pauses'), h('div', { class: 'spacer' }),
      P.length ? h('a', { class: 'btn sm ghost', href: dl('pauses'), download: '' }, icon('download', 16), 'Pause list (CSV)') : null);
    if (!P.length) { pauseCard.replaceChildren(head, h('p', { class: 'muted', style: 'margin-top:8px' }, 'No pauses found.')); return; }
    const total = P.reduce((a, p) => a + p.d, 0), longest = P.reduce((a, p) => p.d > a.d ? p : a);
    const n = {}; P.forEach(p => { const w = word(p.d); n[w] = (n[w] || 0) + 1; });
    const nGood = n.good || 0, others = ['too brief', 'short', 'a bit long', 'long'].filter(k => n[k]).map(k => `${n[k]} ${k}`);
    const story = nGood === P.length ? `All ${P.length} pauses were in the good range (0.5 to 1.5 s).`
      : `${nGood} of ${P.length} pauses were in the good range (0.5 to 1.5 s)` + (others.length ? '; ' + others.join(', ') : '') + '.';
    const nBad = (n['too brief'] || 0) + (n.long || 0);
    const stat = (v, l) => h('div', { class: 'pstat' }, h('b', {}, v), h('span', {}, l));

    // how the pauses split over the five ranges: one bar, readable at any length
    const split = h('div', { class: 'psplit' },
      h('div', { class: 'stack', role: 'img', 'aria-label': ZONES.map(z => `${z[3]}: ${n[z[3]] || 0}`).join(', ') },
        ZONES.filter(z => n[z[3]]).map(z => { const k = z[3], share = n[k] / P.length;
          const words = innerWidth >= 640 ? share >= .16 : share >= .45;   // phones: numbers only unless there is room
          return h('i', { style: `flex:${n[k]};background:${css('--' + z[2])}`, title: `${k} (${z[4]}): ${n[k]}` }, words ? `${n[k]} ${k}` : share >= .05 ? String(n[k]) : ''); })),
      h('div', { class: 'stack-legend' }, ZONES.map(z => h('span', {}, h('span', { class: 'dot', style: `background:${css('--' + z[2])}` }), `${z[3][0].toUpperCase() + z[3].slice(1)}, ${z[4]} `, h('b', {}, n[z[3]] || 0)))));

    // long recordings: show a window of 30-60 s at a time (about 40 pauses), with an overview strip to move it
    const LONG = dur > 75;
    const per = P.length / dur;
    let span = LONG ? Math.min(60, Math.max(30, Math.round(40 / Math.max(per, 0.01) / 5) * 5)) : dur;
    if (LONG && innerWidth < 640) span = Math.min(span, 30);
    let w0 = 0;
    const cv = h('canvas', { 'aria-label': 'Chart of pause lengths over the recording' });
    const winLabel = h('span', { class: 'small muted pwin-label' });
    const prevBtn = h('button', { class: 'btn sm', 'aria-label': 'Earlier part', onclick: () => setWin(w0 - span * 0.8) }, icon('back', 15), h('span', { class: 'hide-sm' }, 'Earlier'));
    const nextBtn = h('button', { class: 'btn sm', 'aria-label': 'Later part', onclick: () => setWin(w0 + span * 0.8) }, h('span', { class: 'hide-sm' }, 'Later'), h('span', { style: 'display:inline-flex;transform:scaleX(-1)' }, icon('back', 15)));
    const mini = h('canvas', { class: 'pmini', role: 'slider', tabindex: 0, 'aria-label': 'Part of the recording shown in the chart',
      'aria-valuemin': 0, 'aria-valuemax': Math.round(dur) });
    const nav = LONG ? h('div', { class: 'pnav' },
      h('div', { class: 'row', style: 'gap:8px' }, prevBtn, winLabel, h('div', { class: 'spacer' }), h('span', { class: 'small muted hide-sm' }, 'Drag the box below to move through the recording'), nextBtn),
      mini, h('div', { class: 'pmini-axis' }, h('span', {}, '0:00'), h('span', {}, 'whole recording'), h('span', {}, fmtClock(dur)))) : null;

    const show = p => { if (LONG && (p.s < w0 || p.e > w0 + span)) setWin(p.s + p.d / 2 - span / 2); };
    const hear = p => { show(p); audio.currentTime = Math.max(0, p.s - 1.2); audio.play(); };
    const top = [...P].sort((a, b) => b.d - a.d).slice(0, 3);
    pauseCard.replaceChildren(head,
      h('p', { class: 'muted small', style: 'margin-top:4px' }, 'Each dot is one silence between your words, placed at the moment it happened. Higher dot = longer pause. Tap a dot to hear it.'),
      h('div', { class: 'pstats' }, stat(P.length, P.length === 1 ? 'pause' : 'pauses'),
        stat(total.toFixed(1) + ' s', `in total (${Math.round(total / dur * 100)}% of the time)`),
        stat((total / P.length).toFixed(2) + ' s', 'on average'), stat(longest.d.toFixed(2) + ' s', 'longest, at ' + fmtClock(longest.s))),
      h('div', { class: 'tipline', style: 'margin-top:12px' }, icon(nBad ? 'bulb' : 'check', 18), h('span', {}, story)),
      split,
      h('div', { class: 'chart-box', style: 'height:280px' }, cv),
      nav || '',
      h('div', { class: 'pause-legend' }, h('span', {}, h('i', { class: 'lg-talk' }), 'when you were talking'),
        h('span', {}, h('i', { class: 'lg-band', style: `background:${css('--good-soft')}` }), 'green band: good pause length')),
      h('div', { class: 'row', style: 'gap:8px;margin-top:12px' }, h('span', { class: 'small muted' }, 'Longest pauses:'),
        top.map(p => h('button', { class: 'chip lv-' + lv(p.d), style: 'border:0;cursor:pointer', onclick: () => hear(p) }, icon('play', 12), `${fmtClock(p.s)} · ${p.d.toFixed(2)} s`))));

    const yMax = Math.max(2.5, Math.ceil(longest.d * 1.15 * 10) / 10);
    const zones = { id: 'zones', beforeDatasetsDraw(c) {
      const { ctx, chartArea: a, scales: { x, y } } = c;
      const band = (lo, hi, color) => {   // the band names are on the right-hand axis, clear of the dots
        const y0 = y.getPixelForValue(Math.min(hi, yMax)), y1 = y.getPixelForValue(lo);
        ctx.fillStyle = color; ctx.fillRect(a.left, y0, a.right - a.left, y1 - y0);
      };
      ctx.save();
      ctx.beginPath(); ctx.rect(a.left, a.top, a.right - a.left, a.bottom - a.top); ctx.clip();
      band(0, 0.25, css('--warn-soft'), 'too brief');
      band(0.25, 0.5, css('--ok-soft'), 'short');
      band(0.5, 1.5, css('--good-soft'), 'good');
      band(1.5, 2.0, css('--ok-soft'), 'a bit long');
      band(2.0, yMax, css('--warn-soft'), 'long');
      // talking time along the bottom, so silences and speech line up with the dots
      const ty = a.bottom - 7, lo = x.min - 1, hi = x.max + 1;
      ctx.fillStyle = css('--wave');
      A.segments.forEach(([s0, s1]) => { if (s1 < lo || s0 > hi) return; const x0 = x.getPixelForValue(s0), x1 = x.getPixelForValue(s1); ctx.fillRect(x0, ty, Math.max(1, x1 - x0), 5); });
      // a faint stem from each dot down to its silence, connecting the two
      P.forEach(p => { if (p.e < lo || p.s > hi) return; const xp = x.getPixelForValue(p.s + p.d / 2); ctx.strokeStyle = col(p.d); ctx.globalAlpha = .45; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(xp, y.getPixelForValue(p.d)); ctx.lineTo(xp, ty); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.fillStyle = col(p.d); const x0 = x.getPixelForValue(p.s), x1 = x.getPixelForValue(p.e); ctx.fillRect(x0, ty - 1, Math.max(3, x1 - x0), 7); });
      ctx.restore();
    }, afterDatasetsDraw(c) {
      const { ctx, chartArea: a, scales: { x } } = c, t = audio.currentTime;
      if (!(t > 0) || t < x.min || t > x.max) return;
      const xp = x.getPixelForValue(t); ctx.save(); ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xp, a.top); ctx.lineTo(xp, a.bottom); ctx.stroke(); ctx.restore();
    } };
    const ch = mkChart(cv, { type: 'line', plugins: [zones],
      data: { datasets: [{ data: P.map(p => ({ x: p.s + p.d / 2, y: +p.d.toFixed(2), p })), borderColor: css('--muted'), borderWidth: 2, tension: .25,
        pointRadius: 7, pointHoverRadius: 9, pointBackgroundColor: P.map(p => col(p.d)), pointBorderColor: css('--panel'), pointBorderWidth: 2.5, fill: false }] },
      options: { maintainAspectRatio: false, animation: false, parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: {
          title: c => 'Pause at ' + fmtClock(c[0].raw.p.s), label: c => `${c.raw.p.d.toFixed(2)} seconds: ${word(c.raw.p.d)}`, footer: () => 'Tap to hear it' } } },
        scales: { x: { type: 'linear', min: 0, max: span, title: { display: true, text: 'time in your recording' }, ticks: { callback: v => fmtClock(v), maxTicksLimit: 8 }, grid: { display: false } },
          y: { min: 0, max: yMax, title: { display: true, text: 'pause length (seconds)' }, ticks: { stepSize: 0.5, callback: v => v + ' s' } },
          zone: { position: 'right', min: 0, max: yMax, grid: { display: false }, border: { display: false },
            afterBuildTicks: ax => { ax.ticks = ZONES.map(z => ({ value: (z[0] + Math.min(z[1], yMax)) / 2, label: z[3] })); },
            afterFit: ax => { ax.width = Math.min(ax.width, 74); },
            ticks: { autoSkip: false, padding: 6, color: css('--muted'), font: { size: 11, weight: 600 },
              callback: v => (ZONES.find(z => Math.abs((z[0] + Math.min(z[1], yMax)) / 2 - v) < 1e-6) || [])[3] || '' } } },
        onClick: (_, el) => { if (el.length) hear(P[el[0].index]); } } });

    function drawMini() {
      if (!LONG) return;
      const dpr = devicePixelRatio || 1, w = mini.clientWidth, hh = 46; if (!w) return;
      if (mini.width !== Math.round(w * dpr)) { mini.width = Math.round(w * dpr); mini.height = hh * dpr; }
      const g = mini.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hh);
      const X = t => t / dur * w, base = hh - 6;
      g.fillStyle = css('--wave'); A.segments.forEach(([s0, s1]) => g.fillRect(X(s0), base + 1, Math.max(1, X(s1) - X(s0)), 3));
      P.forEach(p => { const bh = 3 + Math.min(p.d, yMax) / yMax * (hh - 14); g.fillStyle = col(p.d);
        g.fillRect(X(p.s + p.d / 2) - 1, base - bh, Math.max(2, X(p.e) - X(p.s)), bh); });
      const a0 = X(w0), a1 = X(w0 + span);
      g.fillStyle = css('--accent') + '22'; g.strokeStyle = css('--accent'); g.lineWidth = 2;
      g.beginPath(); g.roundRect(a0 + 1, 1, Math.max(8, a1 - a0 - 2), hh - 2, 7); g.fill(); g.stroke();
      const t = audio.currentTime; if (t > 0) { g.fillStyle = css('--ink'); g.fillRect(X(t) - 0.75, 0, 1.5, hh); }
    }
    function setWin(t0) {
      if (!LONG) return;
      w0 = Math.max(0, Math.min(dur - span, t0));
      ch.options.scales.x.min = w0; ch.options.scales.x.max = w0 + span;
      const vis = P.filter(p => p.s >= w0 && p.s <= w0 + span).length;
      ch.data.datasets[0].pointRadius = vis > 45 ? 5 : 7;
      ch.update('none');
      winLabel.textContent = `${fmtClock(w0)} – ${fmtClock(w0 + span)} of ${fmtClock(dur)}`;
      mini.setAttribute('aria-valuenow', Math.round(w0)); mini.setAttribute('aria-valuetext', winLabel.textContent);
      prevBtn.disabled = w0 <= 0.01; nextBtn.disabled = w0 >= dur - span - 0.01;
      drawMini();
    }
    if (LONG) {
      const fromEvent = e => { const r = mini.getBoundingClientRect(); setWin((e.clientX - r.left) / r.width * dur - span / 2); };
      mini.addEventListener('pointerdown', e => { mini.setPointerCapture(e.pointerId); fromEvent(e); });
      mini.addEventListener('pointermove', e => { if (mini.hasPointerCapture(e.pointerId)) fromEvent(e); });
      mini.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); setWin(w0 + span * 0.8); } if (e.key === 'ArrowLeft') { e.preventDefault(); setWin(w0 - span * 0.8); } });
      const onR = () => drawMini(); addEventListener('resize', onR); cleanup.push(() => removeEventListener('resize', onR));
      requestAnimationFrame(() => setWin(0));
    }
    let lastT = -1;
    ticks.push(t => {
      if (Math.abs(t - lastT) <= 0.04) return;
      lastT = t;
      if (LONG && !audio.paused && (t < w0 || t > w0 + span)) setWin(t - span * 0.1);   // follow playback
      else { ch.draw(); drawMini(); }
    });
  }

  /* --- notes --- */
  const notes = shared ? null : h('div', { class: 'card' }, h('div', { class: 'row', style: 'margin-bottom:10px' }, icon('edit', 20), h('h2', {}, 'Notes')),
    h('textarea', { placeholder: 'Anything to remember about this recording? (only you can see this)', onchange: async e => { await api(base, { method: 'PATCH', json: { notes: e.target.value } }); toast('Note saved.'); } }, meta.notes || ''));

  /* --- advanced (experts) --- */
  const adv = h('details', { class: 'adv' }, h('summary', {}, icon('chart', 20), 'Detailed analysis', h('span', { class: 'muted small', style: 'font-weight:500' }, 'waveform, spectrogram, pitch and raw numbers'), icon('chev', 18)));
  let advBuilt = false;
  adv.addEventListener('toggle', () => { if (adv.open && !advBuilt) { advBuilt = true; buildAdvanced(adv, { A, meta, audio, ticks, tick, base, id, shared, dur }); } });

  /* --- share dialog --- */
  async function shareDialog() {
    const dlg = $('#modal');
    function paint() {
      const url = meta.shared ? shareUrl(meta.share_token) : '';
      dlg.replaceChildren(h('h2', {}, meta.shared ? 'Your share link' : 'Share this recording'),
        h('p', { class: 'muted' }, meta.shared ? 'Anyone with this link can listen and see the results, but cannot change anything. Your notes stay private.' : 'Create a link that lets someone listen and see the results. They cannot change anything, and you can turn the link off at any time.'),
        meta.shared ? [
          h('div', { class: 'share-url' }, h('input', { readonly: true, value: url, 'aria-label': 'Share link', onfocus: e => e.target.select() }),
            h('button', { class: 'btn primary', onclick: async () => { try { await navigator.clipboard.writeText(url); toast('Link copied.'); } catch (e) { dlg.querySelector('input').select(); toast('Press Ctrl+C to copy.'); } } }, icon('copy', 17), 'Copy')),
          h('div', { class: 'row', style: 'margin-top:14px' },
            navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ title: meta.title, url }).catch(() => { }) }, icon('share', 17), 'Send…') : null,
            h('a', { class: 'btn', href: `mailto:?subject=${encodeURIComponent(meta.title)}&body=${encodeURIComponent('Listen to my recording: ' + url)}` }, icon('mail', 17), 'Email'),
            h('button', { class: 'btn', onclick: e => { const q = dlg.querySelector('.qr'); q.classList.toggle('hidden'); } }, icon('qr', 17), 'QR code')),
          h('div', { class: 'qr hidden', style: 'margin-top:16px;text-align:center' }, h('img', { src: U('/api/qr.png?text=' + encodeURIComponent(url)), width: 180, height: 180, alt: 'QR code for the share link', style: 'border-radius:12px;background:#fff;padding:6px' })),
          h('p', { class: 'muted small', style: 'margin-top:14px' }, 'Anyone with the link can open it, on any device.')] : null,
        h('div', { class: 'row', style: 'margin-top:20px' },
          meta.shared ? h('button', { class: 'link-btn small', style: 'color:var(--warn)', onclick: async () => { await api(base + '/share', { method: 'DELETE' }); meta.shared = false; meta.share_token = null; toast('Link turned off.'); paint(); } }, 'Turn off link')
            : h('button', { class: 'btn primary', onclick: async () => { const r = await api(base + '/share', { method: 'POST' }); meta.shared = true; meta.share_token = r.token; paint(); } }, icon('link', 17), 'Create link'),
          h('div', { class: 'spacer' }), h('button', { class: 'btn', onclick: () => { dlg.close(); renderResult(id); } }, 'Done')));
    }
    paint(); dlg.showModal();
  }

  view.replaceChildren(
    shared ? h('div', { class: 'banner' }, icon('link', 18), 'Someone shared this recording with you.') : h('a', { class: 'back', href: '#/recordings' }, icon('back', 18), 'My recordings'),
    h('div', { class: 'title-row' }, h('div', { style: 'flex:1;min-width:240px' }, titleEl, h('div', { class: 'muted', style: 'margin-top:4px' }, `${fmtWhen(meta.created)} · ${fmtLen(dur)}`)), actions),
    h('div', { style: 'height:16px' }), player, audio, summaryBox,
    h('div', { style: 'height:14px' }), trBox, h('div', { style: 'height:14px' }), melCard, h('div', { style: 'height:14px' }), paceCard, h('div', { style: 'height:14px' }), pauseCard, notes ? h('div', { style: 'height:14px' }) : null, notes, adv);
  paintSummary(); paintTranscript(); paintPace(); paintPauses(); paintMelody(); requestAnimationFrame(tick);
  if (meta.tstatus === 'running') pollTranscript();
}

/* ---------------- where the ranges come from ---------------- */
const SOURCES = [
  ['Speech rate, pace and pauses', 'Kang, Hirschi, Hansen, Looney & Miao (2022). 405 recordings of 108 second-language English speakers at US universities (presentations, microteaching, speaking exams), rated by 15 trained listeners. Easiest to understand: 2.75 to 4 syllables per second; 3.5 to 4.25 while talking. Slow speech hurt more than fast speech. (The pause ranges in this app are set for presentations: 0.5 to 1.5 s good, under 0.25 s too brief, over 2 s long.)', 'https://par.nsf.gov/servlets/purl/10531499'],
  ['Fast speech and international listeners', 'Griffiths (1990), Language Learning. Listeners with lower-intermediate English understood significantly less at 200 words a minute than at 150.', 'https://consensus.app/papers/details/f84ab9fd3f67579fa58582b998076189/'],
  ['Speaking rate and pitch in lectures', 'Kang (2010), System. In lectures by international teaching assistants, how easy they were to understand was tied mostly to speaking rate; a narrow pitch range made speech sound more accented.', 'https://eric.ed.gov/?id=EJ885942'],
  ['Emphasized words', 'The emphasis rating combines how long a word is held, how much the pitch moves and rises on it, and how loud it is next to its neighbours. The weights were fitted to people, not chosen by hand: recordings in which 3 to 9 listeners marked the words they heard as emphasized (Morrison et al. 2024), and recordings in which the speaker was told which word to stress (Expresso, Nguyen et al. 2023). Tested on speakers it was not fitted on. Treat it as a good guide, not a final judgement.', 'https://arxiv.org/abs/2310.08464'],
  ['Pitch variation in presentations', 'Hincks (2005), Interspeech: how lively student presentations sound tracks pitch variation. Lindemann et al. (2020): more pitch variation was rated as better teaching. The exact semitone cut-offs here are guide values.', 'https://www.isca-archive.org/interspeech_2005/hincks05_interspeech.html'],
];
function sourcesDialog() {
  const dlg = $('#modal');
  dlg.replaceChildren(h('h2', {}, 'Where these ranges come from'),
    h('p', { class: 'muted' }, 'The ranges are about being easy to understand in academic English, not about sounding like a native speaker. Accents are fine.'),
    h('div', { style: 'display:flex;flex-direction:column;gap:14px;margin-top:16px;max-height:55vh;overflow:auto' },
      SOURCES.map(([t, d, u]) => h('div', {}, h('b', {}, t), h('p', { class: 'small muted', style: 'margin-top:2px' }, d), h('a', { class: 'small', href: u, target: '_blank', rel: 'noopener' }, 'Read the source')))),
    h('p', { class: 'small muted', style: 'margin-top:14px' }, 'Filler-word and recording-quality ratings are practical guides, not research norms.'),
    h('p', { class: 'small muted', style: 'margin-top:8px' }, h('b', {}, 'How it is measured. '),
      'Pauses are found by a speech detector (Silero VAD) and timed with Praat’s loudness curve. Syllables are counted from the words in your transcript; ',
      'without one, from the sound (de Jong & Wempe 2009). Pitch is tracked with Praat in two passes. Each word is timed by aligning the transcript to the sound. ',
      'Tested against speech that people labelled by hand, the average pause per recording matched theirs closely (correlation 0.85) and the syllable count was within about 2% for international speakers.'),
    h('div', { class: 'row', style: 'margin-top:18px' }, h('div', { class: 'spacer' }), h('button', { class: 'btn primary', onclick: () => dlg.close() }, 'Got it')));
  dlg.showModal();
}

/* ---------------- detailed analysis (expert view) ---------------- */
const MAGMA = ['#000004', '#1b0c41', '#4f0d6c', '#9e2f6b', '#dd513a', '#fb9b06', '#f7d13d', '#fcffa4'];
function setCanvas(cv, hh) { const dpr = devicePixelRatio || 1, w = cv.parentElement.clientWidth; cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); cv.style.height = hh + 'px'; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return [g, w, hh]; }
function buildAdvanced(container, X) {
  const { A, meta, audio, ticks, tick, base, id, shared, dur } = X, m = A.metrics;
  const body = h('div', { class: 'adv-body' }); container.append(body);
  // controls
  const zoom = h('input', { type: 'range', min: 1, max: 24, step: .5, value: 1, style: 'width:120px', 'aria-label': 'Zoom' });
  const selInfo = h('span', { class: 'muted small' });
  const trimBtn = h('button', { class: 'btn sm hidden' }, icon('scissors', 16), 'Save selection as new recording');
  body.append(h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'Drag across the tracks to select a part. Click to jump.'), h('div', { class: 'spacer' }), h('span', { class: 'muted small' }, 'Zoom'), zoom, selInfo, !shared && trimBtn));
  const wrap = h('div', { class: 'tracks-wrap' }), tracks = h('div', { class: 'tracks' });
  const H = { ruler: 22, wave: 100, spec: 150, pitch: 120, en: 110 }, cvs = {}, labels = { wave: 'Waveform · amber = pauses', spec: 'Spectrogram (0–8 kHz)', pitch: 'Pitch (Hz)', en: 'Loudness · ▾ syllables' };
  let y = 0; for (const k of Object.keys(H)) { cvs[k] = h('canvas'); tracks.append(cvs[k]); if (labels[k]) tracks.append(h('div', { class: 'track-label', style: `top:${y + 4}px` }, labels[k])); y += H[k]; }
  const head = h('div', { class: 'playhead' }), selBox = h('div', { class: 'selection hidden' }); tracks.append(head, selBox); wrap.append(tracks); body.append(wrap);
  let sel = null, specImg = null;
  const xOf = t => t / dur * tracks.clientWidth, tOf = x => Math.max(0, Math.min(dur, x / tracks.clientWidth * dur));
  function draw() {
    let [g, w, hh] = setCanvas(cvs.ruler, H.ruler);
    g.fillStyle = css('--muted'); g.font = '11px ' + getComputedStyle(document.body).fontFamily;
    const step = [.1, .2, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(s => s / dur * w > 60) || 600;
    for (let t = 0; t <= dur; t += step) g.fillText(fmtClock(t) + (step < 1 ? '.' + Math.round((t % 1) * 10) : ''), t / dur * w + 3, 14);
    [g, w, hh] = setCanvas(cvs.wave, H.wave);
    g.fillStyle = css('--seg'); A.segments.forEach(([a, b]) => g.fillRect(a / dur * w, 0, (b - a) / dur * w, hh));
    g.fillStyle = css('--pause'); A.pauses.forEach(([a, b]) => g.fillRect(a / dur * w, 0, (b - a) / dur * w, hh));
    g.fillStyle = css('--wave-played'); const n = A.peaks_min.length;
    for (let px = 0; px < w; px++) { const i0 = Math.floor(px / w * n), i1 = Math.max(i0 + 1, Math.floor((px + 1) / w * n)); let lo = 0, hi = 0; for (let i = i0; i < i1 && i < n; i++) { lo = Math.min(lo, A.peaks_min[i]); hi = Math.max(hi, A.peaks_max[i]); } g.fillRect(px, hh / 2 - hi * hh / 2 * .95, 1, Math.max(1, (hi - lo) * hh / 2 * .95)); }
    [g, w, hh] = setCanvas(cvs.spec, H.spec); const sp = A.spectrogram;
    if (sp.w) {
      if (!specImg) {
        const stops = MAGMA.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))), bin = atob(sp.data), id2 = new ImageData(sp.w, sp.h);
        for (let r = 0; r < sp.h; r++) for (let c = 0; c < sp.w; c++) { const v = bin.charCodeAt(r * sp.w + c) / 255 * (stops.length - 1), k = Math.min(Math.floor(v), stops.length - 2), f = v - k, o = ((sp.h - 1 - r) * sp.w + c) * 4; for (let q = 0; q < 3; q++) id2.data[o + q] = stops[k][q] * (1 - f) + stops[k + 1][q] * f; id2.data[o + 3] = 255; }
        specImg = document.createElement('canvas'); specImg.width = sp.w; specImg.height = sp.h; specImg.getContext('2d').putImageData(id2, 0, 0);
      }
      g.drawImage(specImg, 0, 0, w, hh); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '10px sans-serif'; [2, 4, 6].forEach(k => g.fillText(k + 'k', 4, hh - k / 8 * hh + 4));
    }
    [g, w, hh] = setCanvas(cvs.pitch, H.pitch); const vals = A.pitch.filter(v => v != null);
    if (vals.length) {
      const s = [...vals].sort((a, b) => a - b), lo = Math.max(50, Math.floor(s[Math.floor(s.length * .02)] * .85 / 10) * 10), hi = Math.min(500, Math.ceil(s[Math.floor(s.length * .98)] * 1.15 / 10) * 10);
      g.strokeStyle = css('--line'); g.fillStyle = css('--muted'); g.font = '10px sans-serif';
      for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, yv = hh - 6 - (v - lo) / (hi - lo) * (hh - 14); g.beginPath(); g.moveTo(0, yv); g.lineTo(w, yv); g.stroke(); g.fillText(Math.round(v), w - 26, yv - 2); }
      g.fillStyle = css('--good'); A.pitch.forEach((v, i) => { if (v != null && v >= lo && v <= hi) g.fillRect(i * .01 / dur * w, hh - 6 - (v - lo) / (hi - lo) * (hh - 14) - 1, 2, 2.4); });
    } else { g.fillStyle = css('--muted'); g.fillText('No voiced speech found', 20, hh / 2); }
    [g, w, hh] = setCanvas(cvs.en, H.en);
    const e = A.energy, emin = Math.min(...e), emax = Math.max(...e), ey = v => hh - 8 - (v - emin) / (emax - emin + 1e-9) * (hh - 24);
    g.fillStyle = css('--pause'); A.pauses.forEach(([a, b]) => g.fillRect(a / dur * w, 0, (b - a) / dur * w, hh));
    g.strokeStyle = css('--muted'); g.lineWidth = 1.2; g.beginPath(); e.forEach((v, i) => { const x = i * .01 / dur * w; i ? g.lineTo(x, ey(v)) : g.moveTo(x, ey(v)); }); g.stroke();
    g.fillStyle = css('--rec'); A.nuclei.forEach(t => { const x = t / dur * w, yy = ey(e[Math.min(e.length - 1, Math.round(t / .01))]) - 7; g.beginPath(); g.moveTo(x - 3.5, yy - 5); g.lineTo(x + 3.5, yy - 5); g.lineTo(x, yy + 1); g.fill(); });
  }
  function layout() { tracks.style.width = (+zoom.value * 100) + '%'; draw(); moveHead(audio.currentTime); paintSel(); }
  function moveHead(t) { head.style.left = xOf(t) + 'px'; const px = xOf(t); if (!audio.paused && (px < wrap.scrollLeft || px > wrap.scrollLeft + wrap.clientWidth - 40)) wrap.scrollLeft = px - 60; if (sel && loop && t >= sel[1]) audio.currentTime = sel[0]; }
  let loop = false;
  function paintSel() { selBox.classList.toggle('hidden', !sel); trimBtn.classList.toggle('hidden', !sel); if (sel) { selBox.style.left = xOf(sel[0]) + 'px'; selBox.style.width = (xOf(sel[1]) - xOf(sel[0])) + 'px'; selInfo.textContent = `${(sel[1] - sel[0]).toFixed(1)} s selected`; } else selInfo.textContent = ''; }
  ticks.push(moveHead); zoom.oninput = layout;
  let down = null;
  tracks.addEventListener('pointerdown', e => { const r = tracks.getBoundingClientRect(); down = { x: e.clientX - r.left, moved: false }; tracks.setPointerCapture(e.pointerId); });
  tracks.addEventListener('pointermove', e => { if (!down) return; const x = e.clientX - tracks.getBoundingClientRect().left; if (Math.abs(x - down.x) > 4) { down.moved = true; sel = [tOf(Math.min(down.x, x)), tOf(Math.max(down.x, x))]; paintSel(); } });
  tracks.addEventListener('pointerup', e => { if (!down) return; if (!down.moved) { audio.currentTime = tOf(e.clientX - tracks.getBoundingClientRect().left); sel = null; paintSel(); tick(); } down = null; });
  trimBtn.onclick = async () => { try { const r = await api(`${base}/trim`, { method: 'POST', json: { start: sel[0], end: sel[1] } }); toast('New recording created from your selection.'); location.hash = '#/r/' + r.id; } catch (e) { toast(e.message); } };
  const ro = () => layout(); addEventListener('resize', ro); cleanup.push(() => removeEventListener('resize', ro));
  layout();

  // raw numbers with explanations
  const f = (v, d = 1) => v == null ? '–' : (+v).toFixed(d);
  const M = [
    ['Syllable rate', f(m.speech_rate_sps, 2), 'syl/s', 'Syllables per second from the first word to the last, including pauses.'], ['Articulation rate', f(m.articulation_rate_sps, 2), 'syl/s', 'Syllables per second while actually speaking.'],
    ['Syllables', m.syllables, '', m.syllable_source === 'transcript' ? `Counted from the transcript's words (${m.syllables_acoustic} found in the sound alone).` : 'Found in the sound: loudness peaks with a voice.'], ['Speaking time', f(m.speaking_time_s), 's', 'Time with voice, excluding silences.'],
    ['Mean pause', f(m.mean_pause_s, 2), 's', 'Average silence of 0.25 s or longer.'], ['Pause share', f(m.pause_ratio * 100), '%', 'Part of the recording spent in pauses.'],
    ['Mean pitch (F0)', f(m.f0_mean_hz, 0), 'Hz', 'How high or low your voice is on average.'], ['Pitch range', m.f0_min_hz == null ? '–' : f(m.f0_min_hz, 0) + '–' + f(m.f0_max_hz, 0), 'Hz', '5th to 95th percentile.'],
    ['Voiced', f(m.voiced_fraction * 100, 0), '%', 'Frames with a clear pitch.'], ['Loudness', f(m.rms_dbfs), 'dBFS', 'Average level; 0 is the maximum.'],
    ['Peak', f(m.peak_dbfs), 'dBFS', 'Loudest moment.'], ['Signal to noise', f(m.snr_db_est), 'dB', 'Higher is cleaner (capped at 60).'], ['Clipping', f(m.clipping_pct, 2), '%', 'Samples at the maximum level (distortion).']];
  body.append(h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:12px' }, 'Measurements'), h('div', { class: 'metrics' }, M.map(([l, v, u, d]) => h('div', { class: 'metric' }, h('div', { class: 'l' }, l), h('div', { class: 'v' }, v, u && h('small', {}, u)), h('div', { class: 'd' }, d))))));
  // charts
  const c1 = h('canvas'), c2 = h('canvas');
  body.append(h('div', { class: 'split' }, h('div', { class: 'card' }, h('h3', {}, 'Pause lengths'), h('div', { class: 'chart-box' }, c1)), h('div', { class: 'card' }, h('h3', {}, 'Pitch distribution'), h('div', { class: 'chart-box' }, c2))));
  mkChart(c1, { type: 'bar', data: { labels: A.pauses.map(([a]) => fmtClock(a)), datasets: [{ data: A.pauses.map(([a, b]) => b - a), backgroundColor: css('--ok'), borderRadius: 6 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'seconds' } }, x: { title: { display: true, text: 'pause starts at' } } }, onClick: (_, el) => { if (el.length) { audio.currentTime = A.pauses[el[0].index][0]; tick(); } } } });
  const fv = A.pitch.filter(v => v != null);
  if (fv.length) {
    const s = [...fv].sort((a, b) => a - b), lo = Math.floor(s[0] / 10) * 10, hi = Math.ceil(s[s.length - 1] / 10) * 10 + 1, nb = Math.min(28, Math.max(8, (hi - lo) / 6 | 0)), cnt = new Array(nb).fill(0);
    fv.forEach(v => cnt[Math.min(nb - 1, Math.floor((v - lo) / (hi - lo) * nb))]++);
    mkChart(c2, { type: 'bar', data: { labels: cnt.map((_, i) => Math.round(lo + (i + .5) * (hi - lo) / nb)), datasets: [{ data: cnt.map(v => v * .01), backgroundColor: css('--good'), borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'Hz' } }, y: { title: { display: true, text: 'seconds' } } } } });
  }
  // tags (owner only)
  if (!shared) {
    let tags = [...meta.tags]; const tb = h('div', { class: 'row', style: 'gap:6px' });
    const paintTags = () => tb.replaceChildren(...tags.map(t => h('button', { class: 'chip lv-none', style: 'border:0;cursor:pointer', title: 'Remove', onclick: async () => { tags = tags.filter(x => x !== t); await api(base, { method: 'PATCH', json: { tags } }); paintTags(); } }, '#' + t, icon('x', 12))),
      h('input', { placeholder: 'Add a tag and press Enter', style: 'padding:6px 12px;font-size:14px', onkeydown: async e => { if (e.key === 'Enter' && e.target.value.trim()) { tags = [...new Set([...tags, e.target.value.trim().toLowerCase()])]; await api(base, { method: 'PATCH', json: { tags } }); paintTags(); } } }));
    paintTags(); body.append(h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:10px' }, 'Tags'), tb));
  }
}

/* ---------------- progress ---------------- */
async function renderProgress() {
  const S = await api('/api/stats'); view.innerHTML = '';
  view.append(h('h1', {}, 'Your progress'));
  if (S.count < 2) { view.append(h('div', { class: 'card empty', style: 'margin-top:20px' }, h('h2', { style: 'color:var(--ink);margin-bottom:6px' }, S.count ? 'One recording so far' : 'Nothing here yet'), 'Make a few recordings over time and you will see how your pace, pauses and voice change.', h('div', { style: 'margin-top:16px' }, h('a', { class: 'btn primary', href: '#/record' }, icon('mic', 18), 'Record now')))); return; }
  const rows = S.series.filter(r => r.s), val = (r, k) => r.s && r.s.values[k] != null ? r.s.values[k] : null;
  const avg = k => { const v = rows.map(r => val(r, k)).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const ap = avg('pace');
  const paceWord = ap == null ? '' : ap < 90 ? 'slow' : ap < 110 ? 'a bit slow' : ap <= 160 ? 'comfortable' : ap <= 190 ? 'a bit fast' : 'too fast';
  const tiles = [[S.count, 'recordings'], [fmtLen(S.total_s), 'of talking'], [ap ? Math.round(ap) : '–', 'words / min on average'], [avg('rate') != null ? avg('rate').toFixed(1) : '–', 'syllables / sec on average'], [avg('variety') != null ? avg('variety').toFixed(1) : '–', 'semitones of melody']];
  view.append(h('p', { class: 'muted', style: 'margin-top:6px;font-size:18px' }, ap ? `On average your pace is ${paceWord}.` : ''),
    h('div', { class: 'insights', style: 'grid-template-columns:repeat(auto-fit,minmax(180px,1fr))' }, tiles.map(([b, s]) => h('div', { class: 'card' }, h('div', { style: 'font-size:28px;font-weight:800' }, b), h('div', { class: 'muted small' }, s)))));
  const mk = (title, sub, cv) => h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', {}, title), h('p', { class: 'muted small' }, sub), h('div', { class: 'chart-box' }, cv));
  const c1 = h('canvas'), c2 = h('canvas'), c3 = h('canvas'), c4 = h('canvas');
  view.append(mk('Speaking pace', 'Words per minute in each recording. The green band (110 to 160) is easiest to follow in academic talks. Tap a point to open it.', c1),
    h('div', { class: 'split' }, mk('Speech rate', 'Syllables per second, pauses included. The green band (2.75 to 4) was easiest to understand.', c4), mk('Voice melody', 'Higher means a livelier, more expressive voice.', c2)),
    mk('Pause length', 'Average length of your pauses, in seconds. The green band (0.5 to 1.5 s) is the good range.', c3),
    h('div', { style: 'margin-top:18px;text-align:center' }, h('a', { class: 'btn', href: '#/compare' }, icon('compare', 18), 'Compare recordings side by side')));
  const labels = rows.map(r => new Date(r.t).toLocaleDateString([], { month: 'short', day: 'numeric' }));
  const line = (cv, k, color, band, unit) => mkChart(cv, {
    type: 'line', plugins: band ? [bandPlugin(band[0], band[1], band[2])] : [],
    data: { labels, datasets: [{ data: rows.map(r => val(r, k)), borderColor: color, backgroundColor: color, pointRadius: 5, pointHoverRadius: 7, tension: .3, spanGaps: true }] },
    options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: c => rows[c[0].dataIndex].title, label: c => (+c.raw).toFixed(1) + ' ' + unit } } },
      scales: { y: { beginAtZero: true, suggestedMax: band ? band[1] * 1.4 : undefined }, x: { grid: { display: false } } }, onClick: (_, el) => { if (el.length) location.hash = '#/r/' + rows[el[0].index].id; } }
  });
  line(c1, 'pace', css('--accent'), [110, 160, 'easy to follow'], 'words/min');
  line(c2, 'variety', css('--good'), [2.5, 6, 'lively'], 'semitones');
  line(c3, 'pauses', css('--ok'), [0.5, 1.5, 'good'], 's');
  line(c4, 'rate', '#0b84c6', [2.75, 4, 'easy to follow'], 'syllables/sec');
}

/* ---------------- compare ---------------- */
async function renderCompare(idsParam) {
  const { recordings } = await api('/api/recordings?sort=new');
  const ready = recordings.filter(r => r.status === 'ready');
  let ids = (idsParam || '').split(',').filter(Boolean).map(Number).filter(i => ready.some(r => r.id === i));
  view.innerHTML = '';
  view.append(h('a', { class: 'back', href: '#/progress' }, icon('back', 18), 'Progress'), h('h1', {}, 'Compare recordings'), h('p', { class: 'muted', style: 'margin:6px 0 16px' }, 'Pick two to six recordings.'),
    h('div', { class: 'row', style: 'gap:8px' }, ready.map(r => h('button', { class: 'chip ' + (ids.includes(r.id) ? 'lv-good' : 'lv-none'), style: 'border:0;cursor:pointer;padding:7px 14px;font-size:14px', onclick: () => { ids = ids.includes(r.id) ? ids.filter(i => i !== r.id) : [...ids, r.id].slice(-6); location.hash = '#/compare?ids=' + ids.join(','); } }, ids.includes(r.id) ? icon('check', 14) : null, r.title))));
  const out = h('div', { style: 'margin-top:18px' }); view.append(out);
  if (ids.length < 2) { out.append(h('div', { class: 'card empty' }, ready.length < 2 ? 'You need at least two recordings to compare.' : 'Select at least two recordings above.')); return; }
  const data = await Promise.all(ids.map(async i => ({ r: ready.find(x => x.id === i), a: await api(`/api/recordings/${i}/analysis`) })));
  const get = (d, k) => (d.a.insights.items.find(i => i.id === k) || null);
  const rowsDef = [['Speaking pace', 'pace'], ['Speech rate', 'rate'], ['Pauses', 'pauses'], ['Voice melody', 'variety'], ['Recording quality', 'sound'], ['Filler words', 'fillers']];
  out.append(h('div', { class: 'card', style: 'overflow:auto' }, h('table', { class: 't' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), data.map((d, i) => h('th', {}, h('span', { class: 'dot', style: `background:${SERIES[i % 6]}` }), d.r.title)))),
    h('tbody', {}, h('tr', {}, h('td', {}, 'Length'), data.map(d => h('td', {}, fmtLen(d.a.duration)))),
      rowsDef.map(([l, k]) => h('tr', {}, h('td', { style: 'font-weight:600' }, l), data.map(d => { const it = get(d, k); return h('td', {}, it ? [h('b', {}, it.value + ' '), h('span', { class: 'muted small' }, it.unit + ' '), levelChip(it)] : h('span', { class: 'muted' }, '–')); })))))));
  const cv = h('canvas');
  out.append(h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', {}, 'Pace through each recording'), h('p', { class: 'muted small' }, 'Estimated words per minute, from start (0%) to end (100%).'), h('div', { class: 'chart-box' }, cv)));
  mkChart(cv, { type: 'line', plugins: [bandPlugin(110, 160, 'easy to follow')], data: { datasets: data.map((d, i) => ({ label: d.r.title, borderColor: SERIES[i % 6], borderWidth: 2.2, tension: .35, pointRadius: 0, data: (d.a.pace || []).map(([t, v]) => ({ x: t / d.a.duration * 100, y: v * 40 })) })) },
    options: { maintainAspectRatio: false, parsing: false, scales: { x: { type: 'linear', min: 0, max: 100, ticks: { callback: v => v + '%' } }, y: { min: 0, suggestedMax: 220 } } } });
}

route();
