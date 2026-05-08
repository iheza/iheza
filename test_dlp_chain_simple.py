#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8001/api"

# First, let's try to login with any principal user to see what happens
print("Testing chain creation flow...")

# Try to get chains without auth
print("\n1. Trying to get chains without authentication...")
response = requests.get(f"{BASE_URL}/users/chains")
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    print(f"   Response: {response.text[:100]}...")
else:
    print(f"   Error: {response.text}")

# Check if TEST chain already exists
print("\n2. Checking if TEST chain exists...")
response = requests.get(f"{BASE_URL}/users/chains/TEST")
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    print(f"   TEST chain exists: {response.json().get('name')}")
else:
    print(f"   TEST chain doesn't exist or requires auth")

# Check classes for DLP chain (which we know exists)
print("\n3. Checking classes for DLP chain...")
response = requests.get(f"{BASE_URL}/classes")
if response.status_code == 200:
    classes = response.json()
    dlp_classes = [c for c in classes if c.get('chain') == 'DLP']
    print(f"   Found {len(dlp_classes)} classes for DLP chain")
    for cls in dlp_classes[:5]:
        print(f"   - {cls.get('name')}")
else:
    print(f"   Error getting classes: {response.status_code} - {response.text}")

# Check the actual issue: maybe the chain creation endpoint requires a specific user
# Let's check what the endpoint documentation says
print("\n4. Checking API docs for generate-chain endpoint...")
print("   Visit http://localhost:8001/api/docs to see the endpoint requirements")