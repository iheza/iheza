"""
STRIP BASE64 IMAGES FROM A SINGLE CHAIN (default: DLP) TO SHRINK PAYLOADS & STOP 502s
=====================================================================================

Why this exists
---------------
The IHEZA backend stores large base64 blobs directly inside MongoDB documents:

  * students.passport_photo          (base64 data URI, ~0.5-3 MB each)
  * admissions.passport_photo        (base64 data URI, ~0.5-3 MB each)
  * student_fees.receipt_image       (single base64, 1-5 MB)
  * student_fees.receipt_images      (array of {id, image} base64 blobs)
  * payments.receipt_image           (single base64, 1-5 MB)
  * payments.receipt_images          (array of {id, image} base64 blobs)

When a page lists many students/payments, these blobs are loaded into memory
server-side (even when the API projects them out, the DB still has to read the
documents and the collections stay huge). Under load this drives the single
backend worker to exhaustion and produces 502/504/520 gateway errors.

This script REMOVES those base64 blobs for ONE chain only (default DLP), leaving
every other chain untouched. It is idempotent and safe to re-run.

SAFETY
------
* Defaults to DRY-RUN. Nothing is modified unless you pass --apply.
* Scoped strictly to the target chain via a case-insensitive match on the
  `chain` field. Other chains are never touched.
* Only $unset's the image fields; all other document data is preserved.
* Prints a before/after byte estimate so you can see the payload reduction.

USAGE
-----
  # 1) Inspect what would be removed (no changes):
  python strip_dlp_base64_images.py --chain DLP

  # 2) Actually strip DLP images:
  python strip_dlp_base64_images.py --chain DLP --apply

  # 3) Point at a different database (overrides backend/.env):
  python strip_dlp_base64_images.py --chain DLP --apply \
      --mongo-url "mongodb://user:pass@host:27017" --db "iheza_prod"

NOTE
----
The script imports `database.py` from the same directory, which reads
backend/.env (MONGO_URL / DB_NAME). Pass --mongo-url / --db to override.
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

# Ensure we can import database.py from this directory
sys.path.insert(0, str(Path(__file__).resolve().parent))

from database import db  # noqa: E402  (respects backend/.env MONGO_URL / DB_NAME)


# ---------------------------------------------------------------------------
# Configuration of what to strip per collection
# ---------------------------------------------------------------------------
# Each entry: collection name -> list of base64 fields to $unset
TARGETS = {
    "students":     ["passport_photo"],
    "admissions":   ["passport_photo"],
    "student_fees": ["receipt_image", "receipt_images"],
    "payments":     ["receipt_image", "receipt_images"],
}


def _chain_filter(chain: str) -> dict:
    """Case-insensitive match on the chain field (e.g. DLP, dlp, Dlp)."""
    return {"chain": re.compile("^" + re.escape(chain.strip()) + "$", re.IGNORECASE)}


def _estimate_bytes(doc: dict, fields: list) -> int:
    """Rough byte estimate of the base64 fields in a single document."""
    total = 0
    for f in fields:
        val = doc.get(f)
        if isinstance(val, str):
            total += len(val)
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    for k, v in item.items():
                        if isinstance(v, str):
                            total += len(v)
                elif isinstance(item, str):
                    total += len(item)
    return total


async def process_collection(name: str, fields: list, chain: str, apply: bool) -> dict:
    """Count + (optionally) strip base64 fields for one collection on one chain."""
    coll = db[name]
    filt = _chain_filter(chain)

    # Count documents that actually carry at least one of the target fields
    or_clause = [{f: {"$exists": True, "$ne": None}} for f in fields]
    present_filter = {"$and": [filt, {"$or": or_clause}]}

    docs_with_images = await coll.find(present_filter, {"_id": 1, **{f: 1 for f in fields}}).to_list(None)

    count = len(docs_with_images)
    total_bytes = sum(_estimate_bytes(d, fields) for d in docs_with_images)

    result = {
        "collection": name,
        "chain": chain,
        "docs_with_images": count,
        "estimated_bytes": total_bytes,
        "estimated_mb": round(total_bytes / (1024 * 1024), 2),
    }

    if apply and count > 0:
        unset = {f: "" for f in fields}
        res = await coll.update_many(filt, {"$unset": unset})
        result["modified"] = res.modified_count
    else:
        result["modified"] = 0

    return result


async def main() -> None:
    parser = argparse.ArgumentParser(description="Strip base64 images from one chain's records.")
    parser.add_argument("--chain", default="DLP", help="Chain code to strip (default: DLP)")
    parser.add_argument("--apply", action="store_true", help="Actually modify the DB (default is dry-run)")
    parser.add_argument("--mongo-url", default=None, help="Override MONGO_URL")
    parser.add_argument("--db", default=None, help="Override DB_NAME")
    args = parser.parse_args()

    # Allow overriding the connection (useful for pointing at production)
    if args.mongo_url or args.db:
        import os
        from motor.motor_asyncio import AsyncIOMotorClient
        global db
        mongo_url = args.mongo_url or os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = args.db or os.environ.get("DB_NAME", "iheza_db")
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]

    chain = args.chain.strip().upper()
    mode = "APPLY (modifying DB)" if args.apply else "DRY-RUN (no changes)"
    print("=" * 72)
    print(f"  Strip base64 images | chain={chain} | mode={mode}")
    print(f"  Database: {db.name}")
    print("=" * 72)

    grand_bytes = 0
    grand_docs = 0
    rows = []

    for name, fields in TARGETS.items():
        try:
            res = await process_collection(name, fields, chain, args.apply)
        except Exception as exc:  # collection may not exist
            print(f"  [SKIP] {name}: {exc}")
            continue

        rows.append(res)
        grand_bytes += res["estimated_bytes"]
        grand_docs += res["docs_with_images"]
        action = f"stripped {res['modified']}" if args.apply else "would strip"
        print(
            f"  {name:<14} docs_with_images={res['docs_with_images']:<6} "
            f"est_bytes={res['estimated_bytes']:<10} ({res['estimated_mb']} MB)  -> {action}"
        )

    print("-" * 72)
    print(
        f"  TOTAL: {grand_docs} documents, ~{grand_bytes} bytes "
        f"({round(grand_bytes / (1024 * 1024), 2)} MB) of base64 "
        f"{'removed' if args.apply else 'eligible for removal'}"
    )
    print("=" * 72)

    if not args.apply:
        print("  Dry-run complete. Re-run with --apply to actually strip the images.")
    else:
        print("  Done. Images stripped for chain:", chain)


if __name__ == "__main__":
    asyncio.run(main())
