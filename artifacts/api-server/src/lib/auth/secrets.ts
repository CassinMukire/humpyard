// =============================================================================
// Docker secrets loader for AUTH_PASS_HASH
//
// Docker compose's `env_file:` parser does TWO substitution passes on values:
//   1. `$$` → `$` (escape a literal `$`)
//   2. `$VAR` → value of VAR (variable interpolation)
//
// The scrypt password hash has the form `scrypt$N$r$p$salt$hash` — six
// `$`-delimited parts. Encoding it as `$$N$$r$$p$$salt$$hash` is the only
// way to get the literal hash into the container through env_file, but the
// second pass then tries to interpret `$salt` and `$hash` as variable
// references and replaces them with empty strings (undefined vars).
//
// The fix is to NOT use env_file for this one value. Docker compose supports
// file-mounted secrets via the `secrets:` block, which copies the file into
// the container at `/run/secrets/<secret-name>` byte-for-byte. No
// interpolation happens at any point.
//
// This module reads the secret file and sets `process.env.AUTH_PASS_HASH`
// before any auth middleware runs. If the file is missing, it does nothing
// (so local dev still works with env-based config).
//
// Used by src/index.ts at the very top of the bootstrap.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { logger } from "../logger";

/**
 * Default Docker secrets path. Compose `secrets:` block mounts the file at
 * `/run/secrets/<name>` unless `target:` is overridden.
 */
const DEFAULT_SECRET_PATH = "/run/secrets/auth_pass_hash";

/**
 * Load AUTH_PASS_HASH from a Docker secret file and apply it to the env.
 *
 * Precedence: the secret file ALWAYS wins if it exists, even if the env
 * already has a value. Reason: env_file corrupts the scrypt hash via its
 * `$VAR` expansion pass, so an env-set value in production is unreliable.
 * Local dev (no secret file mounted) falls through to the env var.
 *
 * Idempotent — only writes the env var if a non-empty value is read.
 * Safe to call multiple times (no-op after the first successful load).
 *
 * @returns true if a secret was loaded, false otherwise.
 */
export function loadAuthSecret(): boolean {
  const configured = process.env["AUTH_PASS_HASH_SECRET_FILE"] ?? DEFAULT_SECRET_PATH;

  if (!existsSync(configured)) {
    return false;
  }

  let value: string;
  try {
    value = readFileSync(configured, "utf8");
  } catch (err) {
    logger.error({ err, path: configured }, "Failed to read AUTH_PASS_HASH secret file");
    return false;
  }

  // Trim trailing newline (writeFileSync adds one by default; tooling may
  // not). Don't trim other whitespace — a leading/trailing space in a hash
  // would just make `isHash()` reject it cleanly.
  const trimmed = value.replace(/\r?\n$/, "");

  if (trimmed.length === 0) {
    logger.error({ path: configured }, "AUTH_PASS_HASH secret file is empty");
    return false;
  }

  process.env["AUTH_PASS_HASH"] = trimmed;
  // Log the length and prefix, never the value. Even a length-only log is
  // useful for confirming the secret loaded without leaking it.
  logger.info(
    {
      path: configured,
      length: trimmed.length,
      prefix: trimmed.slice(0, 12),
      source: process.env["AUTH_PASS_HASH"] ? "file-overrides-env" : "file",
    },
    "Loaded AUTH_PASS_HASH from secret file",
  );
  return true;
}
