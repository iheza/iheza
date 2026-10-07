#!/usr/bin/env bash
# =============================================================================
# STEP 1: DUMP the current account's database
# =============================================================================
# This script exports the entire database from the CURRENT account so it can be
# loaded into the NEW account's database after deployment.
#
# Usage:
#   ./1_dump_database.sh
#
# Output:
#   ./dump/<DB_NAME>/   -> BSON dump (use with mongorestore)
#   ./dump/<DB_NAME>.archive.gz -> single compressed archive (recommended)
#   ./dump/json/<collection>.json -> per-collection JSON (human readable)
# =============================================================================
set -euo pipefail

# ---- Configuration (override via env vars if needed) ------------------------
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"
DB_NAME="${DB_NAME:-test_database}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMP_DIR="${SCRIPT_DIR}/dump"
ARCHIVE="${DUMP_DIR}/${DB_NAME}.archive.gz"
JSON_DIR="${DUMP_DIR}/json"

echo "=============================================="
echo " Dumping database"
echo "   MONGO_URL : ${MONGO_URL}"
echo "   DB_NAME   : ${DB_NAME}"
echo "   Output    : ${DUMP_DIR}"
echo "=============================================="

mkdir -p "${DUMP_DIR}" "${JSON_DIR}"

# ---- 1. Full BSON dump (directory form) -------------------------------------
echo ""
echo "[1/3] Creating BSON dump (directory form)..."
mongodump --uri="${MONGO_URL}" --db="${DB_NAME}" --out="${DUMP_DIR}"

# ---- 2. Compressed single-file archive (best for transfer) ------------------
echo ""
echo "[2/3] Creating compressed archive..."
mongodump --uri="${MONGO_URL}" --db="${DB_NAME}" --archive="${ARCHIVE}" --gzip

# ---- 3. Per-collection JSON export (human readable / per-collection import) --
echo ""
echo "[3/3] Exporting each collection to JSON..."
COLLECTIONS=$(mongosh "${MONGO_URL}/${DB_NAME}" --quiet --eval "db.getCollectionNames().join('\n')")
for coll in ${COLLECTIONS}; do
  echo "   - ${coll}"
  mongoexport --uri="${MONGO_URL}" --db="${DB_NAME}" --collection="${coll}" \
    --jsonArray --out="${JSON_DIR}/${coll}.json" >/dev/null 2>&1 || \
    echo "     (skipped ${coll}: export failed)"
done

echo ""
echo "=============================================="
echo " Dump complete!"
echo "   Archive : ${ARCHIVE}"
echo "   BSON dir: ${DUMP_DIR}/${DB_NAME}"
echo "   JSON dir: ${JSON_DIR}"
echo "=============================================="
echo ""
echo "Next: transfer the 'dump' folder to the new account, then run"
echo "      2_restore_database.sh with the NEW account's MONGO_URL / DB_NAME."
