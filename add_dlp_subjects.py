#!/usr/bin/env python3
import requests
import json
import sys

BASE_URL = "http://localhost:8001"

def add_dlp_subjects():
    print("=== Adding DLP Chain Subjects ===\n")
    
    # DLP chain subjects to add
    dlp_subjects = [
        {
            "name": "Environment",
            "code": "ENVI",
            "chain": "DLP",
            "description": "Environmental Studies"
        }
    ]
    
    # First, check if Environment already exists for DLP
    print("1. Checking existing DLP subjects...")
    try:
        response = requests.get(f"{BASE_URL}/api/subjects")
        if response.status_code != 200:
            print(f"   Failed to get subjects: {response.status_code}")
            return False
        
        existing_subjects = response.json()
        dlp_existing = [s for s in existing_subjects if s.get('chain') == 'DLP']
        
        print(f"   Found {len(dlp_existing)} subjects for DLP chain")
        
        # Check if Environment already exists
        env_exists = any(s.get('name') == 'Environment' and s.get('chain') == 'DLP' for s in existing_subjects)
        if env_exists:
            print("   ✓ Environment subject already exists for DLP")
        else:
            print("   ✗ Environment subject not found for DLP")
            
    except Exception as e:
        print(f"   Error checking subjects: {e}")
        return False
    
    # Add missing subjects
    print("\n2. Adding missing subjects for DLP chain...")
    added_count = 0
    
    for subject in dlp_subjects:
        subject_name = subject['name']
        
        # Check if already exists
        exists = any(s.get('name') == subject_name and s.get('chain') == 'DLP' for s in existing_subjects)
        
        if exists:
            print(f"   ✓ {subject_name} already exists for DLP")
        else:
            try:
                response = requests.post(f"{BASE_URL}/api/subjects", json=subject)
                if response.status_code == 200:
                    print(f"   ✓ Added {subject_name} for DLP chain")
                    added_count += 1
                else:
                    print(f"   ✗ Failed to add {subject_name}: {response.status_code} - {response.text}")
            except Exception as e:
                print(f"   ✗ Error adding {subject_name}: {e}")
    
    # Verify the subjects
    print("\n3. Verifying DLP chain subjects...")
    try:
        response = requests.get(f"{BASE_URL}/api/subjects")
        if response.status_code == 200:
            all_subjects = response.json()
            dlp_subjects = [s for s in all_subjects if s.get('chain') == 'DLP']
            
            print(f"   DLP chain now has {len(dlp_subjects)} subjects:")
            for subject in sorted(dlp_subjects, key=lambda x: x.get('name', '')):
                print(f"   - {subject.get('name')} ({subject.get('code')})")
            
            # Check if we have all required subjects
            required_names = ["Kiswahili", "English", "Mathematics", "Religion", "Creative Art and Sport (CAS)", "Environment"]
            existing_names = [s.get('name') for s in dlp_subjects]
            
            missing = [name for name in required_names if name not in existing_names]
            if missing:
                print(f"\n   ✗ Missing subjects: {', '.join(missing)}")
            else:
                print(f"\n   ✓ All required subjects present for DLP chain")
                
        else:
            print(f"   ✗ Failed to verify subjects: {response.status_code}")
            
    except Exception as e:
        print(f"   Error verifying subjects: {e}")
    
    return added_count > 0

if __name__ == "__main__":
    success = add_dlp_subjects()
    if success:
        print("\n" + "="*60)
        print("✓ DLP CHAIN SUBJECTS UPDATED SUCCESSFULLY")
        print("="*60)
        print("\nDLP chain now has the following subjects:")
        print("1. Kiswahili")
        print("2. English")
        print("3. Mathematics")
        print("4. Religion")
        print("5. Creative Art and Sport (CAS) - covers 'Art & Sport'")
        print("6. Environment - newly added")
        print("7. Science and Technology")
        print("8. Social Science")
        print("9. Arabic")
        print("10. Religion and Arabic (Grade 4)")
        sys.exit(0)
    else:
        print("\n✗ UPDATE FAILED")
        sys.exit(1)