/**
 * Single source of truth for profile content across all theme pages.
 * Derived from arash-ahmadi-cv.pdf (2026) and inquirelab.ai/news.
 */

export const identity = {
  name: "Arash Ahmadi",
  firstName: "Arash",
  role: "Ph.D. student, Electrical & Computer Engineering",
  university: "University of Oklahoma",
  lab: "INQUIRE Lab",
  labUrl: "https://inquirelab.ai/",
  location: "Norman, Oklahoma",
  email: "arash.ahmadi@ou.edu",
  tagline:
    "I work on making language models small, useful, and honest about what they are doing.",
  intro:
    "I'm a Ph.D. student at the University of Oklahoma, where I fine-tune small language models to run on resource-constrained edge devices and put them to work in agentic systems, aviation safety, and health monitoring. I like building things with people — clubs, workshops, websites — and turning the useful parts into research.",
};

export const links = [
  { label: "Email", href: "mailto:arash.ahmadi@ou.edu", kind: "email" },
  { label: "CV", href: "/arash-ahmadi-cv.pdf", kind: "file" },
  { label: "Google Scholar", href: "https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en", kind: "scholar" },
  { label: "GitHub", href: "https://github.com/arash-san", kind: "github" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/arash-ahmadi-619ab1352", kind: "linkedin" },
  { label: "X", href: "https://x.com/user_arash", kind: "x" },
] as const;

export type NewsItem = {
  date: string; // ISO
  dateLabel: string;
  title: string;
  body: string;
  href?: string;
  tag: string;
};

/** Sourced from inquirelab.ai/news and LinkedIn updates. Newest first. */
export const news: NewsItem[] = [
  {
    date: "2026-05-28",
    dateLabel: "May 28, 2026",
    title: "New paper published in Expert Systems with Applications",
    body:
      "Our paper on automated HFACS classification for aviation safety — fine-tuning Llama-3.1 8B with Group Relative Policy Optimization and a multi-component reward system — is out in ESWA (vol. 329).",
    href: "https://doi.org/10.1016/j.eswa.2026.132963",
    tag: "Publication",
  },
  {
    date: "2026-04-15",
    dateLabel: "April 15, 2026",
    title: "Successfully defended my master's thesis",
    body:
      "“Search-Based Reward Function Optimization for LLM Reasoning via Reinforcement Learning” — a framework for improving LLM reasoning through adaptive, search-driven reward design. On to the rest of the Ph.D.!",
    href: "https://inquirelab.ai/news",
    tag: "Milestone",
  },
  {
    date: "2026-04-07",
    dateLabel: "April 7, 2026",
    title: "LLM Engineering Club officially approved at OU",
    body:
      "The club I founded is now a registered student organization — hands-on LLM engineering, study groups, responsible-AI discussions, and workshops with cluster access for local model training.",
    href: "https://ou.campuslabs.com/engage/organization/llm-club",
    tag: "Community",
  },
  {
    date: "2026-01-08",
    dateLabel: "January 2026",
    title: "Presented at AIAA SciTech 2026 in Orlando",
    body:
      "I presented “LLM-Powered HFACS Analysis of ASRS Narratives via MCP Bridge” in the Student Paper Competition at one of the largest aerospace research forums.",
    href: "https://doi.org/10.2514/6.2026-1195",
    tag: "Conference",
  },
  {
    date: "2025-11-18",
    dateLabel: "November 18, 2025",
    title: "Awarded two travel grants for SciTech 2026",
    body:
      "Grateful to receive the Robberson Travel Grant and a Gallogly College of Engineering Graduate Student Travel Award in support of presenting our aviation-safety work.",
    href: "https://inquirelab.ai/news",
    tag: "Award",
  },
];

export type Publication = {
  type: "Journal" | "Conference" | "Preprint";
  title: string;
  venue: string;
  year: string;
  href: string;
  note?: string;
};

export const publications: Publication[] = [
  {
    type: "Journal",
    title:
      "Improving Aviation Safety Analysis: Automated HFACS Classification Using Reinforcement Learning with Group Relative Policy Optimization",
    venue: "Expert Systems with Applications, vol. 329, Article 132963",
    year: "2026",
    href: "https://doi.org/10.1016/j.eswa.2026.132963",
  },
  {
    type: "Conference",
    title:
      "LLM-Powered HFACS Analysis of ASRS Narratives via MCP Bridge for Enhanced Aviation Safety Debriefs",
    venue: "AIAA SCITECH 2026 Forum, Student Paper Competition",
    year: "2026",
    href: "https://doi.org/10.2514/6.2026-1195",
  },
  {
    type: "Preprint",
    title:
      "Enhanced LLM Reasoning by Optimizing Reward Functions with Search-Driven Reinforcement Learning",
    venue: "arXiv:2605.02073",
    year: "2026",
    href: "https://doi.org/10.48550/arXiv.2605.02073",
    note: "Master's thesis work",
  },
  {
    type: "Journal",
    title:
      "A Comparative Study of Sampling Methods with Cross-Validation in the FedHome Framework",
    venue: "IEEE Transactions on Parallel and Distributed Systems, vol. 36, no. 3",
    year: "2025",
    href: "https://doi.org/10.1109/TPDS.2025.3526238",
    note: "OU ECE Journal Paper Award, 2025",
  },
  {
    type: "Preprint",
    title:
      "MCP Bridge: A Lightweight, LLM-Agnostic RESTful Proxy for Model Context Protocol Servers",
    venue: "arXiv:2504.08999",
    year: "2025",
    href: "https://doi.org/10.48550/arXiv.2504.08999",
  },
  {
    type: "Conference",
    title:
      "Towards Transparent Artificial Intelligence: Exploring Modern Approaches and Future Directions",
    venue: "AIxSET 2024, IEEE",
    year: "2024",
    href: "https://doi.org/10.1109/AIxSET62544.2024.00047",
  },
  {
    type: "Journal",
    title: "Efficient Brute-Force State Space Search for Yin-Yang Puzzle",
    venue: "The Journal of Supercomputing, vol. 80, no. 3",
    year: "2024",
    href: "https://doi.org/10.1007/s11227-023-05565-w",
    note: "Bachelor's thesis work",
  },
];

export const education = [
  {
    degree: "Ph.D., Electrical & Computer Engineering",
    school: "University of Oklahoma",
    period: "2024 — present",
    detail:
      "Fine-tuning small language models for efficient deployment on resource-constrained edge devices, with applications in agentic systems and diverse domains.",
  },
  {
    degree: "M.S., Electrical & Computer Engineering",
    school: "University of Oklahoma",
    period: "2024 — 2026",
    detail:
      "Defended April 2026 · GPA 3.88/4.0 · Thesis: Search-Based Reward Function Optimization for LLM Reasoning via Reinforcement Learning.",
  },
  {
    degree: "B.Sc., Computer Engineering (Software)",
    school: "University of Kurdistan",
    period: "2018 — 2023",
    detail:
      "Sanandaj, Kurdistan, Iran · GPA 3.88/4.0 · Thesis: Efficient brute-force state space search for the Yin-Yang puzzle.",
  },
];

export const research = [
  {
    title: "Small models, edge devices",
    body:
      "Fine-tuning compact language models so they can run where the data lives — private, fast, and useful without a datacenter.",
  },
  {
    title: "Reward design for reasoning",
    body:
      "Search-driven optimization of reward functions in reinforcement learning, so LLMs learn to reason more reliably — the heart of my master's thesis.",
  },
  {
    title: "AI for aviation safety",
    body:
      "LLMs and reinforcement learning applied to aviation incident narratives, supporting faster and more consistent HFACS human-factors classification.",
  },
  {
    title: "Agentic systems & tooling",
    body:
      "Practical bridges between models, tools, and local infrastructure — including MCP Bridge, a lightweight RESTful proxy for Model Context Protocol servers.",
  },
];

export const featured = [
  {
    title: "LLM Engineering Club",
    role: "Founder · Registered OU student organization",
    href: "https://ou.campuslabs.com/engage/organization/llm-club",
    body:
      "A place for OU students to learn LLM engineering by doing: study groups, AI-news discussions, responsible-use conversations, and workshops where students train small models on a real computing cluster.",
    image: "/beta/llm-club.png",
  },
  {
    title: "Cybersecurity Essentials Workshop",
    role: "Instructor & Lead Developer · 2025, 2026",
    href: "https://inquirelab.ai/cybersecurity/",
    body:
      "Led a 10-person team delivering a five-day intensive for IT professionals, sponsored by the Oklahoma Office of Homeland Security and FEMA. I designed the agenda, taught modules on ransomware, phishing, and network defense, and built the workshop site and CMS.",
    image: "/beta/cybersecurity-workshop.png",
  },
  {
    title: "INQUIRE Lab website",
    role: "Designer & Developer · inquirelab.ai",
    href: "https://inquirelab.ai/",
    body:
      "The lab's public home, built with Next.js — making research projects, publications, news, and people easy to find and share.",
    image: "/beta/research-hero.png",
  },
];

export const awards = [
  { name: "William H. Barkow Graduate Fellowship", org: "University of Oklahoma", year: "2025–26" },
  { name: "William H. Barkow Scholarship", org: "University of Oklahoma", year: "2025–26" },
  { name: "Journal Paper Award", org: "OU Electrical & Computer Engineering", year: "2025" },
  { name: "Robberson Travel Grant & GCoE Travel Award", org: "University of Oklahoma", year: "2025" },
];

export const extras = [
  {
    title: "U.S. patent application",
    body: "AI-Powered Personal Computer Management System and Methods — U.S. Nonprovisional Patent Application No. 19/378,506, filed November 2025.",
  },
  {
    title: "Peer review",
    body: "Ad hoc reviewer for IEEE Transactions on Artificial Intelligence (2026).",
  },
  {
    title: "Community",
    body: "Volunteer at OU's Big Event and Little Event; former engineering officer of the Game Developers' Association — where I once built an LLM-powered Ouija board for a Halloween escape room.",
  },
];

export const journey = {
  heading: "From Sanandaj to Norman",
  photoCaption: "Sanandaj, early 2000s — already going for the ultimate spin.",
  paragraphs: [
    "I grew up in Sanandaj, in the Kurdistan province of Iran. The kid in this photo spent his days on puzzles, video games, and taking things apart to see how they worked — mostly getting them back together.",
    "That curiosity carried me through a computer engineering degree at the University of Kurdistan, a published thesis on solving the Yin-Yang puzzle, and eventually across the world to Oklahoma, where I get to spend every day working on the most interesting puzzle I've found yet: language models.",
    "Outside the lab I like movies, video games, writing interactive stories, and long walks at night. My goal is simple — do work that matters, and make the people around me glad I'm in the room. :)",
  ],
};

export const stats = [
  { value: "7", label: "publications & preprints" },
  { value: "3", label: "journal articles" },
  { value: "1", label: "U.S. patent application" },
  { value: "2", label: "fellowships & awards in 2025–26" },
];
