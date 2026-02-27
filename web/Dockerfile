# Build from repo root so evy-types (../types/generated/ts) is available.
FROM oven/bun:1 AS base

WORKDIR /workspace

# Install dependencies stage
FROM base AS deps

COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile

# Build stage: run from web dir so tsconfig path ../types/generated/ts resolves
FROM base AS builder

WORKDIR /workspace

ARG API_URL
ENV API_URL=$API_URL

COPY --from=deps /workspace/node_modules ./web/node_modules
COPY web/package.json web/bun.lock* web/tsconfig.json ./web/
COPY web/app ./web/app
COPY web/dev ./web/dev
COPY types ./types

WORKDIR /workspace/web

RUN bun run build

# Production stage
FROM base AS runner

WORKDIR /app

COPY --from=builder /workspace/web/node_modules ./node_modules
COPY --from=builder /workspace/web/package.json ./
COPY --from=builder /workspace/web/dist ./dist
COPY --from=builder /workspace/web/dev ./dev

USER bun

ARG WEB_PORT
ENV WEB_PORT=$WEB_PORT
ENV NODE_ENV=production

EXPOSE $WEB_PORT

CMD ["bun", "run", "start"]
