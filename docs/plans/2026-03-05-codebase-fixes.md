# Codebase Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 112 issues identified in the full codebase review, covering security vulnerabilities, data integrity bugs, memory leaks, WebSocket correctness, and frontend quality issues.

**Architecture:** Work executes in two waves. Wave 1 contains fully independent tracks (different files, no overlap). Wave 2 applies security hardening and quality fixes to API routes (split by route group to avoid conflicts). Each track is assigned to a separate agent.

**Tech Stack:** Next.js 16 App Router, Bun, TypeScript 5, Prisma 6 + SQLite, React 19, WebSocket (ws), z-ai-web-dev-sdk, Zod 4, shadcn/ui, Vitest

---

## WAVE 1 — All tracks fully independent, run in parallel

---

### Track A: Security Infrastructure

**Files:**
- Modify: `next.config.ts`
- Create: `src/middleware.ts`
- Modify: `src/lib/csrf.ts`
- Modify: `src/lib/storage.ts`

**Fixes:** #8 (CSP headers), #9 (ignoreBuildErrors), #10 (SSRF), #13 (file type), #15 (CSRF token crypto), #19 (NEXT_PUBLIC prefix), #16 (missing middleware.ts)

#### Task A1: Add security headers to next.config.ts

Remove `typescript: { ignoreBuildErrors: true }` and `reactStrictMode: false`.
Add a `headers()` export:

```ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self'",
            "connect-src 'self' ws: wss:",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
  ];
},
```

Keep `output: "standalone"`. Fix any TypeScript errors that surface after removing `ignoreBuildErrors`.

**Verify:** `bun run build` completes without type errors.

#### Task A2: Create src/middleware.ts

Create a Next.js middleware that adds security headers and basic rate-limit enforcement to all routes:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllSecurityHeaders } from '@/lib/csrf';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const headers = getAllSecurityHeaders();
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

**Verify:** A curl to any `/api/*` endpoint returns the security headers.

#### Task A3: Fix CSRF token generation

In `src/lib/csrf.ts`:
1. Replace `generateCsrfToken` — use `crypto.randomBytes(32)` instead of `Math.random()`:
```ts
import { randomBytes, createHmac } from 'crypto';
const CSRF_SECRET = process.env.CSRF_SECRET || randomBytes(32).toString('hex');

export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString('hex');
  const ts = Date.now().toString();
  const sig = createHmac('sha256', CSRF_SECRET).update(`${nonce}.${ts}`).digest('hex');
  return Buffer.from(`${nonce}.${ts}.${sig}`).toString('base64url');
}

export function validateCsrfToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const [nonce, ts, sig] = decoded.split('.');
    if (!nonce || !ts || !sig) return false;
    const age = Date.now() - parseInt(ts);
    if (age > 24 * 60 * 60 * 1000 || age < 0) return false;
    const expected = createHmac('sha256', CSRF_SECRET).update(`${nonce}.${ts}`).digest('hex');
    return sig === expected;
  } catch { return false; }
}
```
2. Change `process.env.NEXT_PUBLIC_APP_URL` → `process.env.APP_URL` (remove NEXT_PUBLIC_ prefix, server-only security decision).
3. Remove the development bypass that allows all localhost origins unconditionally — replace with explicit `CSRF_DEV_BYPASS=true` env var check.

#### Task A4: Fix SSRF and file-type validation in storage.ts

In `src/lib/storage.ts`:
1. Add private IP block list before making any fetch:
```ts
import { Resolver } from 'dns/promises';

const PRIVATE_IP_RANGES = [
  /^127\./,/^10\./,/^172\.(1[6-9]|2\d|3[01])\./,/^192\.168\./,
  /^169\.254\./,/^::1$/,/^fc00:/,/^fe80:/,
];

async function isPrivateUrl(url: string): Promise<boolean> {
  try {
    const { hostname } = new URL(url);
    if (PRIVATE_IP_RANGES.some(r => r.test(hostname))) return true;
    const resolver = new Resolver();
    const addresses = await resolver.resolve4(hostname).catch(() => [] as string[]);
    return addresses.some(ip => PRIVATE_IP_RANGES.some(r => r.test(ip)));
  } catch { return true; }
}
```
Call `isPrivateUrl` before `fetch` in `downloadImage`; throw if private.

