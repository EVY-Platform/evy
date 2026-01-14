FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies stage
FROM base AS deps

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build stage
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY app ./app
COPY dev ./dev

RUN bun run build

# Production stage
FROM base AS runner

WORKDIR /app

# Copy only what's needed for production
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/package.json ./
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --from=builder --chown=bun:bun /app/dev ./dev

USER bun

ARG WEB_PORT="3000"
ENV WEB_PORT=$WEB_PORT
ENV NODE_ENV=production

EXPOSE $WEB_PORT

CMD ["bun", "run", "prod"]
