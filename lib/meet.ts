// Client side of "Meet with Arash" (/meet/ and /meet/admin/). The backend is meet.arash-ahmadi.com (node on the lab VPS).
// Every time is a Central-time wall-clock string "YYYY-MM-DDTHH:MM", the same as Arash's Outlook.

export const MEET_API = process.env.NEXT_PUBLIC_MEET_API || "https://meet.arash-ahmadi.com";
export const TZ = "America/Chicago";

export type Response = { id: string; name: string; slots: string[]; updatedAt: string; email?: string; note?: string; createdAt?: string };
export type Booking = {
  start: string;
  end: string;
  location?: string;
  status?: "queued" | "sending" | "sent" | "failed" | "booked" | "cancelled";
  emails?: string[];
  title?: string;
  sendAfter?: string;
  error?: string | null;
  webLink?: string | null;
  createEvent?: boolean;
  teams?: boolean;
  durationMin?: number;
};
export type PublicMeeting = {
  token: string;
  title: string;
  forName: string;
  note: string;
  location: string;
  durationMin: number;
  slotMin: number;
  dates: string[];
  dayStart: string;
  dayEnd: string;
  tz: string;
  status: "open" | "closed";
  blockBusy: boolean;
  booking: Booking | null;
  arashBusy: string[];
  now: string;
  syncedAt: string | null;
  responses: Response[];
};
export type Window = { start: string; end: string; free: string[]; count: number; lastStart?: string };
export type AdminMeeting = Omit<PublicMeeting, "tz" | "arashBusy" | "now" | "syncedAt" | "responses" | "booking"> & {
  id: string;
  inviteEmails: string[];
  createdAt: string;
  updatedAt: string;
  booking: Booking | null;
  responseCount: number;
  lastResponseAt: string;
  best: Window[];
  arashBusy?: string[];
  now?: string;
  responses?: Response[];
};
export type BusyBlock = { s: string; e: string; show: string; subject: string; allDay: boolean };
export type Overview = {
  now: string;
  meetings: AdminMeeting[];
  busy: { syncedAt: string | null; blocks: BusyBlock[] };
  worker: { seenAt: string | null; syncRequested: boolean };
};

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
  }
}

export async function call<T>(path: string, opts: { method?: string; body?: unknown; key?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.key) headers.Authorization = `Bearer ${opts.key}`;
  let res: globalThis.Response;
  try {
    res = await fetch(MEET_API + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Can't reach the meeting server. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

// ---------- time ----------
export const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
export const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const addMin = (slot: string, m: number) => `${slot.slice(0, 11)}${fromMin(toMin(slot.slice(11)) + m)}`;

export function timesOf(m: { dayStart: string; dayEnd: string; slotMin: number }) {
  const out: string[] = [];
  for (let t = toMin(m.dayStart); t + m.slotMin <= toMin(m.dayEnd); t += m.slotMin) out.push(fromMin(t));
  return out;
}

const parseDay = (d: string) => new Date(`${d}T12:00:00Z`);
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const longDayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
const mdFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
export const dayName = (d: string) => dayFmt.format(parseDay(d));
export const longDayName = (d: string) => longDayFmt.format(parseDay(d));
export const monthDay = (d: string) => mdFmt.format(parseDay(d));
export const fullDate = (d: string) => fullFmt.format(parseDay(d));

export function clock(hm: string, compact = false) {
  const m = toMin(hm);
  const h24 = Math.floor(m / 60) % 24;
  const h = h24 % 12 || 12;
  const mm = m % 60;
  const ap = h24 < 12 ? "AM" : "PM";
  if (compact) return mm ? `${h}:${String(mm).padStart(2, "0")}` : `${h} ${ap}`;
  return `${h}:${String(mm).padStart(2, "0")} ${ap}`;
}
export const span = (start: string, end: string) => `${clock(start.slice(11))} – ${clock(end.slice(11))}`;
export const whenLabel = (start: string, end: string) => `${dayName(start.slice(0, 10))}, ${monthDay(start.slice(0, 10))} · ${span(start, end)}`;

/** Offset of a time zone from UTC in minutes at a given UTC instant. */
function tzOffset(tz: string, at: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(at)
      .map((x) => [x.type, x.value])
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return Math.round((asUtc - at.getTime()) / 60000);
}
/** Central wall clock -> real instant. */
export function centralToDate(slot: string) {
  const guess = new Date(`${slot}:00Z`);
  const off = tzOffset(TZ, guess);
  const d = new Date(guess.getTime() - off * 60000);
  const off2 = tzOffset(TZ, d);
  return off2 === off ? d : new Date(guess.getTime() - off2 * 60000);
}
export function viewerZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || TZ;
  } catch {
    return TZ;
  }
}
/** The same moment in the viewer's own zone, e.g. "4:30 PM Wed (Berlin)". null when the viewer is on Central time. */
export function localEcho(slot: string) {
  const z = viewerZone();
  const d = centralToDate(slot);
  if (tzOffset(z, d) === tzOffset(TZ, d)) return null;
  const t = new Intl.DateTimeFormat("en-US", { timeZone: z, hour: "numeric", minute: "2-digit", weekday: "short" }).format(d);
  return `${t} your time`;
}

// ---------- ranking ----------
// Back-to-back windows with the same people become one range ("1:00 - 5:00 PM, any 30 min").
function mergeRuns(wins: Window[], step: number): Window[] {
  const out: Window[] = [];
  for (const w of wins) {
    const prev = out[out.length - 1];
    if (prev && prev.start.slice(0, 10) === w.start.slice(0, 10) && addMin(prev.lastStart!, step) === w.start && prev.free.join("|") === w.free.join("|")) {
      prev.end = w.end;
      prev.lastStart = w.start;
    } else out.push({ ...w, lastStart: w.start });
  }
  return out;
}

export function bestWindows(m: PublicMeeting, people: { name: string; slots: string[] }[], limit = 5): Window[] {
  const need = Math.ceil(m.durationMin / m.slotMin);
  const times = timesOf(m);
  const busy = new Set(m.arashBusy);
  const sets = people.map((p) => ({ name: p.name, set: new Set(p.slots) }));
  const out: Window[] = [];
  for (const d of m.dates) {
    for (let i = 0; i + need <= times.length; i += 1) {
      const win = times.slice(i, i + need).map((t) => `${d}T${t}`);
      if (win[0] < m.now || win.some((s) => busy.has(s))) continue;
      const free = sets.filter((p) => win.every((s) => p.set.has(s)));
      if (!free.length) continue;
      out.push({ start: win[0], end: addMin(win[win.length - 1], m.slotMin), free: free.map((p) => p.name), count: free.length });
    }
  }
  const runs = mergeRuns(out, m.slotMin);
  runs.sort((a, b) => b.count - a.count || a.start.localeCompare(b.start));
  return runs.slice(0, limit);
}

/** "1:00 – 5:00 PM" plus "any 30 min" when the range is longer than the meeting. */
export function windowLabel(w: Window, durationMin: number) {
  const long = toMin(w.end.slice(11)) - toMin(w.start.slice(11)) > durationMin;
  return { range: span(w.start, w.end), any: long ? `any ${durationMin} min` : null };
}

// ---------- .ics for guests ----------
export function icsFor(title: string, start: string, end: string, location = "") {
  const stamp = (slot: string) => centralToDate(slot).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//arash-ahmadi.com//meet//EN",
    "BEGIN:VEVENT",
    `UID:${start}-${Math.random().toString(36).slice(2)}@arash-ahmadi.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    location ? `LOCATION:${esc(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function relTime(iso: string | null | undefined) {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