2. After fetching, validate `Content-Type`:
```ts
const contentType = response.headers.get('content-type') || '';
const ALLOWED_IMAGE_TYPES = ['image/jpeg','image/png','image/gif','image/webp'];
if (!ALLOWED_IMAGE_TYPES.some(t => contentType.startsWith(t))) {
  throw new Error(`Invalid content type: ${contentType}`);
}
```
3. Add a 10 MB download size limit: check `Content-Length` header and abort if > 10_485_760.

---

### Track B: SQL Injection Fixes

**Files:**
- Modify: `src/ai/rag-engine.ts`

**Fixes:** #4 (RAG engine $queryRawUnsafe with string interpolation)

#### Task B1: Fix RAG engine SQL injection

In `src/ai/rag-engine.ts`, the `searchPostgres` function uses string interpolation for `excludeIds`, `vectorStr`, and `minScore` in `$queryRawUnsafe`.

Replace with parameterised Prisma `$queryRaw` tagged template (which prevents injection by construction):

```ts
import { Prisma } from '@prisma/client';

// Build the query safely
if (excludeIds.length > 0) {
  // Use $queryRaw with Prisma.sql for safe parameterisation
  const results = await (db as any).$queryRaw(
    Prisma.sql`
      SELECT e."itemId" AS id,
             1 - (e."vector" <=> ${vectorStr}::vector) AS score,
             ci."title",
             LEFT(ci."content", 200) AS snippet
      FROM "Embedding" e
      JOIN "CaptureItem" ci ON ci."id" = e."itemId"
      WHERE 1 - (e."vector" <=> ${vectorStr}::vector) >= ${minScore}
        AND e."itemId" NOT IN (${Prisma.join(excludeIds)})
      ORDER BY e."vector" <=> ${vectorStr}::vector
      LIMIT ${limit}
    `
  );
} else {
  // Same query without the excludeIds clause
}
```

Note: This function only runs when the database has pgvector extension (PostgreSQL mode). The current deployment uses SQLite so this code path falls through to `searchInMemory`. Fix it anyway to prevent future issues.

Replace the `console.error` in the catch block with `loggers.ai.error(...)`.

---

### Track C: AI / Core Lib Fixes

**Files:**
- Modify: `src/lib/ai.ts`
- Modify: `src/lib/error-recovery.ts`
- Modify: `src/lib/query-cache.ts`
- Modify: `src/lib/batch-operations.ts`
- Modify: `src/lib/ai-logger.ts`
- Modify: `src/lib/prisma-types.ts`

**Fixes:** #7 (ZAI permanent error cache), #3 (retry on non-retryable), #4 (cache unbounded), #5 (cache key collision), #29 (batch not transactional), #74 (AI logger O(n) shift), #77 (prisma-types drift)

#### Task C1: Fix ZAI permanent initialization error cache

In `src/lib/ai.ts`:
1. Add a reset function and TTL to the error cache:
```ts
let zaiInitErrorAt: number | null = null;
const ZAI_ERROR_CACHE_TTL = 60_000; // retry after 1 minute

async function getZAI() {
  // Clear cached error if TTL expired
  if (zaiInitError && zaiInitErrorAt && Date.now() - zaiInitErrorAt > ZAI_ERROR_CACHE_TTL) {
    zaiInitError = null;
    zaiInitErrorAt = null;
    zaiInstance = null;
  }
  if (zaiInitError) throw zaiInitError;
  // ... rest of init
}
```
2. When setting `zaiInitError`, also set `zaiInitErrorAt = Date.now()`.
3. Replace all `(err as any).isMissingApiKey = true` with a proper typed error subclass:
```ts
class ZAIInitError extends Error {
  isMissingApiKey?: boolean;
  isTimeout?: boolean;
}
```

