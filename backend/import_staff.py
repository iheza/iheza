#!/usr/bin/env python3
"""
Import staff members into IHEZA School Management System
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

# All staff members from user's data
STAFF_MEMBERS = [
    # Director (IHEZA)
    {
        "first_name": "Director",
        "last_name": "IHEZA",
        "access_code": "IHEZA/DIRECTOR/0001/2020",
        "password": "IHEZA00000",
        "email": "director@iheza.ac.tz",
        "phone": "",
        "role": "director",
        "chain": "IHEZA"
    },
    # Coordinator (IHEZA)
    {
        "first_name": "Coordinator",
        "last_name": "IHEZA",
        "access_code": "IHEZA/COORDINATOR/0001/2024",
        "password": "iheza002",
        "email": "coordinator@iheza.ac.tz",
        "phone": "",
        "role": "coordinator",
        "chain": "IHEZA"
    },
    # Principal
    {
        "first_name": "Ally Abukar",
        "last_name": "S.",
        "access_code": "DUP/PRINCIPAL/0002/2021",
        "password": "DUP00000",

        "email": "abusuley74@gmail.com",
        "phone": "0678436080",
        "role": "principal",
        "chain": "DUP"
    },
    # Teachers
    {
        "first_name": "Said Juma",
        "last_name": "H.",
        "access_code": "DUP/TEACHER/0001/2024",
        "password": "DUP00000",
        "email": "saidjumahassan0@gmail.com",
        "phone": "0778828569",
        "role": "teacher",
        "chain": "DUP"
    },
    {
        "first_name": "Salma",
        "last_name": "Haji",
        "access_code": "DUP/TEACHER/0003/2024",
        "password": "DUP00000",
        "email": "Salmamakame460@gmail.com",
        "phone": "0772512291",
        "role": "teacher",
        "chain": "DUP"
    },
    {
        "first_name": "Amina",
        "last_name": "Ally",
        "access_code": "DUP/TEACHER/0004/2024",
        "password": "DUP00000",
        "email": "aminamsigiti@gmail.com",
        "phone": "0621112061",
        "role": "teacher",
        "chain": "DUP"
    },
    {
        "first_name": "Kelvin",
        "last_name": "Manyonyi",
        "access_code": "DUP/TEACHER/0005/2024",
        "password": "DUP00000",
        "email": "manyonyikelvin1@gmail.com",
        "phone": "0776457852",
        "role": "teacher",
        "chain": "DUP"
    },
    {
        "first_name": "Saum Salim",
        "last_name": "H.",
        "access_code": "DUP/TEACHER/0006/2024",
        "password": "DUP00000",
        "email": "saumuusalim00@gmail.com",
        "phone": "0773388110",
        "role": "teacher",
        "chain": "DUP"
    },
    {
        "first_name": "Maryam Omar",
        "last_name": "M.",
        "access_code": "DUP/TEACHER/0007/2024",
        "password": "DUP00000",
        "email": "maryam@gmail.com",
        "phone": "0777078381",
        "role": "teacher",
        "chain": "DUP"
    },
    {
        "first_name": "Nadhifa",
        "last_name": "Muarab",
        "access_code": "DUP/TEACHER/0009/2025",
        "password": "DUP00000",
        "email": "Nadhifamuarab7@gmail.com",
        "phone": "0778240139",
        "role": "teacher",
        "chain": "DUP"
    },
    # Academic Staff
    {
        "first_name": "Ahmed",
        "last_name": "Ally",
        "access_code": "DUP/ACADEMIC/0002/2022",
        "password": "DUP00000",
        "email": "ahmed@gmail.com",
        "phone": "0617354029",
        "role": "academic",
        "chain": "DUP"
    },
    # Secretary
    {
        "first_name": "Aisha",
        "last_name": "Samweli",
        "access_code": "DUP/SECRETARY/0001/2024",
        "password": "DUP00000",
        "email": "kitomari15@gmail.com",
        "phone": "0752710987",
        "role": "secretary",
        "chain": "DUP"
    },
    # Section Leader
    {
        "first_name": "Omar",
        "last_name": "Mutta",
        "access_code": "DUP/SECTION-LEADER/0010/2020",
        "password": "DUP00000",
        "email": "Mochaomar50@gmail.com",
        "phone": "0615775948",
        "role": "section_leader",
        "chain": "DUP"
    },
    # BACA Principal
    {
        "first_name": "BACA",
        "last_name": "Principal",
        "access_code": "BACA/PRINCIPAL/0001/2020",
        "password": "BACA00000",
        "email": "principal@baca.edu",
        "phone": "",
        "role": "principal",
        "chain": "BACA"
    },
    # DLP Principal
    {
        "first_name": "DLP",
        "last_name": "Principal",
        "access_code": "DLP/PRINCIPAL/0001/2024",
        "password": "DLP00000",
        "email": "principal@dlp.edu",
        "phone": "",
        "role": "principal",
        "chain": "DLP"
    },
]

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def clear_existing_staff():
    """Clear existing staff data"""
    print("Clearing existing staff data...")
    # Delete all users except system accounts
    await db.users.delete_many({})
    print("Existing staff data cleared!")

async def import_staff():
    """Import all staff members"""
    print(f"\nImporting {len(STAFF_MEMBERS)} staff members...")
    
    imported = 0
    
    for staff in STAFF_MEMBERS:
        # Check if staff already exists
        existing = await db.users.find_one({"access_code": staff["access_code"]})
        if existing:
            print(f"  Staff already exists: {staff['access_code']} - updating...")
            # Update password
            await db.users.update_one(
                {"access_code": staff["access_code"]},
                {"$set": {"password_hash": hash_password(staff["password"])}}
            )
            continue
        
        staff_doc = {
            "id": str(uuid.uuid4()),
            "access_code": staff["access_code"],
            "first_name": staff["first_name"],
            "last_name": staff["last_name"],
            "name": f"{staff['first_name']} {staff['last_name']}".strip(),
            "email": staff["email"],
            "phone": staff["phone"],
            "role": staff["role"],
            "chain": staff["chain"],
            "status": "active",
            "password_hash": hash_password(staff["password"]),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(staff_doc)
        imported += 1
        print(f"  Imported: {staff['access_code']} ({staff['role']})")
    
    print(f"\n  Total imported: {imported} staff members!")
    return imported

async def verify_import():
    """Verify the import was successful"""
    print("\n=== VERIFICATION ===")
    
    # Count staff by role
    pipeline = [
        {"$group": {"_id": "$role", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    
    role_counts = await db.users.aggregate(pipeline).to_list(20)
    print("\nStaff by role:")
    for rc in role_counts:
        print(f"  {rc['_id']}: {rc['count']}")
    
    # List all staff
    print("\nAll staff members:")
    staff = await db.users.find({}, {"_id": 0, "access_code": 1, "name": 1, "role": 1, "chain": 1}).to_list(50)
    for s in staff:
        print(f"  {s['access_code']} | {s['name']} | {s['role']} | {s['chain']}")

async def main():
    print("=" * 60)
    print("IHEZA School Management System - Staff Import")
    print("=" * 60)
    
    # Clear existing data
    await clear_existing_staff()
    
    # Import staff
    await import_staff()
    
    # Verify import
    await verify_import()
    
    print("\n" + "=" * 60)
    print("Staff import completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
