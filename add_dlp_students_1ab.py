#!/usr/bin/env python3
"""
Add DLP students for classes 1A and 1B
"""

import subprocess

# Student data from feedback
students_1ab = [
    ("AAFREEN MUHARAMI SULEIMAN", "F", "1B"),
    ("ABDULWAHID RIDHWAAN ISSA", "M", "1A"),
    ("AHMAD MOHAMMED JUMA", "M", "1B"),
    ("AHSEN ABDALLAH KHAMIS", "M", "1A"),
    ("AYSSOR AHMED KHAMIS", "F", "1B"),
    ("DAUD KASSIM DAUD", "M", "1B"),
    ("DHULHULAIFAT ABDILLAH JUMA", "F", "1B"),
    ("DHULKIFLI ABDILLAHI JUMA", "M", "1A"),
    ("FAHMI", "M", "1B"),
    ("FARHEEN HASSANI OMARI", "F", "1B"),
    ("FARHIYAH KOMBO HAJI", "F", "1B"),
    ("FARSHAD ALI OMAR", "M", "1A"),
    ("GABBY ABDALLAH MASOUD", "M", "1B"),
    ("HIKMAN HAJI SULEIMAN", "M", "1B"),
    ("IBRAHIM SAID AME", "M", "1A"),
    ("ILHAM NTILA MASOGO", "F", "1B"),
    ("IMRAN MBAROUK ALI", "M", "1B"),
    ("ISSA MOHAMMED KHALFAN", "M", "1A"),
    ("JAMILA KHAMIS HAMAD", "F", "1B"),
    ("JUNAYNA SHAIB", "F", "1A"),
    ("KABIR IDDI KASSIM", "M", "1B"),
    ("MANNA FAROUK MAULID", "F", "1A"),
    ("MAZROUK HASSAN MAZROUK", "M", "1A"),
    ("MOHAMMED ALLY HAJI", "M", "1A"),
    ("MUAMMAR ABDULATIF IBRAHIM", "M", "1A"),
    ("MUAYYID FADHIL MOHAMMED", "M", "1B"),
    ("MUKHLIS RAMADHAN IBADI", "M", "1A"),
    ("NABIL ALI KHALIFA", "M", "1B"),
    ("NARMEEN OTHMAN MKUBWA", "F", "1B"),
    ("NURAYYA KHAMIS JUMA", "F", "1A"),
    ("OMAR NDANYUNGU OMAR", "M", "1B"),
    ("RAHIL ADAM", "M", "1A"),
    ("RANIA HILAL AMOUR", "F", "1A"),
    ("SABRA SALUM FAKI", "F", "1A"),
    ("SAHIR HASSAN BUDDAH", "M", "1A"),
    ("SAID KASSIM SAID", "M", "1A"),
    ("SARA SAID ALI", "M", "1A"),
    ("TAREEQ MOHAMMED MSHANA", "M", "1B"),
    ("ZAYD NASSOR KHAMIS", "M", "1A"),
]

def generate_admission_no(index, year="2025"):
    """Generate admission number for DLP students"""
    # Using a pattern: DLP/STU0XXX/2025 where XXX is 400 + index
    num = 400 + index
    return f"DLP/STU0{num}/2025"