#### Task C2: Fix retryWithBackoff non-retryable error

In `src/lib/error-recovery.ts`, the loop retries even non-retryable errors for attempt 0. Fix: check `isRetryable` BEFORE the wait, throw immediately if not retryable:

```ts
if (!isRetryable) {
  throw error; // Don't retry non-retryable errors at all
}
if (attempt === fullConfig.maxRetries) {
  throw error;
}
```

Also add a total timeout guard:
```ts
const totalTimeout = fullConfig.totalTimeoutMs ?? 30_000;
const startTime = Date.now();
// Inside loop, after delay:
if (Date.now() - startTime + delay > totalTimeout) throw lastError;
```

#### Task C3: Fix query-cache unbounded growth + key collision

In `src/lib/query-cache.ts`:
1. Add `maxSize` option (default 500). In `set()`, if `cache.size >= maxSize`, delete the oldest entry (iterate once and delete first key).
2. Fix key generation to use a hash to avoid pipe-separator collision:
```ts
import { createHash } from 'crypto';
// In generateCacheKey:
const sortedParams = Object.keys(params).sort()
  .map(key => `${key}=${JSON.stringify(params[key])}`).join('&');
return createHash('sha256').update(`${prefix}:${sortedParams}`).digest('hex').slice(0, 32);
```

#### Task C4: Make batch operations transactional

In `src/lib/batch-operations.ts`:
1. Wrap `batchUpdateItems` batch loop in `db.$transaction()`:
```ts
await db.$transaction(async (tx) => {
  for (const batch of batches) {
    await Promise.all(batch.map(item => tx.captureItem.update({ ... })));
  }
});
```
2. In `bulkCreateItems`, use `db.$transaction()` so all items are created or none are:
```ts
return await db.$transaction(async (tx) => {
  return Promise.all(items.map(item => tx.captureItem.create({ data: item })));
});
```
Remove the individual try/catch that silently continues on error.

#### Task C5: Fix AI logger O(n) shift + prisma-types

1. In `src/lib/ai-logger.ts`, replace the array with a circular buffer or use `splice(0, 1)` — actually, replace the in-memory array with a fixed-size ring buffer:
```ts
// Instead of shift(), pre-allocate and track head index
// Simplest fix: use .splice(0, aiCallLogs.length - MAX_LOGS) once
if (aiCallLogs.length > MAX_LOGS) {
  aiCallLogs.splice(0, aiCallLogs.length - MAX_LOGS);
}
```

2. In `src/lib/prisma-types.ts`, replace manual type aliases with direct Prisma imports:
```ts
import type { Prisma } from '@prisma/client';
export type CaptureItemWhereInput = Prisma.CaptureItemWhereInput;
export type CaptureItemOrderByWithRelationInput = Prisma.CaptureItemOrderByWithRelationInput;
// etc.
```

---

### Track D: WebSocket Fixes

**Files:**
- Modify: `src/lib/websocket.ts`
- Modify: `src/lib/ws-sync.ts`
- Modify: `src/contexts/WebSocketContext.tsx`

**Fixes:** #18 (heartbeat not cleared on error), #19 (hasMore not implemented), #21 (broadcast during shutdown), #22 (globalThis hot reload), #54 (reconnect stacking), #55 (broadcast without readyState try/catch), #57 (dual heartbeat)

#### Task D1: Fix heartbeat interval leak on error path

In `src/lib/websocket.ts`:
1. In the `ws.on('error')` handler (around line 191), call `clearInterval` on the heartbeat for that socket before closing.
2. Store per-socket heartbeat refs in the `clientMap` (extend the map value type to include the interval ref), or use a separate `WeakMap<WebSocket, NodeJS.Timeout>`.
3. Wrap the `ws.send()` call inside `broadcast()` in try/catch:
```ts
try {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
} catch (err) {
  loggers.server.warn('Broadcast send failed', { error: (err as Error).message });
}
```
4. In the broadcast function, check `isShuttingDown` flag before iterating clients.
5. For dev hot reload safety: in `initializeWebSocketServer`, if `globalForWebSocket.wsServer` already exists, call `shutdownWebSocketServer()` on it before creating a new instance.

