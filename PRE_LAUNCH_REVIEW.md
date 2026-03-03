# Capture Hub - Pre-Production Launch Review

## 1. Documentation & Requirements
- **Status**: Excellent.
- **Findings**: The `app_spec.txt` and `README.md` are highly detailed, covering the architecture, features, API endpoints, database schema, and deployment steps comprehensively.
- **Action Items**: Ensure `NEXT_PUBLIC_WS_URL` and `ZAI_API_KEY` are documented clearly for production deployment environments.

## 2. Code Architecture & Quality
- **Status**: Good, but has some linting and hook dependency issues.
- **Findings**:
  - The codebase uses a solid stack (Next.js App Router, TypeScript, Tailwind, Prisma).
  - ESLint reports 75 problems (mostly `@typescript-eslint/no-require-imports` in test/script files).
  - React Hooks linting caught a critical issue in `useOptimisticMutation.ts` where `executeMutation` is accessed before it is declared.
  - State is being set synchronously within an effect in `useNetworkStatus.ts`.
- **Action Items**:
  - Fix the `useOptimisticMutation` hook to prevent runtime crashes during optimistic updates.
  - Fix the `useNetworkStatus` hook to avoid cascading renders.
  - Resolve the `require()` lint errors in scripts/tests if they are meant to be ESM or configure ESLint to ignore them.

## 3. Database & Data Access
- **Status**: Solid.
- **Findings**:
  - Prisma schema is well-structured with appropriate indexes for querying (e.g., `status`, `type`, `createdAt`).
  - Contains all the required models (`CaptureItem`, `Project`, `Template`, `ItemLink`, `ConnectedDevice`).
  - Contains extraneous `User` and `Post` models in `schema.prisma` that are not part of the app specification.
- **Action Items**:
  - Remove unused `User` and `Post` models from `prisma/schema.prisma` to keep the database clean before production.

## 4. Testing & Deployment Readiness
- **Status**: Needs minor test fixes, but build succeeds.
- **Findings**:
  - The production build (`bun run build`) succeeds and statically generates pages efficiently.
  - We ran `vitest` and fixed a few broken integration tests related to Prisma queries in `fixtures.ts` and `db.test.ts`.
  - The WebSocket test server and API tests are well put together, but the API integration tests for WebSocket multi-device simulation currently timeout occasionally, and fetch tests for `http://localhost:3100` fail if the test server isn't properly stubbed/started on that port.
- **Action Items**:
  - Stabilize the WebSocket integration tests (they occasionally timeout waiting for messages).
  - Ensure the API tests correctly start the server on port 3100 before running `fetch` requests, or use Next.js test utilities.

## 5. Security & Performance
- **Status**: Good.
- **Findings**:
  - CORS is handled for the bookmarklet API.
  - WebSocket connections use standard WS, but there is no authentication mechanism (expected, as it's a single-tenant app).
  - Production build optimizations are working correctly.
- **Action Items**:
  - Ensure the SQLite database file (`prisma/dev.db` or production equivalent) is stored in a secure, persistent volume when deployed (e.g., not ephemeral container storage).

## 🎯 Recommended Blockers to Fix Before Launch:
1. **Critical Hook Error**: Fix `useOptimisticMutation.ts` (Cannot access `executeMutation` before initialization).
2. **Hook Performance**: Fix `useNetworkStatus.ts` (Setting state synchronously in an effect).
3. **Database Cleanup**: Remove `User` and `Post` models from `schema.prisma`.
4. **Test Stabilization**: Fix failing integration tests so the CI/CD pipeline is fully green.
