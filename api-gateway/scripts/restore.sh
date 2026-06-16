#!/usr/bin/env bash
# restore.sh <backup_file> — Restore a FlowAPI pg_dump custom-format backup.
# Prompts for confirmation before proceeding — destructive operation.

set -euo pipefail

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <path-to-backup.dump>"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Error: backup file not found: $BACKUP_FILE"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"

echo "======================================================="
echo " WARNING: This will REPLACE the current database."
echo " Database : $PGDATABASE"
echo " Host     : $PGHOST:$PGPORT"
echo " Backup   : $BACKUP_FILE"
echo "======================================================="
read -r -p "Type RESTORE to confirm: " CONFIRM

if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

echo "[restore] Restoring from $BACKUP_FILE …"

PGPASSWORD="${PGPASSWORD:-}" pg_restore \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$BACKUP_FILE"

echo "[restore] Done."
