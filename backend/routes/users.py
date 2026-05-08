"""
User (Staff) management routes for IHEZA School Management System
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid
import base64

from database import db
from dependencies import (
    UserCreate, get_current_user, get_chain_filter, serialize_doc,
    validate_staff_access_code, can_register, hash_password, ROLES
)

router = APIRouter(tags=["Users"])

@router.get("/users", response_model=List[Dict])
async def get_users(current_user: dict = Depends(get_current_user)):
    chain_filter = get_chain_filter(current_user) if current_user else {}
    users = await db.users.find(chain_filter, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]

@router.post("/users", response_model=Dict)
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    validation = validate_staff_access_code(user.access_code)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])
    
    if current_user:
        registrar_role = current_user.get('role', '')
        if not can_register(registrar_role, user.role):
            raise HTTPException(status_code=403, detail=f"{registrar_role} cannot register {user.role}")
    
    existing = await db.users.find_one({"access_code": user.access_code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="User with this access code already exists")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "access_code": user.access_code.upper(),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "role": validation['role'],
        "chain": validation['chain'],
        "status": user.status,
        "password_hash": hash_password(user.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    user_doc.pop('password_hash', None)
    user_doc.pop('_id', None)
    return user_doc

@router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_doc(user)

@router.put("/users/{user_id}")
async def update_user(user_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    updates.pop("access_code", None)
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return serialize_doc(user)

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": "User deleted"}

# ============ STAFF ROUTES ============

@router.get("/staff", response_model=List[Dict])
async def get_staff(role: Optional[str] = None, chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = get_chain_filter(current_user) if current_user else {}
    if role:
        query["role"] = role.lower()
    if chain:
        query["chain"] = chain
    staff = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    return [serialize_doc(s) for s in staff]

@router.get("/staff/{staff_id}", response_model=Dict)
async def get_staff_member(staff_id: str, current_user: dict = Depends(get_current_user)):
    staff = await db.users.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return serialize_doc(staff)

@router.put("/staff/{staff_id}", response_model=Dict)
async def update_staff_member(staff_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only directors, coordinators, and principals can update staff")
    
    updates.pop("id", None)
    updates.pop("password_hash", None)
    updates.pop("_id", None)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.users.update_one({"id": staff_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    staff = await db.users.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    return serialize_doc(staff)

@router.delete("/staff/{staff_id}")
async def delete_staff_member(staff_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only directors, coordinators, and principals can delete staff")
    
    result = await db.users.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    return {"success": True, "message": "Staff member deleted"}

@router.post("/staff/upload-profile-pic")
async def upload_staff_profile_pic(
    file: UploadFile = File(...),
    staff_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only directors, coordinators, and principals can upload profile pictures")
    
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    contents = await file.read()
    encoded = base64.b64encode(contents).decode('utf-8')
    data_url = f"data:{file.content_type};base64,{encoded}"
    
    result = await db.users.update_one(
        {"id": staff_id},
        {"$set": {"profile_pic": data_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    return {"success": True, "message": "Profile picture uploaded"}

async def create_default_classes_for_chain(chain_code: str):
    """
    Create default classes for a new chain based on chain type
    """
    # Default classes based on chain type
    # For DUP chain: Grades 4-7
    # For other chains (DLP, LALE, OLGUN): Grades 1-3
    
    if chain_code == 'DUP':
        # DUP chain classes (Grades 4-7)
        default_classes = [
            {"name": "GRADE 4A", "level": "Grade 4", "section": "A"},
            {"name": "GRADE 4B", "level": "Grade 4", "section": "B"},
            {"name": "GRADE 5A", "level": "Grade 5", "section": "A"},
            {"name": "GRADE 5B", "level": "Grade 5", "section": "B"},
            {"name": "GRADE 6A", "level": "Grade 6", "section": "A"},
            {"name": "GRADE 6B", "level": "Grade 6", "section": "B"},
            {"name": "GRADE 7", "level": "Grade 7", "section": ""}
        ]
    else:
        # DLP, LALE, OLGUN chains (Grades 1-3)
        default_classes = [
            {"name": "Grade 1A", "level": "Grade 1", "section": "A"},
            {"name": "Grade 1B", "level": "Grade 1", "section": "B"},
            {"name": "Grade 2A", "level": "Grade 2", "section": "A"},
            {"name": "Grade 3A", "level": "Grade 3", "section": "A"}
        ]
    
    created_classes = []
    
    for class_data in default_classes:
        # Check if class already exists
        existing_class = await db.classes.find_one({
            "name": class_data["name"],
            "chain": chain_code
        })
        
        if not existing_class:
            class_doc = {
                "id": str(uuid.uuid4()),
                "name": class_data["name"],
                "level": class_data["level"],
                "section": class_data["section"],
                "chain": chain_code,
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.classes.insert_one(class_doc)
            created_classes.append(class_data["name"])
    
    return created_classes

@router.post("/generate-chain", response_model=Dict)
async def generate_new_chain(
    chain_data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a new chain (school) - Only available to DUP/PRINCIPAL/0002/2021
    """
    # Check if current user is DUP/PRINCIPAL/0002/2021
    if not current_user or current_user.get('access_code') != 'DUP/PRINCIPAL/0002/2021':
        raise HTTPException(
            status_code=403, 
            detail="Only DUP/PRINCIPAL/0002/2021 can generate new chains"
        )
    
    # Validate chain data
    required_fields = ['name', 'code', 'type', 'location']
    for field in required_fields:
        if field not in chain_data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    chain_code = chain_data['code'].upper()
    
    # Check if chain already exists
    existing_chain = await db.chains.find_one({"code": chain_code})
    if existing_chain:
        raise HTTPException(status_code=400, detail=f"Chain with code {chain_code} already exists")
    
    # Create new chain document
    chain_doc = {
        "id": str(uuid.uuid4()),
        "code": chain_code,
        "name": chain_data['name'],
        "type": chain_data['type'],
        "location": chain_data['location'],
        "description": chain_data.get('description', ''),
        "status": "active",
        "created_by": current_user.get('access_code'),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert into database
    await db.chains.insert_one(chain_doc)
    
    # Create principal user for the new chain
    current_year = datetime.now().year
    principal_access_code = f"{chain_code}/PRINCIPAL/0001/{current_year}"
    
    # Use custom principal details if provided, otherwise use defaults
    principal_first_name = chain_data.get('principal_first_name', chain_data['name'])
    principal_last_name = chain_data.get('principal_last_name', 'Principal')
    principal_email = chain_data.get('principal_email', f"principal@{chain_code.lower()}.edu")
    principal_password = chain_data.get('principal_password', f"{chain_code}00000")
    
    # Check if principal user already exists (shouldn't for new chain)
    existing_principal = await db.users.find_one({"access_code": principal_access_code})
    if not existing_principal:
        principal_doc = {
            "id": str(uuid.uuid4()),
            "access_code": principal_access_code,
            "first_name": principal_first_name,
            "last_name": principal_last_name,
            "name": f"{principal_first_name} {principal_last_name}",
            "email": principal_email,
            "phone": "",
            "role": "principal",
            "chain": chain_code,
            "status": "active",
            "password_hash": hash_password(principal_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(principal_doc)
    
    # Create default classes for the new chain
    await create_default_classes_for_chain(chain_code)
    
    # Also add to SCHOOL_CHAINS constant for runtime use
    # Note: This would require server restart to take effect in dependencies.py
    # For now, we'll just store in database
    
    return {
        "success": True,
        "message": f"New chain '{chain_data['name']}' ({chain_code}) created successfully with principal user {principal_access_code}",
        "chain": {
            "id": chain_doc["id"],
            "code": chain_doc["code"],
            "name": chain_doc["name"],
            "type": chain_doc["type"],
            "location": chain_doc["location"]
        },
        "principal_user": {
            "access_code": principal_access_code,
            "password": principal_password,
            "email": f"principal@{chain_code.lower()}.edu"
        }
    }

@router.get("/chains", response_model=List[Dict])
async def get_chains(current_user: dict = Depends(get_current_user)):
    """Get all chains from database"""
    # Allow unauthenticated access for chain listing
    # Chains are not sensitive data - they're just school names
    chains = await db.chains.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return [serialize_doc(chain) for chain in chains]

@router.get("/chains/{chain_code}", response_model=Dict)
async def get_chain(chain_code: str):
    """Get a specific chain by code - Public endpoint for landing pages"""
    chain = await db.chains.find_one({"code": chain_code.upper()}, {"_id": 0})
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    
    return serialize_doc(chain)

@router.put("/chains/{chain_code}", response_model=Dict)
async def update_chain(
    chain_code: str, 
    updates: Dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a chain - Only available to DUP/PRINCIPAL/0002/2021"""
    # Check if current user is DUP/PRINCIPAL/0002/2021
    if not current_user or current_user.get('access_code') != 'DUP/PRINCIPAL/0002/2021':
        raise HTTPException(
            status_code=403, 
            detail="Only DUP/PRINCIPAL/0002/2021 can update chains"
        )
    
    # Validate chain exists
    existing_chain = await db.chains.find_one({"code": chain_code.upper()})
    if not existing_chain:
        raise HTTPException(status_code=404, detail=f"Chain with code {chain_code} not found")
    
    # Don't allow updating code
    if 'code' in updates:
        updates.pop('code')
    
    # Add updated timestamp
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update chain
    result = await db.chains.update_one(
        {"code": chain_code.upper()},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chain not found")
    
    # Get updated chain
    updated_chain = await db.chains.find_one({"code": chain_code.upper()}, {"_id": 0})
    
    return {
        "success": True,
        "message": f"Chain '{chain_code}' updated successfully",
        "chain": serialize_doc(updated_chain)
    }

@router.delete("/chains/{chain_code}")
async def delete_chain(
    chain_code: str, 
    current_user: dict = Depends(get_current_user)
):
    """Delete a chain - Only available to DUP/PRINCIPAL/0002/2021"""
    # Check if current user is DUP/PRINCIPAL/0002/2021
    if not current_user or current_user.get('access_code') != 'DUP/PRINCIPAL/0002/2021':
        raise HTTPException(
            status_code=403, 
            detail="Only DUP/PRINCIPAL/0002/2021 can delete chains"
        )
    
    # Validate chain exists
    existing_chain = await db.chains.find_one({"code": chain_code.upper()})
    if not existing_chain:
        raise HTTPException(status_code=404, detail=f"Chain with code {chain_code} not found")
    
    # Delete chain
    result = await db.chains.delete_one({"code": chain_code.upper()})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chain not found")
    
    return {
        "success": True,
        "message": f"Chain '{chain_code}' deleted successfully"
    }
