---
name: project-conventions
description: Capture Hub architectural conventions — AI patterns, WebSocket sync, API routes, data models, and component organization. Load this before modifying any core feature.
user-invocable: false
---

# Capture Hub Project Conventions

## Runtime & Build

- **Runtime**: Bun (`bun run dev` → `tsx server.ts`)
- **Framework**: Next.js 16 App Router, React 19, TypeScript 5
- **Path alias**: `@/` maps to `src/`
- **Testing**: `bun run test` (Vitest), `bun run test:run` for CI
- **DB migrations**: `bun run db:push` (dev), `bun run db:migrate` (production)

## Data Models (Prisma / SQLite)

All models use `cuid()` for IDs. Key fields:

**CaptureItem** — the central entity:
- `type`: `"note" | "screenshot" | "ocr" | "web" | "scratchpad"`
- `status`: `"inbox" | "active" | "someday" | "done" | "archived"` — GTD workflow
- `tags`: stored as JSON string, always parse/stringify at the boundary
- `metadata`: stored as JSON string for type-specific extras
- `priority`: `"none" | "low" | "medium" | "high"`
- `pinned`: boolean, pinned items sort to top in all views
- Composite indexes exist for `(status, pinned, createdAt)` — use these patterns in queries

**Project**: has `status: "active" | "completed" | "archived"`, `color` as hex string

## AI Integration (z-ai-web-dev-sdk)

All AI calls go through `src/lib/ai.ts`. **Never import ZAI directly in components or API routes.**

Key patterns:
```ts
// Always use the wrapper functions, not ZAI directly
import { extractTextFromImage, autoTagItem, summarizeContent } from '@/lib/ai';

// AI features are optional — always handle the disabled case
import { isAIConfigured } from '@/lib/ai';
if (!isAIConfigured()) return { tags: [] };
```

- ZAI is initialized lazily with a 5s timeout — handle `isMissingApiKey` and `isTimeout` error flags
- All AI calls use `retryWithBackoff` + `circuitBreakers.ai` from `src/lib/error-recovery.ts`
- AI failures must NEVER block the core capture save — wrap in try/catch and degrade gracefully

## API Routes

All API routes use helpers from `src/lib/api-route-handler.ts`:

```ts
import { apiError, classifyError } from '@/lib/api-route-handler';

// Error response shape: { error: string, details?: string }
return apiError('Not found', 404, { logPrefix: '[GET /api/capture/[id]]' });

// In catch blocks:
const { message, status } = classifyError(error);
return apiError(message, status);
```

Security middleware lives in `src/lib/api-security.ts` and `src/lib/rate-limit.ts`. Apply to all public endpoints including the bookmarklet API (`/api/bookmarklet`).

CORS headers are required on `/api/bookmarklet/*` routes — check existing routes for the pattern.

## WebSocket Events

All real-time events use `WSEventType` enum from `src/lib/ws-events.ts`:

```ts
import { WSEventType } from '@/lib/ws-events';

// After any DB mutation, broadcast:
broadcast({ type: WSEventType.ITEM_CREATED, data: item });
broadcast({ type: WSEventType.STATS_UPDATED, data: await getStats() });
```

**Rules:**
1. Broadcast AFTER successful DB write, never before
2. Always recalculate and broadcast `STATS_UPDATED` after any item mutation
3. Payload shapes must match the interfaces in `ws-events.ts` exactly
4. Don't echo back to the sender (use `exclude: socketId` in broadcast)

## WebSocket Client

Access via `useWebSocket()` hook from `src/hooks/useWebSocket.ts`:

```ts
const { send, on, isConnected, requestSync } = useWebSocket();

// Subscribe to events
useEffect(() => {
  const unsubscribe = on(WSEventType.ITEM_CREATED, (data) => { ... });
  return unsubscribe; // Always clean up
}, [on]);
```

Reconnect delays: `[1000, 2000, 4000, 8000, 16000, 30000]` ms, capped at 30s. Heartbeat: 30s PING/PONG.

## Optimistic Mutations

Use `useOptimisticMutation` from `src/hooks/useOptimisticMutation.ts` for any mutation that should feel instant:

```ts
const { mutate } = useOptimisticMutation({
  mutationFn: (data) => apiClient.post('/api/capture', data),
  onOptimisticUpdate: (data) => { /* update local state immediately */ },
  onError: (error, rollback) => rollback(), // always provide rollback
});
```

## Component Organization

```
src/
  app/              # Next.js App Router pages and layouts
  components/       # Shared UI components (shadcn/ui wrappers go here)
  contexts/         # React contexts (WebSocketContext, etc.)
  hooks/            # Custom React hooks
  lib/              # Pure utilities, API helpers, AI wrappers
  ai-logic/         # Prompt templates and AI processing pipelines
```

- shadcn/ui components are in `src/components/ui/` — never modify them directly, extend via wrapper components
- Animations use Framer Motion — follow patterns in `src/lib/animations.ts`
- Toast notifications use Sonner: `import { toast } from 'sonner'`

## Styling

- Tailwind CSS 4 — use `cn()` from `src/lib/utils.ts` for conditional classes
- Theme: shadcn/ui "New York" style, dark/light via `next-themes`
- No inline styles except for dynamic values that can't be expressed as Tailwind classes

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite file path |
| `ZAI_API_KEY` | z-ai-web-dev-sdk key (or use `OPENAI_API_KEY`) |
| `NEXT_PUBLIC_WS_URL` | Override WS endpoint (auto-detected from window.location if unset) |

Never hardcode secrets. Never edit `.env` directly — update `.env.example` for documentation.
