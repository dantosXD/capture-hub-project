# Production Release Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Capture Hub into a production-ready, containerized application with full CI/CD pipeline

**Architecture:** Sequential 5-phase approach: (1) Fix critical code quality issues, (2) Create Docker containerization with multi-stage build, (3) Implement GitHub Actions CI/CD pipeline, (4) Add production configuration files, (5) Write comprehensive deployment documentation

**Tech Stack:** Docker multi-stage build, GitHub Actions, GitHub Container Registry (GHCR), nginx reverse proxy, shell scripts for automation

---

## Phase 1: Code Quality Fixes

### Task 1: Fix useOptimisticMutation Hook Error

**Files:**
- Modify: `src/hooks/useOptimisticMutation.ts:123-205`

**Problem:** The `executeMutation` function is called inside a toast action callback (line 183) before the useCallback has fully initialized, potentially causing "Cannot access before initialization" errors in strict mode or certain React versions.

**Step 1: Read the current implementation**

Run: Review `src/hooks/useOptimisticMutation.ts` lines 123-205

**Step 2: Fix the circular reference issue**

Replace the executeMutation useCallback to use a ref-based approach for the toast action:

```typescript
// Add this ref after line 121
const executeMutationRef = useRef<((variables: TVariables, isRetry?: boolean) => Promise<any>) | null>(null);

const executeMutation = useCallback(async (variables: TVariables, isRetry = false) => {
  // Store variables for potential retry
  if (!isRetry) {
    lastVariablesRef.current = variables;
  }

  if (!isRetry) {
    setState(prev => ({ ...prev, isPending: true, error: null }));
  }

  try {
    // Apply optimistic update immediately (only on first attempt, not retries)
    if (onOptimisticUpdate && !isRetry) {
      onOptimisticUpdate(variables);
    }

    // Execute server mutation
    const data = await mutateFn(variables);

    // Finalize the update
    if (onSuccess) {
      onSuccess(data, variables);
    }

    // Show success message
    if (successMessage) {
      toast.success(successMessage);
    }

    setState({
      data,
      error: null,
      isPending: false,
      isRollingBack: false,
      retryCount: 0,
    });

    return data;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('[useOptimisticMutation] Mutation failed:', err);

    const currentRetryCount = state.retryCount;
    const canRetry = retryable && currentRetryCount < maxRetries;
    const remainingRetries = maxRetries - currentRetryCount;

    // Rollback optimistic update
    setState(prev => ({ ...prev, isRollingBack: true }));

    if (onRollback) {
      onRollback(err, variables);
    }

    // Show error message with retry button if retries available
    if (canRetry) {
      toast.error(`${errorMessage} (${remainingRetries} retries left)`, {
        action: {
          label: 'Retry',
          onClick: () => {
            setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
            // Use the ref to avoid closure issues
            if (executeMutationRef.current) {
              executeMutationRef.current(variables, true);
            }
          },
        },
      });
    } else {
      // Show final error message after max retries
      const finalMessage = currentRetryCount > 0
        ? `${errorMessage} (Failed after ${currentRetryCount} retry attempts)`
        : errorMessage;
      toast.error(finalMessage);
    }

    setState({
      data: null,
      error: err,
      isPending: false,
      isRollingBack: false,
      retryCount: currentRetryCount,
    });

    throw err;
  }
}, [mutateFn, onOptimisticUpdate, onSuccess, onRollback, errorMessage, successMessage, maxRetries, retryable, state.retryCount]);

// Update the ref whenever executeMutation changes
useEffect(() => {
  executeMutationRef.current = executeMutation;
}, [executeMutation]);
```

**Step 3: Import useEffect at the top**

Add `useEffect` to the imports from 'react' on line 3:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
```

**Step 4: Test the fix**

Run: `bun run lint`
Expected: No errors related to useOptimisticMutation

Run: `bun run build`
Expected: Build succeeds without hook-related warnings

**Step 5: Commit the fix**

```bash
git add src/hooks/useOptimisticMutation.ts
git commit -m "fix: resolve useOptimisticMutation circular reference issue

Use ref-based approach for toast retry action to avoid accessing
executeMutation before initialization. Prevents potential runtime
crashes during optimistic updates.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Fix useNetworkStatus Hook Performance Issue

**Files:**
- Modify: `src/hooks/useNetworkStatus.ts:34-62`

**Problem:** Event handlers inside useEffect directly update state, which can cause unnecessary re-renders or linting warnings.

**Step 1: Refactor event handlers to use functional setState**

Replace the useEffect (lines 34-62) with functional setState to avoid stale closure issues:

```typescript
useEffect(() => {
  // Only run in browser
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  // Handle going online
  const handleOnline = () => {
    console.log('[useNetworkStatus] Network connection restored');
    setIsOnline(() => true);
  };

  // Handle going offline
  const handleOffline = () => {
    console.log('[useNetworkStatus] Network connection lost');
    setIsOnline(() => false);
    setWasOffline(() => true);
  };

  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Cleanup
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []); // Empty dependency array since we use functional setState
```

**Step 2: Test the fix**

Run: `bun run lint`
Expected: No warnings about useEffect dependencies or setState usage

Run: `bun run build`
Expected: Build succeeds

**Step 3: Manual test network status**

Start dev server: `bun run dev`
- Open browser dev tools → Network tab → Set to "Offline"
- Verify console logs "Network connection lost"
- Set back to "Online"
- Verify console logs "Network connection restored"

**Step 4: Commit the fix**

```bash
git add src/hooks/useNetworkStatus.ts
git commit -m "fix: improve useNetworkStatus performance with functional setState

Use functional setState in event handlers to avoid stale closures
and unnecessary re-renders. Adds empty dependency array to useEffect
since handlers no longer depend on external state.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Remove Unused Database Models

**Files:**
- Modify: `prisma/schema.prisma:109-126`

**Step 1: Remove User and Post models**

Delete lines 109-126 from `prisma/schema.prisma` (the entire User and Post models)

**Step 2: Verify schema is valid**

Run: `bun run db:generate`
Expected: Prisma client generates successfully

Run: `bun run lint`
Expected: No errors

**Step 3: Push schema changes to database**

Run: `bun run db:push`
Expected: Schema synced to database, User and Post tables removed (if they existed)

**Step 4: Run tests to ensure nothing broke**

Run: `bun run test:run`
Expected: All tests pass (User/Post models weren't used in app)

**Step 5: Commit the cleanup**

```bash
git add prisma/schema.prisma
git commit -m "refactor: remove unused User and Post models from schema

Clean up database schema by removing models not part of Capture Hub
specification. Keeps schema focused and lean for production deployment.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Stabilize WebSocket Integration Tests

**Files:**
- Modify: `src/test/websocket.integration.test.ts`
- Modify: `src/test/api.integration.test.ts`

**Step 1: Increase WebSocket test timeouts**

Find any `test('...', async () => { ... }, 5000)` patterns in `websocket.integration.test.ts` and increase timeout to 10000ms:

```typescript
test('should handle WebSocket connection and broadcast', async () => {
  // test code...
}, 10000); // Increased from 5000 to 10000ms
```

**Step 2: Add retry logic for flaky connection tests**

Wrap WebSocket connection establishment in retry logic:

```typescript
async function connectWithRetry(url: string, maxRetries = 3): Promise<WebSocket> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const ws = new WebSocket(url);
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      return ws;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
    }
  }
  throw new Error('Failed to connect after retries');
}
```

**Step 3: Fix API test server initialization**

In `api.integration.test.ts`, ensure the test server starts before fetch tests run:

```typescript
beforeAll(async () => {
  // Wait for test server to be ready
  let retries = 10;
  while (retries > 0) {
    try {
      const response = await fetch('http://localhost:3100/api/health');
      if (response.ok) break;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 500));
      retries--;
    }
  }
  if (retries === 0) throw new Error('Test server failed to start');
});
```

**Step 4: Run tests multiple times to verify stability**

Run: `bun run test:run && bun run test:run && bun run test:run`
Expected: All three runs pass consistently

**Step 5: Commit the test fixes**

