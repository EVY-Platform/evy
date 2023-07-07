#build deps
FROM node:18-alpine AS dep_builder
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn install

#build code
FROM node:18-alpine AS code_builder
WORKDIR /app
COPY . .
COPY --from=dep_builder ./app/node_modules ./node_modules
RUN yarn build:prod

#final
FROM node:18-buster-slim AS final
WORKDIR /app
COPY --from=code_builder ./app/dist ./dist
COPY package.json .
COPY yarn.lock .
RUN yarn install --production

ARG API_HOST="0.0.0.0"
ARG API_PORT=8000
ARG DATABASE_URL="postgresql://sam:sam@localhost:5432/sam?schema=public"

ENV API_HOST=$API_HOST
ENV API_PORT=$API_PORT
ENV DATABASE_URL=$DATABASE_URL

EXPOSE $API_PORT

CMD [ "node", "." ]