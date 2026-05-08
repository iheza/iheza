#!/usr/bin/env python3
"""
Fixed server with improved attendance handling
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'iheza_db')]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'iheza-secret-key-2025')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Import modular attendance router
from routes.attendance import router as attendance_router

# Create the main app
app = FastAPI(title="IHEZA School Management API - Fixed", version="2.0.1")

# Create routers
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Include modular attendance router
api_router.include_router(attendance_router)

# Also include other essential routes from server.py
# (simplified version - in reality you'd import all modular routers)

def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != '_id'}
    for key, value in result.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
    return result

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

# Health check endpoint
@api_router.get("/health")
async def health():
    return {"status": "healthy", "server": "fixed", "version": "2.0.1"}

# Simple test endpoint to check attendance
@api_router.get("/test-attendance")
async def test_attendance(current_user: dict = Depends(get_current_user)):
    """Test endpoint to debug attendance issues"""
    logger.info(f"Test attendance called. User: {current_user}")
    
    # Count all attendance records
    total_count = await db.attendance.count_documents({})
    
    # Count student attendance records
    student_count = await db.attendance.count_documents({"target_type": "student"})
    
    # Get a sample of student records
    sample_records = await db.attendance.find(
        {"target_type": "student"}, 
        {"_id": 0}
    ).limit(5).to_list(5)
    
    # Check chain field in records
    chains_in_data = await db.attendance.distinct("chain", {"target_type": "student"})
    
    return {
        "total_attendance_records": total_count,
        "student_attendance_records": student_count,
        "sample_records": [serialize_doc(r) for r in sample_records],
        "chains_in_student_data": chains_in_data,
        "current_user": current_user,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Include the API router
app.include_router(api_router)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)