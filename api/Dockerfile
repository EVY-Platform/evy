FROM oven/bun:1-alpine AS base

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

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
COPY prisma ./prisma

# Generate prisma client
RUN bunx prisma generate

# Production stage
FROM base AS runner

WORKDIR /app

# Copy node_modules with prisma client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

ARG API_PORT="8000"
ENV API_PORT=$API_PORT

EXPOSE $API_PORT

# Run migrations and start the server
# Using prisma_migrate (deploy) for production, not prisma_migration (dev)
CMD ["sh", "-c", "bunx prisma migrate deploy && bun src/index.ts"]
