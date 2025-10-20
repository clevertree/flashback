# Use the official Rust image as the build environment (updated to support Cargo.lock v4)
FROM rust:1.90-slim as builder

# Install necessary dependencies for building
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the Cargo.toml and Cargo.lock files
COPY Cargo.toml Cargo.lock ./

# Create a dummy src/main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies only (this layer will be cached)
RUN cargo build --release --locked && rm -rf src

# Copy the actual source code
COPY src ./src

# Build the application
RUN cargo build --release --locked

# Runtime stage - use a minimal base image
FROM debian:bookworm-slim

# Install runtime dependencies (include netcat for docker-compose healthcheck)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -r -s /bin/false server

# Copy the binary from builder stage
COPY --from=builder /app/target/release/server /usr/local/bin/server
COPY config.toml /app/config.toml

# Change ownership
RUN chown server:server /usr/local/bin/server /app/config.toml

# Switch to non-root user
USER server

# Set working directory
WORKDIR /app

# Expose the server port (default 8080, configurable via environment)
EXPOSE 8080

# Set environment variables
ENV RUST_LOG=info
ENV SERVER_PORT=8080
ENV SERVER_HOST=0.0.0.0

# Run the server
CMD ["server"]
