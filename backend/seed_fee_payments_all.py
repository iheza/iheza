#!/usr/bin/env python3
"""
Seed fee structures + student_fees + payments for ALL active students.

Purpose: give the Financial Report real data so the analytics
(Expected Revenue / Collected / Outstanding / Paid / Partial / Unpaid) can be
verified against the fixed /api/financial-report-students endpoint, which now
aggregates over EVERY active student (not just the 50 rows on the page).

Behaviour (idempotent / gap-filling):
- Ensures a chain-wide Tuition fee_structure exists per chain.
- For every ACTIVE student that has NO student_fees record, creates one
  (amount from the chain fee_structure, or a sensible default).
- For every ACTIVE student that has NO payments, creates 1-3 payments with
  history (created_at spread over the last ~90 days) summing to a
  deterministic "paid" amount (fully paid / partial / unpaid mix).

Existing student_fees and payments are left untouched so we never double-count.
"""

import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, '.env'))

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Default tuition per chain when no fee_structure exists yet.
DEFAULT_TUITION = {
    'DUP': 1575000,
    'DLP': 1200000,
    'LALE': 1000000,
    'OLGUN': 1800000,
}


def parse_class_level(class_name):
    """Extract grade level from names like 'GRADE 4A', 'Grade 5-A', 'GRADE 7'."""
    if not class_name:
        return None
    name = str(class_name).strip().upper()
    idx = name.find('GRADE')
    if idx == -1:
        return None
    rest = name[idx + len('GRADE'):].strip()
    num = ''
    for ch in rest:
        if ch.isdigit():
            num += ch
        else:
            break
    return f'Grade {num}' if num else None


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connected to {DB_NAME}")

    # ---- 1. Ensure a chain-wide tuition fee_structure exists per chain ----
    print("\n=== Ensuring fee structures ===")
    chains = await db.students.distinct('chain')
    fs_created = 0
    for chain in chains:
        if not chain:
            continue
        existing = await db.fee_structures.find_one({
            'chain': chain, 'name': 'Tuition Fee', 'status': 'active'
        })
        if not existing:
            await db.fee_structures.insert_one({
                'id': str(uuid.uuid4()),
                'name': 'Tuition Fee',
                'description': f'Tuition for {chain}',
                'amount': DEFAULT_TUITION.get(chain, 1500000),
                'chain': chain,
                'class_name': None,
                'mandatory': True,
                'status': 'active',
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat(),
            })
            fs_created += 1
    print(f"Created {fs_created} fee structures")

    # Build fee_structure lookup: chain -> amount (chain-wide default)
    fs_amount = {}
    for fs in await db.fee_structures.find(
            {'status': 'active'}, {'_id': 0, 'chain': 1, 'amount': 1}).to_list(2000):
        if fs.get('chain') and not fs.get('class_name'):
            fs_amount[fs['chain']] = fs.get('amount', 0)

    # ---- 2. For each ACTIVE student, fill gaps ----
    print("\n=== Seeding student fees + payments ===")
    active_filter = {"status": {"$nin": ["graduated", "left"]}}
    students = await db.students.find(
        active_filter,
        {'_id': 1, 'id': 1, 'admission_no': 1, 'chain': 1, 'class_name': 1}
    ).to_list(5000)
    print(f"Found {len(students)} active students")

    sf_created = 0
    pay_created = 0
    now = datetime.now(timezone.utc)

    for student in students:
        chain = student.get('chain')
        if not chain:
            continue

        mongo_id = str(student.get('_id')) if student.get('_id') else None
        uuid_id = student.get('id')
        adm_no = student.get('admission_no')
        primary_id = uuid_id or mongo_id or adm_no
        if not primary_id:
            continue

        # ---- Ensure a student_fees record exists ----
        existing_sf = await db.student_fees.find_one({'student_id': primary_id})
        if not existing_sf:
            amount = fs_amount.get(chain, DEFAULT_TUITION.get(chain, 1500000))
            await db.student_fees.insert_one({
                'id': str(uuid.uuid4()),
                'student_id': primary_id,
                'chain': chain,
                'amount': amount,
                'paid_amount': 0,
                'balance': amount,
                'status': 'pending',
                'fee_type': 'tuition',
                'created_at': now.isoformat(),
                'updated_at': now.isoformat(),
            })
            sf_created += 1
            total_fee = amount
        else:
            total_fee = existing_sf.get('amount') or 0

        # ---- Ensure payments exist (only if none yet) ----
        existing_pay_count = await db.payments.count_documents({'student_id': primary_id})
        if existing_pay_count > 0:
            continue

        # Deterministic paid amount by admission_no / id
        seed_val = sum(ord(c) for c in (adm_no or primary_id))
        rng = random.Random(seed_val)
        roll = rng.random()

        if roll < 0.35:
            paid = total_fee          # fully paid
            n_payments = 3
        elif roll < 0.70:
            paid = int(total_fee * rng.uniform(0.4, 0.8))  # partial
            n_payments = 2
        else:
            paid = 0                  # unpaid
            n_payments = 0

        # Distribute paid amount across n_payments
        amounts = []
        remaining = paid
        for i in range(n_payments):
            if i == n_payments - 1:
                amounts.append(remaining)
            else:
                a = int(remaining * rng.uniform(0.2, 0.5))
                amounts.append(a)
                remaining -= a

        for amt in amounts:
            if amt <= 0:
                continue
            pay_date = now - timedelta(days=int(rng.uniform(1, 90)))
            await db.payments.insert_one({
                'id': str(uuid.uuid4()),
                'student_id': primary_id,
                'chain': chain,
                'amount': amt,
                'fee_type': 'tuition',
                'payment_method': rng.choice(['cash', 'mobile', 'bank']),
                'reference_no': f"SEED-{str(uuid.uuid4())[:8].upper()}",
                'created_at': pay_date.isoformat(),
            })
            pay_created += 1

    print(f"Created {sf_created} student_fees records")
    print(f"Created {pay_created} payment records")

    # ---- 3. Summary ----
    print("\n=== Summary ===")
    for chain in chains:
        if not chain:
            continue
        n_students = await db.students.count_documents(
            {"chain": chain, "status": {"$nin": ["graduated", "left"]}})
        n_sf = await db.student_fees.count_documents({'chain': chain})
        n_pay = await db.payments.count_documents({'chain': chain})
        print(f"{chain}: active_students={n_students}, student_fees={n_sf}, payments={n_pay}")

    client.close()
    print("\nDone. Open the Financial Report tab to verify the analytics.")


if __name__ == '__main__':
    asyncio.run(main())
