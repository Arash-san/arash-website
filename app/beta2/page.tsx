import type { Metadata } from "next";
import Image from "next/image";
import { Space_Grotesk } from "next/font/google";
import {
  awards,
  identity,
  journey,
  links,
  news,
  publications,
  research,
} from "@/lib/profile-data";
import "./beta2.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--b2-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Arash Ahmadi — Aurora (beta 2)",
  description: "Theme exploration: calm night sky.",
  robots: { index: false, follow: false },
};

export default function Beta2() {
  return (
    <div className={`b2 ${sans.variable}`}>
      <nav className="b2-nav" aria-label="Main navigation">
        <div className="b2-nav-inner">
          <a className="b2-brand" href="/">
            arash<span>.ahmadi</span>
          </a>
          <div className="b2-nav-links">
            <a href="#news">News</a>
            <a href="#research">Research</a>
            <a href="#publications">Publications</a>
            <a href="#journey">Journey</a>
          </div>
        </div>
      </nav>

      <header className="b2-hero">
        <div className="b2-hero-bg" aria-hidden="true" />
        <div className="b2-hero-fade" aria-hidden="true" />
        <div className="b2-shell">
          <div className="b2-portrait">
            <Image src="/portrait.jpg" alt={identity.name} fill priority sizes="128px" />
          </div>
          <p className="b2-kicker">
            {identity.university} · {identity.lab}
          </p>
          <h1>
            Hi, I&apos;m Arash. <br />
            <span>{identity.tagline}</span>
          </h1>
          <p className="b2-sub">{identity.intro}</p>
          <div className="b2-actions">
            {links.map((l, i) => (
              <a
                key={l.label}
                className={i === 0 ? "b2-primary" : undefined}
                href={l.href}
                target={l.href.startsWith("http") || l.kind === "file" ? "_blank" : undefined}
                rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      <main className="b2-shell">
        {/* News */}
        <section className="b2-section" id="news">
          <div className="b2-section-head">
            <p>Signals</p>
            <h2>Recent news</h2>
          </div>
          <div className="b2-timeline">
            {news.map((item) => (
              <article className="b2-news" key={item.title}>
                <div className="b2-news-meta">
                  <time dateTime={item.date}>{item.dateLabel}</time>
                  <span className="b2-tag">{item.tag}</span>
                </div>
                <h3>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Research */}
        <section className="b2-section" id="research">
          <div className="b2-section-head">
            <p>Focus</p>
            <h2>What I work on</h2>
          </div>
          <div className="b2-grid">
            {research.map((r) => (
              <article className="b2-card" key={r.title}>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Publications */}
        <section className="b2-section" id="publications">
          <div className="b2-section-head">
            <p>Papers</p>
            <h2>Publications &amp; preprints</h2>
          </div>
          {publications.map((p) => (
            <a
              className="b2-pub"
              key={p.title}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={`b2-pub-type --${p.type.toLowerCase()}`}>{p.type}</span>
              <div>
                <h3>{p.title}</h3>
                <p>
                  {p.venue} · {p.year}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
            </a>
          ))}
        </section>

        {/* Journey */}
        <section className="b2-section" id="journey">
          <div className="b2-section-head">
            <p>Origins</p>
            <h2>{journey.heading}</h2>
          </div>
          <div className="b2-journey">
            <div>
              <div className="b2-journey-photo">
                <Image
                  src="/childhood.jpg"
                  alt="Arash as a child in Sanandaj, wearing a Spider-Man t-shirt"
                  fill
                  sizes="300px"
                />
              </div>
              <p className="b2-journey-caption">{journey.photoCaption}</p>
            </div>
            <div className="b2-journey-copy">
              <h3>Same curiosity, bigger puzzles.</h3>
              {journey.paragraphs.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Awards */}
        <section className="b2-section" id="awards">
          <div className="b2-section-head">
            <p>Recognition</p>
            <h2>Fellowships &amp; awards</h2>
          </div>
          <div className="b2-awards">
            {awards.map((a) => (
              <div className="b2-award" key={a.name}>
                <span>
                  {a.name} · {a.org}
                </span>
                <span>{a.year}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="b2-footer">
        <div className="b2-shell">
          <p className="b2-footer-line">
            The night sky is big. <span>So is what we can build.</span>
          </p>
          <p>
            {identity.name} · {identity.location} ·{" "}
            <a href={`mailto:${identity.email}`}>{identity.email}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
