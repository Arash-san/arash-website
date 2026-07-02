import type { Metadata } from "next";
import Image from "next/image";
import { Fraunces, Source_Serif_4 } from "next/font/google";
import {
  awards,
  education,
  extras,
  featured,
  identity,
  journey,
  links,
  news,
  publications,
  research,
} from "@/lib/profile-data";
import "./beta1.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--b1-display",
  style: ["normal", "italic"],
  weight: ["400", "600"],
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--b1-serif",
  style: ["normal", "italic"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Arash Ahmadi — Ink & Paper (beta 1)",
  description: "Theme exploration: editorial academic print.",
  robots: { index: false, follow: false },
};

const pubKeys = ["J1", "C1", "P1", "J2", "P2", "C2", "J3"];

export default function Beta1() {
  return (
    <div className={`b1 ${display.variable} ${serif.variable}`}>
      <header className="b1-shell b1-masthead">
        <a className="b1-wordmark" href="/">
          {identity.name}
        </a>
        <p>
          {identity.role} · {identity.university}
        </p>
      </header>

      <nav className="b1-nav" aria-label="Sections">
        <a href="#news">News</a>
        <a href="#research">Research</a>
        <a href="#publications">Publications</a>
        <a href="#teaching">Teaching</a>
        <a href="#journey">Journey</a>
        <a href="#vitae">Vitae</a>
      </nav>

      <main className="b1-shell">
        {/* Hero */}
        <section className="b1-hero">
          <div className="b1-hero-portrait">
            <Image src="/portrait.jpg" alt={identity.name} fill priority sizes="180px" />
          </div>
          <div>
            <h1>
              Hi, I&apos;m Arash — I teach <em>small</em> language models to do{" "}
              <em>big</em> things.
            </h1>
            <p className="b1-lede">{identity.intro}</p>
            <p className="b1-affil">
              Graduate researcher at{" "}
              <a href={identity.labUrl} target="_blank" rel="noopener noreferrer">
                {identity.lab}
              </a>
              , {identity.location}.
            </p>
            <div className="b1-links">
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
          </div>
        </section>

        {/* News */}
        <section className="b1-section" id="news">
          <div className="b1-section-head">
            <span className="b1-no">§ 01</span>
            <h2>Recent news</h2>
          </div>
          {news.map((item) => (
            <article className="b1-news-item" key={item.title}>
              <div className="b1-news-date">
                <time dateTime={item.date}>{item.dateLabel}</time>
                <span className="b1-news-tag">{item.tag}</span>
              </div>
              <div>
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
              </div>
            </article>
          ))}
        </section>

        {/* Research */}
        <section className="b1-section" id="research">
          <div className="b1-section-head">
            <span className="b1-no">§ 02</span>
            <h2>What I work on</h2>
          </div>
          <div className="b1-research">
            {research.map((r) => (
              <div key={r.title}>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Publications */}
        <section className="b1-section" id="publications">
          <div className="b1-section-head">
            <span className="b1-no">§ 03</span>
            <h2>Publications</h2>
          </div>
          {publications.map((p, i) => (
            <a
              className="b1-pub"
              key={p.title}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="b1-pub-key">[{pubKeys[i]}]</span>
              <h3>{p.title}</h3>
              <p>
                {p.venue}, {p.year}.
                {p.note ? <span className="b1-pub-note"> — {p.note}</span> : null}
              </p>
            </a>
          ))}
        </section>

        {/* Teaching & community */}
        <section className="b1-section" id="teaching">
          <div className="b1-section-head">
            <span className="b1-no">§ 04</span>
            <h2>Teaching &amp; building</h2>
          </div>
          <div className="b1-featured">
            {featured.map((f) => (
              <article key={f.title}>
                <h3>
                  <a href={f.href} target="_blank" rel="noopener noreferrer">
                    {f.title}
                  </a>
                </h3>
                <p className="b1-role">{f.role}</p>
                <p>{f.body}</p>
              </article>
            ))}
            {extras.map((e) => (
              <article key={e.title}>
                <h3>{e.title}</h3>
                <p>{e.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Journey */}
        <section className="b1-section" id="journey">
          <div className="b1-section-head">
            <span className="b1-no">§ 05</span>
            <h2>{journey.heading}</h2>
          </div>
          <div className="b1-journey">
            <figure className="b1-figure">
              <div className="b1-figure-frame">
                <Image
                  src="/childhood.jpg"
                  alt="Arash as a child in Sanandaj, wearing a Spider-Man t-shirt"
                  fill
                  sizes="240px"
                />
              </div>
              <figcaption>
                <strong>Fig. 1.</strong> {journey.photoCaption}
              </figcaption>
            </figure>
            <div className="b1-journey-copy">
              {journey.paragraphs.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Vitae: education + awards */}
        <section className="b1-section" id="vitae">
          <div className="b1-section-head">
            <span className="b1-no">§ 06</span>
            <h2>Education &amp; honors</h2>
          </div>
          <ul className="b1-list">
            {education.map((e) => (
              <li key={e.degree}>
                <span>
                  <strong>{e.degree}</strong>, {e.school}
                  <span className="b1-edu-detail">{e.detail}</span>
                </span>
                <span className="b1-yr">{e.period}</span>
              </li>
            ))}
          </ul>
          <div style={{ height: "1.25rem" }} />
          <ul className="b1-list">
            {awards.map((a) => (
              <li key={a.name}>
                <span>
                  {a.name} — {a.org}
                </span>
                <span className="b1-yr">{a.year}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="b1-footer">
        <div className="b1-shell">
          <p className="b1-fin">Thanks for reading — come say hi.</p>
          <p>
            {identity.name} · {identity.location} ·{" "}
            <a href={`mailto:${identity.email}`}>{identity.email}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
