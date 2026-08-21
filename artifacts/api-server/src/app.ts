import express, { type Express } from "express";
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public routes (existing scanner endpoints — search, search/countries,
// search/outreach, health). These are NOT gated in v1 so the existing
// scanner UI keeps working without auth. Per spec §11.8 "no unauthenticated
// URLs anywhere" — these are flagged for W35 cutover.
app.use("/api", router);

// v1 routes (gated by single-user basic auth). New dossier / review-queue /
// battle-card / monday-sync endpoints. See routes/v1/.
app.use("/api/v1", v1Router);

export default app;
