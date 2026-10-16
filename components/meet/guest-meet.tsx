"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";
import {
  ApiError, bestWindows, call, dayName, fullDate, icsFor, localEcho, monthDay, relTime, span, timesOf, viewerZone, windowLabel,
  type PublicMeeting,
} from "@/lib/meet";
import { Avatar, Burst, Icon } from "./bits";
import { TimeGrid } from "./time-grid";

const EASE = [0.22, 1, 0.36, 1] as const;
type Saved = { id: string; editKey: string; name: string; email: string };

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setR(m.matches);
    u();
    m.addEventListener("change", u);
    return () => m.removeEventListener("change", u);
  }, []);
  return r;
}

export function Backdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-white" aria-hidden="true">
      <DotPattern width={20} height={20} cx={1} cy={1} cr={1} className="pointer-events-none [mask-image:radial-gradient(900px_circle_at_50%_20%,white,transparent)]" />
      <motion.div
        className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(220,20,60,0.10), transparent 65%)" }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <a href="/" className="group inline-flex items-center gap-2 rounded-full bg-white/80 border border-black/10 px-3 py-1.5 text-sm text-gray-700 hover:text-black backdrop-blur transition-colors">
        <span className="relative h-6 w-6 overflow-hidden rounded-full">
          <Image src="/portrait.jpg" alt="" fill className="object-cover" sizes="24px" />
        </span>
        arash-ahmadi.com
      </a>
      {right}
    </div>
  );
}

