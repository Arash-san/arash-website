"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { startTransition, useEffect, useRef, useState } from "react";
import { DotPattern } from "@/components/ui/dot-pattern";
import Image from "next/image";
import { news } from "@/lib/profile-data";
import { HomeBlogPreview } from "@/components/blog/home-blog-preview";

const SECTIONS = ["home", "news", "academic", "tools", "blog", "interests"] as const;
const SECTION_LABELS: Record<(typeof SECTIONS)[number], string> = {
  home: "home",
  news: "news",
  academic: "academic",
  tools: "tools",
  blog: "blog posts",
  interests: "interests",
};
const EASE = [0.22, 1, 0.36, 1] as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

export default function Home() {
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const activeRef = useRef(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glassRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(rm.matches);
    update();
    rm.addEventListener("change", update);
    return () => rm.removeEventListener("change", update);
  }, []);

  // Gentle snapping: after the reader stops scrolling, the page settles on
  // the nearest section, but slow scrolling still scrubs the fade freely.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("home-snap");
    return () => html.classList.remove("home-snap");
  }, []);

  // Scroll-linked reveal. Each section's content rises and fades in as it
  // enters, then keeps rising and fades out as it leaves, in step with the
  // scroll position rather than on a timer. Positions are read from the
  // untransformed wrapper, and only opacity and transform are written, so
  // the loop never forces a layout.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const span = vh * 0.38;
      // Read every position first, then write. Interleaving reads and writes
      // would make the browser recompute styles once per section per frame.
      const rects = blockRefs.current.map((block) => block?.getBoundingClientRect() ?? null);
      let best = 0;
      let bestV = -1;
      rects.forEach((r, i) => {
        const content = contentRefs.current[i];
        const glass = glassRefs.current[i];
        const title = titleRefs.current[i];
        if (!r || !content) return;
        let enter: number;
        let exit: number;
        if (r.height <= vh * 0.75) {
          // Short sections fade with their center: fully clear only when
          // centered, so every bit of scrolling moves the fade a little.
          const c = r.top + r.height / 2;
          enter = clamp01((vh - c) / (vh * 0.5));
          exit = clamp01(c / (vh * 0.5));
        } else {
          // Tall sections stay readable while they fill the screen and only
          // fade as their first or last lines reach the screen edge.
          enter = clamp01((vh * 0.94 - r.top) / span);
          exit = clamp01((r.bottom - vh * 0.06) / span);
        }
        const v = smooth(Math.min(enter, exit));
        if (v > bestV + 0.001) {
          bestV = v;
          best = i;
        }
        if (reduced) {
          content.style.opacity = "";
          content.style.transform = "";
          if (glass) glass.style.opacity = "";
          if (title) title.style.transform = "";
          return;
        }
        const y = exit < enter ? -(1 - smooth(exit)) * 64 : (1 - smooth(enter)) * 64;
        const t = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        const o = v.toFixed(3);
        // Sections far off screen settle at the same values every frame; skip
        // rewriting identical styles.
        if (content.style.transform === t && content.style.opacity === o) return;
        content.style.opacity = o;
        content.style.transform = t;
        if (glass) {
          glass.style.opacity = o;
          glass.style.transform = t;
        }
        // The title moves a little ahead of the body for a sense of depth.
        if (title) title.style.transform = `translate3d(0, ${(exit < enter ? y * 0.45 : -y * 0.25).toFixed(1)}px, 0)`;
      });
      if (best !== activeRef.current) {
        activeRef.current = best;
        startTransition(() => setActive(best));
        window.history.replaceState(null, "", best === 0 ? window.location.pathname : `#${SECTIONS[best]}`);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    blockRefs.current.forEach((b) => b && ro.observe(b));
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [reduced]);

  function scrollToSection(index: number, instant = false) {
    const el = sectionRefs.current[index];
    if (!el) return;
    window.scrollTo({ top: index === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY, behavior: instant || reduced ? "auto" : "smooth" });
  }
  const scrollRef = useRef(scrollToSection);
  scrollRef.current = scrollToSection;

  // Deep links such as /#news, on load and when the hash changes.
  useEffect(() => {
    const go = () => {
      const i = (SECTIONS as readonly string[]).indexOf(window.location.hash.slice(1));
      if (i > 0) scrollRef.current(i, true);
    };
    go();
    const onHash = () => {
      const i = (SECTIONS as readonly string[]).indexOf(window.location.hash.slice(1));
      if (i >= 0) scrollRef.current(i);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // --- Nav tabs with sliding pill ------------------------------------------
  function NavTabs({ layout }: { layout: "d" | "m" }) {
    return (
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
                scrollToSection(idx);
              }}
              className="relative whitespace-nowrap px-1.5 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-sm active:opacity-90"
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
                {SECTION_LABELS[label]}
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
      <div className="fixed right-2 sm:right-5 top-1/2 -translate-y-1/2 z-20 hidden sm:flex flex-col items-center gap-2.5">
        {SECTIONS.map((label, i) => (
          <button
            key={label}
            aria-label={`Go to ${SECTION_LABELS[label]}`}
            onClick={() => scrollToSection(i)}
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
  const iconSize = "h-6 w-6 lg:h-7 lg:w-7";
  const socialLinks = (
    <div className="flex flex-wrap items-start justify-start gap-6 pt-2">
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
    <button type="button" onClick={() => scrollToSection(1)} className="font-bold flex items-center gap-2 pt-1">
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
        My name is Arash Ahmadi. I&apos;m currently a PhD student at the{" "}
        <a href="https://www.ou.edu/" className="text-[#DC143C] underline">University Of Oklahoma</a>{" "}
        working at <a href="https://inquirelab.ai/" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">InquireLab</a> in electrical and computer engineering. In my studies, I&apos;m focusing on the utilization of Large Language Models (LLMs) in different domains, and also working on the interpretability side of them.
      </p>
      {socialLinks}
      {scrollHint}
    </>
  );

  const newsBody = (
    <div className="space-y-4">
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
          <p className="font-semibold text-gray-800 group-hover:text-[#DC143C] transition-colors text-[15px] lg:text-base leading-snug">
            {item.title}
          </p>
          <p className="text-xs lg:text-sm text-gray-600 mt-0.5 leading-relaxed">{item.body}</p>
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
    <div className="space-y-4">
      <p className="text-[15px] lg:text-base">Things I build outside of research, free for anyone to use.</p>
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
          <p className="font-semibold text-gray-800 group-hover:text-[#DC143C] transition-colors text-[15px] lg:text-base">
            {item.name}
          </p>
          <p className="text-xs lg:text-sm text-gray-600 mt-0.5 leading-relaxed">{item.desc}</p>
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

  const titleClass = "text-[28px] leading-tight lg:text-5xl xl:text-6xl font-bold";
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

  const portrait = (className: string, sizes: string) => (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <Image
        src="/portrait.jpg"
        alt="Arash Ahmadi - PhD Student in Electrical and Computer Engineering at University of Oklahoma"
        fill
        sizes={sizes}
        className="object-cover"
        priority
      />
    </div>
  );

  return (
    <div className="relative min-h-screen bg-white [overflow-x:clip]">
      <DotPattern
        width={20}
        height={20}
        cx={1}
        cy={1}
        cr={1}
        className="!fixed z-0 [mask-image:radial-gradient(900px_circle_at_center,white,transparent)]"
      />

      <ProgressDots />

      {/* Phone navigation bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex justify-center px-2 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 bg-white/80 backdrop-blur-md [mask-image:linear-gradient(to_bottom,#000_78%,transparent)]">
        <NavTabs layout="m" />
      </header>

      <div className="relative z-10 mx-auto flex max-w-[900px] justify-center gap-10 px-6">
        {/* Desktop: portrait and tabs stay put while the sections glide past. */}
        <aside className="hidden lg:flex sticky top-0 h-[100svh] shrink-0 flex-col items-center justify-center">
          <motion.div
            className="flex flex-col items-center"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="mb-3">
              <NavTabs layout="d" />
            </div>
            <motion.div
              className="w-80 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.3)] rounded-xl"
              whileHover={reduced ? undefined : { scale: 1.015 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
            >
              {portrait("w-80 h-[420px]", "320px")}
            </motion.div>
          </motion.div>
        </aside>

        <main className="w-full max-w-[520px] lg:w-[500px] lg:max-w-none">
          {SECTIONS.map((label, i) => (
            <section
              key={label}
              id={label}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              aria-label={SECTION_LABELS[label]}
              className="home-section flex min-h-[100svh] items-center pt-20 pb-14 lg:py-16"
            >
              <div
                ref={(el) => {
                  blockRefs.current[i] = el;
                }}
                className="relative w-full"
              >
                <div
                  ref={(el) => {
                    glassRefs.current[i] = el;
                  }}
                  aria-hidden="true"
                  className="reading-glass"
                />
                <div
                  ref={(el) => {
                    contentRefs.current[i] = el;
                  }}
                  className="home-reveal relative space-y-3"
                >
                  {i === 0 &&
                    portrait(
                      "lg:hidden mx-auto mb-6 w-[min(62vw,250px)] aspect-[4/5] shadow-[0_14px_34px_-16px_rgba(0,0,0,0.3)]",
                      "250px"
                    )}
                  <div
                    ref={(el) => {
                      titleRefs.current[i] = el;
                    }}
                    className="home-title"
                  >
                    {titles[i]}
                  </div>
                  <div className="space-y-2.5 text-[15px] lg:text-lg text-gray-700 leading-relaxed">{bodies[i]}</div>
                </div>
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
