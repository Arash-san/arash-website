"use client";

import { useEffect, useMemo, useState } from "react";
import { CryptoBoard } from "@/components/blog/crypto-board";
import {
  canonicalSquare,
  makeSolution,
  sha256Bytes,
  sha256Hex,
  transformSquare,
} from "@/lib/yinyang-crypto";

const protocolSteps = [
  { name: "KeyGen", actor: "Recipient", text: "Create an agreement key pair, a public puzzle, a private solution, and a salted commitment.", artifact: "public package + private package" },
  { name: "Encaps", actor: "Sender", text: "Create one ephemeral agreement key and combine it with the recipient public key.", artifact: "ephemeral public key + shared secret" },
  { name: "KDF", actor: "Sender", text: "Use HKDF with the puzzle identifier as salt and a protocol label as context.", artifact: "256 bit content key" },
  { name: "AEAD", actor: "Sender", text: "Encrypt the text with AES 256 GCM. Authenticate the complete public package fingerprint.", artifact: "ciphertext + nonce + tag" },
  { name: "Verify", actor: "Recipient", text: "Check the private solution, every public clue, both puzzle rules, and the salted commitment.", artifact: "accepted witness" },
  { name: "Decaps", actor: "Recipient", text: "Recreate the shared secret, derive the same content key, and authenticate the envelope.", artifact: "recovered plaintext" },
] as const;

export function ProtocolFlowLab() {
  const [step, setStep] = useState(0);
  const active = protocolSteps[step];
  return (
    <figure className="crypto-lab-wide" aria-labelledby="protocol-flow-title">
      <div className="crypto-lab-heading">
        <div><p className="blog-kicker">Protocol map</p><h3 id="protocol-flow-title">Six operations, two actors, one shared key</h3></div>
        <span>{String(step + 1).padStart(2, "0")} / 06</span>
      </div>
      <div className="protocol-stepper" role="tablist" aria-label="Protocol steps">
        {protocolSteps.map((item, index) => (
          <button key={item.name} type="button" role="tab" aria-selected={step === index} onClick={() => setStep(index)}>
            <span>{index + 1}</span>{item.name}
          </button>
        ))}
      </div>
      <div className="protocol-stage" aria-live="polite">
        <div><span>Actor</span><strong>{active.actor}</strong></div>
        <div><span>Operation</span><p>{active.text}</p></div>
        <div><span>Output</span><code>{active.artifact}</code></div>
      </div>
      <figcaption>Select each operation to follow the complete encryption and decryption transcript.</figcaption>
    </figure>
  );
}

const anatomy = {
  public: {
    title: "Public package",
    intro: "A sender needs this package and nothing from the private side.",
    fields: [
      ["puzzle", "Rows, columns, and public clues"],
      ["puzzleId", "SHA 256 identifier of the encoded puzzle"],
      ["commitment", "Binding value for the hidden solution"],
      ["agreement key", "X25519 or P 256 public material"],
    ],
  },
  private: {
    title: "Private package",
    intro: "The recipient keeps this package secret and validates it before decryption.",
    fields: [
      ["solution", "Complete black and white witness"],
      ["commitment salt", "Random value that prevents reusable hashes"],
      ["agreement key", "Private agreement material"],
      ["policy", "Local handling and deletion rules"],
    ],
  },
  envelope: {
    title: "Cipher envelope",
    intro: "This package can travel through an untrusted channel.",
    fields: [
      ["ephemeral key", "One sender public key for this message"],
      ["nonce", "Unique 96 bit AES GCM nonce"],
      ["ciphertext", "Encrypted text and authentication tag"],
      ["fingerprint", "Authenticated reference to the public package"],
    ],
  },
} as const;

export function KeyAnatomyLab() {
  const [view, setView] = useState<keyof typeof anatomy>("public");
  const active = anatomy[view];
  return (
    <figure className="crypto-lab-wide key-anatomy" aria-labelledby="key-anatomy-title">
      <div className="crypto-lab-heading">
        <div><p className="blog-kicker">Key anatomy</p><h3 id="key-anatomy-title">Do not call every file a key</h3></div>
        <div className="crypto-panel-tabs">
          {(Object.keys(anatomy) as Array<keyof typeof anatomy>).map((name) => (
            <button type="button" key={name} aria-pressed={view === name} onClick={() => setView(name)}>{name}</button>
          ))}
        </div>
      </div>
      <div className="key-anatomy-grid">
        <div><span>{view === "public" ? "P" : view === "private" ? "S" : "C"}</span><h4>{active.title}</h4><p>{active.intro}</p></div>
        <div>{active.fields.map(([name, text], index) => <div key={name}><span>{String(index + 1).padStart(2, "0")}</span><strong>{name}</strong><p>{text}</p></div>)}</div>
      </div>
    </figure>
  );
}

