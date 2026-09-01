// Load Docker secrets BEFORE importing app so that auth middleware sees
// the real AUTH_PASS_HASH on first request. See lib/auth/secrets.ts for why
// this is necessary (env_file's `$VAR` expansion corrupts the scrypt hash).
import { loadAuthSecret } from "./lib/auth/secrets";
loadAuthSecret();

import app from "./app";
import { logger } from "./lib/logger";
import { closeDb } from "@workspace/db";

const port = Number(process.env["PORT"] ?? 5000);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// Graceful shutdown — close DB pool so connections don't leak
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await closeDb();
    logger.info("Shutdown complete");
    process.exit(0);
  });
  // Hard exit if shutdown takes >10s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
