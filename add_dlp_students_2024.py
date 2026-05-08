#!/usr/bin/env python3
"""
Add additional DLP students from 2024 with classes 3A and 3B
"""

import asyncio
import os
from datetime import datetime
from pathlib import Path
import bcrypt

ROOT_DIR = Path(__file__).parent

# Student data from the feedback
students_2024 = [
    ("DLP/STU0306/2024", "ABDUL-AZIZ KHAMIS HUSSEIN", "MALE", "3B"),
    ("DLP/STU0296/2024", "ABDULKARIM OMAR AMOUR", "MALE", "3B"),
    ("DLP/STU0317/2024", "AHMAD ABDALLA AHMED", "MALE", "3A"),
    ("DLP/STU0439/2024", "ALEENA ABDALLAH KHAMIS", "FEMALE", "3A"),
    ("DLP/STU0298/2024", "AMINA AHMADA YAKOUT", "FEMALE", "3A"),
    ("DLP/STU0316/2024", "ARSHAN BAKARI KASSIM", "MALE", "3A"),
    ("DLP/STU0288/2024", "ASHFAT OMAR SAID", "FEMALE", "3A"),
    ("DLP/STU0440/2024", "ASHMAL ABDALLAH KHAMIS", "FEMALE", "3B"),
    ("DLP/STU0289/2024", "ASHRAF OMAR SAID", "MALE", "3B"),
    ("DLP/STU0300/2024", "ASRAA HAMAD HABIBU", "FEMALE", "3B"),
    ("DLP/STU0301/2024", "AYMAN SALUM MUSSA", "FEMALE", "3B"),
    ("DLP/STU0310/2024", "BILQISS NASSIR ABDULRAZAK", "FEMALE", "3A"),
    ("DLP/STU0286/2024", "BUTHAYNA FADHIL SALEH", "FEMALE", "3A"),
    ("DLP/STU0308/2024", "ISRIYYA HAJI SALUM", "FEMALE", "3A"),
    ("DLP/STU0283/2024", "KAMAAL HAJI KASSIM", "MALE", "3A"),
    ("DLP/STU0309/2024", "KAUTHAR KHALFAN MMAKA", "FEMALE", "3A"),
    ("DLP/STU0318/2024", "KHALIL ABDALLAH MATTAR", "MALE", "3B"),
    ("DLP/STU0315/2024", "KHAMIS NASSOR KHAMIS", "MALE", "3A"),
    ("DLP/STU0305/2024", "MAHIR JUMA FOUM", "MALE", "3B"),
    ("DLP/STU0443/2024", "MALIHA SALEH HASSAN", "FEMALE", "3A"),
    ("DLP/STU0284/2024", "MU'AMMAR HAFIDH KHAMIS", "MALE", "3B"),
    ("DLP/STU0303/2024", "MUAYYAD MOHAMMED KAMAL", "MALE", "3B"),
    ("DLP/STU0311/2024", "MURAT ABDULRAHMAN KHALFAN", "MALE", "3A"),
    ("DLP/STU0294/2024", "NASREEN OTHMAN MKUBWA", "FEMALE", "3A"),
    ("DLP/STU0281/2024", "NAWAL-NOUR SAID OMAR", "FEMALE", "3A"),
    ("DLP/STU0302/2024", "OTHMAN ABDALLULLA OTHMAN", "MALE", "3B"),
    ("DLP/STU0299/2024", "RAGHDAA MOHAMMED SEIF", "FEMALE", "3B"),
    ("DLP/STU0441/2024", "RAHIL RASHID HAMAD", "MALE", "3B"),
    ("DLP/STU0444/2024", "RAUHIYA ALLY ATHUMANI", "FEMALE", "3B"),
    ("DLP/STU0297/2024", "SADIDAH MOHAMMED MAHMOUD", "FEMALE", "3A"),
    ("DLP/STU0285/2024", "SANAYA IBRAHIM NASSOR", "FEMALE", "3A"),
    ("DLP/STU0295/2024", "SHADYA SALEH DOTO", "FEMALE", "3A"),
    ("DLP/STU0304/2024", "SHEMSA ALI JUMA", "FEMALE", "3B"),
    ("DLP/STU0314/2024", "SULEIMAN AHMED SULEIMAN", "MALE", "3B"),
    ("DLP/STU0293/2024", "TAHMID HAMZA YAHYA", "MALE", "3B"),
    ("DLP/STU0313/2024", "YUNUS UTHMAN YUNUS", "MALE", "3A"),
]

