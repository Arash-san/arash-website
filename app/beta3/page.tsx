import type { Metadata } from "next";
import Image from "next/image";
import { Fraunces, Inter } from "next/font/google";
import {
  awards,
  education,
  featured,
  identity,
  journey,
  links,
  news,
  publications,
  research,
} from "@/lib/profile-data";
import "./beta3.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--b3-display",
  style: ["normal", "italic"],
  weight: ["400", "600"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--b3-sans",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Arash Ahmadi — Woven Roots (beta 3)",
  description: "Theme exploration: kilim warmth, modern layout.",
  robots: { index: false, follow: false },
};

function Motif() {
  const diamond = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="7" y="0.5" width="9" height="9" transform="rotate(45 7 0.5)" stroke="currentColor" strokeWidth="1.6" />
      <rect x="7" y="4.75" width="3" height="3" transform="rotate(45 7 4.75)" fill="currentColor" />
    </svg>
  );
  return (
    <div className="b3-motif" aria-hidden="true">
      {diamond}
      {diamond}
      {diamond}
    </div>
  );
}

export default function Beta3() {
  return (
    <div className={`b3 ${display.variable} ${sans.variable}`}>
      <div className="b3-band" aria-hidden="true" />

      <nav className="b3-nav" aria-label="Main navigation">
        <div className="b3-nav-inner">
          <a className="b3-brand" href="/">
            Arash <em>Ahmadi</em>
          </a>
          <div className="b3-nav-links">
            <a href="#news">News</a>
            <a href="#research">Research</a>
            <a href="#publications">Publications</a>
            <a href="#journey">Journey</a>
            <a href="#building">Building</a>
          </div>
        </div>
      </nav>

      <main className="b3-shell">
        {/* Hero */}
        <header className="b3-hero">
          <div className="b3-hero-copy">
            <p className="b3-kicker">
              {identity.university} · {identity.lab}
            </p>
            <h1>
              Hi, I&apos;m Arash. I make small language models do <em>honest work</em>.
            </h1>
            <p className="b3-lede">{identity.intro}</p>
            <div className="b3-links">
              {links.map((l, i) => (
                <a
                  key={l.label}
                  className={i === 0 ? "--primary" : undefined}
                  href={l.href}
                  target={l.href.startsWith("http") || l.kind === "file" ? "_blank" : undefined}
                  rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="b3-hero-portrait">
            <div className="b3-frame">
              <Image src="/portrait.jpg" alt={identity.name} fill priority sizes="320px" />
            </div>
          </div>
        </header>

        <Motif />

        {/* News */}
        <section className="b3-section" id="news">
          <div className="b3-section-head">
            <p className="b3-label">Fresh from the loom</p>
            <h2>Recent news</h2>
          </div>
          <div className="b3-news-grid">
            {news.map((item, i) => (
              <a
                className={`b3-news${i === 0 ? " --wide" : ""}`}
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="b3-news-meta">
                  <span className="b3-tag">{item.tag}</span>
                  <time dateTime={item.date}>{item.dateLabel}</time>
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Research */}
        <section className="b3-section" id="research">
          <div className="b3-section-head">
            <p className="b3-label">Threads I follow</p>
            <h2>What I work on</h2>
          </div>
          <div className="b3-research">
            {research.map((r) => (
              <div key={r.title}>
                <span className="b3-diamond" aria-hidden="true" />
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Publications */}
        <section className="b3-section" id="publications">
          <div className="b3-section-head">
            <p className="b3-label">On the record</p>
            <h2>Publications &amp; preprints</h2>
          </div>
          <div className="b3-pub-legend" aria-hidden="true">
            <span className="--lg-journal">Journal</span>
            <span className="--lg-conference">Conference</span>
            <span className="--lg-preprint">Preprint</span>
          </div>
          {publications.map((p) => (
            <a
              className={`b3-pub --${p.type.toLowerCase()}`}
              key={p.title}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div>
                <h3>{p.title}</h3>
                <p className="b3-pub-meta">
                  {p.venue}
                  {p.note ? ` — ${p.note}` : ""}
                </p>
              </div>
              <span className="b3-pub-year">{p.year}</span>
            </a>
          ))}
        </section>

        <Motif />

        {/* Journey */}
        <section className="b3-section" id="journey">
          <div className="b3-section-head">
            <p className="b3-label">Where the thread starts</p>
            <h2>{journey.heading}</h2>
          </div>
          <div className="b3-journey">
            <figure className="b3-journey-photo">
              <div className="b3-frame">
                <Image
                  src="/childhood.jpg"
                  alt="Arash as a child in Sanandaj, wearing a Spider-Man t-shirt"
                  fill
                  sizes="320px"
                />
              </div>
              <figcaption>{journey.photoCaption}</figcaption>
            </figure>
            <div className="b3-journey-copy">
              <h3>
                Same kid, <em>bigger puzzles</em>.
              </h3>
              {journey.paragraphs.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Building */}
        <section className="b3-section" id="building">
          <div className="b3-section-head">
            <p className="b3-label">Made with people</p>
            <h2>Things I&apos;m building</h2>
          </div>
          <div className="b3-featured-grid">
            {featured.map((f) => (
              <a
                className="b3-featured"
                key={f.title}
                href={f.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="b3-featured-img">
                  <Image src={f.image} alt={f.title} fill sizes="(max-width: 860px) 100vw, 330px" />
                </div>
                <div className="b3-featured-body">
                  <p className="b3-role">{f.role}</p>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Vitae */}
        <section className="b3-section" id="vitae">
          <div className="b3-vitae">
            <div>
              <h3>Education</h3>
              <ul>
                {education.map((e) => (
                  <li key={e.degree}>
                    <strong>{e.degree}</strong>
                    <span>
                      {e.school} · {e.period}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Honors</h3>
              <ul>
                {awards.map((a) => (
                  <li key={a.name}>
                    <strong>{a.name}</strong>
                    <span>
                      {a.org} · {a.year}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="b3-footer">
        <div className="b3-shell b3-footer-inner">
          <p className="b3-footer-line">
            Every rug starts with a <em>single knot</em>.
          </p>
          <p>
            {identity.name} · {identity.location} ·{" "}
            <a href={`mailto:${identity.email}`}>{identity.email}</a>
          </p>
        </div>
      </footer>

      <div className="b3-band" aria-hidden="true" />
    </div>
  );
}