function Pills({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: { id: string; label: React.ReactNode }[] }) {
  return (
    <div role="tablist" className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-1">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className="relative rounded-full px-3.5 py-1.5 text-sm"
          style={{ touchAction: "manipulation" }}
        >
          {value === it.id && <motion.span layoutId="meet-pill" className="absolute inset-0 rounded-full bg-black" transition={{ type: "spring", bounce: 0.18, duration: 0.5 }} />}
          <span className={cn("relative z-10 transition-colors", value === it.id ? "text-white" : "text-black/70 hover:text-black")}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function SyncLine({ at }: { at: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const stale = !at || Date.now() - Date.parse(at) > 30 * 60e3;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-gray-500">
      <span className={cn("live-dot", stale && "stale")} />
      {at ? `Synced with Arash's calendar ${relTime(at)}` : "Waiting for Arash's calendar"}
    </span>
  );
}

export function GuestMeet({ token }: { token: string }) {
  const reduced = useReduced();
  const [m, setM] = useState<PublicMeeting | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"mine" | "group">("mine");
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(0);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const storeKey = `meet:${token}`;

  const load = useCallback(async () => {
    try {
      const r = await call<PublicMeeting>(`/api/m/${token}`);
      setM(r);
      setErr(null);
      return r;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not load this meeting.");
      return null;
    }
  }, [token]);

  useEffect(() => {
    let me: Saved | null = null;
    try {
      me = JSON.parse(localStorage.getItem(storeKey) || "null");
    } catch {}
    if (me) {
      setSaved(me);
      setName(me.name);
      setEmail(me.email || "");
    }
    load().then((r) => {
      if (r && me) {
        const mineR = r.responses.find((x) => x.id === me!.id);
        if (mineR) setMine(new Set(mineR.slots));
        else {
          localStorage.removeItem(storeKey);
          setSaved(null);
        }
      }
    });
  }, [load, storeKey]);

  // Keep everyone else's answers and Arash's calendar fresh while the page is open.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const busy = useMemo(() => new Set(m?.arashBusy ?? []), [m]);
  const others = useMemo(() => (m ? m.responses.filter((r) => r.id !== saved?.id) : []), [m, saved]);
  const everyone = useMemo(() => [...others, { id: "me", name: m?.forName.trim() || name.trim() || "You", slots: [...mine], updatedAt: "" }], [others, name, mine, m]);
  const best = useMemo(() => (m ? bestWindows(m, everyone.filter((p) => p.slots.length), 4) : []), [m, everyone]);
  const total = everyone.filter((p) => p.slots.length).length;

  if (err && !m) return <ErrorCard text={err} />;
  if (!m) return <Loading />;

  const locked = m.status !== "open" || !!m.booking;
  // A link made for one person carries their name; they can't change it. Group links (no name) ask for one.
  const fixedName = m.forName.trim();
  const who = fixedName || name.trim();
  const firstDay = m.dates[0];
  const lastDay = m.dates[m.dates.length - 1];
  const dateRange = firstDay === lastDay ? `${dayName(firstDay)}, ${monthDay(firstDay)}` : `${monthDay(firstDay)} – ${monthDay(lastDay)}`;
  const freeCells = m.dates.flatMap((d) => timesOf(m).map((t) => `${d}T${t}`)).filter((s) => !busy.has(s) && s >= m.now);
  const zone = viewerZone();
  const away = localEcho(`${firstDay}T12:00`) != null;

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      if (saved) {
        const r = await call<{ meeting: PublicMeeting }>(`/api/m/${token}/responses/${saved.id}`, {
          method: "PUT",
          body: { editKey: saved.editKey, name: who, email, note: note || undefined, slots: [...mine] },
        });
        setM(r.meeting);
        const me = { ...saved, name: who, email };
        localStorage.setItem(storeKey, JSON.stringify(me));
        setSaved(me);
      } else {
        const r = await call<{ id: string; editKey: string; meeting: PublicMeeting }>(`/api/m/${token}/responses`, {
          method: "POST",
          body: { name: who, email, note, slots: [...mine] },
        });
        const me = { id: r.id, editKey: r.editKey, name: who, email };
        localStorage.setItem(storeKey, JSON.stringify(me));
        setSaved(me);
        setM(r.meeting);
      }
      setDirty(false);
      setFlash((x) => x + 1);
    } catch (e) {
      setSaveErr(e instanceof ApiError ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const hello = m.forName ? `Hi ${m.forName.split(" ")[0]}! ` : "Hi! ";

  return (
    <div className="meet-root">
      <Backdrop />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 sm:pt-6 pb-28">
        <TopBar right={<SyncLine at={m.syncedAt} />} />

        {/* ---- hero ---- */}
        <motion.header
          className="mt-8 sm:mt-12 flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-8"
          initial={reduced ? false : "hidden"}
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        >
          <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.9, rotate: -4 }, show: { opacity: 1, scale: 1, rotate: -3, transition: { type: "spring", bounce: 0.35, duration: 0.7 } } }}
            whileHover={reduced ? undefined : { rotate: 0, scale: 1.04 }}
            className="relative h-28 w-24 sm:h-36 sm:w-28 flex-shrink-0 overflow-hidden rounded-2xl shadow-[0_18px_44px_-18px_rgba(0,0,0,0.45)]"
          >
            <Image src="/portrait.jpg" alt="Arash Ahmadi" fill className="object-cover" sizes="112px" priority />
          </motion.div>
          <div className="min-w-0">
            <motion.h1
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
              className="text-3xl sm:text-5xl font-bold tracking-tight"
            >
              <span className="text-gray-600">{hello}Let&apos;s find a </span>
              <span className="text-black relative inline-block">
                time
                <motion.svg viewBox="0 0 120 12" className="absolute -bottom-2 left-0 w-full" preserveAspectRatio="none" aria-hidden="true">
                  <motion.path
                    d="M2 8 C 30 2, 60 12, 118 4"
                    fill="none"
                    stroke="#DC143C"
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
                  />
                </motion.svg>
              </span>
              <span className="text-gray-600"> :)</span>
            </motion.h1>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="mt-4 flex flex-wrap items-center gap-2">
              <span className="meet-chip bg-black text-white">{m.title}</span>
              <span className="meet-chip">{Icon.clock("h-3.5 w-3.5")} {m.durationMin} min</span>
              <span className="meet-chip">{Icon.cal("h-3.5 w-3.5")} {dateRange}</span>
              {m.location && <span className="meet-chip">{Icon.pin("h-3.5 w-3.5")} {m.location}</span>}
            </motion.div>
            {m.note && (
              <motion.p variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="mt-3 max-w-2xl text-gray-700 leading-relaxed whitespace-pre-line">
                {m.note}
              </motion.p>
            )}
          </div>
        </motion.header>

        <AnimatePresence mode="wait">
          {m.booking ? (
            <Booked key="booked" m={m} reduced={reduced} />
          ) : (
            <motion.section
              key="grid"
              className="mt-8 sm:mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start"
              initial={reduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } }}
            >
              <div className="meet-card p-3 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <Pills
                    value={tab}
                    onChange={(v) => setTab(v as "mine" | "group")}
                    items={[
                      { id: "mine", label: "Your times" },
                      { id: "group", label: <>Everyone <span className="opacity-60">{total}</span></> },
                    ]}
                  />
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    {tab === "mine" ? (
                      <>
                        <span className="inline-flex items-center gap-1.5"><span className="legend-swatch" style={{ background: "#DC143C", borderColor: "#DC143C" }} />You&apos;re free</span>
                        <span className="inline-flex items-center gap-1.5"><span className="legend-swatch busy" />Arash busy</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-2">0 <span className="heat-bar" /> all free</span>
                    )}
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={tab} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    <TimeGrid
                      dates={m.dates}
                      dayStart={m.dayStart}
                      dayEnd={m.dayEnd}
                      slotMin={m.slotMin}
                      now={m.now}
                      busy={busy}
                      mode={tab === "mine" ? "paint" : "heat"}
                      mine={mine}
                      onPaint={
                        locked
                          ? undefined
                          : (next) => {
                              setMine(next);
                              setDirty(true);
                            }
                      }
                      people={everyone.filter((p) => p.slots.length)}
                      highlight={undefined}
                      reduced={reduced}
                    />
                  </motion.div>
                </AnimatePresence>
                <p className="mt-3 text-xs text-gray-500">
                  {tab === "mine"
                    ? "Press and drag across the grid to paint the times you're free. Drag over painted cells to erase."
                    : "Darker means more people are free. Hover or tap a cell to see who."}{" "}
                  Times are Central Time (Norman, OK){away ? `; hover shows your time in ${zone.replace(/_/g, " ")}` : ""}.
                </p>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-6">
                <div className="meet-card p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={who || "You"} size={36} />
                    <div className="min-w-0 flex-1">
                      {fixedName ? (
                        <div className="font-semibold text-black truncate">{fixedName}</div>
                      ) : (
                        <input
                          className="meet-input !py-1.5 text-sm"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            setDirty(true);
                          }}
                          maxLength={60}
                          placeholder="Your name"
                          autoComplete="name"
                          disabled={locked}
                        />
                      )}
                    </div>
                  </div>
                  <label className="mt-3 block">
                    <span className="text-xs font-semibold text-gray-600">Your email <span className="font-normal text-gray-400">(for the calendar invite)</span></span>
                    <input
                      className="meet-input mt-1 text-sm"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setDirty(true);
                      }}
                      maxLength={120}
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={locked}
                    />
                  </label>
                  <div className="mt-4 flex items-baseline gap-2">
                    <motion.span key={mine.size} initial={reduced ? false : { y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl font-bold text-black tabular-nums">
                      {((mine.size * m.slotMin) / 60).toFixed(mine.size * m.slotMin % 60 ? 1 : 0)}
                    </motion.span>
                    <span className="text-sm text-gray-600">hours marked free</span>
                  </div>
                  {!locked && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="meet-btn ghost small"
                        onClick={() => {
                          setMine(new Set(freeCells));
                          setDirty(true);
                          setTab("mine");
                        }}
                      >
                        {Icon.sparkle("h-3.5 w-3.5")} All of Arash&apos;s free time
                      </button>
                      <button
                        className="meet-btn ghost small"
                        onClick={() => {
                          setMine(new Set());
                          setDirty(true);
                        }}
                        disabled={!mine.size}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  {!locked && (
                    <textarea
                      className="meet-input mt-3 text-sm"
                      rows={2}
                      maxLength={500}
                      placeholder="Anything Arash should know? (optional)"
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        setDirty(true);
                      }}
                    />
                  )}
                  <div className="relative mt-4">
                    <button className="meet-btn crimson w-full" onClick={save} disabled={saving || locked || (!dirty && !!saved) || !who}>
                      {saving ? "Saving…" : saved ? (dirty ? "Save changes" : <>{Icon.check()} Saved</>) : "Send my times to Arash"}
                    </button>
                    <AnimatePresence>{flash > 0 && <Burst key={flash} seed={flash} />}</AnimatePresence>
                  </div>
                  <AnimatePresence>
                    {saveErr && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 text-sm text-[#DC143C]">
                        {saveErr}
                      </motion.p>
                    )}
                    {flash > 0 && !dirty && !saveErr && (
                      <motion.p key={`ok${flash}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm text-gray-600">
                        Thanks! Arash just got a note. You can come back to this link any time to change your times.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="meet-card p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-black flex items-center gap-2">{Icon.sparkle("h-4 w-4 text-[#DC143C]")} Best times so far</h3>
                  {best.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">Paint a few times and the best {m.durationMin} minute slots show up here.</p>
                  ) : (
                    <motion.ul layout className="mt-3 space-y-2">
                      <AnimatePresence initial={false}>
                        {best.map((w, i) => (
                          <motion.li
                            key={w.start}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.3, ease: EASE }}
                            className={cn("rounded-xl border px-3 py-2", i === 0 ? "border-black bg-black text-white" : "border-black/10 bg-white")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm">{dayName(w.start.slice(0, 10))} {monthDay(w.start.slice(0, 10))}</span>
                              <span className={cn("text-xs tabular-nums", i === 0 ? "text-white/70" : "text-gray-500")}>
                                {w.count}/{total} free
                              </span>
                            </div>
                            <div className={cn("text-sm", i === 0 ? "text-white/90" : "text-gray-700")}>
                              {windowLabel(w, m.durationMin).range}
                              {windowLabel(w, m.durationMin).any && <span className={cn("ml-1.5 text-xs", i === 0 ? "text-white/60" : "text-gray-400")}>· {windowLabel(w, m.durationMin).any}</span>}
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </div>

                {others.length > 0 && (
                  <div className="meet-card p-4 sm:p-5">
                    <h3 className="text-sm font-bold text-black flex items-center gap-2">{Icon.people()} Also answered</h3>
                    <ul className="mt-3 space-y-2">
                      {others.map((r) => (
                        <li key={r.id} className="flex items-center gap-2 text-sm">
                          <Avatar name={r.name} size={24} />
                          <span className="truncate">{r.name}</span>
                          <span className="ml-auto text-xs text-gray-500">{((r.slots.length * m.slotMin) / 60).toFixed(1)} h</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* phone: sticky save bar while there are unsaved changes */}
      <AnimatePresence>
        {dirty && !m.booking && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-40 lg:hidden p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
            initial={{ y: 90 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
          >
            <button className="meet-btn crimson w-full py-3.5 text-base" onClick={save} disabled={saving || !who}>
              {saving ? "Saving…" : saved ? "Save changes" : "Send my times to Arash"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Booked({ m, reduced }: { m: PublicMeeting; reduced: boolean }) {
  const b = m.booking!;
  const d = b.start.slice(0, 10);
  const echo = localEcho(b.start);
  const download = () => {
    const blob = new Blob([icsFor(m.title, b.start, b.end, b.location || m.location)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${m.title.replace(/[^\w]+/g, "-").toLowerCase() || "meeting"}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <motion.section
      className="meet-card relative mt-10 max-w-xl overflow-visible p-6 sm:p-8"
      initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } }}
    >
      {!reduced && <Burst seed={7} count={34} />}
      <motion.div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#DC143C] text-white shadow-[0_14px_30px_-12px_rgba(220,20,60,0.9)]"
        initial={reduced ? false : { scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", bounce: 0.5, duration: 0.8, delay: 0.15 }}
      >
        {Icon.check("h-7 w-7")}
      </motion.div>
      <h2 className="mt-5 text-2xl sm:text-3xl font-bold text-black">It&apos;s a plan!</h2>
      <p className="mt-2 text-lg text-gray-700">
        <b className="text-black">{fullDate(d)}</b>
        <br />
        {span(b.start, b.end)} <span className="text-gray-500">Central</span>
        {echo && <span className="block text-sm text-gray-500">({echo})</span>}
      </p>
      {(b.location || m.location) && <p className="mt-2 flex items-center gap-2 text-gray-600">{Icon.pin()} {b.location || m.location}</p>}
      <p className="mt-4 text-sm text-gray-600">If you left your email, a calendar invite from Arash is on its way.</p>
      <button className="meet-btn mt-5" onClick={download}>
        {Icon.download()} Add to my calendar
      </button>
    </motion.section>
  );
}

export function Loading() {
  return (
    <div className="meet-root">
      <Backdrop />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6">
        <div className="shimmer h-9 w-56" />
        <div className="mt-12 flex gap-6">
          <div className="shimmer h-36 w-28" />
          <div className="flex-1 space-y-3 pt-6">
            <div className="shimmer h-10 w-3/4" />
            <div className="shimmer h-6 w-1/2" />
          </div>
        </div>
        <div className="shimmer mt-10 h-[360px] w-full" />
      </div>
    </div>
  );
}

export function ErrorCard({ text }: { text: string }) {
  return (
    <div className="meet-root">
      <Backdrop />
      <div className="mx-auto max-w-xl px-4 pt-6">
        <TopBar />
        <motion.div className="meet-card mt-16 p-7 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <div className="text-5xl">🗓️</div>
          <h1 className="mt-3 text-2xl font-bold text-black">Hmm, that didn&apos;t work</h1>
          <p className="mt-2 text-gray-600">{text}</p>
          <p className="mt-5 text-sm text-gray-500">
            Need a time with Arash? Email{" "}
            <a className="text-[#DC143C] underline" href="mailto:arash.ahmadi@ou.edu">
              arash.ahmadi@ou.edu
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="meet-root">
      <Backdrop />
      <div className="mx-auto max-w-xl px-4 pt-6">
        <TopBar />
        <motion.div className="meet-card mt-16 p-7" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <h1 className="text-3xl font-bold">
            <span className="text-gray-600">Meet with </span>
            <span className="text-black">Arash</span>
            <span className="text-gray-600"> :)</span>
          </h1>
          <p className="mt-3 text-gray-700 leading-relaxed">
            Arash sends a personal link for each meeting. Open yours to paint the times you&apos;re free; his calendar is already on it.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            No link yet? Email{" "}
            <a className="text-[#DC143C] underline" href="mailto:arash.ahmadi@ou.edu">
              arash.ahmadi@ou.edu
            </a>
            .
          </p>
        </motion.div>
      </div>
    </div>
  );
}