const transformNames = ["Original", "Rotate 90", "Rotate 180", "Rotate 270", "Mirror X", "Mirror Y", "Main diagonal", "Other diagonal"];

export function CanonicalIdentityLab() {
  const source = useMemo(() => makeSolution(6), []);
  const [operation, setOperation] = useState(0);
  const [rawId, setRawId] = useState("");
  const [canonicalId, setCanonicalId] = useState("");
  const board = useMemo(() => transformSquare(source, operation), [source, operation]);
  useEffect(() => {
    void Promise.all([sha256Hex(board.join("")), sha256Hex(canonicalSquare(board))]).then(([raw, canonical]) => {
      setRawId(raw);
      setCanonicalId(canonical);
    });
  }, [board]);
  return (
    <figure className="crypto-lab-wide" aria-labelledby="canonical-title">
      <div className="crypto-lab-heading"><div><p className="blog-kicker">Canonical identity</p><h3 id="canonical-title">Eight pictures can describe one public puzzle</h3></div></div>
      <div className="canonical-grid">
        <CryptoBoard rows={board} label={`${transformNames[operation]} form of the same six by six solution`} />
        <div>
          <label htmlFor="transform-select">Displayed form</label>
          <select id="transform-select" value={operation} onChange={(event) => setOperation(Number(event.target.value))}>
            {transformNames.map((name, index) => <option value={index} key={name}>{name}</option>)}
          </select>
          <div className="hash-readout"><span>Raw board hash</span><code>{rawId.slice(0, 24)}…</code></div>
          <div className="hash-readout is-stable"><span>Canonical puzzle ID</span><code>{canonicalId.slice(0, 24)}…</code></div>
          <p>The raw hash changes with the drawing. The canonical identifier remains the same.</p>
        </div>
      </div>
    </figure>
  );
}

function byteBits(bytes: Uint8Array) {
  return Array.from(bytes).flatMap((byte) => Array.from({ length: 8 }, (_, bit) => (byte >> (7 - bit)) & 1));
}

export function CommitmentAvalancheLab() {
  const source = useMemo(() => makeSolution(8), []);
  const [cell, setCell] = useState(27);
  const [baseBits, setBaseBits] = useState<number[]>([]);
  const [changedBits, setChangedBits] = useState<number[]>([]);
  const changed = useMemo(() => source.map((row, rowIndex) => Array.from(row, (value, colIndex) => {
    const index = rowIndex * row.length + colIndex;
    return index === cell ? (value === "1" ? "0" : "1") : value;
  }).join("")), [source, cell]);
  useEffect(() => {
    void Promise.all([
      sha256Bytes(`witness:${source.join("")}`),
      sha256Bytes(`witness:${changed.join("")}`),
    ]).then(([base, next]) => { setBaseBits(byteBits(base)); setChangedBits(byteBits(next)); });
  }, [source, changed]);
  const distance = baseBits.reduce((total, bit, index) => total + Number(bit !== changedBits[index]), 0);
  return (
    <figure className="crypto-lab-wide" aria-labelledby="avalanche-title">
      <div className="crypto-lab-heading"><div><p className="blog-kicker">Commitment experiment</p><h3 id="avalanche-title">Change one cell, then watch the digest move</h3></div><strong className="avalanche-score">{distance} / 256 bits changed</strong></div>
      <div className="avalanche-layout">
        <div className="avalanche-board" style={{ gridTemplateColumns: "repeat(8, 1fr)" }}>
          {source.flatMap((row, rowIndex) => Array.from(row, (value, colIndex) => {
            const index = rowIndex * 8 + colIndex;
            return <button type="button" key={index} aria-label={`Change cell ${index + 1}`} data-active={cell === index} className={value === "1" ? "is-black" : "is-white"} onClick={() => setCell(index)} />;
          }))}
        </div>
        <div>
          <div className="digest-bits" aria-label="SHA 256 bit differences">{baseBits.map((bit, index) => <span key={index} data-different={bit !== changedBits[index]} />)}</div>
          <p>Red positions changed after one witness cell changed. This is a hash property. It does not prove that solving the puzzle is hard.</p>
        </div>
      </div>
    </figure>
  );
}

