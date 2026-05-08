#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid
from datetime import datetime, timezone

async def test_chain_creation():
    # Connect to MongoDB - use same database as backend
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['test_database']  # Use same database as backend
    
    # Check if DUP/PRINCIPAL/0002/2021 exists
    user = await db.users.find_one({"access_code": "DUP/PRINCIPAL/0002/2021"})
    
    if not user:
        print("Creating DUP/PRINCIPAL/0002/2021 user for testing...")
        # Create the special user
        password = "test123456"
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        user_doc = {
            "id": str(uuid.uuid4()),
            "access_code": "DUP/PRINCIPAL/0002/2021",
            "first_name": "Test",
            "last_name": "Principal",
            "email": "test@test.edu",
            "role": "principal",
            "chain": "DUP",
            "status": "active",
            "password_hash": password_hash,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
        print(f"Created user DUP/PRINCIPAL/0002/2021 with password: {password}")
    else:
        print(f"User DUP/PRINCIPAL/0002/2021 already exists")
        # Try to update password to known value
        password = "test123456"
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        await db.users.update_one(
            {"access_code": "DUP/PRINCIPAL/0002/2021"},
            {"$set": {"password_hash": password_hash}}
        )
        print(f"Updated password to: {password}")
    
    # Check chains collection
    chains_count = await db.chains.count_documents({})
    print(f"Current chains in database: {chains_count}")
    
    # List existing chains
    chains = await db.chains.find({}, {"_id": 0, "code": 1, "name": 1}).to_list(10)
    print("Existing chains:")
    for chain in chains:
        print(f"  - {chain['code']}: {chain['name']}")
    
    client.close()
    print("\nTest completed. You can now login with:")
    print("Access Code: DUP/PRINCIPAL/0002/2021")
    print("Password: test123456")
    print("Portal: principal")

if __name__ == "__main__":
    asyncio.run(test_chain_creation())