#!/usr/bin/env python3
"""
Export DLP user data for migration to production
"""

import asyncio
import json
import os
from database import db
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def export_dlp_user():
    """Export DLP user data"""
    print("Exporting DLP user data...")
    
    # Get the DLP user
    user = await db.users.find_one(
        {"access_code": "DLP/PRINCIPAL/0001/2024"},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user:
        print("DLP user not found in local database!")
        return None
    
    # Create export data
    export_data = {
        "access_code": user.get("access_code"),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "email": user.get("email"),
        "phone": user.get("phone", ""),
        "role": user.get("role"),
        "chain": user.get("chain"),
        "status": user.get("status", "active"),
        "password": "DLP00000"  # Default password based on pattern
    }
    
    # Save to file
    output_file = "dlp_user_export.json"
    with open(output_file, 'w') as f:
        json.dump(export_data, f, indent=2)
    
    print(f"DLP user data exported to {output_file}:")
    print(json.dumps(export_data, indent=2))
    
    return export_data

async def create_api_payload():
    """Create API payload for creating the DLP user"""
    print("\nCreating API payload for DLP user creation...")
    
    user = await db.users.find_one(
        {"access_code": "DLP/PRINCIPAL/0001/2024"},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user:
        print("DLP user not found!")
        return
    
    # API payload for POST /users endpoint
    api_payload = {
        "access_code": user.get("access_code"),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "email": user.get("email"),
        "phone": user.get("phone", ""),
        "role": user.get("role"),
        "status": user.get("status", "active"),
        "password": "DLP00000"  # Default password
    }
    
    output_file = "dlp_user_api_payload.json"
    with open(output_file, 'w') as f:
        json.dump(api_payload, f, indent=2)
    
    print(f"API payload saved to {output_file}:")
    print(json.dumps(api_payload, indent=2))
    
    # Also create curl command example
    curl_command = f"""curl -X POST 'https://iheza.online/api/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \\
  -d '{json.dumps(api_payload, indent=None)}'"""
    
    curl_file = "create_dlp_user_curl.sh"
    with open(curl_file, 'w') as f:
        f.write("#!/bin/bash\n")
        f.write("# Command to create DLP user on production server\n")
        f.write("# Replace YOUR_ADMIN_TOKEN with actual admin token\n")
        f.write(curl_command)
    
    print(f"\nCurl command saved to {curl_file}")
    print("\nNote: You need an admin token to execute this command.")
    print("The token can be obtained by logging in as an admin user (director or coordinator).")

async def main():
    print("=" * 60)
    print("DLP User Export Tool")
    print("=" * 60)
    
    # Export user data
    await export_dlp_user()
    
    # Create API payload
    await create_api_payload()
    
    print("\n" + "=" * 60)
    print("Export completed!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Use the API payload to create the DLP user on production")
    print("2. Or run the curl command with an admin token")
    print("3. Or update import_staff.py on production and run it")
    print("\nDLP User Credentials:")
    print("  Access Code: DLP/PRINCIPAL/0001/2024")
    print("  Password: DLP00000")
    print("  Email: principal@dlp.edu")
    print("  Role: principal")
    print("  Chain: DLP")

if __name__ == "__main__":
    asyncio.run(main())