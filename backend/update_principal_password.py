#!/usr/bin/env python3
"""
Update DUP Principal password on production server.
Run this on the production server to change the password.
"""

import asyncio
import os
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'iheza_db')]

async def update_password():
    access_code = "DUP/PRINCIPAL/0002/2021"
    new_password = "DUP00000"

    password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    result = await db.users.update_one(
        {"access_code": access_code},
        {"$set": {"password_hash": password_hash}}
    )
    
    if result.matched_count > 0:
        print(f"✓ Password updated for {access_code}")
        print(f"  New password: {new_password}")
    else:
        print(f"✗ User {access_code} not found in database")

async def main():
    print("=" * 50)
    print("Update DUP Principal Password")
    print("=" * 50)
    await update_password()
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(main())
