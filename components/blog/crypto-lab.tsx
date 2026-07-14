"use client";

import { useState } from "react";

const views = {
  puzzle: {
    title: "What the puzzle contributes",
    text: "The public clues identify the instance. The private solution acts as a witness. A salted commitment binds that witness to the key record.",
    footer: "Useful for identity and proof of knowledge research",
  },
  crypto: {
    title: "What protects the message today",
    text: "X25519 creates the shared secret. HKDF derives the key. AES 256 GCM encrypts and authenticates the message.",
    footer: "The puzzle is not the trapdoor yet",
  },
} as const;

export function CryptoLab() {
  const [view, setView] = useState<keyof typeof views>("puzzle");
  const active = views[view];
  return (
    <figure className="blog-lab crypto-lab" aria-labelledby="crypto-title">
      <div className="blog-lab-heading">
        <div>
          <p className="blog-kicker">Hybrid prototype</p>
          <h3 id="crypto-title">Two jobs that should not be confused</h3>
        </div>
        <div className="blog-view-switch" aria-label="Encryption explanation">
          <button type="button" aria-pressed={view === "puzzle"} onClick={() => setView("puzzle")}>Puzzle</button>
          <button type="button" aria-pressed={view === "crypto"} onClick={() => setView("crypto")}>Encryption</button>
        </div>
      </div>
      <div className="crypto-readout" aria-live="polite">
        <span aria-hidden="true">{view === "puzzle" ? "01 / 10" : "•• / 🔒"}</span>
        <div>
          <h4>{active.title}</h4>
          <p>{active.text}</p>
          <strong>{active.footer}</strong>
        </div>
      </div>
    </figure>
  );
}
