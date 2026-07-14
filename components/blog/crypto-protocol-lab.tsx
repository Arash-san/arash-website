"use client";

import { useEffect, useState } from "react";
import { CryptoBoard } from "@/components/blog/crypto-board";
import {
  decryptText,
  encryptText,
  generateKeyBundle,
  type CipherEnvelope,
  type PrivatePuzzlePackage,
  type PublicPuzzlePackage,
} from "@/lib/yinyang-crypto";

type Bundle = { publicPackage: PublicPuzzlePackage; privatePackage: PrivatePuzzlePackage };

export function CryptoProtocolLab() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [envelope, setEnvelope] = useState<CipherEnvelope | null>(null);
  const [plaintext, setPlaintext] = useState("The puzzle is public. The witness remains private.");
  const [recovered, setRecovered] = useState("");
  const [status, setStatus] = useState("Generating a fresh browser key pair…");
  const [busy, setBusy] = useState(true);
  const [boardView, setBoardView] = useState<"public" | "private">("public");
  const [packageView, setPackageView] = useState<"public" | "private" | "envelope">("public");

  const newKeys = async () => {
    setBusy(true);
    setStatus("Generating a fresh browser key pair…");
    try {
      const next = await generateKeyBundle(20);
      setBundle(next);
      setEnvelope(null);
      setRecovered("");
      setStatus(`${next.publicPackage.agreement.algorithm} key pair ready. Key material exists only in this browser tab.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Key generation failed.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void newKeys(); }, []);

  const encrypt = async () => {
    if (!bundle) return;
    setBusy(true);
    setRecovered("");
    setStatus("Creating an ephemeral shared secret and encrypting…");
    try {
      const next = await encryptText(bundle.publicPackage, plaintext);
      setEnvelope(next);
      setPackageView("envelope");
      setStatus(`Ciphertext created with ${next.agreement}, HKDF SHA 256, and AES 256 GCM.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Encryption failed.");
    } finally {
      setBusy(false);
    }
  };

  const decrypt = async () => {
    if (!bundle || !envelope) return;
    setBusy(true);
    setStatus("Validating the witness and authenticating the ciphertext…");
    try {
      const text = await decryptText(bundle.publicPackage, bundle.privatePackage, envelope);
      setRecovered(text);
      setStatus("Witness accepted. Authentication tag accepted. Text recovered.");
    } catch (error) {
      setRecovered("");
      setStatus(
        error instanceof Error && error.message
          ? error.message
          : "Authentication failed. The envelope changed or the key does not match.",
      );
    } finally {
      setBusy(false);
    }
  };

  const tamper = () => {
    if (!envelope) return;
    const first = envelope.ciphertext[0] === "A" ? "B" : "A";
    setEnvelope({ ...envelope, ciphertext: `${first}${envelope.ciphertext.slice(1)}` });
    setRecovered("");
    setStatus("One encoded ciphertext character changed. Decryption should now fail authentication.");
  };

  const activeRows = !bundle
    ? []
    : boardView === "public"
      ? bundle.publicPackage.board.clues
      : bundle.privatePackage.solution;
  const activePackage = !bundle
    ? null
    : packageView === "public"
      ? bundle.publicPackage
      : packageView === "private"
        ? bundle.privatePackage
        : envelope;

  return (
    <figure className="crypto-protocol" aria-labelledby="crypto-protocol-title">
      <div className="crypto-protocol-head">
        <div>
          <p className="blog-kicker">Live protocol</p>
          <h3 id="crypto-protocol-title">Encrypt and decrypt text in this browser</h3>
          <p>The page sends nothing to a server. Reloading the tab destroys the generated private material.</p>
        </div>
        <button type="button" className="crypto-primary" disabled={busy} onClick={() => void newKeys()}>Generate new keys</button>
      </div>

      <div className="crypto-protocol-grid">
        <section className="crypto-message-panel">
          <label htmlFor="crypto-plaintext">Plaintext</label>
          <textarea id="crypto-plaintext" value={plaintext} onChange={(event) => setPlaintext(event.target.value)} rows={5} />
          <div className="crypto-action-row">
            <button type="button" className="crypto-primary" disabled={busy || !bundle || !plaintext} onClick={() => void encrypt()}>Encrypt text</button>
            <button type="button" disabled={busy || !envelope} onClick={() => void decrypt()}>Decrypt text</button>
            <button type="button" disabled={busy || !envelope} onClick={tamper}>Tamper</button>
          </div>
          <div className="crypto-status" data-busy={busy} aria-live="polite">{status}</div>
          <label htmlFor="crypto-recovered">Recovered text</label>
          <textarea id="crypto-recovered" value={recovered} readOnly rows={4} placeholder="Decrypt a valid envelope to recover the text." />
        </section>

        <section className="crypto-witness-panel">
          <div className="crypto-panel-tabs" aria-label="Puzzle material">
            <button type="button" aria-pressed={boardView === "public"} onClick={() => setBoardView("public")}>Public clues</button>
            <button type="button" aria-pressed={boardView === "private"} onClick={() => setBoardView("private")}>Private witness</button>
          </div>
          {activeRows.length ? <CryptoBoard rows={activeRows} label={`${boardView} 20 by 20 puzzle material`} /> : <div className="crypto-board-skeleton" />}
          <div className="crypto-board-caption">
            <span>{boardView === "public" ? "Shared with every sender" : "Checked only during decryption"}</span>
            <strong>{activeRows.length ? `${activeRows.length * activeRows[0].length} cells` : "Preparing"}</strong>
          </div>
        </section>
      </div>

      <section className="crypto-package-viewer">
        <div className="crypto-panel-tabs" aria-label="Protocol packages">
          <button type="button" aria-pressed={packageView === "public"} onClick={() => setPackageView("public")}>Public package</button>
          <button type="button" aria-pressed={packageView === "private"} onClick={() => setPackageView("private")}>Private package</button>
          <button type="button" aria-pressed={packageView === "envelope"} disabled={!envelope} onClick={() => setPackageView("envelope")}>Cipher envelope</button>
        </div>
        <pre>{activePackage ? JSON.stringify(activePackage, null, 2) : "Generating key material…"}</pre>
      </section>
      <figcaption>This is a research demonstration. Standard agreement and authenticated encryption protect the text. The puzzle is a committed witness.</figcaption>
    </figure>
  );
}
