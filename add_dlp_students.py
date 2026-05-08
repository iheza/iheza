#!/usr/bin/env python3
"""
Add DLP students to the IHEZA School Management System
This script adds the 24 DLP students provided in the task
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import bcrypt
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'iheza_db')]

# Default password for all students
DEFAULT_PASSWORD = "student123"

# DLP students from the task
DLP_STUDENTS = [
    # Format: admission_no, full_name, gender, grade (A/B from data)
    {"admission_no": "DLP/STU0384/2025", "full_name": "NAHYA AMRAN MASOUD", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0356/2025", "full_name": "NARMIN SAID ALI", "gender": "FEMALE", "grade": "B"},
    {"admission_no": "DLP/STU0371/2025", "full_name": "NIMAAH OMARI MHANGO", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0377/2025", "full_name": "RAGHIB MOHAMED SEIF", "gender": "MALE", "grade": "B"},
    {"admission_no": "DLP/STU0369/2025", "full_name": "RAHMINA SIMAI KIBORO", "gender": "FEMALE", "grade": "B"},
    {"admission_no": "DLP/STU0385/2025", "full_name": "RAYA SAID ALI", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0386/2025", "full_name": "RAYYAN ABDULLA OTHMAN", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0387/2025", "full_name": "REHEMA SULEIMAN HASSAN", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0434/2025", "full_name": "RIYADH HILAL AMOUR", "gender": "MALE", "grade": "A"},
    {"admission_no": "DLP/STU0381/2025", "full_name": "RUHEEN MOHAMMED IBRAHIM", "gender": "FEMALE", "grade": "B"},
    {"admission_no": "DLP/STU0380/2025", "full_name": "RUQAIYYA SAID AME", "gender": "FEMALE", "grade": "B"},
    {"admission_no": "DLP/STU0436/2025", "full_name": "SAHIM SULEIMAN JUMA", "gender": "MALE", "grade": "A"},
    {"admission_no": "DLP/STU0435/2025", "full_name": "SALAMA MOHAMMAD IBRAHIM", "gender": "FEMALE", "grade": "B"},
    {"admission_no": "DLP/STU0388/2025", "full_name": "SALMA SAID FARAJI", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0378/2025", "full_name": "SAMEED MOHAMED SULEIMAN", "gender": "MALE", "grade": "B"},
    {"admission_no": "DLP/STU0366/2025", "full_name": "SHAHZAD SHAABAN MTUMWA", "gender": "MALE", "grade": "A"},
    {"admission_no": "DLP/STU0353/2025", "full_name": "SUHAIL SALUM FAKIH", "gender": "MALE", "grade": "A"},
    {"admission_no": "DLP/STU0389/2025", "full_name": "SUHAILA ALI ABDI", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0351/2025", "full_name": "TAQLIF HAMZA YAHYA", "gender": "MALE", "grade": "B"},
    {"admission_no": "DLP/STU0360/2025", "full_name": "THAMRAT HAMID TAHIR", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0359/2025", "full_name": "THAURAT HAMID TAHIR", "gender": "FEMALE", "grade": "B"},
    {"admission_no": "DLP/STU0358/2025", "full_name": "THUMAIRAT HAMID TAHIR", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0390/2025", "full_name": "WIYYAM MOHAMMED SHEHA", "gender": "FEMALE", "grade": "A"},
    {"admission_no": "DLP/STU0355/2025", "full_name": "ZUWENA MUHAMMED SALUM", "gender": "FEMALE", "grade": "B"},
]

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def create_dlp_classes():
    """Create DLP classes if they don't exist"""
    print("Creating DLP classes...")
    
    # DLP classes - assuming primary school classes
    dlp_classes = [
        {"name": "GRADE 1", "level": "primary", "capacity": 30},
        {"name": "GRADE 2", "level": "primary", "capacity": 30},
        {"name": "GRADE 3", "level": "primary", "capacity": 30},
        {"name": "GRADE 4", "level": "primary", "capacity": 30},
        {"name": "GRADE 5", "level": "primary", "capacity": 30},
        {"name": "GRADE 6", "level": "primary", "capacity": 30},
        {"name": "GRADE 7", "level": "primary", "capacity": 30},
    ]
    
    created = 0
    for cls in dlp_classes:
        existing = await db.classes.find_one({"name": cls["name"], "chain": "DLP"})
        if not existing:
            class_doc = {
                "id": str(uuid.uuid4()),
                "name": cls["name"],
                "level": cls["level"],
                "capacity": cls["capacity"],
                "chain": "DLP",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.classes.insert_one(class_doc)
            print(f"  Created class: {cls['name']}")
            created += 1
        else:
            print(f"  Class already exists: {cls['name']}")
    
    print(f"Created {created} new DLP classes!")
    return created

async def add_dlp_students():
    """Add DLP students to the database"""
    print(f"\nAdding {len(DLP_STUDENTS)} DLP students...")
    
    password_hash = hash_password(DEFAULT_PASSWORD)
    added = 0
    skipped = 0
    
    # Get DLP classes to assign students
    dlp_classes = await db.classes.find({"chain": "DLP"}).to_list(10)
    if not dlp_classes:
        print("  No DLP classes found! Creating default classes...")
        await create_dlp_classes()
        dlp_classes = await db.classes.find({"chain": "DLP"}).to_list(10)
    
    # Assign students to classes (distribute across available classes)
    class_names = [c["name"] for c in dlp_classes]
    
    for i, student_data in enumerate(DLP_STUDENTS):
        # Check if student already exists
        existing = await db.students.find_one({"admission_no": student_data["admission_no"]})
        if existing:
            print(f"  Student already exists: {student_data['admission_no']} - {student_data['full_name']}")
            skipped += 1
            continue
        
        # Parse full name into first and last name
        name_parts = student_data["full_name"].split()
        first_name = name_parts[0] if len(name_parts) > 0 else ""
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else name_parts[0] if name_parts else ""
        
        # Assign to a class (round-robin distribution)
        class_name = class_names[i % len(class_names)]
        
        student_doc = {
            "id": str(uuid.uuid4()),
            "admission_no": student_data["admission_no"],
            "first_name": first_name,
            "last_name": last_name,
            "name": student_data["full_name"],
            "class_name": class_name,
            "date_of_birth": "2015-01-01",  # Default DOB
            "gender": student_data["gender"].lower(),
            "chain": "DLP",
            "parent_name": "",
            "parent_contact": "",
            "parent_email": "",
            "address": "",
            "status": "active",
            "role": "student",
            "password_hash": password_hash,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.students.insert_one(student_doc)
        added += 1
        print(f"  Added: {student_data['admission_no']} - {student_data['full_name']} ({student_data['gender']}) -> {class_name}")
    
    print(f"\nAdded {added} new DLP students, skipped {skipped} existing students.")
    return added

async def verify_import():
    """Verify the DLP students were added successfully"""
    print("\n=== VERIFICATION ===")
    
    # Count DLP students
    dlp_students_count = await db.students.count_documents({"chain": "DLP"})
    print(f"Total DLP students in database: {dlp_students_count}")
    
    # Count by class
    pipeline = [
        {"$match": {"chain": "DLP"}},
        {"$group": {"_id": "$class_name", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    
    class_counts = await db.students.aggregate(pipeline).to_list(20)
    print("\nDLP students by class:")
    for cc in class_counts:
        print(f"  {cc['_id']}: {cc['count']} students")
    
    # List all DLP students
    print("\nAll DLP students:")
    dlp_students = await db.students.find(
        {"chain": "DLP"}, 
        {"_id": 0, "admission_no": 1, "first_name": 1, "last_name": 1, "class_name": 1, "gender": 1}
    ).sort("admission_no", 1).to_list(100)
    
    for student in dlp_students:
        print(f"  {student['admission_no']}: {student['first_name']} {student['last_name']} ({student['gender']}) - {student['class_name']}")

async def main():
    print("=" * 60)
    print("IHEZA School Management System - Add DLP Students")
    print("=" * 60)
    
    # Create DLP classes if needed
    await create_dlp_classes()
    
    # Add DLP students
    added = await add_dlp_students()
    
    # Verify import
    await verify_import()
    
    print("\n" + "=" * 60)
    if added > 0:
        print(f"Successfully added {added} DLP students!")
    else:
        print("No new students added (all already exist).")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())