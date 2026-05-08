#!/usr/bin/env python3
"""
Safe script to import ONLY the DLP user without deleting existing users
This is a safer alternative to import_staff.py for production use
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import bcrypt
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'iheza_db')]

# DLP user data
DLP_USER = {
    "access_code": "DLP/PRINCIPAL/0001/2024",
    "first_name": "DLP",
    "last_name": "Principal",
    "email": "principal@dlp.edu",
    "phone": "",
    "role": "principal",
    "chain": "DLP",
    "status": "active",
    "password": "DLP00000"
}

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def import_dlp_user_safe():
    """Import DLP user only if it doesn't exist"""
    print("=" * 60)
    print("Safe DLP User Import Tool")
    print("=" * 60)
    
    print(f"\nChecking if DLP user already exists: {DLP_USER['access_code']}")
    
    # Check if user already exists
    existing = await db.users.find_one({"access_code": DLP_USER["access_code"]})
    
    if existing:
        print(f"✓ DLP user already exists in database.")
        print(f"  Updating password and information...")
        
        # Update user information
        await db.users.update_one(
            {"access_code": DLP_USER["access_code"]},
            {"$set": {
                "first_name": DLP_USER["first_name"],
                "last_name": DLP_USER["last_name"],
                "name": f"{DLP_USER['first_name']} {DLP_USER['last_name']}".strip(),
                "email": DLP_USER["email"],
                "phone": DLP_USER["phone"],
                "role": DLP_USER["role"],
                "chain": DLP_USER["chain"],
                "status": DLP_USER["status"],
                "password_hash": hash_password(DLP_USER["password"]),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        print("✓ DLP user updated successfully!")
        return "updated"
    else:
        print("✗ DLP user not found. Creating new user...")
        
        # Create user document
        user_doc = {
            "id": str(uuid.uuid4()),
            "access_code": DLP_USER["access_code"],
            "first_name": DLP_USER["first_name"],
            "last_name": DLP_USER["last_name"],
            "name": f"{DLP_USER['first_name']} {DLP_USER['last_name']}".strip(),
            "email": DLP_USER["email"],
            "phone": DLP_USER["phone"],
            "role": DLP_USER["role"],
            "chain": DLP_USER["chain"],
            "status": DLP_USER["status"],
            "password_hash": hash_password(DLP_USER["password"]),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
        print("✓ DLP user created successfully!")
        return "created"

async def verify_dlp_user():
    """Verify the DLP user was added/updated"""
    print("\n" + "=" * 60)
    print("Verification")
    print("=" * 60)
    
    user = await db.users.find_one(
        {"access_code": DLP_USER["access_code"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if user:
        print("✓ DLP user verified in database:")
        for key, value in user.items():
            print(f"  {key}: {value}")
        return True
    else:
        print("✗ DLP user NOT found in database!")
        return False

async def check_existing_users():
    """Check how many users exist in the database"""
    print("\n" + "=" * 60)
    print("Database Status")
    print("=" * 60)
    
    total_users = await db.users.count_documents({})
    print(f"Total users in database: {total_users}")
    
    # Count by chain
    pipeline = [
        {"$group": {"_id": "$chain", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    
    chain_counts = await db.users.aggregate(pipeline).to_list(20)
    print("\nUsers by chain:")
    for cc in chain_counts:
        print(f"  {cc['_id']}: {cc['count']}")
    
    return total_users

async def main():
    """Main function"""
    try:
        # Check current database status
        await check_existing_users()
        
        # Import DLP user safely
        result = await import_dlp_user_safe()
        
        # Verify the import
        await verify_dlp_user()
        
        print("\n" + "=" * 60)
        print("Operation Completed Successfully!")
        print("=" * 60)
        
        print(f"\nDLP User {result}:")
        print(f"  Access Code: {DLP_USER['access_code']}")
        print(f"  Password: {DLP_USER['password']}")
        print(f"  Email: {DLP_USER['email']}")
        print(f"  Role: {DLP_USER['role']}")
        print(f"  Chain: {DLP_USER['chain']}")
        
        print("\n" + "=" * 60)
        print("Next Steps:")
        print("=" * 60)
        print("1. Test login on iheza.online with the DLP user credentials")
        print("2. If login fails, check server logs for authentication errors")
        print("3. Verify the user has 'active' status in the database")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\nTroubleshooting:")
        print("1. Check MongoDB connection string in .env file")
        print("2. Verify MongoDB server is running")
        print("3. Check network connectivity")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)