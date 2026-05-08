"""
IHEZA School Management API - Main Server
Refactored with modular routes for better maintainability
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Import routers
from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.students import router as students_router
from routes.classes import router as classes_router
from routes.attendance import router as attendance_router

# Create the main app
app = FastAPI(title="IHEZA School Management API", version="2.0.0")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(students_router, prefix="/api")
app.include_router(classes_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")

# Health check endpoint
@app.get("/")
async def root():
    return {"message": "IHEZA School Management API", "version": "2.0.0", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
