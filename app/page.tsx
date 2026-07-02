import Image from "next/image";
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
import "./home.css";

export default function Home() {
  return (
    <div className="site">
      <div className="wrap">
        <header className="top">
          <a className="name" href="/">
            Arash Ahmadi
          </a>
          <nav aria-label="Sections">
            <a href="#news">news</a>
            <a href="#research">research</a>
            <a href="#publications">publications</a>
            <a href="#about">about</a>
          </nav>
        </header>

        {/* Hero */}
        <section className="hero">
          <div className="avatar">
            <Image
              src="/portrait.jpg"
              alt="Arash Ahmadi — Ph.D. student in Electrical and Computer Engineering at the University of Oklahoma"
              fill
              priority
              sizes="64px"
            />
          </div>
          <h1>Hi! I&apos;m Arash :)</h1>
          <p className="lede">
            I&apos;m a Ph.D. student in electrical and computer engineering at the{" "}
            <a href="https://www.ou.edu/" target="_blank" rel="noopener noreferrer">
              University of Oklahoma
            </a>
            , working at{" "}
            <a href={identity.labUrl} target="_blank" rel="noopener noreferrer">
              INQUIRE Lab
            </a>
            . I fine-tune small language models to run on resource-constrained edge devices, and I
            put them to work in agentic systems, aviation safety, and health monitoring. I like
            building things with people — clubs, workshops, websites — and turning the useful parts
            into research.
          </p>
          <div className="links" aria-label="Profile links">
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
        </section>

        {/* News */}
        <section className="section" id="news">
          <span className="mono label">News</span>
          {news.map((item) => (
            <a
              className="news-row"
              key={item.title}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <time dateTime={item.date}>
                {new Date(item.date).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </time>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </a>
          ))}
        </section>

        {/* Research */}
        <section className="section" id="research">
          <span className="mono label">Research</span>
          <div className="research-list">
            {research.map((r) => (
              <div key={r.title}>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Publications */}
        <section className="section" id="publications">
          <span className="mono label">Publications</span>
          {publications.map((p) => (
            <a
              className="pub-row"
              key={p.title}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <h3>{p.title}</h3>
              <p className="meta">
                <span className="tag">{p.type}</span>
                {p.venue}, {p.year}
                {p.note ? ` — ${p.note}` : ""}
              </p>
            </a>
          ))}
        </section>

        {/* Building */}
        <section className="section" id="building">
          <span className="mono label">Building</span>
          {featured.map((f) => (
            <div className="build-item" key={f.title}>
              <h3>
                <a href={f.href} target="_blank" rel="noopener noreferrer">
                  {f.title}
                </a>
              </h3>
              <p className="role">{f.role}</p>
              <p className="body">{f.body}</p>
            </div>
          ))}
        </section>

        {/* About */}
        <section className="section" id="about">
          <span className="mono label">About me</span>
          <div className="about">
            <figure>
              <div className="sticker">
                <Image
                  src="/childhood-sticker.webp"
                  alt="Sticker illustration of Arash as a child in Sanandaj, wearing a Spider-Man t-shirt and holding a Tweety plush"
                  fill
                  sizes="200px"
                />
              </div>
              <figcaption>{journey.photoCaption}</figcaption>
            </figure>
            <div className="copy">
              {journey.paragraphs.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Education & honors */}
        <section className="section" id="vitae">
          <span className="mono label">Vitae</span>
          <div className="vitae">
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

        <footer className="footer">
          <span>
            {identity.name} · {identity.location}
          </span>
          <a href={`mailto:${identity.email}`}>{identity.email}</a>
        </footer>
      </div>
    </div>
  );
}
