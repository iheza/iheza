"""
Timetable management routes for IHEZA School Management System
- GET /timetable: Retrieve the saved timetable (view-only for all authenticated users)
- POST /timetable: Save/update the timetable (only Academic & Principal can edit)
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import uuid

from database import db
from dependencies import get_current_user, serialize_doc

router = APIRouter(tags=["Timetable"])

# Roles allowed to edit the timetable
EDIT_ROLES = ['academic', 'principal']

# Default timetable data (Deniz Primary 2026)
DEFAULT_ROWS = [
    # ─── MONDAY ──────────────────────────────────────────────
    { "day": "Monday", "cls": "Grade 4", "stream": "A", "s1": "SCI & TECH 18", "s2": "SOCIAL 18", "s3": "", "s4": "MATH’S 08", "extra": "ENG 17" },
    { "day": "Monday", "cls": "Grade 4", "stream": "B", "s1": "ENG 17", "s2": "KISW 09", "s3": "", "s4": "MATH’S 15", "extra": "SOCIAL 18" },
    { "day": "Monday", "cls": "Grade 5", "stream": "A&B", "s1": "ENG 03", "s2": "REL 13", "s3": "", "s4": "SOCIAL 17", "extra": "MATH’S 15" },
    { "day": "Monday", "cls": "Grade 6", "stream": "A&B", "s1": "CAS 09", "s2": "ARA 16", "s3": "", "s4": "REL 16", "extra": "MATH’S 08" },
    { "day": "Monday", "cls": "Grade 7", "stream": "A", "s1": "ARA 16", "s2": "SCI & TECH 15", "s3": "", "s4": "KISW 18", "extra": "CAS 09" },
    { "day": "Monday", "cls": "", "stream": "", "s1": "", "s2": "", "s3": "☕ Recess", "s4": "", "extra": "", "isRecess": True },

    # ─── TUESDAY ─────────────────────────────────────────────
    { "day": "Tuesday", "cls": "Grade 4", "stream": "A", "s1": "KISW 09", "s2": "MATH’S 8", "s3": "", "s4": "ARA 16", "extra": "REL 16" },
    { "day": "Tuesday", "cls": "Grade 4", "stream": "B", "s1": "MATH’S 15", "s2": "ARA 13", "s3": "", "s4": "CAS 03", "extra": "REL 13" },
    { "day": "Tuesday", "cls": "Grade 5", "stream": "A&B", "s1": "KISW 18", "s2": "ENG 03", "s3": "", "s4": "SOCIAL 17", "extra": "CAS 09" },
    { "day": "Tuesday", "cls": "Grade 6", "stream": "A&B", "s1": "ARA 16", "s2": "KISW 18", "s3": "", "s4": "MATH’S 08", "extra": "ENG 17" },
    { "day": "Tuesday", "cls": "Grade 7", "stream": "A", "s1": "ARA 16", "s2": "KISW 18", "s3": "", "s4": "MATH’S 08", "extra": "ENG 17" },
    { "day": "Tuesday", "cls": "", "stream": "", "s1": "", "s2": "", "s3": "☕ Recess", "s4": "", "extra": "", "isRecess": True },

    # ─── WEDNESDAY ───────────────────────────────────────────
    { "day": "Wednesday", "cls": "Grade 4", "stream": "A", "s1": "MATH’S 08", "s2": "SOCIAL 17", "s3": "", "s4": "REL 13", "extra": "ENG 03" },
    { "day": "Wednesday", "cls": "Grade 4", "stream": "B", "s1": "SCI & TECH 18", "s2": "ENG 17", "s3": "", "s4": "REL 16", "extra": "KISW 09" },
    { "day": "Wednesday", "cls": "Grade 5", "stream": "A&B", "s1": "REL 13", "s2": "SCI & TECH 18", "s3": "", "s4": "ARA 13", "extra": "MATH’S 15" },
    { "day": "Wednesday", "cls": "Grade 6", "stream": "A&B", "s1": "MATH’S 15", "s2": "SCI & TECH 03", "s3": "", "s4": "CAS 09", "extra": "ARA 13" },
    { "day": "Wednesday", "cls": "Grade 7", "stream": "A", "s1": "ENG 03", "s2": "ARA 16", "s3": "", "s4": "SCI & TECH 15", "extra": "SOCIAL 17" },
    { "day": "Wednesday", "cls": "", "stream": "", "s1": "", "s2": "", "s3": "☕ Recess", "s4": "", "extra": "", "isRecess": True },

    # ─── THURSDAY ────────────────────────────────────────────
    { "day": "Thursday", "cls": "Grade 4", "stream": "A&B", "s1": "ENG 03", "s2": "ARA 16", "s3": "", "s4": "SCI & TECH 15", "extra": "SOCIAL 17" },
    { "day": "Thursday", "cls": "Grade 5", "stream": "A&B", "s1": "ENG 07", "s2": "ARA 16", "s3": "", "s4": "SOCIAL 17", "extra": "MATH’S 08" },
    { "day": "Thursday", "cls": "Grade 6", "stream": "A&B", "s1": "SCI & TECH 15", "s2": "ENG 17", "s3": "", "s4": "REL 16", "extra": "SOCIAL 17" },
    { "day": "Thursday", "cls": "Grade 7", "stream": "A", "s1": "KISW 18", "s2": "MATH’S 08", "s3": "", "s4": "SCI & TECH 15", "extra": "CAS 09" },
    { "day": "Thursday", "cls": "", "stream": "", "s1": "", "s2": "", "s3": "☕ Recess", "s4": "", "extra": "", "isRecess": True },

    # ─── FRIDAY ──────────────────────────────────────────────
    { "day": "Friday", "cls": "Grade 4", "stream": "A", "s1": "Turkish language Sh. Khatour", "s2": "Reading 18", "s3": "ORIGAMI PROGRAM 09, 15 & 18", "s4": "Madrasa", "extra": "" },
    { "day": "Friday", "cls": "Grade 4", "stream": "B", "s1": "", "s2": "Reading 07", "s3": "ORIGAMI PROGRAM 09, 15 & 18", "s4": "Madrasa", "extra": "" },
    { "day": "Friday", "cls": "Grade 5", "stream": "A&B", "s1": "Turkish language Sh. Khatour", "s2": "Reading 17", "s3": "ORIGAMI PROGRAM 09, 15 & 18", "s4": "Madrasa", "extra": "" },
    { "day": "Friday", "cls": "Grade 6", "stream": "A&B", "s1": "Henna program (girls) 09", "s2": "Reading 15", "s3": "KISW 18", "s4": "FINE ART PROGRAM 17 / COMPUTER PROGRAM", "extra": "" },
    { "day": "Friday", "cls": "Grade 7", "stream": "A", "s1": "Henna program (girls) 09", "s2": "Reading 16", "s3": "REL 13", "s4": "", "extra": "" },
    { "day": "Friday", "cls": "", "stream": "", "s1": "", "s2": "", "s3": "", "s4": "", "extra": "", "isRecess": True, "isFridayEnd": True },
]


@router.get("/timetable")
async def get_timetable(current_user: dict = Depends(get_current_user)):
    """Retrieve the saved timetable. Any authenticated user can view."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Look for the saved timetable (single document in the collection)
    saved = await db.timetables.find_one({"key": "default"}, {"_id": 0})
    if saved and saved.get("rows"):
        return {"rows": saved["rows"], "updated_at": saved.get("updated_at")}

    # No saved timetable yet — return the default data
    return {"rows": DEFAULT_ROWS, "updated_at": None}


@router.post("/timetable")
async def save_timetable(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    """Save/update the timetable. Only Academic & Principal can edit."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    role = current_user.get('role', '').lower()
    if role not in EDIT_ROLES:
        raise HTTPException(status_code=403, detail="Only Academic & Principal can edit the timetable")

    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="Invalid timetable data: 'rows' must be a list")

    now = datetime.now(timezone.utc).isoformat()

    # Upsert the timetable document
    result = await db.timetables.update_one(
        {"key": "default"},
        {
            "$set": {
                "rows": rows,
                "updated_at": now,
                "updated_by": current_user.get("sub") or current_user.get("access_code") or "unknown",
            }
        },
        upsert=True,
    )

    return {
        "success": True,
        "message": "Timetable saved successfully",
        "updated_at": now,
    }
