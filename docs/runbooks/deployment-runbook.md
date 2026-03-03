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
