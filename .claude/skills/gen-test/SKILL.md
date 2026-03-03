---
name: gen-test
description: Generate Vitest tests for this project following established patterns
---

Generate a Vitest test for the file specified by the user.

Follow these project conventions:
- Import test utilities from `src/test/helpers.ts` and fixtures from `src/test/fixtures.ts`
- Use the setup from `src/test/setup.ts`
- API integration tests go in `src/test/api.integration.test.ts` pattern
- Unit tests live alongside source files (e.g., `src/lib/foo.test.ts`)
- Use `happy-dom` environment for component tests
- Use `bun run test:run` to verify tests pass

Before generating, read the target file and any adjacent test files to understand existing patterns.
