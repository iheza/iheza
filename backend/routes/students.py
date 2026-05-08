"""
Student management routes for IHEZA School Management System
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

from database import db
from dependencies import (
    StudentCreate, get_current_user, get_chain_filter, serialize_doc,
    validate_student_admission_number, can_register, hash_password
)

router = APIRouter(tags=["Students"])

@router.get("/students", response_model=List[Dict])
async def get_students(class_name: Optional[str] = None, chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = get_chain_filter(current_user) if current_user else {}
    if class_name:
        query["class_name"] = class_name
    if chain:
        query["chain"] = chain
    students = await db.students.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [serialize_doc(s) for s in students]

@router.post("/students", response_model=Dict)
async def create_student(student: StudentCreate, current_user: dict = Depends(get_current_user)):
    validation = validate_student_admission_number(student.admission_no)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])
    
    if current_user:
        registrar_role = current_user.get('role', '')
        if not can_register(registrar_role, 'student'):
            raise HTTPException(status_code=403, detail=f"{registrar_role} cannot register students")
        
        registrar_chain = current_user.get('chain', '')
        if registrar_role not in ['director', 'coordinator'] and registrar_chain != validation['chain']:
            raise HTTPException(status_code=403, detail=f"Cannot register students for {validation['chain']} chain")
    
    existing = await db.students.find_one({"admission_no": student.admission_no.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Student with this admission number already exists")
    
    student_doc = {
        "id": str(uuid.uuid4()),
        "admission_no": student.admission_no.upper(),
        "first_name": student.first_name,
        "last_name": student.last_name,
        "gender": student.gender.upper(),
        "date_of_birth": student.date_of_birth,
        "class_id": student.class_id,
        "class_name": student.class_name,
        "admission_date": student.admission_date or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        "status": student.status,
        "chain": validation['chain'],
        "parent_name": student.parent_name,
        "parent_phone": student.parent_phone,
        "password_hash": hash_password(student.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.students.insert_one(student_doc)
    student_doc.pop('password_hash', None)
    student_doc.pop('_id', None)
    return student_doc

@router.get("/students/{student_id}")
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one(
        {"$or": [{"id": student_id}, {"admission_no": student_id.upper()}]},
        {"_id": 0, "password_hash": 0}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return serialize_doc(student)

@router.put("/students/{student_id}")
async def update_student(student_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    updates.pop("admission_no", None)
    
    result = await db.students.update_one({"id": student_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    student = await db.students.find_one({"id": student_id}, {"_id": 0, "password_hash": 0})
    return serialize_doc(student)

@router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.students.delete_one({"id": student_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"success": True, "message": "Student deleted"}
