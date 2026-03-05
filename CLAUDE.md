# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (custom server — do NOT use `next dev` directly)
bun run dev

# Build
bun run build

# Lint
bun run lint

# Tests
bun run test          # watch mode
bun run test:run      # single run (CI)
bun run test:coverage

# Run a single test file
bun run test src/lib/db.test.ts

# Database
bun run db:push       # sync schema (dev)
bun run db:migrate    # create migration (production)
bun run db:generate   # regenerate Prisma client after schema change
```

## Architecture

### Server Entry Point

`server.ts` is the actual entry point — it creates an HTTP server, attaches the WebSocket server on `/ws`, and passes all other requests to Next.js. Do **not** use `next dev` or `next start` directly; those skip the WebSocket server.

### Request Path

```
HTTP Request → server.ts → Next.js App Router → src/app/api/**/route.ts
WS Upgrade (/ws) → server.ts → src/lib/websocket.ts
```

### API Layer

All API routes live in `src/app/api/`. Every route uses two helpers:
- `apiError(message, status, options)` from `src/lib/api-route-handler.ts` for consistent `{ error, details }` error shapes
- `classifyError(error)` in catch blocks to map Prisma/syntax errors to correct HTTP status codes

Tags and metadata fields are stored as JSON strings in SQLite. Always use `safeParseTags()` / `safeParseJSON()` from `src/lib/parse-utils.ts` when reading them, and `JSON.stringify()` when writing.

### Real-Time Sync

Every mutation must broadcast after the DB write succeeds. Use the typed helpers in `src/lib/ws-broadcast.ts` (e.g., `broadcastItemCreated`, `broadcastStatsUpdated`). Never call `broadcast()` from `websocket.ts` directly in route files. Always recalculate and emit `STATS_UPDATED` after any item mutation.

The full event type registry is in `src/lib/ws-events.ts`. Client-side subscriptions use `on(WSEventType.X, handler)` from `useWebSocket()` — the returned function is the unsubscribe cleanup.

### AI Integration

All AI calls go through `src/lib/ai.ts` — never import `z-ai-web-dev-sdk` (ZAI) directly in routes or components. ZAI initializes lazily with a 5-second timeout. Always call `isAIConfigured()` before AI operations; if unconfigured, return a graceful fallback. AI failures must never block a core save — wrap in try/catch.

### Client State

No global state library for captures — components subscribe to WebSocket events and maintain local state via `useState`. `useOptimisticMutation` (`src/hooks/useOptimisticMutation.ts`) wraps mutations that need instant feedback: provide `onOptimisticUpdate` to apply the change immediately and `onRollback` to revert on error.

### Database

`src/lib/db.ts` exports a singleton `db` (PrismaClient) attached to `globalThis` to survive Next.js hot reloads. For operations that may contend (SQLite lock), use `withRetry(fn)` from the same file.

### Data Model Notes

- `CaptureItem.status` GTD flow: `inbox → active → someday → done → archived`
- `CaptureItem.type`: `note | screenshot | ocr | web | scratchpad`
- `CaptureItem.tags` and `.metadata`: stored as JSON strings — always parse at boundaries
- Composite DB indexes exist for `(status, pinned, createdAt)` — queries filtering on status should include these fields for performance

## Key Constraints

- **Single tenant, no auth** — no authentication layer; all API routes are publicly accessible on the local network by design
- **Bun runtime** — use `bun` for package management and script execution, not `npm` or `yarn`
- **shadcn/ui components** live in `src/components/ui/` — never modify them; create wrapper components instead
- **`@/`** is the TypeScript path alias for `src/`
