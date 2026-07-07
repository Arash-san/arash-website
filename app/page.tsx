"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DotPattern } from "@/components/ui/dot-pattern";
import Image from "next/image";
import { news } from "@/lib/profile-data";

const SECTIONS = ["home", "news", "academic", "tools", "interests"] as const;
const N = SECTIONS.length;
const EASE = [0.22, 1, 0.36, 1] as const;

export default function Home() {
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  const activeRef = useRef(0);
  activeRef.current = active;
  const lastStep = useRef(0);
  const wheelAccum = useRef(0);
  const lastWheel = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const swipeConsumed = useRef(false);
  const dRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mRefs = useRef<(HTMLDivElement | null)[]>([]);

  // The page never scrolls natively: sections step on wheel/swipe/keys and
  // long content scrolls inside each section. This is what makes the scroll
  // deterministic — no half-faded states, no snap fighting the user.
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevOverscroll = html.style.overscrollBehavior;
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prevOverflow;
      html.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(rm.matches);
    update();
    rm.addEventListener("change", update);
    return () => rm.removeEventListener("change", update);
  }, []);

  // Deep links: /#news etc., on load and when the hash changes in-page.
  useEffect(() => {
    const idx = (SECTIONS as readonly string[]).indexOf(window.location.hash.slice(1));
    if (idx > 0) setActive(idx);
    const onHash = () => {
      const i = (SECTIONS as readonly string[]).indexOf(window.location.hash.slice(1));
      if (i >= 0) goToRef.current(i);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(N - 1, index));
    if (clamped === activeRef.current) return;
    const dScroller = dRefs.current[clamped];
    const mScroller = mRefs.current[clamped];
    if (dScroller) dScroller.scrollTop = 0;
    if (mScroller) mScroller.scrollTop = 0;
    lastStep.current = performance.now();
    setActive(clamped);
    window.history.replaceState(null, "", clamped === 0 ? "#" : `#${SECTIONS[clamped]}`);
  }
  const goToRef = useRef(goTo);
  goToRef.current = goTo;

  /** The scroller of the currently visible layout (desktop or mobile). */
  function activeScroller() {
    const i = activeRef.current;
    const candidates = [dRefs.current[i], mRefs.current[i]];
    return candidates.find((el) => el && el.clientHeight > 0) || null;
  }

  function scrollerConsumes(dir: number) {
    const el = activeScroller();
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
    const atTop = el.scrollTop <= 0;
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
    return (dir > 0 && !atBottom) || (dir < 0 && !atTop);
  }

  // Wheel: scroll inside a section natively; at the bounds, one gesture = one
  // section. Accumulate deltas so trackpad momentum can't double-fire.
  const onWheel = (e: React.WheelEvent) => {
    const dir = Math.sign(e.deltaY);
    if (dir === 0 || scrollerConsumes(dir)) return;
    const now = performance.now();
    if (now - lastStep.current < 700) return;
    if (now - lastWheel.current > 200) wheelAccum.current = 0;
    lastWheel.current = now;
    wheelAccum.current += e.deltaY;
    if (Math.abs(wheelAccum.current) > 50) {
      wheelAccum.current = 0;
      goToRef.current(activeRef.current + dir);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    swipeConsumed.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null || swipeConsumed.current) return;
    const dy = touchStartY.current - e.touches[0].clientY; // > 0 = swipe up = next
    const dir = Math.sign(dy);
    if (dir === 0 || scrollerConsumes(dir)) return;
    if (Math.abs(dy) > 56 && performance.now() - lastStep.current > 500) {
      swipeConsumed.current = true;
      goToRef.current(activeRef.current + dir);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToRef.current(activeRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToRef.current(activeRef.current - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goToRef.current(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToRef.current(N - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Animation variants -------------------------------------------------
  const sectionV = {
    active: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? { duration: 0 }
        : { duration: 0.5, ease: EASE, staggerChildren: 0.06, delayChildren: 0.04 },
    },
    above: { opacity: 0, y: -28, transition: reduced ? { duration: 0 } : { duration: 0.32, ease: EASE } },
    below: { opacity: 0, y: 28, transition: reduced ? { duration: 0 } : { duration: 0.32, ease: EASE } },
  };
  const itemV = {
    active: { opacity: 1, y: 0, transition: reduced ? { duration: 0 } : { duration: 0.45, ease: EASE } },
    above: { opacity: 0, y: -12 },
    below: { opacity: 0, y: 12 },
  };
  const stateOf = (i: number) => (i === active ? "active" : i < active ? "above" : "below");

  // --- Nav tabs with sliding pill ------------------------------------------
  function NavTabs({ layout }: { layout: "d" | "m" }) {
    return (
      <div role="tablist" aria-label="Section navigation" className="flex items-center gap-1 sm:gap-2">
        {SECTIONS.map((label, idx) => {
          const isActive = active === idx;
          return (
            <button
              key={label}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              onPointerDown={(e) => {
                e.preventDefault();
                goTo(idx);
              }}
              onClick={(e) => {
                e.preventDefault();
                goTo(idx);
              }}
              className="relative px-2.5 sm:px-3 py-1 rounded-full text-sm active:opacity-90"
              style={{ touchAction: "manipulation" }}
            >
              {isActive && (
                <motion.span
                  layoutId={`tab-pill-${layout}`}
                  className="absolute inset-0 rounded-full bg-black"
                  transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0.18, duration: 0.5 }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 transition-colors duration-200",
                  isActive ? "text-white" : "text-black/70 hover:text-black"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // --- Progress dots --------------------------------------------------------
  function ProgressDots() {
    return (
      <div className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5">
        {SECTIONS.map((label, i) => (
          <button
            key={label}
            aria-label={`Go to ${label}`}
            onClick={() => goTo(i)}
            className="group p-1"
            style={{ touchAction: "manipulation" }}
          >
            <motion.span
              className={cn(
                "block w-1.5 rounded-full",
                i === active ? "bg-black" : "bg-black/20 group-hover:bg-black/50"
              )}
              animate={{ height: i === active ? 22 : 6 }}
              transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.5 }}
            />
          </button>
        ))}
      </div>
    );
  }

  // --- Content blocks (original voice) --------------------------------------
  const socialLinks = (iconSize: string) => (
    <div className="flex items-start justify-start gap-6 pt-2">
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
    <p className="font-bold flex items-center gap-2">
      Scroll to see more!
      <motion.svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        animate={reduced ? undefined : { y: [0, 5, 0] }}
        transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </motion.svg>
    </p>
  );

  const homeBody = (compact: boolean) => (
    <>
      <p>Welcome to my personal website!</p>
      <p>
        {compact ? "I'm" : "My name is Arash Ahmadi. I'm"} currently a PhD student at the{" "}
        <a href="https://www.ou.edu/" className="text-[#DC143C] underline">University Of Oklahoma</a>{" "}
        working at <a href="https://inquirelab.ai/" className="text-red-700 underline" target="_blank" rel="noopener noreferrer">InquireLab</a> in electrical and computer engineering. In my studies, I&apos;m focusing on the utilization of Large Language Models (LLMs) in different domains, and also working on the interpretability side of them.
      </p>
      {socialLinks(compact ? "h-6 w-6" : "h-7 w-7")}
      {scrollHint}
    </>
  );

  const newsBody = (compact: boolean) => (
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
          <p className={cn("font-semibold text-gray-800 group-hover:text-[#DC143C] transition-colors", compact ? "text-sm" : "text-base")}>
            {item.title}
          </p>
          {compact && <p className="text-xs text-gray-600 mt-0.5">{item.body}</p>}
        </a>
      ))}
      <p className="text-xs text-gray-500">
        More on the{" "}
        <a href="https://inquirelab.ai/news" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
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
        <a href="https://doi.org/10.1007/s11227-023-05565-w" className="text-green-700 underline mx-1" target="_blank" rel="noopener noreferrer">published a paper</a>
        {" "}about designing an efficient algorithm for solving the Yin-Yang puzzle.
      </p>
      <p>
        Then I got accepted to a direct PhD position at OU! Since then I&apos;ve defended my{" "}
        <a href="https://inquirelab.ai/news" className="text-purple-700 underline" target="_blank" rel="noopener noreferrer">master&apos;s thesis</a>
        {" "}(April 2026) and published 7 papers and preprints — including a journal paper in{" "}
        <a href="https://doi.org/10.1016/j.eswa.2026.132963" className="text-red-700 underline" target="_blank" rel="noopener noreferrer">Expert Systems with Applications</a>
        {" "}and a paper I presented at{" "}
        <a href="https://doi.org/10.2514/6.2026-1195" className="text-blue-700 underline" target="_blank" rel="noopener noreferrer">AIAA SciTech 2026</a>
        {" "}in Orlando. You can see all of them on my{" "}
        <a href="https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" className="text-blue-700 underline" target="_blank" rel="noopener noreferrer">google scholar</a>.
      </p>
      <p>
        I also founded the{" "}
        <a href="https://ou.campuslabs.com/engage/organization/llm-club" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">LLM Engineering Club</a>
        {" "}at OU — a registered student org for hands-on LLM engineering.
      </p>
    </>
  );

  const tools = [
    {
      name: "Scenic Routes",
      href: "/scenic/",
      tag: "web app · live",
      desc: "Finds the most beautiful driving route instead of the fastest one — greenery, water, landmarks and quiet streets, scored from OpenStreetMap data. Runs fully in your browser.",
    },
    {
      name: "Dictaloom",
      href: "https://github.com/Arash-san/dictaloom",
      tag: "open source",
      desc: "AI voice dictation for Windows.",
    },
    {
      name: "KairoMirror",
      href: "https://github.com/Arash-san/kairomirror",
      tag: "open source",
      desc: "A polished Windows GUI for scrcpy — app launching, mirroring, audio, and virtual camera support.",
    },
    {
      name: "OpenTree",
      href: "https://github.com/Arash-san/opentree",
      tag: "open source",
      desc: "Desktop tool for analyzing folders.",
    },
  ];

  const toolsBody = (compact: boolean) => (
    <div className="space-y-3">
      <p className={compact ? "text-xs" : "text-sm"}>
        Things I build outside of research — small tools I actually use, free for anyone.
      </p>
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
          <p className={cn("font-semibold text-gray-800 group-hover:text-[#DC143C] transition-colors", compact ? "text-sm" : "text-base")}>
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

  const titles = {
    d: [
      <h1 key="t0" className="text-5xl xl:text-6xl font-bold">
        <span className="text-gray-600">Hi! I&apos;m </span>
        <span className="text-black">Arash</span>
        <span className="text-gray-600"> :)</span>
      </h1>,
      <h1 key="t1" className="text-5xl xl:text-6xl font-bold text-black">Recent News</h1>,
      <h1 key="t2" className="text-5xl xl:text-6xl font-bold text-black">Academic Background</h1>,
      <h1 key="t3" className="text-5xl xl:text-6xl font-bold text-black">My Custom Tools</h1>,
      <h1 key="t4" className="text-5xl xl:text-6xl font-bold text-black">My Interests</h1>,
    ],
    m: [
      <h1 key="t0" className="text-2xl font-bold">
        <span className="text-gray-600">Hi! I&apos;m </span>
        <span className="text-black">Arash</span>
        <span className="text-gray-600"> :)</span>
      </h1>,
      <h1 key="t1" className="text-2xl font-bold text-black">Recent News</h1>,
      <h1 key="t2" className="text-2xl font-bold text-black">Academic Background</h1>,
      <h1 key="t3" className="text-2xl font-bold text-black">My Custom Tools</h1>,
      <h1 key="t4" className="text-2xl font-bold text-black">My Interests</h1>,
    ],
  };
  const bodies = {
    d: [homeBody(false), newsBody(false), academicBody, toolsBody(false), interestsBody],
    m: [homeBody(true), newsBody(true), academicBody, toolsBody(true), interestsBody],
  };

  return (
    <div className="bg-white">
      <div
        className="fixed inset-0 z-0 overflow-hidden"
        style={{ "--ph": "min(360px, 44dvh)" } as CSSProperties}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        <DotPattern
          width={20}
          height={20}
          cx={1}
          cy={1}
          cr={1}
          className={cn(
            "pointer-events-none [mask-image:radial-gradient(800px_circle_at_center,white,transparent)]"
          )}
        />

        <ProgressDots />

        {/* --- Desktop layout --- */}
        <div className="absolute inset-0 hidden lg:flex items-center justify-center">
          <motion.div
            className="flex flex-col items-center justify-start"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="mb-3">
              <NavTabs layout="d" />
            </div>
            <motion.div
              className="relative w-80 h-[420px] rounded-xl overflow-hidden flex-shrink-0 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.3)]"
              whileHover={reduced ? undefined : { scale: 1.015 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
            >
              <Image
                src="/portrait.jpg"
                alt="Arash Ahmadi - PhD Student in Electrical and Computer Engineering at University of Oklahoma"
                fill
                className="object-cover"
                priority
              />
            </motion.div>
          </motion.div>
          <div className="relative w-[500px] ml-10 h-[30rem]">
            {SECTIONS.map((label, i) => (
              <motion.div
                key={label}
                variants={sectionV}
                initial={false}
                animate={stateOf(i)}
                className="absolute inset-0"
                style={{ pointerEvents: i === active ? "auto" : "none" }}
                aria-hidden={i !== active}
              >
                <div
                  ref={(el) => {
                    dRefs.current[i] = el;
                  }}
                  className="h-full overflow-y-auto no-scrollbar flex"
                  style={{ overscrollBehavior: "contain" }}
                >
                  <div className="my-auto w-full space-y-3 py-2">
                    <motion.div variants={itemV}>{titles.d[i]}</motion.div>
                    <motion.div variants={itemV} className="space-y-2 max-w-lg text-lg text-gray-700 leading-relaxed">
                      {bodies.d[i]}
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* --- Mobile layout --- */}
        <div className="lg:hidden">
          <motion.div
            className="absolute top-4 inset-x-0 z-10 flex flex-col items-center gap-2"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <NavTabs layout="m" />
            <div
              className="relative rounded-xl overflow-hidden shadow-[0_14px_34px_-16px_rgba(0,0,0,0.3)]"
              style={{ height: "var(--ph)", width: "calc(var(--ph) * 0.8)" }}
            >
              <Image
                src="/portrait.jpg"
                alt="Arash Ahmadi - PhD Student in Electrical and Computer Engineering at University of Oklahoma"
                fill
                className="object-cover"
                priority
              />
            </div>
          </motion.div>
          <div className="absolute inset-x-0 px-6" style={{ top: "calc(var(--ph) + 84px)" }}>
            <div className="relative max-w-sm mx-auto" style={{ height: "calc(100dvh - var(--ph) - 100px)" }}>
              {SECTIONS.map((label, i) => (
                <motion.div
                  key={label}
                  variants={sectionV}
                  initial={false}
                  animate={stateOf(i)}
                  className="absolute inset-0"
                  style={{ pointerEvents: i === active ? "auto" : "none" }}
                  aria-hidden={i !== active}
                >
                  <div
                    ref={(el) => {
                      mRefs.current[i] = el;
                    }}
                    className="h-full overflow-y-auto no-scrollbar text-left pr-2 space-y-3"
                    style={{
                      overscrollBehavior: "contain",
                      touchAction: "pan-y",
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    <motion.div variants={itemV}>{titles.m[i]}</motion.div>
                    <motion.div variants={itemV} className="space-y-2 text-sm text-gray-700 leading-relaxed pb-4">
                      {bodies.m[i]}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
