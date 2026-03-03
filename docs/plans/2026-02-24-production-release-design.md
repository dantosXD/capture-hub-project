# Capture Hub - Production Release Design

**Date:** 2026-02-24
**Status:** Approved
**Deployment Target:** Docker Container with CI/CD

## Overview

This design document outlines the complete production release strategy for Capture Hub, transforming it from a feature-complete development application into a production-ready, containerized system with automated CI/CD deployment.

## Goals

1. **Stability**: Fix all identified pre-launch blockers for production-grade reliability
2. **Portability**: Containerize using Docker for deployment flexibility
3. **Automation**: Implement full CI/CD pipeline with GitHub Actions
4. **Maintainability**: Provide comprehensive deployment documentation and runbooks
5. **Data Persistence**: Ensure SQLite database persists across container lifecycle

## Architecture Decision: Single Container Design

The production deployment will use a **single Docker container** running both Next.js and WebSocket server via `server.ts`. This approach:

- Matches current development architecture
- Simplifies deployment and networking
- Maintains real-time sync reliability
- Avoids container orchestration complexity
- Reduces operational overhead

## Five-Phase Production Release Workflow

### Phase 1: Code Quality Fixes

Fix all pre-launch blockers identified in `PRE_LAUNCH_REVIEW.md`:

#### 1.1 Critical Hook Errors

**useOptimisticMutation.ts Fix**
- **Problem**: Cannot access `executeMutation` before initialization
- **Impact**: Runtime crashes during optimistic updates
- **Solution**: Reorder function declarations or use `useCallback` with proper dependency arrays
- **Validation**: Manual testing of optimistic update flow (create/update/delete items across devices)

**useNetworkStatus.ts Fix**
- **Problem**: Setting state synchronously inside `useEffect` causes cascading renders
- **Impact**: Performance degradation, potential infinite render loops
- **Solution**: Move state updates outside effect or use functional `setState` callbacks
- **Validation**: Monitor component re-render count, verify reconnection logic works

#### 1.2 Database Schema Cleanup

**Remove Unused Models**
- Remove `User` and `Post` models from `prisma/schema.prisma`
- These models are not part of Capture Hub specification
- Keeps database schema focused and lean
- Run `prisma db push` after removal to sync changes

#### 1.3 Test Stabilization

**WebSocket Integration Tests**
- **Problem**: Occasional timeouts waiting for WebSocket messages
- **Solution**: Increase timeout thresholds, fix test server initialization race conditions
- Add retry logic for connection tests to handle network timing variability

**API Integration Tests**
- **Problem**: Fetch requests to `http://localhost:3100` fail if test server isn't started
- **Solution**: Ensure test server properly initializes before running fetch tests
- Consider using Next.js test utilities or proper mocking/stubbing

#### 1.4 Validation Criteria

After fixes, verify:
- `bun run lint` reports 0 critical errors
- `bun run test:run` passes consistently (3+ consecutive runs)
- `bun run build` succeeds
- Manual smoke test: multi-device sync works without console errors

---

### Phase 2: Containerization

#### 2.1 Multi-Stage Dockerfile

**Stage 1: Dependencies** (base: `node:20-alpine`)
```dockerfile
FROM node:20-alpine AS deps
RUN npm install -g bun
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production
```

**Stage 2: Build**
```dockerfile
FROM deps AS build
RUN bun install  # Install dev dependencies
COPY . .
RUN bun run db:generate
RUN bun run build
```

**Stage 3: Production**
```dockerfile
FROM node:20-alpine AS production
RUN npm install -g bun
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY server.ts ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "server.ts"]
```

**Benefits:**
- Reduced image size (no dev dependencies or build artifacts)
- Faster deployment and container startup
- Improved security (minimal attack surface)

#### 2.2 Docker Compose Configuration

**docker-compose.yml** for local testing:

```yaml
version: '3.8'
services:
  capture-hub:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./prisma:/app/prisma
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/prisma/dev.db
      - ZAI_API_KEY=${ZAI_API_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

**docker-compose.production.yml** for production:

```yaml
version: '3.8'
services:
  capture-hub:
    image: ghcr.io/yourname/capture-hub:latest
    ports:
      - "3000:3000"
    volumes:
      - ./prisma:/app/prisma
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/prisma/production.db
      - NEXT_PUBLIC_WS_URL=wss://yourdomain.com/ws
      - ZAI_API_KEY=${ZAI_API_KEY}
      - HOSTNAME=0.0.0.0
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### 2.3 Volume Strategy

**Database Persistence:**
- Mount `./prisma` directory to `/app/prisma` in container
- SQLite database file persists on host filesystem
- Survives container restarts, upgrades, and rebuilds
- Easy backup: copy `./prisma/production.db` to backup location

**Why bind mount instead of named volume:**
- Direct file access for backups
- Easier debugging (can inspect DB file from host)
- Suitable for single-server deployments

#### 2.4 .dockerignore

Reduce build context size:

```
node_modules
.next
.git
*.log
dev.db
*.test.ts
*.test.tsx
docs
README.md
.env
.env.local
```

#### 2.5 Health Checks

