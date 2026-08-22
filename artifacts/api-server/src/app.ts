import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import v1Router from "./routes/v1";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Security headers (helmet). The default CSP is too strict for the v1 SPA
// (we serve the built React app from this same origin), so we relax it
// to the minimum needed.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// =============================================================================
// Static frontend (single-container deploy)
// =============================================================================
//
// The api-server serves the built React app at the root path. This makes the
// v1 deploy a single container: `docker compose up` and the whole app is on
// port 8080.
//
// Path resolution:
//   1. FRONTEND_DIST env var (set in the Dockerfile / compose)
//   2. <repo-root>/artifacts/hump-yard-intel/dist/public (dev + Docker)
//
// The frontend uses wouter for client-side routing. We need a fallback so
// deep links (e.g. /review-queue) serve index.html and let the SPA router
// take over — but only for non-API paths.

const FRONTEND_DIST_CANDIDATES = [
  process.env["FRONTEND_DIST"],
  path.resolve(__dirname, "..", "..", "hump-yard-intel", "dist", "public"),
  path.resolve(process.cwd(), "artifacts", "hump-yard-intel", "dist", "public"),
].filter((p): p is string => !!p);

const FRONTEND_DIST = FRONTEND_DIST_CANDIDATES.find((p) =>
  existsSync(path.join(p, "index.html")),
);

if (FRONTEND_DIST) {
  logger.info({ frontendDist: FRONTEND_DIST }, "Serving built frontend");
  app.use(
    express.static(FRONTEND_DIST, {
      index: false,
      // Cache static assets for 1 day; index.html itself is no-cache
      maxAge: "1d",
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
} else {
  logger.warn(
    "No built frontend found at expected paths. The API will still work; the UI needs a separate dev server.",
  );
}

// Public routes (existing scanner endpoints — search, search/countries,
// search/outreach, health). These are NOT gated in v1 so the existing
// scanner UI keeps working without auth. Per spec §11.8 "no unauthenticated
// URLs anywhere" — these are flagged for W35 cutover.
app.use("/api", router);

// v1 routes (gated by single-user basic auth). New dossier / review-queue /
// battle-card / monday-sync endpoints. See routes/v1/.
app.use("/api/v1", v1Router);

// SPA fallback: any non-API GET serves index.html. This is what makes the
// React Router deep links work (/review-queue, /dossiers/pl, etc.).
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (!FRONTEND_DIST) return next();
  if (req.method !== "GET") return next();
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

// Centralized error handler. Catches anything passed to next(err) or thrown
// in an async handler (Express 5 handles async errors automatically).
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  req.log.error({ err }, "Unhandled error in request handler");
  res.status(500).json({
    error: "Internal server error",
    message: process.env["NODE_ENV"] === "production" ? undefined : message,
    request_id: req.id,
  });
});

// 404 for unmatched API routes (Express 5 / path-to-regexp v8 requires
// named wildcards, so we use a regex pattern instead)
app.use(/^\/api(\/|$)/, (_req, res, next) => {
  // If we got here, no other API handler matched. Return 404 JSON.
  if (res.headersSent) return next();
  res.status(404).json({ error: "Not found" });
});

export default app;
