####################################################################################################
## Builder
####################################################################################################
FROM rust:latest AS builder

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

# copy over your manifests
COPY ./Cargo.lock ./Cargo.lock
COPY ./Cargo.toml ./Cargo.toml

# this build step will cache your dependencies
RUN cargo build --target x86_64-unknown-linux-musl --release
RUN rm src/*.rs

# copy your source tree
COPY ./src ./src

RUN rm ./target/x86_64-unknown-linux-musl/release/deps/frodo*
RUN cargo build --target x86_64-unknown-linux-musl --release

####################################################################################################
## Final image
####################################################################################################
FROM scratch

# Import from builder.
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

WORKDIR /frodo

# Copy our build
COPY --from=builder /frodo/target/x86_64-unknown-linux-musl/release/frodo ./

# Use an unprivileged user.
USER frodo:frodo

EXPOSE 8080

ENV FRODO_API_HOST="0.0.0.0"
ENV FRODO_API_PORT=8080
ENV FRODO_SURREALDB_HOST="0.0.0.0"
ENV FRODO_SURREALDB_PORT=8000
ENV FRODO_SURREALDB_USERNAME="root"
ENV FRODO_SURREALDB_PASSWORD="root"

CMD ["/frodo/frodo"]