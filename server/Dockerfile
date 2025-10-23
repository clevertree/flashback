# Multi-stage build for Rust server

# 1) Builder
FROM rust:1.82-bullseye AS builder
WORKDIR /app
# Create a new empty shell project and copy manifests first to leverage Docker layer caching
RUN USER=root cargo new --bin server
WORKDIR /app/server
COPY Cargo.toml Cargo.toml
# Copy source
COPY src src
# Build release
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release

# 2) Runtime image
FROM debian:bullseye-slim
# add non-root user
RUN useradd -m -u 10001 appuser && \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/server/target/release/server /usr/local/bin/flashback-server
EXPOSE 51111
USER appuser
ENV RUST_LOG=info
CMD ["/usr/local/bin/flashback-server"]
