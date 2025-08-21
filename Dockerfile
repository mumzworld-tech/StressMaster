# Multi-stage build for optimized production image

# Build stage
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Dependencies stage - separate stage for production dependencies
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:22-alpine AS production

# Install runtime dependencies and security tools
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy package.json for runtime
COPY package*.json ./

# Copy scripts and set permissions
COPY scripts/ ./scripts/
RUN chmod +x ./scripts/*.sh

# Copy configuration files
COPY config/ ./config/

# Create required directories
RUN mkdir -p /app/data /app/scripts/k6 /app/results && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check with improved configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ./scripts/health-check.sh

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=768"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application using the startup script
CMD ["./scripts/startup.sh"]