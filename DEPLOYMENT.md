# Capture Hub - Production Deployment Guide

Complete guide for deploying Capture Hub in production using Docker.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Reverse Proxy Setup](#reverse-proxy-setup)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Backup & Restore](#backup--restore)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying Capture Hub, ensure you have:

- **Docker** - Version 20.10 or later ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** - Version 2.0 or later (included with Docker Desktop)
- **Domain name** - For production deployment with SSL/TLS
- **Server** - Linux server with at least 2GB RAM, 20GB disk space
- **SSL Certificate** - Let's Encrypt (free) or commercial cert

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 1GB | 2GB+ |
| Disk | 10GB | 20GB+ |
| Network | 10 Mbps | 100 Mbps+ |

---

## Quick Start

Deploy Capture Hub in 5 minutes:

### Step 1: Clone Repository

```bash
git clone https://github.com/yourname/capture-hub-project.git
cd capture-hub-project
```

### Step 2: Configure Environment

```bash
# Copy production environment template
cp .env.production.template .env

# Edit with your values
nano .env
```

**Required variables:**
- `NEXT_PUBLIC_WS_URL` - Your WebSocket URL (e.g., `wss://capturehub.yourdomain.com/ws`)
- `ZAI_API_KEY` or `OPENAI_API_KEY` - For AI features

### Step 3: Start Container

```bash
# Pull and start the latest image
docker compose -f docker-compose.production.yml up -d

# Initialize database
docker exec capture-hub bun run db:push
```

### Step 4: Verify Deployment

```bash
# Check container health
docker compose -f docker-compose.production.yml ps

# Test health endpoint
curl http://localhost:3000/api/health
```

Expected output: `{"status":"ok"}` or similar

### Step 5: Access Application

Open http://localhost:3000 in your browser.

**Note:** For production, set up a reverse proxy with SSL/TLS (see [Reverse Proxy Setup](#reverse-proxy-setup)).

---

## Configuration

### Environment Variables

Full environment variable reference:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:/app/prisma/production.db` | SQLite database path |
| `NODE_ENV` | Yes | `production` | Node environment |
| `PORT` | No | `3000` | Server port |
| `HOSTNAME` | No | `0.0.0.0` | Bind address |
| `NEXT_PUBLIC_WS_URL` | Yes* | - | WebSocket URL (use `wss://` in production) |
| `ZAI_API_KEY` | No** | - | z-ai API key for AI features |
| `OPENAI_API_KEY` | No** | - | OpenAI API key (alternative to ZAI) |

\* Required in production for WebSocket connections
** At least one AI API key recommended for full features

### Docker Compose Configuration

The `docker-compose.production.yml` file includes:

- **Volume mounts** - Database persistence at `./prisma`
- **Health checks** - Automatic container restart on failure
- **Log rotation** - Max 10MB per file, keep 3 files
- **Network** - Isolated bridge network

---

## Deployment

### Option 1: Automated Deployment (Recommended)

Use the automated deployment script:

```bash
./scripts/deploy.sh
```

This script automatically:
1. Backs up the current database
2. Pulls the latest Docker image
3. Stops the current container
4. Starts the new container
5. Verifies health check

### Option 2: Manual Deployment

```bash
# Backup database
./scripts/backup.sh

# Pull latest image
docker compose -f docker-compose.production.yml pull

# Restart container
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d

# Verify health
docker compose -f docker-compose.production.yml ps
```

### Initial Deployment

For first-time deployment:

```bash
# 1. Clone and configure
git clone <repo-url> capture-hub
cd capture-hub
cp .env.production.template .env
# Edit .env with your values

# 2. Start container
docker compose -f docker-compose.production.yml up -d

# 3. Initialize database
docker exec capture-hub bun run db:push

# 4. Verify
curl http://localhost:3000/api/health
```

---

## Reverse Proxy Setup

For production deployment with SSL/TLS, use nginx as a reverse proxy.

### nginx Installation

```bash
# Install nginx and certbot
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# Copy example configuration
sudo cp docs/nginx.conf.example /etc/nginx/sites-available/capturehub

# Edit with your domain
sudo nano /etc/nginx/sites-available/capturehub
# Replace capturehub.yourdomain.com with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/capturehub /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Obtain SSL certificate
sudo certbot --nginx -d capturehub.yourdomain.com

# Reload nginx
sudo systemctl reload nginx
```

### Verify SSL/WebSocket

```bash
# Test HTTPS
curl https://capturehub.yourdomain.com/api/health

# Test WebSocket (using wscat)
npm install -g wscat
wscat -c wss://capturehub.yourdomain.com/ws
```

---

## Monitoring & Maintenance

### View Logs

```bash
# Follow logs in real-time
docker compose -f docker-compose.production.yml logs -f

# Last 100 lines
docker logs capture-hub --tail 100

# Filter errors
docker logs capture-hub 2>&1 | grep ERROR
```

### Check Container Health

```bash
# Container status
docker compose -f docker-compose.production.yml ps

# Detailed health check info
docker inspect capture-hub | grep -A 10 Health
```

### Monitor Resources

```bash
# Container resource usage
docker stats capture-hub

# Database size
du -h ./prisma/production.db
```

### Update Application

```bash
# Pull latest image and restart
./scripts/deploy.sh
```

---

## Backup & Restore

### Automated Backups

The backup script creates timestamped database backups:

```bash
# Manual backup
./scripts/backup.sh

# Automated daily backup (add to crontab)
crontab -e
# Add this line:
0 2 * * * /path/to/capture-hub/scripts/backup.sh
```

**Backup retention:** 30 days by default (configurable via `RETENTION_DAYS` env var)

### Restore from Backup

```bash
# List available backups
ls -lh ./backups/

# Restore specific backup
./scripts/restore.sh ./backups/production-20260224-140000.db

# Restart container to apply
docker compose -f docker-compose.production.yml restart
```

### Off-site Backups

For production, sync backups to cloud storage:

```bash
# Example: Sync to AWS S3
aws s3 sync ./backups/ s3://your-backup-bucket/capture-hub/

# Example: Sync to Backblaze B2
b2 sync ./backups/ b2://your-backup-bucket/capture-hub/
```

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker compose -f docker-compose.production.yml logs
```

**Common causes:**
- Port 3000 already in use: Change `PORT` in .env
- Missing environment variables: Verify .env file exists and is correct
- Database permission issues: Check `./prisma` directory permissions

**Solution:**
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Fix permissions
chmod -R 755 ./prisma
```

### WebSocket Connections Fail

**Symptoms:**
- Real-time sync not working
- "WebSocket connection failed" in browser console

**Common causes:**
- Incorrect `NEXT_PUBLIC_WS_URL` in .env
- Reverse proxy not configured for WebSocket upgrades
- Firewall blocking WebSocket connections

**Solution:**
```bash
# Verify NEXT_PUBLIC_WS_URL is correct
echo $NEXT_PUBLIC_WS_URL

# Test WebSocket directly (bypass nginx)
wscat -c ws://localhost:3000/ws

# Check nginx WebSocket configuration
sudo nginx -t
```

### Database Corruption

**Symptoms:**
- SQL errors in logs
- Data not persisting
- Container health check failing

**Solution:**
```bash
# Stop container
docker compose -f docker-compose.production.yml down

# Restore from latest backup
./scripts/restore.sh ./backups/production-YYYYMMDD-HHMMSS.db

# Restart container
docker compose -f docker-compose.production.yml up -d
```

### High Memory Usage

**Check memory:**
```bash
docker stats capture-hub
```

**Common causes:**
- Large database file
- Many WebSocket connections
- Memory leak in application

**Solution:**
```bash
# Restart container to free memory
docker compose -f docker-compose.production.yml restart

# Increase container memory limit in docker-compose.production.yml:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

### AI Features Not Working

**Symptoms:**
- No auto-tagging suggestions
- OCR failing
- Search ranking not working

**Common causes:**
- Missing or invalid API key
- API quota exceeded
- Network issues

**Solution:**
```bash
# Verify API key is set
docker exec capture-hub env | grep API_KEY

# Check API key validity (test with curl)
curl -H "Authorization: Bearer $ZAI_API_KEY" https://api.z.ai/v1/health

# Application gracefully degrades - features still work without AI
```

---

## Production Checklist

Before going live, verify:

- [ ] Environment variables configured correctly
- [ ] SSL/TLS certificate installed and valid
- [ ] WebSocket connections working (test multi-device sync)
- [ ] Automated backups configured (cron job)
- [ ] nginx reverse proxy configured with security headers
- [ ] Firewall rules allow ports 80 and 443
- [ ] Health check endpoint returning 200 OK
- [ ] Database persists across container restarts
- [ ] Logs rotating correctly (check `./logs` or Docker logs)
- [ ] Off-site backup strategy implemented

---

## Support

For issues, questions, or contributions:

- **GitHub Issues:** https://github.com/yourname/capture-hub-project/issues
- **Documentation:** See README.md for feature documentation
- **Design:** See docs/plans/2026-02-24-production-release-design.md

---

**Built with ❤️ for personal productivity**
