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
RUN yarn prisma
RUN yarn build

#final - We need alpine and not buster-slim because of libSSL
FROM node:18-alpine AS final
WORKDIR /app
COPY --from=code_builder ./app/dist ./dist
COPY --from=code_builder ./app/prisma ./prisma
COPY package.json .
COPY yarn.lock .
RUN yarn install --production
RUN rm ./yarn.lock

ARG API_HOST="0.0.0.0"
ARG API_PORT=8000
ARG DATABASE_URL="postgresql://sam:sam@db:5432/sam?schema=public"

ENV API_HOST=$API_HOST
ENV API_PORT=$API_PORT
ENV DATABASE_URL=$DATABASE_URL

EXPOSE $API_PORT

CMD [ "yarn", "start" ]