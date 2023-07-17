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
RUN yarn build

#final - We need alpine and not buster-slim because of libSSL
FROM node:18-alpine AS final
WORKDIR /app
COPY --from=code_builder ./app/dist ./dist
COPY package.json .
COPY yarn.lock .
RUN yarn install --production
RUN rm ./yarn.lock

ARG APP_SCHEME="http"
ARG APP_HOST="0.0.0.0"
ARG APP_PORT=8001
ARG API_SCHEME="http"
ARG API_HOST="0.0.0.0"
ARG API_PORT=8000

ENV APP_SCHEME=$APP_SCHEME
ENV APP_HOST=$APP_HOST
ENV APP_PORT=$APP_PORT
ENV API_SCHEME=$API_SCHEME
ENV API_HOST=$API_HOST
ENV API_PORT=$API_PORT

EXPOSE $APP_PORT

CMD [ "yarn", "start" ]