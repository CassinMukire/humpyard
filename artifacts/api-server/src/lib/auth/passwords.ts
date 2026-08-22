// =============================================================================
// Password hashing — scrypt (built into Node, no extra dep)
//
// Format: scrypt$<cost>$<block>$<parallel>$<salt-base64>$<derived-base64>
//
// We use scrypt with N=16384, r=8, p=1 (the OWASP-recommended baseline).
// timingSafeEqual on the constant-time compare.
//
// v1 is single-user; this module is ready for multi-user in October.
// =============================================================================

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
// OWASP Password Storage Cheat Sheet baseline (2023+)
const N = 16384;
const R = 8;
const P = 1;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plain.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const costN = Number(parts[1]);
  const costR = Number(parts[2]);
  const costP = Number(parts[3]);
  if (!Number.isFinite(costN) || !Number.isFinite(costR) || !Number.isFinite(costP)) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64");
    expected = Buffer.from(parts[5]!, "base64");
  } catch {
    return false;
  }
  let computed: Buffer;
  try {
    computed = scryptSync(plain.normalize("NFKC"), salt, expected.length, {
      N: costN,
      r: costR,
      p: costP,
    });
  } catch {
    return false;
  }
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

/** Detect whether a stored value is already a hash (vs. legacy plaintext). */
export function isHash(stored: string): boolean {
  return stored.startsWith("scrypt$") && stored.split("$").length === 6;
}