export function SecurityBudgetLab() {
  const [size, setSize] = useState(20);
  const [cluePercent, setCluePercent] = useState(60);
  const cells = size * size;
  const unknown = Math.round(cells * (1 - cluePercent / 100));
  const orbitAdjustment = size === Math.floor(size) ? 4 : 3;
  const rawExponent = Math.max(0, unknown - orbitAdjustment);
  const visualWidth = Math.min(100, rawExponent / 2.56);
  return (
    <figure className="crypto-lab-wide" aria-labelledby="budget-title">
      <div className="crypto-lab-heading"><div><p className="blog-kicker">Security parameter</p><h3 id="budget-title">Board width is not a bit count</h3></div></div>
      <div className="security-controls">
        <label>Board side <strong>{size}</strong><input type="range" min="8" max="40" step="1" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
        <label>Public clues <strong>{cluePercent}%</strong><input type="range" min="10" max="90" step="1" value={cluePercent} onChange={(event) => setCluePercent(Number(event.target.value))} /></label>
      </div>
      <div className="security-budget-grid">
        <div><span>cells</span><strong>{cells.toLocaleString()}</strong></div>
        <div><span>unknown cells</span><strong>{unknown.toLocaleString()}</strong></div>
        <div><span>raw exponent after symmetry</span><strong>2<sup>{rawExponent}</sup></strong></div>
      </div>
      <div className="security-scale"><span style={{ width: `${visualWidth}%` }} /><i style={{ left: "50%" }}>128</i><i style={{ left: "75%" }}>192</i><i style={{ left: "100%" }}>256</i></div>
      <p className="security-warning">This is only a count of unconstrained assignments. Puzzle rules, clues, instance structure, and attack algorithms can reduce the real work. A security claim needs measured attack cost and a defined instance generator.</p>
    </figure>
  );
}

const threats = {
  passive: { title: "Passive observer", sees: "Public puzzle, public agreement key, ephemeral key, nonce, and ciphertext", result: "Standard agreement, HKDF, and AES GCM protect message confidentiality." },
  solver: { title: "Fast puzzle solver", sees: "Everything public and a method that recovers the puzzle witness", result: "The witness role fails, but the current hybrid message still requires the private agreement key." },
  tamper: { title: "Envelope modifier", sees: "An opportunity to change the ciphertext, nonce, public fingerprint, or ephemeral key", result: "AES GCM authentication or the package fingerprint rejects the modified transcript." },
  stolen: { title: "Stolen private package", sees: "The witness, commitment salt, and private agreement key", result: "The attacker can decrypt matching envelopes. Key rotation and secure storage remain mandatory." },
} as const;

export function ThreatModelLab() {
  const [threat, setThreat] = useState<keyof typeof threats>("passive");
  const active = threats[threat];
  return (
    <figure className="crypto-lab-wide" aria-labelledby="threat-title">
      <div className="crypto-lab-heading"><div><p className="blog-kicker">Threat model</p><h3 id="threat-title">Choose the attacker before judging the protocol</h3></div></div>
      <div className="threat-grid">
        <div>{(Object.keys(threats) as Array<keyof typeof threats>).map((name) => <button type="button" key={name} aria-pressed={threat === name} onClick={() => setThreat(name)}>{threats[name].title}</button>)}</div>
        <div aria-live="polite"><h4>{active.title}</h4><span>Attacker view</span><p>{active.sees}</p><span>Protocol result</span><p>{active.result}</p></div>
      </div>
    </figure>
  );
}

const roadmap = {
  current: { label: "Browser demo", confidentiality: "X25519 or P 256 plus AES GCM", puzzle: "Committed identity witness", quantum: "No", status: "Working research demonstration" },
  postquantum: { label: "Post quantum hybrid", confidentiality: "ML KEM plus AES GCM", puzzle: "Witness with proof of knowledge", quantum: "Designed for it", status: "Next engineering prototype" },
  native: { label: "Native puzzle trapdoor", confidentiality: "Puzzle construction itself", puzzle: "Trapdoor and identity", quantum: "Unknown", status: "Open research question" },
} as const;

export function CryptoRoadmapLab() {
  const [stage, setStage] = useState<keyof typeof roadmap>("current");
  const active = roadmap[stage];
  return (
    <figure className="crypto-lab-wide" aria-labelledby="roadmap-title">
      <div className="crypto-lab-heading"><div><p className="blog-kicker">Research path</p><h3 id="roadmap-title">Three stages should remain separate</h3></div></div>
      <div className="roadmap-tabs">{(Object.keys(roadmap) as Array<keyof typeof roadmap>).map((name, index) => <button type="button" key={name} aria-pressed={stage === name} onClick={() => setStage(name)}><span>0{index + 1}</span>{roadmap[name].label}</button>)}</div>
      <div className="roadmap-readout" aria-live="polite">
        <div><span>Confidentiality</span><strong>{active.confidentiality}</strong></div>
        <div><span>Puzzle role</span><strong>{active.puzzle}</strong></div>
        <div><span>Quantum claim</span><strong>{active.quantum}</strong></div>
        <div><span>Status</span><strong>{active.status}</strong></div>
      </div>
    </figure>
  );
}
