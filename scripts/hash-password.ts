// =============================================================================
// hash-password — generate a scrypt hash for AUTH_PASS_HASH
//
// Usage:
//   pnpm --filter @workspace/api-server run hash-password "your-plain-password"
//   # or
//   node --import tsx scripts/hash-password.ts "your-plain-password"
//
// Print the resulting hash to stdout, ready to paste into .env as
// AUTH_PASS_HASH.
// =============================================================================

import { hashPassword } from "../artifacts/api-server/src/lib/auth/passwords";

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: pnpm --filter @workspace/api-server run hash-password <plain-password>");
  process.exit(1);
}

const hash = hashPassword(plain);
console.log(hash);
console.error("\nPaste into .env as:");
console.error(`AUTH_PASS_HASH=${hash}\n`);
