#!/usr/bin/env python3
import requests
import json

# Test chain creation with custom principal details
BASE_URL = "http://localhost:8001"

# First, let's try to create a chain without authentication to see the error
chain_data = {
    "name": "Test School Chain",
    "code": "TEST",
    "type": "primary",
    "location": "Test City",
    "principal_first_name": "John",
    "principal_last_name": "Doe",
    "principal_email": "john.doe@test.edu",
    "principal_password": "test123456",
    "principal_access_code": "DLP/PRINCIPAL/0001/2024"
}

print("Testing chain creation with custom principal details...")
print(f"Chain data: {json.dumps(chain_data, indent=2)}")

try:
    response = requests.post(f"{BASE_URL}/api/users/generate-chain", json=chain_data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")

# Let's also check what chains exist
print("\n\nChecking existing chains...")
try:
    response = requests.get(f"{BASE_URL}/api/chains")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        chains = response.json()
        print(f"Existing chains: {json.dumps(chains, indent=2)}")
    else:
        print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")