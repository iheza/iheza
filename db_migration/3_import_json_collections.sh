#!/usr/bin/env bash
# =============================================================================
# STEP 2 (ALTERNATIVE): Import per-collection JSON into the NEW account
# =============================================================================
# Use this if you exported per-collection JSON (dump/json/*.json) instead of
# using the BSON archive. This mirrors the "export per collection" workflow.
#
# Usage:
#   NEW_MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net" \
#   NEW_DB_NAME="iheza_db" \
#   ./3_import_json_collections.sh
# =============================================================================
set -euo pipefail

NEW_MONGO_URL="${NEW_MONGO_URL:-mongodb://localhost:27017}"
NEW_DB_NAME="${NEW_DB_NAME:-iheza_db}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JSON_DIR="${SCRIPT_DIR}/dump/json"

echo "=============================================="
echo " Importing JSON collections into NEW account"
echo "   NEW_MONGO_URL : ${NEW_MONGO_URL}"
echo "   NEW_DB_NAME   : ${NEW_DB_NAME}"
echo "   JSON dir      : ${JSON_DIR}"
echo "=============================================="

if [[ ! -d "${JSON_DIR}" ]]; then
  echo "ERROR: ${JSON_DIR} not found. Run 1_dump_database.sh first." >&2
  exit 1
fi

for file in "${JSON_DIR}"/*.json; do
  [[ -e "${file}" ]] || { echo "No JSON files found."; exit 1; }
  coll="$(basename "${file}" .json)"
  echo "   - importing ${coll}"
  mongoimport --uri="${NEW_MONGO_URL}" --db="${NEW_DB_NAME}" \
    --collection="${coll}" --jsonArray --file="${file}" --drop
done

echo ""
echo "Verifying restored collections..."
mongosh "${NEW_MONGO_URL}/${NEW_DB_NAME}" --quiet --eval \
  "db.getCollectionNames().sort().forEach(c => print(c + ': ' + db.getCollection(c).countDocuments()))"

echo ""
echo "JSON import complete!"
