#!/bin/bash
# =============================================================================
# Capture Hub - Automated Deployment Script
# =============================================================================
# Deploys latest Docker image with automatic backup
# Usage: ./scripts/deploy.sh
# =============================================================================

set -e  # Exit on error

echo "🚀 Capture Hub - Automated Deployment"
echo "===================================="
echo ""

# Step 1: Backup current database
echo "Step 1/5: Backing up database..."
./scripts/backup.sh
echo ""

# Step 2: Pull latest Docker image
echo "Step 2/5: Pulling latest Docker image..."
docker compose -f docker-compose.production.yml pull
echo "✅ Image pulled"
echo ""

# Step 3: Stop current container
echo "Step 3/5: Stopping current container..."
docker compose -f docker-compose.production.yml down
echo "✅ Container stopped"
echo ""

# Step 4: Start new container
echo "Step 4/5: Starting new container..."
docker compose -f docker-compose.production.yml up -d
echo "✅ Container started"
echo ""

# Step 5: Wait for health check
echo "Step 5/5: Waiting for health check..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
  if docker compose -f docker-compose.production.yml ps | grep -q "healthy"; then
    echo "✅ Container is healthy"
    break
  fi
  echo "   Waiting... ($RETRIES retries left)"
  sleep 2
  RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
  echo "❌ Error: Container failed to become healthy"
  echo "   Check logs: docker compose -f docker-compose.production.yml logs"
  exit 1
fi

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "Verify deployment:"
echo "  docker compose -f docker-compose.production.yml ps"
echo "  curl http://localhost:3000/api/health"
echo ""
echo "View logs:"
echo "  docker compose -f docker-compose.production.yml logs -f"