Container health monitoring:
- Uses existing `/api/health` endpoint
- Returns 200 OK when app is ready
- Checks database connectivity
- Docker/orchestrators auto-restart unhealthy containers

---

### Phase 3: CI/CD Pipeline

#### 3.1 GitHub Actions Workflow

**Workflow file:** `.github/workflows/production.yml`

**Trigger conditions:**
```yaml
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  release:
    types: [published]
```

#### 3.2 Pipeline Stages

**Stage 1: Test & Lint** (every push/PR)
- Checkout code
- Setup Bun runtime
- Install dependencies (`bun install`)
- Run linter (`bun run lint`)
- Run tests (`bun run test:run`)
- Generate coverage report
- Upload coverage as artifact
- **Gate**: Pipeline fails if tests/linting fail

**Stage 2: Build Docker Image** (master branch only)
- Runs only after tests pass
- Build multi-stage Dockerfile
- Tag with:
  - `latest` (most recent build)
  - Git commit SHA (e.g., `sha-1dbecb7b`)
  - Semantic version if release tag (e.g., `v1.0.0`)

**Stage 3: Push to Registry** (master branch only)
- Login to GitHub Container Registry (ghcr.io)
- Push all tagged images
- Automatic image cleanup (keep last 30 untagged images)

**Stage 4: Optional Deployment**
- Initially: manual deployment (pull image manually)
- Future: automated deployment via webhook or SSH

#### 3.3 Registry Choice: GitHub Container Registry

**Why GHCR (ghcr.io)?**
- Free for public repositories
- Integrated with GitHub (same auth, same UI)
- Automatic cleanup policies
- Good performance and reliability
- Image URL: `ghcr.io/username/capture-hub:latest`

**Alternative:** Docker Hub (if preferred)

#### 3.4 Required GitHub Secrets

Configure in repository settings:
- `GHCR_TOKEN` - GitHub personal access token with `packages:write` scope
- `ZAI_API_KEY` - (optional) for tests requiring AI features

#### 3.5 Caching Strategy

Speed up builds:
- Cache Bun dependencies between runs
- Use Docker layer caching for base images
- Cache Prisma generated client
- Expected build time: ~2-3 minutes with caching

#### 3.6 Build Artifacts

Each successful build produces:
- Docker image in registry (multiple tags)
- Test coverage report (downloadable artifact)
- Build logs for debugging

---

### Phase 4: Production Configuration

#### 4.1 Environment Variables

**Required:**
```bash
DATABASE_URL=file:/app/prisma/production.db
NODE_ENV=production
PORT=3000
```

**WebSocket Configuration:**
```bash
NEXT_PUBLIC_WS_URL=wss://yourdomain.com/ws
```
- Must use `wss://` (secure WebSocket) with SSL/TLS
- Set to production domain
- Reverse proxy handles SSL termination

**AI Features (at least one required):**
```bash
ZAI_API_KEY=your-production-api-key
# or
OPENAI_API_KEY=your-openai-key
```

**Optional:**
```bash
HOSTNAME=0.0.0.0  # Bind to all interfaces in container
```

#### 4.2 Database Management

**Backup Strategy:**
- **Frequency**: Daily automated backups via cron
- **Command**: `cp ./prisma/production.db ./backups/production-$(date +%Y%m%d).db`
- **Retention**: 7 daily, 4 weekly, 12 monthly backups
- **Off-site**: Sync to S3, Backblaze B2, or cloud storage
- **Script**: Provided in `scripts/backup.sh`

**Migration Strategy:**
- Use Prisma migrations: `prisma migrate deploy`
- Run migrations before starting new container version
- Automated backup before migrations (in deployment script)
- Rollback procedure: restore from backup + revert container

**Restore Procedure:**
1. Stop container: `docker compose down`
2. Replace database: `cp backup.db ./prisma/production.db`
3. Start container: `docker compose up -d`
4. Verify health: `curl http://localhost:3000/api/health`

#### 4.3 SSL/TLS and WebSocket Security

**Reverse Proxy Setup** (nginx or Caddy recommended)

