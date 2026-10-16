"use client";

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ApiError, addMin, call, clock, dayName, fromMin, monthDay, relTime, toMin, whenLabel, windowLabel,
  type AdminMeeting, type BusyBlock, type Overview, type PublicMeeting,
} from "@/lib/meet";
import { Avatar, Burst, Icon, Toggle } from "./bits";
import { Backdrop, Loading, TopBar } from "./guest-meet";
import { TimeGrid } from "./time-grid";

const EASE = [0.22, 1, 0.36, 1] as const;
const KEY = "meetAdminKey";
const SITE = "https://arash-ahmadi.com";
const linkOf = (token: string) => `${SITE}/meet/?m=${token}`;

function useKey() {
  const [key, setKey] = useState<string | null | undefined>(undefined);
  useEffect(() => setKey(localStorage.getItem(KEY)), []);
  const save = (k: string | null) => {
    if (k) localStorage.setItem(KEY, k);
    else localStorage.removeItem(KEY);
    setKey(k);
  };
  return [key, save] as const;
}

function CountUp({ to }: { to: number }) {
  const v = useMotionValue(0);
  const r = useTransform(v, (x) => Math.round(x).toString());
  useEffect(() => {
    const c = animate(v, to, { duration: 0.9, ease: EASE });
    return () => c.stop();
  }, [to, v]);
  return <motion.span>{r}</motion.span>;
}

function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            className={cn("meet-card relative w-full max-h-[92dvh] overflow-y-auto slim-scroll rounded-b-none sm:rounded-2xl bg-white p-5 sm:p-7", wide ? "sm:max-w-3xl" : "sm:max-w-xl")}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CopyLink({ token, big }: { token: string; big?: boolean }) {
  const [done, setDone] = useState(false);
  const url = linkOf(token);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement("textarea");
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <button type="button" onClick={copy} className={cn("meet-btn ghost relative overflow-hidden", !big && "small")} title={url}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? "y" : "n"} className="inline-flex items-center gap-1.5" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.18 }}>
          {done ? <>{Icon.check("h-3.5 w-3.5 text-green-600")} Copied</> : <>{Icon.link("h-3.5 w-3.5")} Copy link</>}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function StatusChip({ m }: { m: AdminMeeting }) {
  const b = m.booking;
  const map: Record<string, [string, string]> = {
    queued: ["Invite queued", "bg-amber-100 text-amber-800"],
    sending: ["Creating event…", "bg-amber-100 text-amber-800"],
    sent: ["Booked · invite sent", "bg-green-100 text-green-800"],
    booked: ["Booked", "bg-green-100 text-green-800"],
    failed: ["Invite failed", "bg-red-100 text-red-700"],
  };
  if (b && map[b.status || ""]) {
    const [t, c] = map[b.status!];
    return <span className={cn("meet-chip", c)}>{t}</span>;
  }
  if (m.status === "closed") return <span className="meet-chip">Closed</span>;
  return (
    <span className="meet-chip bg-[#DC143C]/10 text-[#b0102f]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#DC143C]" /> Collecting
    </span>
  );
}

