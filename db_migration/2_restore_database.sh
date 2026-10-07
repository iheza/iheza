#!/usr/bin/env bash
# =============================================================================
# STEP 2: RESTORE the dump into the NEW account's database
# =============================================================================
# Run this AFTER the new account's app is deployed and you have its MongoDB
# connection string (either the managed DB or your own Atlas cluster).
#
# Usage:
#   NEW_MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net" \
#   NEW_DB_NAME="iheza_db" \
#   ./2_restore_database.sh
#
# Or edit the defaults below.
# =============================================================================
set -euo pipefail

# ---- Configuration (NEW account) --------------------------------------------
NEW_MONGO_URL="${NEW_MONGO_URL:-mongodb://localhost:27017}"
NEW_DB_NAME="${NEW_DB_NAME:-iheza_db}"

# Source dump produced by 1_dump_database.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMP_DIR="${SCRIPT_DIR}/dump"
OLD_DB_NAME="${OLD_DB_NAME:-test_database}"
ARCHIVE="${DUMP_DIR}/${OLD_DB_NAME}.archive.gz"
BSON_DIR="${DUMP_DIR}/${OLD_DB_NAME}"

echo "=============================================="
echo " Restoring database into NEW account"
echo "   NEW_MONGO_URL : ${NEW_MONGO_URL}"
echo "   NEW_DB_NAME   : ${NEW_DB_NAME}"
echo "   Source        : ${ARCHIVE}"
echo "=============================================="

if [[ ! -f "${ARCHIVE}" && ! -d "${BSON_DIR}" ]]; then
  echo "ERROR: No dump found. Run 1_dump_database.sh first." >&2
  exit 1
fi

# ---- Restore ----------------------------------------------------------------
if [[ -f "${ARCHIVE}" ]]; then
  echo ""
  echo "[1/1] Restoring from compressed archive..."
  # --nsFrom/--nsTo renames the old DB name to the new DB name during restore.
  mongorestore --uri="${NEW_MONGO_URL}" \
    --archive="${ARCHIVE}" --gzip \
    --nsFrom="${OLD_DB_NAME}.*" --nsTo="${NEW_DB_NAME}.*" \
    --drop
else
  echo ""
  echo "[1/1] Restoring from BSON directory..."
  mongorestore --uri="${NEW_MONGO_URL}" \
    --nsFrom="${OLD_DB_NAME}.*" --nsTo="${NEW_DB_NAME}.*" \
    --drop "${BSON_DIR}"
fi

# ---- Verify -----------------------------------------------------------------
echo ""
echo "Verifying restored collections..."
mongosh "${NEW_MONGO_URL}/${NEW_DB_NAME}" --quiet --eval \
  "db.getCollectionNames().sort().forEach(c => print(c + ': ' + db.getCollection(c).countDocuments()))"

echo ""
echo "=============================================="
echo " Restore complete!"
echo "=============================================="
echo ""
echo "IMPORTANT: Make sure the new account's app uses these values:"
echo "   MONGO_URL = ${NEW_MONGO_URL}"
echo "   DB_NAME   = ${NEW_DB_NAME}"
echo "Set them in Manage Publishes -> Secrets -> System keys, then republish."
