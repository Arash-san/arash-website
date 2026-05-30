import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import "./beta.css";

export const metadata: Metadata = {
  title: "Arash Ahmadi | Research, Projects, and Updates",
  description:
    "A beta profile page for Arash Ahmadi, Ph.D. student at the University of Oklahoma working on LLMs, edge AI, aviation safety, and student-led AI communities.",
  alternates: {
    canonical: "/beta",
  },
  openGraph: {
    title: "Arash Ahmadi | Research, Projects, and Updates",
    description:
      "Research, publications, projects, teaching, leadership, and activity links from Arash Ahmadi.",
    url: "https://arash-ahmadi.com/beta",
    images: [
      {
        url: "/portrait.jpg",
        width: 800,
        height: 600,
        alt: "Arash Ahmadi",
      },
    ],
  },
};

const links = [
  { label: "CV", href: "/arash-ahmadi-cv.pdf", kind: "file" },
  { label: "Email", href: "mailto:arash.ahmadi@ou.edu" },
  { label: "Scholar", href: "https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" },
  { label: "GitHub", href: "https://github.com/arash-san" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/arash-ahmadi-619ab1352" },
  { label: "X", href: "https://x.com/user_arash" },
];

const research = [
  {
    title: "Small language models on edge devices",
    body:
      "I work on fine-tuning compact models so they can run in resource-constrained settings, especially when local reasoning and privacy matter.",
  },
  {
    title: "Reward optimization for LLM reasoning",
    body:
      "My master's thesis studies search-based reward function optimization for reinforcement learning, with an eye toward better reasoning behavior.",
  },
  {
    title: "AI for aviation safety",
    body:
      "I use LLMs and reinforcement learning to help analyze aviation incident narratives and support faster, more consistent HFACS classification.",
  },
  {
    title: "Tool-rich AI systems",
    body:
      "I build practical bridges between LLMs, tools, and local infrastructure, including MCP-style systems that make agent workflows easier to test.",
  },
];

const publications = [
  {
    type: "Journal",
    title:
      "Improving Aviation Safety Analysis: Automated HFACS Classification Using Reinforcement Learning with Group Relative Policy Optimization",
    meta: "Expert Systems with Applications, vol. 329, Article 132963, 2026",
    href: "https://doi.org/10.1016/j.eswa.2026.132963",
  },
  {
    type: "Journal",
    title: "A Comparative Study of Sampling Methods with Cross-Validation in the FedHome Framework",
    meta: "IEEE Transactions on Parallel and Distributed Systems, vol. 36, no. 3, pp. 570-579, 2025",
    href: "https://doi.org/10.1109/TPDS.2025.3526238",
  },
  {
    type: "Conference",
    title: "LLM-Powered HFACS Analysis of ASRS Narratives via MCP Bridge for Enhanced Aviation Safety Debriefs",
    meta: "AIAA SCITECH 2026 Forum, p. 1195, 2026",
    href: "https://doi.org/10.2514/6.2026-1195",
  },
  {
    type: "Conference",
    title: "Towards Transparent Artificial Intelligence: Exploring Modern Approaches and Future Directions",
    meta: "AIxSET 2024, pp. 248-251",
    href: "https://doi.org/10.1109/AIxSET62544.2024.00047",
  },
  {
    type: "Preprint",
    title: "Enhanced LLM Reasoning by Optimizing Reward Functions with Search-Driven Reinforcement Learning",
    meta: "arXiv:2605.02073, 2026",
    href: "https://doi.org/10.48550/arXiv.2605.02073",
  },
  {
    type: "Preprint",
    title: "MCP Bridge: A Lightweight, LLM-Agnostic RESTful Proxy for Model Context Protocol Servers",
    meta: "arXiv:2504.08999, 2025",
    href: "https://doi.org/10.48550/arXiv.2504.08999",
  },
  {
    type: "Journal",
    title: "Efficient Brute-Force State Space Search for Yin-Yang Puzzle",
    meta: "The Journal of Supercomputing, vol. 80, no. 3, pp. 3066-3088, 2024",
    href: "https://doi.org/10.1007/s11227-023-05565-w",
  },
];

const building = [
  {
    title: "Founder, LLM Engineering Club",
    eyebrow: "Registered OU student organization",
    href: "https://ou.campuslabs.com/engage/organization/llm-club",
    body:
      "I started the club so OU students can learn LLM engineering by doing: study groups, AI news discussions, responsible-use conversations, and hands-on workshops with local model training and evaluation.",
  },
  {
    title: "Instructor and Lead Developer, Cybersecurity Essentials Workshop",
    eyebrow: "University of Oklahoma - 2025 and 2026",
    href: "https://inquirelab.ai/cybersecurity/",
    body:
      "I led a 10-person team, designed the 2025 agenda and description, built the workshop website and CMS, and taught modules on ransomware, phishing, network design, firewalls, and emerging cyber threats.",
  },
  {
    title: "InquireLab research website",
    eyebrow: "Next.js, research communication",
    href: "https://inquirelab.ai/",
    body:
      "I designed and developed the lab's public website so research projects, publications, and team members are easier to find and share.",
  },
  {
    title: "AI-powered personal computer management system",
    eyebrow: "U.S. nonprovisional patent application",
    body:
      "Filed as U.S. Nonprovisional Patent Application No. 19/378,506 for an AI-driven personal computer management system and methods.",
  },
  {
    title: "Ad hoc reviewer",
    eyebrow: "IEEE Transactions on Artificial Intelligence, 2026",
    body:
      "I also contribute professional service through peer review for IEEE Transactions on Artificial Intelligence.",
  },
  {
    title: "OU community service",
    eyebrow: "The Big Event and The Little Event",
    body:
      "I stay involved in campus service through OU volunteer events, including The Big Event in 2026 and Little Event programming.",
  },
];

const updates = [
  {
    title: "Research notes and quick thoughts",
    channel: "X",
    action: "Open X",
    href: "https://x.com/user_arash",
    body:
      "Short posts on papers, tools, model behavior, and the odd thing I am experimenting with between research tasks.",
  },
  {
    title: "Professional updates",
    channel: "LinkedIn",
    action: "Open LinkedIn",
    href: "https://www.linkedin.com/in/arash-ahmadi-619ab1352",
    body:
      "Publication updates, workshop announcements, club milestones, and academic moments that are useful to share more formally.",
  },
  {
    title: "Club and workshop activity",
    channel: "OU and InquireLab",
    action: "Open page",
    href: "https://inquirelab.ai/llm-club",
    body:
      "A public trail for the LLM Engineering Club, cybersecurity workshops, and the student projects I am helping organize.",
  },
];

function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const isExternal = href.startsWith("http");
  const isFile = href.endsWith(".pdf");

  return (
    <a
      href={href}
      className={className}
      target={isExternal || isFile ? "_blank" : undefined}
      rel={isExternal || isFile ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

function SectionTitle({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="beta-section-title">
      <p>{label}</p>
      <h2>{title}</h2>
      {children ? <div className="beta-section-copy">{children}</div> : null}
    </div>
  );
}

export default function BetaPage() {
  return (
    <main className="beta-page">
      <header className="beta-header">
        <nav className="beta-shell beta-nav" aria-label="Beta page navigation">
          <a className="beta-brand" href="/">
            Arash Ahmadi
          </a>
          <div className="beta-nav-links">
            <a href="#research">Research</a>
            <a href="#work">Work</a>
            <a href="#updates">Updates</a>
          </div>
          <a className="beta-small-button" href="/arash-ahmadi-cv.pdf" target="_blank" rel="noopener noreferrer">
            CV
          </a>
        </nav>
      </header>

      <section className="beta-shell beta-hero">
        <div className="beta-hero-copy">
          <p className="beta-kicker">University of Oklahoma - InquireLab</p>
          <h1>Hi! I&apos;m Arash :)</h1>
          <p className="beta-lede">
            I&apos;m a Ph.D. student in electrical and computer engineering, working on LLMs that are useful
            outside the demo: small models for edge devices, reward optimization for reasoning, and AI tools
            for aviation safety. I like building things with people, then turning the useful parts into research.
          </p>
          <div className="beta-actions" aria-label="Profile links">
            {links.map((link) => (
              <SmartLink key={link.label} href={link.href} className="beta-button">
                {link.label}
              </SmartLink>
            ))}
          </div>
        </div>
        <div className="beta-portrait" aria-label="Portrait of Arash Ahmadi">
          <Image
            src="/portrait.jpg"
            alt="Arash Ahmadi"
            fill
            priority
            sizes="(max-width: 980px) 320px, 340px"
            className="beta-portrait-image"
          />
        </div>
      </section>

      <section className="beta-band" aria-label="Highlights">
        <div className="beta-shell beta-stats">
          <div>
            <strong>7</strong>
            <span>publications and preprints</span>
          </div>
          <div>
            <strong>3</strong>
            <span>journal papers</span>
          </div>
          <div>
            <strong>1</strong>
            <span>registered LLM student org founded</span>
          </div>
          <div>
            <strong>2026</strong>
            <span>workshops, club projects, and service</span>
          </div>
        </div>
      </section>

      <section className="beta-shell beta-section" id="research">
        <SectionTitle label="Research" title="The thread through most of my work is practical AI.">
          <p>
            I care about models that can run closer to the user, explain enough of what they are doing, and
            solve domain problems where reliability matters.
          </p>
        </SectionTitle>
        <div className="beta-focus-grid">
          {research.map((item) => (
            <article key={item.title} className="beta-focus-item">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="beta-paper-section beta-section" aria-labelledby="publications-title">
        <div className="beta-shell">
          <SectionTitle label="Selected work" title="Papers, preprints, and the problems behind them">
            <p>
              My publication list spans aviation safety, federated learning, interpretability, search, and
              LLM tooling. Preprints are marked as preprints; accepted and published items link to their DOI.
            </p>
          </SectionTitle>
          <div className="beta-publications" id="publications-title">
            {publications.map((paper) => (
              <SmartLink key={paper.title} href={paper.href} className="beta-publication">
                <span>{paper.type}</span>
                <div>
                  <h3>{paper.title}</h3>
                  <p>{paper.meta}</p>
                </div>
              </SmartLink>
            ))}
          </div>
        </div>
      </section>

      <section className="beta-shell beta-section" id="work">
        <SectionTitle label="Building with people" title="Research is better when it becomes a shared workspace.">
          <p>
            A lot of my work sits between research, teaching, websites, workshops, and student communities. I
            like making the infrastructure that lets other people jump in.
          </p>
        </SectionTitle>
        <div className="beta-work-list">
          {building.map((item) => {
            const content = (
              <>
                <div className="beta-work-heading">
                  <h3>{item.title}</h3>
                  <span>{item.eyebrow}</span>
                </div>
                <p>{item.body}</p>
              </>
            );

            return item.href ? (
              <SmartLink key={item.title} href={item.href} className="beta-work-item">
                {content}
              </SmartLink>
            ) : (
              <article key={item.title} className="beta-work-item">
                {content}
              </article>
            );
          })}
        </div>
      </section>

      <section className="beta-update-section beta-section" id="updates">
        <div className="beta-shell">
          <SectionTitle label="Notes & updates" title="Where I share what I am learning and building">
            <p>
              I use different channels for quick research notes, professional updates, club announcements,
              and workshop activity.
            </p>
          </SectionTitle>
          <div className="beta-update-grid">
            {updates.map((update) => (
              <SmartLink key={update.title} href={update.href} className="beta-update-card">
                <span>{update.channel}</span>
                <h3>{update.title}</h3>
                <p>{update.body}</p>
                <strong>{update.action}</strong>
              </SmartLink>
            ))}
          </div>
          <p className="beta-elsewhere">
            For the formal record, my CV stays at{" "}
            <a href="/arash-ahmadi-cv.pdf" target="_blank" rel="noopener noreferrer">
              arash-ahmadi-cv.pdf
            </a>
            . For day-to-day activity, the social links above are the best source.
          </p>
        </div>
      </section>

      <section className="beta-shell beta-section beta-personal">
        <SectionTitle label="A little more human" title="I like the playful side of engineering too.">
          <p>
            Before the current LLM club work, I was an engineering officer in OU&apos;s Game Developer&apos;s
            Association. One of my favorite projects was an LLM-powered Ouija board for a Halloween escape room:
            strange, funny, and a surprisingly good reminder that good tools need personality, timing, and
            constraints.
          </p>
        </SectionTitle>
      </section>

      <footer className="beta-footer">
        <div className="beta-shell">
          <p>
            Arash Ahmadi - Norman, Oklahoma -{" "}
            <a href="mailto:arash.ahmadi@ou.edu">arash.ahmadi@ou.edu</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
