# Capture Hub — QA & Hardening Results

**Date:** 2026-02-26  
**Test Rounds:** Smoke → Core Workflows → Edge Cases → Regression  
**Final Status:** ✅ All tests passing

---

## Test Suite Results

| Suite | Run | Pass | Fail | Notes |
|-------|-----|------|------|-------|
| Vitest unit tests | 183 total | 155 | 0 | 28 intentionally skipped |
| Playwright E2E | 10 | 10 | 0 | After timeout fix |
| API smoke (PowerShell) | 40+ | 40+ | 0 | Manual endpoint coverage |

---

## Bugs Fixed (5)

### Fix 1 — Playwright first-load timeout
- **File:** `playwright.config.ts`
- **Root cause:** No `timeout` configured; Turbopack cold compilation routinely exceeds the 30s default, causing the first test to time out every run.
- **Fix:** Added `timeout: 90000`, `navigationTimeout: 60000`, `actionTimeout: 15000`.
- **Impact:** Playwright suite was 9/10 pass on every cold run; now consistently 10/10.

### Fix 2 — Export route accepts invalid format silently
- **File:** `src/app/api/export/route.ts`
- **Root cause:** `format` query param defaulted to `'json'` for any unknown value instead of returning an error. `?format=invalid` would silently export as JSON.
- **Fix:** Added early validation: `if (!validFormats.includes(format))` → 400 with clear error message.
- **Valid formats:** `json`, `csv`, `markdown`, `md`.

### Fix 3 — Templates seeding: explicit date strings bypass Prisma
- **File:** `src/app/api/templates/route.ts` (`ensureDefaultTemplates`)
- **Root cause:** Seed data included explicit `createdAt: now` and `updatedAt: now` ISO strings, bypassing Prisma's `DateTime @default(now())` and `@updatedAt` directives. This pattern caused date normalization issues in previous migrations.
- **Fix:** Removed explicit date fields; Prisma handles them automatically.

### Fix 4 — Bulk update crashes on non-existent item IDs
- **File:** `src/app/api/inbox/assign/route.ts`
- **Root cause:** `Promise.all(updatePromises)` called `db.captureItem.update()` on each ID with no error handling. A single non-existent ID caused Prisma to throw, crashing the entire bulk operation and leaving all other items un-updated.
- **Fix:** Wrapped each individual `db.captureItem.update()` in try-catch, collecting results as `{ ok: true, item }` or `{ ok: false, id }`. Returns partial success with `count`, and includes `failedIds`/`failedCount` when any IDs were skipped.
- **Also:** Removed redundant explicit `updatedAt` from the update payload (Prisma `@updatedAt` handles it).

### Fix 5 — QuickCapture: selected project never included in save
- **File:** `src/components/CaptureModules/QuickCapture.tsx`
- **Root cause:** `handleSelectProject(projectId)` was a stub (`console.log` only). The `ContentSuggestions` sidebar shows AI-recommended projects, but selecting one had no effect — the project assignment was never included in the POST body.
- **Fix:**
  - Added `selectedProjectId` state.
  - `handleSelectProject` now toggles the selection (re-click deselects).
  - Added UI indicator ("Assigning to project" + clear button) when a project is selected.
  - `handleSubmit` includes `projectId` and `status: 'assigned'` in the payload when a project is selected.
  - Form reset clears `selectedProjectId`.

---

## API Endpoint Coverage

| Endpoint | Methods Tested | Result |
|----------|---------------|--------|
| `GET /api/health` | GET | ✅ |
| `GET /api/stats` | GET | ✅ Stats match DB counts |
| `GET/POST /api/capture` | GET, POST, validation | ✅ |
| `GET/PUT/DELETE /api/capture/[id]` | All three | ✅ |
| `GET /api/inbox` | GET + filters | ✅ |
| `POST /api/inbox/assign` | Bulk actions | ✅ (after Fix 4) |
| `GET /api/search` | GET + edge cases | ✅ SQL special chars handled |
| `GET/POST /api/projects` | GET, POST | ✅ |
| `PUT/DELETE /api/projects/[id]` | PUT, DELETE | ✅ |
| `GET /api/templates` | GET | ✅ |
| `POST/DELETE /api/templates/[id]` | POST, DELETE | ✅ |
| `GET/PATCH/DELETE /api/tags` | All three | ✅ Input validation working |
| `POST /api/links` | POST | ✅ Validates both items exist |
| `DELETE /api/links` | DELETE | ✅ |
| `GET /api/export` | json/csv/markdown | ✅ (after Fix 2) |
| `GET /api/devices` | GET | ✅ |
| `POST /api/capture/webpage` | POST | ✅ URL validation |
| `POST /api/ai/insights` | POST | ✅ (POST only, by design) |
| `POST /api/ai/suggestions` | POST | ✅ |

---

## UI Component Coverage

| Component | Key Checks | Result |
|-----------|-----------|--------|
| Dashboard / AIDashboard | Loads, calls `POST /api/ai/insights` correctly | ✅ |
| InboxList | Filters, pagination, bulk actions, WS sync | ✅ |
| ItemPreview | Save/update, due date, links, projects | ✅ |
| QuickCapture | Form validation, tag input, project assign | ✅ (after Fix 5) |
| ScratchPad | Auto-save (30s interval), unsaved-changes tracking | ✅ |
| WebCapture | URL validation, abort controller, error display | ✅ |
| OCRTool | File type/size validation, paste-from-clipboard, error codes | ✅ |
| FloatingHub | FAB visible, module switching | ✅ |
| CommandPalette | Keyboard shortcut rendering | ✅ |
| GlobalError boundary | Renders reset button on crash | ✅ |

---

## Additional Fixes (Round 2)

| Fix | Files Changed | Detail |
|-----|--------------|--------|
| `handleSelectRelatedItem` wired up | `QuickCapture.tsx`, `FloatingHub.tsx`, `page.tsx` | Added `onNavigateToItem` prop chain; clicking a related item in the AI sidebar now closes the capture panel and scrolls to/opens the item in the inbox |
| `GET /api/links` pagination | `links/route.ts` | Added `limit` (default 50, max 200) and `offset` query params; returns `total`/`limit`/`offset` alongside results |
| `stats.projects` corrected | `stats/route.ts` | Added `db.project.count()` in the parallel query block; `projects` field now reflects the actual number of projects |
| WebSocket cold-start console error | `WebSocketContext.tsx` | Deferred initial `connect()` until `document.readyState === 'complete'` via `window.addEventListener('load', …, { once: true })`; console errors on first load dropped from 1 → 0 |

---

## Regression Verification

After all 5 fixes:

```
Vitest:     155 passed | 28 skipped (183 total) — 8 test files
Playwright: 10 passed (41.9s)
```

No regressions introduced.
