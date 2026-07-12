FROM oven/bun:1-alpine AS base

WORKDIR /app

# Generate shared types from schema (no committed generated files)
FROM base AS typesgen
COPY package.json bun.lock* ./
COPY types ./types
COPY scripts ./scripts

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile && bun run types:generate

# Install dependencies stage
FROM base AS deps
WORKDIR /app/services/marketplace
COPY --from=typesgen /app/types /app/types
COPY services/marketplace/package.json services/marketplace/bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app/services/marketplace
COPY --from=deps /app/services/marketplace/node_modules ./node_modules
COPY services/marketplace/package.json ./
COPY services/marketplace/tsconfig.json ./tsconfig.json
COPY services/marketplace/src ./src
COPY services/marketplace/drizzle.config.ts ./
COPY services/marketplace/drizzle ./drizzle
COPY --from=typesgen /app/types /app/types

# Production stage
FROM base AS runner

WORKDIR /app/services/marketplace

COPY --from=builder /app/services/marketplace/node_modules /app/node_modules
COPY --from=builder /app/services/marketplace/package.json ./
COPY --from=builder /app/services/marketplace/src ./src
COPY --from=builder /app/services/marketplace/tsconfig.json ./tsconfig.json
COPY --from=builder /app/types ../../types
COPY --from=builder /app/services/marketplace/drizzle.config.ts ./
COPY --from=builder /app/services/marketplace/drizzle ./drizzle
COPY types/schema ./types/schema

ARG MARKETPLACE_WS_PORT
ENV MARKETPLACE_WS_PORT=$MARKETPLACE_WS_PORT

EXPOSE $MARKETPLACE_WS_PORT

# Run migrations and start the server
CMD ["bun", "run", "start"]
