"""
Authentication routes for IHEZA School Management System
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Dict
import logging

from database import db, ACCESS_TOKEN_EXPIRE_HOURS
from dependencies import (
    LoginRequest, LoginResponse, 
    validate_staff_access_code, validate_student_admission_number,
    verify_password, create_access_token, get_current_user
)

router = APIRouter(tags=["Authentication"])
logger = logging.getLogger(__name__)

@router.post("/auth", response_model=LoginResponse)
async def login(request: LoginRequest):
    access_code = request.accessCode.strip().upper()
    password = request.password
    portal = request.portal.lower().replace('-', '').replace('_', '')
    target_chain = request.chain
    
    logger.info(f"Login attempt: {access_code} for portal: {portal}, chain: {target_chain}")
    
    portal_role_map = {
        'director': 'director',
        'coordinator': 'coordinator',
        'principal': 'principal',
        'teacher': 'teacher',
        'secretary': 'secretary',
        'academic': 'academic',
        'sectionleader': 'section_leader',
        'student': 'student',
    }
    
    expected_role = portal_role_map.get(portal)
    if not expected_role:
        raise HTTPException(status_code=400, detail=f"Invalid portal: {portal}")
    
    if expected_role != 'student':
        validation = validate_staff_access_code(access_code)
        if not validation['valid']:
            raise HTTPException(status_code=401, detail=validation['error'])
        
        user = await db.users.find_one({"access_code": access_code}, {"_id": 0})
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not verify_password(password, user.get('password_hash', '')):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user_status = (user.get('status') or '').lower()
        if user_status != 'active':
            raise HTTPException(status_code=403, detail="Account is not active")
        
        user_role = (user.get('role') or '').lower().strip()
        role_normalization = {
            'section_leader': 'section_leader',
            'sectionleader': 'section_leader',
            'section leader': 'section_leader',
        }
        user_role = role_normalization.get(user_role, user_role)
        
        if user_role != expected_role:
            raise HTTPException(status_code=403, detail=f"Access denied. Your role is '{user.get('role')}', but this is the {portal} portal.")
        
        # Chain validation
        user_chain = user.get('chain')
        if not user_chain:
            raise HTTPException(status_code=403, detail="User chain not found in database")
        
        # Extract chain from access code
        access_code_chain = validation.get('chain')
        if access_code_chain and access_code_chain != user_chain:
            raise HTTPException(status_code=403, detail=f"Chain mismatch. Access code chain '{access_code_chain}' doesn't match user chain '{user_chain}'")
        
        # If target chain is specified (user came from a chain landing page), validate it
        if target_chain:
            # IHEZA headquarters users (director, coordinator) can access any chain
            if user_role not in ['director', 'coordinator']:
                if user_chain != target_chain:
                    raise HTTPException(status_code=403, detail=f"Access denied. You belong to chain '{user_chain}', but trying to access chain '{target_chain}'")
        
        expires = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        token = create_access_token({
            "sub": user.get('id'),
            "role": user_role,
            "chain": user.get('chain'),
            "portal": portal
        })
        
        user_response = {
            "id": user.get('id'),
            "accessCode": user.get('access_code'),
            "firstName": user.get('first_name'),
            "lastName": user.get('last_name'),
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "email": user.get('email'),
            "role": user_role,
            "chain": user.get('chain'),
            "status": user.get('status'),
            "photo_url": user.get('profile_pic') or user.get('photo_url')
        }
        
        return LoginResponse(
            success=True,
            user=user_response,
            portal=portal,
            sessionToken=token,
            expiresAt=expires.isoformat()
        )
    
    else:
        validation = validate_student_admission_number(access_code)
        if not validation['valid']:
            raise HTTPException(status_code=401, detail=validation['error'])
        
        student = await db.students.find_one({"admission_no": access_code}, {"_id": 0})
        
        if not student:
            raise HTTPException(status_code=401, detail="Student not found. Please check your admission number.")
        
        if student.get('status') != 'active':
            raise HTTPException(status_code=403, detail="Account is not active")
        
        # Chain validation for students
        student_chain = student.get('chain')
        if not student_chain:
            raise HTTPException(status_code=403, detail="Student chain not found in database")
        
        # Extract chain from admission number
        admission_chain = validation.get('chain')
        if admission_chain and admission_chain != student_chain:
            raise HTTPException(status_code=403, detail=f"Chain mismatch. Admission number chain '{admission_chain}' doesn't match student chain '{student_chain}'")
        
        # If target chain is specified (student came from a chain landing page), validate it
        if target_chain:
            if student_chain != target_chain:
                raise HTTPException(status_code=403, detail=f"Access denied. You belong to chain '{student_chain}', but trying to access chain '{target_chain}'")
        
        expires = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        token = create_access_token({
            "sub": student.get('id'),
            "role": "student",
            "chain": student.get('chain'),
            "portal": portal
        })
        
        user_response = {
            "id": student.get('id'),
            "accessCode": student.get('admission_no'),
            "admissionNo": student.get('admission_no'),
            "firstName": student.get('first_name'),
            "lastName": student.get('last_name'),
            "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
            "className": student.get('class_name'),
            "role": "student",
            "chain": student.get('chain'),
            "status": student.get('status', 'active'),
            "photo_url": student.get('profile_pic') or student.get('photo_url')
        }
        
        return LoginResponse(
            success=True,
            user=user_response,
            portal=portal,
            sessionToken=token,
            expiresAt=expires.isoformat()
        )

@router.post("/auth/logout")
async def logout():
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user
