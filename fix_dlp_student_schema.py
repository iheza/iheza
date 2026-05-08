#!/usr/bin/env python3
"""
Fix DLP student schema to match API expectations
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'iheza_db')]

async def fix_dlp_student_schema():
    """Update DLP students to match expected API schema"""
    print("Fixing DLP student schema...")
    
    # Get all DLP students
    dlp_students = await db.students.find({"chain": "DLP"}).to_list(100)
    print(f"Found {len(dlp_students)} DLP students to update")
    
    updated = 0
    for student in dlp_students:
        # Update fields to match API expectations
        update_fields = {}
        
        # Ensure gender is uppercase (API shows "MALE"/"FEMALE" not "male"/"female")
        if "gender" in student and student["gender"].lower() in ["male", "female"]:
            update_fields["gender"] = student["gender"].upper()
        
        # Map parent_contact to parent_phone if needed
        if "parent_contact" in student and student["parent_contact"]:
            update_fields["parent_phone"] = student["parent_contact"]
        
        # Add admission_date if missing (use created_at date)
        if "admission_date" not in student and "created_at" in student:
            # Extract date part from ISO timestamp
            created_at = student["created_at"]
            if "T" in created_at:
                update_fields["admission_date"] = created_at.split("T")[0]
        
        # Remove fields that shouldn't be in API response
        # (These will still be in database but API might filter them)
        
        if update_fields:
            await db.students.update_one(
                {"_id": student["_id"]},
                {"$set": update_fields}
            )
            updated += 1
            print(f"  Updated: {student.get('admission_no', 'Unknown')}")
    
    print(f"\nUpdated {updated} DLP students")
    return updated

async def verify_fix():
    """Verify the schema fix worked"""
    print("\n=== VERIFICATION ===")
    
    # Check a sample DLP student
    student = await db.students.find_one({"chain": "DLP"})
    if student:
        print("Sample DLP student after fix:")
        print(f"  Admission No: {student.get('admission_no')}")
        print(f"  Name: {student.get('name')}")
        print(f"  Gender: {student.get('gender')}")
        print(f"  Class: {student.get('class_name')}")
        print(f"  Parent Phone: {student.get('parent_phone', 'Not set')}")
        print(f"  Admission Date: {student.get('admission_date', 'Not set')}")
        print(f"  Chain: {student.get('chain')}")
    
    # Count DLP students with proper schema
    count = await db.students.count_documents({
        "chain": "DLP",
        "gender": {"$in": ["MALE", "FEMALE"]}
    })
    print(f"\nDLP students with proper gender format: {count}")

async def main():
    print("=" * 60)
    print("Fix DLP Student Schema")
    print("=" * 60)
    
    await fix_dlp_student_schema()
    await verify_fix()
    
    print("\n" + "=" * 60)
    print("Schema fix completed!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())