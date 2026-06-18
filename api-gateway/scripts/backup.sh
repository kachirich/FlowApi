#!/usr/bin/env bash
# backup.sh — pg_dump FlowAPI database to a timestamped compressed file.
# Reads connection details from environment variables (same as the app).
# Intended to be called from a cron job; exits non-zero on failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/flowapi_${TIMESTAMP}.dump"

# Load specific variables from .env without eval/source to avoid command injection.
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
  _parse_env() {
    local key="$1"
    grep -m1 "^${key}=" "$ENV_FILE" | cut -d= -f2- | tr -d "'\""
  }
  [[ -z "${PGHOST:-}"     ]] && export PGHOST="$(_parse_env PGHOST)"
  [[ -z "${PGPORT:-}"     ]] && export PGPORT="$(_parse_env PGPORT)"
  [[ -z "${PGDATABASE:-}" ]] && export PGDATABASE="$(_parse_env PGDATABASE)"
  [[ -z "${PGUSER:-}"     ]] && export PGUSER="$(_parse_env PGUSER)"
  [[ -z "${PGPASSWORD:-}" ]] && export PGPASSWORD="$(_parse_env PGPASSWORD)"
  unset -f _parse_env
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
