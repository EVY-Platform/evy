FROM oven/bun:1-alpine AS base

WORKDIR /app

# Install dependencies stage
FROM base AS deps

# Copy package.json and lockfile
COPY api/package.json api/bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Build stage
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY api/package.json api/bun.lock* ./
COPY api/tsconfig.json ./tsconfig.json
COPY api/src ./src
COPY api/drizzle.config.ts ./
# Copy drizzle directory if it exists (for migrations)
COPY api/drizzle* ./drizzle/
COPY types/generated/ts ./types/generated/ts

# Production stage
FROM base AS runner

WORKDIR /app

# Copy node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/types ./types
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/drizzle ./drizzle

ARG API_PORT
ENV API_PORT=$API_PORT

EXPOSE $API_PORT

# Run migrations and start the server
CMD ["bun", "run", "start"]
