FROM oven/bun:1-alpine AS base

WORKDIR /app

# Copy package.json and lockfile
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --production

# Copy source code and prisma
COPY src ./src
COPY prisma ./prisma

# Generate prisma client
RUN bun prisma_generate

ARG API_PORT="8000"
ARG DB_URL

ENV API_PORT=$API_PORT
ENV DB_URL=$DB_URL

EXPOSE $API_PORT

CMD [ "bun", "start" ]