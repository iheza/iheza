"""
Script to seed ALL 8 e-books into the production database (test_database)
Run this on the production server to populate all e-books
"""
import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(Path(__file__).parent / '.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

async def seed_ebooks():
    print(f"Connecting to MongoDB at {MONGO_URL}")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check if e-books already exist
    existing = await db.ebooks.count_documents({})
    print(f"Existing e-books in '{DB_NAME}': {existing}")
    
    if existing > 0:
        print("\nExisting books:")
        async for doc in db.ebooks.find({}, {"title": 1, "grade_level": 1, "chain": 1, "_id": 0}).sort("title", 1):
            print(f"  - {doc.get('title')} ({doc.get('grade_level')}) [{doc.get('chain')}]")
        
        overwrite = input("\nDo you want to DELETE all existing books and re-seed? (y/N): ")
        if overwrite.lower() != 'y':
            print("Skipping. No changes made.")
            return
        
        # Delete all existing ebooks
        result = await db.ebooks.delete_many({})
        print(f"Deleted {result.deleted_count} existing e-books")
    
    # Seed data
    seed_ebooks_data = [
        {
            "id": str(uuid.uuid4()),
            "title": "The Whispering Woods",
            "author": "IHEZA Education",
            "category": "literature",
            "description": "A captivating story about the magical Whispering Woods, perfect for Grade 4 students to enhance their reading comprehension and imagination.",
            "grade_level": "Grade 4",
            "subject": "English",
            "file_url": "/uploads/ebooks/the-whispering-woods-playbook.html",
            "chain": "DUP",
            "uploaded_by": "system",
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "The Magical Paintbrush",
            "author": "IHEZA Education",
            "category": "literature",
            "description": "A story about a young artist who discovers a magical paintbrush that brings her paintings to life. Perfect for Grade 4 students.",
            "grade_level": "Grade 4",
            "subject": "English",
            "file_url": "/uploads/ebooks/the-magical-paintbrush.html",
            "chain": "DUP",
            "uploaded_by": "system",
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Against the Tides",
            "author": "IHEZA Education",
            "category": "literature",
            "description": "An inspiring story about a young girl from a coastal village who dreams of becoming a sailor. Despite facing numerous challenges, she learns to navigate both the sea and life's obstacles.",
            "grade_level": "Grade 5",
            "subject": "English",
            "file_url": "/uploads/ebooks/against-the-tides.html",
            "chain": "DUP",
            "uploaded_by": "system",
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "The Magic of Numbers",
            "author": "IHEZA Education",
            "category": "literature",
            "description": "A fascinating journey into the world of mathematics where numbers come alive. Grade 5 students will discover the beauty and magic hidden in everyday calculations.",
            "grade_level": "Grade 5",
            "subject": "English",
            "file_url": "/uploads/ebooks/the-magic-of-numbers.html",
            "chain": "DUP",
            "uploaded_by": "system",
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Oliver Twist",
            "author": "Charles Dickens (Adapted by IHEZA Education)",
            "category": "literature",
            "description": "A classic tale adapted for Grade 6 students. Follow Oliver Twist as he navigates the harsh realities of 19th century London, finding friendship and hope along the way.",
            "grade_level": "Grade 6",
            "subject": "English",
            "file_url": "/uploads/ebooks/oliver-twist.html",
            "chain": "DUP",
            "uploaded_by": "system",
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Oliver: The Boy Who Found Balance",
            "author": "IHEZA Education",
            "category": "literature",
            "description": "A heartwarming story about Oliver, a young boy who learns to find balance between his studies, chores, and playtime. Perfect for Grade 6 students learning about time management.",
            "grade_level": "Grade 6",
            "subject": "English",
            "file_url": "/uploads/ebooks/oliver-the-boy-who-found-balance.html",
            "chain": "DUP",
            "uploaded_by": "system",
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "The Dreamer",
            "author": "IHEZA Education",
            "category": "literature",
            "description": "A story about Fakihi, a 12-year-old boy from Mwanza, Tanzania, who dreams of becoming a football superstar. Despite poverty and mockery, he trains with a tattered ball, finds a mentor in Mzee Juma, and journeys to Dar es Salaam for a tournament that changes his life.",
            "grade_level": "Grade 7",
            "subject": "English",
            "file_url": "/uploads/ebooks/the-dreamer.html",
            "chain": "DUP",
            "uploaded_by": "system",
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "The Weight of Envy",
            "author": "IHEZA Education",
            "category": "literature",
            "description": "Emma and Clara are best friends until jealousy tears them apart. Clara's envy of Emma's academic brilliance leads to bullying, sabotage, and heartbreak. A powerful story about jealousy, forgiveness, and the strength of true friendship.",
            "grade_level": "Grade 7",
            "subject": "English",
            "file_url": "/uploads/ebooks/the-weight-of-envy.html",
            "chain": "DUP",
            "uploaded_by": "system",
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    result = await db.ebooks.insert_many(seed_ebooks_data)
    print(f"\n✅ Successfully seeded {len(result.inserted_ids)} e-books into '{DB_NAME}' database!")
    
    # Verify
    count = await db.ebooks.count_documents({})
    print(f"\n📚 Total e-books in database now: {count}")
    print("\nSeeded books:")
    async for doc in db.ebooks.find({}, {"title": 1, "grade_level": 1, "_id": 0}).sort("grade_level", 1):
        print(f"  - {doc.get('title')} ({doc.get('grade_level')})")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_ebooks())
