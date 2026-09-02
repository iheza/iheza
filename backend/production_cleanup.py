#!/usr/bin/env python3
"""
IHEZA Production Database Cleanup Script
=========================================

This script removes heavy base64 image data from the MongoDB database to reduce
memory pressure and prevent 502/520 errors.

USAGE:
------
1. Set your production MongoDB connection string:
   export MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net/iheza_db"

2. Run the script:
   python production_cleanup.py

3. Or run with a specific MongoDB URL:
   python production_cleanup.py "mongodb+srv://user:pass@cluster.mongodb.net/iheza_db"

WHAT IT DOES:
-------------
- Removes receipt_image and receipt_images from payments collection
- Removes passport_photo from admissions collection  
- Removes base64 passport_photo and profile_pic from students collection
- Removes base64 profile_pic from users collection
- Removes base64 data from documents collection

NOTE: This is a destructive operation. Images will need to be re-uploaded if needed.
"""

import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def cleanup_database(mongo_url: str, db_name: str = "iheza_db"):
    """Remove heavy image data from MongoDB collections."""
    
    print(f"Connecting to MongoDB...")
    print(f"Database: {db_name}")
    print("-" * 50)
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    total_modified = 0
    
    # 1. Clean payments collection - remove receipt images
    print("\n[1/5] Cleaning payments collection...")
    result1 = await db.payments.update_many(
        {"receipt_image": {"$exists": True, "$ne": None}},
        {"$unset": {"receipt_image": ""}}
    )
    print(f"  - Removed receipt_image from {result1.modified_count} records")
    total_modified += result1.modified_count
    
    result1b = await db.payments.update_many(
        {"receipt_images": {"$exists": True}},
        {"$unset": {"receipt_images": ""}}
    )
    print(f"  - Removed receipt_images array from {result1b.modified_count} records")
    total_modified += result1b.modified_count
    
    # 2. Clean admissions collection - remove passport photos
    print("\n[2/5] Cleaning admissions collection...")
    result2 = await db.admissions.update_many(
        {"passport_photo": {"$exists": True, "$ne": None}},
        {"$unset": {"passport_photo": ""}}
    )
    print(f"  - Removed passport_photo from {result2.modified_count} records")
    total_modified += result2.modified_count
    
    # 3. Clean students collection - remove base64 images only
    print("\n[3/5] Cleaning students collection...")
    result3 = await db.students.update_many(
        {"$or": [
            {"passport_photo": {"$exists": True, "$regex": "^data:image/"}},
            {"profile_pic": {"$exists": True, "$regex": "^data:image/"}}
        ]},
        {"$unset": {"passport_photo": "", "profile_pic": ""}}
    )
    print(f"  - Removed base64 images from {result3.modified_count} student records")
    total_modified += result3.modified_count
    
    # 4. Clean users collection - remove base64 profile pics
    print("\n[4/5] Cleaning users collection...")
    result4 = await db.users.update_many(
        {"profile_pic": {"$exists": True, "$regex": "^data:image/"}},
        {"$unset": {"profile_pic": ""}}
    )
    print(f"  - Removed base64 profile_pic from {result4.modified_count} user records")
    total_modified += result4.modified_count
    
    # 5. Clean documents collection - remove base64 data
    print("\n[5/5] Cleaning documents collection...")
    result5 = await db.documents.update_many(
        {"data": {"$exists": True, "$regex": "^data:"}},
        {"$unset": {"data": ""}}
    )
    print(f"  - Removed base64 data from {result5.modified_count} document records")
    total_modified += result5.modified_count
    
    print("\n" + "=" * 50)
    print(f"CLEANUP COMPLETE!")
    print(f"Total records modified: {total_modified}")
    print("=" * 50)
    print("\nNOTE: Users will need to re-upload images if needed.")
    print("The database should now use significantly less memory.")
    
    client.close()
    return total_modified

async def main():
    # Get MongoDB URL from command line, environment, or use default
    if len(sys.argv) > 1:
        mongo_url = sys.argv[1]
    else:
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    
    db_name = os.environ.get('DB_NAME', 'iheza_db')
    
    print("=" * 50)
    print("IHEZA Database Cleanup Script")
    print("=" * 50)
    
    # Confirmation prompt
    print(f"\nThis will remove image data from: {mongo_url[:50]}...")
    print("This operation CANNOT be undone!")
    
    confirm = input("\nType 'YES' to proceed: ")
    if confirm != 'YES':
        print("Aborted.")
        return
    
    await cleanup_database(mongo_url, db_name)

if __name__ == "__main__":
    asyncio.run(main())
