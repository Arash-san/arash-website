export type AgreementName = "X25519" | "ECDH P-256";

export type PublicPuzzlePackage = {
  version: "YINYANG-WITNESS-KEM-DEMO-v1";
  board: { rows: number; cols: number; clues: string[] };
  puzzleId: string;
  solutionCommitment: string;
  agreement: { algorithm: AgreementName; publicJwk: JsonWebKey };
};

export type PrivatePuzzlePackage = {
  version: "YINYANG-WITNESS-KEM-DEMO-v1";
  solution: string[];
  commitmentSalt: string;
  agreement: { algorithm: AgreementName; privateJwk: JsonWebKey };
};

export type CipherEnvelope = {
  version: "YINYANG-WITNESS-KEM-DEMO-v1";
  agreement: AgreementName;
  ephemeralPublicJwk: JsonWebKey;
  nonce: string;
  ciphertext: string;
  publicFingerprint: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DOMAIN = "YINYANG-WITNESS-KEM-DEMO-v1";

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(value: string) {
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

export function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

export function base64ToBytes(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function sha256Bytes(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export async function sha256Hex(value: string | Uint8Array) {
  return bytesToHex(await sha256Bytes(value));
}

export function makeSolution(size: number) {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      if (row % 2 === 0) return col === 0 ? "0" : "1";
      return col === size - 1 ? "1" : "0";
    }).join(""),
  );
}

export function makePublicClues(solution: string[]) {
  return solution.map((row, rowIndex) =>
    Array.from(row, (cell, colIndex) => ((rowIndex * 17 + colIndex * 11) % 5 < 3 ? cell : ".")).join(""),
  );
}

function oneColorConnected(solution: string[], color: "0" | "1") {
  const rows = solution.length;
  const cols = solution[0]?.length ?? 0;
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (solution[row][col] === color) cells.push([row, col]);
    }
  }
  if (!cells.length) return false;
  const queue = [cells[0]];
  const seen = new Set([cells[0].join(":")]);
  for (let index = 0; index < queue.length; index += 1) {
    const [row, col] = queue[index];
    for (const [nextRow, nextCol] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
      const key = `${nextRow}:${nextCol}`;
      if (
        nextRow >= 0 && nextCol >= 0 && nextRow < rows && nextCol < cols &&
        solution[nextRow][nextCol] === color && !seen.has(key)
      ) {
        seen.add(key);
        queue.push([nextRow, nextCol]);
      }
    }
  }
  return seen.size === cells.length;
}

export function validateSolution(solution: string[], clues?: string[]) {
  if (!solution.length || solution.some((row) => row.length !== solution[0].length || /[^01]/.test(row))) return false;
  if (clues && clues.some((row, rowIndex) =>
    Array.from(row).some((clue, colIndex) => clue !== "." && clue !== solution[rowIndex]?.[colIndex]),
  )) return false;
  for (let row = 0; row < solution.length - 1; row += 1) {
    for (let col = 0; col < solution[0].length - 1; col += 1) {
      const cells = `${solution[row][col]}${solution[row + 1][col]}${solution[row][col + 1]}${solution[row + 1][col + 1]}`;
      if (cells === "0000" || cells === "1111") return false;
    }
  }
  return oneColorConnected(solution, "0") && oneColorConnected(solution, "1");
}

async function generateAgreement() {
  try {
    const pair = await crypto.subtle.generateKey({ name: "X25519" } as Algorithm, true, ["deriveBits"]) as CryptoKeyPair;
    return { algorithm: "X25519" as const, pair };
  } catch {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    return { algorithm: "ECDH P-256" as const, pair };
  }
}

async function importAgreementKey(algorithm: AgreementName, jwk: JsonWebKey, kind: "public" | "private") {
  const usages: KeyUsage[] = kind === "private" ? ["deriveBits"] : [];
  if (algorithm === "X25519") {
    return crypto.subtle.importKey("jwk", jwk, { name: "X25519" } as Algorithm, false, usages);
  }
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, usages);
}

async function deriveSharedBits(algorithm: AgreementName, privateKey: CryptoKey, publicKey: CryptoKey) {
  const params = algorithm === "X25519"
    ? ({ name: "X25519", public: publicKey } as Algorithm)
    : ({ name: "ECDH", public: publicKey } as EcdhKeyDeriveParams);
  return new Uint8Array(await crypto.subtle.deriveBits(params, privateKey, 256));
}