**Why reverse proxy?**
- Handles SSL/TLS termination (Let's Encrypt certificates)
- Upgrades HTTP → WebSocket (WSS)
- Can serve multiple apps from one server
- Better security (container doesn't need cert access)
- Load balancing capability if scaling

**nginx example configuration:**
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 4.4 Monitoring and Logging

**Container Logs:**
- Docker captures stdout/stderr automatically
- View: `docker logs capture-hub -f`
- Persist: JSON file driver (configured in docker-compose.yml)
- Rotation: Max 10MB per file, keep 3 files

**Application Monitoring:**
- Health endpoint: `/api/health` (already implemented)
- WebSocket connections: Track count in server.ts logs
- Database size: Monitor `production.db` file growth
- Optional: Prometheus metrics endpoint for advanced monitoring

**Error Tracking:**
- Console errors visible in Docker logs
- Optional: Sentry integration for production error tracking
- AI API failures gracefully degrade (already implemented)

---

### Phase 5: Deployment Documentation

#### 5.1 Documentation Deliverables

**DEPLOYMENT.md** - Comprehensive guide covering:
- Prerequisites (Docker, domain, SSL cert)
- Quick start (5-minute deployment)
- Environment variable reference
- Docker Compose deployment
- Kubernetes manifests (optional)
- Reverse proxy setup
- Backup and restore procedures
- Troubleshooting common issues

**Scripts:**
- `scripts/deploy.sh` - Automated deployment (backup → pull → restart)
- `scripts/backup.sh` - Database backup automation
- `scripts/restore.sh` - Database restore with validation

**Runbooks:**
- Deployment procedure checklist
- Rollback procedure (revert to previous image)
- Database migration procedure
- Troubleshooting guide

#### 5.2 Deployment Commands Reference

**Initial deployment:**
```bash
# Clone and setup
git clone <repo-url> capture-hub
cd capture-hub

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start container
docker compose -f docker-compose.production.yml up -d

# Initialize database
docker exec capture-hub bun run db:push

# Verify
curl http://localhost:3000/api/health
```

**Update deployment:**
```bash
# Automated (recommended)
./scripts/deploy.sh

# Manual
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

**Rollback:**
```bash
# Tag previous version as latest
docker tag ghcr.io/yourname/capture-hub:sha-abc123 ghcr.io/yourname/capture-hub:latest

# Restart with previous version
docker compose -f docker-compose.production.yml up -d
```

**Database backup:**
```bash
# Manual
./scripts/backup.sh

# Automated (crontab)
0 2 * * * /path/to/scripts/backup.sh
```

**View logs:**
```bash
# Follow logs
docker logs capture-hub -f

# Last 100 lines
docker logs capture-hub --tail 100

# Filter errors
docker logs capture-hub 2>&1 | grep ERROR
```

---

## Success Criteria

The production release is considered successful when:

1. ✅ All pre-launch blockers fixed (hooks, DB cleanup, tests)
2. ✅ `bun run lint` passes with 0 critical errors
3. ✅ `bun run test:run` passes 3+ consecutive times
4. ✅ Multi-stage Dockerfile builds successfully
5. ✅ Docker Compose starts container with healthy status
6. ✅ GitHub Actions pipeline passes all stages
7. ✅ Docker image pushed to registry successfully
8. ✅ Database persists across container restarts
9. ✅ WebSocket connections work in containerized environment
10. ✅ Health check endpoint returns 200 OK
11. ✅ Deployment documentation is complete and tested
12. ✅ Backup and restore procedures validated

---

## Risk Mitigation

### Risk: Hook errors cause production crashes
- **Mitigation**: Fix and test before containerization
- **Validation**: Extensive manual testing of optimistic updates

### Risk: Database lost on container failure
- **Mitigation**: Volume mount for persistence + daily backups
- **Validation**: Test container restart with data integrity check

### Risk: WebSocket connections fail in production
- **Mitigation**: Test containerized WebSocket with reverse proxy setup
- **Validation**: Multi-device sync test in production-like environment

### Risk: CI/CD pipeline breaks builds
- **Mitigation**: Test pipeline in feature branch first
- **Validation**: Dry-run deployment before production push

### Risk: Image size too large
- **Mitigation**: Multi-stage build removes dev dependencies
- **Validation**: Target final image < 500MB

---

## Timeline and Dependencies

**Phase 1: Code Quality Fixes**
- No external dependencies
- Can start immediately

**Phase 2: Containerization**
- Depends on: Phase 1 completion (clean codebase)
- Requires: Docker installed locally for testing

**Phase 3: CI/CD Pipeline**
- Depends on: Phase 2 (working Dockerfile)
- Requires: GitHub repository, registry account

**Phase 4: Production Configuration**
- Depends on: Phase 2 & 3 (container + CI/CD working)
- Requires: Production domain, SSL certificate (for reverse proxy)

**Phase 5: Documentation**
- Can proceed in parallel with phases 2-4
- Requires: Testing each documented procedure

**Recommended approach:** Sequential execution (Phase 1 → 2 → 3 → 4 → 5) for stability

---

## Future Enhancements

After initial production release, consider:

1. **Automated deployment** - Trigger production deploy from GitHub Actions
2. **Kubernetes manifests** - For multi-instance deployment
3. **Database migration to PostgreSQL** - If scaling beyond single server
4. **External WebSocket service** - If horizontal scaling needed
5. **CDN integration** - For static assets
6. **Advanced monitoring** - Prometheus + Grafana dashboards
7. **Automated testing in production** - Synthetic monitoring
8. **Blue-green deployments** - Zero-downtime updates

---

## Conclusion

This design provides a comprehensive, production-ready deployment strategy for Capture Hub. The sequential five-phase approach ensures stability, maintainability, and operational excellence. The single-container architecture keeps deployment simple while the CI/CD pipeline enables rapid, reliable updates. Comprehensive documentation and runbooks ensure long-term maintainability.

The design prioritizes:
- **Stability**: Fix all known issues before deployment
- **Simplicity**: Single container, straightforward configuration
- **Automation**: Full CI/CD reduces manual errors
- **Reliability**: Health checks, backups, rollback procedures
- **Maintainability**: Clear documentation and operational procedures

This foundation supports both immediate production deployment and future scaling needs.
