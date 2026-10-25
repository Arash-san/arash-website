"use client";

import { cn } from "@/lib/utils";
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type AnimationPlaybackControls, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DotPattern } from "@/components/ui/dot-pattern";
import Image from "next/image";
import { news } from "@/lib/profile-data";
import { HomeBlogPreview } from "@/components/blog/home-blog-preview";
import { WHEEL, WheelController } from "@/lib/home-wheel";
import { TOUCH, chooseTouchMode, fingerSpeed, flingStep, releaseTarget, splitMove, type TextDrag } from "@/lib/home-touch";

const SECTIONS = ["home", "news", "academic", "tools", "blog", "interests"] as const;
const SECTION_LABELS: Record<(typeof SECTIONS)[number], string> = {
  home: "home",
  news: "news",
  academic: "academic",
  tools: "tools",
  blog: "blog posts",
  interests: "interests",
};
const N = SECTIONS.length;
const EASE = [0.22, 1, 0.36, 1] as const;

// Scrolling has two layers. A section whose text does not fit scrolls inside
// its own box first; then a further scroll or swipe moves to the next section.
// The rules live in lib/home-wheel.ts and lib/home-touch.ts, with unit tests.

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

function HomeSection({
  index,
  p,
  active,
  reduced,
  scrollerRef,
  onScroll,
  children,
}: {
  index: number;
  p: MotionValue<number>;
  active: boolean;
  reduced: boolean;
  scrollerRef: (el: HTMLDivElement | null) => void;
  onScroll: (el: HTMLDivElement) => void;
  children: ReactNode;
}) {
  const opacity = useTransform(p, (v) => {
    const d = Math.abs(index - v);
    return d >= 1 ? 0 : smooth(1 - d);
  });
  // Leaving sections move up, arriving ones rise from below.
  const y = useTransform(p, (v) => (reduced ? 0 : Math.max(-1, Math.min(1, index - v)) * 72));
  const scale = useTransform(p, (v) => (reduced ? 1 : 1 - Math.min(1, Math.abs(index - v)) * 0.03));
  const visibility = useTransform(p, (v) => (Math.abs(index - v) >= 0.999 ? "hidden" : "visible"));
  const pointerEvents = useTransform(p, (v) => (Math.abs(index - v) < 0.5 ? "auto" : "none"));
  return (
    <motion.div
      className="absolute inset-0"
      style={{ opacity, y, scale, visibility, pointerEvents }}
      aria-hidden={!active}
    >
      <div
        ref={scrollerRef}
        className="home-scroller h-full overflow-y-auto overscroll-contain slim-scroll flex"
        data-top="true"
        data-bottom="true"
        onScroll={(e) => onScroll(e.currentTarget)}
      >
        <div className="my-auto w-full space-y-3 py-2 pr-4">{children}</div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const activeRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollers = useRef<(HTMLDivElement | null)[]>([]);
  // p is the continuous section position: 0 = home, 1 = news, and so on.
  const p = useMotionValue(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const animating = useRef(false);
  const textScrolledAt = useRef(Number.NEGATIVE_INFINITY); // when the active box's text last moved
  const flingRef = useRef(0);
  // Add ?scrolldebug to the address to see what each scroll event did.
  const debugRef = useRef<HTMLPreElement>(null);
  const [debugOn, setDebugOn] = useState(false);
  useEffect(() => setDebugOn(new URLSearchParams(window.location.search).has("scrolldebug")), []);
  const debugLines = useRef<string[]>([]);
  const debugLog = (line: string) => {
    const el = debugRef.current;
    if (!el) return;
    debugLines.current.push(line);
    if (debugLines.current.length > 16) debugLines.current.shift();
    el.textContent = debugLines.current.join("\n");
  };
  const debugLogRef = useRef(debugLog);
  debugLogRef.current = debugLog;
  const reducedRef = useRef(false);
  reducedRef.current = reduced;

  // The portrait shrinks a little as the reader leaves the intro.
  useMotionValueEvent(p, "change", (v) => {
    rootRef.current?.style.setProperty("--shrink", clamp01(v).toFixed(3));
  });

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(rm.matches);
    update();
    rm.addEventListener("change", update);
    return () => rm.removeEventListener("change", update);
  }, []);

  // The page itself never scrolls; only section boxes do.
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prev[0];
      html.style.overscrollBehavior = prev[1];
    };
  }, []);

  /** Mark whether a box has more text above or below, for the edge fades. */
  function markEdges(el: HTMLDivElement) {
    el.dataset.top = el.scrollTop <= 1 ? "true" : "false";
    el.dataset.bottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1 ? "true" : "false";
  }

  function onBoxScroll(el: HTMLDivElement) {
    markEdges(el);
    // Section changes reset the arriving box; only the reader's scrolling counts.
    if (el === scrollers.current[activeRef.current] && !animating.current) textScrolledAt.current = performance.now();
  }

  /** Stop a touch fling; true if one was running. */
  function stopFling() {
    if (!flingRef.current) return false;
    cancelAnimationFrame(flingRef.current);
    flingRef.current = 0;
    return true;
  }

  /** Can the active section's box still scroll in this direction? */
  function boxCanScroll(dir: number) {
    const el = scrollers.current[activeRef.current];
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
    if (dir > 0) return Math.ceil(el.scrollTop + el.clientHeight) < el.scrollHeight - 1;
    return el.scrollTop > 1;
  }

  /** Arriving from above starts a long section at its top, from below at its end. */
  function prepare(target: number, dir: number) {
    const el = scrollers.current[target];
    if (!el) return;
    el.scrollTop = dir > 0 ? 0 : el.scrollHeight;
    markEdges(el);
  }

  function settle(target: number, from = activeRef.current) {
    const clamped = Math.max(0, Math.min(N - 1, target));
    anim.current?.stop();
    // A stopped animation never completes, so clear the flag here. Otherwise
    // a tab tap at the very end of a spring-back would block scrolling.
    animating.current = false;
    stopFling();
    if (clamped !== from) {
      prepare(clamped, Math.sign(clamped - from));
      textScrolledAt.current = Number.NEGATIVE_INFINITY;
    }
    if (clamped !== activeRef.current) {
      activeRef.current = clamped;
      setActive(clamped);
      window.history.replaceState(null, "", clamped === 0 ? window.location.pathname : `#${SECTIONS[clamped]}`);
    }
    const distance = Math.abs(p.get() - clamped);
    if (distance < 0.001) {
      p.set(clamped);
      return;
    }
    animating.current = true;
    anim.current = animate(p, clamped, {
      duration: reducedRef.current ? 0 : Math.min(0.85, 0.32 + distance * 0.14),
      ease: EASE,
      onComplete: () => {
        animating.current = false;
      },
    });
  }
  const settleRef = useRef(settle);
  settleRef.current = settle;

  /** Drag position for an offset in sections, with resistance past the ends. */
  function dragTo(offset: number) {
    const base = activeRef.current;
    let v = base + Math.max(-1, Math.min(1, offset));
    if (v < 0) v = -Math.min(0.12, -v * 0.25);
    if (v > N - 1) v = N - 1 + Math.min(0.12, (v - (N - 1)) * 0.25);
    p.set(v);
  }

  // --- Wheel and trackpad (rules in lib/home-wheel.ts) --------------------
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctl = new WheelController();
    let idle: ReturnType<typeof setTimeout> | null = null;

    const release = () => {
      idle = null;
      const to = ctl.release();
      if (to !== null && !animating.current) settleRef.current(activeRef.current + to);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch zoom
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (Math.abs(dy) < 0.5) return;
      const dir = Math.sign(dy);
      const box = scrollers.current[activeRef.current];
      // When the input happened, not when the page got to it: a busy page
      // can hold events back and then handle them in a burst.
      const handled = performance.now();
      const happened = e.timeStamp > 0 && e.timeStamp <= handled + 50 ? e.timeStamp : handled;
      const input = {
        dy,
        now: happened,
        canScroll: boxCanScroll(dir),
        overBox: !!box && e.target instanceof Node && box.contains(e.target),
        textMovedAt: textScrolledAt.current,
        animating: animating.current,
      };
      const act = ctl.handle(input);
      debugLogRef.current(
        `wheel ${e.deltaY.toFixed(1)}${e.deltaMode ? ` m${e.deltaMode}` : ""} sec ${activeRef.current} ` +
          `text ${input.canScroll ? "can" : "end"} ${Math.min(9999, Math.round(input.now - input.textMovedAt))}ms ` +
          `${input.overBox ? "box" : "out"}${input.animating ? " anim" : ""}${e.cancelable ? "" : " NOT-cancelable"} -> ${act.kind}` +
          (act.kind === "drag" ? ` ${act.offset.toFixed(2)}` : act.kind === "go" ? ` ${act.dir}` : ""),
      );
      if (act.kind === "native") return;
      e.preventDefault();
      if (act.kind === "scrollBox") {
        // Over the portrait or the tabs, scroll the text box directly.
        if (box) box.scrollTop += act.by;
      } else if (act.kind === "go") {
        if (idle) clearTimeout(idle);
        idle = null;
        settleRef.current(activeRef.current + act.dir);
      } else if (act.kind === "drag") {
        if (act.first) prepare(activeRef.current + dir, dir);
        dragTo(act.offset);
        if (idle) clearTimeout(idle);
        idle = setTimeout(release, WHEEL.release);
      }
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      root.removeEventListener("wheel", onWheel);
      if (idle) clearTimeout(idle);
    };
  }, []);

  // --- Touch (rules in lib/home-touch.ts) -----------------------------------
  // The text boxes are scrolled here rather than by the browser, so one slow
  // finger can scroll the text to its end and carry on into the next section.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let mode: "idle" | "pending" | "text" | "section" = "idle";
    let startY = 0;
    let lastY = 0;
    let startedInBox = false;
    let caught = false; // this touch stopped a text fling
    let drag: TextDrag = { textPos: 0, max: 0, past: 0 }; // a text swipe
    let past = 0; // finger pixels of a section swipe
    let samples: { y: number; t: number }[] = [];
    const distance = () => window.innerHeight * TOUCH.distance;
    const speed = () => fingerSpeed(samples, performance.now());

    /** Coast after a swipe. A fling stops at the end of the text and never changes the section. */
    const fling = (v: number) => {
      const box = scrollers.current[activeRef.current];
      if (!box || Math.abs(v) < 0.08) return;
      const max = box.scrollHeight - box.clientHeight;
      let pos = box.scrollTop;
      let last = performance.now();
      const step = (t: number) => {
        const dt = Math.min(48, Math.max(0, t - last));
        last = t;
        const f = flingStep(pos, v, dt, max);
        pos = f.pos;
        v = f.v;
        box.scrollTop = pos;
        flingRef.current = f.done ? 0 : requestAnimationFrame(step);
      };
      flingRef.current = requestAnimationFrame(step);
    };

    const moveText = (d: number) => {
      const box = scrollers.current[activeRef.current];
      if (!box) return;
      const hadPast = drag.past !== 0;
      drag.max = box.scrollHeight - box.clientHeight;
      const r = splitMove(drag, d, Math.abs(speed()) < TOUCH.slow);
      drag = { textPos: r.textPos, max: r.max, past: r.past };
      box.scrollTop = drag.textPos;
      // A fast finger pushing at the end keeps the stop going (touch only:
      // each flick is a separate motion; a slow drag, a swipe on the portrait
      // or a short pause still move on).
      if (r.stopped) textScrolledAt.current = performance.now();
      if (r.handoff) prepare(activeRef.current + Math.sign(r.past), Math.sign(r.past));
      if (drag.past !== 0 || hadPast) dragTo(drag.past / distance());
    };

    const onStart = (e: TouchEvent) => {
      caught = stopFling();
      // A touch during a section change is ignored; the change finishes first.
      if (e.touches.length !== 1 || animating.current) {
        mode = "idle";
        return;
      }
      startY = lastY = e.touches[0].clientY;
      samples = [{ y: startY, t: performance.now() }];
      const box = scrollers.current[activeRef.current];
      startedInBox = !!box && e.target instanceof Node && box.contains(e.target);
      past = 0;
      drag = { textPos: 0, max: 0, past: 0 };
      mode = "pending";
    };
    const onMove = (e: TouchEvent) => {
      if (mode === "idle") return;
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const now = performance.now();
      samples.push({ y, t: now });
      if (samples.length > 12) samples.shift();
      if (mode === "pending") {
        const total = startY - y; // > 0 is a swipe up, toward the next section
        if (Math.abs(total) < TOUCH.start) return;
        const dir = Math.sign(total);
        const box = scrollers.current[activeRef.current];
        mode = chooseTouchMode({
          startedInBox,
          long: !!box && box.scrollHeight > box.clientHeight + 1,
          canScroll: boxCanScroll(dir),
          justScrolled: caught || now - textScrolledAt.current < TOUCH.land,
        });
        if (mode === "text" && box) drag = { textPos: box.scrollTop, max: box.scrollHeight - box.clientHeight, past: 0 };
        else prepare(activeRef.current + dir, dir);
        lastY = startY; // apply the full movement so far
      }
      e.preventDefault();
      const d = lastY - y;
      lastY = y;
      if (mode === "text") {
        moveText(d);
        return;
      }
      past += d;
      dragTo(past / distance());
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) return;
      const v = speed();
      const was = mode;
      mode = "idle";
      debugLogRef.current(`touch ${was} v ${v.toFixed(2)} past ${Math.round(drag.past || past)} sec ${activeRef.current}`);
      if (was === "section" || (was === "text" && drag.past !== 0)) {
        const base = activeRef.current;
        settleRef.current(base + releaseTarget(p.get() - base, v));
      } else if (was === "text") {
        fling(v);
      }
      past = 0;
      drag.past = 0;
    };
    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
      stopFling();
    };
  }, [p]);

  // --- Keyboard -------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const el = scrollers.current[activeRef.current];
      const step = (dir: number, amount: number) => {
        e.preventDefault();
        if (el && boxCanScroll(dir)) el.scrollBy({ top: dir * amount, behavior: reducedRef.current ? "auto" : "smooth" });
        else settleRef.current(activeRef.current + dir);
      };
      if (e.key === "ArrowDown") step(1, 80);
      else if (e.key === "ArrowUp") step(-1, 80);
      else if (e.key === "PageDown" || (e.key === " " && !e.shiftKey)) step(1, (el?.clientHeight ?? 400) * 0.85);
      else if (e.key === "PageUp" || (e.key === " " && e.shiftKey)) step(-1, (el?.clientHeight ?? 400) * 0.85);
      else if (e.key === "Home") {
        e.preventDefault();
        settleRef.current(0);
      } else if (e.key === "End") {
        e.preventDefault();
        settleRef.current(N - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Deep links such as /#news, on load and when the hash changes.
  useEffect(() => {
    const idx = (SECTIONS as readonly string[]).indexOf(window.location.hash.slice(1));
    if (idx > 0) {
      activeRef.current = idx;
      setActive(idx);
      p.set(idx);
    }
    const onHash = () => {
      const i = (SECTIONS as readonly string[]).indexOf(window.location.hash.slice(1));
      if (i >= 0) settleRef.current(i);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [p]);

  // Keep the edge fades right when boxes resize (fonts, images, rotation).
  useEffect(() => {
    const ro = new ResizeObserver(() => scrollers.current.forEach((el) => el && markEdges(el)));
    scrollers.current.forEach((el) => {
      if (!el) return;
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
    });
    return () => ro.disconnect();
  }, []);

  const goTo = (i: number) => settleRef.current(i);

  // --- Nav tabs with sliding pill ------------------------------------------
  const navTabs = (
    <div role="tablist" aria-label="Section navigation" className="flex items-center gap-0.5 sm:gap-1.5">
      {SECTIONS.map((label, idx) => {
        const isActive = active === idx;
        return (
          <button
            key={label}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              goTo(idx);
            }}
            className="relative whitespace-nowrap px-1.5 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-sm active:opacity-90"
            style={{ touchAction: "manipulation" }}
          >
            {isActive && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-black"
                transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0.18, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-10 transition-colors duration-200", isActive ? "text-white" : "text-black/70 hover:text-black")}>
              {SECTION_LABELS[label]}
            </span>
          </button>
        );
      })}
    </div>
  );

  const progressDots = (
    <div className="fixed right-2 sm:right-5 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5">
      {SECTIONS.map((label, i) => (
        <button
          key={label}
          aria-label={`Go to ${SECTION_LABELS[label]}`}
          onClick={() => goTo(i)}
          className="group p-1"
          style={{ touchAction: "manipulation" }}
        >
          <motion.span
            className={cn("block w-1.5 rounded-full", i === active ? "bg-black" : "bg-black/20 group-hover:bg-black/50")}
            animate={{ height: i === active ? 22 : 6 }}
            transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.5 }}
          />
        </button>
      ))}
    </div>
  );

  // --- Content blocks (original voice) --------------------------------------
  const iconSize = "h-6 w-6 lg:h-7 lg:w-7";
  const socialLinks = (
    <div className="flex flex-nowrap items-start justify-between gap-1 pt-2 lg:justify-start lg:gap-6">
      <a href="https://github.com/arash-san" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconSize}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/></svg>
        <span className="text-xs">GitHub</span>
      </a>
      <a href="https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
        <Image src="/google-scholar--v2.png" alt="Google Scholar" width={28} height={28} className={iconSize} />
        <span className="text-xs">Scholar</span>
      </a>
      <a href="https://www.linkedin.com/in/arash-ahmadi-619ab1352" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconSize}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
        <span className="text-xs">LinkedIn</span>
      </a>
      <a href="https://x.com/user_arash" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
        <span aria-hidden="true" className={cn(iconSize, "flex items-center justify-center rounded-[5px] bg-black")}>
          <Image src="/x-logo-white.svg" alt="" width={24} height={24} className="h-[58%] w-[58%]" />
        </span>
        <span className="text-xs">X</span>
      </a>
      <a href="mailto:arash.ahmadi@ou.edu" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconSize}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        <span className="text-xs">Email</span>
      </a>
      <a href="/arash-ahmadi-cv.pdf" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconSize}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span className="text-xs">CV</span>
      </a>
    </div>
  );

  const scrollHint = (
    <button type="button" onClick={() => goTo(1)} className="font-bold flex items-center gap-2 pt-1">
      Scroll to see more!
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="hint-bounce"
      >
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
    </button>
  );

  const homeBody = (
    <>
      <p>Welcome to my personal website!</p>
      <p>
        <span className="hidden lg:inline">My name is Arash Ahmadi. </span>I&apos;m currently a PhD student at the{" "}
        <a href="https://www.ou.edu/" className="text-[#DC143C] underline">University Of Oklahoma</a>{" "}
        working at <a href="https://inquirelab.ai/" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">InquireLab</a> in electrical and computer engineering. In my studies, I&apos;m focusing on the utilization of Large Language Models (LLMs) in different domains, and also working on the interpretability side of them.
      </p>
      {socialLinks}
      {scrollHint}
    </>
  );

  const newsBody = (
    <div className="space-y-3">
      {news.map((item) => (
        <a
          key={item.title}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block group border-l-2 border-gray-200 hover:border-[#DC143C] pl-3 transition-colors"
        >
          <p className="text-xs text-gray-500">
            {item.dateLabel} · <span className="text-red-700">{item.tag}</span>
          </p>
          <p className="font-semibold text-gray-800 group-hover:text-[#DC143C] transition-colors text-sm lg:text-base leading-snug">
            {item.title}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed lg:hidden">{item.body}</p>
        </a>
      ))}
      <p className="text-xs text-gray-500">
        More on the{" "}
        <a href="https://inquirelab.ai/news" target="_blank" rel="noopener noreferrer" className="text-[#DC143C] underline">
          InquireLab news page
        </a>
        .
      </p>
    </div>
  );

  const academicBody = (
    <>
      <p>
        I completed my bachelors at The University Of Kurdistan with a GPA of 3.89/4. For my final project, I
        <a href="https://doi.org/10.1007/s11227-023-05565-w" className="text-[#DC143C] underline mx-1" target="_blank" rel="noopener noreferrer">published a paper</a>
        {" "}about designing an efficient algorithm for solving the Yin-Yang puzzle.
      </p>
      <p>
        Then I got accepted to a direct PhD position at OU! Since then I&apos;ve defended my{" "}
        <a href="https://inquirelab.ai/news" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">master&apos;s thesis</a>
        {" "}(April 2026) and published 7 papers and preprints, including a journal paper in{" "}
        <a href="https://doi.org/10.1016/j.eswa.2026.132963" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">Expert Systems with Applications</a>
        {" "}and a paper I presented at{" "}
        <a href="https://doi.org/10.2514/6.2026-1195" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">AIAA SciTech 2026</a>
        {" "}in Orlando. You can see all of them on my{" "}
        <a href="https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">google scholar</a>.
      </p>
      <p>
        I also founded the{" "}
        <a href="https://inquirelab.ai/llm-club" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">LLM Engineering Club</a>
        {" "}at OU, a registered student org for hands-on LLM engineering.
      </p>
    </>
  );

  const tools = [
    {
      name: "Yin Yang Puzzle Explorer",
      href: "/tools/yin-yang/",
      tag: "web app · research",
      desc: "The original puzzle viewer plus a new exact solution explorer with live calculations, symmetry controls, and the search rules from my paper.",
    },
    {
      name: "Scenic Routes",
      href: "/scenic/",
      tag: "web app · live",
      desc: "Finds the most beautiful driving route instead of the fastest one, scored by parks, water, landmarks and quiet streets from OpenStreetMap data. Runs fully in your browser.",
    },
    {
      name: "MCP Bridge",
      href: "https://github.com/INQUIRELAB/mcp-bridge-api",
      tag: "open source · research",
      desc: "A lightweight, LLM-agnostic RESTful proxy for Model Context Protocol servers.",
    },
    {
      name: "Freesia",
      href: "https://github.com/Arash-san/freesia",
      tag: "open source",
      desc: "AI voice dictation for Windows. Speak freely, write beautifully.",
    },
    {
      name: "KairoMirror",
      href: "https://github.com/Arash-san/kairomirror",
      tag: "open source",
      desc: "A polished Windows GUI for scrcpy, with app launching, mirroring, audio, and virtual camera support.",
    },
    {
      name: "Maze Creator for Overwatch",
      href: "https://github.com/Arash-san/Maze-creator-for-overwatch",
      tag: "open source",
      desc: "Build your own mazes and play them inside Overwatch.",
    },
  ];

  const toolsBody = (
    <div className="space-y-3">
      <p className="text-xs lg:text-sm">Things I build outside of research, free for anyone to use.</p>
      {tools.map((item) => (
        <a
          key={item.name}
          href={item.href}
          target={item.href.startsWith("http") ? "_blank" : undefined}
          rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="block group border-l-2 border-gray-200 hover:border-[#DC143C] pl-3 transition-colors"
        >
          <p className="text-xs text-gray-500">
            <span className="text-red-700">{item.tag}</span>
          </p>
          <p className="font-semibold text-gray-800 group-hover:text-[#DC143C] transition-colors text-sm lg:text-base">
            {item.name}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
        </a>
      ))}
    </div>
  );

  const interestsBody = (
    <>
      <div className="float-right w-24 sm:w-28 ml-3 mb-1">
        <motion.div
          whileHover={reduced ? undefined : { rotate: 0, scale: 1.06 }}
          initial={false}
          style={{ rotate: -3 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
        >
          <Image
            src="/childhood-sticker.webp"
            alt="Sticker of Arash as a child in Sanandaj, wearing a Spider-Man t-shirt"
            width={112}
            height={112}
          />
        </motion.div>
        <p className="text-[10px] text-gray-500 text-center mt-1">Sanandaj, early 2000s</p>
      </div>
      <p>I&apos;m really interested in trying new things. I enjoy spending time with my family and friends, and I want to become a better person every day :)</p>
      <p>I also like watching movies, playing video games, writing an interactive story, walking at nights, the list goes on and on...</p>
      <p>My goal is to have a good impact to the scientific community and make this world a better and happy place</p>
      <p className="font-bold">I will gradually update my personal website to introduce my projects and talk more about myself, but for now, thank you for your time to read what I wrote ❤️</p>
    </>
  );

  const titleClass = "text-2xl lg:text-5xl xl:text-6xl font-bold";
  const titles = [
    <h1 key="t0" className={titleClass}>
      <span className="text-gray-600">Hi! I&apos;m </span>
      <span className="text-black">Arash</span>
      <span className="text-gray-600"> :)</span>
    </h1>,
    <h2 key="t1" className={cn(titleClass, "text-black")}>Recent News</h2>,
    <h2 key="t2" className={cn(titleClass, "text-black")}>Academic Background</h2>,
    <h2 key="t3" className={cn(titleClass, "text-black")}>My Custom Tools</h2>,
    <h2 key="t4" className={cn(titleClass, "text-black")}>Blog posts</h2>,
    <h2 key="t5" className={cn(titleClass, "text-black")}>My Interests</h2>,
  ];
  const bodies = [homeBody, newsBody, academicBody, toolsBody, <HomeBlogPreview key="blog" />, interestsBody];

  return (
    <div ref={rootRef} className="home-root fixed inset-0 z-0 overflow-hidden bg-white">
      {debugOn && (
        <pre
          ref={debugRef}
          className="pointer-events-none fixed bottom-2 left-2 z-50 max-w-[95vw] whitespace-pre rounded bg-black/80 p-2 font-mono text-[10px] leading-snug text-white"
        />
      )}
      <DotPattern
        width={20}
        height={20}
        cx={1}
        cy={1}
        cr={1}
        className="[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]"
      />
      {progressDots}

      <div className="home-stage">
        {/* The portrait is always pinned on top and never scrolls away. */}
        <motion.div
          className="home-portrait-col"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {navTabs}
          <div className="home-portrait">
            <Image
              src="/portrait.jpg"
              alt="Arash Ahmadi - PhD Student in Electrical and Computer Engineering at University of Oklahoma"
              fill
              sizes="(min-width: 1024px) 320px, 360px"
              className="object-cover"
              priority
            />
          </div>
        </motion.div>

        <div className="home-viewport">
          {SECTIONS.map((label, i) => (
            <HomeSection
              key={label}
              index={i}
              p={p}
              active={i === active}
              reduced={reduced}
              scrollerRef={(el) => {
                scrollers.current[i] = el;
              }}
              onScroll={onBoxScroll}
            >
              {titles[i]}
              <div className="space-y-2 text-sm lg:text-lg text-gray-700 leading-relaxed">{bodies[i]}</div>
            </HomeSection>
          ))}
        </div>
      </div>
    </div>
  );
}
