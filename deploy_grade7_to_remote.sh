#!/bin/bash
# Deploy DUP Grade 7 data to remote live server via API
set -e

BASE_URL="https://build-app-now-34.preview.emergentagent.com/api"

echo "============================================================"
echo "STEP 1: Login as DLP Principal"
echo "============================================================"

DLP_RESP=$(curl -s "$BASE_URL/auth" \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"DLP/PRINCIPAL/0001/2024","password":"DLP00000","portal":"principal"}')

DLP_TOKEN=$(echo "$DLP_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['sessionToken'])" 2>/dev/null)
if [ -z "$DLP_TOKEN" ]; then
  echo "✗ DLP Principal login failed: $DLP_RESP"
  exit 1
fi
echo "✓ DLP Principal logged in successfully"

echo ""
echo "============================================================"
echo "STEP 2: Create DUP Teacher user"
echo "============================================================"

CREATE_TEACHER=$(curl -s "$BASE_URL/users" \
  -H "Authorization: Bearer $DLP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "access_code": "DUP/TEACHER/0001/2024",
    "first_name": "DUP",
    "last_name": "Teacher",
    "role": "teacher",
    "password": "DUP00000",
    "status": "active"
  }')

if echo "$CREATE_TEACHER" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('id') else 1)" 2>/dev/null; then
  echo "✓ DUP Teacher created successfully"
elif echo "$CREATE_TEACHER" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if 'already exists' in d.get('detail','') else 1)" 2>/dev/null; then
  echo "→ DUP Teacher already exists (that's fine)"
else
  echo "✗ Failed to create DUP Teacher: $CREATE_TEACHER"
  exit 1
fi

echo ""
echo "============================================================"
echo "STEP 3: Login as DUP Teacher"
echo "============================================================"

DUP_RESP=$(curl -s "$BASE_URL/auth" \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"DUP/TEACHER/0001/2024","password":"DUP00000","portal":"teacher"}')

DUP_TOKEN=$(echo "$DUP_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['sessionToken'])" 2>/dev/null)
if [ -z "$DUP_TOKEN" ]; then
  echo "✗ DUP Teacher login failed: $DUP_RESP"
  exit 1
fi
echo "✓ DUP Teacher logged in successfully"

echo ""
echo "============================================================"
echo "STEP 4: Create GRADE 7 Class under DUP chain"
echo "============================================================"

CREATE_CLASS=$(curl -s "$BASE_URL/classes" \
  -H "Authorization: Bearer $DUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GRADE 7",
    "level": "primary",
    "chain": "DUP",
    "capacity": 30
  }')

