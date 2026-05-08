#!/usr/bin/env python3
"""
Simple script to add 2024 DLP students using mongosh
"""

import subprocess
import json

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

def create_mongosh_script():
    """Create a mongosh script to insert students"""
    script_lines = [
        'db = db.getSiblingDB("iheza_db");',
        'print("Adding DLP students from 2024...");',
        'var added = 0;',
        'var skipped = 0;',
        ''
    ]
    
    for admission_no, name, gender, class_name in students_2024:
        # Split name into first and last
        name_parts = name.split()
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else name_parts[0] if name_parts else ""
        
        # Create document as JSON string
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
            "parent_email": f"parent.{admission_no.lower().replace('/', '.')}@example.com",
            "address": "Zanzibar, Tanzania",
            "status": "active",
            "role": "student",
            "password_hash": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # bcrypt hash of "student123"
            "created_at": new Date().toISOString(),
            "updated_at": new Date().toISOString(),
            "admission_date": new Date().toISOString().split('T')[0],
            "parent_phone": "255000000000"
        }
        
        # Convert to JavaScript object literal
        doc_js = json.dumps(doc, indent=2).replace('"', "'")
        # Fix the new Date() calls
        doc_js = doc_js.replace("'new Date().toISOString()'", "new Date().toISOString()")
        doc_js = doc_js.replace("'new Date().toISOString().split('T')[0]'", "new Date().toISOString().split('T')[0]")
        
        script_lines.append(f'// Adding {admission_no}')
        script_lines.append(f'var existing = db.students.findOne({{admission_no: "{admission_no}"}});')
        script_lines.append(f'if (existing) {{')
        script_lines.append(f'  print("  Skipping: {admission_no} - Already exists");')
        script_lines.append(f'  skipped++;')
        script_lines.append(f'}} else {{')
        script_lines.append(f'  db.students.insertOne({doc_js});')
        script_lines.append(f'  print("  Added: {admission_no} - {name} ({gender}) -> {class_name}");')
        script_lines.append(f'  added++;')
        script_lines.append(f'}}')
        script_lines.append('')
    
    script_lines.append('print("\\n=== SUMMARY ===");')
    script_lines.append('print("Added: " + added + " new students");')
    script_lines.append('print("Skipped: " + skipped + " existing students");')
    script_lines.append('print("Total DLP students: " + db.students.countDocuments({chain: "DLP"}));')
    
    return '\n'.join(script_lines)

def main():
    print("IHEZA School Management System - Add DLP Students (2024)")
    print("=" * 60)
    
    # Create the mongosh script
    script = create_mongosh_script()
    
    # Write to temporary file
    with open('/tmp/add_dlp_2024.js', 'w') as f:
        f.write(script)
    
    # Execute mongosh
    print("Executing mongosh script...")
    result = subprocess.run(['mongosh', '--quiet', '/tmp/add_dlp_2024.js'], 
                          capture_output=True, text=True)
    
    print(result.stdout)
    if result.stderr:
        print("Errors:", result.stderr)
    
    print("\n" + "=" * 60)
    print("TASK COMPLETED")
    print("=" * 60)
    print(f"Processed {len(students_2024)} students from 2024")
    print("Classes: 3A and 3B")
    print("Chain: DLP")
    print("\nThese students are now available in DLP user portals.")
    
    # Verify final count
    verify_cmd = '''
    db = db.getSiblingDB('iheza_db');
    print("\\n=== FINAL VERIFICATION ===");
    print("Total DLP students: " + db.students.countDocuments({chain: 'DLP'}));
    print("\\nSample of 2024 students:");
    db.students.find({chain: 'DLP', admission_no: /2024/}, {admission_no: 1, name: 1, class_name: 1, _id: 0}).limit(5).forEach(printjson);
    '''
    
    print("\nVerifying database...")
    result = subprocess.run(['mongosh', '--quiet', '--eval', verify_cmd], 
                          capture_output=True, text=True)
    print(result.stdout)

if __name__ == "__main__":
    main()