#### Task D2: Implement hasMore sync pagination

In `src/lib/ws-sync.ts`, find the `requestSyncFrom()` stub and implement it:
```ts
function requestSyncFrom(timestamp: string): void {
  const ws = getWebSocket(); // get the active connection
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: WSEventType.SYNC_REQUEST,
      data: { since: timestamp },
    }));
  }
}
```
In `handleSyncResponse()`, after merging data, if `hasMore === true`, call `requestSyncFrom(response.timestamp)` to fetch the next page.

#### Task D3: Fix WebSocketContext reconnect stacking + conflict metadata

In `src/contexts/WebSocketContext.tsx`:
1. In the `onclose` handler, call `clearReconnectTimeout()` BEFORE scheduling a new reconnect timeout to prevent stacking.
2. When processing `SYNC_RESPONSE`, before merging, check if any returned item has a `_conflict` flag in its metadata and dispatch a conflict notification event that components can subscribe to.
3. Remove the client-side heartbeat (HEARTBEAT_INTERVAL in WebSocketContext) — the server already sends heartbeats. Keep only the server-side ping/pong.

---

### Track E: Console.log → Logger + Markdown Sanitization

**Files:**
- Modify: `src/lib/offline-queue.ts`
- Modify: `src/lib/conflict-resolution.ts`
- Modify: `src/lib/api-middleware.ts`
- Modify: `src/lib/event-mesh.ts`
- Modify: `src/lib/websocket.ts` (console calls only — do not conflict with Track D)
- Modify: `src/lib/markdown.ts`
- Modify: `src/lib/scraper.ts`

**Fixes:** #30 (console.log throughout), #31 (conflict data in logs), #32 (scraper unsanitized), #33 (markdown XSS)

**Important:** Coordinate with Track D on `websocket.ts` — Track D makes structural changes; Track E only replaces `console.log/warn/error` calls with `loggers.*` equivalents. Apply Track D first; then Track E edits only log lines.

#### Task E1: Replace console.* with structured logger

For each file:
- Import the appropriate logger: `import { loggers } from './logger';`
- Replace `console.log(...)` → `loggers.server.debug(...)`
- Replace `console.warn(...)` → `loggers.server.warn(...)`
- Replace `console.error(...)` → `loggers.server.error(...)`

In `conflict-resolution.ts`, ensure item IDs and timestamps are logged at `debug` level (not `warn`) and redact any content fields:
```ts
loggers.server.debug('Conflict detected', { entityId: id, strategy: 'last-write-wins' });
// NOT: loggers.server.warn('Conflict', { item: fullItemObject })
```

#### Task E2: Sanitize scraper and markdown output

In `src/lib/scraper.ts`, after `turndownService.turndown(html)`:
```ts
import { stripDangerousTags } from './sanitization';
const markdown = turndownService.turndown(cleanHtml);
// Sanitize the source HTML before turndown to prevent XSS in output
const cleanHtml = stripDangerousTags(dom.innerHTML);
```

In `src/lib/markdown.ts`, after `stripMarkdown()`, apply HTML tag stripping:
```ts
import { escapeHtml } from './sanitization';
export function safeStripMarkdown(text: string): string {
  const stripped = stripMarkdown(text);
  return escapeHtml(stripped); // prevent any surviving HTML from being rendered
}
```

---

### Track F: Frontend — Hooks & Page Fixes

**Files:**
- Modify: `src/hooks/useRealtimeEvent.ts`
- Modify: `src/hooks/useKeyboardShortcuts.ts`
- Modify: `src/hooks/useAnimatedNumber.ts`
- Modify: `src/hooks/useOptimisticMutation.ts`
- Modify: `src/hooks/useNetworkStatus.ts`
- Modify: `src/app/page.tsx`

