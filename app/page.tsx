"use client";

import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform, useMotionValueEvent, animate } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { DotPattern } from "@/components/ui/dot-pattern";
import Image from "next/image";
import { SubsectionSwitcher } from "@/components/SubsectionSwitcher";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"], // Maps scroll from top-to-bottom
  });

  const numSections = 3.5; // Extended to allow overlay reveal

  // --- Active Tab State from scroll progress ---
  const [activeIndex, setActiveIndex] = useState<number>(0);
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // Map progress to 0,1,2 (ignoring the extra 0.5 for overlay)
    const thresholds = [0, 1 / 3, 2 / 3, 1];
    let idx = 0;
    if (latest >= thresholds[2] - 0.0001) idx = 2;
    else if (latest >= thresholds[1] - 0.0001) idx = 1;
    else idx = 0;
    setActiveIndex(idx);
  });

  // --- Smooth scroll helper ---
  const [isTransitioning, setIsTransitioning] = useState(false);
  function scrollToSection(index: number) {
    if (typeof window === "undefined") return;
    const clamped = Math.max(0, Math.min(numSections - 1, index));
    // Ensure the target section starts from the top of its content
    const targetSection = sectionScrollRefs[clamped]?.current;
    if (targetSection) {
      targetSection.scrollTop = 0;
    }
    const target = clamped * window.innerHeight;
    setIsTransitioning(true);
    const controls = animate(window.scrollY, target, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => window.scrollTo(0, v),
      onComplete: () => setTimeout(() => setIsTransitioning(false), 50),
    });
    return () => controls.stop();
  }

  // --- Scroll containers ---
  // Mobile per-section scroll containers
  const sectionScrollRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  // Desktop scroll containers for Section 3
  const desktopGeneralRef = useRef<HTMLDivElement>(null);
  const desktopOverlayRef = useRef<HTMLDivElement>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // Only enable gesture layer on mobile (tailwind lg breakpoint ~1024)
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024;
  }, []);

  // --- Animation Definitions ---

  // --- Shared Opacity and Pointer Events ---
  const opacity1 = useTransform(scrollYProgress, [0, 1 / numSections / 2, 1 / numSections], [1, 1, 0]);
  const pointerEvents1 = useTransform(opacity1, (val) => (val > 0.1 ? "auto" : "none"));

  const opacity2 = useTransform(scrollYProgress, [1 / numSections, 1.5 / numSections, 2 / numSections], [0, 1, 0]);
  const pointerEvents2 = useTransform(opacity2, (val) => (val > 0.1 ? "auto" : "none"));

  const opacity3 = useTransform(scrollYProgress, [2 / numSections, 2.5 / numSections, 1], [0, 1, 1]);
  const pointerEvents3 = useTransform(opacity3, (val) => (val > 0.1 ? "auto" : "none"));

  // --- Desktop-Only Vertical Animation ---
  const y1Desktop = useTransform(scrollYProgress, [0, 1 / numSections], [0, -50]);
  const y2Desktop = useTransform(scrollYProgress, [1 / numSections, 2 / numSections], [50, -50]);
  const y3Desktop = useTransform(scrollYProgress, [2 / numSections, 1], [50, 0]);

  // --- Mobile-Only Vertical Animation ---
  const y1Mobile = useTransform(scrollYProgress, [0, 1 / 3], [0, -20]);
  const y2Mobile = useTransform(scrollYProgress, [1 / 3, 2 / 3], [20, 0]);
  const y3Mobile = useTransform(scrollYProgress, [2 / 3, 1], [20, 0]);

  // --- Interests subsection: "current mood" overlay animation ---
  // Scrubbed by scroll in the range [2/3 to 1] (section 3's extended space)
  const overlayStartProgress = isMobile ? 0.9 : 0.7; // Start later on mobile to ensure full reading
  const moodOverlayProgress = useTransform(scrollYProgress, [overlayStartProgress, 1], [0, 1]);
  const moodOverlayOpacity = useTransform(moodOverlayProgress, [0, 1], [0, 1]);
  const moodOverlayY = useTransform(moodOverlayProgress, [0, 1], [24, 0]);
  
  // General content fades out as overlay fades in (desktop only, mobile keeps both visible)
  const generalContentOpacity = useTransform(moodOverlayProgress, [0, 1], [1, 0]);

  // Desktop layout adjustments when mood overlay is active
  const portraitOpacity = useTransform(moodOverlayProgress, [0, 1], [1, 0]);
  const portraitY = useTransform(moodOverlayProgress, [0, 1], [0, -40]);
  const portraitWidth = useTransform(moodOverlayProgress, [0, 1], [320, 0]);
  const textWidth = useTransform(moodOverlayProgress, (p) => 500 + p * 220);
  const textMarginLeft = useTransform(moodOverlayProgress, (p) => (1 - p) * 32);
  const textHeight = useTransform(moodOverlayProgress, (p) => 384 + p * 120); // grow height for overlay
  // Mobile: hide/move portrait and raise content when overlay active
  const mobilePortraitOpacity = useTransform(moodOverlayProgress, [0, 1], [1, 0]);
  const mobilePortraitY = useTransform(moodOverlayProgress, [0, 1], [0, -100]);
  const mobileContentTop = useTransform(moodOverlayProgress, [0, 1], [450, 110]);

  // Helper to scroll to a specific progress (0 to 1 across full scroll height)
  function scrollToProgress(progress: number) {
    if (typeof window === "undefined") return;
    const clamped = Math.max(0, Math.min(1, progress));
    const target = clamped * (numSections - 1) * window.innerHeight;
    setIsTransitioning(true);
    const controls = animate(window.scrollY, target, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => window.scrollTo(0, v),
      onComplete: () => setTimeout(() => setIsTransitioning(false), 50),
    });
    return () => controls.stop();
  }

  // State for mood overlay activation (derived from scroll)
  const [isMoodActive, setIsMoodActive] = useState(false);
  useMotionValueEvent(moodOverlayProgress, "change", (latest) => {
    setIsMoodActive(latest > 0.5);
  });

  // Wheel handler (global). On mobile, forwards to active section; on desktop, also respects desktop section bounds
  const onWheelMobile = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isMobile) return; // do nothing on desktop
    const dir = Math.sign(e.deltaY);
    const current = sectionScrollRefs[activeIndex]?.current;
    if (!current) return;
    const atTop = current.scrollTop <= 0;
    const atBottom = Math.ceil(current.scrollTop + current.clientHeight) >= current.scrollHeight;
    // Only allow section change when at bounds; otherwise always scroll inner content
    if ((dir > 0 && !atBottom) || (dir < 0 && !atTop)) {
      // Scroll inside the section
      const unit = e.deltaMode === 1 ? 16 : 1; // normalize line vs pixel delta
      const scaled = e.deltaY * unit * 0.18; // slow inner scroll more
      current.scrollTop += scaled;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // At bounds: let the document handle the default scroll (natural scrubbing)
    // Do not call preventDefault here to allow the page to move to next section smoothly
  };

  // Touch handlers (global on mobile)
  const onTouchStartMobile = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    setTouchStartY(e.touches[0].clientY);
  };
  const onTouchMoveMobile = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || touchStartY == null) return;
    const dy = touchStartY - e.touches[0].clientY; // positive = swipe up
    const current = sectionScrollRefs[activeIndex]?.current;
    if (!current) return;
    const atTop = current.scrollTop <= 0;
    const atBottom = Math.ceil(current.scrollTop + current.clientHeight) >= current.scrollHeight;
    // Always consume scroll inside until reaching bounds, then allow transition
    if ((dy > 0 && !atBottom) || (dy < 0 && !atTop)) {
      const scaledDy = dy * 0.25; // even slower inner scroll on touch
      current.scrollTop += scaledDy;
      // keep small remainder so motion feels natural
      setTouchStartY(e.touches[0].clientY + (dy - scaledDy));
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // At bounds: allow native page scroll to continue (no preventDefault)
    setTouchStartY(e.touches[0].clientY);
  };

  // --- Nav Tabs component ---
  function NavTabs() {
    const labels = ["Home", "Academic", "Interests"];
    return (
      <div role="tablist" aria-label="Section navigation" className="flex items-center gap-2">
        {labels.map((label, idx) => {
          const isActive = activeIndex === idx;
          return (
            <button
              key={label}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              onPointerDown={(e) => { e.preventDefault(); scrollToSection(idx); }}
              onClick={(e) => { e.preventDefault(); scrollToSection(idx); }}
              className={cn(
                "px-3 py-1 rounded-full transition-colors active:opacity-90",
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

  return (
    <div className="bg-white">
      {/* --- Main Fixed Container for ALL Visible Content --- */}
      <div className="fixed inset-0 z-0" onWheel={onWheelMobile} onTouchStart={onTouchStartMobile} onTouchMove={onTouchMoveMobile}>
        <DotPattern
              width={20}
              height={20}
          cx={1}
          cy={1}
          cr={1}
          className={cn(
            "pointer-events-none [mask-image:radial-gradient(800px_circle_at_center,white,transparent)]",
          )}
        />

        {/* --- Desktop Layout --- */}
        <div className="absolute inset-0 hidden lg:flex items-center justify-center">
            {/* Desktop Portrait + Tabs Column */}
            <motion.div className="flex flex-col items-center justify-start" style={{ opacity: portraitOpacity, y: portraitY, width: portraitWidth, pointerEvents: useTransform(moodOverlayProgress, [0, 1], ["auto", "none"]) }}>
                <div className="mb-4"><NavTabs /></div>
                <div className="relative w-80 h-[420px] rounded-lg overflow-hidden flex-shrink-0">
                    <Image src="/portrait.jpg" alt="Arash Portrait" fill className="object-cover" priority />
                </div>
            </motion.div>
            {/* Desktop Text Container */}
            <motion.div className="relative" style={{ width: textWidth, marginLeft: textMarginLeft, height: textHeight }}>
                {/* Section 1 */}
                <motion.div style={{ opacity: opacity1, y: y1Desktop, pointerEvents: pointerEvents1 }} className="absolute inset-0">
                    <div className="space-y-3">
                        <h1 className="text-5xl xl:text-6xl font-bold">
                            <span className="text-gray-600">Hi! I'm </span>
                            <span className="text-black">Arash</span>
                            <span className="text-gray-600"> :)</span>
                        </h1>
                        <div className="space-y-2 max-w-lg text-lg text-gray-700 leading-relaxed">
                            <p>Welcome to my personal website!</p>
                            <p>
                                My name is Arash Ahmadi. I'm currently a second year PhD student at the{" "}
                                <a href="https://www.ou.edu/" className="text-[#DC143C] underline">University Of Oklahoma</a>{" "}
                                working at <a href="https://inquirelab.ai/" className="text-red-700 underline" target="_blank" rel="noopener noreferrer">InquireLab</a> in electrical and computer engineering. In my studies, I'm focusing on the utilization of Large Language Models (LLMs) in different domains, and also working on the interpretability side of them.
                            </p>
                            <div className="flex items-start justify-start gap-6 pt-2">
                                <a href="https://github.com/arash-san" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/></svg>
                                    <span className="text-xs">GitHub</span>
                                </a>
                                <a href="https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                    <Image src="/google-scholar--v2.png" alt="Google Scholar" width={28} height={28} className="h-7 w-7" />
                                    <span className="text-xs">Scholar</span>
                                </a>
                                <a href="https://www.linkedin.com/in/arash-ahmadi-619ab1352" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                                    <span className="text-xs">LinkedIn</span>
                                </a>
                                <a href="mailto:arash.ahmadi@ou.edu" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    <span className="text-xs">Email</span>
                                </a>
                            </div>
                            <p className="font-bold">Scroll to see more!</p>
                        </div>
                    </div>
                </motion.div>
                {/* Section 2 */}
                <motion.div style={{ opacity: opacity2, y: y2Desktop, pointerEvents: pointerEvents2 }} className="absolute inset-0">
                    <div className="space-y-3">
                        <h1 className="text-5xl xl:text-6xl font-bold text-black">Academic Background</h1>
                        <div className="space-y-2 max-w-lg text-lg text-gray-700 leading-relaxed">
                            <p>
                                I completed my bachelors at The University Of Kurdistan with a GPA of 3.89/4. For my final project, I
                                <a href="https://www.researchgate.net/publication/373426799_Efficient_Brute-force_state_space_search_for_Yin-Yang_puzzle" className="text-green-700 underline mx-1" target="_blank" rel="noopener noreferrer">published a paper</a>
                                {" "}about designing an efficient algorithm for solving the Yin-Yang puzzle.
                            </p>
                            <p>
                                Then I got accepted to a direct PhD position at OU! I published 2 papers in my first year and looking forward to publish more in upcoming years. You can see my google scholar at{" "}
                                <a href="https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" className="text-blue-700 underline" target="_blank" rel="noopener noreferrer">this link</a>.
                            </p>
                        </div>
                    </div>
                </motion.div>
                {/* Section 3 */}
                <motion.div style={{ opacity: opacity3, y: y3Desktop, pointerEvents: pointerEvents3 }} className="absolute inset-0">
                    <div className="space-y-3">
                        <SubsectionSwitcher
                          title="My Interests"
                          isActiveProgress={moodOverlayProgress}
                          onSelectGeneral={() => scrollToProgress(isMobile ? (2/3 + 0.02) : overlayStartProgress)}
                          onSelectOverlay={() => scrollToProgress(1)}
                          general={(
                            <div className="space-y-2 max-w-lg text-lg text-gray-700 leading-relaxed">
                              <p>I'm really interested in trying new things. I enjoy spending time with my family and friends, and I want to become a better person every day :)</p>
                              <p>I also like watching movies, playing video games, writing an interactive story, walking at nights, the list goes on and on...</p>
                              <p>My goal is to have a good impact to the scientific community and make this world a better and happy place</p>
                              <p className="font-bold">I will gradually update my personal website to introduce my projects and talk more about myself, but for now, thank you for your time to read what I wrote ❤️</p>
                            </div>
                          )}
                          overlay={(
                            <div>
                              <p className="text-gray-800 mb-3">
                                So recently, I found this music video that I really like. It's authentic, artistic, and fun to listen. I found this music video by watching a viral part of it that the camera would move from the girl to the guy multiple times.
                              </p>
                              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                                <iframe
                                  className="absolute inset-0 w-full h-full rounded-md"
                                  src="https://www.youtube.com/embed/QcuV8h_I1y0"
                                  title="YouTube video player"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  referrerPolicy="strict-origin-when-cross-origin"
                                  allowFullScreen
                                />
                              </div>
                            </div>
                          )}
                        />
                    </div>
                </motion.div>
            </motion.div>
        </div>

        {/* --- Mobile Layout --- */}
        <div className="lg:hidden">
            {/* Mobile Tabs on top */}
            <div className="absolute top-2 inset-x-0 z-30 flex justify-center"><NavTabs /></div>
            {/* Mobile Portrait separate layer below tabs; disable pointer when overlay active */}
            <motion.div className="absolute top-12 inset-x-0 z-10 flex justify-center" style={{ opacity: mobilePortraitOpacity, y: mobilePortraitY, pointerEvents: useTransform(moodOverlayProgress, [0, 1], ["auto", "none"]) }}>
                <div className="relative w-72 h-[360px] rounded-lg overflow-hidden">
                    <Image src="/portrait.jpg" alt="Arash Portrait" fill className="object-cover" priority />
                </div>
            </motion.div>
            {/* Mobile Text Container */}
            <motion.div className="absolute inset-x-0 px-6" style={{ top: mobileContentTop, bottom: 0 }}>
                <div className="relative max-w-sm mx-auto" style={{ height: "calc(100vh - " + mobileContentTop.get() + "px)" }}>
                    {/* Section 1 */}
                    <motion.div style={{ opacity: opacity1, y: y1Mobile, pointerEvents: pointerEvents1 }} className="absolute inset-0">
                        <div ref={sectionScrollRefs[0]} className="space-y-3 text-left pr-2 no-scrollbar h-full overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
                            <h1 className="text-2xl font-bold">
                                <span className="text-gray-600">Hi! I'm </span>
                                <span className="text-black">Arash</span>
                                <span className="text-gray-600"> :)</span>
                            </h1>
                            <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                                <p>Welcome to my personal website!</p>
                                <p>
                                    I'm currently a second year PhD student at the{" "}
                                    <a href="https://www.ou.edu/" className="text-[#DC143C] underline">University Of Oklahoma</a>{" "}
                                    working at <a href="https://inquirelab.ai/" className="text-red-700 underline" target="_blank" rel="noopener noreferrer">InquireLab</a> in electrical and computer engineering. In my studies, I'm focusing on the utilization of Large Language Models (LLMs) in different domains, and also working on the interpretability side of them.
                                </p>
                                <div className="flex items-start justify-start gap-6 pt-2">
                                    <a href="https://github.com/arash-san" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/></svg>
                                        <span className="text-xs">GitHub</span>
                                    </a>
                                    <a href="https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                        <Image src="/google-scholar--v2.png" alt="Google Scholar" width={24} height={24} className="h-6 w-6" />
                                        <span className="text-xs">Scholar</span>
                                    </a>
                                    <a href="https://www.linkedin.com/in/arash-ahmadi-619ab1352" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                                        <span className="text-xs">LinkedIn</span>
                                    </a>
                                    <a href="mailto:arash.ahmadi@ou.edu" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                        <span className="text-xs">Email</span>
                                    </a>
                                </div>
                                <p className="font-bold">Scroll to see more!</p>
                            </div>
                        </div>
                    </motion.div>
                    {/* Section 2 */}
                    <motion.div style={{ opacity: opacity2, y: y2Mobile, pointerEvents: pointerEvents2 }} className="absolute inset-0">
                        <div ref={sectionScrollRefs[1]} className="space-y-3 text-left pr-2 no-scrollbar h-full overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
                            <h1 className="text-2xl font-bold text-black">Academic Background</h1>
                            <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                                <p>
                                    I completed my bachelors at The University Of Kurdistan with a GPA of 3.89/4. For my final project, I
                                    <a href="https://www.researchgate.net/publication/373426799_Efficient_Brute-force_state_space_search_for_Yin-Yang_puzzle" className="text-green-700 underline mx-1" target="_blank" rel="noopener noreferrer">published a paper</a>
                                    {" "}about designing an efficient algorithm for solving the Yin-Yang puzzle.
                                </p>
                                <p>
                                    Then I got accepted to a direct PhD position at OU! I published 2 papers in my first year and looking forward to publish more in upcoming years. You can see my google scholar at{" "}
                                    <a href="https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" className="text-blue-700 underline" target="_blank" rel="noopener noreferrer">this link</a>.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                    {/* Section 3 */}
                    <motion.div style={{ opacity: opacity3, y: y3Mobile, pointerEvents: pointerEvents3 }} className="absolute inset-0">
                        <div ref={sectionScrollRefs[2]} className="space-y-3 text-left pr-2 no-scrollbar h-full overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
                          <SubsectionSwitcher
                            size="sm"
                            title="My Interests"
                            isActiveProgress={moodOverlayProgress}
                            onSelectGeneral={() => scrollToProgress(isMobile ? (2/3 + 0.02) : overlayStartProgress)}
                            onSelectOverlay={() => scrollToProgress(1)}
                            general={(
                              <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                                <p>I'm really interested in trying new things. I enjoy spending time with my family and friends, and I want to become a better person every day :)</p>
                                <p>I also like watching movies, playing video games, writing an interactive story, walking at nights, the list goes on and on...</p>
                                <p>My goal is to have a good impact to the scientific community and make this world a better and happy place</p>
                                <p className="font-bold">I will gradually update my personal website to introduce my projects and talk more about myself, but for now, thank you for your time to read what I wrote ❤️</p>
                              </div>
                            )}
                            overlay={(
                              <div>
                                <p className="text-gray-800 mb-2">
                                  So recently, I found this music video that I really like. It's authentic, artistic, and fun to listen. I found this music video by watching a viral part of it that the camera would move from the girl to the guy multiple times.
                                </p>
                                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                                  <iframe
                                    className="absolute inset-0 w-full h-full rounded-md"
                                    src="https://www.youtube.com/embed/QcuV8h_I1y0"
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    allowFullScreen
                                  />
                                </div>
                              </div>
                            )}
                          />
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
      </div>

      {/* --- Scroll Driver --- */}
      <div ref={containerRef} style={{ height: `${numSections * 100}vh` }} />
    </div>
  );
}
