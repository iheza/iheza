#!/usr/bin/env python3
"""
Script to import DLP students to production MongoDB
This script contains the DLP student data and can be run against production
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection - UPDATE THIS FOR PRODUCTION
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'iheza_db')

# DLP Students Data
DLP_STUDENTS = [
    {"first_name": "Ahmed", "last_name": "Hassan", "admission_no": "DLP/STU0001/2024", "class_name": "Grade 1A", "gender": "MALE"},
    {"first_name": "Fatma", "last_name": "Ali", "admission_no": "DLP/STU0002/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
    {"first_name": "Omar", "last_name": "Salim", "admission_no": "DLP/STU0003/2024", "class_name": "Grade 1B", "gender": "MALE"},
    {"first_name": "Aisha", "last_name": "Mohamed", "admission_no": "DLP/STU0004/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
    {"first_name": "Yusuf", "last_name": "Ibrahim", "admission_no": "DLP/STU0005/2024", "class_name": "Grade 2A", "gender": "MALE"},
    {"first_name": "Zainab", "last_name": "Rashid", "admission_no": "DLP/STU0006/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
    {"first_name": "Hassan", "last_name": "Juma", "admission_no": "DLP/STU0007/2024", "class_name": "Grade 2B", "gender": "MALE"},
    {"first_name": "Mariam", "last_name": "Abdi", "admission_no": "DLP/STU0008/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
    {"first_name": "Khalid", "last_name": "Omar", "admission_no": "DLP/STU0009/2024", "class_name": "Grade 3A", "gender": "MALE"},
    {"first_name": "Salma", "last_name": "Ahmed", "admission_no": "DLP/STU0010/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
    {"first_name": "Ibrahim", "last_name": "Hassan", "admission_no": "DLP/STU0011/2024", "class_name": "Grade 3B", "gender": "MALE"},
    {"first_name": "Halima", "last_name": "Yusuf", "admission_no": "DLP/STU0012/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
    {"first_name": "Abdi", "last_name": "Mohamed", "admission_no": "DLP/STU0013/2024", "class_name": "Grade 1A", "gender": "MALE"},
    {"first_name": "Khadija", "last_name": "Ali", "admission_no": "DLP/STU0014/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
    {"first_name": "Said", "last_name": "Salim", "admission_no": "DLP/STU0015/2024", "class_name": "Grade 1B", "gender": "MALE"},
    {"first_name": "Amina", "last_name": "Rashid", "admission_no": "DLP/STU0016/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
    {"first_name": "Hamza", "last_name": "Juma", "admission_no": "DLP/STU0017/2024", "class_name": "Grade 2A", "gender": "MALE"},
    {"first_name": "Rahma", "last_name": "Abdi", "admission_no": "DLP/STU0018/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
    {"first_name": "Musa", "last_name": "Omar", "admission_no": "DLP/STU0019/2024", "class_name": "Grade 2B", "gender": "MALE"},
    {"first_name": "Safia", "last_name": "Hassan", "admission_no": "DLP/STU0020/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
    {"first_name": "Ali", "last_name": "Ibrahim", "admission_no": "DLP/STU0021/2024", "class_name": "Grade 3A", "gender": "MALE"},
    {"first_name": "Maryam", "last_name": "Yusuf", "admission_no": "DLP/STU0022/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
    {"first_name": "Juma", "last_name": "Mohamed", "admission_no": "DLP/STU0023/2024", "class_name": "Grade 3B", "gender": "MALE"},
    {"first_name": "Nasra", "last_name": "Ali", "admission_no": "DLP/STU0024/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
    {"first_name": "Rashid", "last_name": "Salim", "admission_no": "DLP/STU0025/2024", "class_name": "Grade 1A", "gender": "MALE"},
    {"first_name": "Fatuma", "last_name": "Rashid", "admission_no": "DLP/STU0026/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
    {"first_name": "Salim", "last_name": "Juma", "admission_no": "DLP/STU0027/2024", "class_name": "Grade 1B", "gender": "MALE"},
    {"first_name": "Asma", "last_name": "Abdi", "admission_no": "DLP/STU0028/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
    {"first_name": "Mohamed", "last_name": "Omar", "admission_no": "DLP/STU0029/2024", "class_name": "Grade 2A", "gender": "MALE"},
    {"first_name": "Hafsa", "last_name": "Hassan", "admission_no": "DLP/STU0030/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
    {"first_name": "Issa", "last_name": "Ibrahim", "admission_no": "DLP/STU0031/2024", "class_name": "Grade 2B", "gender": "MALE"},
    {"first_name": "Rukia", "last_name": "Yusuf", "admission_no": "DLP/STU0032/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
    {"first_name": "Bakari", "last_name": "Mohamed", "admission_no": "DLP/STU0033/2024", "class_name": "Grade 3A", "gender": "MALE"},
    {"first_name": "Jamila", "last_name": "Ali", "admission_no": "DLP/STU0034/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
    {"first_name": "Suleiman", "last_name": "Salim", "admission_no": "DLP/STU0035/2024", "class_name": "Grade 3B", "gender": "MALE"},
    {"first_name": "Safiya", "last_name": "Rashid", "admission_no": "DLP/STU0036/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
    {"first_name": "Yunus", "last_name": "Juma", "admission_no": "DLP/STU0037/2024", "class_name": "Grade 1A", "gender": "MALE"},
    {"first_name": "Nuru", "last_name": "Abdi", "admission_no": "DLP/STU0038/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
    {"first_name": "Idris", "last_name": "Omar", "admission_no": "DLP/STU0039/2024", "class_name": "Grade 1B", "gender": "MALE"},
    {"first_name": "Sumaiya", "last_name": "Hassan", "admission_no": "DLP/STU0040/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
    {"first_name": "Abubakar", "last_name": "Ibrahim", "admission_no": "DLP/STU0041/2024", "class_name": "Grade 2A", "gender": "MALE"},
    {"first_name": "Asha", "last_name": "Yusuf", "admission_no": "DLP/STU0042/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
    {"first_name": "Hamis", "last_name": "Mohamed", "admission_no": "DLP/STU0043/2024", "class_name": "Grade 2B", "gender": "MALE"},
    {"first_name": "Hawa", "last_name": "Ali", "admission_no": "DLP/STU0044/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
    {"first_name": "Seif", "last_name": "Salim", "admission_no": "DLP/STU0045/2024", "class_name": "Grade 3A", "gender": "MALE"},
    {"first_name": "Tatu", "last_name": "Rashid", "admission_no": "DLP/STU0046/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
    {"first_name": "Omari", "last_name": "Juma", "admission_no": "DLP/STU0047/2024", "class_name": "Grade 3B", "gender": "MALE"},
    {"first_name": "Zawadi", "last_name": "Abdi", "admission_no": "DLP/STU0048/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
    {"first_name": "Hashim", "last_name": "Omar", "admission_no": "DLP/STU0049/2024", "class_name": "Grade 1A", "gender": "MALE"},
    {"first_name": "Waridi", "last_name": "Hassan", "admission_no": "DLP/STU0050/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
    {"first_name": "Mwinyi", "last_name": "Ibrahim", "admission_no": "DLP/STU0051/2024", "class_name": "Grade 1B", "gender": "MALE"},
    {"first_name": "Baraka", "last_name": "Yusuf", "admission_no": "DLP/STU0052/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
    {"first_name": "Jafari", "last_name": "Mohamed", "admission_no": "DLP/STU0053/2024", "class_name": "Grade 2A", "gender": "MALE"},
    {"first_name": "Neema", "last_name": "Ali", "admission_no": "DLP/STU0054/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
    {"first_name": "Zuberi", "last_name": "Salim", "admission_no": "DLP/STU0055/2024", "class_name": "Grade 2B", "gender": "MALE"},
    {"first_name": "Pili", "last_name": "Rashid", "admission_no": "DLP/STU0056/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
    {"first_name": "Daudi", "last_name": "Juma", "admission_no": "DLP/STU0057/2024", "class_name": "Grade 3A", "gender": "MALE"},
    {"first_name": "Mwajuma", "last_name": "Abdi", "admission_no": "DLP/STU0058/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
    {"first_name": "Ramadhan", "last_name": "Omar", "admission_no": "DLP/STU0059/2024", "class_name": "Grade 3B", "gender": "MALE"},
    {"first_name": "Shani", "last_name": "Hassan", "admission_no": "DLP/STU0060/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
    {"first_name": "Shabani", "last_name": "Ibrahim", "admission_no": "DLP/STU0061/2024", "class_name": "Grade 1A", "gender": "MALE"},
    {"first_name": "Riziki", "last_name": "Yusuf", "admission_no": "DLP/STU0062/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
    {"first_name": "Kombo", "last_name": "Mohamed", "admission_no": "DLP/STU0063/2024", "class_name": "Grade 1B", "gender": "MALE"},
    {"first_name": "Mariamu", "last_name": "Ali", "admission_no": "DLP/STU0064/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
    {"first_name": "Haji", "last_name": "Salim", "admission_no": "DLP/STU0065/2024", "class_name": "Grade 2A", "gender": "MALE"},
    {"first_name": "Hadija", "last_name": "Rashid", "admission_no": "DLP/STU0066/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
    {"first_name": "Jumanne", "last_name": "Juma", "admission_no": "DLP/STU0067/2024", "class_name": "Grade 2B", "gender": "MALE"},
    {"first_name": "Sikitu", "last_name": "Abdi", "admission_no": "DLP/STU0068/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
    {"first_name": "Hemedi", "last_name": "Omar", "admission_no": "DLP/STU0069/2024", "class_name": "Grade 3A", "gender": "MALE"},
    {"first_name": "Tausi", "last_name": "Hassan", "admission_no": "DLP/STU0070/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
    {"first_name": "Masoud", "last_name": "Ibrahim", "admission_no": "DLP/STU0071/2024", "class_name": "Grade 3B", "gender": "MALE"},
    {"first_name": "Mwanaisha", "last_name": "Yusuf", "admission_no": "DLP/STU0072/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
    {"first_name": "Nassor", "last_name": "Mohamed", "admission_no": "DLP/STU0073/2024", "class_name": "Grade 1A", "gender": "MALE"},
    {"first_name": "Zuhura", "last_name": "Ali", "admission_no": "DLP/STU0074/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
    {"first_name": "Makame", "last_name": "Salim", "admission_no": "DLP/STU0075/2024", "class_name": "Grade 1B", "gender": "MALE"},
    {"first_name": "Mwanakombo", "last_name": "Rashid", "admission_no": "DLP/STU0076/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
    {"first_name": "Vuai", "last_name": "Juma", "admission_no": "DLP/STU0077/2024", "class_name": "Grade 2A", "gender": "MALE"},
    {"first_name": "Aziza", "last_name": "Abdi", "admission_no": "DLP/STU0078/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
    {"first_name": "Khamis", "last_name": "Omar", "admission_no": "DLP/STU0079/2024", "class_name": "Grade 2B", "gender": "MALE"},
    {"first_name": "Saada", "last_name": "Hassan", "admission_no": "DLP/STU0080/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
    {"first_name": "Shaaban", "last_name": "Ibrahim", "admission_no": "DLP/STU0081/2024", "class_name": "Grade 3A", "gender": "MALE"},
    {"first_name": "Binti", "last_name": "Yusuf", "admission_no": "DLP/STU0082/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
    {"first_name": "Machano", "last_name": "Mohamed", "admission_no": "DLP/STU0083/2024", "class_name": "Grade 3B", "gender": "MALE"},
    {"first_name": "Mwanajuma", "last_name": "Ali", "admission_no": "DLP/STU0084/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
    {"first_name": "Salehe", "last_name": "Salim", "admission_no": "DLP/STU0085/2024", "class_name": "Grade 1A", "gender": "MALE"},
    {"first_name": "Rehema", "last_name": "Rashid", "admission_no": "DLP/STU0086/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
    {"first_name": "Mzee", "last_name": "Juma", "admission_no": "DLP/STU0087/2024", "class_name": "Grade 1B", "gender": "MALE"},
    {"first_name": "Subira", "last_name": "Abdi", "admission_no": "DLP/STU0088/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
]

# DLP Classes
DLP_CLASSES = [
    {"name": "Grade 1A", "level": "Grade 1", "capacity": 40},
    {"name": "Grade 1B", "level": "Grade 1", "capacity": 40},
    {"name": "Grade 2A", "level": "Grade 2", "capacity": 40},
    {"name": "Grade 2B", "level": "Grade 2", "capacity": 40},
    {"name": "Grade 3A", "level": "Grade 3", "capacity": 40},
    {"name": "Grade 3B", "level": "Grade 3", "capacity": 40},
]

async def import_dlp_classes(db):
    """Import DLP classes"""
    print("\n" + "=" * 60)
    print("Importing DLP Classes")
    print("=" * 60)
    
    created = 0
    updated = 0
    
    for cls in DLP_CLASSES:
        existing = await db.classes.find_one({"name": cls["name"], "chain": "DLP"})
        
        if existing:
            print(f"  Class exists: {cls['name']}")
            updated += 1
        else:
            class_doc = {
                "id": str(uuid.uuid4()),
                "name": cls["name"],
                "level": cls["level"],
                "capacity": cls["capacity"],
                "chain": "DLP",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.classes.insert_one(class_doc)
            print(f"  Created class: {cls['name']}")
            created += 1
    
    print(f"\nClasses: {created} created, {updated} already existed")
    return created, updated

async def import_dlp_students(db):
    """Import DLP students"""
    print("\n" + "=" * 60)
    print("Importing DLP Students")
    print("=" * 60)
    
    # Get class IDs
    classes = await db.classes.find({"chain": "DLP"}, {"_id": 0}).to_list(20)
    class_map = {c["name"]: c["id"] for c in classes}
    
    created = 0
    updated = 0
    
    for student in DLP_STUDENTS:
        existing = await db.students.find_one({"admission_no": student["admission_no"]})
        
        class_id = class_map.get(student["class_name"])
        
        if existing:
            # Update existing student
            await db.students.update_one(
                {"admission_no": student["admission_no"]},
                {"$set": {
                    "first_name": student["first_name"],
                    "last_name": student["last_name"],
                    "class_name": student["class_name"],
                    "class_id": class_id,
                    "gender": student["gender"],
                    "chain": "DLP",
                    "status": "active",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            updated += 1
        else:
            # Create new student
            student_doc = {
                "id": str(uuid.uuid4()),
                "admission_no": student["admission_no"],
                "first_name": student["first_name"],
                "last_name": student["last_name"],
                "class_name": student["class_name"],
                "class_id": class_id,
                "gender": student["gender"],
                "chain": "DLP",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.students.insert_one(student_doc)
            created += 1
    
    print(f"\nStudents: {created} created, {updated} updated")
    return created, updated

async def verify_import(db):
    """Verify the import"""
    print("\n" + "=" * 60)
    print("Verification")
    print("=" * 60)
    
    dlp_students = await db.students.count_documents({"chain": "DLP"})
    dlp_classes = await db.classes.count_documents({"chain": "DLP"})
    
    print(f"DLP Students: {dlp_students}")
    print(f"DLP Classes: {dlp_classes}")
    
    # Sample students
    samples = await db.students.find({"chain": "DLP"}, {"_id": 0, "first_name": 1, "last_name": 1, "admission_no": 1, "class_name": 1}).to_list(5)
    print("\nSample DLP students:")
    for s in samples:
        print(f"  - {s.get('first_name')} {s.get('last_name')} ({s.get('admission_no')}) - {s.get('class_name')}")
    
    return dlp_students, dlp_classes

async def main():
    """Main function"""
    print("=" * 60)
    print("DLP Students Import Tool")
    print("=" * 60)
    print(f"\nDatabase: {db_name}")
    print(f"MongoDB URL: {mongo_url[:30]}...")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Import classes first
        await import_dlp_classes(db)
        
        # Import students
        await import_dlp_students(db)
        
        # Verify
        await verify_import(db)
        
        print("\n" + "=" * 60)
        print("Import Completed Successfully!")
        print("=" * 60)
        print("\nDLP students are now available in the database.")
        print("Please refresh the browser and login as DLP Principal to see students.")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
