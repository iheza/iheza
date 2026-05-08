#!/usr/bin/env python3
"""
Patch to fix attendance issues in server.py
This file contains fixes that can be applied to server.py
"""

ATTENDANCE_FIXES = """
# ============ ATTENDANCE FIXES ============
# Added bulk attendance endpoint and improved get_attendance

@api_router.post("/attendance/bulk", response_model=Dict)
async def bulk_record_attendance(records: List[Dict], current_user: dict = Depends(get_current_user)):
    \"\"\"Bulk record attendance for students\"\"\"
    recorded = 0
    for record in records:
        # Ensure record has required fields
        if not all(k in record for k in ["target_id", "date", "status"]):
            continue
            
        record["id"] = record.get("id", str(uuid.uuid4()))
        record["recorded_at"] = datetime.now(timezone.utc).isoformat()
        
        # Set default target_type if not provided
        if "target_type" not in record:
            record["target_type"] = "student"
            
        # Set chain from current user if not provided
        if "chain" not in record and current_user:
            record["chain"] = current_user.get("chain", "DUP")
        
        existing = await db.attendance.find_one({
            "target_id": record["target_id"],
            "target_type": record.get("target_type", "student"),
            "date": record["date"]
        })
        
        if existing:
            await db.attendance.update_one({"id": existing["id"]}, {"$set": record})
        else:
            await db.attendance.insert_one(record)
        recorded += 1
    
    return {"success": True, "recorded": recorded}

@api_router.get("/attendance/debug", response_model=Dict)
async def debug_attendance(
    target_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    \"\"\"Debug endpoint to check attendance data\"\"\"
    query = {}
    if target_type:
        query["target_type"] = target_type
    
    # Apply chain filter if user has chain
    if current_user and current_user.get("chain"):
        query["chain"] = current_user.get("chain")
    
    total = await db.attendance.count_documents({})
    filtered = await db.attendance.count_documents(query)
    
    # Get sample records
    sample = await db.attendance.find(query, {"_id": 0}).limit(10).to_list(10)
    
    # Get distinct chains in data
    chains = await db.attendance.distinct("chain", query if query else {})
    
    return {
        "total_records": total,
        "filtered_records": filtered,
        "query": query,
        "sample": [serialize_doc(r) for r in sample],
        "chains_in_data": chains,
        "current_user": current_user
   }

# Enhanced get_attendance with better error handling and logging
@api_router.get("/attendance", response_model=List[Dict])
async def get_attendance(
    target_type: Optional[str] = None,
    date: Optional[str] = None,
    month: Optional[str] = None,
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    \"\"\"Get attendance records with improved filtering\"\"\"
    logger.info(f"get_attendance called: target_type={target_type}, date={date}, month={month}, chain={chain}, user={current_user}")
    
    query = {}
    
    # Apply chain filter
    if current_user and current_user.get("chain"):
        query["chain"] = current_user.get("chain")
    elif chain:
        query["chain"] = chain
    
    # Apply target_type filter
    if target_type:
        # Handle case-insensitive matching
        query["target_type"] = {"$regex": f"^{target_type}$", "$options": "i"}
    
    # Apply date filter
    if date:
        query["date"] = date
    elif month:
        # Filter by month using regex (e.g., "2025-04" matches "2025-04-01", "2025-04-15", etc.)
        query["date"] = {"$regex": f"^{month}"}
    
    logger.info(f"Attendance query: {query}")
    
    try:
        records = await db.attendance.find(query, {"_id": 0}).to_list(5000)
        logger.info(f"Found {len(records)} attendance records")
        return [serialize_doc(r) for r in records]
    except Exception as e:
        logger.error(f"Error fetching attendance: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
# ============ END ATTENDANCE FIXES ============
"""

# Instructions for applying the fix:
print("""
To fix attendance issues in server.py:

1. Add the bulk attendance endpoint
2. Add debug endpoint for troubleshooting
3. Enhance get_attendance with better error handling and month filtering

Copy the code above and add it to server.py after the existing attendance routes.

Alternatively, you can run server_new.py which already includes the modular attendance routes.
""")