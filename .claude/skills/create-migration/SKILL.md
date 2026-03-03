---
name: create-migration
description: Create a Prisma migration safely with backup and validation steps
disable-model-invocation: true
---

Follow these steps every time a migration is needed:

1. Read `prisma/schema.prisma` to understand current state
2. Backup current DB: `cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d)`
3. Describe the schema change needed to the user and get confirmation
4. Run `bun run db:migrate` with a descriptive migration name
5. Run `bun run db:generate` to regenerate the Prisma client
6. Verify with `bun run test:run` that existing tests still pass
7. Summarize what changed in `prisma/migrations/`
