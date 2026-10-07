# Database Migration Guide — Move DB to a New Account

This folder contains everything needed to move your database from the **current
account** to a **new account** after the new app is deployed.

## Current setup (source)

| Setting    | Value                        |
|------------|------------------------------|
| MONGO_URL  | `mongodb://localhost:27017`  |
| DB_NAME    | `test_database`              |
| Collections| 28 (students, users, payments, attendance, fees, ebooks, etc.) |

---

## Overview of the process

```
CURRENT ACCOUNT                         NEW ACCOUNT
───────────────                         ───────────
1. Dump DB  ──►  dump/  ──transfer──►   2. Restore DB
   (mongodump)                            (mongorestore)
                                         3. Set Secrets (MONGO_URL / DB_NAME)
                                         4. Republish
```

---

## Step 1 — Dump the current database

From the current account's terminal:

```bash
cd /app/db_migration
chmod +x *.sh
./1_dump_database.sh
```

This produces:

- `dump/test_database/` — BSON dump (directory form)
- `dump/test_database.archive.gz` — **single compressed archive (recommended for transfer)**
- `dump/json/<collection>.json` — per-collection JSON (human readable)

> Equivalent to **Manage Publishes → Database → Go to database → Dump DB**.
> The per-collection JSON files mirror the "export per collection" option.

---

## Step 2 — Transfer the dump to the new account

Download the `dump/` folder (or just `dump/test_database.archive.gz`) from the
current account and upload it into the new account's `/app/db_migration/dump/`
folder. You can use the file explorer / download-upload in the IDE, or `scp`.

---

## Step 3 — Restore into the new account's database

The new account gets its **own managed database by default**. Get its connection
string from **Manage Publishes → Secrets → System keys** (`MONGO_URL`, `DB_NAME`).

### Option A — Restore from the compressed archive (recommended)

```bash
cd /app/db_migration
NEW_MONGO_URL="<new account MONGO_URL>" \
NEW_DB_NAME="<new account DB_NAME>" \
./2_restore_database.sh
```

### Option B — Import per-collection JSON

```bash
cd /app/db_migration
NEW_MONGO_URL="<new account MONGO_URL>" \
NEW_DB_NAME="<new account DB_NAME>" \
./3_import_json_collections.sh
```

Both scripts rename the old DB name (`test_database`) to the new DB name during
restore using `--nsFrom` / `--nsTo`, and print a per-collection count to verify.

---

## Step 4 — Point the new app at the database

In the **new account**: **Manage Publishes → Secrets → System keys**, set:

```
MONGO_URL = <new account MONGO_URL>
DB_NAME   = <new account DB_NAME>
```

Then **republish** the app.

---

## Using your own MongoDB Atlas cluster (optional)

Instead of the default managed DB, you can point the new account at your own
Atlas cluster:

1. In Atlas, create a database user and get the connection string
   (`mongodb+srv://user:pass@cluster.mongodb.net`).
2. In the new account: **Manage Publishes → Secrets → System keys**, update
   `MONGO_URL` and `DB_NAME`, then **republish**.
3. **Allowlist Emergent's egress IPs** in Atlas:
   - Go to **app.emergent.sh/ip-addresses** and copy the listed IPs.
   - In Atlas → **Network Access → Add IP Address**, add each IP (or the CIDR).
4. Run the restore (Step 3) against the Atlas `MONGO_URL`.

---

## Notes & gotchas

- **`--drop`** is used on restore so collections are replaced, not merged. Remove
  it if you want to merge into an existing DB.
- **Indexes** are included in the BSON/archive dump and are recreated by
  `mongorestore`. JSON import does **not** recreate indexes — prefer the archive.
- **Uploaded files** (e.g. `backend/uploads/ebooks/*.html`) live on disk, not in
  MongoDB. Copy the `backend/uploads/` folder to the new account separately if
  you use local file storage.
- **Secrets** (VAPID keys, JWT secret, etc.) are not in the DB. Copy the relevant
  values from `backend/.env` into the new account's Secrets if you want push
  notifications / sessions to keep working.
- Always verify counts after restore (the scripts print them automatically).

---

## Files in this folder

| File | Purpose |
|------|---------|
| `1_dump_database.sh` | Dump current DB (BSON + archive + JSON) |
| `2_restore_database.sh` | Restore archive/BSON into new DB |
| `3_import_json_collections.sh` | Import per-collection JSON into new DB |
| `README.md` | This guide |
