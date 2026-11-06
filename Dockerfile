# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Stage 1 — build the React (Vite) client
# ---------------------------------------------------------------------------
FROM node:22-alpine AS client-builder

WORKDIR /app

# Copy only manifests first so dependency layers cache well.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

# Install the client workspace (includes Vite and the React plugin).
RUN npm ci --workspace client

COPY client ./client
RUN npm run build --workspace client

# ---------------------------------------------------------------------------
# Stage 2 — install production server dependencies only
# ---------------------------------------------------------------------------
FROM node:22-alpine AS server-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

# Workspace-aware production install: no vitest, supertest, or Vite.
RUN npm ci --omit=dev --workspace server

# ---------------------------------------------------------------------------
# Development image (used by docker compose; never the default build target)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS development

ENV NODE_ENV=development

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

COPY server ./server
COPY client ./client

EXPOSE 8080 5173
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# Runtime stage — minimal production image
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    IMPORT_CACHE_DIR=/tmp/ror-cache

WORKDIR /app

# Hoisted workspace dependencies (production only).
COPY --from=server-deps /app/node_modules ./node_modules

# The server's nearest package.json declares "type": "module". Copying the
# whole (dependency-only) server directory also preserves any nested modules.
COPY --from=server-deps /app/server ./server
COPY server/src ./server/src

# Built SPA. Express serves it (and the SPA fallback) in production.
COPY --from=client-builder /app/client/dist ./client/dist

# Run unprivileged. The files above are world-readable, so no chown is needed.
USER node

WORKDIR /app/server
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