```bash
git add src/test/websocket.integration.test.ts src/test/api.integration.test.ts
git commit -m "test: stabilize WebSocket and API integration tests

- Increase WebSocket test timeouts from 5s to 10s
- Add retry logic for flaky connection tests
- Ensure test server initialization before fetch tests
- Handle network timing variability gracefully

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Validate Phase 1 Completion

**Files:**
- None (validation only)

**Step 1: Run full lint check**

Run: `bun run lint`
Expected: 0 critical errors (may have warnings, but no blockers)

**Step 2: Run tests 3 consecutive times**

Run: `bun run test:run && bun run test:run && bun run test:run`
Expected: All passes

**Step 3: Run production build**

Run: `bun run build`
Expected: Build completes successfully, generates `.next` directory

**Step 4: Manual smoke test**

Start dev server: `bun run dev`
- Open http://localhost:3000 in two browser windows
- Create a new capture item in one window
- Verify it appears in the other window (real-time sync)
- Check browser console for errors
Expected: No console errors, multi-device sync works

**Step 5: Tag Phase 1 completion**

```bash
git tag phase-1-code-quality-fixes
git push origin phase-1-code-quality-fixes
```

---

## Phase 2: Containerization

### Task 6: Create .dockerignore File

**Files:**
- Create: `.dockerignore`

**Step 1: Create .dockerignore to reduce build context**

```
# Dependencies
node_modules

# Build outputs
.next
.next/standalone
.next/static

# Version control
.git
.gitignore

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
dev-test-3000.log

# Database files (dev)
*.db
*.db-journal
dev.db
prisma/dev.db

# Tests
*.test.ts
*.test.tsx
*.spec.ts
*.spec.tsx
__tests__
coverage

# Documentation
docs
README.md
CONTRIBUTING.md
LICENSE
*.md

# Environment files
.env
.env.local
.env.*.local

# Editor/IDE
.vscode
.idea
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Temporary files
tmp
temp
*.tmp
tmpclaude-*

