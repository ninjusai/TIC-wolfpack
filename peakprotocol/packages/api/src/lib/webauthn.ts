/**
 * WebAuthn utility helpers for Cloudflare Workers runtime.
 *
 * Uses Web Crypto API (crypto.subtle / crypto.getRandomValues) — no Node.js deps.
 */

// ── Base64URL ─────────────────────────────────────────────────────────

/** Encode an ArrayBuffer to a base64url string (no padding). */
export function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64url string to an ArrayBuffer. */
export function base64urlDecode(str: string): ArrayBuffer {
  // Restore standard base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ── Minimal CBOR Parser ──────────────────────────────────────────────
//
// Handles the subset of CBOR used in WebAuthn attestation objects
// (maps, byte strings, text strings, integers, arrays).
// For production use consider @levischuck/tiny-cbor or cbor-x.

interface CborReader {
  data: DataView;
  offset: number;
}

function readUint8(reader: CborReader): number {
  const val = reader.data.getUint8(reader.offset);
  reader.offset += 1;
  return val;
}

function readUint16(reader: CborReader): number {
  const val = reader.data.getUint16(reader.offset);
  reader.offset += 2;
  return val;
}

function readUint32(reader: CborReader): number {
  const val = reader.data.getUint32(reader.offset);
  reader.offset += 4;
  return val;
}

function readArgument(reader: CborReader, additional: number): number {
  if (additional < 24) return additional;
  if (additional === 24) return readUint8(reader);
  if (additional === 25) return readUint16(reader);
  if (additional === 26) return readUint32(reader);
  throw new Error(`CBOR: unsupported additional info ${additional}`);
}

function readBytes(reader: CborReader, length: number): ArrayBuffer {
  const slice = reader.data.buffer.slice(
    reader.data.byteOffset + reader.offset,
    reader.data.byteOffset + reader.offset + length
  );
  reader.offset += length;
  return slice;
}

function cborParse(reader: CborReader): unknown {
  const initial = readUint8(reader);
  const majorType = initial >> 5;
  const additional = initial & 0x1f;

  switch (majorType) {
    // unsigned integer
    case 0:
      return readArgument(reader, additional);

    // negative integer
    case 1:
      return -1 - readArgument(reader, additional);

    // byte string
    case 2: {
      const len = readArgument(reader, additional);
      return readBytes(reader, len);
    }

    // text string
    case 3: {
      const len = readArgument(reader, additional);
      const buf = readBytes(reader, len);
      return new TextDecoder().decode(buf);
    }

    // array
    case 4: {
      const len = readArgument(reader, additional);
      const arr: unknown[] = [];
      for (let i = 0; i < len; i++) {
        arr.push(cborParse(reader));
      }
      return arr;
    }

    // map
    case 5: {
      const len = readArgument(reader, additional);
      const map = new Map<unknown, unknown>();
      for (let i = 0; i < len; i++) {
        const key = cborParse(reader);
        const value = cborParse(reader);
        map.set(key, value);
      }
      return map;
    }

    // simple values / true / false / null
    case 7: {
      if (additional === 20) return false;
      if (additional === 21) return true;
      if (additional === 22) return null;
      throw new Error(`CBOR: unsupported simple value ${additional}`);
    }

    default:
      throw new Error(`CBOR: unsupported major type ${majorType}`);
  }
}

/** Parse a CBOR-encoded buffer. Returns the decoded value. */
export function parseCBOR(buffer: ArrayBuffer): unknown {
  const reader: CborReader = {
    data: new DataView(buffer),
    offset: 0,
  };
  return cborParse(reader);
}

// ── Authenticator Data Parser ────────────────────────────────────────

export interface AttestedCredentialData {
  aaguid: ArrayBuffer;
  credentialId: ArrayBuffer;
  /** COSE public key as raw bytes */
  credentialPublicKey: ArrayBuffer;
}

export interface AuthenticatorData {
  rpIdHash: ArrayBuffer;
  flags: number;
  signCount: number;
  attestedCredentialData?: AttestedCredentialData;
}

/**
 * Parse the authenticator data binary structure.
 *
 * Layout (bytes):
 *   0..31   rpIdHash        (32 bytes, SHA-256 of RP ID)
 *   32      flags           (1 byte)
 *   33..36  signCount       (4 bytes, big-endian uint32)
 *   37+     attestedCredentialData (if flags bit 6 set)
 *
 * Attested credential data layout:
 *   0..15   aaguid          (16 bytes)
 *   16..17  credentialIdLen (2 bytes, big-endian uint16)
 *   18..    credentialId    (credentialIdLen bytes)
 *   next..  COSE public key (CBOR-encoded, rest of buffer)
 */
export function parseAuthenticatorData(buffer: ArrayBuffer): AuthenticatorData {
  const view = new DataView(buffer);

  if (buffer.byteLength < 37) {
    throw new Error("Authenticator data too short");
  }

  const rpIdHash = buffer.slice(0, 32);
  const flags = view.getUint8(32);
  const signCount = view.getUint32(33);

  const result: AuthenticatorData = { rpIdHash, flags, signCount };

  // Bit 6 (0x40): attested credential data included
  const hasAttestedCredData = (flags & 0x40) !== 0;

  if (hasAttestedCredData && buffer.byteLength > 37) {
    const aaguid = buffer.slice(37, 53);
    const credentialIdLen = view.getUint16(53);
    const credentialId = buffer.slice(55, 55 + credentialIdLen);

    // Everything after credentialId is the CBOR-encoded COSE public key
    const publicKeyStart = 55 + credentialIdLen;
    const credentialPublicKey = buffer.slice(publicKeyStart);

    result.attestedCredentialData = {
      aaguid,
      credentialId,
      credentialPublicKey,
    };
  }

  return result;
}

// ── COSE Key Import & Assertion Verification ────────────────────────

/**
 * Import a COSE public key (ES256 / algorithm -7) as a Web Crypto CryptoKey.
 *
 * The stored key is base64url-encoded CBOR. We decode it, parse the CBOR map
 * to extract the x and y coordinates, then import as ECDSA P-256.
 *
 * COSE key map labels for EC2 (kty 2):
 *   1  → kty (2 = EC2)
 *   3  → alg (-7 = ES256)
 *  -1  → crv (1 = P-256)
 *  -2  → x   (32 bytes)
 *  -3  → y   (32 bytes)
 */
export async function importCOSEPublicKey(
  coseKeyBase64url: string
): Promise<CryptoKey> {
  const coseBytes = base64urlDecode(coseKeyBase64url);
  const coseMap = parseCBOR(coseBytes);

  if (!(coseMap instanceof Map)) {
    throw new Error("COSE key is not a CBOR map");
  }

  const x = coseMap.get(-2);
  const y = coseMap.get(-3);

  if (!(x instanceof ArrayBuffer) || !(y instanceof ArrayBuffer)) {
    throw new Error("COSE key missing x or y coordinates");
  }

  // Build uncompressed EC point: 0x04 || x || y
  const xBytes = new Uint8Array(x);
  const yBytes = new Uint8Array(y);
  const rawKey = new Uint8Array(1 + xBytes.length + yBytes.length);
  rawKey[0] = 0x04;
  rawKey.set(xBytes, 1);
  rawKey.set(yBytes, 1 + xBytes.length);

  return crypto.subtle.importKey(
    "raw",
    rawKey.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

/**
 * Convert a DER-encoded ECDSA signature to the raw r||s format expected
 * by Web Crypto's `crypto.subtle.verify`.
 *
 * DER structure: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
 * Output: 64 bytes (32-byte r + 32-byte s, zero-padded).
 */
export function derToRaw(derSig: ArrayBuffer): ArrayBuffer {
  const buf = new Uint8Array(derSig);
  // Skip outer SEQUENCE tag (0x30) and length
  let offset = 2;

  // Read r
  if (buf[offset] !== 0x02) throw new Error("Invalid DER: expected INTEGER tag for r");
  offset += 1;
  const rLen = buf[offset];
  offset += 1;
  let rBytes = buf.slice(offset, offset + rLen);
  offset += rLen;

  // Read s
  if (buf[offset] !== 0x02) throw new Error("Invalid DER: expected INTEGER tag for s");
  offset += 1;
  const sLen = buf[offset];
  offset += 1;
  let sBytes = buf.slice(offset, offset + sLen);

  // Strip leading zero padding (DER uses signed integers)
  if (rBytes.length === 33 && rBytes[0] === 0) rBytes = rBytes.slice(1);
  if (sBytes.length === 33 && sBytes[0] === 0) sBytes = sBytes.slice(1);

  // Pad to 32 bytes each
  const raw = new Uint8Array(64);
  raw.set(rBytes, 32 - rBytes.length);
  raw.set(sBytes, 64 - sBytes.length);

  return raw.buffer;
}

/**
 * Verify a WebAuthn assertion signature.
 *
 * Signed data = authenticatorData || SHA-256(clientDataJSON)
 * The signature from WebAuthn is DER-encoded; we convert to raw r||s first.
 */
export async function verifyAssertion(params: {
  credentialPublicKey: CryptoKey;
  authenticatorData: ArrayBuffer;
  clientDataJSON: ArrayBuffer;
  signature: ArrayBuffer;
}): Promise<boolean> {
  const { credentialPublicKey, authenticatorData, clientDataJSON, signature } =
    params;

  // Hash clientDataJSON
  const clientDataHash = await crypto.subtle.digest("SHA-256", clientDataJSON);

  // Concatenate authenticatorData || clientDataHash
  const authDataBytes = new Uint8Array(authenticatorData);
  const hashBytes = new Uint8Array(clientDataHash);
  const signedData = new Uint8Array(
    authDataBytes.length + hashBytes.length
  );
  signedData.set(authDataBytes, 0);
  signedData.set(hashBytes, authDataBytes.length);

  // Convert DER signature to raw r||s
  const rawSignature = derToRaw(signature);

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    credentialPublicKey,
    rawSignature,
    signedData.buffer
  );
}

// ── Recovery Codes ───────────────────────────────────────────────────

const RECOVERY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1

/**
 * Generate recovery codes and their SHA-256 hashes.
 *
 * @param count Number of codes to generate (default 6).
 * @returns Plain text codes (shown once) and their hex-encoded SHA-256 hashes.
 */
export async function generateRecoveryCodes(
  count: number = 6
): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-char code
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    let code = "";
    for (let j = 0; j < 8; j++) {
      code += RECOVERY_CODE_CHARS[randomBytes[j] % RECOVERY_CODE_CHARS.length];
    }
    plain.push(code);

    // Hash with SHA-256
    const encoded = new TextEncoder().encode(code);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = new Uint8Array(hashBuffer);
    let hex = "";
    for (let j = 0; j < hashArray.length; j++) {
      hex += hashArray[j].toString(16).padStart(2, "0");
    }
    hashed.push(hex);
  }

  return { plain, hashed };
}
