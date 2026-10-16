"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clock, dayName, fromMin, localEcho, monthDay, timesOf, toMin } from "@/lib/meet";

type Person = { name: string; slots: string[] };
type Props = {
  dates: string[];
  dayStart: string;
  dayEnd: string;
  slotMin: number;
  mode: "paint" | "heat";
  now: string;
  busy: Set<string>;
  busyInfo?: (slot: string) => string | null;
  mine?: Set<string>;
  onPaint?: (next: Set<string>) => void;
  people?: Person[];
  pick?: { start: string; len: number; booked?: boolean } | null;
  onPick?: (slot: string) => void;
  highlight?: Set<string>;
  reduced?: boolean;
};

const GUTTER = 46;
const MIN_COL = 58;
const EASE = [0.22, 1, 0.36, 1] as const;

/** When2meet style grid. "paint": press and drag a rectangle to mark or erase free times. "heat": everyone's answers. */
export function TimeGrid(p: Props) {
  const times = useMemo(() => timesOf(p), [p]);
  const cellH = p.slotMin === 15 ? 15 : p.slotMin === 30 ? 22 : 38;
  const wrap = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(7);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const draftRef = useRef<Set<string> | null>(null);
  const drag = useRef<{ base: Set<string>; add: boolean; d0: number; t0: number; last: string } | null>(null);
  const [tip, setTip] = useState<{ slot: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPerPage(Math.max(1, Math.floor((el.clientWidth - GUTTER) / MIN_COL))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pages = Math.max(1, Math.ceil(p.dates.length / perPage));
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  // Start on the page that holds the pick (admin deep link), else the first day.
  const pickDay = p.pick?.start.slice(0, 10);
  const datesKey = p.dates.join(",");
  useEffect(() => {
    if (!pickDay) return;
    const i = datesKey.split(",").indexOf(pickDay);
    if (i >= 0) setPage(Math.floor(i / perPage));
  }, [pickDay, datesKey, perPage]);
  const first = page * perPage;
  const shown = p.dates.slice(first, first + perPage);

  const blocked = useCallback((slot: string) => p.busy.has(slot) || slot < p.now.slice(0, 16), [p.busy, p.now]);
  const mine = draft ?? p.mine ?? new Set<string>();

  // ---- painting ----
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const c = el?.closest?.("[data-slot]") as HTMLElement | null;
    return c ? { slot: c.dataset.slot!, d: Number(c.dataset.d), t: Number(c.dataset.t) } : null;
  };
  const paintTo = (d1: number, t1: number) => {
    const g = drag.current;
    if (!g) return;
    const next = new Set(g.base);
    const [da, db] = [Math.min(g.d0, d1), Math.max(g.d0, d1)];
    const [ta, tb] = [Math.min(g.t0, t1), Math.max(g.t0, t1)];
    for (let d = da; d <= db; d += 1) {
      for (let t = ta; t <= tb; t += 1) {
        const s = `${p.dates[d]}T${times[t]}`;
        if (blocked(s)) continue;
        if (g.add) next.add(s);
        else next.delete(s);
      }
    }
    draftRef.current = next;
    setDraft(next);
  };
  const onDown = (e: React.PointerEvent) => {
    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    if (p.mode === "heat") {
      setTip({ slot: c.slot, x: e.clientX, y: e.clientY });
      if (p.onPick && !blocked(c.slot)) p.onPick(c.slot);
      return;
    }
    if (!p.onPaint) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const base = new Set(p.mine);
    // a drag may start on a busy cell: it then paints the free cells it sweeps over
    drag.current = { base, add: blocked(c.slot) || !base.has(c.slot), d0: c.d, t0: c.t, last: c.slot };
    paintTo(c.d, c.t);
  };
  const onMove = (e: React.PointerEvent) => {
    if (p.mode === "heat") {
      if (e.pointerType === "mouse") {
        const c = cellAt(e.clientX, e.clientY);
        setTip(c ? { slot: c.slot, x: e.clientX, y: e.clientY } : null);
      }
      return;
    }
    const g = drag.current;
    if (!g) return;
    const c = cellAt(e.clientX, e.clientY);
    if (!c || c.slot === g.last) return;
    g.last = c.slot;
    paintTo(c.d, c.t);
  };
  const finish = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    const d = draftRef.current;
    draftRef.current = null;
    if (d) p.onPaint?.(d);
    setDraft(null);
  }, [p]);
  useEffect(() => {
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [finish]);

  // ---- heat ----
  const people = useMemo(() => (p.people ?? []).map((x) => ({ name: x.name, set: new Set(x.slots) })), [p.people]);
  const heat = (slot: string) => {
    if (!people.length) return undefined;
    const c = people.reduce((n, x) => n + (x.set.has(slot) ? 1 : 0), 0);
    if (!c) return undefined;
    const f = c / people.length;
    return `rgba(220, 20, 60, ${(0.14 + 0.86 * f).toFixed(3)})`;
  };

  const go = (d: number) => {
    setDir(d);
    setPage((x) => Math.min(pages - 1, Math.max(0, x + d)));
  };

  const today = p.now.slice(0, 10);
  const nowMin = toMin(p.now.slice(11, 16));
  const startMin = toMin(p.dayStart);
  const endMin = toMin(p.dayEnd);
  const nowTop = nowMin >= startMin && nowMin <= endMin ? ((nowMin - startMin) / p.slotMin) * cellH : null;
  const cols = `${GUTTER}px repeat(${shown.length}, minmax(0, 1fr))`;
  const tipInfo = tip ? tooltip(tip.slot) : null;

  function tooltip(slot: string) {
    const end = fromMin(toMin(slot.slice(11)) + p.slotMin);
    const head = `${dayName(slot.slice(0, 10))} ${monthDay(slot.slice(0, 10))}, ${clock(slot.slice(11))} – ${clock(end)}`;
    const echo = localEcho(slot);
    const busyText = p.busy.has(slot) ? p.busyInfo?.(slot) ?? "Arash is busy" : null;
    const free = people.filter((x) => x.set.has(slot)).map((x) => x.name);
    const not = people.filter((x) => !x.set.has(slot)).map((x) => x.name);
    return { head, echo, busyText, free, not, past: slot < p.now };
  }

  return (
    <div ref={wrap} className={`tg ${p.mode} ${p.onPick ? "pickable" : ""}`}>
      {pages > 1 && (
        <div className="flex items-center justify-between mb-2" style={{ paddingLeft: GUTTER }}>
          <button type="button" className="meet-btn ghost small" onClick={() => go(-1)} disabled={page === 0} aria-label="Earlier days">
            ← Earlier
          </button>
          <span className="text-xs text-gray-500 tabular-nums">
            {first + 1}–{Math.min(p.dates.length, first + perPage)} of {p.dates.length} days
          </span>
          <button type="button" className="meet-btn ghost small" onClick={() => go(1)} disabled={page >= pages - 1} aria-label="Later days">
            Later →
          </button>
        </div>
      )}
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={`${page}-${perPage}`}
          custom={dir}
          initial={p.reduced ? false : { opacity: 0, x: 40 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={p.reduced ? undefined : { opacity: 0, x: -40 * dir }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="tg-cols" style={{ gridTemplateColumns: cols }}>
            <div />
            {shown.map((d) => (
              <div key={d} className={`tg-head ${d === today ? "today" : ""}`}>
                <b>{dayName(d)}</b>
                <span>{monthDay(d)}</span>
              </div>
            ))}
          </div>
          <div
            className="tg-cols"
            style={{ gridTemplateColumns: cols, touchAction: p.mode === "paint" && p.onPaint ? "none" : "pan-y" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerLeave={() => p.mode === "heat" && setTip(null)}
          >
            <div className="tg-gutter" style={{ height: times.length * cellH + 2, touchAction: "pan-y" }}>
              {times.map((t, i) =>
                t.endsWith(":00") || i === 0 ? (
                  <span key={t} style={{ top: i * cellH + 1 }}>
                    {clock(t, true)}
                  </span>
                ) : null
              )}
              {p.dayEnd.endsWith(":00") && <span style={{ top: times.length * cellH + 1 }}>{clock(p.dayEnd, true)}</span>}
            </div>
            {shown.map((d, ci) => {
              const di = first + ci;
              const pickHere = p.pick && p.pick.start.slice(0, 10) === d;
              const pickTop = pickHere ? times.indexOf(p.pick!.start.slice(11, 16)) : -1;
              return (
                <div key={d} className="tg-col">
                  {times.map((t, ti) => {
                    const slot = `${d}T${t}`;
                    const isBusy = p.busy.has(slot);
                    const isPast = slot < p.now.slice(0, 16);
                    const isMine = p.mode === "paint" && mine.has(slot);
                    const erased = p.mode === "paint" && !!draft && !isMine && !!p.mine?.has(slot);
                    const cls = [
                      "tg-cell",
                      t.endsWith(":00") ? "hour" : "",
                      isBusy ? "busy" : isPast ? "past" : "open",
                      isMine ? "mine" : "",
                      erased ? "erase" : "",
                      p.highlight?.has(slot) ? "hl" : "",
                      tip?.slot === slot && p.mode === "heat" ? "hover-row" : "",
                    ].join(" ");
                    return (
                      <div
                        key={slot}
                        data-slot={slot}
                        data-d={di}
                        data-t={ti}
                        className={cls}
                        style={{ height: cellH, background: p.mode === "heat" && !isBusy ? heat(slot) : undefined }}
                      />
                    );
                  })}
                  {d === today && nowTop != null && <div className="tg-now" style={{ top: nowTop }} />}
                  {pickHere && pickTop >= 0 && (
                    <motion.div
                      layoutId="tg-pick"
                      className={`tg-pick ${p.pick!.booked ? "booked" : ""}`}
                      style={{ top: pickTop * cellH + 1, height: Math.min(p.pick!.len, times.length - pickTop) * cellH - 2 }}
                      transition={{ type: "spring", bounce: 0.22, duration: 0.5 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {tip && tipInfo && p.mode === "heat" && (
          <motion.div
            key="tip"
            className="tg-tip"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            style={{
              left: Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 270),
              top: Math.max(8, tip.y - 12 - 40),
            }}
          >
            <div className="font-semibold">{tipInfo.head}</div>
            {tipInfo.echo && <div className="dim">{tipInfo.echo}</div>}
            {tipInfo.busyText && <div className="mt-1.5">🔒 {tipInfo.busyText}</div>}
            {tipInfo.past && !tipInfo.busyText && <div className="mt-1.5 dim">Already passed</div>}
            {people.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                <div>
                  <span className="text-[#ff6b86] font-semibold">{tipInfo.free.length}</span>
                  <span className="dim">/{people.length} free</span>
                  {tipInfo.free.length > 0 && <span>: {tipInfo.free.join(", ")}</span>}
                </div>
                {tipInfo.not.length > 0 && <div className="dim">Not free: {tipInfo.not.join(", ")}</div>}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