// ======================================================================================
export function AdminMeet() {
  const [key, setKey] = useKey();
  const params = useSearchParams();
  const openId = params.get("m");
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminMeeting | "new" | null>(null);
  const [created, setCreated] = useState<AdminMeeting | null>(null);

  const load = useCallback(async () => {
    if (!key) return;
    try {
      setOv(await call<Overview>("/api/admin/overview", { key }));
      setErr(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setKey(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [key, setKey]);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  const nav = (id: string | null) => {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("m", id);
    else u.searchParams.delete("m");
    window.history.pushState(null, "", u.toString());
    window.scrollTo({ top: 0 });
  };

  if (key === undefined) return <Loading />;
  if (!key) return <Login onKey={setKey} />;
  if (!ov) return err ? <Shell onSignOut={() => setKey(null)} ov={null} reload={load} k={key}><p className="mt-10 text-[#DC143C]">{err}</p></Shell> : <Loading />;

  return (
    <Shell onSignOut={() => setKey(null)} ov={ov} reload={load} k={key}>
      <AnimatePresence mode="wait">
        {openId ? (
          <Detail key={openId} id={openId} k={key} onBack={() => { nav(null); load(); }} onEdit={(m) => setEditing(m)} onChanged={load} ov={ov} />
        ) : (
          <Dashboard key="dash" ov={ov} onOpen={nav} onNew={() => setEditing("new")} />
        )}
      </AnimatePresence>
      <Modal open={!!editing} onClose={() => setEditing(null)} wide>
        {editing && (
          <Editor
            k={key}
            initial={editing === "new" ? null : editing}
            onDone={(m, isNew) => {
              setEditing(null);
              load();
              if (isNew) setCreated(m);
              else window.dispatchEvent(new Event("meet-reload"));
            }}
          />
        )}
      </Modal>
      <Modal open={!!created} onClose={() => setCreated(null)}>
        {created && <CreatedCard m={created} onOpen={() => { setCreated(null); nav(created.id); }} />}
      </Modal>
    </Shell>
  );
}

function Shell({ children, onSignOut, ov, reload, k }: { children: React.ReactNode; onSignOut: () => void; ov: Overview | null; reload: () => void; k: string }) {
  const [syncing, setSyncing] = useState(false);
  const synced = ov?.busy.syncedAt;
  const stale = !synced || Date.now() - Date.parse(synced) > 30 * 60e3;
  const workerOk = ov?.worker.seenAt && Date.now() - Date.parse(ov.worker.seenAt) < 10 * 60e3;
  const syncNow = async () => {
    setSyncing(true);
    try {
      await call("/api/admin/sync-now", { method: "POST", key: k });
      const before = synced;
      for (let i = 0; i < 30; i += 1) {
        await new Promise((r) => setTimeout(r, 3000));
        const o = await call<Overview>("/api/admin/overview", { key: k });
        if (o.busy.syncedAt !== before) break;
      }
    } catch {}
    reload();
    setSyncing(false);
  };
  return (
    <div className="meet-root">
      <Backdrop />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 sm:pt-6 pb-24">
        <TopBar
          right={
            <div className="flex items-center gap-2">
              {ov && (
                <button
                  onClick={syncNow}
                  className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-black/10 px-3 py-1.5 text-xs text-gray-600 hover:text-black backdrop-blur"
                  title={workerOk ? "YorhaPC worker is running" : "The YorhaPC worker has not checked in for a while"}
                >
                  <span className={cn("live-dot", (stale || !workerOk) && "stale")} />
                  <span className="hidden sm:inline">Outlook {synced ? relTime(synced) : "not synced"}</span>
                  <motion.span animate={syncing ? { rotate: 360 } : { rotate: 0 }} transition={syncing ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }}>
                    {Icon.sync("h-3.5 w-3.5")}
                  </motion.span>
                </button>
              )}
              <button onClick={onSignOut} className="rounded-full px-3 py-1.5 text-xs text-gray-500 hover:text-black">
                Sign out
              </button>
            </div>
          }
        />
        {children}
      </div>
    </div>
  );
}

function Login({ onKey }: { onKey: (k: string) => void }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await call("/api/admin/overview", { key: v.trim() });
      onKey(v.trim());
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Did not work");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="meet-root">
      <Backdrop />
      <div className="mx-auto max-w-md px-4 pt-6">
        <TopBar />
        <motion.form onSubmit={go} className="meet-card mt-20 p-7" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">{Icon.lock("h-5 w-5")}</div>
          <h1 className="mt-4 text-2xl font-bold text-black">Your meetings</h1>
          <p className="mt-1 text-sm text-gray-600">Enter your admin key. This browser remembers it.</p>
          <input className="meet-input mt-5" type="password" value={v} onChange={(e) => setV(e.target.value)} autoFocus placeholder="Admin key" autoComplete="current-password" />
          {err && <p className="mt-2 text-sm text-[#DC143C]">{err}</p>}
          <button className="meet-btn mt-4 w-full" disabled={!v.trim() || busy}>
            {busy ? "Checking…" : "Open"}
          </button>
        </motion.form>
      </div>
    </div>
  );
}

// ======================================================================================
function Dashboard({ ov, onOpen, onNew }: { ov: Overview; onOpen: (id: string) => void; onNew: () => void }) {
  const open = ov.meetings.filter((m) => !m.booking && m.status === "open");
  const booked = ov.meetings.filter((m) => m.booking);
  const answers = ov.meetings.reduce((n, m) => n + (!m.booking ? m.responseCount : 0), 0);
  const stats = [
    { n: open.length, label: "collecting times" },
    { n: answers, label: "answers waiting" },
    { n: booked.length, label: "booked" },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45, ease: EASE }}>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          <span className="text-gray-600">Hi </span>
          <span className="text-black">Arash</span>
          <span className="text-gray-600"> :)</span>
        </h1>
        <button className="meet-btn crimson" onClick={onNew}>
          {Icon.plus()} New meeting link
        </button>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 max-w-xl">
        {stats.map((s, i) => (
          <motion.div key={s.label} className="meet-card px-4 py-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i, duration: 0.45, ease: EASE }}>
            <div className="text-3xl font-bold text-black tabular-nums"><CountUp to={s.n} /></div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <Week ov={ov} />

      <h2 className="mt-10 text-lg font-bold text-black">Meeting links</h2>
      {ov.meetings.length === 0 && (
        <div className="meet-card mt-3 p-8 text-center">
          <div className="text-4xl">🗓️</div>
          <p className="mt-2 font-semibold text-black">No meeting links yet</p>
          <p className="text-sm text-gray-600">Make one for each person or group, send them the link, and their answers show up here.</p>
          <button className="meet-btn crimson mt-4" onClick={onNew}>{Icon.plus()} New meeting link</button>
        </div>
      )}
      <motion.div className="mt-3 grid gap-3 sm:grid-cols-2" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }}>
        {ov.meetings.map((m) => (
          <motion.div
            key={m.id}
            layout
            variants={{ h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
            whileHover={{ y: -3 }}
            className="meet-card cursor-pointer p-4 sm:p-5 transition-shadow hover:shadow-[0_24px_50px_-26px_rgba(0,0,0,0.45)]"
            onClick={() => onOpen(m.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-black truncate">{m.title}</div>
                <div className="text-sm text-gray-500 truncate">
                  {m.forName ? `for ${m.forName} · ` : ""}
                  {m.durationMin} min · {monthDay(m.dates[0])}
                  {m.dates.length > 1 ? ` – ${monthDay(m.dates[m.dates.length - 1])}` : ""}
                </div>
              </div>
              <StatusChip m={m} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex -space-x-2">
                {Array.from({ length: Math.min(4, m.responseCount) }).map((_, i) => (
                  <span key={i} className="h-7 w-7 rounded-full border-2 border-white bg-gray-800/80" style={{ background: `hsl(${(i * 67 + 350) % 360} 65% 48%)` }} />
                ))}
              </div>
              <span className="text-sm text-gray-600">
                {m.responseCount ? `${m.responseCount} answer${m.responseCount > 1 ? "s" : ""}` : "No answers yet"}
                {m.lastResponseAt ? ` · ${relTime(m.lastResponseAt)}` : ""}
              </span>
            </div>
            {m.booking ? (
              <div className="mt-3 rounded-xl bg-black px-3 py-2 text-sm text-white">{whenLabel(m.booking.start, m.booking.end)}</div>
            ) : m.best[0] ? (
              <div className="mt-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
                <span className="text-gray-500">Best: </span>
                <b>{whenLabel(m.best[0].start, m.best[0].end)}</b>
                <span className="text-gray-500"> · {m.best[0].count}/{m.responseCount}</span>
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <CopyLink token={m.token} />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/** The next 7 days from Outlook, so it's easy to see the sync is alive. */
function Week({ ov }: { ov: Overview }) {
  const today = ov.now.slice(0, 10);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const H0 = 8 * 60;
  const H1 = 20 * 60;
  const H = 168;
  const ofDay = (d: string) =>
    ov.busy.blocks.filter((b) => b.show !== "Free" && b.s.slice(0, 10) <= d && b.e.slice(0, 10) >= d && !(b.e === `${d}T00:00`));
  const pos = (b: BusyBlock, d: string) => {
    const s = b.s.slice(0, 10) < d ? 0 : toMin(b.s.slice(11));
    const e = b.e.slice(0, 10) > d ? 24 * 60 : toMin(b.e.slice(11));
    const a = Math.max(H0, s);
    const z = Math.min(H1, e);
    if (z <= a) return null;
    return { top: ((a - H0) / (H1 - H0)) * H, h: Math.max(4, ((z - a) / (H1 - H0)) * H) };
  };
  return (
    <div className="meet-card mt-8 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-black flex items-center gap-2">{Icon.cal()} Your next 7 days (from Outlook)</h2>
        <span className="text-xs text-gray-500">8 AM – 8 PM · lighter = tentative</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((d, i) => (
          <div key={d}>
            <div className={cn("text-center text-[11px] sm:text-xs mb-1", d === today ? "text-[#DC143C] font-bold" : "text-gray-500")}>
              {dayName(d)} <span className="hidden sm:inline">{monthDay(d).split(" ")[1]}</span>
            </div>
            <div className="relative rounded-lg border border-black/10 bg-white overflow-hidden" style={{ height: H }}>
              {[10, 12, 14, 16, 18].map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-dashed border-black/[0.06]" style={{ top: ((h * 60 - H0) / (H1 - H0)) * H }} />
              ))}
              {ofDay(d).map((b, j) => {
                const p = pos(b, d);
                if (!p) return null;
                return (
                  <motion.div
                    key={j}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ delay: 0.03 * (i * 3 + j), duration: 0.4, ease: EASE }}
                    style={{ top: p.top, height: p.h, transformOrigin: "top" }}
                    className={cn(
                      "absolute inset-x-0.5 rounded-[5px] px-1 text-[9px] leading-tight text-white overflow-hidden",
                      b.show === "Tentative" ? "bg-[#DC143C]/45" : b.show === "Oof" ? "bg-violet-600/80" : "bg-[#DC143C]/85"
                    )}
                    title={`${b.subject || "Busy"} · ${clock(b.s.slice(11))} – ${clock(b.e.slice(11))} (${b.show})`}
                  >
                    <span className="hidden sm:block truncate pt-0.5">{b.subject}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================================================================================
function CreatedCard({ m, onOpen }: { m: AdminMeeting; onOpen: () => void }) {
  const url = linkOf(m.token);
  const share = async () => {
    try {
      await navigator.share({ title: m.title, text: `Pick the times that work for you: ${m.title}`, url });
    } catch {}
  };
  return (
    <div className="relative text-center">
      <Burst seed={3} />
      <motion.div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black text-white" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
        {Icon.link("h-6 w-6")}
      </motion.div>
      <h2 className="mt-4 text-2xl font-bold text-black">Your link is ready</h2>
      <p className="mt-1 text-sm text-gray-600">Send it to {m.forName || "them"}. You&apos;ll get a Telegram note when they answer.</p>
      <div className="mt-4 rounded-xl border border-black/10 bg-gray-50 px-3 py-2.5 font-mono text-sm break-all">{url}</div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <CopyLink token={m.token} big />
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button className="meet-btn ghost" onClick={share}>Share…</button>
        )}
        <button className="meet-btn" onClick={onOpen}>Open meeting</button>
      </div>
    </div>
  );
}

// ======================================================================================
function DayPicker({ value, onChange, today }: { value: string[]; onChange: (v: string[]) => void; today: string }) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const sel = new Set(value);
  const drag = useRef<{ add: boolean } | null>(null);
  const y = Number(month.slice(0, 4));
  const mo = Number(month.slice(5, 7));
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const toggle = (d: string, add: boolean) => {
    const s = new Set(sel);
    if (add) s.add(d);
    else s.delete(d);
    onChange([...s].sort());
  };
  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  const title = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button type="button" className="meet-btn ghost small" onClick={() => shift(-1)} disabled={month <= today.slice(0, 7)}>←</button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={month} className="text-sm font-semibold" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            {title}
          </motion.span>
        </AnimatePresence>
        <button type="button" className="meet-btn ghost small" onClick={() => shift(1)}>→</button>
      </div>
      <div className="mini-cal text-center text-[11px] text-gray-400 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div
        className="mini-cal"
        onPointerMove={(e) => {
          if (!drag.current) return;
          const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest("[data-day]") as HTMLElement | null;
          const d = el?.dataset.day;
          if (d && d >= today && sel.has(d) !== drag.current.add) toggle(d, drag.current.add);
        }}
      >
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              data-day={d}
              disabled={d < today}
              className={cn(sel.has(d) && "on", d === today && "today")}
              onPointerDown={(e) => {
                e.preventDefault();
                const add = !sel.has(d);
                drag.current = { add };
                toggle(d, add);
              }}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`x${i}`} />
          )
        )}
      </div>
    </div>
  );
}

function nextWeekdays(from: string, n: number) {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const HOURS = Array.from({ length: 49 }, (_, i) => fromMin(i * 30));

function Editor({ k, initial, onDone }: { k: string; initial: AdminMeeting | null; onDone: (m: AdminMeeting, isNew: boolean) => void }) {
  const [today] = useState(() => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  });
  const [f, setF] = useState(() => ({
    title: initial?.title ?? "",
    forName: initial?.forName ?? "",
    note: initial?.note ?? "",
    location: initial?.location ?? "",
    durationMin: initial?.durationMin ?? 30,
    slotMin: initial?.slotMin ?? 30,
    dayStart: initial?.dayStart ?? "09:00",
    dayEnd: initial?.dayEnd ?? "17:00",
    dates: initial?.dates ?? nextWeekdays(today, 5),
    blockBusy: initial?.blockBusy ?? true,
    inviteEmails: (initial?.inviteEmails ?? []).join(", "),
  }));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(key: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [key]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = { ...f, inviteEmails: f.inviteEmails };
      const m = initial
        ? await call<AdminMeeting>(`/api/admin/meetings/${initial.id}`, { method: "PATCH", body, key: k })
        : await call<AdminMeeting>("/api/admin/meetings", { method: "POST", body, key: k });
      onDone(m, !initial);
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };
  const pickLen = (d: number) => setF((x) => ({ ...x, durationMin: d, slotMin: d % 30 ? 15 : x.slotMin === 60 && d % 60 ? 30 : x.slotMin }));
  return (
    <form onSubmit={save}>
      <h2 className="text-2xl font-bold text-black">{initial ? "Edit meeting" : "New meeting link"}</h2>
      <p className="text-sm text-gray-600">{initial ? "Answers outside the new days or hours are dropped." : "One link per person or group. Your Outlook busy times are blocked out for them."}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Title</span>
            <input className="meet-input mt-1" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Coffee chat" autoFocus maxLength={120} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Who is it for? <span className="font-normal text-gray-400">(the page says hi to them)</span></span>
            <input className="meet-input mt-1" value={f.forName} onChange={(e) => set("forName", e.target.value)} placeholder="Sara" maxLength={80} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Where</span>
            <input className="meet-input mt-1" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="DEH 145, Zoom, …" maxLength={200} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Note to them <span className="font-normal text-gray-400">(optional)</span></span>
            <textarea className="meet-input mt-1" rows={3} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={1000} placeholder="Looking forward to it!" />
          </label>
          <div>
            <span className="text-xs font-semibold text-gray-600">Length</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[15, 30, 45, 60, 90, 120].map((d) => (
                <button type="button" key={d} onClick={() => pickLen(d)} className={cn("rounded-full px-3 py-1.5 text-sm border transition-colors", f.durationMin === d ? "bg-black text-white border-black" : "border-black/15 hover:bg-black/5")}>
                  {d < 60 ? `${d} min` : `${d / 60} h`}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">From</span>
              <select className="meet-input mt-1" value={f.dayStart} onChange={(e) => set("dayStart", e.target.value)}>
                {HOURS.slice(0, -1).map((h) => <option key={h} value={h}>{clock(h)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">To</span>
              <select className="meet-input mt-1" value={f.dayEnd} onChange={(e) => set("dayEnd", e.target.value)}>
                {HOURS.slice(1).map((h) => <option key={h} value={h}>{h === "24:00" ? "Midnight" : clock(h)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Grid</span>
              <select className="meet-input mt-1" value={f.slotMin} onChange={(e) => set("slotMin", Number(e.target.value))}>
                {[15, 30, 60].map((s) => <option key={s} value={s}>{s} min</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-black/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600">Days <span className="font-normal text-gray-400">(tap or drag)</span></span>
              <span className="text-xs text-gray-500">{f.dates.length} picked</span>
            </div>
            <DayPicker value={f.dates} onChange={(v) => set("dates", v)} today={today} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" className="meet-btn ghost small" onClick={() => set("dates", nextWeekdays(today, 5))}>Next 5 weekdays</button>
              <button type="button" className="meet-btn ghost small" onClick={() => set("dates", nextWeekdays(today, 10))}>Next 2 weeks</button>
              <button type="button" className="meet-btn ghost small" onClick={() => set("dates", [])}>Clear</button>
            </div>
          </div>
          <Toggle on={f.blockBusy} onChange={(v) => set("blockBusy", v)} label="Block my busy times" hint="Times busy or tentative in Outlook can't be picked." />
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Invite emails <span className="font-normal text-gray-400">(optional, filled in when you book)</span></span>
            <input className="meet-input mt-1" value={f.inviteEmails} onChange={(e) => set("inviteEmails", e.target.value)} placeholder="sara@ou.edu, …" />
          </label>
        </div>
      </div>
      {err && <p className="mt-4 text-sm text-[#DC143C]">{err}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button className="meet-btn crimson" disabled={busy || !f.title.trim() || !f.dates.length}>
          {busy ? "Saving…" : initial ? "Save" : "Create link"}
        </button>
      </div>
    </form>
  );
}

// ======================================================================================
function Detail({ id, k, onBack, onEdit, onChanged, ov }: { id: string; k: string; onBack: () => void; onEdit: (m: AdminMeeting) => void; onChanged: () => void; ov: Overview }) {
  const [m, setM] = useState<AdminMeeting | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await call<AdminMeeting>(`/api/admin/meetings/${id}`, { key: k });
      setM(r);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [id, k]);
  useEffect(() => {
    load();
    const r = () => load();
    window.addEventListener("meet-reload", r);
    return () => window.removeEventListener("meet-reload", r);
  }, [load]);
  const pending = m?.booking && ["queued", "sending"].includes(m.booking.status || "");
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && load(), pending ? 3000 : 15000);
    return () => clearInterval(t);
  }, [load, pending]);

  const busySet = useMemo(() => new Set(m?.arashBusy ?? []), [m]);
  const blocks = ov.busy.blocks;
  const busyInfo = useCallback(
    (slot: string) => {
      const end = addMin(slot, m?.slotMin ?? 30);
      const hit = blocks.filter((b) => b.show !== "Free" && b.s < end && b.e > slot);
      return hit.length ? hit.map((b) => `${b.subject || "Busy"}${b.show === "Tentative" ? " (tentative)" : ""}`).join(" · ") : null;
    },
    [blocks, m?.slotMin]
  );

  if (err && !m) return <div className="mt-10"><button className="meet-btn ghost small" onClick={onBack}>{Icon.back()} All meetings</button><p className="mt-4 text-[#DC143C]">{err}</p></div>;
  if (!m) return <div className="shimmer mt-10 h-96 w-full" />;

  const pub = { ...m, tz: "America/Chicago", arashBusy: m.arashBusy ?? [], now: m.now ?? ov.now, syncedAt: ov.busy.syncedAt, responses: m.responses ?? [] } as unknown as PublicMeeting;
  const need = Math.ceil(m.durationMin / m.slotMin);
  const shownPick = m.booking ? { start: m.booking.start, len: Math.ceil((m.booking.durationMin ?? m.durationMin) / m.slotMin), booked: true } : pick ? { start: pick, len: need } : null;
  const responses = m.responses ?? [];

  const del = async () => {
    if (!window.confirm(`Delete "${m.title}" and its ${responses.length} answers? The link stops working.`)) return;
    await call(`/api/admin/meetings/${m.id}`, { method: "DELETE", key: k }).catch((e) => alert(e.message));
    onBack();
  };
  const setStatus = async (status: "open" | "closed") => {
    setM(await call<AdminMeeting>(`/api/admin/meetings/${m.id}`, { method: "PATCH", body: { status }, key: k }));
    onChanged();
  };
  const delResp = async (rid: string, name: string) => {
    if (!window.confirm(`Remove ${name}'s answer?`)) return;
    setM(await call<AdminMeeting>(`/api/admin/meetings/${m.id}/responses/${rid}`, { method: "DELETE", key: k }));
  };
  const unbook = async () => {
    const sent = m.booking?.status === "sent";
    if (!window.confirm(sent ? "Mark as not booked? The Outlook event stays; cancel it in Outlook if needed." : "Undo this booking? Nothing will be sent.")) return;
    try {
      setM(await call<AdminMeeting>(`/api/admin/meetings/${m.id}/unbook`, { method: "POST", key: k }));
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.4, ease: EASE }}>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button className="meet-btn ghost small" onClick={onBack}>{Icon.back()} All meetings</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <CopyLink token={m.token} />
          <a className="meet-btn ghost small" href={`/meet/?m=${m.token}`} target="_blank" rel="noreferrer">Open guest page ↗</a>
          <button className="meet-btn ghost small" onClick={() => onEdit(m)}>{Icon.edit("h-3.5 w-3.5")} Edit</button>
          {!m.booking && (m.status === "open" ? <button className="meet-btn ghost small" onClick={() => setStatus("closed")}>Close</button> : <button className="meet-btn ghost small" onClick={() => setStatus("open")}>Reopen</button>)}
          <button className="meet-btn ghost small text-[#DC143C]" onClick={del}>{Icon.trash("h-3.5 w-3.5")}</button>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-black">{m.title}</h1>
        <StatusChip m={m} />
      </div>
      <p className="mt-1 text-gray-600">
        {m.forName ? `for ${m.forName} · ` : ""}
        {m.durationMin} min{m.location ? ` · ${m.location}` : ""} · {clock(m.dayStart)} – {clock(m.dayEnd)}
      </p>

      <BookingBanner m={m} onUndo={unbook} />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="meet-card p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-bold text-black">Everyone&apos;s times {responses.length ? `(${responses.length})` : ""}</h2>
            <span className="inline-flex items-center gap-3 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1.5"><span className="legend-swatch busy" />your Outlook</span>
              <span className="inline-flex items-center gap-2">0 <span className="heat-bar" /> all</span>
            </span>
          </div>
          <TimeGrid
            dates={m.dates}
            dayStart={m.dayStart}
            dayEnd={m.dayEnd}
            slotMin={m.slotMin}
            now={m.now ?? ov.now}
            busy={busySet}
            busyInfo={busyInfo}
            mode="heat"
            people={responses}
            pick={shownPick}
            onPick={m.booking ? undefined : (s) => setPick(s === pick ? null : s)}
          />
          <p className="mt-3 text-xs text-gray-500">{m.booking ? "The booked time is outlined." : "Tap a cell to start the meeting there, then book it."}</p>
          <AnimatePresence>
            {pick && !m.booking && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-black px-4 py-3 text-white">
                <span className="text-sm">
                  <b>{whenLabel(pick, addMin(pick, m.durationMin))}</b>
                </span>
                <button className="meet-btn crimson small ml-auto" onClick={() => setBooking(true)}>Book this time</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="meet-card p-4 sm:p-5">
            <h3 className="text-sm font-bold text-black flex items-center gap-2">{Icon.sparkle("h-4 w-4 text-[#DC143C]")} Best times</h3>
            {m.best.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">{responses.length ? "No full slot fits everyone and your calendar yet." : "Waiting for the first answer."}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {m.best.map((w, i) => (
                  <motion.li key={w.start} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className={cn("rounded-xl border px-3 py-2", pick === w.start ? "border-black bg-black text-white" : "border-black/10 bg-white")}>
                    <button className="w-full text-left" onClick={() => setPick(w.start)}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">{dayName(w.start.slice(0, 10))} {monthDay(w.start.slice(0, 10))}</span>
                        <span className={cn("text-xs tabular-nums", pick === w.start ? "text-white/70" : "text-gray-500")}>{w.count}/{responses.length}</span>
                      </div>
                      <div className={cn("text-sm", pick === w.start ? "text-white/90" : "text-gray-700")}>
                        {windowLabel(w, m.durationMin).range}
                        {windowLabel(w, m.durationMin).any && <span className={cn("ml-1.5 text-xs", pick === w.start ? "text-white/60" : "text-gray-400")}>· {windowLabel(w, m.durationMin).any}</span>}
                      </div>
                      {w.count < responses.length && <div className={cn("text-xs mt-0.5", pick === w.start ? "text-white/60" : "text-gray-400")}>free: {w.free.join(", ")}</div>}
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
          <div className="meet-card p-4 sm:p-5">
            <h3 className="text-sm font-bold text-black flex items-center gap-2">{Icon.people()} Answers</h3>
            {responses.length === 0 && <p className="mt-2 text-sm text-gray-500">Nobody yet. Copy the link and send it over.</p>}
            <ul className="mt-3 space-y-3">
              {responses.map((r) => (
                <li key={r.id} className="flex items-start gap-2.5">
                  <Avatar name={r.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-black truncate">{r.name}</div>
                    <div className="text-xs text-gray-500 truncate">{r.email || "no email"} · {((r.slots.length * m.slotMin) / 60).toFixed(1)} h · {relTime(r.updatedAt)}</div>
                    {r.note && <div className="mt-1 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700">“{r.note}”</div>}
                  </div>
                  <button className="text-gray-300 hover:text-[#DC143C]" onClick={() => delResp(r.id, r.name)} aria-label={`Remove ${r.name}`}>{Icon.trash("h-3.5 w-3.5")}</button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <Modal open={booking && !!pick} onClose={() => setBooking(false)}>
        {pick && (
          <BookForm
            k={k}
            m={m}
            start={pick}
            onDone={(r) => {
              setBooking(false);
              setPick(null);
              setM(r);
              onChanged();
            }}
          />
        )}
      </Modal>
    </motion.div>
  );
}

function BookingBanner({ m, onUndo }: { m: AdminMeeting; onUndo: () => void }) {
  const b = m.booking;
  const [, tick] = useState(0);
  useEffect(() => {
    if (b?.status !== "queued") return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [b?.status]);
  if (!b) return null;
  const left = b.sendAfter ? Math.max(0, Math.ceil((Date.parse(b.sendAfter) - Date.now()) / 1000)) : 0;
  const who = b.emails?.length ? b.emails.join(", ") : "nobody (only your calendar)";
  return (
    <motion.div layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={cn("mt-5 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex flex-wrap items-center gap-3", b.status === "failed" ? "bg-red-50 border border-red-200" : "bg-black text-white")}>
      <div className="min-w-0">
        <div className="font-semibold">{whenLabel(b.start, b.end)}</div>
        <div className={cn("text-sm", b.status === "failed" ? "text-red-700" : "text-white/70")}>
          {b.status === "queued" && (left > 0 ? `Outlook invite to ${who} goes out in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : `Waiting for the YorhaPC worker to create it (invite to ${who})…`)}
          {b.status === "sending" && "Creating the Outlook event…"}
          {b.status === "sent" && <>Outlook event created · invite sent to {who}{b.webLink && <> · <a className="underline" href={b.webLink} target="_blank" rel="noreferrer">open in Outlook</a></>}</>}
          {b.status === "booked" && "Booked without an Outlook event."}
          {b.status === "failed" && `Could not create the event: ${b.error || "unknown error"}. Nothing was sent.`}
        </div>
      </div>
      {b.status !== "sending" && (
        <button className={cn("meet-btn small ml-auto", b.status === "failed" ? "" : "bg-white !text-black hover:!bg-white/90")} onClick={onUndo}>
          {b.status === "queued" ? "Undo" : b.status === "failed" ? "Clear and book again" : "Mark not booked"}
        </button>
      )}
    </motion.div>
  );
}

function BookForm({ k, m, start, onDone }: { k: string; m: AdminMeeting; start: string; onDone: (m: AdminMeeting) => void }) {
  const fromAnswers = (m.responses ?? []).map((r) => r.email).filter(Boolean) as string[];
  const [f, setF] = useState({
    durationMin: m.durationMin,
    title: m.forName ? `${m.title} · ${m.forName}` : m.title,
    location: m.location,
    message: "",
    emails: [...new Set([...m.inviteEmails, ...fromAnswers])].join(", "),
    teams: false,
    createEvent: true,
    agree: false,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(key: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [key]: v, ...(key !== "agree" ? { agree: false } : {}) }));
  const end = addMin(start, f.durationMin);
  const emails = f.emails.split(/[\s,;]+/).filter(Boolean);
  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await call<AdminMeeting>(`/api/admin/meetings/${m.id}/book`, {
        method: "POST",
        key: k,
        body: { start, durationMin: f.durationMin, title: f.title, location: f.location, message: f.message, emails, teams: f.teams, createEvent: f.createEvent, confirm: true },
      });
      onDone(r);
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={book}>
      <h2 className="text-2xl font-bold text-black">Book this time</h2>
      <div className="mt-3 rounded-xl bg-black px-4 py-3 text-white">
        <div className="font-semibold">{whenLabel(start, end)}</div>
        <div className="text-sm text-white/70">Central time</div>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Event title</span>
          <input className="meet-input mt-1" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Length</span>
            <select className="meet-input mt-1" value={f.durationMin} onChange={(e) => set("durationMin", Number(e.target.value))}>
              {[15, 20, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Where</span>
            <input className="meet-input mt-1" value={f.location} onChange={(e) => set("location", e.target.value)} maxLength={200} />
          </label>
        </div>
        <Toggle on={f.createEvent} onChange={(v) => set("createEvent", v)} label="Create the Outlook event" hint="Off: only mark it booked here (the guest page shows the time)." />
        {f.createEvent && (
          <>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Send the invite to</span>
              <input className="meet-input mt-1" value={f.emails} onChange={(e) => set("emails", e.target.value)} placeholder="Empty = only your calendar" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Message in the invite <span className="font-normal text-gray-400">(optional)</span></span>
              <textarea className="meet-input mt-1" rows={2} value={f.message} onChange={(e) => set("message", e.target.value)} maxLength={2000} />
            </label>
            <Toggle on={f.teams} onChange={(v) => set("teams", v)} label="Add a Teams meeting link" />
          </>
        )}
        <label className="flex items-start gap-3 rounded-xl border border-black/10 bg-amber-50/60 p-3 cursor-pointer">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-black" checked={f.agree} onChange={(e) => set("agree", e.target.checked)} />
          <span className="text-sm text-gray-800">
            {f.createEvent
              ? emails.length
                ? <>I approve sending this Outlook invite to <b>{emails.join(", ")}</b>. It goes out in 2 minutes unless I undo it.</>
                : <>I approve adding this event to my Outlook calendar (no one else is invited).</>
              : <>Mark this meeting booked for this time.</>}
          </span>
        </label>
      </div>
      {err && <p className="mt-3 text-sm text-[#DC143C]">{err}</p>}
      <div className="mt-5 flex justify-end">
        <button className="meet-btn crimson" disabled={!f.agree || busy || !f.title.trim()}>
          {busy ? "Booking…" : "Book it"}
        </button>
      </div>
    </form>
  );
}
