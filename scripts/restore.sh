#!/bin/bash
# =============================================================================
# Capture Hub - Database Restore Script
# =============================================================================
# Restores database from a backup file
# Usage: ./scripts/restore.sh <backup-file>
# =============================================================================

set -e  # Exit on error

# Configuration
DB_PATH="${DB_PATH:-./prisma/production.db}"

# Check arguments
if [ -z "$1" ]; then
  echo "❌ Error: Backup file not specified"
  echo "Usage: $0 <backup-file>"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/production-*.db 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Confirm restoration
echo "⚠️  WARNING: This will replace the current database!"
echo "   Current: $DB_PATH"
echo "   Backup:  $BACKUP_FILE"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

# Create backup of current database before restore
if [ -f "$DB_PATH" ]; then
  SAFETY_BACKUP="$DB_PATH.before-restore-$(date +%Y%m%d-%H%M%S)"
  echo "📦 Creating safety backup of current database..."
  cp "$DB_PATH" "$SAFETY_BACKUP"
  echo "   Saved to: $SAFETY_BACKUP"
fi

# Restore database
echo "♻️  Restoring database..."
cp "$BACKUP_FILE" "$DB_PATH"

# Verify restoration
if [ -f "$DB_PATH" ]; then
  DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
  echo "✅ Restore completed successfully"
  echo "   Size: $DB_SIZE"
  echo "   Location: $DB_PATH"
  echo ""
  echo "⚠️  Remember to restart the application for changes to take effect:"
  echo "   docker compose restart"
else
  echo "❌ Error: Restore failed"
  exit 1
fi