**Fixes:** #58 (useRealtimeEvent deps), #59 (ScratchPad debounce — moved to Track G), #60 (useKeyboardShortcuts re-register), #66 (useAnimatedNumber frame cancel), #67 (useOptimisticMutation void retry), #83 (page.tsx setTimeout), #84 (querySelector)

#### Task F1: Fix useRealtimeEvent dependency array

In `src/hooks/useRealtimeEvent.ts`, replace `eventTypes.join(',')` as a dependency with a stable reference using `useMemo`:
```ts
const stableEventTypes = useMemo(() => eventTypes,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [eventTypes.join(',')]
);
// Use stableEventTypes in useEffect dependency array
```

#### Task F2: Fix useKeyboardShortcuts listener re-registration

In `src/hooks/useKeyboardShortcuts.ts`, the effect re-runs when `disabled` or `disableInInputs` changes because `handleKeyDown` via `useCallback` changes. This is correct behavior — but each run should clean up properly. The current cleanup IS correct as long as `useCallback` maintains reference stability. Verify the `useCallback` dependency array includes `disabled` and `disableInInputs` but no other unstable values. If the function reference changes, the effect's cleanup removes the old listener before adding the new one — this is safe. No change needed IF verified correct. If `handleKeyDown` has additional unstable deps, stabilize them.

#### Task F3: Fix useAnimatedNumber animation frame leak

In `src/hooks/useAnimatedNumber.ts`:
```ts
useEffect(() => {
  // Cancel any existing animation before starting new one
  if (animationFrameRef.current !== null) {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }
  // ... rest of animation setup
  return () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };
}, [target, duration, easing]);
```

#### Task F4: Fix useOptimisticMutation void retry

In `src/hooks/useOptimisticMutation.ts`, the retry toast action uses `void executeMutationRef.current?.(variables, true)`. Replace with proper async handling:
```ts
onClick: () => {
  executeMutationRef.current?.(variables, true)?.catch((err: Error) => {
    loggers?.warn('Retry failed', err.message);
  });
},
```

#### Task F5: Fix page.tsx setTimeout leaks + querySelector

In `src/app/page.tsx`:
1. Store timeout IDs and clear on unmount:
```ts
const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
// In handleSearchResultClick and handleSelectItem:
const id = setTimeout(() => setSearchResultItem(null), 100);
timeoutsRef.current.push(id);
// In useEffect cleanup:
useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), []);
```
2. Replace DOM `querySelector` for search input with a ref passed down to the SearchBar component, or use a `searchBarRef` attached to the container.

#### Task F6: Fix useNetworkStatus SSR guard

In `src/hooks/useNetworkStatus.ts`, move the `typeof window === 'undefined'` check to the top of the `useEffect` before adding listeners — this is the correct pattern. The current check inside the effect body after the hook is already structured correctly in many implementations; verify and fix if the check is after `addEventListener` calls.

---

### Track G: Frontend — Component Fixes

**Files:**
- Modify: `src/components/CaptureModules/ScratchPad.tsx`
- Modify: `src/components/CaptureModules/OCRTool.tsx`
- Modify: `src/components/CaptureModules/WebCapture.tsx`
- Modify: `src/components/Inbox/InboxList.tsx`
- Modify: `src/components/Inbox/BulkActionBar.tsx`
- Modify: `src/components/FloatingHub.tsx`
- Modify: `src/components/ui/chart.tsx`
- Modify: `src/components/Search/SearchBar.tsx`

**Fixes:** #34 (ScratchPad re-render on remote edit), #59 (ScratchPad debounce no unmount cleanup), #61 (video.play unhandled), #62 (canvas null assertion), #63 (stream try/finally), #64 (WebCapture abort ref), #65 (BulkActionBar silent failure), #69 (chart.tsx CSS injection), #88 (ScratchPad magic numbers), #89 (on() null guard), #90 (FloatingHub useIsMobile), #91 (SearchBar aria-label)

#### Task G1: ScratchPad fixes

