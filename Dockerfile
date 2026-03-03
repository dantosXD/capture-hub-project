# ==============================================================================
# Stage 1: Dependencies
# Install production dependencies only
# ==============================================================================
FROM node:20-alpine AS deps

# Install Bun runtime
RUN npm install -g bun

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install production dependencies
RUN bun install --production --frozen-lockfile

# ==============================================================================
# Stage 2: Build
# Build the Next.js application
# ==============================================================================
FROM node:20-alpine AS build

# Install Bun runtime
RUN npm install -g bun

WORKDIR /app

# Prisma needs DATABASE_URL during client generation/build time.
# Runtime value is still provided by CapRover env vars.
ENV DATABASE_URL=file:/app/prisma/production.db

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including dev dependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build Next.js application in standalone mode
RUN bun run build

# ==============================================================================
# Stage 3: Production
# Final minimal runtime image
# ==============================================================================
FROM node:20-alpine AS production

# Install Bun runtime and curl (for health checks)
RUN npm install -g bun && apk add --no-cache curl

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma

# Copy server.ts (WebSocket + Next.js startup)
COPY --from=build /app/server.ts ./
# Copy runtime dependencies for custom server.ts imports
COPY --from=build /app/src/lib ./src/lib

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start server (both Next.js and WebSocket)
CMD ["sh", "-c", "bun run db:push && bun server.ts"]
