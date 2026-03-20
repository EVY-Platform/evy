FROM oven/bun:1 AS base

WORKDIR /app

# Generate shared types from schema (no committed generated files)
FROM base AS typesgen
COPY package.json bun.lock* ./
COPY types/schema ./types/schema
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile && bun run types:generate

# Install web dependencies
FROM base AS deps
COPY web/package.json web/bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

# Build stage (evy-types = ../types/generated/ts from web/, so workspace has types/ and web/)
FROM base AS builder
WORKDIR /workspace
COPY --from=typesgen /app/types ./types
COPY web/package.json web/bun.lock* ./web/
COPY --from=deps /app/node_modules ./web/node_modules
COPY web/app ./web/app
COPY web/dev ./web/dev

ARG API_URL
ENV API_URL=$API_URL
WORKDIR /workspace/web
RUN bun run dev/build.ts

# Production stage
FROM base AS runner
WORKDIR /app
COPY --from=builder --chown=bun:bun /workspace/web/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /workspace/web/package.json ./
COPY --from=builder --chown=bun:bun /workspace/web/dist ./dist
COPY --from=builder --chown=bun:bun /workspace/web/dev ./dev

USER bun

ARG WEB_PORT
ENV WEB_PORT=$WEB_PORT
ENV NODE_ENV=production

EXPOSE $WEB_PORT

CMD ["bun", "run", "start"]
