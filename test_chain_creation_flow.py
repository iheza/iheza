#!/usr/bin/env python3
import requests
import json
import sys

BASE_URL = "http://localhost:8001"

def test_chain_creation_flow():
    print("=== Testing Chain Creation Flow ===\n")
    
    # Step 1: Login as DUP/PRINCIPAL/0002/2021
    print("1. Logging in as DUP/PRINCIPAL/0002/2021...")
    login_data = {
        "accessCode": "DUP/PRINCIPAL/0002/2021",
        "password": "test123456",
        "portal": "principal"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth", json=login_data)
        if response.status_code != 200:
            print(f"   Login failed: {response.status_code} - {response.text}")
            return False
        
        auth_data = response.json()
        if not auth_data.get("success"):
            print(f"   Login failed: {auth_data.get('error', 'Unknown error')}")
            return False
        
        session_token = auth_data.get("sessionToken")
        print(f"   Login successful! Session token: {session_token[:20]}...")
        
    except Exception as e:
        print(f"   Login error: {e}")
        return False
    
    # Step 2: Create a new chain
    print("\n2. Creating a new chain...")
    chain_data = {
        "name": "Test School Chain 2024",
        "code": "TEST2024",
        "type": "school",
        "location": "Test City, Test Country",
        "description": "A test school chain created via API",
        "principal_first_name": "Test",
        "principal_last_name": "Principal",
        "principal_email": "test.principal@testschool.edu",
        "principal_password": "test123456",
        "principal_access_code": "TEST2024/PRINCIPAL/0001/2024"
    }
    
    headers = {
        "Authorization": f"Bearer {session_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/users/generate-chain", 
                                json=chain_data, headers=headers)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   Success: {result.get('message')}")
            
            if result.get("principal_user"):
                principal = result["principal_user"]
                print(f"\n   Principal User Created:")
                print(f"     Access Code: {principal.get('access_code')}")
                print(f"     Password: {principal.get('password')}")
                print(f"     Email: {principal.get('email')}")
            
            return True
        else:
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"   Chain creation error: {e}")
        return False
    
    # Step 3: Verify chain was created
    print("\n3. Verifying chain was created...")
    try:
        response = requests.get(f"{BASE_URL}/api/chains", headers=headers)
        if response.status_code == 200:
            chains = response.json()
            test_chain = next((c for c in chains if c["code"] == "TEST2024"), None)
            if test_chain:
                print(f"   ✓ Chain TEST2024 found: {test_chain['name']}")
                return True
            else:
                print("   ✗ Chain TEST2024 not found in chains list")
                return False
        else:
            print(f"   Error fetching chains: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"   Verification error: {e}")
        return False

if __name__ == "__main__":
    success = test_chain_creation_flow()
    if success:
        print("\n=== Test PASSED ===")
        sys.exit(0)
    else:
        print("\n=== Test FAILED ===")
        sys.exit(1)