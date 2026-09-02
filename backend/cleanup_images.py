"""
Script to delete heavy images from DB to free up space and prevent 502/520 errors.
Targets: receipt_image in payments, passport_photo in admissions/students
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'iheza_db')]

async def cleanup_images():
    """Remove heavy image data from collections to free up DB space."""
    
    print("Starting image cleanup...")
    
    # 1. Remove receipt_image from payments
    payments_result = await db.payments.update_many(
        {"receipt_image": {"$exists": True, "$ne": None}},
        {"$unset": {"receipt_image": ""}}
    )
    print(f"Payments: Removed receipt_image from {payments_result.modified_count} records")
    
    # Also remove receipt_images array if it exists
    payments_result2 = await db.payments.update_many(
        {"receipt_images": {"$exists": True}},
        {"$unset": {"receipt_images": ""}}
    )
    print(f"Payments: Removed receipt_images array from {payments_result2.modified_count} records")
    
    # 2. Remove passport_photo from admissions
    admissions_result = await db.admissions.update_many(
        {"passport_photo": {"$exists": True, "$ne": None}},
        {"$unset": {"passport_photo": ""}}
    )
    print(f"Admissions: Removed passport_photo from {admissions_result.modified_count} records")
    
    # 3. Remove passport_photo and profile_pic from students (if storing base64)
    students_result = await db.students.update_many(
        {"$or": [
            {"passport_photo": {"$exists": True, "$ne": None, "$regex": "^data:image/"}},
            {"profile_pic": {"$exists": True, "$ne": None, "$regex": "^data:image/"}}
        ]},
        {"$unset": {"passport_photo": "", "profile_pic": ""}}
    )
    print(f"Students: Removed base64 images from {students_result.modified_count} records")
    
    # 4. Remove profile_pic from users (staff) if storing base64
    users_result = await db.users.update_many(
        {"profile_pic": {"$exists": True, "$ne": None, "$regex": "^data:image/"}},
        {"$unset": {"profile_pic": ""}}
    )
    print(f"Users: Removed base64 profile_pic from {users_result.modified_count} records")
    
    # 5. Remove large base64 data from documents collection
    docs_result = await db.documents.update_many(
        {"data": {"$exists": True, "$ne": None, "$regex": "^data:"}},
        {"$unset": {"data": ""}}
    )
    print(f"Documents: Removed base64 data from {docs_result.modified_count} records")
    
    print("\nImage cleanup completed!")
    print("NOTE: This operation frees up database space but removes image data.")
    print("Users will need to re-upload images if needed.")

if __name__ == "__main__":
    asyncio.run(cleanup_images())
