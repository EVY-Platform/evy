FROM denoland/deno:2.5.1 AS base

# Rebuild the source code only when needed
FROM base AS builder

ENV DENO_DIR=./.deno_cache

WORKDIR /app

# Copy package.json and lockfile
COPY deno.json deno.lock ./

# Install dependencies
RUN deno install

# Copy the rest of the application
COPY . ./

RUN deno task build

# Production image, copy all the files and run the app
FROM base AS runner

ENV NODE_ENV=production
ENV DENO_DIR=./.deno_cache

WORKDIR /app

# Set the correct permission for dist directory
RUN mkdir -p dist
RUN chown deno:deno dist

# Copy built application
COPY --from=builder --chown=deno:deno /app/ ./

USER deno

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Start the application
CMD ["deno", "task", "start"]