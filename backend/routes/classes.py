"""
Classes and Subjects management routes for IHEZA School Management System
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

from database import db
from dependencies import (
    ClassBase, SubjectBase, get_current_user, get_chain_filter, serialize_doc,
    SCHOOL_PREFIXES
)

router = APIRouter(tags=["Classes & Subjects"])

# ============ CLASSES ROUTES ============

@router.get("/classes", response_model=List[Dict])
async def get_classes(chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = get_chain_filter(current_user) if current_user else {}
    # If a specific chain is requested (e.g., by director selecting a chain filter), override the query
    if chain:
        query["chain"] = chain
    classes = await db.classes.find(query, {"_id": 0}).to_list(100)
    return [serialize_doc(c) for c in classes]

@router.post("/classes", response_model=Dict)
async def create_class(cls: ClassBase, current_user: dict = Depends(get_current_user)):
    if cls.chain not in SCHOOL_PREFIXES:
        raise HTTPException(status_code=400, detail=f"Invalid chain. Must be one of: {', '.join(SCHOOL_PREFIXES)}")
    
    class_doc = {
        "id": str(uuid.uuid4()),
        **cls.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.classes.insert_one(class_doc)
    class_doc.pop('_id', None)
    return class_doc

@router.get("/classes/{class_id}")
async def get_class(class_id: str):
    cls = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return serialize_doc(cls)

@router.put("/classes/{class_id}")
async def update_class(class_id: str, updates: Dict):
    result = await db.classes.update_one({"id": class_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    cls = await db.classes.find_one({"id": class_id}, {"_id": 0})
    return serialize_doc(cls)

@router.delete("/classes/{class_id}")
async def delete_class(class_id: str):
    result = await db.classes.delete_one({"id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"success": True, "message": "Class deleted"}

# ============ SUBJECTS ROUTES ============

@router.get("/subjects", response_model=List[Dict])
async def get_subjects(class_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = get_chain_filter(current_user) if current_user else {}
    if class_id:
        query["class_id"] = class_id
    subjects = await db.subjects.find(query, {"_id": 0}).to_list(200)
    return [serialize_doc(s) for s in subjects]

@router.post("/subjects", response_model=Dict)
async def create_subject(subject: SubjectBase):
    subject_doc = {
        "id": str(uuid.uuid4()),
        **subject.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.subjects.insert_one(subject_doc)
    subject_doc.pop('_id', None)
    return subject_doc

@router.get("/subjects/{subject_id}")
async def get_subject(subject_id: str):
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return serialize_doc(subject)

@router.put("/subjects/{subject_id}")
async def update_subject(subject_id: str, updates: Dict):
    result = await db.subjects.update_one({"id": subject_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    return serialize_doc(subject)

@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    result = await db.subjects.delete_one({"id": subject_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"success": True, "message": "Subject deleted"}
