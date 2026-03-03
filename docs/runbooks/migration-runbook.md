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