1. Add unmount cleanup for debounced save timeout:
```ts
useEffect(() => {
  return () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  };
}, []);
```
2. Guard `on()` return value before using as cleanup:
```ts
const cleanup = on(WSEventType.SCRATCHPAD_CONTENT_UPDATE, handler);
return typeof cleanup === 'function' ? cleanup : undefined;
```
3. Extract magic numbers to named constants at top of file:
```ts
const SAVE_DEBOUNCE_MS = 3_000;
const COLLABORATOR_TIMEOUT_MS = 60_000;
const COLLABORATOR_CLEANUP_INTERVAL_MS = 15_000;
```
4. For the remote content update, avoid full re-render: use a ref for the editor's imperative handle instead of `setContent()` when possible, or debounce the incoming remote updates.

#### Task G2: OCRTool fixes

1. Await `video.play()` with catch:
```ts
try { await video.play(); } catch { /* autoplay blocked, continue */ }
```
2. Guard `canvas.getContext('2d')`:
```ts
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context unavailable');
```
3. Wrap stream operations in try/finally:
```ts
let stream: MediaStream | null = null;
try {
  stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  // ... use stream
} finally {
  stream?.getTracks().forEach(t => t.stop());
}
```

#### Task G3: WebCapture abort ref fix

In `src/components/CaptureModules/WebCapture.tsx`, after calling `abortControllerRef.current.abort()`, set it back to null:
```ts
abortControllerRef.current.abort();
abortControllerRef.current = null;
```
Add unmount cleanup:
```ts
useEffect(() => () => { abortControllerRef.current?.abort(); }, []);
```

#### Task G4: InboxList.tsx type fix

Change `countdownIntervalsRef` type from `NodeJS.Timeout[]` to `ReturnType<typeof setInterval>[]` — this is correct in both browser and Node environments.

#### Task G5: BulkActionBar error feedback

In `src/components/Inbox/BulkActionBar.tsx`, when the project fetch fails, show a toast error:
```ts
} catch (error) {
  toast.error('Failed to load projects');
}
```

#### Task G6: FloatingHub — move useIsMobile to hooks

Move the `useIsMobile` function from `src/components/FloatingHub.tsx` to `src/hooks/use-mobile.ts` (the file already exists — check if a `useIsMobile` is already there and deduplicate).

#### Task G7: chart.tsx CSS injection fix

In `src/components/ui/chart.tsx`, validate `id` and `color` before string interpolation:
```ts
const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
// For color values:
const safeColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : 'transparent';
```

#### Task G8: SearchBar accessibility

Add `aria-label` to the search input:
```tsx
<Input
  aria-label="Search captures"
  placeholder="Search captures..."
  // ...
/>
```

---

## WAVE 2 — API Route Fixes (split into parallel groups by route family)

Apply security hardening (wire `validateRequest` + `validateBody`/`validateQuery`) AND quality fixes to each route group simultaneously.

The security pattern from `route-secure.ts` is already fully implemented in `src/lib/api-security.ts`. The schema validators are in `src/lib/validation-schemas.ts`. Each route just needs to call them.

**Pattern for GET routes:**
```ts
const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });
const query = validateQuery(request, RelevantQuerySchema);
if (query instanceof NextResponse) return query;
```

**Pattern for POST/PUT/PATCH/DELETE routes:**
```ts
const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });
const body = await validateBody(request, RelevantBodySchema);
if (body instanceof NextResponse) return body;
```

**Error pattern (all catch blocks):**
```ts
} catch (error) {
  const { message, status, details } = classifyError(error);
  const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
  return apiError(message, status, { details: safeDetails, logPrefix: '[VERB /api/route]', error });
}
```

---

### Track H: Capture Routes

**Files:**
- Modify: `src/app/api/capture/route.ts`
- Modify: `src/app/api/capture/[id]/route.ts`
- Modify: `src/app/api/capture/ocr/route.ts`
- Modify: `src/app/api/capture/webpage/route.ts`

