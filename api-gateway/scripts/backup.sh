#!/usr/bin/env bash
# backup.sh — pg_dump FlowAPI database to a timestamped compressed file.
# Reads connection details from environment variables (same as the app).
# Intended to be called from a cron job; exits non-zero on failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/flowapi_${TIMESTAMP}.dump"

# Load .env if present and not already set
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

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting pg_dump → ${BACKUP_FILE}"

PGPASSWORD="${PGPASSWORD:-}" pg_dump \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --format=custom \
  --file="$BACKUP_FILE"

echo "[backup] Dump complete: $(du -sh "$BACKUP_FILE" | cut -f1)"

# Purge backups older than 30 days
find "$BACKUP_DIR" -name "flowapi_*.dump" -mtime +30 -delete
echo "[backup] Old backups (>30d) purged."
