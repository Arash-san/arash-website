import type { Metadata } from "next";
import Image from "next/image";
import { Archivo } from "next/font/google";
import {
  awards,
  education,
  identity,
  journey,
  links,
  news,
  publications,
  research,
} from "@/lib/profile-data";
import "./beta4.css";

const sans = Archivo({
  subsets: ["latin"],
  variable: "--b4-sans",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Arash Ahmadi — Swiss Grid (beta 4)",
  description: "Theme exploration: structural typographic grid.",
  robots: { index: false, follow: false },
};

export default function Beta4() {
  return (
    <div className={`b4 ${sans.variable}`}>
      <div className="b4-frame">
        <header className="b4-header">
          <a className="b4-name" href="/">
            Arash Ahmadi
          </a>
          <nav aria-label="Sections">
            <a href="#news">News</a>
            <a href="#research">Research</a>
            <a href="#publications">Publications</a>
            <a href="#journey">Journey</a>
            <a href="#vitae">Vitae</a>
          </nav>
        </header>

        {/* Hero */}
        <section className="b4-hero">
          <div className="b4-hero-copy">
            <div>
              <span className="b4-mono">
                Ph.D. student — ECE · {identity.university} · {identity.lab}
              </span>
              <h1>
                Small models.
                <br />
                Real devices.
                <br />
                <span className="b4-accent">Honest AI.</span>
              </h1>
            </div>
            <p className="b4-hero-sub">{identity.intro}</p>
          </div>
          <div className="b4-hero-media">
            <Image src="/portrait.jpg" alt={identity.name} fill priority sizes="(max-width: 820px) 100vw, 570px" />
            <span className="b4-mono b4-media-label">Norman, Oklahoma — 2026</span>
          </div>
        </section>

        {/* Link bar */}
        <div className="b4-linkbar">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.href.startsWith("http") || l.kind === "file" ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* News */}
        <section className="b4-section" id="news">
          <div className="b4-section-head">
            <span className="b4-mono">01 — News</span>
            <h2>Recent updates</h2>
          </div>
          {news.map((item) => (
            <a
              className="b4-news-row"
              key={item.title}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="b4-mono">
                <time dateTime={item.date}>{item.dateLabel}</time>
              </span>
              <span className="b4-mono b4-tag">{item.tag}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </a>
          ))}
        </section>

        {/* Research */}
        <section className="b4-section" id="research">
          <div className="b4-section-head">
            <span className="b4-mono">02 — Research</span>
            <h2>What I work on</h2>
          </div>
          <div className="b4-research">
            {research.map((r, i) => (
              <div key={r.title}>
                <span className="b4-mono b4-idx">{String(i + 1).padStart(2, "0")}</span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Publications */}
        <section className="b4-section" id="publications">
          <div className="b4-section-head">
            <span className="b4-mono">03 — Papers</span>
            <h2>Publications &amp; preprints</h2>
          </div>
          {publications.map((p) => (
            <a
              className="b4-pub"
              key={p.title}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="b4-mono">{p.type}</span>
              <h3>
                {p.title}
                <span className="b4-venue">
                  {p.venue}
                  {p.note ? ` — ${p.note}` : ""}
                </span>
              </h3>
              <span className="b4-mono b4-yr">{p.year}</span>
            </a>
          ))}
        </section>

        {/* Journey */}
        <section className="b4-section" id="journey">
          <div className="b4-section-head">
            <span className="b4-mono">04 — Journey</span>
            <h2>{journey.heading}</h2>
          </div>
          <div className="b4-journey">
            <div className="b4-journey-media">
              <Image
                src="/childhood.jpg"
                alt="Arash as a child in Sanandaj, wearing a Spider-Man t-shirt"
                fill
                sizes="(max-width: 820px) 100vw, 460px"
              />
              <span className="b4-mono b4-media-label">{journey.photoCaption}</span>
            </div>
            <div className="b4-journey-copy">
              {journey.paragraphs.map((p, i) => (
                <p key={p.slice(0, 24)}>{i === 0 ? <strong>{p}</strong> : p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Vitae */}
        <section className="b4-section" id="vitae">
          <div className="b4-section-head">
            <span className="b4-mono">05 — Vitae</span>
            <h2>Education &amp; honors</h2>
          </div>
          <div className="b4-vitae">
            <div>
              <h3>Education</h3>
              <ul>
                {education.map((e) => (
                  <li key={e.degree}>
                    <span>
                      {e.degree}
                      <em>{e.school}</em>
                    </span>
                    <span className="b4-mono">{e.period}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Honors</h3>
              <ul>
                {awards.map((a) => (
                  <li key={a.name}>
                    <span>
                      {a.name}
                      <em>{a.org}</em>
                    </span>
                    <span className="b4-mono">{a.year}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <footer className="b4-footer">
          <p className="b4-big">
            Let&apos;s build something useful.{" "}
            <a href={`mailto:${identity.email}`}>{identity.email}</a>
          </p>
          <span className="b4-mono">
            {identity.name} — {identity.location}
          </span>
        </footer>
      </div>
    </div>
  );
}
