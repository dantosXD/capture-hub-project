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
