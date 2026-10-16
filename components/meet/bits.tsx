"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const Icon = {
  clock: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  pin: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
  ),
  cal: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
  ),
  check: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S} strokeWidth={2.6}><path d="M5 12.5l4.2 4.2L19 7" /></svg>
  ),
  copy: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
  ),
  link: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
  ),
  plus: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
  ),
  sync: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 21v-5h-5" /></svg>
  ),
  trash: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
  ),
  back: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><path d="M15 18l-6-6 6-6" /></svg>
  ),
  sparkle: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} fill="currentColor"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" opacity=".6" /></svg>
  ),
  edit: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
  ),
  people: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></svg>
  ),
  lock: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
  ),
  download: (c = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={c} {...S}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
  ),
};

const COLORS = ["#dc143c", "#111111", "#f59e0b", "#2563eb", "#16a34a", "#ec4899"];

/** A one-shot confetti burst from the middle of its parent. */
export function Burst({ seed = 1, count = 26 }: { seed?: number; count?: number }) {
  const bits = useMemo(() => {
    let x = seed * 9301 + 49297;
    const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.5;
      const r = 80 + rnd() * 120;
      return { dx: Math.cos(a) * r, dy: Math.sin(a) * r - 40, rot: rnd() * 540 - 270, c: COLORS[i % COLORS.length], w: 6 + rnd() * 6, round: rnd() > 0.6 };
    });
  }, [seed, count]);
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{ width: b.w, height: b.round ? b.w : b.w * 0.45, background: b.c, borderRadius: b.round ? 99 : 2 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: b.dx, y: [0, b.dy, b.dy + 120], opacity: [1, 1, 0], rotate: b.rot, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], times: [0, 0.55, 1] }}
        />
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" className="flex items-start gap-3 text-left w-full" onClick={() => onChange(!on)} aria-pressed={on}>
      <span className={`toggle mt-0.5 ${on ? "on" : ""}`}>
        <i />
      </span>
      <span>
        <span className="block text-sm font-semibold text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

const HUES = [350, 18, 38, 160, 200, 222, 262, 300];
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const n = name.trim() || "?";
  const h = HUES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  const ini = n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 70% 45%)` }}
      title={name}
    >
      {ini}
    </span>
  );
}