**Fixes:** #1 (broadcast with incomplete tags), #46 (missing STATS_UPDATED in [id]), #50 (dueDate validation), #5 (OCR no validation)

1. `route.ts`: Wire `validateRequest` + `CreateCaptureItemSchema`. Add `dueDate` ISO validation in schema. Defer `broadcastItemCreated` until AFTER AI tags resolve (move broadcast into the `.then()` callback, broadcasting the final item with all tags).
2. `[id]/route.ts`: Wire security. Add `broadcastStatsUpdated` after PUT completes. Add `dueDate` validation.
3. `ocr/route.ts`: Wire security. Apply `sanitizeBase64Image(image)` before passing to AI. Add title length validation.
4. `webpage/route.ts`: Wire security. Replace custom status mapping with `classifyError`.

---

### Track I: Bookmarklet Route

**Files:**
- Modify: `src/app/api/bookmarklet/route.ts`

**Fixes:** #2 (CORS too permissive), #3 (SQL injection / $executeRawUnsafe), #25 (no image size limit)

1. Replace `Access-Control-Allow-Origin: *` with configurable allowlist from env var `BOOKMARKLET_ALLOWED_ORIGINS`. Fall back to restricting to same-origin in production. If the bookmarklet requires cross-origin (by design), add a `BOOKMARKLET_API_KEY` header requirement.
2. Replace the `$executeRawUnsafe` INSERT with `db.captureItem.create()` (Prisma ORM call). Apply `BookmarkletCaptureSchema.safeParse(body)` before any data access.
3. Add image size check before calling `downloadImage`: validate `Content-Length` or stream with abort at 10 MB.

---

### Track J: Tags, Links, Inbox Routes

**Files:**
- Modify: `src/app/api/tags/route.ts`
- Modify: `src/app/api/links/route.ts`
- Modify: `src/app/api/inbox/route.ts`
- Modify: `src/app/api/inbox/assign/route.ts`

**Fixes:** #23 (tags N+1), #24 (links N+1), #28 (inbox/assign no existence check), #35 (inbox limit unbounded), #37 (inbox tag filter loads all rows), #52 (enum params unvalidated)

1. `tags/route.ts` PATCH/DELETE rename/merge: Replace the fetch-all-then-update-loop pattern. For SQLite (no JSON functions), batch updates in chunks using `Promise.all` with Prisma `updateMany` where possible, or a single `$executeRaw` with parameterised values.
2. `links/route.ts`: Replace per-link item fetches with two batched `findMany` calls — one for all source IDs, one for all target IDs — then join in memory.
3. `inbox/route.ts`: Add `limit` bounds check (max 100). For tag filtering: use SQLite `LIKE` on the tags JSON string column as a pre-filter: `where: { tags: { contains: tag } }`, then validate exact match in JS after (same performance, but limits result set).
4. `inbox/assign/route.ts`: Add pre-flight `findMany({ where: { id: { in: ids } } })` to confirm all items exist before updating. Return 404 with specific missing IDs if any not found.

---

### Track K: Scratchpad, Export, Search Routes

**Files:**
- Modify: `src/app/api/scratchpad/route.ts`
- Modify: `src/app/api/export/route.ts`
- Modify: `src/app/api/search/route.ts`

**Fixes:** #6 (scratchpad IDOR), #7 (scratchpad GET side-effect), #27 (scratchpad raw JSON.parse), #20 (scratchpad stats broadcast), #26 (export timeout), #37 (export tag filter all rows), #47 (search duplicate sanitize), #107 (search dual params)

1. `scratchpad/route.ts`:
   - GET: Remove the create-if-not-exists side effect. Move default scratchpad creation to app startup (or a dedicated `POST /api/scratchpad/init` endpoint called once on first load).
   - PUT: Apply `validateId(id)` and verify `type === 'scratchpad'` on the fetched record before updating (IDOR fix). Apply `sanitizeTitle(title)`, `sanitizeContent(content)`, `sanitizeTags(tags)`. Add `broadcastStatsUpdated` after save.
   - Replace `JSON.parse(scratchpad.tags || '[]')` with `safeParseTags(scratchpad.tags)`.