def create_mongosh_script():
    """Create mongosh script to insert students"""
    script_lines = [
        'db = db.getSiblingDB("iheza_db");',
        'print("Adding DLP students for classes 1A and 1B...");',
        '',
        'var added = 0;',
        'var skipped = 0;',
        'var now = new Date().toISOString();',
        'var admissionDate = now.split("T")[0];',
        ''
    ]
    
    for i, (name, gender_code, class_name) in enumerate(students_1ab):
        # Convert gender code to full text
        gender = "MALE" if gender_code == "M" else "FEMALE"
        
        # Generate admission number
        admission_no = generate_admission_no(i)
        
        # Split name
        name_parts = name.split()
        first_name = name_parts[0] if name_parts else ""
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else first_name
        
        # Check if exists (by name and class to avoid duplicates)
        script_lines.append(f'// Adding: {name}')
        script_lines.append(f'var existing = db.students.findOne({{name: "{name}", class_name: "{class_name}", chain: "DLP"}});')
        script_lines.append(f'if (existing) {{')
        script_lines.append(f'  print("  Skipping: {name} - Already exists in {class_name}");')
        script_lines.append(f'  skipped++;')
        script_lines.append(f'}} else {{')
        
        # Create document
        doc = {
            "id": admission_no,
            "admission_no": admission_no,
            "first_name": first_name,
            "last_name": last_name,
            "name": name,
            "class_name": class_name,
            "date_of_birth": "2018-01-01",  # Approx DOB for grade 1
            "gender": gender,
            "chain": "DLP",
            "parent_name": "Parent",
            "parent_contact": "255000000000",
            "parent_email": f"parent.{admission_no.toLowerCase().replace('/', '.')}@example.com",
            "address": "Zanzibar, Tanzania",
            "status": "active",
            "role": "student",
            "password_hash": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
            "created_at": now,
            "updated_at": now,
            "admission_date": admissionDate,
            "parent_phone": "255000000000"
        }
        
        # Convert to JavaScript object
        doc_str = str(doc).replace("'", '"')
        script_lines.append(f'  var doc = {doc_str};')
        script_lines.append(f'  db.students.insertOne(doc);')
        script_lines.append(f'  print("  Added: {admission_no} - {name} ({gender}) -> {class_name}");')
        script_lines.append(f'  added++;')
        script_lines.append(f'}}')
        script_lines.append('')
    
    script_lines.append('print("\\n=== SUMMARY ===");')
    script_lines.append('print("Added: " + added + " new students");')
    script_lines.append('print("Skipped: " + skipped + " existing students");')
    script_lines.append('print("Total DLP students: " + db.students.countDocuments({chain: "DLP"}));')
    script_lines.append('print("\\nClass distribution for 1A/1B:");')
    script_lines.append('var classCounts = db.students.aggregate([')
    script_lines.append('  {$match: {chain: "DLP", class_name: {$in: ["1A", "1B"]}}},')
    script_lines.append('  {$group: {_id: "$class_name", count: {$sum: 1}}}')
    script_lines.append(']).toArray();')
    script_lines.append('classCounts.forEach(function(c) {')
    script_lines.append('  print("  " + c._id + ": " + c.count + " students");')
    script_lines.append('});')
    
    return '\n'.join(script_lines)

def main():
    print("IHEZA School Management System - Add DLP Students (1A/1B)")
    print("=" * 60)
    
    # Create the mongosh script
    script = create_mongosh_script()
    
    # Write to temporary file
    with open('/tmp/add_dlp_1ab.js', 'w') as f:
        f.write(script)
    
    # Execute mongosh
    print("Executing mongosh script...")
    result = subprocess.run(['mongosh', '--quiet', '/tmp/add_dlp_1ab.js'], 
                          capture_output=True, text=True)
    
    print(result.stdout)
    if result.stderr:
        print("Errors:", result.stderr)
    
    print("\n" + "=" * 60)
    print("TASK COMPLETED")
    print("=" * 60)
    print(f"Processed {len(students_1ab)} students for classes 1A and 1B")
    print("These students are now available in DLP user portals.")
    
    # Final verification
    verify_cmd = '''
    db = db.getSiblingDB('iheza_db');
    print("\\n=== FINAL VERIFICATION ===");
    print("Total DLP students: " + db.students.countDocuments({chain: 'DLP'}));
    print("\\nStudents by class (1A/1B):");
    var counts = db.students.aggregate([
      {$match: {chain: 'DLP', class_name: {$in: ['1A', '1B']}}},
      {$group: {_id: '$class_name', count: {$sum: 1}}},
      {$sort: {_id: 1}}
    ]).toArray();
    counts.forEach(function(c) {
      print("  " + c._id + ": " + c.count + " students");
    });
    print("\\nSample 1A/1B students:");
    db.students.find({chain: 'DLP', class_name: {$in: ['1A', '1B']}}, {admission_no: 1, name: 1, class_name: 1, gender: 1, _id: 0}).limit(5).forEach(printjson);
    '''
    
    print("\nVerifying database...")
    result = subprocess.run(['mongosh', '--quiet', '--eval', verify_cmd], 
                          capture_output=True, text=True)
    print(result.stdout)

if __name__ == "__main__":
    main()