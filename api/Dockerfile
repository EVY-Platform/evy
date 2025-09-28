FROM node:24-alpine AS base

FROM base AS builder
WORKDIR /app

# Copy package.json and lockfile
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install

# Build code
FROM node:24-alpine AS code_builder

WORKDIR /app
COPY . .

RUN yarn prisma_generate
RUN yarn build

# We need alpine and not buster-slim because of libSSL
FROM node:24-alpine AS runner

WORKDIR /app

COPY --from=code_builder ./app/dist ./dist
COPY --from=code_builder ./app/prisma ./prisma
COPY package.json yarn.lock ./

RUN yarn install --production
RUN rm ./yarn.lock

ARG API_PORT="8000"
ARG DB_URL

ENV API_PORT=$API_PORT
ENV DB_URL=$DB_URL

EXPOSE $API_PORT

CMD [ "yarn", "start" ]