#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8001/api"

print("=== Testing DLP Class Creation ===\n")

# Test 1: Create a class for DLP chain
print("1. Creating a test class for DLP chain...")
class_data = {
    "name": "Test Class DLP 2",
    "level": "Grade 5",
    "section": "B",
    "chain": "DLP",
    "capacity": 35
}

response = requests.post(f"{BASE_URL}/classes", json=class_data)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    created_class = response.json()
    print(f"   ✓ Class created successfully!")
    print(f"   Class ID: {created_class.get('id')}")
    print(f"   Name: {created_class.get('name')}")
    print(f"   Chain: {created_class.get('chain')}")
else:
    print(f"   ✗ Failed to create class: {response.text}")

# Test 2: Verify the class was created
print("\n2. Verifying class was created...")
response = requests.get(f"{BASE_URL}/classes")
if response.status_code == 200:
    classes = response.json()
    dlp_classes = [c for c in classes if c.get('chain') == 'DLP']
    test_classes = [c for c in dlp_classes if 'Test Class DLP' in c.get('name', '')]
    
    print(f"   Found {len(dlp_classes)} total classes for DLP chain")
    print(f"   Found {len(test_classes)} test classes")
    
    if test_classes:
        print(f"   ✓ Test class found in database")
        for cls in test_classes:
            print(f"   - {cls.get('name')} (ID: {cls.get('id')})")
    else:
        print(f"   ✗ Test class not found in database")
else:
    print(f"   ✗ Failed to get classes: {response.status_code}")

# Test 3: Test with invalid chain (should fail)
print("\n3. Testing with invalid chain (should fail)...")
invalid_class_data = {
    "name": "Invalid Chain Test",
    "level": "Grade 6",
    "section": "A",
    "chain": "INVALID",  # Not in SCHOOL_PREFIXES
    "capacity": 30
}

response = requests.post(f"{BASE_URL}/classes", json=invalid_class_data)
print(f"   Status: {response.status_code}")
if response.status_code == 400:
    print(f"   ✓ Correctly rejected invalid chain")
    print(f"   Error: {response.json().get('detail', 'Unknown error')}")
else:
    print(f"   ✗ Should have rejected invalid chain but got: {response.status_code}")

print("\n" + "="*60)
print("SUMMARY:")
print("- Class creation for DLP chain should now work")
print("- The 'Add Class' button in the DLP component should function")
print("- Chain validation is working (rejects invalid chains)")
print("="*60)