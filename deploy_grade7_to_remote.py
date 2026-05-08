#!/usr/bin/env python3
"""
Deploy DUP Grade 7 data to the remote live server via API.
Strategy:
1. Login as DLP Principal (already exists)
2. Create a DUP teacher user (principal can register teacher)
3. Login as DUP teacher
4. Create GRADE 7 class under DUP chain
5. Bulk upload the 11 Grade 7 students
"""
import requests
import json
import sys

BASE_URL = "https://build-app-now-34.preview.emergentagent.com/api"

# ============ STEP 1: Login as DLP Principal ============
print("=" * 60)
print("STEP 1: Login as DLP Principal")
print("=" * 60)

dlp_login = requests.post(f"{BASE_URL}/auth", json={
    "accessCode": "DLP/PRINCIPAL/0001/2024",
    "password": "DLP00000",
    "portal": "principal"
})

if dlp_login.status_code != 200:
    print(f"✗ DLP Principal login failed: {dlp_login.text}")
    sys.exit(1)

dlp_token = dlp_login.json()["sessionToken"]
print(f"✓ DLP Principal logged in successfully")

# ============ STEP 2: Create DUP Teacher ============
print("\n" + "=" * 60)
print("STEP 2: Create DUP Teacher user")
print("=" * 60)

dup_teacher = {
    "access_code": "DUP/TEACHER/0001/2024",
    "first_name": "DUP",
    "last_name": "Teacher",
    "role": "teacher",
    "password": "DUP00000",
    "status": "active"
}

create_teacher = requests.post(f"{BASE_URL}/users", 
    headers={"Authorization": f"Bearer {dlp_token}"},
    json=dup_teacher
)

if create_teacher.status_code == 200:
    print(f"✓ DUP Teacher created successfully")
elif create_teacher.status_code == 400 and "already exists" in create_teacher.text:
    print(f"→ DUP Teacher already exists (that's fine)")
else:
    print(f"✗ Failed to create DUP Teacher: {create_teacher.text}")
    sys.exit(1)

# ============ STEP 3: Login as DUP Teacher ============
print("\n" + "=" * 60)
print("STEP 3: Login as DUP Teacher")
print("=" * 60)

dup_login = requests.post(f"{BASE_URL}/auth", json={
    "accessCode": "DUP/TEACHER/0001/2024",
    "password": "DUP00000",
    "portal": "teacher"
})

if dup_login.status_code != 200:
    print(f"✗ DUP Teacher login failed: {dup_login.text}")
    sys.exit(1)

dup_token = dup_login.json()["sessionToken"]
print(f"✓ DUP Teacher logged in successfully")

# ============ STEP 4: Create GRADE 7 Class ============
print("\n" + "=" * 60)
print("STEP 4: Create GRADE 7 Class under DUP chain")
print("=" * 60)

grade7_class = {
    "name": "GRADE 7",
    "level": "primary",
    "chain": "DUP",
    "capacity": 30
}

create_class = requests.post(f"{BASE_URL}/classes",
    headers={"Authorization": f"Bearer {dup_token}"},
    json=grade7_class
)

if create_class.status_code == 200:
    class_data = create_class.json()
    class_id = class_data["id"]
    print(f"✓ GRADE 7 class created (id: {class_id})")
elif create_class.status_code == 400 and "already exists" in create_class.text:
    print(f"→ GRADE 7 class already exists")
    # Get existing class ID
    classes_resp = requests.get(f"{BASE_URL}/classes",
        headers={"Authorization": f"Bearer {dup_token}"})
    if classes_resp.status_code == 200:
        for c in classes_resp.json():
            if c["name"] == "GRADE 7" and c["chain"] == "DUP":
                class_id = c["id"]
                print(f"  Found existing class id: {class_id}")
                break
else:
    print(f"✗ Failed to create class: {create_class.text}")
    sys.exit(1)

# ============ STEP 5: Bulk Upload Grade 7 Students ============
print("\n" + "=" * 60)
print("STEP 5: Bulk Upload Grade 7 Students")
print("=" * 60)

