#!/usr/bin/env python3
"""
Script to add DLP user to production database
This script should be run on the production server
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import bcrypt
from dotenv import load_dotenv
from pathlib import Path

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def add_dlp_user(mongo_url: str, db_name: str):
    """Add DLP user to the specified MongoDB database"""
    print(f"Connecting to MongoDB: {mongo_url}")
    print(f"Database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # DLP user data
    dlp_user = {
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
    
    print(f"\nChecking if DLP user already exists: {dlp_user['access_code']}")
    
    # Check if user already exists
    existing = await db.users.find_one({"access_code": dlp_user["access_code"]})
    
    if existing:
        print(f"User already exists. Updating password...")
        # Update password
        await db.users.update_one(
            {"access_code": dlp_user["access_code"]},
            {"$set": {
                "password_hash": hash_password(dlp_user["password"]),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        print("Password updated successfully!")
        return False
    else:
        print("User does not exist. Creating new user...")
        
        # Create user document
        user_doc = {
            "id": str(uuid.uuid4()),
            "access_code": dlp_user["access_code"],
            "first_name": dlp_user["first_name"],
            "last_name": dlp_user["last_name"],
            "name": f"{dlp_user['first_name']} {dlp_user['last_name']}".strip(),
            "email": dlp_user["email"],
            "phone": dlp_user["phone"],
            "role": dlp_user["role"],
            "chain": dlp_user["chain"],
            "status": dlp_user["status"],
            "password_hash": hash_password(dlp_user["password"]),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
        print("User created successfully!")
        return True

async def verify_user(mongo_url: str, db_name: str):
    """Verify the DLP user was added"""
    print("\nVerifying DLP user...")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    user = await db.users.find_one(
        {"access_code": "DLP/PRINCIPAL/0001/2024"},
        {"_id": 0, "password_hash": 0}
    )
    
    if user:
        print("✓ DLP user found in database:")
        for key, value in user.items():
            print(f"  {key}: {value}")
        return True
    else:
        print("✗ DLP user not found in database!")
        return False

async def main():
    print("=" * 60)
    print("Add DLP User to Production Database")
    print("=" * 60)
    
    # Get MongoDB connection details from environment or user input
    mongo_url = os.environ.get('PRODUCTION_MONGO_URL')
    db_name = os.environ.get('PRODUCTION_DB_NAME')
    
    if not mongo_url:
        print("\nPRODUCTION_MONGO_URL environment variable not set.")
        print("Please set it to your production MongoDB connection string.")
        print("Example: mongodb+srv://username:password@cluster.mongodb.net/")
        mongo_url = input("Enter production MongoDB URL: ").strip()
    
    if not db_name:
        print("\nPRODUCTION_DB_NAME environment variable not set.")
        print("Please set it to your production database name.")
        db_name = input("Enter production database name: ").strip()
    
    if not mongo_url or not db_name:
        print("Error: MongoDB URL and database name are required!")
        return
    
    try:
        # Add DLP user
        created = await add_dlp_user(mongo_url, db_name)
        
        # Verify user
        await verify_user(mongo_url, db_name)
        
        print("\n" + "=" * 60)
        print("Operation completed successfully!")
        print("=" * 60)
        print("\nDLP User Credentials:")
        print("  Access Code: DLP/PRINCIPAL/0001/2024")
        print("  Password: DLP00000")
        print("  Email: principal@dlp.edu")
        print("  Role: principal")
        print("  Chain: DLP")
        
        if created:
            print("\nNote: User was newly created.")
        else:
            print("\nNote: User already existed. Password was updated.")
            
    except Exception as e:
        print(f"\nError: {e}")
        print("\nMake sure:")
        print("1. The MongoDB URL is correct")
        print("2. You have network access to the MongoDB server")
        print("3. Your credentials have write permissions")
        return

if __name__ == "__main__":
    asyncio.run(main())