async function deriveAesKey(shared: Uint8Array, puzzleId: string) {
  const material = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: hexToBytes(puzzleId), info: encoder.encode(`${DOMAIN}:content-key`) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function generateKeyBundle(size = 20) {
  const solution = makeSolution(size);
  const clues = makePublicClues(solution);
  const puzzleId = await sha256Hex(stableStringify({ rows: size, cols: size, clues }));
  const commitmentSaltBytes = crypto.getRandomValues(new Uint8Array(16));
  const commitmentSalt = bytesToBase64(commitmentSaltBytes);
  const solutionCommitment = await sha256Hex(`${DOMAIN}:witness:${commitmentSalt}:${puzzleId}:${solution.join("")}`);
  const { algorithm, pair } = await generateAgreement();
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicPackage: PublicPuzzlePackage = {
    version: DOMAIN,
    board: { rows: size, cols: size, clues },
    puzzleId,
    solutionCommitment,
    agreement: { algorithm, publicJwk },
  };
  const privatePackage: PrivatePuzzlePackage = {
    version: DOMAIN,
    solution,
    commitmentSalt,
    agreement: { algorithm, privateJwk },
  };
  return { publicPackage, privatePackage };
}

export async function encryptText(publicPackage: PublicPuzzlePackage, plaintext: string): Promise<CipherEnvelope> {
  const recipient = await importAgreementKey(publicPackage.agreement.algorithm, publicPackage.agreement.publicJwk, "public");
  const ephemeral = await generateAgreement();
  if (ephemeral.algorithm !== publicPackage.agreement.algorithm) throw new Error("The browser changed agreement algorithms.");
  const shared = await deriveSharedBits(ephemeral.algorithm, ephemeral.pair.privateKey, recipient);
  const key = await deriveAesKey(shared, publicPackage.puzzleId);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const publicFingerprint = await sha256Hex(stableStringify(publicPackage));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: hexToBytes(publicFingerprint), tagLength: 128 },
    key,
    encoder.encode(plaintext),
  ));
  return {
    version: DOMAIN,
    agreement: ephemeral.algorithm,
    ephemeralPublicJwk: await crypto.subtle.exportKey("jwk", ephemeral.pair.publicKey),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    publicFingerprint,
  };
}

export async function decryptText(
  publicPackage: PublicPuzzlePackage,
  privatePackage: PrivatePuzzlePackage,
  envelope: CipherEnvelope,
) {
  if (publicPackage.version !== DOMAIN || privatePackage.version !== DOMAIN || envelope.version !== DOMAIN) {
    throw new Error("Protocol version mismatch.");
  }
  if (!validateSolution(privatePackage.solution, publicPackage.board.clues)) {
    throw new Error("The private solution does not satisfy the public puzzle.");
  }
  const commitment = await sha256Hex(
    `${DOMAIN}:witness:${privatePackage.commitmentSalt}:${publicPackage.puzzleId}:${privatePackage.solution.join("")}`,
  );
  if (commitment !== publicPackage.solutionCommitment) throw new Error("The private witness commitment does not match.");
  if (envelope.agreement !== publicPackage.agreement.algorithm || privatePackage.agreement.algorithm !== envelope.agreement) {
    throw new Error("Agreement algorithm mismatch.");
  }
  const publicJwk = publicPackage.agreement.publicJwk;
  const privateJwk = privatePackage.agreement.privateJwk;
  if (publicJwk.x !== privateJwk.x || publicJwk.y !== privateJwk.y || publicJwk.crv !== privateJwk.crv) {
    throw new Error("The private agreement key does not match the public key.");
  }
  const expectedFingerprint = await sha256Hex(stableStringify(publicPackage));
  if (expectedFingerprint !== envelope.publicFingerprint) throw new Error("The public package fingerprint changed.");
  const privateKey = await importAgreementKey(envelope.agreement, privateJwk, "private");
  const ephemeralPublic = await importAgreementKey(envelope.agreement, envelope.ephemeralPublicJwk, "public");
  const shared = await deriveSharedBits(envelope.agreement, privateKey, ephemeralPublic);
  const key = await deriveAesKey(shared, publicPackage.puzzleId);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(envelope.nonce),
      additionalData: hexToBytes(envelope.publicFingerprint),
      tagLength: 128,
    },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  return decoder.decode(plaintext);
}

export function transformSquare(rows: string[], operation: number) {
  const size = rows.length;
  const at = (row: number, col: number) => rows[row][col];
  const result = Array.from({ length: size }, () => Array.from({ length: size }, () => "0"));
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      let targetRow = row;
      let targetCol = col;
      if (operation === 1) { targetRow = col; targetCol = size - 1 - row; }
      if (operation === 2) { targetRow = size - 1 - row; targetCol = size - 1 - col; }
      if (operation === 3) { targetRow = size - 1 - col; targetCol = row; }
      if (operation === 4) { targetRow = row; targetCol = size - 1 - col; }
      if (operation === 5) { targetRow = size - 1 - row; targetCol = col; }
      if (operation === 6) { targetRow = col; targetCol = row; }
      if (operation === 7) { targetRow = size - 1 - col; targetCol = size - 1 - row; }
      result[targetRow][targetCol] = at(row, col);
    }
  }
  return result.map((row) => row.join(""));
}

export function canonicalSquare(rows: string[]) {
  return Array.from({ length: 8 }, (_, operation) => transformSquare(rows, operation).join(""))
    .sort()[0];
}
