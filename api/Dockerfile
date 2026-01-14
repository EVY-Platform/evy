FROM oven/bun:1-alpine AS base

WORKDIR /app

# Install dependencies stage
FROM base AS deps

# Copy package.json and lockfile
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Build stage
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY src ./src
COPY drizzle.config.ts ./
# Copy drizzle directory if it exists (for migrations)
COPY drizzle* ./drizzle/

# Production stage
FROM base AS runner

WORKDIR /app

# Copy node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/drizzle ./drizzle

ARG API_PORT="8000"
ENV API_PORT=$API_PORT

EXPOSE $API_PORT

# Run migrations and start the server
CMD ["bun", "run", "start"]
