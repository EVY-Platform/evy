FROM oven/bun:1 AS base

# Rebuild the source code only when needed
FROM base AS builder

WORKDIR /app

# Copy package.json and lockfile
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . ./

RUN bun run build

# Production image, copy all the files and run the app
FROM base AS runner

WORKDIR /app

# Set the correct permission for dist directory
RUN mkdir -p dist
RUN chown bun:bun dist

# Copy built application
COPY --from=builder --chown=bun:bun /app/ ./

USER bun

ARG WEB_PORT="3000"
ENV WEB_PORT=$WEB_PORT
EXPOSE $WEB_PORT

# Start the application
CMD ["bun", "run", "prod"]