CLASS_ID=$(echo "$CREATE_CLASS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
if [ -n "$CLASS_ID" ]; then
  echo "✓ GRADE 7 class created (id: $CLASS_ID)"
else
  # Check if it already exists
  CLASSES=$(curl -s "$BASE_URL/classes" \
    -H "Authorization: Bearer $DUP_TOKEN")
  CLASS_ID=$(echo "$CLASSES" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for c in data:
    if c.get('name') == 'GRADE 7' and c.get('chain') == 'DUP':
        print(c.get('id',''))
        break
" 2>/dev/null)
  if [ -n "$CLASS_ID" ]; then
    echo "→ GRADE 7 class already exists (id: $CLASS_ID)"
  else
    echo "✗ Failed to create class: $CREATE_CLASS"
    exit 1
  fi
fi

echo ""
echo "============================================================"
echo "STEP 5: Bulk Upload Grade 7 Students"
echo "============================================================"

BULK_PAYLOAD=$(python3 -c "
import json
class_id = '$CLASS_ID'
students = [
    {'admission_no': 'DUP/STU0002/2024', 'first_name': 'ABUBAKAR', 'last_name': 'SLIM', 'gender': 'MALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'SLIM', 'parent_phone': '773441040', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0003/2019', 'first_name': 'AMMAR', 'last_name': 'AMEIR', 'gender': 'MALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'CHANDE', 'parent_phone': '776410998', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0004/2024', 'first_name': 'ASMAA', 'last_name': 'HABIB', 'gender': 'FEMALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'AMEIR', 'parent_phone': '77903323', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0005/2023', 'first_name': 'IDAROUS', 'last_name': 'YUSSUF', 'gender': 'MALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'HABIB', 'parent_phone': '656444373', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0006/2020', 'first_name': 'ISMAIL', 'last_name': 'ABDALLA', 'gender': 'MALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'YUSSUF', 'parent_phone': '77525132', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0007/2022', 'first_name': 'MALHA', 'last_name': 'HAFIDHI', 'gender': 'FEMALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'ABDALLA', 'parent_phone': '712346777', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0008/2020', 'first_name': 'MAWADDAH', 'last_name': 'OSMAN', 'gender': 'FEMALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'HAFIDHI', 'parent_phone': '777456202', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0009/2020', 'first_name': 'NURFAT', 'last_name': 'SAID', 'gender': 'FEMALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'OSMAN', 'parent_phone': '773803231', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0011/2025', 'first_name': 'SAIMINA', 'last_name': 'TAHIR', 'gender': 'FEMALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'ALI KHAMIS', 'parent_phone': '625879800', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0012/2022', 'first_name': 'SUHEIL', 'last_name': 'KHAMIS', 'gender': 'MALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'TAHIR', 'parent_phone': '773908844', 'password': 'DUP00000'},
    {'admission_no': 'DUP/STU0013/2019', 'first_name': 'WALID', 'last_name': 'ALI', 'gender': 'MALE', 'class_name': 'GRADE 7', 'class_id': class_id, 'chain': 'DUP', 'parent_name': 'KHAMIS', 'parent_phone': '773515052', 'password': 'DUP00000'}
]
print(json.dumps(students))
")

BULK_UPLOAD=$(curl -s "$BASE_URL/students/bulk-upload" \
  -H "Authorization: Bearer $DUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BULK_PAYLOAD")

echo "$BULK_UPLOAD" | python3 -c "
import json,sys
result = json.load(sys.stdin)
print(f\"Total: {result.get('total', 0)}\")
print(f\"Imported: {result.get('imported', 0)}\")
print(f\"Failed: {result.get('failed', 0)}\")
if result.get('errors'):
    print('Errors:')
    for err in result['errors']:
        print(f\"  - {err.get('error', 'unknown')}\")
if result.get('success'):
    print('Successfully imported:')
    for s in result['success']:
        print(f\"  - {s['first_name']} {s['last_name']} ({s['admission_no']})\")
"

echo ""
echo "============================================================"
echo "VERIFICATION"
echo "============================================================"

echo ""
echo "Classes on remote server:"
curl -s "$BASE_URL/classes" \
  -H "Authorization: Bearer $DUP_TOKEN" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for c in data:
    print(f\"  - {c['name']} (chain: {c['chain']})\")
"

echo ""
echo "DUP Students on remote server:"
curl -s "$BASE_URL/students" \
  -H "Authorization: Bearer $DUP_TOKEN" | python3 -c "
import json,sys
students = json.load(sys.stdin)
dup_students = [s for s in students if s.get('chain') == 'DUP']
g7_students = [s for s in dup_students if s.get('class_name') == 'GRADE 7']
print(f'Total DUP students: {len(dup_students)}')
print(f'Grade 7 DUP students: {len(g7_students)}')
for s in g7_students:
    print(f\"  - {s['first_name']} {s['last_name']} ({s['admission_no']})\")
"

echo ""
echo "============================================================"
echo "DEPLOYMENT COMPLETE!"
echo "============================================================"
echo ""
echo "Grade 7 students are now available on the remote live server."
echo "DUP Teacher credentials: DUP/TEACHER/0001/2024 / DUP00000"
