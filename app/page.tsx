"use client";

import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { DotPattern } from "@/components/ui/dot-pattern";
import Image from "next/image";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"], // Maps scroll from top-to-bottom
  });

  const numSections = 3;

  // --- Animation Definitions ---
  // Opacity animations are shared. y-transform is for desktop only.
  // pointer-events ensures only the visible section is clickable.

  // Section 1
  const opacity1 = useTransform(scrollYProgress, [0, 1 / numSections / 2, 1 / numSections], [1, 1, 0]);
  const y1Desktop = useTransform(scrollYProgress, [0, 1 / numSections], [0, -50]);
  const pointerEvents1 = useTransform(opacity1, (val) => (val > 0.1 ? "auto" : "none"));

  // Section 2
  const opacity2 = useTransform(scrollYProgress, [1 / numSections, 1.5 / numSections, 2 / numSections], [0, 1, 0]);
  const y2Desktop = useTransform(scrollYProgress, [1 / numSections, 2 / numSections], [50, -50]);
  const pointerEvents2 = useTransform(opacity2, (val) => (val > 0.1 ? "auto" : "none"));

  // Section 3
  const opacity3 = useTransform(scrollYProgress, [2 / numSections, 2.5 / numSections, 1], [0, 1, 1]);
  const y3Desktop = useTransform(scrollYProgress, [2 / numSections, 1], [50, 0]);
  const pointerEvents3 = useTransform(opacity3, (val) => (val > 0.1 ? "auto" : "none"));

  return (
    <div className="bg-white">
      {/* --- Main Fixed Container for ALL Visible Content --- */}
      <div className="fixed inset-0 z-0">
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
            {/* Desktop Portrait */}
            <div className="relative w-80 h-[420px] rounded-lg overflow-hidden flex-shrink-0">
                <Image src="/arash-website/portrait.jpg" alt="Arash Portrait" fill className="object-cover" priority />
            </div>
            {/* Desktop Text Container */}
            <div className="relative w-[500px] ml-8 h-96">
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
                                    <Image src="/arash-website/google-scholar--v2.png" alt="Google Scholar" width={28} height={28} className="h-7 w-7" />
                                    <span className="text-xs">Scholar</span>
                                </a>
                                <a href="https://www.linkedin.com/in/arash-ahmadi-619ab1352" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                                    <span className="text-xs">LinkedIn</span>
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
                        <h1 className="text-5xl xl:text-6xl font-bold text-black">My Interests</h1>
                        <div className="space-y-2 max-w-lg text-lg text-gray-700 leading-relaxed">
                            <p>I'm really interested in trying new things. I enjoy spending time with my family and friends, and I want to become a better person every day :)</p>
                            <p>I also like watching movies, playing video games, writing an interactive story, walking at nights, the list goes on and on...</p>
                            <p>My goal is to have a good impact to the scientific community and make this world a better and happy place</p>
                            <p className="font-bold">I will gradually update my personal website to introduce my projects and talk more about myself, but for now, thank you for time to read what I wrote ❤️</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>

        {/* --- Mobile Layout --- */}
        <div className="lg:hidden">
            {/* Mobile Portrait */}
            <div className="absolute top-8 inset-x-0 z-10 flex justify-center">
                <div className="relative w-72 h-[360px] rounded-lg overflow-hidden">
                    <Image src="/arash-website/portrait.jpg" alt="Arash Portrait" fill className="object-cover" priority />
                </div>
            </div>
            {/* Mobile Text Container */}
            <div className="absolute top-[420px] inset-x-0 px-6">
                <div className="relative h-96 max-w-sm mx-auto">
                    {/* Section 1 */}
                    <motion.div style={{ opacity: opacity1, pointerEvents: pointerEvents1 }} className="absolute inset-0">
                        <div className="space-y-3 text-left">
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
                                        <Image src="/arash-website/google-scholar--v2.png" alt="Google Scholar" width={24} height={24} className="h-6 w-6" />
                                        <span className="text-xs">Scholar</span>
                                    </a>
                                    <a href="https://www.linkedin.com/in/arash-ahmadi-619ab1352" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-gray-700 hover:text-black transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                                        <span className="text-xs">LinkedIn</span>
                                    </a>
                                </div>
                                <p className="font-bold">Scroll to see more!</p>
                            </div>
                        </div>
                    </motion.div>
                    {/* Section 2 */}
                    <motion.div style={{ opacity: opacity2, pointerEvents: pointerEvents2 }} className="absolute inset-0">
                        <div className="space-y-3 text-left">
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
                    <motion.div style={{ opacity: opacity3, pointerEvents: pointerEvents3 }} className="absolute inset-0">
                        <div className="space-y-3 text-left">
                            <h1 className="text-2xl font-bold text-black">My Interests</h1>
                            <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                                <p>I'm really interested in trying new things. I enjoy spending time with my family and friends, and I want to become a better person every day :)</p>
                                <p>I also like watching movies, playing video games, writing an interactive story, walking at nights, the list goes on and on...</p>
                                <p>My goal is to have a good impact to the scientific community and make this world a better and happy place</p>
                                <p className="font-bold">I will gradually update my personal website to introduce my projects and talk more about myself, but for now, thank you for time to read what I wrote ❤️</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
      </div>

      {/* --- Scroll Driver --- */}
      <div ref={containerRef} style={{ height: `${numSections * 100}vh` }} />
    </div>
  );
} 
