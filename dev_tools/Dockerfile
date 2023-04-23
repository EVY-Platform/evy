####################################################################################################
## Dev watcher
####################################################################################################
FROM rust:slim AS watcher

RUN cargo install cargo-watch

####################################################################################################
## Development Image
####################################################################################################
FROM watcher AS dev

WORKDIR /frodo
COPY ./ ./

EXPOSE 8080

# Set up environment variables
ARG FRODO_API_HOST="0.0.0.0"
ENV FRODO_API_HOST=$FRODO_API_HOST
ARG FRODO_API_PORT=8080
ENV FRODO_API_PORT=$FRODO_API_PORT
ARG FRODO_SURREALDB_HOST="0.0.0.0"
ENV FRODO_SURREALDB_HOST=$FRODO_SURREALDB_HOST
ARG FRODO_SURREALDB_PORT=8000
ENV FRODO_SURREALDB_PORT=$FRODO_SURREALDB_PORT
ARG FRODO_SURREALDB_USERNAME="root"
ENV FRODO_SURREALDB_USERNAME=$FRODO_SURREALDB_USERNAME
ARG FRODO_SURREALDB_PASSWORD="root"
ENV FRODO_SURREALDB_PASSWORD=$FRODO_SURREALDB_PASSWORD
ARG FRODO_SURREALDB_NAMESPACE="ns"
ENV FRODO_SURREALDB_NAMESPACE=$FRODO_SURREALDB_NAMESPACE
ARG FRODO_SURREALDB_DATABASE="sam"
ENV FRODO_SURREALDB_DATABASE=$FRODO_SURREALDB_DATABASE