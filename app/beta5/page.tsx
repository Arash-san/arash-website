import type { Metadata } from "next";
import Image from "next/image";
import { Nunito } from "next/font/google";
import {
  awards,
  identity,
  journey,
  links,
  news,
  publications,
  research,
} from "@/lib/profile-data";
import "./beta5.css";

const sans = Nunito({
  subsets: ["latin"],
  variable: "--b5-sans",
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Arash Ahmadi — Sunrise (beta 5)",
  description: "Theme exploration: soft morning optimism.",
  robots: { index: false, follow: false },
};

const researchEmoji = ["📱", "🧭", "✈️", "🔧"];

export default function Beta5() {
  return (
    <div className={`b5 ${sans.variable}`}>
      <nav className="b5-nav" aria-label="Main navigation">
        <div className="b5-nav-inner">
          <a className="b5-brand" href="/">
            arash<span>ahmadi</span>
          </a>
          <div className="b5-nav-links">
            <a href="#news">News</a>
            <a href="#research">Research</a>
            <a href="#publications">Papers</a>
            <a href="#journey">Journey</a>
          </div>
        </div>
      </nav>

      <header className="b5-hero b5-shell">
        <div className="b5-portrait">
          <Image src="/portrait.jpg" alt={identity.name} fill priority sizes="132px" />
        </div>
        <span className="b5-hello">👋 Hi, I&apos;m Arash!</span>
        <h1>
          Making AI that&apos;s <span>small, useful,</span> and good to people.
        </h1>
        <p className="b5-sub">{identity.intro}</p>
        <div className="b5-actions">
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
      </header>

      <main className="b5-shell">
        {/* News */}
        <section className="b5-section" id="news">
          <div className="b5-section-head">
            <span className="b5-emoji" aria-hidden="true">
              🌅
            </span>
            <h2>Good news, recently</h2>
            <p>A busy spring: a thesis defended, a paper published, and a club that became official.</p>
          </div>
          <div className="b5-news-list">
            {news.map((item) => (
              <a
                className="b5-news"
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div>
                  <p className="b5-news-when">
                    <time dateTime={item.date}>{item.dateLabel}</time>
                  </p>
                  <span className="b5-tag">{item.tag}</span>
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Research */}
        <section className="b5-section" id="research">
          <div className="b5-section-head">
            <span className="b5-emoji" aria-hidden="true">
              🔬
            </span>
            <h2>What I work on</h2>
          </div>
          <div className="b5-grid">
            {research.map((r, i) => (
              <article className="b5-card" key={r.title}>
                <span className="b5-card-dot" aria-hidden="true">
                  {researchEmoji[i]}
                </span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Publications */}
        <section className="b5-section" id="publications">
          <div className="b5-section-head">
            <span className="b5-emoji" aria-hidden="true">
              📄
            </span>
            <h2>Papers &amp; preprints</h2>
          </div>
          <div className="b5-pubwrap">
            {publications.map((p) => (
              <a
                className="b5-pub"
                key={p.title}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div>
                  <h3>{p.title}</h3>
                  <p className="b5-pub-meta">
                    {p.venue} · {p.year}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <span className={`b5-pub-badge --${p.type.toLowerCase()}`}>{p.type}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Journey */}
        <section className="b5-section" id="journey">
          <div className="b5-section-head">
            <span className="b5-emoji" aria-hidden="true">
              🧡
            </span>
            <h2>{journey.heading}</h2>
          </div>
          <div className="b5-journey">
            <figure className="b5-journey-photo">
              <div className="b5-photo-frame">
                <Image
                  src="/childhood.jpg"
                  alt="Arash as a child in Sanandaj, wearing a Spider-Man t-shirt"
                  fill
                  sizes="300px"
                />
              </div>
              <figcaption>{journey.photoCaption}</figcaption>
            </figure>
            <div className="b5-journey-copy">
              <h3>
                Same smile, <span>bigger puzzles</span>.
              </h3>
              {journey.paragraphs.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Awards */}
        <section className="b5-section" id="awards">
          <div className="b5-section-head">
            <span className="b5-emoji" aria-hidden="true">
              🏆
            </span>
            <h2>Honors along the way</h2>
          </div>
          <div className="b5-awards">
            {awards.map((a) => (
              <div className="b5-award" key={a.name}>
                <span>{a.year}</span>
                {a.name}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="b5-footer">
        <div className="b5-shell">
          <div className="b5-footer-card">
            <h2>Let&apos;s make something good together.</h2>
            <p className="b5-footer-sub">
              Research, collaboration, or just to say hi — my inbox is open.
            </p>
            <a className="b5-footer-cta" href={`mailto:${identity.email}`}>
              Say hello 👋
            </a>
            <p className="b5-colophon">
              {identity.name} · {identity.location}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