def create_student_document(admission_no, name, gender, class_name):
    """Create a student document for MongoDB"""
    # Split name into first and last
    name_parts = name.split()
    first_name = name_parts[0] if name_parts else ""
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    
    # Generate password hash
    password = "student123"
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Current timestamp
    now = datetime.utcnow().isoformat() + "Z"
    
    return {
        "id": admission_no,
        "admission_no": admission_no,
        "first_name": first_name,
        "last_name": last_name,
        "name": name,
        "class_name": class_name,
        "date_of_birth": "2000-01-01",  # Default DOB
        "gender": gender.upper(),
        "chain": "DLP",
        "parent_name": "Parent",
        "parent_contact": "255000000000",
        "parent_email": f"parent.{admission_no.lower().replace('/', '.')}@example.com",
        "address": "Zanzibar, Tanzania",
        "status": "active",
        "role": "student",
        "password_hash": password_hash,
        "created_at": now,
        "updated_at": now,
        "admission_date": now.split("T")[0],  # Date part only
        "parent_phone": "255000000000",  # For API compatibility
    }

async def add_students_2024():
    """Add 2024 DLP students to MongoDB"""
    print("=" * 60)
    print("Adding DLP Students (2024) to Database")
    print("=" * 60)
    
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        
        load_dotenv(ROOT_DIR / 'backend' / '.env')
        
        # MongoDB connection
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'iheza_db')]
        
        added_count = 0
        skipped_count = 0
        
        for admission_no, name, gender, class_name in students_2024:
            # Check if student already exists
            existing = await db.students.find_one({"admission_no": admission_no})
            
            if existing:
                print(f"  Skipping: {admission_no} - Already exists")
                skipped_count += 1
                continue
            
            # Create student document
            student_doc = create_student_document(admission_no, name, gender, class_name)
            
            # Insert into database
            await db.students.insert_one(student_doc)
            print(f"  Added: {admission_no} - {name} ({gender}) -> {class_name}")
            added_count += 1
        
        print(f"\nAdded {added_count} new students")
        print(f"Skipped {skipped_count} existing students")
        
        # Verify total count
        total_dlp = await db.students.count_documents({"chain": "DLP"})
        print(f"\nTotal DLP students in database: {total_dlp}")
        
        return added_count
        
    except ImportError:
        print("Error: motor module not installed. Using mongosh instead.")
        return add_students_via_mongosh()

def add_students_via_mongosh():
    """Add students using mongosh command line"""
    print("Using mongosh to add students...")
    
    # Create JavaScript commands
    js_commands = []
    for admission_no, name, gender, class_name in students_2024:
        # Split name into first and last
        name_parts = name.split()
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else name_parts[0] if name_parts else ""
        
        # Create document
        doc = {
            "id": admission_no,
            "admission_no": admission_no,
            "first_name": first_name,
            "last_name": last_name,
            "name": name,
            "class_name": class_name,
            "date_of_birth": "2000-01-01",
            "gender": gender.upper(),
            "chain": "DLP",
            "parent_name": "Parent",
            "parent_contact": "255000000000",
            "parent_email": f"parent.{admission_no.toLowerCase().replace('/', '.')}@example.com",
            "address": "Zanzibar, Tanzania",
            "status": "active",
            "role": "student",
            "password_hash": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # bcrypt hash of "student123"
            "created_at": new Date().toISOString(),
            "updated_at": new Date().toISOString(),
            "admission_date": new Date().toISOString().split('T')[0],
            "parent_phone": "255000000000"
        }
        
        js_commands.append(f'db.students.updateOne({{admission_no: "{admission_no}"}}, {{$setOnInsert: {doc}}}, {{upsert: true}});')
    
    # Execute mongosh command
    mongo_script = '''
    db = db.getSiblingDB('iheza_db');
    var added = 0;
    var skipped = 0;
    ''' + '\n'.join(js_commands) + '''
    print("\\nAdded " + added + " new students");
    print("Skipped " + skipped + " existing students");
    print("Total DLP students: " + db.students.countDocuments({chain: 'DLP'}));
    '''
    
    import subprocess
    result = subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], 
                          capture_output=True, text=True)
    print(result.stdout)
    
    if result.stderr:
        print("Errors:", result.stderr)
    
    # Parse result to get added count
    lines = result.stdout.split('\n')
    for line in lines:
        if "Added" in line and "new students" in line:
            try:
                return int(line.split()[1])
            except:
                pass
    
    return len(students_2024)

def main():
    print("IHEZA School Management System - Add DLP Students (2024)")
    print("=" * 60)
    
    try:
        added = add_students_via_mongosh()
        
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"Processed {len(students_2024)} students from 2024")
        print(f"Classes: 3A and 3B")
        print(f"Chain: DLP")
        print("\nThese students are now available in DLP user portals.")
        
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())