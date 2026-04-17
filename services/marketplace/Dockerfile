FROM oven/bun:1-alpine AS base

WORKDIR /app

FROM base AS typesgen
COPY package.json bun.lock* ./
COPY types/schema ./types/schema
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile && bun run types:generate

FROM base AS deps
WORKDIR /app/services/marketplace
COPY services/marketplace/package.json ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

FROM base AS builder
WORKDIR /app/services/marketplace
COPY --from=deps /app/services/marketplace/node_modules ./node_modules
COPY services/marketplace/package.json ./
COPY types/schema/service.proto /app/types/schema/service.proto
COPY services/marketplace/tsconfig.json ./tsconfig.json
COPY services/marketplace/src ./src
COPY services/marketplace/drizzle.config.ts ./
COPY services/marketplace/drizzle ./drizzle
COPY --from=typesgen /app/types/generated/ts ../../types/generated/ts

FROM base AS runner

WORKDIR /app/services/marketplace

COPY --from=builder /app/services/marketplace/node_modules ./node_modules
COPY --from=builder /app/services/marketplace/package.json ./
COPY types/schema/service.proto /app/types/schema/service.proto
COPY --from=builder /app/services/marketplace/src ./src
COPY --from=builder /app/services/marketplace/tsconfig.json ./tsconfig.json
COPY --from=builder /app/types ../../types
COPY --from=builder /app/services/marketplace/drizzle.config.ts ./
COPY --from=builder /app/services/marketplace/drizzle ./drizzle

ARG MARKETPLACE_GRPC_PORT
ENV MARKETPLACE_GRPC_PORT=$MARKETPLACE_GRPC_PORT

EXPOSE $MARKETPLACE_GRPC_PORT

CMD ["bun", "run", "start"]
