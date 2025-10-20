# Multi-stage build for the client
# Stage 1: Build the Next.js application
FROM node:18-alpine as nextjs-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY next.config.js ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./

# Build the Next.js application
RUN npm run build

# Stage 2: Create the runtime image with Node.js server
FROM node:18-alpine

# Install necessary system dependencies
RUN apk add --no-cache \
    ca-certificates \
    dumb-init

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/public ./public
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/next.config.js ./

# Switch to non-root user
USER nextjs

# Expose the port (configurable via environment)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js server
CMD ["npm", "start"]
