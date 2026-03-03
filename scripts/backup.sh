#!/bin/bash
# =============================================================================
# Capture Hub - Database Backup Script
# =============================================================================
# Backs up the production SQLite database with timestamp
# Usage: ./scripts/backup.sh
# =============================================================================

set -e  # Exit on error

# Configuration
DB_PATH="${DB_PATH:-./prisma/production.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/production-$DATE.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
  echo "❌ Error: Database not found at $DB_PATH"
  exit 1
fi

# Perform backup
echo "📦 Backing up database..."
echo "   Source: $DB_PATH"
echo "   Target: $BACKUP_FILE"

cp "$DB_PATH" "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup completed successfully"
  echo "   Size: $BACKUP_SIZE"
  echo "   Location: $BACKUP_FILE"
else
  echo "❌ Error: Backup failed"
  exit 1
fi

# Clean up old backups (keep last 30 days by default)
RETENTION_DAYS="${RETENTION_DAYS:-30}"
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "production-*.db" -type f -mtime +$RETENTION_DAYS -delete
echo "✅ Cleanup completed"

echo ""
echo "Backup summary:"
ls -lh "$BACKUP_DIR"/production-*.db | tail -5
