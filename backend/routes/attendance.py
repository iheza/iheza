"""
Attendance and QR Code routes for IHEZA School Management System
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import uuid

from database import db
from dependencies import (
    AttendanceRecord, get_current_user, get_chain_filter, serialize_doc,
    validate_staff_access_code
)

router = APIRouter(tags=["Attendance"])

# ============ QR CODE MODEL ============

class QRCodeCreate(BaseModel):
    school_name: str
    chain: str
    duration_days: int = 30
    notes: Optional[str] = None

# ============ ATTENDANCE ROUTES ============



@router.get("/attendance", response_model=List[Dict])
async def get_attendance(
    target_type: Optional[str] = None,
    date: Optional[str] = None,
    month: Optional[str] = None,
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if target_type:
        query["target_type"] = target_type
    if date:
        query["date"] = date
    if month:
        query["date"] = {"$regex": f"^{month}"}
    if chain:
        query["chain"] = chain
    records = await db.attendance.find(query, {"_id": 0}).to_list(5000)
    return [serialize_doc(r) for r in records]


@router.post("/attendance", response_model=Dict)
async def record_attendance(record: AttendanceRecord, current_user: dict = Depends(get_current_user)):
    record_doc = record.model_dump()
    record_doc["recorded_at"] = datetime.now(timezone.utc).isoformat()
    
    if not record_doc.get("check_in_time"):
        record_doc["check_in_time"] = datetime.now(timezone.utc).strftime('%H:%M:%S')
    
    existing = await db.attendance.find_one({
        "target_id": record.target_id,
        "target_type": record.target_type,
        "date": record.date
    })
    
    if existing:
        await db.attendance.update_one(
            {"id": existing["id"]},
            {"$set": {
                "status": record.status,
                "check_in_time": record_doc["check_in_time"],
                "recorded_at": record_doc["recorded_at"]
            }}
        )
        record_doc["id"] = existing["id"]
    else:
        await db.attendance.insert_one(record_doc)
    
    record_doc.pop('_id', None)
    return record_doc

@router.post("/attendance/staff-checkin", response_model=Dict)
async def staff_qr_checkin(data: Dict, current_user: dict = Depends(get_current_user)):
    """QR Code check-in/check-out for staff members with late detection"""
    access_code = data.get('access_code', '').upper()
    qr_code = data.get('qr_code', '')
    
    validation = validate_staff_access_code(access_code)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])
    
    staff = await db.users.find_one({"access_code": access_code}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    eat_timezone = timezone(timedelta(hours=3))
    current_time = datetime.now(eat_timezone)
    today = current_time.strftime('%Y-%m-%d')
    time_str = current_time.strftime('%H:%M:%S')
    
    late_threshold_hour = 7
    late_threshold_minute = 30
    
    existing = await db.attendance.find_one({
        "target_id": staff['id'],
        "target_type": "staff",
        "date": today
    })
    
    if existing:
        if existing.get('check_in_time') and not existing.get('check_out_time'):
            await db.attendance.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "check_out_time": time_str,
                    "updated_at": datetime.now(eat_timezone).isoformat()
                }}
            )
            return {
                "success": True,
                "action": "check_out",
                "message": f"{staff['first_name']} {staff['last_name']} checked out successfully",
                "staff": serialize_doc(staff),
                "check_in_time": existing.get('check_in_time'),
                "check_out_time": time_str,
                "is_late": existing.get('is_late', False),
                "late_duration": existing.get('late_duration')
            }
        else:
            return {
                "success": True,
                "action": "already_complete",
                "message": f"{staff['first_name']} {staff['last_name']} already completed attendance for today",
                "staff": serialize_doc(staff),
                "check_in_time": existing.get('check_in_time'),
                "check_out_time": existing.get('check_out_time'),
                "is_late": existing.get('is_late', False),
                "late_duration": existing.get('late_duration')
            }
    
    is_late = False
    late_duration = None
    current_hour = current_time.hour
    current_minute = current_time.minute
    
    if current_hour > late_threshold_hour or (current_hour == late_threshold_hour and current_minute > late_threshold_minute):
        is_late = True
        late_minutes = (current_hour - late_threshold_hour) * 60 + (current_minute - late_threshold_minute)
        hours = late_minutes // 60
        mins = late_minutes % 60
        if hours > 0:
            late_duration = f"{hours}h {mins}m"
        else:
            late_duration = f"{mins}m"
    
    record = {
        "id": str(uuid.uuid4()),
        "target_type": "staff",
        "target_id": staff['id'],
        "chain": staff.get('chain'),
        "date": today,
        "status": "late" if is_late else "present",
        "check_in_time": time_str,
        "check_out_time": None,
        "is_late": is_late,
        "late_duration": late_duration,
        "qr_code_used": qr_code,
        "recorded_by": current_user.get('sub', 'qr_scanner') if current_user else 'qr_scanner',
        "recorded_at": datetime.now(eat_timezone).isoformat()
    }
    
    await db.attendance.insert_one(record)
    
    return {
        "success": True,
        "action": "check_in",
        "message": f"{staff['first_name']} {staff['last_name']} checked in {'(LATE)' if is_late else 'on time'}",
        "staff": serialize_doc(staff),
        "check_in_time": time_str,
        "is_late": is_late,
        "late_duration": late_duration
    }

@router.post("/attendance/qr-checkin", response_model=Dict)
async def manual_qr_checkin(data: Dict, current_user: dict = Depends(get_current_user)):
    """Manual check-in/check-out with explicit action"""
    access_code = data.get('access_code', '').upper().strip()
    action = data.get('action', 'check_in')
    qr_code_used = data.get('qr_code', '')
    
    if not access_code:
        raise HTTPException(status_code=400, detail="Access code is required")
    
    validation = validate_staff_access_code(access_code)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])
    
    staff = await db.users.find_one({"access_code": access_code}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found with this access code")
    
    eat_timezone = timezone(timedelta(hours=3))
    current_time = datetime.now(eat_timezone)
    today = current_time.strftime('%Y-%m-%d')
    time_str = current_time.strftime('%H:%M:%S')
    
    late_threshold_hour = 7
    late_threshold_minute = 30
    
    existing = await db.attendance.find_one({
        "target_id": staff['id'],
        "target_type": "staff",
        "date": today
    })
    
    if action == 'check_out':
        if not existing or not existing.get('check_in_time'):
            raise HTTPException(status_code=400, detail="Must check in before checking out")
        
        if existing.get('check_out_time'):
            raise HTTPException(status_code=400, detail="Already checked out today")
        
        await db.attendance.update_one(
            {"id": existing["id"]},
            {"$set": {
                "check_out_time": time_str,
                "check_out_qr_code": qr_code_used,
                "updated_at": datetime.now(eat_timezone).isoformat()
            }}
        )
        return {
            "success": True,
            "action": "check_out",
            "message": f"{staff['first_name']} {staff['last_name']} checked out successfully",
            "staff": serialize_doc(staff),
            "check_in_time": existing.get('check_in_time'),
            "check_out_time": time_str,
            "is_late": existing.get('is_late', False),
            "late_duration": existing.get('late_duration')
        }
    
    if existing:
        if existing.get('check_in_time') and not existing.get('check_out_time'):
            raise HTTPException(status_code=400, detail="Already checked in. Use Check Out button.")
        elif existing.get('check_out_time'):
            raise HTTPException(status_code=400, detail="Already completed attendance for today")
    
    is_late = False
    late_duration = None
    current_hour = current_time.hour
    current_minute = current_time.minute
    
    if current_hour > late_threshold_hour or (current_hour == late_threshold_hour and current_minute > late_threshold_minute):
        is_late = True
        late_minutes = (current_hour - late_threshold_hour) * 60 + (current_minute - late_threshold_minute)
        hours = late_minutes // 60
        mins = late_minutes % 60
        if hours > 0:
            late_duration = f"{hours}h {mins}m"
        else:
            late_duration = f"{mins}m"
    
    record = {
        "id": str(uuid.uuid4()),
        "target_type": "staff",
        "target_id": staff['id'],
        "chain": staff.get('chain'),
        "date": today,
        "status": "late" if is_late else "present",
        "check_in_time": time_str,
        "check_out_time": None,
        "is_late": is_late,
        "late_duration": late_duration,
        "qr_code_used": qr_code_used,
        "recorded_by": current_user.get('sub') if current_user else 'qr_scanner',
        "recorded_at": datetime.now(eat_timezone).isoformat()
    }
    
    await db.attendance.insert_one(record)
    
    return {
        "success": True,
        "action": "check_in",
        "message": f"{staff['first_name']} {staff['last_name']} checked in {'(LATE - ' + late_duration + ')' if is_late else 'on time'}",
        "staff": serialize_doc(staff),
        "check_in_time": time_str,
        "is_late": is_late,
        "late_duration": late_duration
    }

@router.get("/attendance/staff-today", response_model=List[Dict])
async def get_staff_attendance_today(chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get today's staff attendance"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    query = {"target_type": "staff", "date": today}
    if chain:
        query["chain"] = chain
    elif current_user:
        chain_filter = get_chain_filter(current_user)
        query.update(chain_filter)
    
    records = await db.attendance.find(query, {"_id": 0}).to_list(500)
    
    result = []
    for record in records:
        staff = await db.users.find_one({"id": record['target_id']}, {"_id": 0, "password_hash": 0})
        if staff:
            record['staff'] = serialize_doc(staff)
        result.append(serialize_doc(record))
    
    return result

@router.post("/attendance/bulk", response_model=Dict)
async def bulk_record_attendance(records: List[Dict]):
    recorded = 0
    for record in records:
        record["id"] = record.get("id", str(uuid.uuid4()))
        record["recorded_at"] = datetime.now(timezone.utc).isoformat()
        
        existing = await db.attendance.find_one({
            "target_id": record.get("target_id"),
            "target_type": record.get("target_type", "student"),
            "date": record.get("date")
        })
        
        if existing:
            await db.attendance.update_one({"id": existing["id"]}, {"$set": record})
        else:
            await db.attendance.insert_one(record)
        recorded += 1
    
    return {"success": True, "recorded": recorded}

# ============ QR CODE ROUTES ============

@router.post("/qr-codes")
async def create_qr_code(qr_data: QRCodeCreate, current_user: dict = Depends(get_current_user)):
    """Create a new QR code for attendance"""
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only Directors, Coordinators, and Principals can create QR codes")
    
    qr_id = str(uuid.uuid4())[:8].upper()
    expiry_date = (datetime.now(timezone.utc) + timedelta(days=qr_data.duration_days)).isoformat()
    
    qr_doc = {
        "id": qr_id,
        "code": f"IHEZA-QR-{qr_id}",
        "school_name": qr_data.school_name,
        "chain": qr_data.chain,
        "duration_days": qr_data.duration_days,
        "expiry_date": expiry_date,
        "created_by": current_user.get('sub'),
        "created_by_name": current_user.get('name', 'Unknown'),
        "notes": qr_data.notes,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.qr_codes.insert_one(qr_doc)
    
    return {"success": True, "qr_code": serialize_doc(qr_doc)}

@router.get("/qr-codes", response_model=List[Dict])
async def get_qr_codes(current_user: dict = Depends(get_current_user)):
    """Get all QR codes"""
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only Directors, Coordinators, and Principals can view QR codes")
    
    chain = current_user.get('chain')
    query = {}
    
    if current_user.get('role') not in ['director', 'coordinator']:
        query["chain"] = {"$in": [chain, "ALL"]}
    
    qr_codes = await db.qr_codes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [serialize_doc(qr) for qr in qr_codes]

@router.delete("/qr-codes/{qr_id}")
async def delete_qr_code(qr_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a QR code"""
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only Directors, Coordinators, and Principals can delete QR codes")
    
    result = await db.qr_codes.delete_one({"id": qr_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="QR code not found")
    
    return {"success": True, "message": "QR code deleted"}

@router.post("/qr-codes/verify")
async def verify_qr_code(data: Dict, current_user: dict = Depends(get_current_user)):
    """Verify a QR code is valid"""
    qr_code = data.get('qr_code', '').upper().strip()
    
    if not qr_code:
        raise HTTPException(status_code=400, detail="QR code is required")
    
    parts = qr_code.split('-')
    if len(parts) < 3 or parts[1] != 'QR':
        raise HTTPException(status_code=400, detail="Invalid QR code format")
    
    chain_prefix = parts[0]
    
    qr_record = await db.qr_codes.find_one({"qr_code": qr_code}, {"_id": 0})
    
    if qr_record:
        if qr_record.get('status') == 'inactive':
            return {"valid": False, "message": "This QR code has been deactivated"}
        
        return {
            "valid": True,
            "qr_code": qr_code,
            "school_name": qr_record.get('school_name') or qr_record.get('name'),
            "chain": qr_record.get('chain', chain_prefix),
            "location": qr_record.get('location')
        }
    
    school_names = {
        'IHEZA': 'IHEZA Education Group',
        'DUP': 'Deniz Upper Primary',
        'DLP': 'Deniz Lower Primary',
        'LALE': 'Lale Bustan Children\'s Academy',
        'OLGUN': 'Olgun Boys Secondary School'
    }
    
    if chain_prefix in school_names:
        return {
            "valid": True,
            "qr_code": qr_code,
            "school_name": school_names[chain_prefix],
            "chain": chain_prefix
        }
    
    return {"valid": False, "message": "Unknown QR code"}
