import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import v1Router from "./routes/v1";
import { logger } from "./lib/logger";

const app: Express = express();

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

// Public routes (existing scanner endpoints — search, search/countries,
// search/outreach, health). These are NOT gated in v1 so the existing
// scanner UI keeps working without auth. Per spec §11.8 "no unauthenticated
// URLs anywhere" — these are flagged for W35 cutover.
app.use("/api", router);

// v1 routes (gated by single-user basic auth). New dossier / review-queue /
// battle-card / monday-sync endpoints. See routes/v1/.
app.use("/api/v1", v1Router);

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

// 404 for unmatched API routes
app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