2. `export/route.ts`: Remove the `Promise.race` all-or-nothing timeout. Apply `CaptureItemQuerySchema` for enum param validation. For tag filtering: use `where: { tags: { contains: tag } }` as DB pre-filter.
3. `search/route.ts`: Remove local `sanitizeSearchQuery` function; import from `src/lib/parse-utils.ts`. Pick one query param name (`aiEnhanced`); remove the `ai` alias.

---

### Track L: AI Routes

**Files:**
- Modify: `src/app/api/ai/summary/route.ts`
- Modify: `src/app/api/ai/bulk-summary/route.ts`
- Modify: `src/app/api/ai/connections/route.ts`
- Modify: `src/app/api/ai/suggestions/route.ts`
- Modify: `src/app/api/ai/insights/route.ts`
- Modify: `src/app/api/scratchpad/ai/route.ts`

**Fixes:** #14 (summary/bulk-summary wrong error handling), #15 (suggestions stub), #22 (connections unsafe JSON parse), #17 (AI text length cap)

1. All routes: Wire `validateRequest` security. Replace generic catch blocks with `classifyError` + `apiError`. Apply production detail stripping.
2. `connections/route.ts`: Wrap `JSON.parse(response)` in try/catch; on failure, return original connections array as fallback.
3. `suggestions/route.ts`: Either implement the project filter properly (fetch `item.projectId` and compare) or remove the dead branch entirely and document that project-scoped suggestions are not yet implemented.
4. `scratchpad/ai/route.ts` and `insights/route.ts`: Add a 50,000-character length cap on `text`, `selectedText`, `context` fields in the Zod schema.

---

### Track M: Projects, Templates, Stats, Devices, Health Routes

**Files:**
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/api/projects/[id]/route.ts`
- Modify: `src/app/api/templates/route.ts`
- Modify: `src/app/api/templates/[id]/route.ts`
- Modify: `src/app/api/stats/route.ts`
- Modify: `src/app/api/devices/route.ts`
- Modify: `src/app/api/health/route.ts`

**Fixes:** #43 (projects order race), #44 (templates seeding race), #49 (template content empty string), #51 (color validation), #78 (health info disclosure), #82 (devices confusing response)

1. `projects/route.ts`: Add `color` validation in schema (`z.string().regex(/^#[0-9A-Fa-f]{6}$/)`). For order race: use `db.$transaction` to atomically get max order and insert. Wire security.
2. `templates/route.ts`: Move `ensureDefaultTemplates()` call to a module-level `Promise` that's awaited once (not per request). Wire security.
3. `templates/[id]/route.ts`: Fix truthiness check — use `!== undefined` for optional string fields so empty string is a valid update.
4. `health/route.ts`: In production, strip `tables`, AI provider details, RAG stats from response — return only `{ status: 'healthy', timestamp }`. Keep details in development only.
5. `devices/route.ts`: Consolidate the response to a single `devices` array with a `connected: boolean` field per device. Remove the confusing `all` / `connected` top-level keys.

---

## Verification

After all tracks complete:

```bash
# Type check
bun run build

# Lint
bun run lint

# Tests
bun run test:run

# Spot-check security headers
curl -I http://localhost:3000/api/health | grep -E "(Content-Security|X-Frame|X-Content)"

# Spot-check SSRF block
# (should return error, not fetch)
curl -X POST http://localhost:3000/api/capture/webpage \
  -H "Content-Type: application/json" \
  -d '{"url":"http://169.254.169.254/latest/meta-data/"}'
```

---

## Execution Order

**Wave 1** — Dispatch all of A, B, C, D, E, F, G simultaneously (different files, no conflicts).

**Wave 2** — After Wave 1 completes, dispatch H, I, J, K, L, M simultaneously (different route groups, no conflicts).

**Final** — Run verification commands. Fix any TypeScript errors surfaced by removing `ignoreBuildErrors`.
