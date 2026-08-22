# =============================================================================
# DECEL Intelligence Platform — production image
# =============================================================================
#
# Multi-stage build:
#   - deps:    install all deps (including devDeps for the build)
#   - builder: build the api-server (esbuild) and the frontend (vite)
#   - runner:  minimal runtime image with only production deps + built assets
#
# The api-server (Express 5) serves BOTH the API at /api/* and the built
# frontend at /*. So one container, one port (default 5000, exposed as
# whatever the host chooses).
# =============================================================================

# ---- Stage 1: deps ----
FROM node:24-slim AS deps
WORKDIR /app

# Install pnpm via corepack (ships with Node 24)
RUN corepack enable && corepack prepare pnpm@10.16.1 --activate

# Copy only the lockfile + workspace manifests first for cacheable install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/hump-yard-intel/package.json artifacts/hump-yard-intel/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/db/package.json lib/db/
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/
COPY scripts/package.json scripts/

# Install all dependencies (including devDeps) — frozen lockfile
RUN pnpm install --frozen-lockfile

# ---- Stage 2: builder ----
FROM deps AS builder
WORKDIR /app

# Copy source
COPY . .

# Build the api-server (esbuild) + frontend (vite)
RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/hump-yard-intel run build

# ---- Stage 3: runner ----
FROM node:24-slim AS runner
WORKDIR /app

# Install pnpm for the prod install step
RUN corepack enable && corepack prepare pnpm@10.16.1 --activate

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/hump-yard-intel/package.json artifacts/hump-yard-intel/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/db/package.json lib/db/
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/
COPY scripts/package.json scripts/

# Install ONLY production deps
RUN pnpm install --frozen-lockfile --prod

# Copy the built artefacts from the builder stage
COPY --from=builder /app/artifacts/api-server/dist artifacts/api-server/dist
COPY --from=builder /app/artifacts/hump-yard-intel/dist artifacts/hump-yard-intel/dist

# Copy the snapshots dir (will be mounted as a volume in compose)
RUN mkdir -p /app/data/snapshots

# Non-root user for runtime
RUN groupadd -r decel && useradd -r -g decel decel \
    && chown -R decel:decel /app
USER decel

# Expose the api-server port (mapped to host 8080 in docker-compose by default)
EXPOSE 5000

# Health check via the existing /api/healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||5000) +'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Default command — reads PORT env var, falls back to 5000
CMD ["sh", "-c", "node --enable-source-maps artifacts/api-server/dist/index.mjs"]
