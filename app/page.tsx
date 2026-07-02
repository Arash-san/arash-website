"use client";

import { cn } from "@/lib/utils";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  animate,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DotPattern } from "@/components/ui/dot-pattern";
import Image from "next/image";
import { news } from "@/lib/profile-data";

const SECTION_LABELS = ["Home", "News", "Academic", "Interests"];
const N = SECTION_LABELS.length;

/** Scroll-linked fade with a stable plateau: fully visible for most of a
 *  section's range, crossfading only near the boundaries. */
function useSectionMotion(progress: MotionValue<number>, i: number) {
  const c = i / (N - 1);
  const w = 1 / (N - 1);
  // Keyframe offsets must stay within [0, 1] and be strictly increasing —
  // framer-motion drives scroll-linked values through WAAPI ScrollTimeline.
  const first = i === 0;
  const last = i === N - 1;
  const opacityIn: number[] = first
    ? [c + 0.28 * w, c + 0.5 * w]
    : last
      ? [c - 0.5 * w, c - 0.28 * w]
      : [c - 0.5 * w, c - 0.28 * w, c + 0.28 * w, c + 0.5 * w];
  const opacityOut: number[] = first ? [1, 0] : last ? [0, 1] : [0, 1, 1, 0];
  const opacity = useTransform(progress, opacityIn, opacityOut);
  const yIn: number[] = first ? [c, c + 0.5 * w] : last ? [c - 0.5 * w, c] : [c - 0.5 * w, c, c + 0.5 * w];
  const yOut: number[] = first ? [0, -40] : last ? [40, 0] : [40, 0, -40];
  const y = useTransform(progress, yIn, yOut);
  const pointerEvents = useTransform(opacity, (v) => (v > 0.5 ? "auto" : "none"));
  return { opacity, y, pointerEvents };
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const activeRef = useRef(0);
  activeRef.current = activeIndex;
  const isMobileRef = useRef(false);
  isMobileRef.current = isMobile;
  const reducedMotion = useRef(false);
  const isTransitioning = useRef(false);
  const snapTimer = useRef<number | null>(null);
  const lastStep = useRef(0);
  const scrollerRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track viewport + motion preferences reactively (handles rotation/resize).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMq = () => setIsMobile(mq.matches);
    const updateRm = () => (reducedMotion.current = rm.matches);
    updateMq();
    updateRm();
    mq.addEventListener("change", updateMq);
    rm.addEventListener("change", updateRm);
    return () => {
      mq.removeEventListener("change", updateMq);
      rm.removeEventListener("change", updateRm);
    };
  }, []);

  // On mobile the page itself never scrolls: sections swipe, content inside
  // each section scrolls natively. This avoids the half-faded in-between
  // states that window-scroll crossfades produce on touch devices.
  useEffect(() => {
    if (!isMobile) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [isMobile]);

  function animateScrollTo(target: number, duration = 0.55) {
    isTransitioning.current = true;
    if (reducedMotion.current) {
      window.scrollTo(0, target);
      isTransitioning.current = false;
      return;
    }
    animate(window.scrollY, target, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => window.scrollTo(0, v),
      onComplete: () => setTimeout(() => (isTransitioning.current = false), 60),
    });
  }

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(N - 1, index));
    const scroller = scrollerRefs.current[clamped];
    if (scroller) scroller.scrollTop = 0;
    if (isMobileRef.current) {
      if (clamped !== activeRef.current && !isTransitioning.current) {
        isTransitioning.current = true;
        setActiveIndex(clamped);
        window.setTimeout(() => (isTransitioning.current = false), reducedMotion.current ? 0 : 420);
      }
    } else {
      setActiveIndex(clamped);
      animateScrollTo(clamped * window.innerHeight);
    }
  }
  const goToRef = useRef(goTo);
  goToRef.current = goTo;

  // Desktop: keep the scrubbable scroll, but settle on the nearest section
  // once scrolling pauses so the page never rests half-faded.
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (isMobileRef.current) return;
    const idx = Math.max(0, Math.min(N - 1, Math.round(p * (N - 1))));
    setActiveIndex((cur) => (cur === idx ? cur : idx));
    if (snapTimer.current) window.clearTimeout(snapTimer.current);
    if (isTransitioning.current) return;
    snapTimer.current = window.setTimeout(() => {
      if (isTransitioning.current) return;
      const h = window.innerHeight;
      const target = Math.max(0, Math.min(N - 1, Math.round(window.scrollY / h))) * h;
      if (Math.abs(window.scrollY - target) > 2) animateScrollTo(target, 0.35);
    }, 160);
  });

  // Keyboard navigation.
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

  // --- Mobile gestures: native inner scrolling, swipe at bounds to switch ---
  const touchY = useRef<number | null>(null);
  const swipeConsumed = useRef(false);

  function scrollerState() {
    const el = scrollerRefs.current[activeRef.current];
    if (!el || el.scrollHeight <= el.clientHeight + 1) {
      return { scrollable: false, atTop: true, atBottom: true };
    }
    return {
      scrollable: true,
      atTop: el.scrollTop <= 0,
      atBottom: Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight,
    };
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobileRef.current) return;
    touchY.current = e.touches[0].clientY;
    swipeConsumed.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMobileRef.current || touchY.current == null || swipeConsumed.current) return;
    const dy = touchY.current - e.touches[0].clientY; // > 0 = swipe up = next
    const { scrollable, atTop, atBottom } = scrollerState();
    if (scrollable && ((dy > 0 && !atBottom) || (dy < 0 && !atTop))) return; // let native scroll run
    if (Math.abs(dy) > 56 && !isTransitioning.current) {
      swipeConsumed.current = true;
      goToRef.current(activeRef.current + (dy > 0 ? 1 : -1));
    }
  };

  const onWheelMobile = (e: React.WheelEvent) => {
    if (!isMobileRef.current) return;
    const dir = Math.sign(e.deltaY);
    if (dir === 0) return;
    const { scrollable, atTop, atBottom } = scrollerState();
    if (scrollable && ((dir > 0 && !atBottom) || (dir < 0 && !atTop))) return; // native scroll
    const now = Date.now();
    if (!isTransitioning.current && now - lastStep.current > 450) {
      lastStep.current = now;
      goToRef.current(activeRef.current + dir);
    }
  };

  // Desktop scroll-linked motion (fixed call count — N is constant).
  const s0 = useSectionMotion(scrollYProgress, 0);
  const s1 = useSectionMotion(scrollYProgress, 1);
  const s2 = useSectionMotion(scrollYProgress, 2);
  const s3 = useSectionMotion(scrollYProgress, 3);
  const desktopMotion = [s0, s1, s2, s3];

  // --- Nav tabs ---
  function NavTabs() {
    return (
      <div role="tablist" aria-label="Section navigation" className="flex items-center gap-1 sm:gap-2">
        {SECTION_LABELS.map((label, idx) => {
          const isActive = activeIndex === idx;
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
              className={cn(
                "px-2.5 sm:px-3 py-1 rounded-full text-sm transition-colors active:opacity-90",
                isActive ? "bg-black text-white" : "bg-transparent text-black/80 hover:text-black"
              )}
              style={{ touchAction: "manipulation" }}
            >
              {label.toLowerCase()}
            </button>
          );
        })}
      </div>
    );
  }

  // --- Shared content blocks ---
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

  const homeBody = (compact: boolean) => (
    <>
      <p>Welcome to my personal website!</p>
      <p>
        {compact ? "I'm" : "My name is Arash Ahmadi. I'm"} currently a PhD student at the{" "}
        <a href="https://www.ou.edu/" className="text-[#DC143C] underline">University Of Oklahoma</a>{" "}
        working at <a href="https://inquirelab.ai/" className="text-red-700 underline" target="_blank" rel="noopener noreferrer">InquireLab</a> in electrical and computer engineering. In my studies, I&apos;m focusing on the utilization of Large Language Models (LLMs) in different domains, and also working on the interpretability side of them.
      </p>
      {socialLinks(compact ? "h-6 w-6" : "h-7 w-7")}
      <p className="font-bold">Scroll to see more!</p>
    </>
  );

  const newsBody = (compact: boolean) => (
    <div className={cn("space-y-3", compact ? "" : "pr-1")}>
      {news.map((item) => (
        <a
          key={item.title}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
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

  const interestsBody = (
    <>
      <div className="float-right w-24 sm:w-28 ml-3 mb-1 -rotate-3">
        <Image
          src="/childhood-sticker.webp"
          alt="Sticker of Arash as a child in Sanandaj, wearing a Spider-Man t-shirt"
          width={112}
          height={112}
        />
        <p className="text-[10px] text-gray-500 text-center mt-1">Sanandaj, early 2000s</p>
      </div>
      <p>I&apos;m really interested in trying new things. I enjoy spending time with my family and friends, and I want to become a better person every day :)</p>
      <p>I also like watching movies, playing video games, writing an interactive story, walking at nights, the list goes on and on...</p>
      <p>My goal is to have a good impact to the scientific community and make this world a better and happy place</p>
      <p className="font-bold">I will gradually update my personal website to introduce my projects and talk more about myself, but for now, thank you for your time to read what I wrote ❤️</p>
    </>
  );

  const desktopSections = [
    {
      title: (
        <h1 className="text-5xl xl:text-6xl font-bold">
          <span className="text-gray-600">Hi! I&apos;m </span>
          <span className="text-black">Arash</span>
          <span className="text-gray-600"> :)</span>
        </h1>
      ),
      body: homeBody(false),
    },
    {
      title: <h1 className="text-5xl xl:text-6xl font-bold text-black">Recent News</h1>,
      body: newsBody(false),
    },
    {
      title: <h1 className="text-5xl xl:text-6xl font-bold text-black">Academic Background</h1>,
      body: academicBody,
    },
    {
      title: <h1 className="text-5xl xl:text-6xl font-bold text-black">My Interests</h1>,
      body: interestsBody,
    },
  ];

  const mobileSections = [
    {
      title: (
        <h1 className="text-2xl font-bold">
          <span className="text-gray-600">Hi! I&apos;m </span>
          <span className="text-black">Arash</span>
          <span className="text-gray-600"> :)</span>
        </h1>
      ),
      body: homeBody(true),
    },
    {
      title: <h1 className="text-2xl font-bold text-black">Recent News</h1>,
      body: newsBody(true),
    },
    {
      title: <h1 className="text-2xl font-bold text-black">Academic Background</h1>,
      body: academicBody,
    },
    {
      title: <h1 className="text-2xl font-bold text-black">My Interests</h1>,
      body: interestsBody,
    },
  ];

  return (
    <div className="bg-white">
      {/* --- Main fixed container for all visible content --- */}
      <div
        className="fixed inset-0 z-0"
        style={{ "--ph": "min(360px, 44dvh)" } as CSSProperties}
        onWheel={onWheelMobile}
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

        {/* --- Desktop layout --- */}
        <div className="absolute inset-0 hidden lg:flex items-center justify-center">
          <div className="flex flex-col items-center justify-start">
            <div className="mb-3">
              <NavTabs />
            </div>
            <div className="relative w-80 h-[420px] rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src="/portrait.jpg"
                alt="Arash Ahmadi - PhD Student in Electrical and Computer Engineering at University of Oklahoma"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
          <div className="relative w-[500px] ml-8 h-[30rem]">
            {desktopSections.map((section, i) => (
              <motion.div
                key={SECTION_LABELS[i]}
                style={{
                  opacity: desktopMotion[i].opacity,
                  y: desktopMotion[i].y,
                  pointerEvents: desktopMotion[i].pointerEvents,
                }}
                className="absolute inset-0"
                aria-hidden={activeIndex !== i}
              >
                <div className="space-y-3 h-full flex flex-col justify-center">
                  {section.title}
                  <div className="space-y-2 max-w-lg text-lg text-gray-700 leading-relaxed">
                    {section.body}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* --- Mobile layout --- */}
        <div className="lg:hidden">
          <div className="absolute top-4 inset-x-0 z-10 flex flex-col items-center gap-2">
            <NavTabs />
            <div
              className="relative rounded-lg overflow-hidden"
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
          </div>
          <div className="absolute inset-x-0 px-6" style={{ top: "calc(var(--ph) + 84px)" }}>
            <div className="relative max-w-sm mx-auto" style={{ height: "calc(100dvh - var(--ph) - 100px)" }}>
              {mobileSections.map((section, i) => (
                <motion.div
                  key={SECTION_LABELS[i]}
                  initial={false}
                  animate={{
                    opacity: activeIndex === i ? 1 : 0,
                    y: activeIndex === i ? 0 : i < activeIndex ? -16 : 16,
                  }}
                  transition={{ duration: reducedMotion.current ? 0 : 0.35, ease: "easeOut" }}
                  style={{ pointerEvents: activeIndex === i ? "auto" : "none" }}
                  className="absolute inset-0"
                  aria-hidden={activeIndex !== i}
                >
                  <div
                    ref={(el) => {
                      scrollerRefs.current[i] = el;
                    }}
                    className="space-y-3 text-left pr-2 no-scrollbar h-full"
                    style={{
                      overflowY: "auto",
                      overscrollBehavior: "contain",
                      touchAction: "pan-y",
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    {section.title}
                    <div className="space-y-2 text-sm text-gray-700 leading-relaxed pb-4">
                      {section.body}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Scroll driver (desktop only; mobile locks page scroll) --- */}
      <div ref={containerRef} style={{ height: `${N * 100}vh` }} />
    </div>
  );
}
