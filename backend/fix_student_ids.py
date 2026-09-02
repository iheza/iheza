#!/usr/bin/env python3
"""
Fix students that are missing a proper UUID 'id' field.

Problem:
Some students (e.g. DLP/STU0374/2025) were imported with a corrupted string
`_id` (invalid UTF-8 bytes) and NO `id` field. Their student_fees / payments
records were keyed by that corrupted `_id` string. The frontend FeesManagement
component looks students up by `student.id` (UUID) or `admission_no`, so it
cannot find fee data keyed by the corrupted `_id` -> "No fee data available".

Fix:
- Assign a proper UUID4 string to each student's `id` field.
- Re-key that student's student_fees and payments records from the corrupted
  `_id` string to the new UUID, so the whole system (which uses `student.id`
  as the canonical student_id) can find them.

Idempotent: only touches students whose `id` is missing/empty.
"""

import asyncio
import os
import uuid

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, '.env'))

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connected to {DB_NAME}")

    # Students missing a usable 'id'
    missing = await db.students.find(
        {'id': {'$in': [None, '']}},
        {'_id': 1, 'id': 1, 'admission_no': 1, 'chain': 1}
    ).to_list(5000)
    print(f"Found {len(missing)} students missing an 'id' field")

    fixed_students = 0
    rekeyed_fees = 0
    rekeyed_payments = 0

    for s in missing:
        old_key = str(s.get('_id')) if s.get('_id') is not None else None
        adm_no = s.get('admission_no')
        new_uuid = str(uuid.uuid4())

        # 1) Assign the UUID id to the student
        await db.students.update_one(
            {'_id': s['_id']},
            {'$set': {'id': new_uuid}}
        )
        fixed_students += 1

        # 2) Re-key student_fees records that used the old corrupted _id key
        if old_key:
            res = await db.student_fees.update_many(
                {'student_id': old_key},
                {'$set': {'student_id': new_uuid}}
            )
            rekeyed_fees += res.modified_count

        # 3) Re-key payments records that used the old corrupted _id key
        if old_key:
            res = await db.payments.update_many(
                {'student_id': old_key},
                {'$set': {'student_id': new_uuid}}
            )
            rekeyed_payments += res.modified_count

        # 4) Safety: also re-key any records keyed by admission_no (rare), but
        #    only if the student has no existing UUID-keyed record already.
        if adm_no:
            existing_fee = await db.student_fees.find_one({'student_id': new_uuid})
            if not existing_fee:
                res = await db.student_fees.update_many(
                    {'student_id': adm_no},
                    {'$set': {'student_id': new_uuid}}
                )
                rekeyed_fees += res.modified_count
            existing_pay = await db.payments.find_one({'student_id': new_uuid})
            if not existing_pay:
                res = await db.payments.update_many(
                    {'student_id': adm_no},
                    {'$set': {'student_id': new_uuid}}
                )
                rekeyed_payments += res.modified_count

    print(f"Assigned UUID id to {fixed_students} students")
    print(f"Re-keyed {rekeyed_fees} student_fees records")
    print(f"Re-keyed {rekeyed_payments} payments records")

    # Verify the example student
    s = await db.students.find_one({'admission_no': 'DLP/STU0374/2025'})
    if s:
        print("\nVerification DLP/STU0374/2025:")
        print("  id:", s.get('id'))
        nf = await db.student_fees.count_documents({'student_id': s.get('id')})
        np_ = await db.payments.count_documents({'student_id': s.get('id')})
        print(f"  student_fees by new id: {nf}, payments by new id: {np_}")

    client.close()
    print("\nDone.")


if __name__ == '__main__':
    asyncio.run(main())
