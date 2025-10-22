# Docker Setup for Client-Server Application

This document describes how to run the Rust server and Next.js client applications using Docker containers.

## Overview

The Docker setup includes:
- **Server**: Rust TCP server in a containerized environment
- **Client**: Next.js web application with production optimization
- **Networking**: Custom Docker network for inter-container communication
- **Multiple Clients**: Support for running multiple client instances
- **Health Checks**: Automated service health monitoring

## Quick Start

1. **Make scripts executable:**
   ```bash
   chmod +x docker-build.sh docker-test.sh
   ```

2. **Build Docker images:**
   ```bash
   ./docker-build.sh
   ```

3. **Test connectivity:**
   ```bash
   ./docker-test.sh
   ```

## Manual Commands

### Build Images Individually

**Build server image:**
