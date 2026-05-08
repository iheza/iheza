#!/usr/bin/env python3
"""
Import DUP Grade 7 students to production database (iheza_db)
Preserves existing student IDs so attendance and task records link back correctly.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Source DB (local test_database - where Grade 7 data currently lives)
SOURCE_MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
SOURCE_DB_NAME = 'test_database'

# Target DB (production iheza_db - where it needs to go)
TARGET_MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
TARGET_DB_NAME = 'iheza_db'

# Grade 7 student data with EXISTING IDs preserved
GRADE_7_STUDENTS = [
    {
        "id": "45973005-d63e-4975-8f64-d2e545484be2",
        "admission_no": "DUP/STU0002/2024",
        "first_name": "ABUBAKAR",
        "last_name": "SLIM",
        "name": "ABUBAKAR SLIM",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "male",
        "chain": "DUP",
        "parent_name": "SLIM",
        "parent_contact": "773441040",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "23b71262-91e7-4e62-b75b-74313a205f77",
        "admission_no": "DUP/STU0003/2019",
        "first_name": "AMMAR",
        "last_name": "AMEIR",
        "name": "AMMAR AMEIR",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "male",
        "chain": "DUP",
        "parent_name": "CHANDE",
        "parent_contact": "776410998",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "5b3e6640-ae05-4932-9dab-18f31856e42c",
        "admission_no": "DUP/STU0004/2024",
        "first_name": "ASMAA",
        "last_name": "HABIB",
        "name": "ASMAA HABIB",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "female",
        "chain": "DUP",
        "parent_name": "AMEIR",
        "parent_contact": "77903323",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "281e5bd5-8983-47e0-bf30-8f3e417cacd1",
        "admission_no": "DUP/STU0005/2023",
        "first_name": "IDAROUS",
        "last_name": "YUSSUF",
        "name": "IDAROUS YUSSUF",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "male",
        "chain": "DUP",
        "parent_name": "HABIB",
        "parent_contact": "656444373",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "a137a7ce-13bd-4ed9-98c0-0a776f8dfa3d",
        "admission_no": "DUP/STU0006/2020",
        "first_name": "ISMAIL",
        "last_name": "ABDALLA",
        "name": "ISMAIL ABDALLA",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "male",
        "chain": "DUP",
        "parent_name": "YUSSUF",
        "parent_contact": "77525132",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "5ae185fc-30f2-4cdb-9b6c-6028d00edbf5",
        "admission_no": "DUP/STU0007/2022",
        "first_name": "MALHA",
        "last_name": "HAFIDHI",
        "name": "MALHA HAFIDHI",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "female",
        "chain": "DUP",
        "parent_name": "ABDALLA",
        "parent_contact": "712346777",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "bd2ca508-4919-4337-8bf9-0f72d57fac49",
        "admission_no": "DUP/STU0008/2020",
        "first_name": "MAWADDAH",
        "last_name": "OSMAN",
        "name": "MAWADDAH OSMAN",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "female",
        "chain": "DUP",
        "parent_name": "HAFIDHI",
        "parent_contact": "777456202",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "8a3fd390-2b8c-418e-9976-241674a8c82d",
        "admission_no": "DUP/STU0009/2020",
        "first_name": "NURFAT",
        "last_name": "SAID",
        "name": "NURFAT SAID",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "female",
        "chain": "DUP",
        "parent_name": "OSMAN",
        "parent_contact": "773803231",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "8b386562-071c-4d12-a2d5-3abdcb6a766b",
        "admission_no": "DUP/STU0011/2025",
        "first_name": "SAIMINA",
        "last_name": "TAHIR",
        "name": "SAIMINA TAHIR",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "female",
        "chain": "DUP",
        "parent_name": "ALI KHAMIS",
        "parent_contact": "625879800",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "4c344554-e6c1-4658-89be-626f3439041d",
        "admission_no": "DUP/STU0012/2022",
        "first_name": "SUHEIL",
        "last_name": "KHAMIS",
        "name": "SUHEIL KHAMIS",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "male",
        "chain": "DUP",
        "parent_name": "TAHIR",
        "parent_contact": "773908844",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    },
    {
        "id": "249317a6-36c6-4946-b578-140625a28f3f",
        "admission_no": "DUP/STU0013/2019",
        "first_name": "WALID",
        "last_name": "ALI",
        "name": "WALID ALI",
        "class_name": "GRADE 7",
        "date_of_birth": "2015-01-01",
        "gender": "male",
        "chain": "DUP",
        "parent_name": "KHAMIS",
        "parent_contact": "773515052",
        "parent_email": "",
        "address": "",
        "status": "active",
        "role": "student",
        "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK"
    }
]

async def ensure_grade7_class(db):
    """Create GRADE 7 class in target DB if it doesn't exist"""
    print("\n" + "=" * 60)
    print("Ensuring GRADE 7 class exists")
    print("=" * 60)
    
    existing = await db.classes.find_one({"name": "GRADE 7", "chain": "DUP"})
    if existing:
        print(f"  GRADE 7 class already exists (id: {existing['id']})")
        return existing['id']
    
    import uuid
    class_id = str(uuid.uuid4())
    class_doc = {
        "id": class_id,
        "name": "GRADE 7",
        "level": "primary",
        "capacity": 30,
        "chain": "DUP",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.classes.insert_one(class_doc)
    print(f"  Created GRADE 7 class (id: {class_id})")
    return class_id


async def import_grade7_students(db, class_id):
    """Import Grade 7 students with their EXISTING IDs"""
    print("\n" + "=" * 60)
    print("Importing Grade 7 Students")
    print("=" * 60)
    
    created = 0
    updated = 0
    skipped = 0
    
    for student in GRADE_7_STUDENTS:
        # Check if student already exists by admission_no
        existing = await db.students.find_one({"admission_no": student["admission_no"]})
        
        if existing:
            print(f"  EXISTS: {student['first_name']} {student['last_name']} ({student['admission_no']}) - id: {existing['id']}")
            skipped += 1
            continue
        
        now = datetime.now(timezone.utc).isoformat()
        student_doc = {
            "id": student["id"],  # PRESERVE existing ID
            "admission_no": student["admission_no"],
            "first_name": student["first_name"],
            "last_name": student["last_name"],
            "name": student["name"],
            "class_name": student["class_name"],
            "class_id": class_id,
            "date_of_birth": student["date_of_birth"],
            "gender": student["gender"],
            "chain": student["chain"],
            "parent_name": student["parent_name"],
            "parent_contact": student["parent_contact"],
            "parent_email": student["parent_email"],
            "address": student["address"],
            "status": student["status"],
            "role": student["role"],
            "password_hash": student["password_hash"],
            "created_at": now,
            "updated_at": now
        }
        
        await db.students.insert_one(student_doc)
        print(f"  CREATED: {student['first_name']} {student['last_name']} ({student['admission_no']}) - id: {student['id']}")
        created += 1
    
    print(f"\nResults: {created} created, {updated} updated, {skipped} skipped")
    return created


async def verify_import(db):
    """Verify the import"""
    print("\n" + "=" * 60)
    print("Verification")
    print("=" * 60)
    
    g7_count = await db.students.count_documents({"class_name": "GRADE 7", "chain": "DUP"})
    dup_count = await db.students.count_documents({"chain": "DUP"})
    class_count = await db.classes.count_documents({"name": "GRADE 7", "chain": "DUP"})
    
    print(f"Grade 7 students in target DB: {g7_count}")
    print(f"Total DUP students in target DB: {dup_count}")
    print(f"GRADE 7 class exists: {class_count > 0}")
    
    if g7_count > 0:
        samples = await db.students.find(
            {"class_name": "GRADE 7", "chain": "DUP"},
            {"_id": 0, "first_name": 1, "last_name": 1, "admission_no": 1, "id": 1}
        ).to_list(20)
        print("\nGrade 7 students:")
        for s in samples:
            print(f"  - {s['first_name']} {s['last_name']} ({s['admission_no']}) [id: {s['id']}]")


async def main():
    """Main function"""
    print("=" * 60)
    print("DUP Grade 7 Import to Production")
    print("=" * 60)
    print(f"\nSource DB: {SOURCE_DB_NAME}")
    print(f"Target DB: {TARGET_DB_NAME}")
    
    target_client = AsyncIOMotorClient(TARGET_MONGO_URL)
    target_db = target_client[TARGET_DB_NAME]
    
    try:
        # Step 1: Ensure GRADE 7 class exists
        class_id = await ensure_grade7_class(target_db)
        
        # Step 2: Import Grade 7 students with existing IDs
        await import_grade7_students(target_db, class_id)
        
        # Step 3: Verify
        await verify_import(target_db)
        
        print("\n" + "=" * 60)
        print("Import Completed Successfully!")
        print("=" * 60)
        print("\nGrade 7 students are now available in the production database (iheza_db).")
        print("Their IDs are preserved, so any existing attendance or task records")
        print("that reference these IDs will link back correctly.")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
