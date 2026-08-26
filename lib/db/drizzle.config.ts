import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // Soft check: in CI we may build without a real database. The schema is
  // type-checked at build time; `drizzle-kit push` and runtime queries
  // require DATABASE_URL to be set.
  console.warn(
    "[drizzle.config] DATABASE_URL is not set — push and migrate commands will fail until it is.",
  );
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "postgres://localhost:5432/placeholder",
  },
  verbose: true,
  strict: true,
});
