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
RUN yarn prisma_generate
RUN yarn prisma_migration
RUN yarn prisma_migrate
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

ARG API_PORT="8001"
ARG DATABASE_URL

ENV API_PORT=$API_PORT
ENV DATABASE_URL=$DATABASE_URL

EXPOSE $API_PORT

CMD [ "yarn", "start" ]