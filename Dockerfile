####################################################################################################
## Base
####################################################################################################
FROM rust:slim AS base

RUN rustup target add x86_64-unknown-linux-musl
RUN apt update && apt install -y musl-tools musl-dev
RUN update-ca-certificates

# Create appuser
ENV USER=frodo
ENV UID=10001

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    "${USER}"

# create a new empty shell project
RUN cargo new --bin frodo
WORKDIR /frodo

# Copy specs, install dependencies and thus cache them
COPY ./Cargo.lock ./Cargo.lock
COPY ./Cargo.toml ./Cargo.toml

RUN cargo build --target x86_64-unknown-linux-musl --release
RUN rm src/*.rs
RUN rm ./target/x86_64-unknown-linux-musl/release/deps/frodo*

####################################################################################################
## Builder
####################################################################################################
FROM base AS builder

COPY ./src ./src

RUN cargo build --target x86_64-unknown-linux-musl --release

####################################################################################################
## Production Image
####################################################################################################
FROM scratch

# Import from builder.
COPY --from=base /etc/passwd /etc/passwd
COPY --from=base /etc/group /etc/group

WORKDIR /frodo

# Copy our build
COPY --from=builder /frodo/target/x86_64-unknown-linux-musl/release/frodo ./

# Use an unprivileged user.
USER frodo:frodo

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

CMD ["/frodo/frodo"]