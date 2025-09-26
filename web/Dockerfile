FROM denoland/deno:2.5.1 AS base

# Rebuild the source code only when needed
FROM base AS builder

ENV DENO_DIR=./.deno_cache

WORKDIR /app

# Copy deno.json and lockfile
COPY deno.json deno.lock ./

# Install dependencies
RUN deno install

# Copy the rest of the application
COPY . ./

RUN deno task build

# Production image, copy all the files and run the app
FROM base AS runner

ENV DENO_DIR=./.deno_cache

WORKDIR /app

# Set the correct permission for dist directory
RUN mkdir -p dist
RUN chown deno:deno dist

# Copy built application
COPY --from=builder --chown=deno:deno /app/ ./

USER deno

ARG WEB_PORT="3000"
ENV WEB_PORT=$WEB_PORT
EXPOSE $WEB_PORT

# Start the application
CMD ["deno", "task", "prod"]