grade7_students = [
    {
        "admission_no": "DUP/STU0002/2024",
        "first_name": "ABUBAKAR",
        "last_name": "SLIM",
        "gender": "MALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "SLIM",
        "parent_phone": "773441040",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0003/2019",
        "first_name": "AMMAR",
        "last_name": "AMEIR",
        "gender": "MALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "CHANDE",
        "parent_phone": "776410998",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0004/2024",
        "first_name": "ASMAA",
        "last_name": "HABIB",
        "gender": "FEMALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "AMEIR",
        "parent_phone": "77903323",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0005/2023",
        "first_name": "IDAROUS",
        "last_name": "YUSSUF",
        "gender": "MALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "HABIB",
        "parent_phone": "656444373",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0006/2020",
        "first_name": "ISMAIL",
        "last_name": "ABDALLA",
        "gender": "MALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "YUSSUF",
        "parent_phone": "77525132",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0007/2022",
        "first_name": "MALHA",
        "last_name": "HAFIDHI",
        "gender": "FEMALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "ABDALLA",
        "parent_phone": "712346777",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0008/2020",
        "first_name": "MAWADDAH",
        "last_name": "OSMAN",
        "gender": "FEMALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "HAFIDHI",
        "parent_phone": "777456202",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0009/2020",
        "first_name": "NURFAT",
        "last_name": "SAID",
        "gender": "FEMALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "OSMAN",
        "parent_phone": "773803231",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0011/2025",
        "first_name": "SAIMINA",
        "last_name": "TAHIR",
        "gender": "FEMALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "ALI KHAMIS",
        "parent_phone": "625879800",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0012/2022",
        "first_name": "SUHEIL",
        "last_name": "KHAMIS",
        "gender": "MALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "TAHIR",
        "parent_phone": "773908844",
        "password": "DUP00000"
    },
    {
        "admission_no": "DUP/STU0013/2019",
        "first_name": "WALID",
        "last_name": "ALI",
        "gender": "MALE",
        "class_name": "GRADE 7",
        "class_id": class_id,
        "chain": "DUP",
        "parent_name": "KHAMIS",
        "parent_phone": "773515052",
        "password": "DUP00000"
    }
]

bulk_upload = requests.post(f"{BASE_URL}/students/bulk-upload",
    headers={"Authorization": f"Bearer {dup_token}"},
    json=grade7_students
)

if bulk_upload.status_code == 200:
    result = bulk_upload.json()
    print(f"✓ Bulk upload completed:")
    print(f"  Total: {result['total']}")
    print(f"  Imported: {result['imported']}")
    print(f"  Failed: {result['failed']}")
    if result['errors']:
        print(f"  Errors:")
        for err in result['errors']:
            print(f"    - {err.get('error', 'unknown')}")
    if result['success']:
        print(f"  Successfully imported students:")
        for s in result['success']:
            print(f"    - {s['first_name']} {s['last_name']} ({s['admission_no']})")
else:
    print(f"✗ Bulk upload failed: {bulk_upload.text}")
    sys.exit(1)

# ============ VERIFICATION ============
print("\n" + "=" * 60)
print("VERIFICATION")
print("=" * 60)

# Check classes
classes_resp = requests.get(f"{BASE_URL}/classes",
    headers={"Authorization": f"Bearer {dup_token}"})
if classes_resp.status_code == 200:
    print("\nClasses on remote server:")
    for c in classes_resp.json():
        print(f"  - {c['name']} (chain: {c['chain']})")

# Check students
students_resp = requests.get(f"{BASE_URL}/students",
    headers={"Authorization": f"Bearer {dup_token}"})
if students_resp.status_code == 200:
    students = students_resp.json()
    dup_students = [s for s in students if s.get('chain') == 'DUP']
    g7_students = [s for s in dup_students if s.get('class_name') == 'GRADE 7']
    print(f"\nDUP students on remote server: {len(dup_students)}")
    print(f"Grade 7 DUP students: {len(g7_students)}")
    for s in g7_students:
        print(f"  - {s['first_name']} {s['last_name']} ({s['admission_no']})")

print("\n" + "=" * 60)
print("DEPLOYMENT COMPLETE!")
print("=" * 60)
print("\nGrade 7 students are now available on the remote live server.")
print("DUP Teacher credentials: DUP/TEACHER/0001/2024 / DUP00000")
