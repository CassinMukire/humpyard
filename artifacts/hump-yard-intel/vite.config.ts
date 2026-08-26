import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT and BASE_PATH env vars are read with sensible defaults so the
// dev server works locally without ceremony. In a containerised deploy,
// override via the runtime env.

const port = Number(process.env.PORT ?? 8080);
const basePath = process.env.BASE_PATH ?? "/";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    fs: {
      strict: true,
    },
    // Proxy /api/* to the api-server. In dev, the frontend runs on 8080
    // and the api-server runs on 5000; the proxy makes them look like
    // the same origin to the browser.
    proxy: {
      "/api": {
        target: process.env["API_PROXY_TARGET"] ?? "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
  },
});