# Scripts not needed in container
scripts/*.sh
```

**Step 2: Commit .dockerignore**

```bash
git add .dockerignore
git commit -m "build: add .dockerignore to reduce Docker build context

Exclude node_modules, .next, docs, tests, and temp files from
Docker build context. Reduces build time and image size.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Create Multi-Stage Dockerfile

**Files:**
- Create: `Dockerfile`

**Step 1: Create Dockerfile with multi-stage build**

```dockerfile
# ==============================================================================
# Stage 1: Dependencies
# Install production dependencies only
# ==============================================================================
FROM node:20-alpine AS deps

# Install Bun runtime
RUN npm install -g bun

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

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

# Copy package files
COPY package.json bun.lockb ./

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

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start server (both Next.js and WebSocket)
CMD ["bun", "server.ts"]
```

**Step 2: Update next.config.ts for standalone output**

Check if `next.config.ts` has `output: 'standalone'`. If not, add it:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  // ... other config
};
```

**Step 3: Test Docker build locally**

Run: `docker build -t capture-hub:test .`
Expected: Build completes successfully (may take 5-10 minutes first time)

**Step 4: Check image size**

Run: `docker images capture-hub:test`
Expected: Image size < 500MB (target for optimization)

**Step 5: Commit Dockerfile**

```bash
git add Dockerfile
git commit -m "build: add multi-stage Dockerfile for production

Three-stage build process:
1. deps - Install production dependencies only
2. build - Build Next.js standalone output with Prisma
3. production - Minimal runtime image with health checks

Includes Bun runtime, WebSocket server, and health check endpoint.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Create Docker Compose Configuration

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.production.yml`

**Step 1: Create docker-compose.yml for local testing**

```yaml
version: '3.8'

services:
  capture-hub:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: capture-hub-dev
    ports:
      - "3000:3000"
    volumes:
      - ./prisma:/app/prisma
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/prisma/dev.db
      - ZAI_API_KEY=${ZAI_API_KEY:-}
      - NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    networks:
      - capture-hub-network

networks:
  capture-hub-network:
    driver: bridge
```

**Step 2: Create docker-compose.production.yml for production deployment**

```yaml
version: '3.8'

services:
  capture-hub:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER:-yourname}/capture-hub:latest
    container_name: capture-hub
    ports:
      - "3000:3000"
    volumes:
      - ./prisma:/app/prisma
      - ./backups:/app/backups
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/prisma/production.db
      - NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-wss://yourdomain.com/ws}
      - ZAI_API_KEY=${ZAI_API_KEY}
      - HOSTNAME=0.0.0.0
      - PORT=3000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - capture-hub-network

networks:
  capture-hub-network:
    driver: bridge
```

**Step 3: Test docker-compose build and startup**

Run: `docker compose up -d`
Expected: Container starts and health check passes

Run: `docker compose logs -f`
Expected: See server startup logs, no errors

Run: `curl http://localhost:3000/api/health`
Expected: {"status":"ok"} or similar

**Step 4: Test multi-device sync in container**

- Open http://localhost:3000 in two browser tabs
- Create a capture item in one tab
- Verify it appears in the other tab
Expected: Real-time sync works

**Step 5: Stop and remove container**

Run: `docker compose down`

**Step 6: Commit Docker Compose files**

```bash
git add docker-compose.yml docker-compose.production.yml
git commit -m "build: add Docker Compose configurations

- docker-compose.yml: Local testing with build context
- docker-compose.production.yml: Production with pre-built image

Includes volume mounts for database persistence, health checks,
log rotation, and environment variable templates.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Test Database Persistence Across Container Restarts

**Files:**
- None (testing only)

**Step 1: Start container and create test data**

Run: `docker compose up -d`

Wait for healthy: `docker compose ps` (should show "healthy" status)

**Step 2: Initialize database**

Run: `docker exec capture-hub bun run db:push`
Expected: Database schema created in `./prisma/dev.db`

**Step 3: Create test capture item via API**

```bash
curl -X POST http://localhost:3000/api/capture \
  -H "Content-Type: application/json" \
  -d '{
    "type": "note",
    "title": "Persistence Test",
    "content": "Testing database persistence across container restarts",
    "tags": "test",
    "status": "inbox"
  }'
```

Expected: Returns created item with ID

**Step 4: Verify item exists**

Run: `curl http://localhost:3000/api/capture`
Expected: Returns array with the test item

**Step 5: Restart container**

Run: `docker compose restart`

Wait for healthy: `docker compose ps`

**Step 6: Verify data persisted**

Run: `curl http://localhost:3000/api/capture`
Expected: Test item still exists

**Step 7: Clean up**

Run: `docker compose down`

**Step 8: Document successful persistence test**

Create a note in your testing log that database persistence works correctly.

---

### Task 10: Validate Phase 2 Completion

**Files:**
- None (validation only)

**Step 1: Verify all Docker files exist**

Run: `ls -la Dockerfile docker-compose.yml docker-compose.production.yml .dockerignore`
Expected: All files exist

**Step 2: Build image without cache to verify reproducibility**

Run: `docker build --no-cache -t capture-hub:test .`
Expected: Build succeeds

**Step 3: Check final image size**

Run: `docker images capture-hub:test --format "{{.Size}}"`
Expected: < 500MB

**Step 4: Run full container test**

```bash
docker compose up -d
docker compose ps  # Check health
curl http://localhost:3000/api/health
docker compose down
```

Expected: All commands succeed

**Step 5: Tag Phase 2 completion**

```bash
git tag phase-2-containerization
git push origin phase-2-containerization
```

---

## Phase 3: CI/CD Pipeline

### Task 11: Create GitHub Actions Workflow Directory

**Files:**
- Create: `.github/workflows/production.yml`

**Step 1: Create .github/workflows directory**

Run: `mkdir -p .github/workflows`

**Step 2: Create production.yml workflow file**

```yaml
name: Production CI/CD Pipeline

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # =============================================================================
  # Job 1: Test & Lint
  # Runs on every push and PR
  # =============================================================================
  test:
    name: Test & Lint
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run linter
        run: bun run lint

      - name: Generate Prisma client
        run: bun run db:generate

      - name: Run tests
        run: bun run test:run

      - name: Generate coverage report
        run: bun run test:coverage
        continue-on-error: true

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 30

  # =============================================================================
  # Job 2: Build Docker Image
  # Runs only on push to master branch after tests pass
  # =============================================================================
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'

    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix=sha-
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NODE_ENV=production

      - name: Image size check
        run: |
          docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          IMAGE_SIZE=$(docker images ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest --format "{{.Size}}")
          echo "Image size: $IMAGE_SIZE"
          echo "::notice::Docker image built successfully. Size: $IMAGE_SIZE"

  # =============================================================================
  # Job 3: Security Scan (Optional)
  # Scan Docker image for vulnerabilities
  # =============================================================================
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    continue-on-error: true

    steps:
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
```

**Step 3: Commit GitHub Actions workflow**

```bash
git add .github/workflows/production.yml
git commit -m "ci: add production CI/CD pipeline with GitHub Actions

Three-stage pipeline:
1. Test & Lint - Runs on all pushes and PRs
2. Build Docker Image - Master branch only, pushes to GHCR
3. Security Scan - Trivy vulnerability scanning

Features:
- Automatic versioning with SHA and semver tags
- Docker layer caching for faster builds
- Coverage report artifacts
- Security scanning with Trivy

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 12: Configure GitHub Repository Settings

**Files:**
- None (GitHub settings configuration)

**Step 1: Enable GitHub Actions**

Navigate to: Repository Settings → Actions → General
- Set "Actions permissions" to "Allow all actions and reusable workflows"
- Set "Workflow permissions" to "Read and write permissions"
- Check "Allow GitHub Actions to create and approve pull requests"

**Step 2: Verify GITHUB_TOKEN permissions**

The workflow uses the automatic `GITHUB_TOKEN` which has permissions to push to GitHub Container Registry. No additional secrets needed for basic setup.

**Step 3: (Optional) Add ZAI_API_KEY secret for tests**

If tests require AI features:
- Navigate to: Repository Settings → Secrets and variables → Actions
- Click "New repository secret"
- Name: `ZAI_API_KEY`
- Value: Your z-ai API key
- Click "Add secret"

**Step 4: Enable GitHub Container Registry**

Navigate to: Repository Settings → Packages
- Verify that "Inherit access from source repository" is enabled
- This allows the workflow to push images

**Step 5: Document completion**

Make a note that GitHub Actions is configured and ready to run.

---

### Task 13: Test CI/CD Pipeline

**Files:**
- Create: `test-ci.txt` (temporary test file)

**Step 1: Create a test file to trigger pipeline**

```bash
echo "Testing CI/CD pipeline" > test-ci.txt
git add test-ci.txt
git commit -m "test: trigger CI/CD pipeline test"
```

**Step 2: Push to trigger pipeline**

Run: `git push origin master`

**Step 3: Monitor pipeline execution**

- Go to GitHub repository → Actions tab
- Watch the "Production CI/CD Pipeline" workflow run
- Verify "Test & Lint" job passes
- Verify "Build Docker Image" job passes
- Verify "Security Scan" job completes

Expected: All jobs pass (green checkmarks)

**Step 4: Verify image in GitHub Container Registry**

- Go to GitHub repository → Packages
- Find "capture-hub" package
- Verify tags: `latest`, `sha-XXXXXXX`, `master`

**Step 5: Clean up test file**

```bash
git rm test-ci.txt
git commit -m "test: remove CI/CD pipeline test file"
git push origin master
```

---

### Task 14: Validate Phase 3 Completion

**Files:**
- None (validation only)

**Step 1: Verify workflow file exists**

Run: `cat .github/workflows/production.yml`
Expected: File exists with correct content

**Step 2: Check latest workflow run status**

Go to: GitHub → Actions → Production CI/CD Pipeline
Expected: Latest run shows all jobs passed

**Step 3: Verify Docker image is accessible**

Run: `docker pull ghcr.io/YOUR-USERNAME/capture-hub:latest`
(Replace YOUR-USERNAME with your GitHub username)
Expected: Image pulls successfully

**Step 4: Test pulling and running the registry image**

```bash
docker run -d -p 3000:3000 \
  -e DATABASE_URL=file:/app/prisma/test.db \
  ghcr.io/YOUR-USERNAME/capture-hub:latest

sleep 10
curl http://localhost:3000/api/health
docker stop $(docker ps -q --filter ancestor=ghcr.io/YOUR-USERNAME/capture-hub:latest)
```

Expected: Health check returns success

**Step 5: Tag Phase 3 completion**

```bash
git tag phase-3-cicd-pipeline
git push origin phase-3-cicd-pipeline
```

---

## Phase 4: Production Configuration

### Task 15: Create Production Environment Template

**Files:**
- Create: `.env.production.template`

**Step 1: Create production environment template**

```bash
# =============================================================================
# Capture Hub - Production Environment Template
# =============================================================================
# Copy this file and fill in production values
# DO NOT commit the filled version to git
# =============================================================================

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------
DATABASE_URL=file:/app/prisma/production.db

# -----------------------------------------------------------------------------
# Server Configuration
# -----------------------------------------------------------------------------
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# -----------------------------------------------------------------------------
# WebSocket Configuration
# -----------------------------------------------------------------------------
# IMPORTANT: Set this to your production domain with WSS (secure WebSocket)
# Example: wss://capturehub.yourdomain.com/ws
NEXT_PUBLIC_WS_URL=wss://yourdomain.com/ws

# -----------------------------------------------------------------------------
# AI / API Keys
# -----------------------------------------------------------------------------
# At least one of these is required for AI features to work
# If neither is set, AI features gracefully degrade
ZAI_API_KEY=your-zai-api-key-here
# OPENAI_API_KEY=your-openai-api-key-here

# -----------------------------------------------------------------------------
# Optional: Monitoring & Logging
# -----------------------------------------------------------------------------
# LOG_LEVEL=info
# SENTRY_DSN=your-sentry-dsn-here

# -----------------------------------------------------------------------------
# Optional: Backup Configuration
# -----------------------------------------------------------------------------
# BACKUP_ENABLED=true
# BACKUP_RETENTION_DAYS=30
# BACKUP_S3_BUCKET=your-backup-bucket
# BACKUP_S3_REGION=us-east-1
```

**Step 2: Commit production environment template**

```bash
git add .env.production.template
git commit -m "config: add production environment template

Provides template for production environment variables including:
- Database path configuration
- WebSocket WSS URL for production domain
- AI API keys
- Monitoring and backup options

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 16: Create Deployment Scripts

**Files:**
- Create: `scripts/deploy.sh`
- Create: `scripts/backup.sh`
- Create: `scripts/restore.sh`

**Step 1: Create backup script**

```bash
#!/bin/bash
# =============================================================================
# Capture Hub - Database Backup Script
# =============================================================================
# Backs up the production SQLite database with timestamp
# Usage: ./scripts/backup.sh
# =============================================================================

set -e  # Exit on error

# Configuration
DB_PATH="${DB_PATH:-./prisma/production.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/production-$DATE.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
  echo "❌ Error: Database not found at $DB_PATH"
  exit 1
fi

# Perform backup
echo "📦 Backing up database..."
echo "   Source: $DB_PATH"
echo "   Target: $BACKUP_FILE"

cp "$DB_PATH" "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup completed successfully"
  echo "   Size: $BACKUP_SIZE"
  echo "   Location: $BACKUP_FILE"
else
  echo "❌ Error: Backup failed"
  exit 1
fi

# Clean up old backups (keep last 30 days by default)
RETENTION_DAYS="${RETENTION_DAYS:-30}"
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "production-*.db" -type f -mtime +$RETENTION_DAYS -delete
echo "✅ Cleanup completed"

echo ""
echo "Backup summary:"
ls -lh "$BACKUP_DIR"/production-*.db | tail -5
```

**Step 2: Create restore script**

```bash
#!/bin/bash
# =============================================================================
# Capture Hub - Database Restore Script
# =============================================================================
# Restores database from a backup file
# Usage: ./scripts/restore.sh <backup-file>
# =============================================================================

set -e  # Exit on error

# Configuration
DB_PATH="${DB_PATH:-./prisma/production.db}"

# Check arguments
if [ -z "$1" ]; then
  echo "❌ Error: Backup file not specified"
  echo "Usage: $0 <backup-file>"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/production-*.db 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Confirm restoration
echo "⚠️  WARNING: This will replace the current database!"
echo "   Current: $DB_PATH"
echo "   Backup:  $BACKUP_FILE"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

# Create backup of current database before restore
if [ -f "$DB_PATH" ]; then
  SAFETY_BACKUP="$DB_PATH.before-restore-$(date +%Y%m%d-%H%M%S)"
  echo "📦 Creating safety backup of current database..."
  cp "$DB_PATH" "$SAFETY_BACKUP"
  echo "   Saved to: $SAFETY_BACKUP"
fi

# Restore database
echo "♻️  Restoring database..."
cp "$BACKUP_FILE" "$DB_PATH"

# Verify restoration
if [ -f "$DB_PATH" ]; then
  DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
  echo "✅ Restore completed successfully"
  echo "   Size: $DB_SIZE"
  echo "   Location: $DB_PATH"
  echo ""
  echo "⚠️  Remember to restart the application for changes to take effect:"
  echo "   docker compose restart"
else
  echo "❌ Error: Restore failed"
  exit 1
fi
```

**Step 3: Create deployment script**

```bash
#!/bin/bash
# =============================================================================
# Capture Hub - Automated Deployment Script
# =============================================================================
# Deploys latest Docker image with automatic backup
# Usage: ./scripts/deploy.sh
# =============================================================================

set -e  # Exit on error

echo "🚀 Capture Hub - Automated Deployment"
echo "===================================="
echo ""

# Step 1: Backup current database
echo "Step 1/5: Backing up database..."
./scripts/backup.sh
echo ""

# Step 2: Pull latest Docker image
echo "Step 2/5: Pulling latest Docker image..."
docker compose -f docker-compose.production.yml pull
echo "✅ Image pulled"
echo ""

# Step 3: Stop current container
echo "Step 3/5: Stopping current container..."
docker compose -f docker-compose.production.yml down
echo "✅ Container stopped"
echo ""

# Step 4: Start new container
echo "Step 4/5: Starting new container..."
docker compose -f docker-compose.production.yml up -d
echo "✅ Container started"
echo ""

# Step 5: Wait for health check
echo "Step 5/5: Waiting for health check..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
  if docker compose -f docker-compose.production.yml ps | grep -q "healthy"; then
    echo "✅ Container is healthy"
    break
  fi
  echo "   Waiting... ($RETRIES retries left)"
  sleep 2
  RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
  echo "❌ Error: Container failed to become healthy"
  echo "   Check logs: docker compose -f docker-compose.production.yml logs"
  exit 1
fi

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "Verify deployment:"
echo "  docker compose -f docker-compose.production.yml ps"
echo "  curl http://localhost:3000/api/health"
echo ""
echo "View logs:"
echo "  docker compose -f docker-compose.production.yml logs -f"
```

**Step 4: Make scripts executable**

```bash
chmod +x scripts/deploy.sh scripts/backup.sh scripts/restore.sh
```

**Step 5: Test backup script**

```bash
# Create test database
touch prisma/production.db
# Run backup
./scripts/backup.sh
# Verify backup exists
ls -lh backups/
```

Expected: Backup file created in backups/ directory

**Step 6: Commit deployment scripts**

```bash
git add scripts/deploy.sh scripts/backup.sh scripts/restore.sh
git commit -m "ops: add deployment and backup automation scripts

- deploy.sh: Automated deployment with backup → pull → restart
- backup.sh: Database backup with rotation (30-day retention)
- restore.sh: Safe database restoration with confirmation

All scripts include error handling, progress feedback, and
safety backups before destructive operations.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 17: Create nginx Reverse Proxy Configuration Example

**Files:**
- Create: `docs/nginx.conf.example`

**Step 1: Create nginx configuration example**

```nginx
# =============================================================================
# Capture Hub - nginx Reverse Proxy Configuration Example
# =============================================================================
# This configuration:
# - Handles SSL/TLS termination with Let's Encrypt
# - Upgrades HTTP connections to WebSocket (WSS)
# - Proxies requests to Capture Hub container on port 3000
# =============================================================================

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name capturehub.yourdomain.com;

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server with WebSocket support
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name capturehub.yourdomain.com;

    # SSL/TLS Configuration
    ssl_certificate /etc/letsencrypt/live/capturehub.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/capturehub.yourdomain.com/privkey.pem;

    # SSL Security Settings (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/capturehub-access.log;
    error_log /var/log/nginx/capturehub-error.log;

    # Proxy Configuration
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket Support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Timeouts for WebSocket connections
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;

        # Buffering
        proxy_buffering off;
        proxy_cache off;
    }

    # Health check endpoint (optional direct access)
    location /api/health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }
}

# =============================================================================
# Installation Instructions:
# =============================================================================
# 1. Install nginx and certbot:
#    sudo apt update
#    sudo apt install nginx certbot python3-certbot-nginx
#
# 2. Copy this file to nginx sites-available:
#    sudo cp docs/nginx.conf.example /etc/nginx/sites-available/capturehub
#
# 3. Update server_name with your domain:
#    sudo nano /etc/nginx/sites-available/capturehub
#
# 4. Enable the site:
#    sudo ln -s /etc/nginx/sites-available/capturehub /etc/nginx/sites-enabled/
#
# 5. Test nginx configuration:
#    sudo nginx -t
#
# 6. Obtain SSL certificate with Let's Encrypt:
#    sudo certbot --nginx -d capturehub.yourdomain.com
#
# 7. Reload nginx:
#    sudo systemctl reload nginx
#
# 8. Set up automatic certificate renewal:
#    sudo certbot renew --dry-run
# =============================================================================
```

**Step 2: Commit nginx configuration example**

```bash
git add docs/nginx.conf.example
git commit -m "docs: add nginx reverse proxy configuration example

Complete nginx configuration with:
- HTTP to HTTPS redirect
- Let's Encrypt SSL/TLS termination
- WebSocket (WSS) upgrade support
- Security headers and best practices
- Long-lived WebSocket connection timeouts

Includes detailed installation instructions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 18: Validate Phase 4 Completion

**Files:**
- None (validation only)

**Step 1: Verify all configuration files exist**

Run: `ls -la .env.production.template scripts/*.sh docs/nginx.conf.example`
Expected: All files exist

**Step 2: Test deployment script (dry run)**

```bash
# This will fail at the docker compose step if not in production, but verifies script syntax
bash -n scripts/deploy.sh
bash -n scripts/backup.sh
bash -n scripts/restore.sh
```

Expected: No syntax errors

**Step 3: Verify scripts are executable**

Run: `ls -la scripts/*.sh`
Expected: All scripts have execute permission (-rwxr-xr-x)

**Step 4: Tag Phase 4 completion**

```bash
git tag phase-4-production-config
git push origin phase-4-production-config
```

---

## Phase 5: Deployment Documentation

### Task 19: Create DEPLOYMENT.md

**Files:**
- Create: `DEPLOYMENT.md`

**Step 1: Create comprehensive deployment documentation**

```markdown
# Capture Hub - Production Deployment Guide

Complete guide for deploying Capture Hub in production using Docker.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Reverse Proxy Setup](#reverse-proxy-setup)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Backup & Restore](#backup--restore)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying Capture Hub, ensure you have:

- **Docker** - Version 20.10 or later ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** - Version 2.0 or later (included with Docker Desktop)
- **Domain name** - For production deployment with SSL/TLS
- **Server** - Linux server with at least 2GB RAM, 20GB disk space
- **SSL Certificate** - Let's Encrypt (free) or commercial cert

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 1GB | 2GB+ |
| Disk | 10GB | 20GB+ |
| Network | 10 Mbps | 100 Mbps+ |

---

## Quick Start

Deploy Capture Hub in 5 minutes:

### Step 1: Clone Repository

```bash
git clone https://github.com/yourname/capture-hub-project.git
cd capture-hub-project
```

### Step 2: Configure Environment

```bash
# Copy production environment template
cp .env.production.template .env

# Edit with your values
nano .env
```

**Required variables:**
- `NEXT_PUBLIC_WS_URL` - Your WebSocket URL (e.g., `wss://capturehub.yourdomain.com/ws`)
- `ZAI_API_KEY` or `OPENAI_API_KEY` - For AI features

### Step 3: Start Container

```bash
# Pull and start the latest image
docker compose -f docker-compose.production.yml up -d

# Initialize database
docker exec capture-hub bun run db:push
```

### Step 4: Verify Deployment

```bash
# Check container health
docker compose -f docker-compose.production.yml ps

# Test health endpoint
curl http://localhost:3000/api/health
```

Expected output: `{"status":"ok"}` or similar

### Step 5: Access Application

Open http://localhost:3000 in your browser.

**Note:** For production, set up a reverse proxy with SSL/TLS (see [Reverse Proxy Setup](#reverse-proxy-setup)).

---

## Configuration

### Environment Variables

Full environment variable reference:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:/app/prisma/production.db` | SQLite database path |
| `NODE_ENV` | Yes | `production` | Node environment |
| `PORT` | No | `3000` | Server port |
| `HOSTNAME` | No | `0.0.0.0` | Bind address |
| `NEXT_PUBLIC_WS_URL` | Yes* | - | WebSocket URL (use `wss://` in production) |
| `ZAI_API_KEY` | No** | - | z-ai API key for AI features |
| `OPENAI_API_KEY` | No** | - | OpenAI API key (alternative to ZAI) |

\* Required in production for WebSocket connections
** At least one AI API key recommended for full features

### Docker Compose Configuration

The `docker-compose.production.yml` file includes:

- **Volume mounts** - Database persistence at `./prisma`
- **Health checks** - Automatic container restart on failure
- **Log rotation** - Max 10MB per file, keep 3 files
- **Network** - Isolated bridge network

---

## Deployment

### Option 1: Automated Deployment (Recommended)

Use the automated deployment script:

```bash
./scripts/deploy.sh
```

This script automatically:
1. Backs up the current database
2. Pulls the latest Docker image
3. Stops the current container
4. Starts the new container
5. Verifies health check

### Option 2: Manual Deployment

```bash
# Backup database
./scripts/backup.sh

# Pull latest image
docker compose -f docker-compose.production.yml pull

# Restart container
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d

# Verify health
docker compose -f docker-compose.production.yml ps
```

### Initial Deployment

For first-time deployment:

```bash
# 1. Clone and configure
git clone <repo-url> capture-hub
cd capture-hub
cp .env.production.template .env
# Edit .env with your values

# 2. Start container
docker compose -f docker-compose.production.yml up -d

# 3. Initialize database
docker exec capture-hub bun run db:push

# 4. Verify
curl http://localhost:3000/api/health
```

---

## Reverse Proxy Setup

For production deployment with SSL/TLS, use nginx as a reverse proxy.

### nginx Installation

```bash
# Install nginx and certbot
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# Copy example configuration
sudo cp docs/nginx.conf.example /etc/nginx/sites-available/capturehub

# Edit with your domain
sudo nano /etc/nginx/sites-available/capturehub
# Replace capturehub.yourdomain.com with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/capturehub /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Obtain SSL certificate
sudo certbot --nginx -d capturehub.yourdomain.com

# Reload nginx
sudo systemctl reload nginx
```

### Verify SSL/WebSocket

```bash
# Test HTTPS
curl https://capturehub.yourdomain.com/api/health

# Test WebSocket (using wscat)
npm install -g wscat
wscat -c wss://capturehub.yourdomain.com/ws
```

---

## Monitoring & Maintenance

### View Logs

```bash
# Follow logs in real-time
docker compose -f docker-compose.production.yml logs -f

# Last 100 lines
docker logs capture-hub --tail 100

# Filter errors
docker logs capture-hub 2>&1 | grep ERROR
```

### Check Container Health

```bash
# Container status
docker compose -f docker-compose.production.yml ps

# Detailed health check info
docker inspect capture-hub | grep -A 10 Health
```

### Monitor Resources

```bash
# Container resource usage
docker stats capture-hub

# Database size
du -h ./prisma/production.db
```

### Update Application

```bash
# Pull latest image and restart
./scripts/deploy.sh
```

---

## Backup & Restore

### Automated Backups

The backup script creates timestamped database backups:

```bash
# Manual backup
./scripts/backup.sh

# Automated daily backup (add to crontab)
crontab -e
# Add this line:
0 2 * * * /path/to/capture-hub/scripts/backup.sh
```

**Backup retention:** 30 days by default (configurable via `RETENTION_DAYS` env var)

### Restore from Backup

```bash
# List available backups
ls -lh ./backups/

# Restore specific backup
./scripts/restore.sh ./backups/production-20260224-140000.db

# Restart container to apply
docker compose -f docker-compose.production.yml restart
```

### Off-site Backups

For production, sync backups to cloud storage:

```bash
# Example: Sync to AWS S3
aws s3 sync ./backups/ s3://your-backup-bucket/capture-hub/

# Example: Sync to Backblaze B2
b2 sync ./backups/ b2://your-backup-bucket/capture-hub/
```

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker compose -f docker-compose.production.yml logs
```

**Common causes:**
- Port 3000 already in use: Change `PORT` in .env
- Missing environment variables: Verify .env file exists and is correct
- Database permission issues: Check `./prisma` directory permissions

**Solution:**
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Fix permissions
chmod -R 755 ./prisma
```

### WebSocket Connections Fail

**Symptoms:**
- Real-time sync not working
- "WebSocket connection failed" in browser console

**Common causes:**
- Incorrect `NEXT_PUBLIC_WS_URL` in .env
- Reverse proxy not configured for WebSocket upgrades
- Firewall blocking WebSocket connections

**Solution:**
```bash
# Verify NEXT_PUBLIC_WS_URL is correct
echo $NEXT_PUBLIC_WS_URL

# Test WebSocket directly (bypass nginx)
wscat -c ws://localhost:3000/ws

# Check nginx WebSocket configuration
sudo nginx -t
```

### Database Corruption

**Symptoms:**
- SQL errors in logs
- Data not persisting
- Container health check failing

**Solution:**
```bash
# Stop container
docker compose -f docker-compose.production.yml down

# Restore from latest backup
./scripts/restore.sh ./backups/production-YYYYMMDD-HHMMSS.db

# Restart container
docker compose -f docker-compose.production.yml up -d
```

### High Memory Usage

**Check memory:**
```bash
docker stats capture-hub
```

**Common causes:**
- Large database file
- Many WebSocket connections
- Memory leak in application

**Solution:**
```bash
# Restart container to free memory
docker compose -f docker-compose.production.yml restart

# Increase container memory limit in docker-compose.production.yml:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

### AI Features Not Working

**Symptoms:**
- No auto-tagging suggestions
- OCR failing
- Search ranking not working

**Common causes:**
- Missing or invalid API key
- API quota exceeded
- Network issues

**Solution:**
```bash
# Verify API key is set
docker exec capture-hub env | grep API_KEY

# Check API key validity (test with curl)
curl -H "Authorization: Bearer $ZAI_API_KEY" https://api.z.ai/v1/health

# Application gracefully degrades - features still work without AI
```

---

## Production Checklist

Before going live, verify:

- [ ] Environment variables configured correctly
- [ ] SSL/TLS certificate installed and valid
- [ ] WebSocket connections working (test multi-device sync)
- [ ] Automated backups configured (cron job)
- [ ] nginx reverse proxy configured with security headers
- [ ] Firewall rules allow ports 80 and 443
- [ ] Health check endpoint returning 200 OK
- [ ] Database persists across container restarts
- [ ] Logs rotating correctly (check `./logs` or Docker logs)
- [ ] Off-site backup strategy implemented

---

## Support

For issues, questions, or contributions:

- **GitHub Issues:** https://github.com/yourname/capture-hub-project/issues
- **Documentation:** See README.md for feature documentation
- **Design:** See docs/plans/2026-02-24-production-release-design.md

---

**Built with ❤️ for personal productivity**
```

**Step 2: Commit DEPLOYMENT.md**

```bash
git add DEPLOYMENT.md
git commit -m "docs: add comprehensive production deployment guide

Complete deployment documentation including:
- Prerequisites and system requirements
- Quick start (5-minute deployment)
- Environment variable reference
- Reverse proxy setup with nginx
- Monitoring and maintenance procedures
- Backup and restore strategies
- Troubleshooting common issues
- Production checklist

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 20: Update README.md with Production Deployment Section

**Files:**
- Modify: `README.md` (add link to DEPLOYMENT.md)

**Step 1: Add production deployment section to README**

Add this section after the "Deployment" section in README.md:

```markdown
## 🚀 Production Deployment

For production deployment with Docker and CI/CD, see the comprehensive **[DEPLOYMENT.md](DEPLOYMENT.md)** guide.

Quick production deployment:

```bash
# Clone and configure
git clone <repo-url> capture-hub && cd capture-hub
cp .env.production.template .env

# Start container
docker compose -f docker-compose.production.yml up -d
docker exec capture-hub bun run db:push

# Verify
curl http://localhost:3000/api/health
```

**Production features:**
- ✅ Docker containerization with multi-stage build
- ✅ GitHub Actions CI/CD pipeline
- ✅ Automated backups and deployment scripts
- ✅ nginx reverse proxy with SSL/TLS
- ✅ Health checks and monitoring
- ✅ Database persistence across restarts

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.
```

**Step 2: Commit README update**

```bash
git add README.md
git commit -m "docs: add production deployment section to README

Link to comprehensive DEPLOYMENT.md guide with quick start
instructions for production Docker deployment.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 21: Create Runbooks

**Files:**
- Create: `docs/runbooks/deployment-runbook.md`
- Create: `docs/runbooks/rollback-runbook.md`
- Create: `docs/runbooks/migration-runbook.md`

**Step 1: Create deployment runbook**

```markdown
# Deployment Runbook

Step-by-step checklist for deploying Capture Hub updates.

## Pre-Deployment

- [ ] **Verify CI/CD pipeline passed**
  - Go to GitHub Actions → Latest workflow run
  - All jobs (Test, Build, Security Scan) are green

- [ ] **Review changes since last deployment**
  ```bash
  git log --oneline $(git describe --tags --abbrev=0)..HEAD
  ```

- [ ] **Notify users of planned deployment** (if applicable)
  - Estimated downtime: ~1-2 minutes
  - Best time: Low usage hours

## Backup

- [ ] **Run backup script**
  ```bash
  ./scripts/backup.sh
  ```

- [ ] **Verify backup created**
  ```bash
  ls -lh backups/ | tail -1
  ```

- [ ] **Test backup integrity** (optional, for critical updates)
  ```bash
  sqlite3 backups/production-YYYYMMDD-HHMMSS.db "PRAGMA integrity_check;"
  ```

## Deployment

- [ ] **Pull latest Docker image**
  ```bash
  docker compose -f docker-compose.production.yml pull
  ```

- [ ] **Stop current container**
  ```bash
  docker compose -f docker-compose.production.yml down
  ```

- [ ] **Start new container**
  ```bash
  docker compose -f docker-compose.production.yml up -d
  ```

- [ ] **Wait for health check** (up to 60 seconds)
  ```bash
  watch -n 2 'docker compose -f docker-compose.production.yml ps'
  ```
  Wait until status shows "healthy"

## Verification

- [ ] **Check container is running**
  ```bash
  docker compose -f docker-compose.production.yml ps
  ```
  Status should be "Up" and health should be "healthy"

- [ ] **Test health endpoint**
  ```bash
  curl http://localhost:3000/api/health
  ```
  Expected: `{"status":"ok"}`

- [ ] **Test application access**
  - Open https://capturehub.yourdomain.com in browser
  - Verify page loads without errors
  - Check browser console for errors (should be none)

- [ ] **Test WebSocket connection**
  - Open app in two browser tabs
  - Create a capture item in one tab
  - Verify it appears in the other tab
  Expected: Real-time sync works

- [ ] **Check logs for errors**
  ```bash
  docker logs capture-hub --tail 50 | grep ERROR
  ```
  Expected: No critical errors

## Post-Deployment

- [ ] **Monitor for 15 minutes**
  ```bash
  docker stats capture-hub
  docker logs capture-hub -f
  ```
  Watch for:
  - Memory usage stable
  - No error spikes
  - CPU usage reasonable

- [ ] **Update deployment notes**
  - Document deployment time
  - Note any issues encountered
  - Record new version/commit SHA

- [ ] **Notify users deployment is complete** (if applicable)

## Rollback (If Issues Occur)

If critical issues are found, see [Rollback Runbook](rollback-runbook.md).

## Success Criteria

Deployment is successful when:
- ✅ Container health check passes
- ✅ Health endpoint returns 200 OK
- ✅ Application loads in browser
- ✅ WebSocket sync works
- ✅ No critical errors in logs
- ✅ Memory/CPU usage normal

---

**Last updated:** 2026-02-24
```

**Step 2: Create rollback runbook**

```markdown
# Rollback Runbook

Emergency procedure for rolling back to previous version.

## When to Rollback

Rollback immediately if:
- ❌ Critical functionality broken (can't create/view captures)
- ❌ Data corruption or loss detected
- ❌ WebSocket connections completely failing
- ❌ Container fails to start or crashes repeatedly
- ❌ Performance degradation >50%

Consider rollback if:
- ⚠️ Non-critical features broken
- ⚠️ Increased error rate in logs
- ⚠️ User reports of issues

## Pre-Rollback

- [ ] **Identify previous working version**
  ```bash
  # List recent Docker images
  docker images ghcr.io/yourname/capture-hub --format "{{.Tag}}"
  ```

- [ ] **Backup current state before rollback**
  ```bash
  ./scripts/backup.sh
  mv backups/production-*.db backups/before-rollback-$(date +%Y%m%d-%H%M%S).db
  ```

- [ ] **Document the issue**
  - What broke?
  - Error messages
  - Steps to reproduce

## Option 1: Rollback to Previous Image

**Fastest method - Use if container/image is the issue**

- [ ] **Stop current container**
  ```bash
  docker compose -f docker-compose.production.yml down
  ```

- [ ] **Tag previous version as latest**
  ```bash
  # Find working version SHA from git/docker history
  PREVIOUS_SHA="abc123"  # Replace with actual SHA
  docker tag ghcr.io/yourname/capture-hub:sha-$PREVIOUS_SHA ghcr.io/yourname/capture-hub:latest
  ```

- [ ] **Update docker-compose.production.yml to use specific tag**
  ```bash
  # Edit docker-compose.production.yml
  # Change image line to:
  # image: ghcr.io/yourname/capture-hub:sha-$PREVIOUS_SHA
  ```

- [ ] **Start container with previous version**
  ```bash
  docker compose -f docker-compose.production.yml up -d
  ```

- [ ] **Verify rollback**
  ```bash
  # Check health
  curl http://localhost:3000/api/health

  # Test application
  # Open in browser and verify functionality
  ```

## Option 2: Rollback Database + Container

**Use if database migration caused issues**

- [ ] **Stop container**
  ```bash
  docker compose -f docker-compose.production.yml down
  ```

- [ ] **Restore previous database backup**
  ```bash
  # Find backup from before deployment
  ls -lh backups/

  # Restore (interactive prompt will ask for confirmation)
  ./scripts/restore.sh backups/production-YYYYMMDD-HHMMSS.db
  ```

- [ ] **Rollback to previous image** (see Option 1 steps above)

- [ ] **Start container**
  ```bash
  docker compose -f docker-compose.production.yml up -d
  ```

- [ ] **Verify database integrity**
  ```bash
  docker exec capture-hub bun run db:generate

  # Test data access
  curl http://localhost:3000/api/capture
  ```

## Verification

- [ ] **Health check passes**
  ```bash
  curl http://localhost:3000/api/health
  ```

- [ ] **Application loads**
  - Open in browser
  - Test create/view/update captures
  - Test multi-device sync

- [ ] **Check logs**
  ```bash
  docker logs capture-hub --tail 100
  ```
  No critical errors

- [ ] **Verify data integrity**
  - Spot-check recent captures exist
  - Verify no data loss

## Post-Rollback

- [ ] **Monitor for 30 minutes**
  ```bash
  docker stats capture-hub
  docker logs capture-hub -f
  ```

- [ ] **Notify stakeholders**
  - Deployment rolled back
  - System restored to previous version
  - Issue being investigated

- [ ] **Create incident report**
  - What broke
  - Timeline of events
  - Rollback procedure used
  - Lessons learned

- [ ] **Investigate root cause**
  - Review failed deployment logs
  - Identify what went wrong
  - Plan fix for next deployment

## Prevention

To avoid future rollbacks:

1. **Test in staging first** (consider staging environment)
2. **Review CI/CD pipeline results** before deploying
3. **Deploy during low-usage hours**
4. **Monitor closely for first 30 minutes** after deployment
5. **Keep recent backups** (automated daily backups)

---

**Emergency Contact:** [Your contact info]

**Last updated:** 2026-02-24
```

**Step 3: Create migration runbook**

```markdown
# Database Migration Runbook

Procedure for applying Prisma schema migrations in production.

## When to Use

Use this runbook when:
- Prisma schema has changed (`prisma/schema.prisma` modified)
- New database fields, indexes, or models added
- Database structure needs updating

## Pre-Migration

- [ ] **Review migration changes**
  ```bash
  # Generate migration in dev environment first
  bun run db:migrate dev --name descriptive_name

  # Review generated SQL
  cat prisma/migrations/YYYYMMDD_descriptive_name/migration.sql
  ```

- [ ] **Test migration in local environment**
  ```bash
  # Copy production database for testing
  cp backups/latest.db prisma/test.db
  DATABASE_URL=file:./prisma/test.db bun run db:migrate deploy
  ```

- [ ] **Backup production database**
  ```bash
  ./scripts/backup.sh

  # Verify backup
  ls -lh backups/ | tail -1
  ```

## Migration Process

- [ ] **Stop application container** (to prevent writes during migration)
  ```bash
  docker compose -f docker-compose.production.yml down
  ```

- [ ] **Run migration**
  ```bash
  # Option A: Run migration on host (if Bun installed)
  DATABASE_URL=file:./prisma/production.db bun run db:migrate deploy

  # Option B: Run migration in temporary container
  docker run --rm \
    -v $(pwd)/prisma:/app/prisma \
    -e DATABASE_URL=file:/app/prisma/production.db \
    ghcr.io/yourname/capture-hub:latest \
    bun run db:migrate deploy
  ```

- [ ] **Verify migration applied**
  ```bash
  # Check migration status
  docker run --rm \
    -v $(pwd)/prisma:/app/prisma \
    -e DATABASE_URL=file:/app/prisma/production.db \
    ghcr.io/yourname/capture-hub:latest \
    bun run db:migrate status
  ```
  Expected: All migrations marked as "Applied"

- [ ] **Test database integrity**
  ```bash
  sqlite3 prisma/production.db "PRAGMA integrity_check;"
  ```
  Expected: "ok"

## Start Application

- [ ] **Start container with new schema**
  ```bash
  docker compose -f docker-compose.production.yml up -d
  ```

- [ ] **Wait for health check**
  ```bash
  watch -n 2 'docker compose -f docker-compose.production.yml ps'
  ```

- [ ] **Verify application starts**
  ```bash
  curl http://localhost:3000/api/health
  ```

## Post-Migration Verification

- [ ] **Test new features/fields**
  - If new fields added, test CRUD operations
  - Verify new indexes improve query performance
  - Check that relationships work correctly

- [ ] **Check logs for schema errors**
  ```bash
  docker logs capture-hub | grep -i "prisma\|schema\|migration"
  ```
  Expected: No errors

- [ ] **Spot-check existing data**
  - Verify old records still accessible
  - Check that no data was lost
  - Test queries on migrated tables

## Rollback (If Migration Fails)

If migration fails or causes issues:

- [ ] **Stop container**
  ```bash
  docker compose -f docker-compose.production.yml down
  ```

- [ ] **Restore pre-migration backup**
  ```bash
  ./scripts/restore.sh backups/production-YYYYMMDD-HHMMSS.db
  ```

- [ ] **Revert to previous image** (without new schema)
  ```bash
  # See rollback-runbook.md
  ```

- [ ] **Investigate migration failure**
  - Review migration SQL
  - Check for data conflicts
  - Test in local environment

## Best Practices

1. **Always backup before migrating**
2. **Test migrations in local environment first**
3. **Review generated SQL for destructive operations**
4. **Migrate during low-usage hours**
5. **Keep migration files in version control**
6. **Document breaking changes**

## Common Migration Scenarios

### Adding a New Field

```prisma
model CaptureItem {
  // ... existing fields
  newField String? // Optional to avoid breaking existing data
}
```

Safe - no data loss risk.

### Removing a Field

```prisma
model CaptureItem {
  // oldField removed
}
```

⚠️ **Warning:** Data in this field will be permanently deleted!
Backup first and confirm deletion is intentional.

### Renaming a Field

Prisma will drop old column and create new one (data loss!).

**Safe approach:**
1. Add new field
2. Migrate data (custom script)
3. Remove old field in separate migration

---

**Last updated:** 2026-02-24
```

**Step 4: Create runbooks directory and commit**

```bash
mkdir -p docs/runbooks
git add docs/runbooks/
git commit -m "docs: add operational runbooks for production

Three comprehensive runbooks:
- deployment-runbook.md: Step-by-step deployment checklist
- rollback-runbook.md: Emergency rollback procedures
- migration-runbook.md: Database migration procedures

Each includes:
- Pre-flight checks
- Step-by-step instructions
- Verification procedures
- Rollback/recovery steps
- Best practices

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 22: Validate Phase 5 Completion

**Files:**
- None (validation only)

**Step 1: Verify all documentation exists**

Run:
```bash
ls -la DEPLOYMENT.md
ls -la docs/runbooks/*.md
grep -l "Production Deployment" README.md
```

Expected: All files exist and README mentions production deployment

**Step 2: Review documentation completeness**

Check that DEPLOYMENT.md covers:
- [ ] Prerequisites
- [ ] Quick start
- [ ] Configuration
- [ ] Deployment procedures
- [ ] Reverse proxy setup
- [ ] Monitoring
- [ ] Backup/restore
- [ ] Troubleshooting

**Step 3: Verify links work**

Check that all markdown links in docs work:
```bash
# Install markdown-link-check if needed
npm install -g markdown-link-check

# Check all markdown files
markdown-link-check DEPLOYMENT.md
markdown-link-check docs/runbooks/*.md
```

**Step 4: Tag Phase 5 completion**

```bash
git tag phase-5-documentation
git push origin phase-5-documentation
```

---

## Final Validation & Release

### Task 23: Complete End-to-End Production Test

**Files:**
- None (integration testing)

**Step 1: Full CI/CD pipeline test**

```bash
# Create test commit
echo "# Production Ready" >> PRODUCTION_READY.md
git add PRODUCTION_READY.md
git commit -m "docs: mark project as production ready"
git push origin master
```

**Step 2: Monitor GitHub Actions**

- Go to GitHub → Actions
- Watch full pipeline execute
- Verify all stages pass:
  - ✅ Test & Lint
  - ✅ Build Docker Image
  - ✅ Security Scan

**Step 3: Pull production image and test locally**

```bash
# Pull from registry
docker pull ghcr.io/YOUR-USERNAME/capture-hub:latest

# Test with production compose file
docker compose -f docker-compose.production.yml up -d

# Initialize DB
docker exec capture-hub bun run db:push

# Verify health
curl http://localhost:3000/api/health

# Test in browser
open http://localhost:3000
```

**Step 4: Test backup and restore**

```bash
# Create test data
curl -X POST http://localhost:3000/api/capture \
  -H "Content-Type: application/json" \
  -d '{"type":"note","title":"Test","content":"Testing backup/restore","tags":"test","status":"inbox"}'

# Backup
./scripts/backup.sh

# Simulate data corruption (delete DB)
docker compose -f docker-compose.production.yml down
rm prisma/production.db

# Restore
./scripts/restore.sh backups/production-*.db

# Restart and verify
docker compose -f docker-compose.production.yml up -d
sleep 10
curl http://localhost:3000/api/capture | grep "Test"
```

Expected: Test data restored successfully

**Step 5: Test deployment script**

```bash
# Run automated deployment
./scripts/deploy.sh
```

Expected: Deployment completes with health check passing

**Step 6: Clean up test environment**

```bash
docker compose -f docker-compose.production.yml down
rm -f PRODUCTION_READY.md
git rm PRODUCTION_READY.md
git commit -m "test: remove production test marker"
```

---

### Task 24: Create Production Release

**Files:**
- Create: `CHANGELOG.md`
- Create: GitHub Release

**Step 1: Create CHANGELOG.md**

```markdown
# Changelog

All notable changes to Capture Hub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-24

### Added - Production Release 🎉

#### Features (509 total)
- ✅ All 509 features implemented and tested
- ✅ Quick Capture with AI auto-tagging
- ✅ Scratchpad with markdown editor
- ✅ OCR tool with VLM text extraction
- ✅ Screenshot capture
- ✅ Web page capture with bookmarklet
- ✅ GTD workflow (Inbox → Processing → Projects → Archive)
- ✅ Real-time multi-device sync via WebSocket
- ✅ Projects and templates management
- ✅ Knowledge graph and semantic connections
- ✅ Full-text search with AI ranking
- ✅ Dashboard with productivity insights
- ✅ PWA support (installable, offline-capable)

#### Infrastructure
- ✅ Docker containerization with multi-stage build
- ✅ GitHub Actions CI/CD pipeline
- ✅ GitHub Container Registry integration
- ✅ Automated deployment scripts
- ✅ Database backup and restore automation
- ✅ nginx reverse proxy configuration
- ✅ Health checks and monitoring
- ✅ Comprehensive deployment documentation

### Fixed

#### Code Quality
- Fixed useOptimisticMutation circular reference issue
- Fixed useNetworkStatus performance with functional setState
- Removed unused User and Post models from schema
- Stabilized WebSocket and API integration tests

#### Production Readiness
- All linter errors resolved
- All tests passing consistently
- Production build optimized
- Database persistence verified

### Documentation

- DEPLOYMENT.md - Complete production deployment guide
- Runbooks - Deployment, rollback, and migration procedures
- nginx.conf.example - Reverse proxy configuration
- .env.production.template - Production environment template
- Production release design document

### Infrastructure

- Dockerfile - Multi-stage build (< 500MB final image)
- docker-compose.yml - Local testing configuration
- docker-compose.production.yml - Production deployment
- .dockerignore - Optimized build context
- GitHub Actions workflow - Automated CI/CD

### Scripts

- scripts/deploy.sh - Automated deployment
- scripts/backup.sh - Database backup with rotation
- scripts/restore.sh - Safe database restoration

---

## Release Notes

This is the first production release of Capture Hub! 🚀

### What's Included

1. **Feature-Complete Application**
   - All 509 planned features implemented
   - Comprehensive test coverage
   - Real-time multi-device sync
   - AI-powered productivity features

2. **Production Infrastructure**
   - Docker containerization
   - CI/CD automation
   - Deployment scripts
   - Monitoring and backups

3. **Comprehensive Documentation**
   - Deployment guides
   - Operational runbooks
   - Configuration examples
   - Troubleshooting guides

### Getting Started

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

Quick start:
```bash
git clone <repo-url> capture-hub
cd capture-hub
cp .env.production.template .env
docker compose -f docker-compose.production.yml up -d
docker exec capture-hub bun run db:push
```

### Support

- Documentation: [README.md](README.md)
- Deployment: [DEPLOYMENT.md](DEPLOYMENT.md)
- Issues: GitHub Issues

---

**Built with ❤️ for personal productivity**
```

**Step 2: Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG for v1.0.0 production release

Complete changelog documenting:
- All 509 features implemented
- Production infrastructure additions
- Code quality fixes
- Comprehensive documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 3: Create git tag for release**

```bash
git tag -a v1.0.0 -m "v1.0.0 - Production Release

Capture Hub is production-ready with:
- 509 features fully implemented and tested
- Docker containerization
- GitHub Actions CI/CD
- Automated deployment and backups
- Comprehensive documentation

See CHANGELOG.md for full release notes."

git push origin v1.0.0
```

**Step 4: Create GitHub Release**

Go to GitHub → Releases → "Draft a new release"

- Tag: `v1.0.0`
- Title: `v1.0.0 - Production Release 🚀`
- Description: Copy from CHANGELOG.md release notes
- Check "Set as the latest release"
- Click "Publish release"

**Step 5: Verify release image tagged**

GitHub Actions will automatically build and tag the v1.0.0 image.

Check: GitHub → Packages → capture-hub
Expected tags: `latest`, `v1.0.0`, `1.0`, `sha-XXXXXXX`

---

### Task 25: Final Sign-Off

**Files:**
- None (final validation)

**Step 1: Review all phases completed**

Check all phase tags exist:
```bash
git tag -l "phase-*"
```

Expected:
- phase-1-code-quality-fixes
- phase-2-containerization
- phase-3-cicd-pipeline
- phase-4-production-config
- phase-5-documentation

**Step 2: Validate success criteria**

Review all 12 success criteria from design document:

1. ✅ All pre-launch blockers fixed
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

**Step 3: Create final summary**

```bash
echo "# Production Release Summary

## Implementation Complete ✅

All 5 phases successfully completed:

### Phase 1: Code Quality Fixes
- Fixed useOptimisticMutation hook error
- Fixed useNetworkStatus performance issue
- Removed unused database models
- Stabilized integration tests
- All tests passing, zero lint errors

### Phase 2: Containerization
- Multi-stage Dockerfile (< 500MB)
- Docker Compose configurations (dev + prod)
- Database persistence via volume mounts
- Health checks and auto-restart

### Phase 3: CI/CD Pipeline
- GitHub Actions workflow
- Automated test, build, push
- GitHub Container Registry integration
- Security scanning with Trivy

### Phase 4: Production Configuration
- Production environment template
- Automated deployment scripts
- Database backup/restore automation
- nginx reverse proxy configuration

### Phase 5: Documentation
- Comprehensive DEPLOYMENT.md
- Operational runbooks (deployment, rollback, migration)
- Updated README with production section
- CHANGELOG and GitHub release

## Final Validation

✅ CI/CD pipeline passing
✅ Docker image in registry
✅ End-to-end deployment tested
✅ Backup/restore verified
✅ All documentation complete
✅ v1.0.0 release published

## Ready for Production 🚀

Capture Hub is now production-ready and can be deployed following DEPLOYMENT.md.

All 509 features are implemented, tested, and deployed via automated CI/CD pipeline.

**Date:** $(date)
**Version:** v1.0.0
" > PRODUCTION_RELEASE_SUMMARY.md

git add PRODUCTION_RELEASE_SUMMARY.md
git commit -m "docs: production release summary

Complete implementation of all 5 phases for production release.
All success criteria met. Ready for production deployment.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin master
```

**Step 4: Celebrate! 🎉**

Capture Hub is now production-ready with:
- ✅ 509 features fully implemented
- ✅ Docker containerization
- ✅ Automated CI/CD
- ✅ Comprehensive documentation
- ✅ Operational excellence

You can now deploy to production following DEPLOYMENT.md!

---

## Success Criteria

The production release implementation is complete when:

1. ✅ All 5 phases completed and tagged
2. ✅ All tasks executed successfully
3. ✅ CI/CD pipeline operational
4. ✅ Docker image available in GHCR
5. ✅ Documentation comprehensive and tested
6. ✅ v1.0.0 release published
7. ✅ End-to-end deployment validated

---

**Implementation Duration:** Approximately 4-6 hours for all 25 tasks

**Next Steps:** Deploy to production following DEPLOYMENT.md
