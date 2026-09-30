from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Request, Response
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
import asyncio
import json
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from pywebpush import webpush, WebPushException



# Import modular routes
from routes.users import router as users_router

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

# ============ MODULAR ROUTES ============
# The following routes have been extracted to /app/backend/routes/ for better maintainability:
# - routes/auth.py - Authentication
# - routes/users.py - User & Staff management
# - routes/students.py - Student management
# - routes/classes.py - Classes & Subjects
# - routes/attendance.py - Attendance & QR codes
# 
# Shared utilities in:
# - database.py - MongoDB connection
# - dependencies.py - Models, validators, helpers
#
# These can be incrementally imported and enabled as needed.
# For now, the existing routes below remain active for stability.
# ============================================

# Create the main app
app = FastAPI(title="IHEZA School Management API", version="2.0.0")

# Create routers
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ CONSTANTS ============

# Valid school chain prefixes
SCHOOL_CHAINS = {
    'IHEZA': {'name': 'IHEZA Education Group', 'type': 'headquarters'},
    'DUP': {'name': 'Deniz Upper Primary', 'type': 'school'},
    'DLP': {'name': 'Deniz Lower Primary', 'type': 'school'},
    'LALE': {'name': 'Lale Bustan Children\'s Academy', 'type': 'school'},
    'OLGUN': {'name': 'Olgun Boys Secondary School', 'type': 'school'},
}

SCHOOL_PREFIXES = ['DUP', 'DLP', 'LALE', 'OLGUN']
HQ_PREFIXES = ['IHEZA']
ALL_PREFIXES = HQ_PREFIXES + SCHOOL_PREFIXES

# Role definitions
ROLES = {
    'director': {'prefix': 'IHEZA', 'can_register': ['coordinator', 'principal'], 'portal': 'director'},
    'coordinator': {'prefix': 'IHEZA', 'can_register': [], 'portal': 'coordinator'},
    'principal': {'prefix': 'school', 'can_register': ['academic', 'teacher', 'secretary', 'section_leader', 'student'], 'portal': 'principal'},
    'academic': {'prefix': 'school', 'can_register': ['student'], 'portal': 'academic'},
    'teacher': {'prefix': 'school', 'can_register': ['student'], 'portal': 'teacher'},
    'secretary': {'prefix': 'school', 'can_register': ['student'], 'portal': 'secretary'},
    'section_leader': {'prefix': 'school', 'can_register': ['student'], 'portal': 'sectionleader'},
    'student': {'prefix': 'school', 'can_register': [], 'portal': 'student'},
}

STAFF_ROLES = ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader']

# ============ VALIDATION HELPERS ============

def validate_staff_access_code(access_code: str) -> Dict[str, Any]:
    """
    Validate staff access code format: INITIAL/ROLE/NUMBER/YEAR
    Examples: IHEZA/DIRECTOR/001/2025, DUP/TEACHER/0001/2025
    """
    pattern = r'^([A-Z]+)/([A-Z-]+)/(\d{3,4})/(\d{4})$'
    match = re.match(pattern, access_code.upper())
    
    if not match:
        return {'valid': False, 'error': 'Invalid format. Expected: PREFIX/ROLE/NUMBER/YEAR'}
    
    prefix, role, number, year = match.groups()
    role_normalized = role.lower().replace('-', '_')
    
    # Validate prefix - allow any chain prefix (BACA, etc.)
    # if prefix not in ALL_PREFIXES:
    #     return {'valid': False, 'error': f'Invalid prefix. Must be one of: {", ".join(ALL_PREFIXES)}'}
    
    # Validate role
    role_mapping = {
        'director': 'director',
        'coordinator': 'coordinator',
        'principal': 'principal',
        'teacher': 'teacher',
        'academic': 'academic',
        'section-leader': 'section_leader',
        'section_leader': 'section_leader',
        'secretary': 'secretary',
    }
    
    if role.lower().replace('-', '_') not in role_mapping and role.lower().replace('_', '-') not in [k.replace('_', '-') for k in role_mapping.keys()]:
        return {'valid': False, 'error': f'Invalid role: {role}'}
    
    normalized_role = role_mapping.get(role.lower().replace('-', '_'), role.lower().replace('-', '_'))
    
    # Validate prefix-role combination
    if normalized_role in ['director', 'coordinator'] and prefix != 'IHEZA':
        return {'valid': False, 'error': f'{role} must use IHEZA prefix'}
    
    if normalized_role not in ['director', 'coordinator'] and prefix == 'IHEZA':
        return {'valid': False, 'error': f'{role} must use school prefix (DUP, DLP, LALE, OLGUN)'}
    
    return {
        'valid': True,
        'prefix': prefix,
        'role': normalized_role,
        'number': number,
        'year': year,
        'chain': prefix
    }

def validate_student_admission_number(admission_no: str) -> Dict[str, Any]:
    """
    Validate student admission number format: INITIAL/STUXXXX/YEAR
    Examples: DUP/STU0001/2025, LALE/STU0100/2025
    """
    pattern = r'^([A-Z]+)/STU(\d{4})/(\d{4})$'
    match = re.match(pattern, admission_no.upper())
    
    if not match:
        return {'valid': False, 'error': 'Invalid format. Expected: PREFIX/STUXXXX/YEAR (e.g., DUP/STU0001/2025)'}
    
    prefix, student_number, year = match.groups()
    
    # Validate prefix - allow any chain prefix (BACA, etc.)
    # Students can't be in IHEZA, only in schools
    # if prefix not in SCHOOL_PREFIXES:
    #     return {'valid': False, 'error': f'Invalid school prefix. Must be one of: {", ".join(SCHOOL_PREFIXES)}'}
    
    return {
        'valid': True,
        'prefix': prefix,
        'student_number': student_number,
        'year': year,
        'chain': prefix
    }

def generate_staff_access_code(prefix: str, role: str, year: int = None) -> str:
    """Generate a new staff access code"""
    if year is None:
        year = datetime.now().year
    role_upper = role.upper().replace('_', '-')
    # This would need to query DB for next number, simplified here
    return f"{prefix}/{role_upper}/001/{year}"

def generate_student_admission_number(prefix: str, year: int = None) -> str:
    """Generate a new student admission number"""
    if year is None:
        year = datetime.now().year
    return f"{prefix}/STU0001/{year}"

# ============ MODELS ============

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    access_code: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    status: str = "active"
    chain: Optional[str] = None
    metadata: Optional[Dict] = None  # Additional metadata like teacher, subject, class

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    admission_no: str
    first_name: str
    last_name: str
    gender: str  # MALE, FEMALE, OTHER
    date_of_birth: Optional[str] = None
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    admission_date: Optional[str] = None
    status: str = "active"  # active, graduated, suspended, transferred
    chain: Optional[str] = None
    metadata: Optional[Dict] = None  # Additional metadata like teacher, subject, class
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None

class StudentCreate(StudentBase):
    password: str

class LoginRequest(BaseModel):
    accessCode: str
    password: str
    portal: str

class LoginResponse(BaseModel):
    success: bool
    user: Dict[str, Any]
    portal: str
    sessionToken: str
    expiresAt: str

class ClassBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    level: str
    section: Optional[str] = None
    chain: str
    teacher_id: Optional[str] = None
    capacity: int = 40

class Class(ClassBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubjectBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    code: str
    chain: str
    class_id: Optional[str] = None
    teacher_id: Optional[str] = None
    description: Optional[str] = None

class Subject(SubjectBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    target_type: str  # 'staff' or 'student'
    target_id: str
    chain: str
    date: str
    status: str  # present, absent, late, excused
    check_in_time: Optional[str] = None
    recorded_by: str
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GradeRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    subject_id: str
    chain: str
    term: str
    score: float
    grade: str
    remarks: Optional[str] = None
    recorded_by: str
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FeeRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    chain: str
    amount: float
    fee_type: str
    status: str = "pending"
    due_date: Optional[str] = None
    paid_date: Optional[str] = None
    paid_amount: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ FEE STRUCTURE MODEL ============

class FeeStructure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Tuition Fee", "Transport Fee", "Uniform Fee"
    description: Optional[str] = None
    amount: float
    chain: str
    class_name: Optional[str] = None  # Optional - can apply to specific class
    mandatory: bool = True
    status: str = "active"  # active, inactive
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    fee_structure_id: Optional[str] = None
    fee_type: Optional[str] = None  # full_day, half_day, uniform, admission, custom
    amount: float
    payment_method: str = "cash"  # cash, bank, mobile
    reference_no: Optional[str] = None
    received_by: Optional[str] = None
    chain: Optional[str] = None
    metadata: Optional[Dict] = None  # Additional metadata like teacher, subject, class
    notes: Optional[str] = None
    uniform_fee_details: Optional[str] = None
    admission_fee_details: Optional[str] = None
    receipt_image: Optional[str] = None  # Base64 encoded receipt image
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ REPORT CARD MODEL ============

class ReportCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    term: str
    academic_year: str
    chain: str
    # Behavior marks (scale 1-5)
    neatness: int = 3
    cooperation: int = 3
    responsibility: int = 3
    punctuality: int = 3
    discipline: int = 3
    # Comments
    teacher_comment: Optional[str] = None
    principal_comment: Optional[str] = None
    # Position
    position: Optional[int] = None
    total_students: Optional[int] = None
    # Status
    status: str = "draft"  # draft, sent
    sent_at: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ ANNOUNCEMENT MODEL ============

class Announcement(BaseModel):
    """Announcements created by Secretary, visible to all portals"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    announcement_type: str = "general"  # general, urgent, event, academic, financial
    target_audience: List[str] = []  # Empty means all, or specific roles/chains
    chain: str
    priority: str = "normal"  # low, normal, high
    attachments: List[str] = []
    created_by: str
    created_by_name: Optional[str] = None
    status: str = "published"  # draft, published, archived
    expires_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ TASK ASSIGNMENT MODELS ============

class StaffTask(BaseModel):
    """Tasks assigned by Principal to Staff"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    assigned_to: str  # Staff user ID
    assigned_to_name: Optional[str] = None
    assigned_to_role: Optional[str] = None
    assigned_by: str  # Principal user ID
    assigned_by_name: Optional[str] = None
    chain: str
    priority: str = "medium"  # low, medium, high, urgent
    due_date: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed, overdue
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentTask(BaseModel):
    """Tasks assigned by Teacher to Students (Homework, Classwork, Packages, Tests)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    task_type: str  # homework, classwork, package, test
    class_name: str
    assigned_to: List[str] = []  # List of student IDs (empty means entire class)
    assigned_by: str  # Teacher user ID
    assigned_by_name: Optional[str] = None
    chain: str
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    due_date: Optional[str] = None
    attachments: List[Any] = []  # URLs, file references, or base64 data URIs
    status: str = "active"  # active, archived
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentTaskCompletion(BaseModel):
    """Track student task completion"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    student_id: str
    status: str = "pending"  # pending, submitted, completed, late
    submitted_at: Optional[str] = None
    completed_at: Optional[str] = None
    marked_by: Optional[str] = None  # Teacher who marked completion
    score: Optional[float] = None
    feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ DOCUMENTS MODEL ============

class DocumentRecord(BaseModel):
    """Generic document record for the Documents page"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # MIME type
    size: int
    data: str  # base64 encoded data
    source: str = "upload"  # "upload", "lesson_plan", "scheme_of_work", etc.
    uploadedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    uploaded_by: Optional[str] = None
    chain: Optional[str] = None
    metadata: Optional[Dict] = None  # Additional metadata like teacher, subject, class

# ============ DOCUMENTS API ENDPOINTS ============

@api_router.post("/documents", response_model=Dict)
async def save_document(doc: DocumentRecord, current_user: dict = Depends(get_current_user)):
    """Save a document to the database (from lesson plan, upload, etc.)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    doc_doc = doc.model_dump()
    doc_doc["uploaded_by"] = current_user.get("id")
    doc_doc["chain"] = current_user.get("chain")
    
    await db.documents.insert_one(doc_doc)
    doc_doc.pop('_id', None)
    return doc_doc

@api_router.post("/documents/save", response_model=Dict)
async def save_document_generic(payload: Dict, current_user: dict = Depends(get_current_user)):
    """Save a generic document/data to the database (from scheme of work, etc.)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    doc_doc = {
        "id": str(uuid.uuid4()),
        "name": payload.get("name", f"{payload.get('type', 'document')}_{datetime.now(timezone.utc).isoformat()}"),
        "type": payload.get("type", "application/json"),
        "size": payload.get("size", 0),
        "data": payload.get("data", ""),
        "source": payload.get("source", payload.get("type", "upload")),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user.get("id"),
        "chain": current_user.get("chain"),
        "metadata": payload.get("metadata", {})
    }
    
    await db.documents.insert_one(doc_doc)
    doc_doc.pop('_id', None)
    return doc_doc

@api_router.get("/documents", response_model=List[Dict])
async def get_documents(
    source: Optional[str] = None,
    page: int = 1,
    page_size: int = 100,
    include_data: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get documents for the current user's chain (paginated).

    The base64 ``data`` field can be 1-5 MB per document, so it is PROJECTED
    OUT of the list response by default to keep the payload small and avoid
    OOM/520 errors. A lightweight ``has_data`` boolean is returned instead.
    Pass ``include_data=true`` to opt back in, or fetch a single document via
    ``GET /documents/{doc_id}`` to retrieve the full blob on demand.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Clamp pagination to sane bounds
    page = max(1, page)
    page_size = max(1, min(page_size, 500))
    skip = (page - 1) * page_size

    query = get_chain_filter(current_user) if current_user else {}
    if source:
        query["source"] = source

    # Project out the heavy base64 blob unless explicitly requested
    projection = {"_id": 0}
    if not include_data:
        projection["data"] = 0

    cursor = (
        db.documents.find(query, projection)
        .sort("uploadedAt", -1)
        .skip(skip)
        .limit(page_size)
    )
    docs = await cursor.to_list(page_size)

    results = []
    for d in docs:
        serialized = serialize_doc(d)
        if not include_data:
            # Signal whether a blob exists without shipping it
            serialized["has_data"] = bool(d.get("data"))
        results.append(serialized)
    return results

@api_router.get("/documents/{doc_id}", response_model=Dict)
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single document by ID, including its full base64 ``data`` blob.

    Used by the frontend to lazily fetch preview/download content that is
    intentionally omitted from the paginated list endpoint.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return serialize_doc(doc)


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a document"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = await db.documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True, "message": "Document deleted"}

# ============ DOCUMENTS ANALYTICS ENDPOINTS ============

@api_router.get("/documents/analytics/summary")
async def get_documents_analytics_summary(current_user: dict = Depends(get_current_user)):
    """Get summary analytics for documents"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    query = get_chain_filter(current_user) if current_user else {}
    
    now = datetime.now(timezone.utc)
    current_year = now.year
    current_month = now.month
    
    # Get start of current week (Monday)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get current term boundaries (approximate)
    def get_term_bounds(date):
        m = date.month
        if m >= 1 and m <= 4:
            return (datetime(date.year, 1, 1, tzinfo=timezone.utc), datetime(date.year, 4, 30, 23, 59, 59, tzinfo=timezone.utc))
        elif m >= 5 and m <= 8:
            return (datetime(date.year, 5, 1, tzinfo=timezone.utc), datetime(date.year, 8, 31, 23, 59, 59, tzinfo=timezone.utc))
        else:
            return (datetime(date.year, 9, 1, tzinfo=timezone.utc), datetime(date.year, 12, 31, 23, 59, 59, tzinfo=timezone.utc))
    
    term_start, term_end = get_term_bounds(now)
    
    # Counts
    total = await db.documents.count_documents(query)
    
    query_week = {**query, "uploadedAt": {"$gte": week_start.isoformat()}}
    this_week = await db.documents.count_documents(query_week)
    
    query_month = {**query, "uploadedAt": {"$gte": datetime(current_year, current_month, 1, tzinfo=timezone.utc).isoformat()}}
    this_month = await db.documents.count_documents(query_month)
    
    query_term = {**query, "uploadedAt": {"$gte": term_start.isoformat(), "$lte": term_end.isoformat()}}
    this_term = await db.documents.count_documents(query_term)
    
    query_year = {**query, "uploadedAt": {"$gte": datetime(current_year, 1, 1, tzinfo=timezone.utc).isoformat()}}
    this_year = await db.documents.count_documents(query_year)
    
    # Source breakdown
    pipeline_source = [
        {"$match": query},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    source_breakdown = await db.documents.aggregate(pipeline_source).to_list(50)
    
    # Monthly breakdown for current year
    pipeline_monthly = [
        {"$match": {**query, "uploadedAt": {"$gte": datetime(current_year, 1, 1, tzinfo=timezone.utc).isoformat()}}},
        {"$group": {"_id": {"$substr": ["$uploadedAt", 5, 2]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    monthly_breakdown = await db.documents.aggregate(pipeline_monthly).to_list(12)
    
    return {
        "total": total,
        "this_week": this_week,
        "this_month": this_month,
        "this_term": this_term,
        "this_year": this_year,
        "source_breakdown": [{"source": s["_id"], "count": s["count"]} for s in source_breakdown],
        "monthly_breakdown": [{"month": int(m["_id"]), "count": m["count"]} for m in monthly_breakdown]
    }

@api_router.get("/documents/analytics/by-teacher")
async def get_documents_analytics_by_teacher(current_user: dict = Depends(get_current_user)):
    """Get document counts grouped by teacher"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    query = get_chain_filter(current_user) if current_user else {}
    
    # Try to group by uploaded_by first
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$uploaded_by", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_teacher = await db.documents.aggregate(pipeline).to_list(100)
    
    return {
        "by_teacher": [{"teacher_id": t["_id"], "count": t["count"]} for t in by_teacher]
    }

@api_router.get("/documents/analytics/projects")
async def get_documents_analytics_projects(current_user: dict = Depends(get_current_user)):
    """Get analytics specifically for uploaded projects"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    query = get_chain_filter(current_user) if current_user else {}
    query["source"] = "upload"
    
    total_projects = await db.documents.count_documents(query)
    
    # By teacher
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$uploaded_by", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_teacher = await db.documents.aggregate(pipeline).to_list(100)
    
    return {
        "total_projects": total_projects,
        "by_teacher": [{"teacher_id": t["_id"], "count": t["count"]} for t in by_teacher]
    }

# ============ EXAMINATION REPORTS ENDPOINTS ============

@api_router.get("/examination-reports")
async def get_examination_reports(
    chain: Optional[str] = None,
    page: int = 1,
    page_size: int = 100,
    include_data: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get examination reports for the current user's chain (paginated).

    The list view only needs lightweight metadata (year, term, examDate,
    preparedBy, etc.) for filters and the saved-reports list. Heavy base64
    blobs such as ``schoolLogo`` and any embedded ``data``/``htmlContent``
    fields are PROJECTED OUT by default to keep the payload small and avoid
    OOM/520 errors. Pass ``include_data=true`` to opt back in, or fetch a
    single report via ``GET /examination-reports/{report_id}`` for the full
    document.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Clamp pagination to sane bounds
    page = max(1, page)
    page_size = max(1, min(page_size, 500))
    skip = (page - 1) * page_size

    query = {}
    if chain:
        query["chain"] = chain
    else:
        query = get_chain_filter(current_user)

    # Project out heavy base64 blobs unless explicitly requested
    projection = {"_id": 0}
    if not include_data:
        projection["schoolLogo"] = 0
        projection["data"] = 0
        projection["htmlContent"] = 0

    cursor = (
        db.examination_reports.find(query, projection)
        .sort("createdAt", -1)
        .skip(skip)
        .limit(page_size)
    )
    reports = await cursor.to_list(page_size)
    return [serialize_doc(r) for r in reports]


@api_router.get("/examination-reports/{report_id}")
async def get_examination_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single examination report by ID"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    report = await db.examination_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Examination report not found")
    return report

@api_router.post("/examination-reports")
async def create_examination_report(payload: Dict, current_user: dict = Depends(get_current_user)):
    """Create a new examination report"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    report = {
        "id": str(uuid.uuid4()),
        "year": payload.get("year"),
        "term": payload.get("term"),
        "termMonth": payload.get("termMonth"),
        "examDate": payload.get("examDate"),
        "preparedBy": payload.get("preparedBy"),
        "preparedByRole": payload.get("preparedByRole"),
        "schoolName": payload.get("schoolName"),
        "schoolLogo": payload.get("schoolLogo"),
        "coverPageNote": payload.get("coverPageNote"),
        "contents": payload.get("contents"),
        "introduction": payload.get("introduction"),
        "gradeScale": payload.get("gradeScale"),
        "summaryNote": payload.get("summaryNote"),
        "summaryClasses": payload.get("summaryClasses"),
        "findingsANote": payload.get("findingsANote"),
        "subjectAveragesGrade5A": payload.get("subjectAveragesGrade5A"),
        "subjectAveragesGrade5B": payload.get("subjectAveragesGrade5B"),
        "subjectAveragesGrade6": payload.get("subjectAveragesGrade6"),
        "findingsBNote": payload.get("findingsBNote"),
        "classAverages": payload.get("classAverages"),
        "schoolPerformanceSubjectWise": payload.get("schoolPerformanceSubjectWise"),
        "mostPassedSubject": payload.get("mostPassedSubject"),
        "mostFailedSubject": payload.get("mostFailedSubject"),
        "overallSchoolPerformance": payload.get("overallSchoolPerformance"),
        "failedQuestionsGrade5AB": payload.get("failedQuestionsGrade5AB"),
        "failedQuestionsGrade6": payload.get("failedQuestionsGrade6"),
        "examErrors": payload.get("examErrors"),
        "markingSchemeErrors": payload.get("markingSchemeErrors"),
        "generalError": payload.get("generalError"),
        "conclusion": payload.get("conclusion"),
        "recommendations": payload.get("recommendations"),
        "createdBy": payload.get("createdBy") or current_user.get("id"),
        "chain": payload.get("chain") or current_user.get("chain"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.examination_reports.insert_one(report)
    report.pop("_id", None)
    return report

@api_router.put("/examination-reports/{report_id}")
async def update_examination_report(report_id: str, payload: Dict, current_user: dict = Depends(get_current_user)):
    """Update an existing examination report"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    existing = await db.examination_reports.find_one({"id": report_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Examination report not found")
    
    update_data = {k: v for k, v in payload.items() if k not in ("id", "_id", "createdAt")}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.examination_reports.update_one({"id": report_id}, {"$set": update_data})
    updated = await db.examination_reports.find_one({"id": report_id}, {"_id": 0})
    return updated

@api_router.post("/examination-reports/generate")
async def generate_examination_report_section(payload: Dict, current_user: dict = Depends(get_current_user)):
    """Generate data for a specific section of the examination report"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    section = payload.get("section", "")
    year = payload.get("year", str(datetime.now().year))
    term = payload.get("term", "1")
    chain = payload.get("chain") or current_user.get("chain")
    
    # Generate sample data based on section
    sample_data = {
        "introduction": f"This report is designed to outline general Academic pupils' performance in {term}{'st' if term == '1' else 'nd' if term == '2' else 'rd' if term == '3' else 'th'} - Term Examination that was done in {year}.",
        "gradeScale": "A – 81 – 100\nB - 61 – 80\nC - 41 – 60\nD - 21 – 40\nF - 0 – 20",
        "summaryClasses": "CLASSES\tBOYS\tGIRLS\tTOTAL\nGRADE 5-A\t6\t8\t14\nGRADE 5-B\t5\t9\t14\nGRADE 6\t6\t8\t14\nTOTAL = 03 CLASSES\t17\t25\t42",
        "subjectAveragesGrade5A": "NO.\tSUBJECTS\tGRADE 5-A\n1.\tMATHEMATICS\t62 – B – 8\n2.\tENGLISH\t78 – B – 1\n3.\tSCIENCE & TECHNOLOGY\t75 – B – 5\n4.\tKISWAHILI\t77 – B – 3\n5.\tCREATIVE ART & SPORTS\t74.5 – B – 6\n6.\tRELIGION\t75.3 – B – 4\n7.\tARABIC\t69.5 – B – 7\n8.\tSOCIAL SCIENCE\t77.2 – B – 2",
        "subjectAveragesGrade5B": "NO.\tSUBJECTS\tGRADE 5-B\n1.\tMATHEMATICS\t59.5 – C – 8\n2.\tENGLISH\t81 – A – 1\n3.\tSCIENCE & TECHNOLOGY\t75.7 – B – 3\n4.\tKISWAHILI\t74 – B – 4\n5.\tCREATIVE ART & SPORTS\t73 – B – 6\n6.\tRELIGION\t76 – B – 2\n7.\tARABIC\t72 – B – 7\n8.\tSOCIAL SCIENCE\t73.7 – B – 5",
        "subjectAveragesGrade6": "NO.\tSUBJECTS\tGRADE 6\n1.\tMATHEMATICS\t58 – C – 8\n2.\tENGLISH\t87– A – 1\n3.\tSCIENCE & TECHNOLOGY\t68.5 – B – 6\n4.\tKISWAHILI\t73.2 – B – 4\n5.\tSOCIAL SCIENCE\t74.1 – B – 3\n6.\tARABIC\t72.2 – B – 5\n7.\tRELIGION\t80 – B – 2\n8.\tCREATIVE ART & SPORTS\t67 – B – 7",
        "classAverages": "NO.\tCLASSES\tAV - GR - POS\n1.\t5-A\t74 – B – 1\n2.\t5-B\t73 – B – 2\n3.\t6\t64 – B – 3",
        "schoolPerformanceSubjectWise": "NO.\tSUBJECTS\tAVERAGE\tGRADE\tPOSITION\n1.\tMATHEMATICS\t60\tC\t8\n2.\tENGLISH\t82\tA\t1\n3.\tSCIENCE & TECHNOLOGY\t73\tB\t5\n4.\tKISWAHILI\t74.7\tB\t4\n5.\tSOCIAL SCIENCE\t75\tB\t3\n6.\tARABIC\t71.2\tB\t7\n7.\tRELIGION\t77.1\tB\t2\n8.\tCREATIVE ART & SPORTS\t71.5\tB\t6",
    }
    
    content = sample_data.get(section, f"Sample data for {section} - Term {term}, {year}")
    
    return {"success": True, "content": content}

@api_router.post("/examination-reports/generate-data")
async def generate_examination_report_all_data(
    chain: Optional[str] = None,
    term: Optional[str] = None,
    year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Generate all examination report data from the system (grades, classes, students)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    chain = chain or current_user.get("chain")
    term = term or "2"
    year = year or str(datetime.now().year)
    
    # ========== FETCH REAL DATA FROM SYSTEM ==========
    
    # 1. Fetch classes for this chain
    classes_cursor = db.classes.find({"chain": chain}, {"_id": 0, "name": 1, "id": 1}).sort("name", 1)
    classes = await classes_cursor.to_list(50)
    class_names = [c.get("name", f"Class {i+1}") for i, c in enumerate(classes)]
    
    if not class_names:
        class_names = ["GRADE 5-A", "GRADE 5-B", "GRADE 6"]
    
    # 2. Fetch all students for this chain, grouped by class
    all_students = await db.students.find({"chain": chain}, {"_id": 0, "class_name": 1, "gender": 1}).to_list(2000)
    students_by_class = {}
    for s in all_students:
        cn = s.get("class_name", "")
        if cn not in students_by_class:
            students_by_class[cn] = {"boys": 0, "girls": 0, "total": 0}
        gender = s.get("gender", "").upper()
        if gender == "MALE" or gender == "M" or gender == "BOY":
            students_by_class[cn]["boys"] += 1
        elif gender == "FEMALE" or gender == "F" or gender == "GIRL":
            students_by_class[cn]["girls"] += 1
        else:
            students_by_class[cn]["girls"] += 1  # default
        students_by_class[cn]["total"] += 1
    
    # 3. Fetch all subjects for this chain
    subjects_cursor = db.subjects.find({"chain": chain}, {"_id": 0, "name": 1, "id": 1, "class_id": 1}).sort("name", 1)
    all_subjects = await subjects_cursor.to_list(100)
    subject_names = [s.get("name", "").strip().upper() for s in all_subjects if s.get("name")]
    if not subject_names:
        subject_names = ["MATHEMATICS", "ENGLISH", "SCIENCE & TECHNOLOGY", "KISWAHILI", "CREATIVE ART & SPORTS", "RELIGION", "ARABIC", "SOCIAL SCIENCE"]
    
    # 4. Fetch grades for this chain and term
    # Filter by recorded_at year if possible, otherwise just by term
    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"
    grades_query = {"chain": chain, "term": term}
    all_grades = await db.grades.find(grades_query, {"_id": 0}).to_list(2000)
    
    # Also fetch student IDs per class for grade lookups
    students_by_class_ids = {}
    for s in all_students:
        cn = s.get("class_name", "")
        sid = s.get("id", "")
        if cn not in students_by_class_ids:
            students_by_class_ids[cn] = []
        students_by_class_ids[cn].append(sid)
    
    # Build a map: subject_name -> list of scores per class
    # First, map subject_id -> subject_name
    subject_id_to_name = {s.get("id"): s.get("name", "").strip().upper() for s in all_subjects}
    
    # Group grades by subject name and class
    grades_by_subject_class = {}  # {subject_name: {class_name: [scores]}}
    for g in all_grades:
        subj_name = subject_id_to_name.get(g.get("subject_id", ""), "")
        if not subj_name:
            continue
        score = g.get("score", 0)
        if subj_name not in grades_by_subject_class:
            grades_by_subject_class[subj_name] = {}
        # Find which class this student belongs to
        student_id = g.get("student_id", "")
        student_class = ""
        for cn, sids in students_by_class_ids.items():
            if student_id in sids:
                student_class = cn
                break
        if not student_class:
            continue
        if student_class not in grades_by_subject_class[subj_name]:
            grades_by_subject_class[subj_name][student_class] = []
        grades_by_subject_class[subj_name][student_class].append(score)
    
    # Helper: compute grade from score
    def score_to_grade(score):
        if score >= 81: return "A"
        if score >= 61: return "B"
        if score >= 41: return "C"
        if score >= 21: return "D"
        return "F"
    
    # ========== BUILD SUMMARY CLASSES TABLE (REAL DATA) ==========
    summary_lines = ["CLASSES\tBOYS\tGIRLS\tTOTAL"]
    total_boys = 0
    total_girls = 0
    for cls_name in class_names:
        cls_data = students_by_class.get(cls_name, {"boys": 0, "girls": 0})
        boys = cls_data["boys"]
        girls = cls_data["girls"]
        total_boys += boys
        total_girls += girls
        summary_lines.append(f"{cls_name}\t{boys}\t{girls}\t{boys + girls}")
    total_classes = len(class_names)
    grand_total = total_boys + total_girls
    summary_lines.append(f"TOTAL = {total_classes:02d} CLASSES\t{total_boys}\t{total_girls}\t{grand_total}")
    summary_classes = "\n".join(summary_lines)
    
    # ========== BUILD SUBJECT AVERAGES PER CLASS (REAL DATA) ==========
    subject_table_fields = {}
    for i, cls_name in enumerate(class_names):
        field_key = f"subjectAverages_{i}"
        lines = ["NO.\tSUBJECTS\t" + cls_name]
        
        # Compute average for each subject in this class
        subject_avgs = []  # [(subject_name, avg_score)]
        for subj_name in subject_names:
            scores = grades_by_subject_class.get(subj_name, {}).get(cls_name, [])
            if scores:
                avg_score = sum(scores) / len(scores)
            else:
                avg_score = 0
            subject_avgs.append((subj_name, avg_score))
        
        # Sort by average descending to assign positions
        subject_avgs_sorted = sorted(subject_avgs, key=lambda x: x[1], reverse=True)
        pos_map = {}
        for pos, (subj, _) in enumerate(subject_avgs_sorted, 1):
            pos_map[subj] = pos
        
        # Build lines sorted by subject name (original order)
        for j, (subj_name, avg_score) in enumerate(subject_avgs):
            avg_rounded = round(avg_score, 1)
            grade = score_to_grade(avg_rounded)
            pos = pos_map.get(subj_name, j + 1)
            lines.append(f"{j+1}.\t{subj_name}\t{avg_rounded} – {grade} – {pos}")
        
        subject_table_fields[field_key] = "\n".join(lines)
    
    # ========== BUILD CLASS AVERAGES TABLE (REAL DATA) ==========
    class_avg_lines = ["NO.\tCLASSES\tAV - GR - POS"]
    class_avgs = []  # [(class_name, avg_score)]
    for cls_name in class_names:
        # Average of all subject averages for this class
        all_scores = []
        for subj_name in subject_names:
            scores = grades_by_subject_class.get(subj_name, {}).get(cls_name, [])
            all_scores.extend(scores)
        if all_scores:
            cls_avg = sum(all_scores) / len(all_scores)
        else:
            cls_avg = 0
        class_avgs.append((cls_name, cls_avg))
    
    # Sort by average descending for position
    class_avgs_sorted = sorted(class_avgs, key=lambda x: x[1], reverse=True)
    class_pos_map = {}
    for pos, (cn, _) in enumerate(class_avgs_sorted, 1):
        class_pos_map[cn] = pos
    
    for i, (cls_name, cls_avg) in enumerate(class_avgs):
        avg_rounded = round(cls_avg, 1)
        grade = score_to_grade(avg_rounded)
        pos = class_pos_map.get(cls_name, i + 1)
        class_avg_lines.append(f"{i+1}.\t{cls_name}\t{avg_rounded} – {grade} – {pos}")
    class_averages = "\n".join(class_avg_lines)
    
    # ========== BUILD SCHOOL PERFORMANCE SUBJECT WISE (REAL DATA) ==========
    perf_lines = ["NO.\tSUBJECTS\tAVERAGE\tGRADE\tPOSITION"]
    school_subject_avgs = []  # [(subject_name, avg_score)]
    for subj_name in subject_names:
        all_scores = []
        for cls_name in class_names:
            scores = grades_by_subject_class.get(subj_name, {}).get(cls_name, [])
            all_scores.extend(scores)
        if all_scores:
            school_avg = sum(all_scores) / len(all_scores)
        else:
            school_avg = 0
        school_subject_avgs.append((subj_name, school_avg))
    
    # Sort by average descending for position
    school_avgs_sorted = sorted(school_subject_avgs, key=lambda x: x[1], reverse=True)
    school_pos_map = {}
    for pos, (sn, _) in enumerate(school_avgs_sorted, 1):
        school_pos_map[sn] = pos
    
    for j, (subj_name, school_avg) in enumerate(school_subject_avgs):
        avg_rounded = round(school_avg, 1)
        grade = score_to_grade(avg_rounded)
        pos = school_pos_map.get(subj_name, j + 1)
        perf_lines.append(f"{j+1}.\t{subj_name}\t{avg_rounded}\t{grade}\t{pos}")
    school_performance = "\n".join(perf_lines)
    
    # ========== DETERMINE MOST PASSED/FAILED (REAL DATA) ==========
    if school_avgs_sorted:
        most_passed = school_avgs_sorted[0][0]
        most_failed = school_avgs_sorted[-1][0]
        overall_avg = sum(avg for _, avg in school_subject_avgs) / len(school_subject_avgs) if school_subject_avgs else 0
    else:
        most_passed = subject_names[1] if len(subject_names) > 1 else subject_names[0]
        most_failed = subject_names[0]
        overall_avg = 0
    
    overall_avg_rounded = round(overall_avg, 2)
    overall_grade = score_to_grade(overall_avg_rounded)
    overall_performance = f"{overall_avg_rounded}/{overall_grade}"
    
    return {
        "success": True,
        "data": {
            "summaryClasses": summary_classes,
            "subjectTableFields": subject_table_fields,
            "classNames": class_names,
            "classAverages": class_averages,
            "schoolPerformanceSubjectWise": school_performance,
            "mostPassedSubject": most_passed,
            "mostFailedSubject": most_failed,
            "overallSchoolPerformance": overall_performance,
        }
    }

# ============ ACADEMIC HUB MODELS ============

class LessonPlan(BaseModel):
    """Lesson Plan document"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    class_name: str
    topic: str
    duration: str  # e.g., "40 minutes"
    date: Optional[str] = None
    objectives: List[str] = []
    materials: List[str] = []
    introduction: Optional[str] = None
    development: Optional[str] = None
    conclusion: Optional[str] = None
    assessment: Optional[str] = None
    homework: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    chain: str
    status: str = "draft"  # draft, final
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SchemeOfWork(BaseModel):
    """Scheme of Work document"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    class_name: str
    term: str
    academic_year: str
    weeks: List[Dict[str, Any]] = []  # [{week: 1, topic: "", objectives: [], activities: [], resources: []}]
    created_by: str
    chain: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubjectEvaluation(BaseModel):
    """Subject Evaluation Form"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    class_name: str
    term: str
    evaluation_date: Optional[str] = None
    teacher_name: Optional[str] = None
    strengths: List[str] = []
    areas_for_improvement: List[str] = []
    recommendations: List[str] = []
    student_performance_summary: Optional[str] = None
    created_by: str
    chain: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Assessment(BaseModel):
    """Assessment document"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    class_name: str
    assessment_type: str  # quiz, test, exam, assignment
    duration: Optional[str] = None
    total_marks: float = 100
    instructions: Optional[str] = None
    questions: List[Dict[str, Any]] = []  # [{question: "", marks: 10, type: ""}]
    created_by: str
    chain: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict.

    Recursively handles nested datetime, ObjectId, Decimal, bytes, and other
    BSON types so the origin server never crashes on a single malformed field
    (which Cloudflare reports as a 520 error / HTTP2 protocol error).
    """
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != '_id'}
    for key, value in result.items():
        result[key] = _json_safe(value)
    return result


def get_chain_filter(user: dict) -> dict:
    """Get MongoDB filter based on user's chain access"""
    if not user:
        return {}
    
    role = user.get('role', '')
    chain = user.get('chain', '')
    
    # Directors and Coordinators can see all chains
    if role in ['director', 'coordinator']:
        return {}
    
    # Others can only see their own chain's data
    if chain:
        # Strict chain isolation: each school can ONLY see its own data
        # DLP data is ONLY visible to DLP chain users and IHEZA (directors/coordinators)
        # DUP users should NEVER see DLP data
        return {'chain': chain}
    
    return {}  # No chain filter if chain is empty

def can_register(registrar_role: str, target_role: str) -> bool:
    """Check if a role can register another role"""
    role_info = ROLES.get(registrar_role, {})
    return target_role in role_info.get('can_register', [])

# ============ WEB PUSH NOTIFICATIONS ============

# VAPID configuration loaded from .env
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_SUBJECT = os.environ.get('VAPID_SUBJECT', 'mailto:admin@iheza.online')

# Fee reminder scheduler config
TERM_MONTHS = int(os.environ.get('TERM_MONTHS', '3'))
FEE_REMINDER_MIN_PERCENT = float(os.environ.get('FEE_REMINDER_MIN_PERCENT', '20'))
FEE_REMINDER_COOLDOWN_DAYS = int(os.environ.get('FEE_REMINDER_COOLDOWN_DAYS', '7'))
FEE_REMINDER_GRACE_DAYS = int(os.environ.get('FEE_REMINDER_GRACE_DAYS', '14'))
FEE_REMINDER_INTERVAL_HOURS = int(os.environ.get('FEE_REMINDER_INTERVAL_HOURS', '24'))
# Delay before the FIRST scheduler run after startup. This prevents the
# scheduler from competing with app warm-up / first requests for memory and
# CPU, which previously caused OOM kills and Cloudflare 520s on boot.
FEE_REMINDER_STARTUP_DELAY_SECONDS = int(os.environ.get('FEE_REMINDER_STARTUP_DELAY_SECONDS', '300'))
# Path to the cross-process lock file. With multiple uvicorn workers, only the
# worker that holds this lock runs the scheduler; the others skip it entirely.
FEE_REMINDER_LOCK_FILE = os.environ.get('FEE_REMINDER_LOCK_FILE', '/tmp/fee_reminder_scheduler.lock')
# Master on/off switch for the fee reminder scheduler. Defaults to DISABLED
# ("0") so the background scheduler never competes with app warm-up for
# memory/CPU (which previously caused OOM kills and Cloudflare 520s on boot).
# Set ENABLE_FEE_SCHEDULER=1 to turn it back on.
ENABLE_FEE_SCHEDULER = os.environ.get('ENABLE_FEE_SCHEDULER', '0') == '1'


class PushSubscription(BaseModel):
    """A Web Push subscription for a user"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    chain: str
    endpoint: str
    keys: Dict[str, str]  # {p256dh, auth}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


async def send_push_notification(user_id: str, title: str, body: str, url: str = "/portal/student-portal", icon: str = "/logo192.png", badge: str = "/logo192.png"):
    """Send a Web Push notification to all subscriptions for a user.

    Returns the number of successful sends. Failed subscriptions (expired,
    invalid) are removed from the database so they don't cause repeated errors.
    """
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys not configured - skipping push notification")
        return 0

    # Find all subscriptions for this user
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    if not subs:
        return 0

    payload = {
        "title": title,
        "body": body,
        "url": url,
        "icon": icon,
        "badge": badge,
    }

    sent = 0
    for sub in subs:
        try:
            # Run the blocking webpush() call in a thread executor so it does NOT
            # block the asyncio event loop. The pywebpush library performs a
            # synchronous HTTP request to the push service (FCM/Web Push), which
            # would otherwise freeze ALL other API requests while it runs.
            await asyncio.to_thread(
                webpush,
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub.get("keys", {}),
                },
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
                ttl=86400,  # 24 hours
            )
            sent += 1
        except WebPushException as e:
            # If the subscription is gone (410) or invalid (404), remove it
            if e.response and e.response.status_code in (404, 410):
                logger.info(f"Removing expired push subscription for user {user_id}")
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
            else:
                logger.warning(f"Push notification failed for user {user_id}: {e}")
        except Exception as e:
            logger.warning(f"Push notification error for user {user_id}: {e}")

    return sent



async def send_push_to_students(student_ids: List[str], title: str, body: str, url: str = "/portal/student-portal"):
    """Send a push notification to multiple students."""
    for sid in student_ids:
        try:
            await send_push_notification(sid, title, body, url)
        except Exception as e:
            logger.warning(f"Failed to notify student {sid}: {e}")


@api_router.post("/push/subscribe")
async def subscribe_push(subscription: PushSubscription, current_user: dict = Depends(get_current_user)):
    """Save a Web Push subscription for the current user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = current_user.get("sub")
    chain = current_user.get("chain", "")

    # Remove any existing subscription with the same endpoint (avoid duplicates)
    await db.push_subscriptions.delete_many({"endpoint": subscription.endpoint})

    sub_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "chain": chain,
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.push_subscriptions.insert_one(sub_doc)

    return {"success": True, "message": "Subscribed to push notifications"}


@api_router.post("/push/unsubscribe")
async def unsubscribe_push(data: Dict, current_user: dict = Depends(get_current_user)):
    """Remove a Web Push subscription."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    endpoint = data.get("endpoint", "")
    if endpoint:
        await db.push_subscriptions.delete_many({"endpoint": endpoint})

    return {"success": True, "message": "Unsubscribed from push notifications"}


@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Return the VAPID public key for the frontend to subscribe."""
    return {"publicKey": VAPID_PUBLIC_KEY}


@api_router.post("/push/send")
async def send_push_manual(data: Dict, current_user: dict = Depends(get_current_user)):
    """Manually send a push notification to a user (for testing/admin)."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = data.get("user_id", "")
    title = data.get("title", "Notification")
    body = data.get("body", "")
    url = data.get("url", "/portal/student-portal")

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    sent = await send_push_notification(user_id, title, body, url)
    return {"success": True, "sent": sent}


# ============ FEE REMINDER SCHEDULER ============

async def run_fee_reminder_check():
    """Check all students for outstanding fees and send reminders to those
    who are behind on their expected payment schedule.

    Logic:
      - T = total fee for the term
      - M = term duration in months (TERM_MONTHS)
      - E = months elapsed since term start
      - Expected remaining = T * (1 - E/M)
      - Trigger reminder when: remaining balance > expected remaining
        AND remaining balance >= FEE_REMINDER_MIN_PERCENT% of T
        AND cooldown period has passed since last reminder

    MEMORY OPTIMIZATION:
    This function no longer loads all students, fees, and payments into
    Python memory. Instead it uses MongoDB aggregation pipelines to compute
    per-student total fees and total paid entirely inside the database, then
    streams only the (small) list of students who are actually behind. This
    keeps the scheduler's memory footprint flat regardless of how many
    students/payments exist, which prevents the OOM kills that previously
    caused Cloudflare 520s on startup.
    """
    logger.info("Running fee reminder scheduler...")
    now = datetime.now(timezone.utc)

    # Determine term start (approximate: start of current term based on month)
    month = now.month
    if month <= 4:
        term_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
    elif month <= 8:
        term_start = datetime(now.year, 5, 1, tzinfo=timezone.utc)
    else:
        term_start = datetime(now.year, 9, 1, tzinfo=timezone.utc)

    # Grace period: don't remind within the first FEE_REMINDER_GRACE_DAYS days
    days_since_start = (now - term_start).days
    if days_since_start < FEE_REMINDER_GRACE_DAYS:
        logger.info(f"Within grace period ({days_since_start} days) - skipping fee reminders")
        return

    # Months elapsed (fractional)
    months_elapsed = days_since_start / 30.0
    expected_remaining_ratio = max(0.0, 1.0 - (months_elapsed / TERM_MONTHS))

    # ---------------------------------------------------------------------
    # STEP 1: Compute total fees per student via aggregation (in the DB).
    # A student's total fee = SUM(student_fees.amount) for that student.
    # We aggregate the whole collection grouped by student_id so we never
    # pull individual fee documents into Python.
    # ---------------------------------------------------------------------
    fee_totals = {}
    try:
        fee_pipeline = [
            {"$match": {"amount": {"$gt": 0}}},
            {"$group": {"_id": "$student_id", "total": {"$sum": "$amount"}}},
        ]
        async for row in db.student_fees.aggregate(fee_pipeline):
            sid = row.get("_id")
            if sid:
                fee_totals[sid] = row.get("total", 0)
    except Exception as e:
        logger.error(f"Fee reminder: student_fees aggregation failed: {e}")

    # ---------------------------------------------------------------------
    # STEP 2: Compute total paid per student via aggregation (in the DB).
    # ---------------------------------------------------------------------
    paid_totals = {}
    try:
        paid_pipeline = [
            {"$match": {"amount": {"$gt": 0}}},
            {"$group": {"_id": "$student_id", "total": {"$sum": "$amount"}}},
        ]
        async for row in db.payments.aggregate(paid_pipeline):
            sid = row.get("_id")
            if sid:
                paid_totals[sid] = row.get("total", 0)
    except Exception as e:
        logger.error(f"Fee reminder: payments aggregation failed: {e}")

    # ---------------------------------------------------------------------
    # STEP 3: Fee-structure fallback totals per (chain, class_name).
    # Only needed for students WITHOUT a student_fees record. Aggregated in
    # the DB so we don't load every fee structure document.
    # ---------------------------------------------------------------------
    fee_structure_totals = {}
    try:
        fs_pipeline = [
            {"$match": {"status": "active"}},
            {"$group": {
                "_id": {"chain": "$chain", "class_name": {"$ifNull": ["$class_name", ""]}},
                "total": {"$sum": "$amount"},
            }},
        ]
        async for row in db.fee_structures.aggregate(fs_pipeline):
            key = row.get("_id") or {}
            chain = key.get("chain")
            cls = key.get("class_name") or ""
            if chain:
                fee_structure_totals[f"{chain}:{cls}"] = row.get("total", 0)
    except Exception as e:
        logger.error(f"Fee reminder: fee_structures aggregation failed: {e}")

    # ---------------------------------------------------------------------
    # STEP 4: Most-recent reminder per student (for cooldown), aggregated in
    # the DB so we only keep one small doc per student.
    # ---------------------------------------------------------------------
    last_reminder_map = {}
    try:
        reminder_pipeline = [
            {"$sort": {"sent_at": -1}},
            {"$group": {
                "_id": "$student_id",
                "sent_at": {"$first": "$sent_at"},
            }},
        ]
        async for row in db.fee_reminders.aggregate(reminder_pipeline):
            sid = row.get("_id")
            if sid:
                last_reminder_map[sid] = row.get("sent_at")
    except Exception as e:
        logger.error(f"Fee reminder: fee_reminders aggregation failed: {e}")

    # ---------------------------------------------------------------------
    # STEP 5: Stream students in small batches (projection excludes heavy
    # fields) and evaluate each one using the pre-computed maps. We never
    # hold more than one batch of students in memory at a time.
    # ---------------------------------------------------------------------
    reminded = 0
    batch_size = 200
    cursor = db.students.find(
        {},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "chain": 1, "class_name": 1}
    )
    while True:
        batch = await cursor.to_list(batch_size)
        if not batch:
            break

        for student in batch:
            student_id = student.get("id")
            if not student_id:
                continue

            chain = student.get("chain")
            class_name = student.get("class_name")

            # Total fees: student_fees first, then fee-structure fallback.
            total_fees = fee_totals.get(student_id, 0)
            if total_fees <= 0 and chain:
                total_fees = (
                    fee_structure_totals.get(f"{chain}:{class_name or ''}", 0)
                    or fee_structure_totals.get(f"{chain}:", 0)
                )

            if total_fees <= 0:
                continue

            total_paid = paid_totals.get(student_id, 0)
            balance = total_fees - total_paid
            if balance <= 0:
                continue  # Fully paid

            # Check minimum balance threshold
            min_balance = total_fees * (FEE_REMINDER_MIN_PERCENT / 100.0)
            if balance < min_balance:
                continue

            # Check if behind schedule
            expected_remaining = total_fees * expected_remaining_ratio
            if balance <= expected_remaining:
                continue  # On track

            # Check cooldown
            last_sent = last_reminder_map.get(student_id)
            if last_sent:
                try:
                    last_dt = datetime.fromisoformat(str(last_sent).replace('Z', '+00:00'))
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    if (now - last_dt).days < FEE_REMINDER_COOLDOWN_DAYS:
                        continue  # Within cooldown
                except Exception:
                    pass

            # Send the reminder
            student_name = f"{student.get('first_name', '')} {student.get('last_name', '')}".strip() or "Student"
            title = "Fee Reminder"
            body = f"Dear {student_name}, your outstanding fee balance is TZS {balance:,.0f}. Please settle it before the term ends."
            sent = await send_push_notification(student_id, title, body, "/portal/student-portal")

            # Record the reminder (even if push failed, to respect cooldown)
            await db.fee_reminders.insert_one({
                "id": str(uuid.uuid4()),
                "student_id": student_id,
                "balance": balance,
                "total_fees": total_fees,
                "sent_at": now.isoformat(),
                "push_sent": sent,
            })
            reminded += 1

        if len(batch) < batch_size:
            break

    logger.info(f"Fee reminder scheduler complete - reminded {reminded} students")



def _acquire_scheduler_lock():
    """Try to acquire the cross-process scheduler lock.

    With multiple uvicorn workers, every worker runs the FastAPI startup
    event. Without a lock, ALL workers would run the fee-reminder scheduler
    simultaneously (4x duplicate work + 4x memory). This uses an exclusive
    file lock (fcntl.flock) so only ONE worker ever runs the scheduler; the
    others skip it entirely.

    Returns the open file object (must be kept alive to hold the lock) or
    None if another worker already holds it.
    """
    try:
        import fcntl
        lock_fh = open(FEE_REMINDER_LOCK_FILE, "w")
        try:
            fcntl.flock(lock_fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            # Another worker holds the lock
            lock_fh.close()
            return None
        # Write our PID for debugging
        try:
            lock_fh.write(str(os.getpid()))
            lock_fh.flush()
        except Exception:
            pass
        return lock_fh
    except Exception as e:
        logger.warning(f"Fee reminder: could not acquire scheduler lock: {e}")
        return None


async def fee_reminder_loop():
    """Background task that runs the fee reminder check periodically.

    The FIRST run is deferred by FEE_REMINDER_STARTUP_DELAY_SECONDS so the
    scheduler does not compete with app warm-up / first requests for memory
    and CPU (which previously caused OOM kills and Cloudflare 520s on boot).
    """
    # Defer the first run so startup is not starved of memory/CPU.
    await asyncio.sleep(FEE_REMINDER_STARTUP_DELAY_SECONDS)
    while True:
        try:
            await run_fee_reminder_check()
        except Exception as e:
            logger.error(f"Fee reminder scheduler error: {e}")
        await asyncio.sleep(FEE_REMINDER_INTERVAL_HOURS * 3600)


@app.on_event("startup")
async def start_fee_reminder_scheduler():
    """Start the fee reminder background task on app startup.

    Only ONE uvicorn worker runs the scheduler (guarded by a file lock), and
    the first run is deferred so startup is not starved of memory/CPU.

    The scheduler is DISABLED by default (ENABLE_FEE_SCHEDULER=0) so it never
    competes with app warm-up for memory/CPU. Set ENABLE_FEE_SCHEDULER=1 to
    turn it back on.
    """
    if not ENABLE_FEE_SCHEDULER:
        logger.info("Fee reminder scheduler disabled (ENABLE_FEE_SCHEDULER != 1) - skipping")
        return
    lock_fh = _acquire_scheduler_lock()
    if lock_fh is None:
        logger.info("Fee reminder scheduler: another worker holds the lock - skipping")
        return
    # Keep a reference to the lock file handle so the lock is held for the
    # lifetime of the process (closing it would release the lock).
    app.state.fee_reminder_lock_fh = lock_fh
    asyncio.create_task(fee_reminder_loop())
    logger.info(
        f"Fee reminder scheduler started (single worker, first run in "
        f"{FEE_REMINDER_STARTUP_DELAY_SECONDS}s)"
    )

# ============ AUTH ROUTES ============


@api_router.post("/auth", response_model=LoginResponse)
async def login(request: LoginRequest):
    access_code = request.accessCode.strip().upper()
    password = request.password
    portal = request.portal.lower().replace('-', '').replace('_', '')
    
    logger.info(f"Login attempt: {access_code} for portal: {portal}")
    
    # Map portal names to roles
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
    
    # Check if it's a staff login
    if expected_role != 'student':
        # Validate staff access code format
        validation = validate_staff_access_code(access_code)
        if not validation['valid']:
            raise HTTPException(status_code=401, detail=validation['error'])
        
        # Check users collection
        user = await db.users.find_one({"access_code": access_code}, {"_id": 0})
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not verify_password(password, user.get('password_hash', '')):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Check status (case-insensitive)
        user_status = (user.get('status') or '').lower()
        if user_status != 'active':
            logger.warning(f"Account not active for {access_code}: status='{user.get('status')}'")
            raise HTTPException(status_code=403, detail="Account is not active")
        
        # Verify role matches portal (case-insensitive comparison)
        user_role = (user.get('role') or '').lower().strip()
        
        # Handle common role name variations
        role_normalization = {
            'section_leader': 'section_leader',
            'sectionleader': 'section_leader',
            'section leader': 'section_leader',
        }
        user_role = role_normalization.get(user_role, user_role)
        
        logger.info(f"Role check: user_role='{user_role}' (from DB: '{user.get('role')}'), expected_role='{expected_role}'")
        
        if user_role != expected_role:
            logger.warning(f"Role mismatch for {access_code}: DB role='{user.get('role')}' (normalized='{user_role}'), expected='{expected_role}'")
            raise HTTPException(status_code=403, detail=f"Access denied. Your role is '{user.get('role')}', but this is the {portal} portal.")
        
        # Create token (store role in lowercase for consistency)
        expires = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        token = create_access_token({
            "sub": user.get('id'),
            "role": user_role,  # Use lowercase role
            "chain": user.get('chain'),
            "portal": portal,
            "access_code": user.get('access_code')  # Add access_code for chain generation checks
        })
        
        user_response = {
            "id": user.get('id'),
            "accessCode": user.get('access_code'),
            "firstName": user.get('first_name'),
            "lastName": user.get('last_name'),
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "email": user.get('email'),
            "role": user_role,  # Return lowercase role
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
        # Student login - validate admission number format (NO PASSWORD REQUIRED)
        validation = validate_student_admission_number(access_code)
        if not validation['valid']:
            raise HTTPException(status_code=401, detail=validation['error'])
        
        student = await db.students.find_one({"admission_no": access_code}, {"_id": 0})
        
        if not student:
            raise HTTPException(status_code=401, detail="Student not found. Please check your admission number.")
        
        # No password verification for students - admission number is sufficient
        
        if student.get('status') != 'active':
            raise HTTPException(status_code=403, detail="Account is not active")
        
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

@api_router.post("/auth/logout")
async def logout():
    return {"success": True, "message": "Logged out successfully"}

@api_router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

# ============ USERS (STAFF) ROUTES ============

@api_router.get("/users", response_model=List[Dict])
async def get_users(chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    chain_filter = get_chain_filter(current_user) if current_user else {}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        chain_filter['chain'] = chain
    
    users = await db.users.find(chain_filter, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]

@api_router.post("/users", response_model=Dict)
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    # Validate access code format
    validation = validate_staff_access_code(user.access_code)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])
    
    # Check registration permissions
    if current_user:
        registrar_role = current_user.get('role', '')
        if not can_register(registrar_role, user.role):
            raise HTTPException(status_code=403, detail=f"{registrar_role} cannot register {user.role}")
    
    # Check if already exists
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

# NOTE: Static routes /users/chains must be defined BEFORE parameterized route /users/{user_id}
# to avoid route shadowing issues

@api_router.get("/users/chains")
async def get_chains():
    """Get all chains from database"""
    # Temporarily allow unauthenticated access for testing
    chains = await db.chains.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return [serialize_doc(chain) for chain in chains] if chains else []

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_doc(user)

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    
    # Don't allow changing access_code
    updates.pop("access_code", None)
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return serialize_doc(user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    # Move to bin before deleting
    await move_to_bin("staff", user_id, current_user or {})
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": "User moved to bin"}

@api_router.post("/users/generate-chain", response_model=Dict)
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
    
    # Use custom access code if provided, otherwise generate default
    principal_access_code = chain_data.get('principal_access_code', f"{chain_code}/PRINCIPAL/0001/{current_year}")
    
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

@api_router.get("/chains/{chain_code}", response_model=Dict)
async def get_public_chain(chain_code: str):
    """Get a specific chain by code - public endpoint for chain landing pages (no auth required)"""
    chain = await db.chains.find_one({"code": chain_code.upper()}, {"_id": 0})
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    return serialize_doc(chain)

@api_router.get("/users/chains/{chain_code}", response_model=Dict)

async def get_chain(chain_code: str, current_user: dict = Depends(get_current_user)):
    """Get a specific chain by code"""
    # Only allow principals and above to see chains
    if not current_user or current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(
            status_code=403,
            detail="Only directors, coordinators, and principals can view chains"
        )
    
    chain = await db.chains.find_one({"code": chain_code.upper()}, {"_id": 0})
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    
    return serialize_doc(chain)

@api_router.put("/users/chains/{chain_code}", response_model=Dict)
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

# ============ STAFF ROUTES ============

@api_router.get("/staff", response_model=List[Dict])
async def get_staff(role: Optional[str] = None, chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all staff members"""
    query = get_chain_filter(current_user) if current_user else {}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        query["chain"] = chain
    
    if role:
        query["role"] = role.lower()
    
    staff = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    return [serialize_doc(s) for s in staff]

@api_router.post("/staff", response_model=Dict)
async def create_staff_member(staff_data: Dict, current_user: dict = Depends(get_current_user)):
    """Create a new staff member (Principal only - for their own chain)"""
    # Only principals can create staff
    if current_user.get('role') != 'principal':
        raise HTTPException(status_code=403, detail="Only principals can create staff members")
    
    # Get the employee_id (used as access_code)
    employee_id = staff_data.get('employee_id', '').strip().upper()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    
    # Validate the employee_id as a valid access code format
    validation = validate_staff_access_code(employee_id)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=f"Invalid Employee ID format: {validation['error']}")
    
    # Ensure the staff belongs to the principal's chain
    principal_chain = current_user.get('chain', '').upper()
    staff_chain = validation['chain']
    if staff_chain != principal_chain:
        raise HTTPException(status_code=403, detail=f"Cannot create staff for chain '{staff_chain}'. You can only create staff for your own chain '{principal_chain}'")
    
    # Check if already exists
    existing = await db.users.find_one({"access_code": employee_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Staff with Employee ID '{employee_id}' already exists")
    
    # Split name into first_name and last_name
    name = staff_data.get('name', '').strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    name_parts = name.split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''
    
    # Get password
    password = staff_data.get('password', '')
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "access_code": employee_id,
        "employee_id": employee_id,
        "first_name": first_name,
        "last_name": last_name,
        "name": name,
        "email": staff_data.get('email', ''),
        "phone": staff_data.get('phone', ''),
        "department": staff_data.get('department', ''),
        "role": validation['role'],
        "chain": validation['chain'],
        "status": "active",
        "password_hash": hash_password(password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    user_doc.pop('password_hash', None)
    user_doc.pop('_id', None)
    
    return {"success": True, "message": f"Staff member '{name}' created successfully", "staff": user_doc}


@api_router.get("/staff/{staff_id}", response_model=Dict)
async def get_staff_member(staff_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single staff member"""
    staff = await db.users.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return serialize_doc(staff)

@api_router.put("/staff/{staff_id}", response_model=Dict)
async def update_staff_member(staff_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    """Update a staff member"""
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only directors, coordinators, and principals can update staff")
    
    # Remove protected fields
    updates.pop("id", None)
    updates.pop("password_hash", None)
    updates.pop("_id", None)
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.users.update_one({"id": staff_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    staff = await db.users.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    return serialize_doc(staff)

@api_router.delete("/staff/{staff_id}")
async def delete_staff_member(staff_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a staff member"""
    if not current_user or current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only directors, coordinators, and principals can delete staff")
    
    # Move to bin before deleting
    await move_to_bin("staff", staff_id, current_user or {})
    
    result = await db.users.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    return {"success": True, "message": "Staff member moved to bin"}

@api_router.post("/staff/upload-profile-pic")
async def upload_staff_profile_pic(
    file: UploadFile = File(...),
    staff_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a profile picture for a staff member"""
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only directors, coordinators, and principals can upload profile pictures")
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read and encode as base64
    contents = await file.read()
    
    # Enforce max image size of 500 KB (0.5 MB) to prevent memory overload
    if len(contents) > 500 * 1024:
        raise HTTPException(status_code=400, detail="Image must be less than 500KB")
    
    import base64
    encoded = base64.b64encode(contents).decode('utf-8')
    data_url = f"data:{file.content_type};base64,{encoded}"
    
    # Update staff member
    result = await db.users.update_one(
        {"id": staff_id},
        {"$set": {"profile_pic": data_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    return {"success": True, "message": "Profile picture uploaded"}

# ============ STUDENTS ROUTES ============

def _json_safe(value):
    """
    Recursively convert a MongoDB document value into a JSON-serializable
    Python type. Handles nested datetime, ObjectId, Decimal, bytes, and
    other BSON types that FastAPI/Starlette cannot serialize natively.
    This prevents the origin server from crashing (which Cloudflare reports
    as a 520 error) when a single document contains an unexpected type.
    """
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    # MongoDB ObjectId
    if hasattr(value, '__str__') and type(value).__name__ == 'ObjectId':
        return str(value)
    # Decimal / bytes / other BSON types
    if isinstance(value, bytes):
        return value.decode('utf-8', errors='replace')
    if hasattr(value, 'to_decimal'):
        return float(value)
    # Fallback: try to stringify anything else
    try:
        return str(value)
    except Exception:
        return None


@api_router.get("/students", response_model=List[Dict])
async def get_students(class_name: Optional[str] = None, chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # For Directors/Coordinators, use the explicit chain param if provided
    user_role = current_user.get('role', '').lower()
    if user_role in ['director', 'coordinator'] and chain:
        query = {'chain': chain.upper()}
    else:
        query = get_chain_filter(current_user)
    
    if class_name:
        query["class_name"] = class_name
    # Exclude _id, password_hash, and heavy image fields from the projection
    students = await db.students.find(query, {"_id": 0, "password_hash": 0, "passport_photo": 0, "profile_pic": 0}).to_list(500)
    result = []
    for s in students:
        try:
            # Preserve the original UUID id field, only fall back to _id if no id exists
            if not s.get("id"):
                s["id"] = str(s.get("_id"))
            # Use the recursive JSON-safe serializer so nested datetime,
            # ObjectId, Decimal, etc. never crash the response.
            result.append(_json_safe(s))
        except Exception as e:
            # Never let a single malformed document take down the whole request.
            logger.warning(f"Skipping student with unserializable data: {e}")
            continue
    return result


@api_router.post("/students", response_model=Dict)
async def create_student(student: StudentCreate, current_user: dict = Depends(get_current_user)):
    # Validate admission number format
    validation = validate_student_admission_number(student.admission_no)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])
    
    # Check registration permissions
    if current_user:
        registrar_role = current_user.get('role', '')
        if not can_register(registrar_role, 'student'):
            raise HTTPException(status_code=403, detail=f"{registrar_role} cannot register students")
        
        # Check chain match (staff can only register students in their chain)
        registrar_chain = current_user.get('chain', '')
        if registrar_role not in ['director', 'coordinator'] and registrar_chain != validation['chain']:
            raise HTTPException(status_code=403, detail=f"Cannot register students for {validation['chain']} chain")
    
    # Check if already exists
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

@api_router.get("/students/{student_id}")
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one(
        {"$or": [{"id": student_id}, {"admission_no": student_id.upper()}]},
        {"_id": 0, "password_hash": 0}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return serialize_doc(student)

@api_router.put("/students/{student_id}")
async def update_student(student_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    
    # Don't allow changing admission_no
    updates.pop("admission_no", None)
    
    result = await db.students.update_one({"id": student_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    student = await db.students.find_one({"id": student_id}, {"_id": 0, "password_hash": 0})
    return serialize_doc(student)

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(get_current_user)):
    # Move to bin before deleting
    try:
        print(f"DEBUG: Calling move_to_bin for student {student_id}")
        print(f"DEBUG: current_user keys: {list((current_user or {}).keys())}")
        result = await move_to_bin("students", student_id, current_user or {})
        print(f"DEBUG: move_to_bin returned {result}")
    except Exception as e:
        print(f"Warning: Failed to move student to bin: {e}")
        import traceback
        traceback.print_exc()
        # Continue with deletion even if bin move fails
    print(f"DEBUG: About to delete student {student_id} from students collection")
    result = await db.students.delete_one({"id": student_id})
    print(f"DEBUG: delete_one result: deleted_count={result.deleted_count}")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"success": True, "message": "Student moved to bin"}

@api_router.post("/students/bulk-upload", response_model=Dict)
async def bulk_upload_students(
    students_data: List[Dict],
    current_user: dict = Depends(get_current_user)
):
    """
    Bulk upload students - accepts a list of student objects.
    Each student object should have:
    - admission_no: str (e.g., DLP/STU0293/2024)
    - first_name: str
    - last_name: str
    - gender: str (MALE/FEMALE/OTHER)
    - class_name: str
    - chain: str
    - parent_name: Optional[str]
    - parent_phone: Optional[str]
    - password: Optional[str] (defaults to chain+00000 if not provided)
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    registrar_role = current_user.get('role', '')
    if not can_register(registrar_role, 'student'):
        raise HTTPException(status_code=403, detail=f"{registrar_role} cannot register students")
    
    results = {
        "success": [],
        "errors": [],
        "total": len(students_data),
        "imported": 0,
        "failed": 0
    }
    
    for student_data in students_data:
        try:
            admission_no = student_data.get('admission_no', '').upper()
            if not admission_no:
                results["errors"].append({"data": student_data, "error": "Missing admission_no"})
                results["failed"] += 1
                continue
            
            # Validate admission number
            validation = validate_student_admission_number(admission_no)
            if not validation['valid']:
                results["errors"].append({"data": student_data, "error": validation['error']})
                results["failed"] += 1
                continue
            
            # Check chain permissions
            registrar_chain = current_user.get('chain', '')
            if registrar_role not in ['director', 'coordinator'] and registrar_chain and registrar_chain != validation['chain']:
                results["errors"].append({"data": student_data, "error": f"Cannot register students for {validation['chain']} chain"})
                results["failed"] += 1
                continue
            
            # Check if already exists
            existing = await db.students.find_one({"admission_no": admission_no})
            if existing:
                results["errors"].append({"data": student_data, "error": f"Student {admission_no} already exists"})
                results["failed"] += 1
                continue
            
            # Build student document
            password = student_data.get('password', f"{validation['chain']}00000")
            
            student_doc = {
                "id": str(uuid.uuid4()),
                "admission_no": admission_no,
                "first_name": student_data.get('first_name', ''),
                "last_name": student_data.get('last_name', ''),
                "gender": student_data.get('gender', 'OTHER').upper(),
                "date_of_birth": student_data.get('date_of_birth'),
                "class_id": student_data.get('class_id'),
                "class_name": student_data.get('class_name', ''),
                "admission_date": student_data.get('admission_date') or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                "status": student_data.get('status', 'active'),
                "chain": validation['chain'],
                "parent_name": student_data.get('parent_name'),
                "parent_phone": student_data.get('parent_phone'),
                "password_hash": hash_password(password),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.students.insert_one(student_doc)
            student_doc.pop('password_hash', None)
            student_doc.pop('_id', None)
            results["success"].append(student_doc)
            results["imported"] += 1
            
        except Exception as e:
            results["errors"].append({"data": student_data, "error": str(e)})
            results["failed"] += 1
    
    return results

# ============ CLASSES ROUTES ============

@api_router.get("/classes", response_model=List[Dict])
async def get_classes(chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # For Directors/Coordinators, use the explicit chain param if provided
    user_role = current_user.get('role', '').lower()
    if user_role in ['director', 'coordinator'] and chain:
        query = {'chain': chain.upper()}
    else:
        query = get_chain_filter(current_user)
    
    classes = await db.classes.find(query, {"_id": 0}).to_list(100)
    return [serialize_doc(c) for c in classes]

@api_router.post("/classes", response_model=Dict)
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

@api_router.get("/classes/{class_id}")
async def get_class(class_id: str):
    cls = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return serialize_doc(cls)

@api_router.put("/classes/{class_id}")
async def update_class(class_id: str, updates: Dict):
    result = await db.classes.update_one({"id": class_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    cls = await db.classes.find_one({"id": class_id}, {"_id": 0})
    return serialize_doc(cls)

@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str, current_user: dict = Depends(get_current_user)):
    # Move to bin before deleting
    await move_to_bin("classes", class_id, current_user or {})
    result = await db.classes.delete_one({"id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"success": True, "message": "Class moved to bin"}

# ============ SUBJECTS ROUTES ============

@api_router.get("/subjects", response_model=List[Dict])
async def get_subjects(class_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = get_chain_filter(current_user) if current_user else {}
    if class_id:
        query["class_id"] = class_id
    subjects = await db.subjects.find(query, {"_id": 0}).to_list(200)
    return [serialize_doc(s) for s in subjects]

@api_router.post("/subjects", response_model=Dict)
async def create_subject(subject: SubjectBase):
    subject_doc = {
        "id": str(uuid.uuid4()),
        **subject.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.subjects.insert_one(subject_doc)
    subject_doc.pop('_id', None)
    return subject_doc

@api_router.get("/subjects/{subject_id}")
async def get_subject(subject_id: str):
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return serialize_doc(subject)

@api_router.put("/subjects/{subject_id}")
async def update_subject(subject_id: str, updates: Dict):
    result = await db.subjects.update_one({"id": subject_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    return serialize_doc(subject)

@api_router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, current_user: dict = Depends(get_current_user)):
    # Move to bin before deleting
    await move_to_bin("subjects", subject_id, current_user or {})
    result = await db.subjects.delete_one({"id": subject_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"success": True, "message": "Subject moved to bin"}

# ============ ATTENDANCE ROUTES (STAFF QR SCANNING) ============

@api_router.get("/attendance", response_model=List[Dict])
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
    elif month:
        # Filter by month using regex (e.g., "2026-04" matches "2026-04-01", "2026-04-15", etc.)
        query["date"] = {"$regex": f"^{month}"}
    if chain:
        query["chain"] = chain
    # Sort by date descending to get newest records first, limit to 1000 with field projections
    # to prevent memory overload. Frontend should request specific date ranges.
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [serialize_doc(r) for r in records]

@api_router.post("/attendance", response_model=Dict)
async def record_attendance(record: AttendanceRecord, current_user: dict = Depends(get_current_user)):
    # Only school-level roles can record attendance (not directors/coordinators)
    if current_user.get('role') in ['director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Directors and coordinators cannot record attendance")
    
    record_doc = record.model_dump()
    record_doc["recorded_at"] = datetime.now(timezone.utc).isoformat()
    
    if not record_doc.get("check_in_time"):
        record_doc["check_in_time"] = datetime.now(timezone.utc).strftime('%H:%M:%S')
    
    # Check for existing record
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

@api_router.post("/attendance/staff-checkin", response_model=Dict)
async def staff_qr_checkin(data: Dict, current_user: dict = Depends(get_current_user)):
    """QR Code check-in/check-out for staff members with late detection"""
    access_code = data.get('access_code', '').upper()
    qr_code = data.get('qr_code', '')  # The location QR code that was scanned
    
    # Validate staff access code
    validation = validate_staff_access_code(access_code)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])
    
    # Find staff member
    staff = await db.users.find_one({"access_code": access_code}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Use East Africa Time (UTC+3) for Zanzibar
    eat_timezone = timezone(timedelta(hours=3))
    current_time = datetime.now(eat_timezone)
    today = current_time.strftime('%Y-%m-%d')
    time_str = current_time.strftime('%H:%M:%S')
    
    # Define late threshold based on chain (DLP, DUP, LALE start at 7:30 AM, others at 8:00 AM East Africa Time)
    staff_chain = (staff.get('chain') or '').upper()
    if staff_chain in ('DLP', 'DUP', 'LALE'):
        late_threshold_hour = 7
        late_threshold_minute = 30
    else:
        late_threshold_hour = 8
        late_threshold_minute = 0
    
    # Check for existing record today
    existing = await db.attendance.find_one({
        "target_id": staff['id'],
        "target_type": "staff",
        "date": today
    })
    
    if existing:
        # If already checked in but NOT checked out -> CHECK OUT
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
            # Already checked in and checked out today
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
    
    # New check-in
    # Determine if late (after 8:00 AM East Africa Time)
    is_late = False
    late_duration = None
    current_hour = current_time.hour
    current_minute = current_time.minute
    
    if current_hour > late_threshold_hour or (current_hour == late_threshold_hour and current_minute > late_threshold_minute):
        is_late = True
        # Calculate late duration in minutes
        late_minutes = (current_hour - late_threshold_hour) * 60 + (current_minute - late_threshold_minute)
        hours = late_minutes // 60
        mins = late_minutes % 60
        if hours > 0:
            late_duration = f"{hours}h {mins}m"
        else:
            late_duration = f"{mins}m"
    
    # Record attendance
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


@api_router.post("/attendance/qr-checkin", response_model=Dict)
async def manual_qr_checkin(data: Dict, current_user: dict = Depends(get_current_user)):
    """Manual check-in/check-out with explicit action (check_in or check_out)"""
    access_code = data.get('access_code', '').upper().strip()
    action = data.get('action', 'check_in')  # 'check_in' or 'check_out'
    qr_code_used = data.get('qr_code', '')  # QR code that was scanned
    
    if not access_code:
        raise HTTPException(status_code=400, detail="Access code is required")
    
    # Validate staff access code
    validation = validate_staff_access_code(access_code)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=validation['error'])
    
    # Find staff member
    staff = await db.users.find_one({"access_code": access_code}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found with this access code")
    
    # Use East Africa Time (UTC+3) for Zanzibar
    eat_timezone = timezone(timedelta(hours=3))
    current_time = datetime.now(eat_timezone)
    today = current_time.strftime('%Y-%m-%d')
    time_str = current_time.strftime('%H:%M:%S')
    
    # Define late threshold based on chain (DLP, DUP, LALE start at 7:30 AM, others at 8:00 AM East Africa Time)
    staff_chain = (staff.get('chain') or '').upper()
    if staff_chain in ('DLP', 'DUP', 'LALE'):
        late_threshold_hour = 7
        late_threshold_minute = 30
    else:
        late_threshold_hour = 8
        late_threshold_minute = 0
    
    # Check for existing record today
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
    
    # Check In
    if existing:
        if existing.get('check_in_time') and not existing.get('check_out_time'):
            raise HTTPException(status_code=400, detail="Already checked in. Use Check Out button.")
        elif existing.get('check_out_time'):
            raise HTTPException(status_code=400, detail="Already completed attendance for today")
    
    # Determine if late (after 8:00 AM)
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
    
    # Record attendance
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


@api_router.get("/attendance/staff-today", response_model=List[Dict])
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
    
    # Enrich with staff details
    result = []
    for record in records:
        staff = await db.users.find_one({"id": record['target_id']}, {"_id": 0, "password_hash": 0})
        if staff:
            record['staff'] = serialize_doc(staff)
        result.append(serialize_doc(record))
    
    return result

@api_router.post("/attendance/bulk", response_model=Dict)
async def bulk_record_attendance(records: List[Dict], current_user: dict = Depends(get_current_user)):
    # Only school-level roles can record attendance (not directors/coordinators)
    if current_user and current_user.get('role') in ['director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Directors and coordinators cannot record attendance")
    
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

# ============ QR CODE GENERATION ROUTES ============

class QRCodeCreate(BaseModel):
    school_name: str
    chain: str  # DUP, DLP, OLGUN, IHEZA, LALE, ALL
    duration_days: int = 30
    notes: Optional[str] = None

@api_router.post("/qr-codes")
async def create_qr_code(qr_data: QRCodeCreate, current_user: dict = Depends(get_current_user)):
    """Create a new QR code for attendance - Principal only"""
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only Directors, Coordinators, and Principals can create QR codes")
    
    # Generate unique QR code
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
    
    return {
        "success": True,
        "qr_code": serialize_doc(qr_doc)
    }

@api_router.get("/qr-codes", response_model=List[Dict])
async def get_qr_codes(current_user: dict = Depends(get_current_user)):
    """Get all QR codes created by the current user's chain"""
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only Directors, Coordinators, and Principals can view QR codes")
    
    chain = current_user.get('chain')
    query = {}
    
    # Directors and Coordinators can see all
    if current_user.get('role') not in ['director', 'coordinator']:
        query["chain"] = {"$in": [chain, "ALL"]}
    
    qr_codes = await db.qr_codes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [serialize_doc(qr) for qr in qr_codes]

@api_router.delete("/qr-codes/{qr_id}")
async def delete_qr_code(qr_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a QR code"""
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only Directors, Coordinators, and Principals can delete QR codes")
    
    # Move to bin before deleting
    await move_to_bin("qr_codes", qr_id, current_user or {})
    result = await db.qr_codes.delete_one({"id": qr_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="QR code not found")
    
    return {"success": True, "message": "QR code moved to bin"}

@api_router.post("/qr-codes/verify")
async def verify_qr_code(data: Dict, current_user: dict = Depends(get_current_user)):
    """Verify a QR code is valid and active for attendance"""
    qr_code = data.get('qr_code', '').upper().strip()
    
    if not qr_code:
        raise HTTPException(status_code=400, detail="QR code is required")
    
    # Extract chain prefix from QR code (format: PREFIX-QR-XXXXXXXX)
    parts = qr_code.split('-')
    if len(parts) < 3 or parts[1] != 'QR':
        raise HTTPException(status_code=400, detail="Invalid QR code format")
    
    chain_prefix = parts[0]
    
    # Find the QR code in database
    qr_record = await db.qr_codes.find_one({"qr_code": qr_code}, {"_id": 0})
    
    if qr_record:
        # Check if QR code is active
        if qr_record.get('status') == 'inactive':
            return {
                "valid": False,
                "message": "This QR code has been deactivated"
            }
        
        return {
            "valid": True,
            "qr_code": qr_code,
            "school_name": qr_record.get('school_name') or qr_record.get('name'),
            "chain": qr_record.get('chain', chain_prefix),
            "location": qr_record.get('location')
        }
    
    # QR code not found in database - check if it matches expected format
    # Accept it anyway for flexibility (QR might have been generated but not stored)
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
    
    return {
        "valid": False,
        "message": "Unknown QR code"
    }

# ============ GRADES ROUTES ============

@api_router.get("/grades", response_model=List[Dict])
async def get_grades(
    student_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    term: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if student_id:
        query["student_id"] = student_id
    if subject_id:
        query["subject_id"] = subject_id
    if term:
        query["term"] = term
    grades = await db.grades.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(g) for g in grades]

@api_router.post("/grades", response_model=Dict)
async def record_grade(grade: GradeRecord):
    grade_doc = grade.model_dump()
    grade_doc["recorded_at"] = datetime.now(timezone.utc).isoformat()
    await db.grades.insert_one(grade_doc)
    grade_doc.pop('_id', None)
    return grade_doc

@api_router.put("/grades/{grade_id}")
async def update_grade(grade_id: str, updates: Dict):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.grades.update_one({"id": grade_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Grade record not found")
    grade = await db.grades.find_one({"id": grade_id}, {"_id": 0})
    return serialize_doc(grade)

# ============ FEES ROUTES ============

@api_router.get("/fees", response_model=List[Dict])
async def get_fees(student_id: Optional[str] = None, fee_status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = get_chain_filter(current_user) if current_user else {}
    if student_id:
        query["student_id"] = student_id
    if fee_status:
        query["status"] = fee_status
    fees = await db.fees.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(f) for f in fees]

@api_router.post("/fees", response_model=Dict)
async def create_fee(fee: FeeRecord):
    fee_doc = fee.model_dump()
    fee_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.fees.insert_one(fee_doc)
    fee_doc.pop('_id', None)
    return fee_doc

@api_router.put("/fees/{fee_id}")
async def update_fee(fee_id: str, updates: Dict):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.fees.update_one({"id": fee_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fee record not found")
    fee = await db.fees.find_one({"id": fee_id}, {"_id": 0})
    return serialize_doc(fee)

# ============ FEE STRUCTURE ROUTES (Secretary) ============

@api_router.get("/fee-structures", response_model=List[Dict])
async def get_fee_structures(
    chain: Optional[str] = None,
    class_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if chain:
        query["chain"] = chain
    if class_name:
        query["$or"] = [{"class_name": class_name}, {"class_name": None}, {"class_name": ""}]
    query["status"] = "active"
    structures = await db.fee_structures.find(query, {"_id": 0}).to_list(100)
    return [serialize_doc(s) for s in structures]

@api_router.post("/fee-structures", response_model=Dict)
async def create_fee_structure(structure: FeeStructure, current_user: dict = Depends(get_current_user)):
    # Only secretary and principal can create fee structures
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can manage fee structures")
    
    structure_doc = structure.model_dump()
    structure_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    structure_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.fee_structures.insert_one(structure_doc)
    structure_doc.pop('_id', None)
    return structure_doc

@api_router.put("/fee-structures/{structure_id}")
async def update_fee_structure(structure_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can manage fee structures")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.fee_structures.update_one({"id": structure_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    structure = await db.fee_structures.find_one({"id": structure_id}, {"_id": 0})
    return serialize_doc(structure)

@api_router.delete("/fee-structures/{structure_id}")
async def delete_fee_structure(structure_id: str, current_user: dict = Depends(get_current_user)):
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can manage fee structures")
    
    # Move to bin before soft deleting
    await move_to_bin("fee_structures", structure_id, current_user or {})
    
    # Soft delete - set status to inactive
    result = await db.fee_structures.update_one(
        {"id": structure_id}, 
        {"$set": {"status": "inactive", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    return {"success": True, "message": "Fee structure moved to bin"}

# ============ PAYMENTS ROUTES (Secretary) ============

@api_router.get("/payments", response_model=List[Dict])
async def get_payments(
    student_id: Optional[str] = None,
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if student_id:
        query["student_id"] = student_id
    if chain:
        query["chain"] = chain
    # IMPORTANT: Project OUT receipt_image / receipt_images. Those base64 blobs
    # are 1-5 MB each and are NOT needed for the payments table rows. Stripping
    # them here cuts the /payments payload dramatically (a list of 1000 payments
    # with receipts could otherwise be hundreds of MB).
    payments = await db.payments.find(
        query,
        {"_id": 0, "receipt_image": 0, "receipt_images": 0}
    ).sort("created_at", -1).to_list(1000)
    return [serialize_doc(p) for p in payments]



# ============ SPECIAL FEES ROUTES ============
class SpecialFee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    student_id: str
    fee_type: str  # half_day, full_day, uniform
    amount: float
    description: Optional[str] = ""
    added_by: Optional[str] = None

@api_router.get("/special-fees")
async def get_special_fees(
    student_id: Optional[str] = None,
    fee_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get special fees with optional filters"""
    query = {}
    if student_id:
        query["student_id"] = student_id
    if fee_type:
        query["fee_type"] = fee_type
    
    chain_filter = get_chain_filter(current_user) if current_user else {}
    query.update(chain_filter)
    
    fees = await db.special_fees.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(f) for f in fees]

@api_router.post("/special-fees")
async def add_special_fee(fee: SpecialFee, current_user: dict = Depends(get_current_user)):
    """Add special fee (Half Day, Full Day, Uniform) - Secretary only"""
    if current_user and current_user.get('role') not in ['secretary']:
        raise HTTPException(status_code=403, detail="Only secretary can add special fees")
    
    # Get student info for chain
    student = await db.students.find_one({"id": fee.student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    fee_doc = {
        "id": str(uuid.uuid4()),
        "student_id": fee.student_id,
        "fee_type": fee.fee_type,
        "amount": fee.amount,
        "description": fee.description,
        "chain": student.get("chain"),
        "added_by": fee.added_by or current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.special_fees.insert_one(fee_doc)
    fee_doc.pop('_id', None)
    
    # Update student_fees total if exists
    student_fee = await db.student_fees.find_one({"student_id": fee.student_id})
    if student_fee:
        new_amount = student_fee.get("amount", 0) + fee.amount
        await db.student_fees.update_one(
            {"student_id": fee.student_id},
            {"$set": {"amount": new_amount}}
        )
    
    return fee_doc


# Student Special Details Model
class StudentSpecialDetails(BaseModel):
    student_id: str
    special_notes: str
    added_by: Optional[str] = None


@api_router.post("/student-special-details")
async def save_student_special_details(details: StudentSpecialDetails, current_user: dict = Depends(get_current_user)):
    """Save special details/notes for a student - Secretary only"""
    if current_user and current_user.get('role') not in ['secretary']:
        raise HTTPException(status_code=403, detail="Only secretary can save special details")
    
    # Get student info
    student = await db.students.find_one({"id": details.student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Update or create special details
    await db.student_special_details.update_one(
        {"student_id": details.student_id},
        {
            "$set": {
                "student_id": details.student_id,
                "special_notes": details.special_notes,
                "chain": student.get("chain"),
                "added_by": details.added_by or current_user.get("id"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"success": True, "message": "Special details saved"}


@api_router.get("/student-special-details/{student_id}")
async def get_student_special_details(student_id: str, current_user: dict = Depends(get_current_user)):
    """Get special details for a student"""
    details = await db.student_special_details.find_one({"student_id": student_id}, {"_id": 0})
    return details or {"student_id": student_id, "special_notes": ""}


# ============== ALMANAC ENDPOINTS ==============

class AlmanacEvent(BaseModel):
    title: str
    description: Optional[str] = ""
    start_date: str
    end_date: Optional[str] = None
    visibility: Optional[str] = "public"
    actorId: Optional[str] = None


@api_router.get("/almanac")
async def get_almanac_events(chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get almanac events filtered by chain"""
    chain_filter = get_chain_filter(current_user) if current_user else {}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        chain_filter['chain'] = chain
    
    events = await db.almanac_events.find(chain_filter, {"_id": 0}).to_list(1000)
    return {"events": [serialize_doc(e) for e in events]}


@api_router.post("/almanac")
async def create_almanac_event(event: AlmanacEvent, current_user: dict = Depends(get_current_user)):
    """Create almanac event - Section Leader and Principal only"""
    if current_user and current_user.get('role') not in ['section_leader', 'principal']:
        raise HTTPException(status_code=403, detail="Only Section Leader or Principal can create events")
    
    event_doc = {
        "id": str(uuid.uuid4()),
        "title": event.title,
        "description": event.description,
        "start_date": event.start_date,
        "end_date": event.end_date or event.start_date,
        "visibility": event.visibility,
        "eventType": event.visibility,
        "chain": current_user.get("chain") if current_user else None,
        "created_by": current_user.get("id") if current_user else None,
        "created_by_role": current_user.get("role") if current_user else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.almanac_events.insert_one(event_doc)
    event_doc.pop('_id', None)
    return event_doc


@api_router.delete("/almanac")
async def delete_almanac_event(id: str, current_user: dict = Depends(get_current_user)):
    """Delete almanac event - Section Leader and Principal only"""
    if current_user and current_user.get('role') not in ['section_leader', 'principal']:
        raise HTTPException(status_code=403, detail="Only Section Leader or Principal can delete events")
    
    # Move to bin before deleting
    await move_to_bin("almanac_events", id, current_user or {})
    result = await db.almanac_events.delete_one({"id": id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True, "message": "Event moved to bin"}


# ============== TASK ENDPOINTS ==============

class Task(BaseModel):
    title: str
    description: Optional[str] = ""
    assigned_to: str  # User ID
    priority: Optional[str] = "medium"  # high, medium, low
    due_date: Optional[str] = None
    status: Optional[str] = "pending"  # pending, in_progress, completed


@api_router.get("/tasks/my-tasks")
async def get_my_tasks(current_user: dict = Depends(get_current_user)):
    """Get tasks assigned to the current user"""
    if not current_user:
        return []
    
    tasks = await db.tasks.find(
        {"assigned_to": current_user.get("id")},
        {"_id": 0}
    ).to_list(100)
    
    return tasks


@api_router.get("/tasks")
async def get_all_tasks(current_user: dict = Depends(get_current_user)):
    """Get all tasks - Principal/Director/Coordinator only"""
    if current_user and current_user.get('role') not in ['principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    chain_filter = get_chain_filter(current_user) if current_user else {}
    tasks = await db.tasks.find(chain_filter, {"_id": 0}).to_list(500)
    return tasks


@api_router.post("/tasks")
async def create_task(task: Task, current_user: dict = Depends(get_current_user)):
    """Create a task - Principal/Director/Coordinator only"""
    if current_user and current_user.get('role') not in ['principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only Principal can assign tasks")
    
    task_doc = {
        "id": str(uuid.uuid4()),
        "title": task.title,
        "description": task.description,
        "assigned_to": task.assigned_to,
        "assigned_by": current_user.get("id") if current_user else None,
        "assigned_by_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() if current_user else "Principal",
        "priority": task.priority,
        "due_date": task.due_date,
        "status": task.status,
        "chain": current_user.get("chain") if current_user else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(task_doc)
    task_doc.pop('_id', None)
    return task_doc


@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    """Update a task status"""
    allowed_updates = {}
    if "status" in updates:
        allowed_updates["status"] = updates["status"]
    if "priority" in updates and current_user.get('role') in ['principal', 'director', 'coordinator']:
        allowed_updates["priority"] = updates["priority"]
    
    if not allowed_updates:
        raise HTTPException(status_code=400, detail="No valid updates provided")
    
    allowed_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.tasks.update_one(
        {"id": task_id},
        {"$set": allowed_updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True}


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a task - Principal/Director/Coordinator only"""
    if current_user and current_user.get('role') not in ['principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only Principal can delete tasks")
    
    # Move to bin before deleting
    await move_to_bin("tasks", task_id, current_user or {})
    
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True, "message": "Task moved to bin"}


@api_router.post("/payments", response_model=Dict)
async def record_payment(payment: Payment, current_user: dict = Depends(get_current_user)):
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can record payments")
    
    payment_doc = payment.model_dump()
    payment_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    
    # Generate reference number if not provided
    if not payment_doc.get("reference_no"):
        payment_doc["reference_no"] = f"PAY-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6].upper()}"
    
    await db.payments.insert_one(payment_doc)
    payment_doc.pop('_id', None)
    
    # Update student_fees paid_amount
    student_id = payment_doc.get("student_id")
    payment_amount = payment_doc.get("amount", 0)
    
    if student_id and payment_amount > 0:
        # Check if student_fees record exists
        student_fee = await db.student_fees.find_one({"student_id": student_id})
        if student_fee:
            # Update paid_amount
            new_paid_amount = student_fee.get("paid_amount", 0) + payment_amount
            await db.student_fees.update_one(
                {"student_id": student_id},
                {"$set": {"paid_amount": new_paid_amount}}
            )
        else:
            # Get student info for chain - try id first, then admission_no (for DLP students)
            student = await db.students.find_one({"id": student_id}, {"_id": 0})
            if not student:
                student = await db.students.find_one({"admission_no": student_id}, {"_id": 0})
            if student:
                # Calculate total fees from payments
                all_payments = await db.payments.find({"student_id": student_id}).to_list(100)
                total_paid = sum(p.get("amount", 0) for p in all_payments)
                
                # Get fee structures
                chain = student.get("chain")
                class_name = student.get("class_name")
                fee_structures = await db.fee_structures.find({
                    "chain": chain,
                    "status": "active"
                }, {"_id": 0}).to_list(50)
                total_fees = sum(f.get("amount", 0) for f in fee_structures)
                
                # Create student_fees record
                await db.student_fees.insert_one({
                    "id": str(uuid.uuid4()),
                    "student_id": student_id,
                    "chain": chain,
                    "amount": total_fees,
                    "paid_amount": total_paid,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    
    return payment_doc

@api_router.put("/payments/{payment_id}", response_model=Dict)
async def update_payment(payment_id: str, payment_data: Dict, current_user: dict = Depends(get_current_user)):
    """Update an existing payment record"""
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can update payments")
    
    # Find existing payment
    existing_payment = await db.payments.find_one({"id": payment_id})
    if not existing_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    old_amount = existing_payment.get("amount", 0)
    new_amount = payment_data.get("amount", old_amount)
    student_id = existing_payment.get("student_id")
    
    # Update payment
    update_fields = {
        "amount": new_amount,
        "payment_method": payment_data.get("payment_method", existing_payment.get("payment_method")),
        "reference_no": payment_data.get("reference_no", existing_payment.get("reference_no")),
        "notes": payment_data.get("notes", existing_payment.get("notes")),
        "fee_type": payment_data.get("fee_type", existing_payment.get("fee_type")),
        "uniform_fee_details": payment_data.get("uniform_fee_details"),
        "admission_fee_details": payment_data.get("admission_fee_details"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.update_one({"id": payment_id}, {"$set": update_fields})
    
    # Update student_fees if amount changed
    if student_id and old_amount != new_amount:
        amount_diff = new_amount - old_amount
        student_fee = await db.student_fees.find_one({"student_id": student_id})
        if student_fee:
            new_paid_amount = student_fee.get("paid_amount", 0) + amount_diff
            await db.student_fees.update_one(
                {"student_id": student_id},
                {"$set": {"paid_amount": new_paid_amount}}
            )
    
    updated_payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return serialize_doc(updated_payment)

@api_router.put("/payments/{payment_id}/receipt")
async def upload_payment_receipt(payment_id: str, data: Dict, current_user: dict = Depends(get_current_user)):
    """Upload/update receipt image for a payment - Secretary only"""
    if current_user and current_user.get('role') not in ['secretary']:
        raise HTTPException(status_code=403, detail="Only secretary can upload receipt images")
    
    receipt_image = data.get("receipt_image")
    if not receipt_image:
        raise HTTPException(status_code=400, detail="receipt_image is required")
    
    # Validate it looks like a base64 image
    if not receipt_image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image format. Must be a base64 data URL")
    
    # Enforce max image size of 500 KB (0.5 MB)
    try:
        # Strip the data URL prefix (e.g. "data:image/jpeg;base64,") to get the raw base64
        base64_part = receipt_image.split(",", 1)[1] if "," in receipt_image else receipt_image
        # Decode base64 to get the actual byte size of the image
        import base64 as _b64
        decoded_size = len(_b64.b64decode(base64_part))
        if decoded_size > 500 * 1024:
            raise HTTPException(status_code=400, detail="Image must be less than 500KB")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    
    result = await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "receipt_image": receipt_image,
            "receipt_updated_at": datetime.now(timezone.utc).isoformat(),
            "receipt_updated_by": current_user.get("id")
        }}
    )

    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return {"success": True, "message": "Receipt image uploaded"}


@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a payment record"""
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can delete payments")
    
    # Find existing payment
    existing_payment = await db.payments.find_one({"id": payment_id})
    if not existing_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    payment_amount = existing_payment.get("amount", 0)
    student_id = existing_payment.get("student_id")
    
    # Move to bin before deleting
    await move_to_bin("payments", payment_id, current_user or {})
    
    # Delete payment
    await db.payments.delete_one({"id": payment_id})
    
    # Update student_fees to reduce paid_amount
    if student_id and payment_amount > 0:
        student_fee = await db.student_fees.find_one({"student_id": student_id})
        if student_fee:
            new_paid_amount = max(0, student_fee.get("paid_amount", 0) - payment_amount)
            await db.student_fees.update_one(
                {"student_id": student_id},
                {"$set": {"paid_amount": new_paid_amount}}
            )
    
    return {"message": "Payment deleted successfully", "id": payment_id}

@api_router.get("/student-fees/{student_id}")
async def get_student_fee_summary(student_id: str, current_user: dict = Depends(get_current_user)):
    """Get fee summary for a student including all applicable fees and payments"""
    from urllib.parse import unquote
    
    # Decode URL-encoded ID (handles DLP/STU0414/2026 encoded as DLP%2FSTU0414%2F2026)
    decoded_id = unquote(student_id)
    
    # Get student - try by id first, then by admission_no, then by MongoDB _id
    student = await db.students.find_one({"id": decoded_id}, {"password_hash": 0})
    if not student:
        student = await db.students.find_one({"admission_no": decoded_id.upper()}, {"password_hash": 0})
    if not student:
        # Also try by MongoDB _id if it's a valid ObjectId
        try:
            from bson import ObjectId
            student = await db.students.find_one({"_id": ObjectId(decoded_id)}, {"password_hash": 0})
        except Exception:
            pass
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get the actual MongoDB _id and admission_no for lookups
    actual_mongo_id = str(student.get("_id"))
    admission_no = student.get("admission_no", decoded_id)
    
    # Ensure student dict has 'id' field for frontend compatibility
    student["id"] = student.get("id") or actual_mongo_id
    
    chain = student.get("chain")
    class_name = student.get("class_name")
    
    # Get all payments for this student - try MongoDB _id, UUID id, and admission_no
    student_uuid_id = student.get("id")
    
    # Build $or conditions, filtering out None values to avoid matching null student_ids
    or_conditions = []
    if actual_mongo_id:
        or_conditions.append({"student_id": actual_mongo_id})
    if student_uuid_id and student_uuid_id != actual_mongo_id:
        or_conditions.append({"student_id": student_uuid_id})
    if admission_no and admission_no not in [actual_mongo_id, student_uuid_id]:
        or_conditions.append({"student_id": admission_no})
    
    if or_conditions:
        payments = await db.payments.find({
            "$or": or_conditions
        }, {"_id": 0}).to_list(100)
    else:
        payments = []
    
    # If no payments found, try individual lookups with all possible identifiers
    if not payments:
        # Collect all unique identifiers to try
        identifiers_to_try = []
        for ident in [actual_mongo_id, student_uuid_id, admission_no]:
            if ident and ident not in identifiers_to_try:
                identifiers_to_try.append(ident)
        
        for ident in identifiers_to_try:
            payments = await db.payments.find({"student_id": ident}, {"_id": 0}).to_list(100)
            if payments:
                break
    
    total_paid = sum(p.get("amount", 0) for p in payments)
    
    # Check student_fees collection - try MongoDB _id, UUID id, and admission_no
    student_fee = await db.student_fees.find_one({
        "$or": [
            {"student_id": actual_mongo_id},
            {"student_id": student_uuid_id},
            {"student_id": admission_no}
        ]
    }, {"_id": 0})
    
    if student_fee:
        # Use fee amount from student_fees collection
        total_fees = student_fee.get("amount", 0)
    else:
        # Fall back to fee structures
        fee_structures = await db.fee_structures.find({
            "chain": chain,
            "status": "active",
            "$or": [{"class_name": class_name}, {"class_name": None}, {"class_name": ""}]
        }, {"_id": 0}).to_list(50)
        total_fees = sum(f.get("amount", 0) for f in fee_structures)
    
    # Get fee structures for display
    fee_structures = await db.fee_structures.find({
        "chain": chain,
        "status": "active"
    }, {"_id": 0}).to_list(50)
    
    balance = total_fees - total_paid
    
    # Collect receipt images from student_fees collection (for receipts uploaded from All Students table)
    student_fee_receipt_images = []
    if student_fee:
        if student_fee.get("receipt_images"):
            student_fee_receipt_images = list(student_fee.get("receipt_images", []))
        elif student_fee.get("receipt_image"):
            student_fee_receipt_images = [{
                "id": "1",
                "image": student_fee.get("receipt_image"),
                "uploaded_at": student_fee.get("receipt_updated_at", "")
            }]
    
    # Also collect receipt images from individual payments
    payment_receipt_ids = set()
    for p in payments:
        if p.get("receipt_image"):
            img_prefix = p["receipt_image"][:50] if len(p["receipt_image"]) > 50 else p["receipt_image"]
            if img_prefix not in payment_receipt_ids:
                payment_receipt_ids.add(img_prefix)
                student_fee_receipt_images.append({
                    "id": f"payment_{p.get('id', len(student_fee_receipt_images))}",
                    "image": p["receipt_image"],
                    "uploaded_at": p.get("created_at", ""),
                    "source": "payment"
                })
    
    return {
        "student": serialize_doc(student),
        "fee_structures": [serialize_doc(f) for f in fee_structures],
        "payments": [serialize_doc(p) for p in payments],
        "total_fees": total_fees,
        "total_paid": total_paid,
        "balance": balance,
        "status": "fully_paid" if balance <= 0 else ("partial" if total_paid > 0 else "unpaid"),
        "receipt_images": student_fee_receipt_images,
        "receipt_image": student_fee_receipt_images[-1]["image"] if student_fee_receipt_images else None
    }

@api_router.put("/student-fees/{student_id}/total")
async def update_student_total_fees(student_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Update total fees for a student - Secretary/Principal only"""
    
    user_role = current_user.get("role", "").lower()
    if user_role not in ["secretary", "principal", "coordinator"]:
        raise HTTPException(status_code=403, detail="Not authorized to update fees")
    
    # Get student - try by id first, then by admission_no (for DLP students)
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        student = await db.students.find_one({"admission_no": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    body = await request.json()
    new_total_fees = body.get("total_fees")
    
    if new_total_fees is None:
        raise HTTPException(status_code=400, detail="total_fees is required")
    
    try:
        new_total_fees = float(new_total_fees)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="total_fees must be a number")
    
    chain = student.get("chain")
    
    # Check if student_fees record exists
    student_fee = await db.student_fees.find_one({"student_id": student_id})
    
    # Get current paid amount
    payments = await db.payments.find({"student_id": student_id}, {"_id": 0}).to_list(100)
    total_paid = sum(p.get("amount", 0) for p in payments)
    
    # Calculate new balance and status
    balance = new_total_fees - total_paid
    if balance <= 0:
        status = "paid"
    elif total_paid > 0:
        status = "partial"
    else:
        status = "pending"
    
    if student_fee:
        # Update existing record
        await db.student_fees.update_one(
            {"student_id": student_id},
            {"$set": {
                "amount": new_total_fees,
                "balance": balance,
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.get("id")
            }}
        )
    else:
        # Create new record
        await db.student_fees.insert_one({
            "id": str(uuid.uuid4()),
            "student_id": student_id,
            "chain": chain,
            "amount": new_total_fees,
            "paid_amount": total_paid,
            "balance": balance,
            "status": status,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user.get("id")
        })
    
    return {
        "message": "Total fees updated successfully",
        "student_id": student_id,
        "total_fees": new_total_fees,
        "total_paid": total_paid,
        "balance": balance,
        "status": status
    }

@api_router.put("/student-fees/{student_id}/receipt")
async def upload_student_receipt(student_id: str, data: Dict, current_user: dict = Depends(get_current_user)):
    """Upload/update receipt image for a student (stored in student_fees collection) - Secretary only"""
    if current_user and current_user.get('role') not in ['secretary']:
        raise HTTPException(status_code=403, detail="Only secretary can upload receipt images")
    
    receipt_image = data.get("receipt_image")
    if not receipt_image:
        raise HTTPException(status_code=400, detail="receipt_image is required")
    
    # Validate it looks like a base64 image
    if not receipt_image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image format. Must be a base64 data URL")
    
    # Enforce max image size of 500 KB (0.5 MB)
    try:
        # Strip the data URL prefix (e.g. "data:image/jpeg;base64,") to get the raw base64
        base64_part = receipt_image.split(",", 1)[1] if "," in receipt_image else receipt_image
        # Decode base64 to get the actual byte size of the image
        import base64 as _b64
        decoded_size = len(_b64.b64decode(base64_part))
        if decoded_size > 500 * 1024:
            raise HTTPException(status_code=400, detail="Image must be less than 500KB")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    
    # Check if student_fees record exists
    student_fee = await db.student_fees.find_one({"student_id": student_id})

    
    if student_fee:
        # Get existing receipt images array or create new one
        existing_images = student_fee.get("receipt_images", [])
        if not existing_images and student_fee.get("receipt_image"):
            # Migrate old single receipt to array
            existing_images = [{
                "id": str(uuid.uuid4())[:8],
                "image": student_fee["receipt_image"],
                "uploaded_at": student_fee.get("receipt_updated_at", datetime.now(timezone.utc).isoformat()),
                "uploaded_by": student_fee.get("receipt_updated_by", current_user.get("id"))
            }]
        
        # Add new receipt image to the array
        new_receipt = {
            "id": str(uuid.uuid4())[:8],
            "image": receipt_image,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "uploaded_by": current_user.get("id")
        }
        existing_images.append(new_receipt)
        
        # Update existing record with receipt images array
        await db.student_fees.update_one(
            {"student_id": student_id},
            {"$set": {
                "receipt_images": existing_images,
                "receipt_image": receipt_image,  # Keep latest as primary for backward compat
                "receipt_updated_at": datetime.now(timezone.utc).isoformat(),
                "receipt_updated_by": current_user.get("id")
            }}
        )
    else:
        # Get student info
        student = await db.students.find_one({"id": student_id}, {"_id": 0})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        new_receipt = {
            "id": str(uuid.uuid4())[:8],
            "image": receipt_image,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "uploaded_by": current_user.get("id")
        }
        
        # Create new student_fees record with receipt
        await db.student_fees.insert_one({
            "id": str(uuid.uuid4()),
            "student_id": student_id,
            "chain": student.get("chain"),
            "amount": 0,
            "paid_amount": 0,
            "balance": 0,
            "status": "pending",
            "receipt_images": [new_receipt],
            "receipt_image": receipt_image,
            "receipt_updated_at": datetime.now(timezone.utc).isoformat(),
            "receipt_updated_by": current_user.get("id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"success": True, "message": "Receipt image uploaded successfully"}


@api_router.delete("/student-fees/{student_id}/receipt/{receipt_id}")
async def delete_student_receipt(student_id: str, receipt_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific receipt image from a student's receipt_images array - Secretary only"""
    if current_user and current_user.get('role') not in ['secretary']:
        raise HTTPException(status_code=403, detail="Only secretary can delete receipt images")
    
    # Check if student_fees record exists
    student_fee = await db.student_fees.find_one({"student_id": student_id})
    if not student_fee:
        raise HTTPException(status_code=404, detail="Student fee record not found")
    
    existing_images = student_fee.get("receipt_images", [])
    
    # Find and remove the receipt with matching id
    filtered_images = [img for img in existing_images if img.get("id") != receipt_id]
    
    if len(filtered_images) == len(existing_images):
        raise HTTPException(status_code=404, detail="Receipt image not found")
    
    # Update the record
    update_data = {
        "receipt_images": filtered_images,
        "receipt_updated_at": datetime.now(timezone.utc).isoformat(),
        "receipt_updated_by": current_user.get("id")
    }
    
    # Update the primary receipt_image field too (set to latest remaining or null)
    if filtered_images:
        update_data["receipt_image"] = filtered_images[-1]["image"]
    else:
        update_data["receipt_image"] = None
    
    await db.student_fees.update_one(
        {"student_id": student_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Receipt image deleted successfully"}


@api_router.get("/all-student-fees")

async def get_all_student_fees(
    class_name: Optional[str] = None,
    fee_status: Optional[str] = None,
    chain: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all student fee records with student details for fee management display.
    
    Supports pagination via page and page_size parameters to prevent HTTP/2 protocol errors
    from large response payloads.
    """
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary, principal, director, or coordinator can view all fee records")
    
    # Validate pagination params - STRICT 100 max to prevent memory overload
    page = max(1, page)
    page_size = max(1, min(100, page_size))  # Cap at 100 per page (was 1000 - too heavy!)
    
    # Use explicit chain param if provided (for Directors/Coordinators filtering by chain)
    if chain:
        # Strip any suffix like ":1" from chain value (e.g., "DLP:1" -> "DLP")
        clean_chain = chain.upper().split(':')[0]
        chain_filter = {'chain': clean_chain}
    else:
        chain_filter = get_chain_filter(current_user) if current_user else {}
    
    # Get total count first (for pagination metadata)
    student_query = {**chain_filter}
    if class_name:
        student_query["class_name"] = class_name
    
    total_students = await db.students.count_documents(student_query)
    total_pages = max(1, (total_students + page_size - 1) // page_size)
    
    # Get paginated students - exclude heavy fields
    skip = (page - 1) * page_size
    students_cursor = db.students.find(student_query, {"_id": 1, "id": 1, "first_name": 1, "last_name": 1, "admission_no": 1, "class_name": 1, "chain": 1, "status": 1})
    students_cursor.sort("first_name", 1).skip(skip).limit(page_size)
    students = await students_cursor.to_list(page_size)
    
    # Build student ID map for lookups
    student_ids = []
    student_map = {}
    for s in students:
        # Get all possible identifiers for this student
        mongo_id = str(s.get("_id")) if s.get("_id") else None
        uuid_id = s.get("id")
        adm_no = s.get("admission_no")
        
        # Use UUID id as primary if available (payments use UUID), otherwise fall back
        sid = uuid_id or mongo_id or adm_no
        if sid:
            s["id"] = s.get("id") or str(s.get("_id"))
            student_map[sid] = s
            student_ids.append(sid)
        
        # Also add all other identifiers so payments can be found regardless of which ID they use
        if mongo_id and mongo_id != sid:
            student_ids.append(mongo_id)
        if uuid_id and uuid_id != sid:
            student_ids.append(uuid_id)
        if adm_no and adm_no != sid:
            student_ids.append(adm_no)
    
    # If no students, return empty result
    if not student_ids:
        return {"students": [], "pagination": {"page": page, "page_size": page_size, "total": 0, "total_pages": 0}}
    
    # Build a filter that matches any of the current page's student IDs
    page_student_filter = {"student_id": {"$in": student_ids}}
    
    # Scale the batch lookup limit - keep it small to prevent memory overload
    lookup_limit = min(500, page_size * 3)
    
    # Get fee records for this page's students only.
    # IMPORTANT: We project OUT the receipt_image / receipt_images fields here.
    # Those base64 blobs are 1-5 MB each and are NOT needed for the table rows
    # (the full images are fetched on demand via /api/student-fees/{id}).
    # Loading them for every student on the page makes the response enormous
    # and causes Nginx proxy_read_timeout (504) / Cloudflare buffer (520) errors.
    try:
        fee_records = await db.student_fees.find(
            page_student_filter,
            {"_id": 0, "receipt_image": 0, "receipt_images": 0}
        ).to_list(lookup_limit)
    except Exception:
        fee_records = []
    fee_map = {f["student_id"]: f for f in fee_records}

    
    # Get special details for this page's students only
    try:
        special_details = await db.student_special_details.find(page_student_filter, {"_id": 0}).to_list(lookup_limit)
    except Exception:
        special_details = []
    special_details_map = {sd["student_id"]: sd for sd in special_details}
    
    # Get special fees for this page's students only
    try:
        special_fees = await db.special_fees.find(page_student_filter, {"_id": 0}).to_list(lookup_limit)
    except Exception:
        special_fees = []
    special_fee_map = {}
    for sf in special_fees:
        sid = sf.get("student_id")
        if sid not in special_fee_map:
            special_fee_map[sid] = sf.get("fee_type", "tuition")
    
    # Get payments for this page's students only.
    # IMPORTANT: We project OUT the receipt_image field here. Each payment's
    # receipt_image is a 1-5 MB base64 blob, and with page_size=1000 the
    # lookup_limit is 3000 — loading all of them into memory makes the response
    # enormous and causes Nginx proxy_read_timeout (504) / Cloudflare buffer
    # (520) errors. The table only needs student_id, amount, fee_type, and
    # created_at. The full receipt images are fetched on demand via
    # /api/student-fees/{id}.
    try:
        payments = await db.payments.find(
            page_student_filter,
            {"_id": 0, "receipt_image": 0}
        ).to_list(lookup_limit)
    except Exception:
        payments = []
    payment_map = {}
    paid_totals = {}
    fee_type_from_payment = {}
    for p in payments:
        sid = p.get("student_id")
        if sid not in payment_map:
            payment_map[sid] = []
            paid_totals[sid] = 0
        payment_map[sid].append(p)
        paid_totals[sid] += p.get("amount", 0)
        if p.get("fee_type"):
            fee_type_from_payment[sid] = p.get("fee_type")

    
    # Pre-fetch fee structures for chains that might need fallback.
    # Instead of querying per-student (N+1), batch-fetch all active fee
    # structures for the chains present on this page in a single query.
    chains_on_page = set()
    for s in students:
        if s.get("chain"):
            chains_on_page.add(s.get("chain"))
    
    fee_structure_cache = {}
    if chains_on_page:
        try:
            all_fee_structures = await db.fee_structures.find({
                "chain": {"$in": list(chains_on_page)},
                "status": "active"
            }, {"_id": 0}).to_list(lookup_limit)
            # Index by (chain, class_name) for O(1) lookups
            for fs in all_fee_structures:
                fs_chain = fs.get("chain")
                fs_class = fs.get("class_name") or ""
                key = f"{fs_chain}:{fs_class}"
                if key not in fee_structure_cache:
                    fee_structure_cache[key] = []
                fee_structure_cache[key].append(fs)
        except Exception:
            fee_structure_cache = {}
    
    result = []

    for student in students:
        actual_mongo_id = str(student.get("_id", ""))
        adm_no = student.get("admission_no", "")
        student_id = student.get("id") or adm_no
        if not student_id:
            continue
        
        fee_record = fee_map.get(student_id, {})
        if not fee_record:
            fee_record = fee_map.get(adm_no, {})
        if not fee_record and actual_mongo_id:
            fee_record = fee_map.get(actual_mongo_id, {})
        
        # Try to get payments by multiple possible identifiers
        student_payments = payment_map.get(student_id, [])
        if not student_payments and adm_no:
            student_payments = payment_map.get(adm_no, [])
        if not student_payments and actual_mongo_id:
            student_payments = payment_map.get(actual_mongo_id, [])
        
        # Use the identifier that actually has payments for paid_totals lookup
        effective_id = student_id
        if not paid_totals.get(effective_id, 0) and adm_no and paid_totals.get(adm_no, 0):
            effective_id = adm_no
        elif not paid_totals.get(effective_id, 0) and actual_mongo_id and paid_totals.get(actual_mongo_id, 0):
            effective_id = actual_mongo_id
        
        # Get total fee - try student_fees first, then fall back to fee structures
        total_fee = fee_record.get("amount", 0)
        
        # If no student_fees record, fall back to fee structures (batched, no N+1)
        if total_fee == 0:
            s_chain = student.get("chain")
            s_class = student.get("class_name")
            
            # Look up class-specific structures first, then generic (class_name empty/None)
            class_key = f"{s_chain}:{s_class}"
            generic_key = f"{s_chain}:"
            applicable = fee_structure_cache.get(class_key, [])
            if not applicable:
                applicable = fee_structure_cache.get(generic_key, [])
            
            total_fee = sum(f.get("amount", 0) for f in applicable)
        
        # Use calculated paid amount from payments collection
        paid_amount = paid_totals.get(effective_id, 0)
        outstanding = total_fee - paid_amount
        
        # Determine status
        if total_fee == 0:
            current_fee_status = "no_fee"
        elif outstanding <= 0:
            current_fee_status = "paid"
        elif paid_amount > 0:
            current_fee_status = "partial"
        else:
            current_fee_status = "unpaid"
        
        # Apply status filter
        if fee_status and current_fee_status != fee_status:
            continue
        
        # Get latest payment date, the latest receipt image, and count receipts.
        # IMPORTANT: We do NOT include the FULL receipt_images array in this list
        # response. Receipts are large (1-5 MB each as base64) and including ALL of
        # them for every student on the page makes the payload enormous, which
        # causes Nginx proxy_read_timeout (504) and Cloudflare buffer (520) errors.
        # We return only the LATEST receipt image (so the table can render the
        # "View Receipt" button) plus a receipt_count. The full set of images is
        # fetched on demand via /api/student-fees/{student_id}.
        last_payment_date = None
        latest_receipt_image = None
        receipt_count = 0
        
        # Collect receipts from student_fees level
        if fee_record.get("receipt_images"):
            receipt_images_list = list(fee_record.get("receipt_images", []))
            receipt_count += len(receipt_images_list)
            if not latest_receipt_image and receipt_images_list:
                latest_receipt_image = receipt_images_list[-1].get("image") if isinstance(receipt_images_list[-1], dict) else receipt_images_list[-1]
        elif fee_record.get("receipt_image"):
            receipt_count += 1
            latest_receipt_image = fee_record.get("receipt_image")
        
        # Collect receipts from individual payments
        if student_payments:
            sorted_payments = sorted(student_payments, key=lambda x: x.get("created_at", ""), reverse=True)
            last_payment_date = sorted_payments[0].get("created_at")
            
            payment_receipt_ids = set()
            for sp in sorted_payments:
                if sp.get("receipt_image"):
                    img_prefix = sp["receipt_image"][:50] if len(sp["receipt_image"]) > 50 else sp["receipt_image"]
                    if img_prefix not in payment_receipt_ids:
                        payment_receipt_ids.add(img_prefix)
                        receipt_count += 1
                        if not latest_receipt_image:
                            latest_receipt_image = sp["receipt_image"]

        
        # Get special notes and fee type
        student_special = special_details_map.get(student_id, {})
        fee_type = fee_type_from_payment.get(student_id) or special_fee_map.get(student_id, "tuition")
        
        result.append({
            "id": student_id,
            "student_id": student_id,
            "first_name": student.get("first_name", ""),
            "last_name": student.get("last_name", ""),
            "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
            "admission_no": student.get("admission_no", ""),
            "class_name": student.get("class_name", "N/A"),
            "total_fees": total_fee,
            "total_paid": paid_amount,
            "paid": paid_amount,
            "balance": outstanding,
            "outstanding": outstanding,
            "status": current_fee_status,
            # Admission status (active / graduated / left / suspended / transferred).
            # Used by the All Students table to show graduated / left-school badges
            # and to exclude those students from active analytics.
            "student_status": (student.get("status") or "active").lower(),
            "last_payment_date": last_payment_date,
            "receipt_count": receipt_count,

            # Include ONLY the latest receipt image (not the full array) so the
            # All Students table can render the "View Receipt" button. The full
            # set of images is fetched on demand via /api/student-fees/{id}.
            "receipt_image": latest_receipt_image,
            "special_notes": student_special.get("special_notes", ""),
            "fee_type": fee_type
        })

    
    # Sort by name
    result.sort(key=lambda x: x["name"])
    
    return {
        "students": result,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total_students,
            "total_pages": total_pages
        }
    }

@api_router.get("/financial-report")
async def get_financial_report(
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get financial report with collection rates"""
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary, principal, director, or coordinator can view financial reports")
    
    chain_filter = get_chain_filter(current_user) if current_user else {}
    if chain:
        chain_filter["chain"] = chain
    
    # Get all students in chain
    students = await db.students.find(chain_filter, {"_id": 0, "password_hash": 0}).to_list(1000)
    student_map = {s["id"]: s for s in students}
    
    # Get all student fee records (individual fee assignments)
    student_fees = await db.student_fees.find(chain_filter, {"_id": 0}).to_list(2000)
    
    # Get all payments
    payments = await db.payments.find(chain_filter, {"_id": 0}).sort("created_at", -1).to_list(2000)
    
    # Calculate totals from student_fees collection
    total_expected = sum(f.get("amount", 0) for f in student_fees)
    total_collected = sum(f.get("paid_amount", 0) for f in student_fees)
    
    # If no student_fees records, fall back to fee structures
    if not student_fees:
        fee_structures = await db.fee_structures.find({**chain_filter, "status": "active"}, {"_id": 0}).to_list(100)
        for student in students:
            class_name = student.get("class_name")
            applicable_fees = [f for f in fee_structures if not f.get("class_name") or f.get("class_name") == class_name]
            total_expected += sum(f.get("amount", 0) for f in applicable_fees)
        total_collected = sum(p.get("amount", 0) for p in payments)
    
    collection_rate = (total_collected / total_expected * 100) if total_expected > 0 else 0
    
    # Group by payment status
    paid_count = len([f for f in student_fees if f.get("status") == "paid"])
    partial_count = len([f for f in student_fees if f.get("status") == "partial"])
    unpaid_count = len([f for f in student_fees if f.get("status") == "pending"])
    
    return {
        "total_students": len(students),
        "total_expected": total_expected,
        "total_collected": total_collected,
        "outstanding_balance": total_expected - total_collected,
        "collection_rate": round(collection_rate, 2),
        "paid_count": paid_count,
        "partial_count": partial_count,
        "unpaid_count": unpaid_count,
        "recent_payments": [serialize_doc(p) for p in payments[:20]]
    }

@api_router.get("/financial-report-students")
async def get_financial_report_students(
    chain: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Dedicated lightweight endpoint for the Financial Report tab.

    Returns summary totals for ALL students plus paginated per-student rows.
    Uses aggregation for totals to prevent memory overload.

    Supports an optional `search` term (name / admission no / class) that is
    applied AT THE DATABASE LEVEL. This lets the UI find a single student
    (e.g. "YUSRA") without having to download the entire student list, which
    keeps memory usage low and avoids 503/520 errors on large chains.
    """
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary, principal, director, or coordinator can view financial reports")

    chain_filter = get_chain_filter(current_user) if current_user else {}
    if chain:
        clean_chain = chain.upper().split(':')[0]
        chain_filter["chain"] = clean_chain

    # Optional server-side search. Applied to the SAME filter used for both the
    # summary and the paginated rows so the totals always match what is shown.
    # We escape regex metacharacters so a user typing e.g. "(" cannot break the
    # query, and match case-insensitively against name / admission no / class.
    if search and search.strip():
        import re as _re
        _term = _re.escape(search.strip())
        _rx = {"$regex": _term, "$options": "i"}
        chain_filter = {
            "$and": [
                chain_filter,
                {"$or": [
                    {"first_name": _rx},
                    {"last_name": _rx},
                    {"admission_no": _rx},
                    {"class_name": _rx},
                ]}
            ]
        }

    # Pagination. The Financial Report tab paginates CLIENT-SIDE (20 rows per
    # page) over the full student list, so it must be able to fetch EVERY
    # student in one request. The response is already lightweight (no receipt
    # images, batched lookups), so a high cap is safe. Previously this was
    # capped at 50, which silently hid every student after position 50 (e.g.
    # students whose names sort late in the alphabet) from the report.
    page = max(1, page)
    page_size = max(1, min(1000, page_size))
    skip = (page - 1) * page_size

    # Get total count for pagination
    total_students = await db.students.count_documents(chain_filter)
    total_pages = max(1, (total_students + page_size - 1) // page_size)

    # ========== SUMMARY CALCULATION over ALL ACTIVE students ==========
    # The analytics (expected / collected / outstanding / paid / partial /
    # unpaid) must reflect EVERY active student, NOT just the 50 rows on the
    # current page. To avoid memory overload / 502 errors we fetch only the
    # lightweight fields (no receipt images) and use batched $in queries.
    active_filter = {**chain_filter, "status": {"$nin": ["graduated", "left"]}}
    active_count = await db.students.count_documents(active_filter)

    # Count graduated and left (for display only)
    graduated_count = await db.students.count_documents({**chain_filter, "status": "graduated"})
    left_count = await db.students.count_documents({**chain_filter, "status": "left"})

    # Fetch ALL active students (lightweight fields only) in batches of 200.
    # This is what lets the analytics cover every student without loading
    # receipt images or building one giant in-memory list.
    all_active_students = []
    _batch_size = 200
    _cursor = db.students.find(
        active_filter,
        {"_id": 1, "id": 1, "first_name": 1, "last_name": 1, "admission_no": 1,
         "class_name": 1, "chain": 1, "status": 1}
    )
    while True:
        _batch = await _cursor.to_list(_batch_size)
        if not _batch:
            break
        all_active_students.extend(_batch)
        if len(_batch) < _batch_size:
            break

    # Build the set of identifiers used to look up fee records + payments.
    all_ids = []
    for s in all_active_students:
        mongo_id = str(s.get("_id")) if s.get("_id") else None
        uuid_id = s.get("id")
        adm_no = s.get("admission_no")
        for ident in [uuid_id, mongo_id, adm_no]:
            if ident and ident not in all_ids:
                all_ids.append(ident)

    # Batched fee records for ALL active students (no receipt images).
    # A student can have MULTIPLE fee records (e.g. tuition + uniform +
    # admission), so we SUM the amounts per student instead of keeping only
    # the last record. We also iterate the cursor in batches so no records are
    # silently dropped by a hard .to_list() cap.
    all_fee_totals = {}
    if all_ids:
        for i in range(0, len(all_ids), 200):
            _chunk = all_ids[i:i + 200]
            try:
                _cursor = db.student_fees.find(
                    {"student_id": {"$in": _chunk}},
                    {"_id": 0, "student_id": 1, "amount": 1}
                )
                while True:
                    _fees = await _cursor.to_list(200)
                    if not _fees:
                        break
                    for f in _fees:
                        sid = f.get("student_id")
                        if sid:
                            all_fee_totals[sid] = all_fee_totals.get(sid, 0) + (f.get("amount") or 0)
                    if len(_fees) < 200:
                        break
            except Exception:
                pass

    # Batched payments for ALL active students (only amount needed).
    # Iterate the cursor in batches so no payments are dropped by a hard cap.
    all_paid_totals = {}
    if all_ids:
        for i in range(0, len(all_ids), 200):
            _chunk = all_ids[i:i + 200]
            try:
                _cursor = db.payments.find(
                    {"student_id": {"$in": _chunk}},
                    {"_id": 0, "student_id": 1, "amount": 1}
                )
                while True:
                    _pays = await _cursor.to_list(200)
                    if not _pays:
                        break
                    for p in _pays:
                        sid = p.get("student_id")
                        if sid:
                            all_paid_totals[sid] = all_paid_totals.get(sid, 0) + (p.get("amount") or 0)
                    if len(_pays) < 200:
                        break
            except Exception:
                pass


    # Fee-structure fallback cache (for students without a student_fees record).
    _chains = set(s.get("chain") for s in all_active_students if s.get("chain"))
    all_fs_cache = {}
    if _chains:
        try:
            _fss = await db.fee_structures.find(
                {"chain": {"$in": list(_chains)}, "status": "active"},
                {"_id": 0, "chain": 1, "class_name": 1, "amount": 1}
            ).to_list(500)
            for fs in _fss:
                key = f"{fs.get('chain')}:{fs.get('class_name') or ''}"
                all_fs_cache.setdefault(key, []).append(fs)
        except Exception:
            all_fs_cache = {}

    # Aggregate per-student totals across ALL active students.
    total_expected = 0
    total_collected = 0
    paid_count = 0
    partial_count = 0
    unpaid_count = 0
    for student in all_active_students:
        actual_mongo_id = str(student.get("_id", ""))
        adm_no = student.get("admission_no", "")
        student_id = student.get("id") or adm_no
        if not student_id:
            continue

        # Resolve total fee across all possible identifiers. all_fee_totals
        # already holds the SUM of every fee record for the student.
        total_fee = (all_fee_totals.get(student_id)
                     or all_fee_totals.get(adm_no)
                     or all_fee_totals.get(actual_mongo_id)
                     or 0)

        # Resolve paid total across all possible identifiers.
        paid_amount = all_paid_totals.get(student_id, 0)
        if not paid_amount and adm_no:
            paid_amount = all_paid_totals.get(adm_no, 0)
        if not paid_amount and actual_mongo_id:
            paid_amount = all_paid_totals.get(actual_mongo_id, 0)

        # Total fee: student_fees first, then fee-structure fallback.
        if total_fee == 0:
            s_chain = student.get("chain")
            s_class = student.get("class_name")
            applicable = (all_fs_cache.get(f"{s_chain}:{s_class}", [])
                          or all_fs_cache.get(f"{s_chain}:", []))
            total_fee = sum(f.get("amount", 0) for f in applicable)


        outstanding = total_fee - paid_amount

        if total_fee == 0:
            fee_status = "no_fee"
        elif outstanding <= 0:
            fee_status = "paid"
        elif paid_amount > 0:
            fee_status = "partial"
        else:
            fee_status = "unpaid"

        total_expected += total_fee
        total_collected += paid_amount
        if fee_status == "paid":
            paid_count += 1
        elif fee_status == "partial":
            partial_count += 1
        elif fee_status == "unpaid":
            unpaid_count += 1

    outstanding_balance = total_expected - total_collected
    if outstanding_balance < 0:
        outstanding_balance = 0
    collection_rate = round((total_collected / total_expected * 100), 2) if total_expected > 0 else 0

    # ========== PAGINATED STUDENT LIST ==========
    # Fetch ONLY the fields needed for the table, paginated
    students = await db.students.find(
        chain_filter, 
        {"_id": 1, "id": 1, "first_name": 1, "last_name": 1, "admission_no": 1, "class_name": 1, "chain": 1, "status": 1}
    ).sort("first_name", 1).skip(skip).limit(page_size).to_list(page_size)

    if not students:
        return {
            "summary": {
                "total_students": active_count,
                "total_expected": total_expected,
                "total_collected": total_collected,
                "outstanding_balance": outstanding_balance,
                "collection_rate": collection_rate,
                "paid_count": paid_count,
                "partial_count": partial_count,
                "unpaid_count": unpaid_count,
                "graduated_count": graduated_count,
                "left_count": left_count
            },
            "students": [],
            "pagination": {"page": page, "page_size": page_size, "total": total_students, "total_pages": total_pages}
        }

    # Collect student identifiers for batched lookups (this page only)
    student_ids = []
    for s in students:
        mongo_id = str(s.get("_id")) if s.get("_id") else None
        uuid_id = s.get("id")
        adm_no = s.get("admission_no")
        for ident in [uuid_id, mongo_id, adm_no]:
            if ident and ident not in student_ids:
                student_ids.append(ident)

    page_student_filter = {"student_id": {"$in": student_ids}}
    lookup_limit = min(300, len(student_ids) * 3)

    # Batched fee records
    try:
        fee_records = await db.student_fees.find(page_student_filter, {"_id": 0}).to_list(lookup_limit)
    except Exception:
        fee_records = []
    fee_map = {f["student_id"]: f for f in fee_records}

    # Batched payments (only amount + fee_type needed, no receipt_image)
    try:
        payments = await db.payments.find(
            page_student_filter,
            {"_id": 0, "student_id": 1, "amount": 1, "fee_type": 1}
        ).to_list(lookup_limit)
    except Exception:
        payments = []
    paid_totals = {}
    fee_type_from_payment = {}
    for p in payments:
        sid = p.get("student_id")
        paid_totals[sid] = paid_totals.get(sid, 0) + p.get("amount", 0)
        if p.get("fee_type") and sid not in fee_type_from_payment:
            fee_type_from_payment[sid] = p.get("fee_type")

    # Batched special fees (for fee_type fallback)
    try:
        special_fees = await db.special_fees.find(page_student_filter, {"_id": 0, "student_id": 1, "fee_type": 1}).to_list(lookup_limit)
    except Exception:
        special_fees = []
    special_fee_map = {}
    for sf in special_fees:
        sid = sf.get("student_id")
        if sid not in special_fee_map:
            special_fee_map[sid] = sf.get("fee_type", "tuition")

    # Batched fee structures for fallback when a student has no student_fees record
    chains_on_page = set(s.get("chain") for s in students if s.get("chain"))
    fee_structure_cache = {}
    if chains_on_page:
        try:
            all_fee_structures = await db.fee_structures.find({
                "chain": {"$in": list(chains_on_page)},
                "status": "active"
            }, {"_id": 0}).to_list(lookup_limit)
            for fs in all_fee_structures:
                key = f"{fs.get('chain')}:{fs.get('class_name') or ''}"
                if key not in fee_structure_cache:
                    fee_structure_cache[key] = []
                fee_structure_cache[key].append(fs)
        except Exception:
            fee_structure_cache = {}

    result = []
    page_paid_count = 0
    page_partial_count = 0
    page_unpaid_count = 0

    for student in students:
        actual_mongo_id = str(student.get("_id", ""))
        adm_no = student.get("admission_no", "")
        student_id = student.get("id") or adm_no
        if not student_id:
            continue

        # Determine the student's admission status (graduated / left / active)
        student_status = (student.get("status") or "active").lower()
        is_inactive = student_status in ("graduated", "left")

        # Resolve fee record across all possible identifiers
        fee_record = fee_map.get(student_id) or fee_map.get(adm_no) or fee_map.get(actual_mongo_id) or {}

        # Resolve paid total across all possible identifiers
        paid_amount = paid_totals.get(student_id, 0)
        if not paid_amount and adm_no:
            paid_amount = paid_totals.get(adm_no, 0)
        if not paid_amount and actual_mongo_id:
            paid_amount = paid_totals.get(actual_mongo_id, 0)

        # Total fee: student_fees first, then fee-structure fallback
        total_fee = fee_record.get("amount", 0)
        if total_fee == 0:
            s_chain = student.get("chain")
            s_class = student.get("class_name")
            applicable = fee_structure_cache.get(f"{s_chain}:{s_class}", []) or fee_structure_cache.get(f"{s_chain}:", [])
            total_fee = sum(f.get("amount", 0) for f in applicable)

        outstanding = total_fee - paid_amount

        if total_fee == 0:
            fee_status = "no_fee"
        elif outstanding <= 0:
            fee_status = "paid"
        elif paid_amount > 0:
            fee_status = "partial"
        else:
            fee_status = "unpaid"

        # Count for this page only (for display, not for totals)
        if not is_inactive:
            if fee_status == "paid":
                page_paid_count += 1
            elif fee_status == "partial":
                page_partial_count += 1
            elif fee_status == "unpaid":
                page_unpaid_count += 1

        fee_type = fee_type_from_payment.get(student_id) or special_fee_map.get(student_id, "tuition")

        result.append({
            "id": student_id,
            "student_id": student_id,
            "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
            "admission_no": adm_no,
            "class_name": student.get("class_name", "N/A"),
            "total_fees": total_fee,
            "total_paid": paid_amount,
            "paid": paid_amount,
            "balance": outstanding,
            "outstanding": outstanding,
            "status": fee_status,
            "student_status": student_status,
            "fee_type": fee_type
        })

    result.sort(key=lambda x: x["name"])

    return {
        "summary": {
            "total_students": active_count,  # Active students only
            "total_expected": total_expected,
            "total_collected": total_collected,
            "outstanding_balance": outstanding_balance,
            "collection_rate": collection_rate,
            "paid_count": paid_count,
            "partial_count": partial_count,
            "unpaid_count": unpaid_count,
            "graduated_count": graduated_count,
            "left_count": left_count
        },
        "students": result,
        "pagination": {"page": page, "page_size": page_size, "total": total_students, "total_pages": total_pages}
    }



# ============ REPORT CARDS ROUTES ============

@api_router.get("/report-cards", response_model=List[Dict])
async def get_report_cards(
    student_id: Optional[str] = None,
    term: Optional[str] = None,
    academic_year: Optional[str] = None,
    report_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if student_id:
        query["student_id"] = student_id
    if term:
        query["term"] = term
    if academic_year:
        query["academic_year"] = academic_year
    if report_status:
        query["status"] = report_status
    
    report_cards = await db.report_cards.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(r) for r in report_cards]

@api_router.get("/report-cards/{report_id}")
async def get_report_card(report_id: str, current_user: dict = Depends(get_current_user)):
    report = await db.report_cards.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report card not found")
    return serialize_doc(report)

@api_router.post("/report-cards", response_model=Dict)
async def create_report_card(report: ReportCard, current_user: dict = Depends(get_current_user)):
    # Only teachers, academics, section leaders can create report cards
    if current_user and current_user.get('role') not in ['teacher', 'academic', 'section_leader', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only teachers, academics, or section leaders can create report cards")
    
    report_doc = report.model_dump()
    report_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    report_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Check for existing report card for same student/term/year
    existing = await db.report_cards.find_one({
        "student_id": report.student_id,
        "term": report.term,
        "academic_year": report.academic_year
    })
    
    if existing:
        # Update existing
        await db.report_cards.update_one(
            {"id": existing["id"]},
            {"$set": {k: v for k, v in report_doc.items() if k != "id"}}
        )
        report_doc["id"] = existing["id"]
    else:
        await db.report_cards.insert_one(report_doc)
    
    report_doc.pop('_id', None)
    return report_doc




@api_router.put("/report-cards/{report_id}")
async def update_report_card(report_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.report_cards.update_one({"id": report_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report card not found")
    report = await db.report_cards.find_one({"id": report_id}, {"_id": 0})
    return serialize_doc(report)

@api_router.post("/report-cards/{report_id}/send")
async def send_report_card(report_id: str, current_user: dict = Depends(get_current_user)):
    """Mark report card as sent to student portal"""
    result = await db.report_cards.update_one(
        {"id": report_id},
        {"$set": {
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report card not found")
    
    # Send push notification to the student
    report = await db.report_cards.find_one({"id": report_id}, {"_id": 0})
    if report:
        student_id = report.get("student_id")
        if student_id:
            student = await db.students.find_one({"id": student_id}, {"_id": 0, "password_hash": 0})
            student_name = f"{student.get('first_name', '')} {student.get('last_name', '')}".strip() if student else "Student"
            term = report.get("term", "")
            academic_year = report.get("academic_year", "")
            try:
                await send_push_notification(
                    student_id,
                    "Report Card Ready",
                    f"Dear {student_name}, your report card for Term {term} ({academic_year}) is now available.",
                    "/portal/student-portal"
                )
            except Exception as e:
                logger.warning(f"Failed to send report card push notification: {e}")
    
    return {"success": True, "message": "Report card sent to student portal"}


# ============ SCHOOL SETTINGS API ============
# School settings (name, logo) stored in a single document in 'school_settings' collection

@api_router.get("/school-settings")
async def get_school_settings(current_user: dict = Depends(get_current_user)):
    """Get school settings (name, logo)"""
    settings = await db.school_settings.find_one({"_id": "main"}, {"_id": 0})
    if not settings:
        return {"school_name": "IHEZA", "school_subtitle": "The Institute of Holistic Education of Zanzibar", "logo": None}
    return settings

class SchoolSettingsUpdate(BaseModel):
    school_name: Optional[str] = None
    school_subtitle: Optional[str] = None
    logo: Optional[str] = None

@api_router.put("/school-settings")
async def update_school_settings(
    settings: SchoolSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update school settings (name, logo) - Only principals and above"""
    user_role = current_user.get("role", "").lower()
    if user_role not in ["principal", "director", "coordinator", "academic", "section_leader"]:
        raise HTTPException(status_code=403, detail="Only principals, directors, coordinators, academics, or section leaders can update school settings")
    
    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("id", "unknown")
    
    await db.school_settings.update_one(
        {"_id": "main"},
        {"$set": update_data},
        upsert=True
    )
    
    result = await db.school_settings.find_one({"_id": "main"}, {"_id": 0})
    return result

@api_router.get("/student-report-card/{student_id}")
async def get_full_student_report_card(
    student_id: str,
    term: str,
    academic_year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get complete report card data for a student including grades and behavior marks"""
    
    if not academic_year:
        academic_year = str(datetime.now().year)
    
    # Get student
    student = await db.students.find_one({"id": student_id}, {"_id": 0, "password_hash": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get grades for this term
    grades = await db.grades.find({
        "student_id": student_id,
        "term": term
    }, {"_id": 0}).to_list(50)
    
    # Get ALL subjects for enrichment (not just the student's chain)
    # This is needed because grades might reference subjects from different chains (e.g., IHEZA)
    all_subjects = await db.subjects.find({}, {"_id": 0}).to_list(200)
    # Build subject map by both 'id' and '_id' fields for compatibility
    subject_map = {}
    for s in all_subjects:
        subject_map[s.get("id")] = s
        subject_map[s.get("_id")] = s
    
    # Enrich grades with subject names
    enriched_grades = []
    for g in grades:
        subject = subject_map.get(g.get("subject_id"), {})
        enriched_grades.append({
            **g,
            "subject_name": subject.get("name", "Unknown"),
            "subject_code": subject.get("code", "")
        })

    
    # Calculate totals
    total_score = sum(g.get("score", 0) for g in grades)
    avg_score = total_score / len(grades) if grades else 0
    
    # Get overall grade
    def get_grade(score):
        if score >= 81: return "A"
        if score >= 61: return "B"
        if score >= 41: return "C"
        if score >= 21: return "D"
        return "F"
    
    overall_grade = get_grade(avg_score)
    
    # Get report card metadata (behavior marks, comments)
    report_card = await db.report_cards.find_one({
        "student_id": student_id,
        "term": term,
        "academic_year": academic_year
    }, {"_id": 0})
    
    # Get class position (by average)
    class_students = await db.students.find({"class_name": student.get("class_name")}, {"_id": 0}).to_list(100)
    
    class_averages = []
    for s in class_students:
        s_grades = await db.grades.find({"student_id": s.get("id"), "term": term}, {"_id": 0}).to_list(50)
        s_total = sum(g.get("score", 0) for g in s_grades)
        s_avg = s_total / len(s_grades) if s_grades else 0
        class_averages.append({"id": s.get("id"), "avg": s_avg})
    
    # Sort and find position
    class_averages.sort(key=lambda x: x["avg"], reverse=True)
    position = next((i + 1 for i, x in enumerate(class_averages) if x["id"] == student_id), None)
    
    return {
        "student": serialize_doc(student),
        "term": term,
        "academic_year": academic_year,
        "grades": enriched_grades,
        "total_score": round(total_score, 2),
        "average": round(avg_score, 2),
        "overall_grade": overall_grade,
        "position": position,
        "total_students": len(class_students),
        "behavior_marks": {
            "neatness": report_card.get("neatness", 3) if report_card else 3,
            "cooperation": report_card.get("cooperation", 3) if report_card else 3,
            "responsibility": report_card.get("responsibility", 3) if report_card else 3,
            "punctuality": report_card.get("punctuality", 3) if report_card else 3,
            "discipline": report_card.get("discipline", 3) if report_card else 3
        },
        "teacher_comment": report_card.get("teacher_comment", "") if report_card else "",
        "principal_comment": report_card.get("principal_comment", "") if report_card else "",
        "status": report_card.get("status", "draft") if report_card else "draft",
        "report_card_id": report_card.get("id") if report_card else None
    }

@api_router.get("/reports/attendance")
async def get_attendance_report(
    target_type: Optional[str] = "staff",
    chain: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    query["target_type"] = target_type
    if chain:
        query["chain"] = chain
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    # Use aggregation pipeline to count directly in DB - MUCH more memory efficient
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    results = await db.attendance.aggregate(pipeline).to_list(10)
    
    # Parse results
    status_counts = {r["_id"]: r["count"] for r in results}
    total = sum(status_counts.values())
    present = status_counts.get("present", 0)
    absent = status_counts.get("absent", 0)
    late = status_counts.get("late", 0)
    
    return {
        "total_records": total,
        "present": present,
        "absent": absent,
        "late": late,
        "attendance_rate": round(present / total * 100, 2) if total > 0 else 0
    }

@api_router.get("/reports/staff-attendance-detailed")
async def get_staff_attendance_detailed(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month: Optional[str] = None,  # Format: YYYY-MM
    role: Optional[str] = None,
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed staff attendance with filters for date, month, and position"""
    query = get_chain_filter(current_user) if current_user else {}
    query["target_type"] = "staff"
    
    if chain:
        query["chain"] = chain
    
    # Date filters
    if month:
        # Filter by month (YYYY-MM)
        query["date"] = {"$regex": f"^{month}"}
    elif start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    records = await db.attendance.find(query, {"_id": 0, "target_id": 1, "status": 1, "date": 1}).sort("date", -1).to_list(1000)
    
    # Get all staff for role filtering
    staff_query = get_chain_filter(current_user) if current_user else {}
    if role:
        staff_query["role"] = role.lower()
    all_staff = await db.users.find(staff_query, {"_id": 0, "password_hash": 0}).to_list(500)
    staff_map = {s["id"]: s for s in all_staff}
    
    # Filter records by role if specified
    enriched_records = []
    for record in records:
        staff = staff_map.get(record.get("target_id"))
        if staff:
            # If role filter is active, only include matching staff
            if role and staff.get("role", "").lower() != role.lower():
                continue
            
            enriched_records.append({
                **record,
                "staff_name": staff.get("name"),
                "staff_role": staff.get("role"),
                "staff_chain": staff.get("chain"),
                "access_code": staff.get("access_code")
            })
    
    # Calculate summary
    present = len([r for r in enriched_records if r.get("status") == "present"])
    absent = len([r for r in enriched_records if r.get("status") == "absent"])
    late = len([r for r in enriched_records if r.get("status") == "late"])
    
    # Group by date for chart data
    by_date = {}
    for r in enriched_records:
        date = r.get("date")
        if date not in by_date:
            by_date[date] = {"present": 0, "absent": 0, "late": 0}
        att_status = r.get("status", "absent")
        if att_status in by_date[date]:
            by_date[date][att_status] += 1
    
    # Group by role for chart data
    by_role = {}
    for r in enriched_records:
        role_name = r.get("staff_role", "unknown")
        if role_name not in by_role:
            by_role[role_name] = {"present": 0, "absent": 0, "total": 0}
        by_role[role_name]["total"] += 1
        if r.get("status") == "present":
            by_role[role_name]["present"] += 1
        else:
            by_role[role_name]["absent"] += 1
    
    return {
        "records": enriched_records,
        "summary": {
            "total": len(enriched_records),
            "present": present,
            "absent": absent,
            "late": late,
            "attendance_rate": round(present / len(enriched_records) * 100, 2) if enriched_records else 0
        },
        "by_date": by_date,
        "by_role": by_role
    }

@api_router.get("/reports/academic")
async def get_academic_report(student_id: Optional[str] = None, term: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = get_chain_filter(current_user) if current_user else {}
    if student_id:
        query["student_id"] = student_id
    if term:
        query["term"] = term
    
    grades = await db.grades.find(query, {"_id": 0}).to_list(1000)
    
    if not grades:
        return {"grades": [], "average": 0, "total_subjects": 0}
    
    scores = [g.get("score", 0) for g in grades]
    
    return {
        "grades": [serialize_doc(g) for g in grades],
        "average": round(sum(scores) / len(scores), 2) if scores else 0,
        "total_subjects": len(set(g.get("subject_id") for g in grades))
    }

@api_router.get("/reports/fees")
async def get_fees_report(chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    match_stage = {}
    chain_filter = get_chain_filter(current_user) if current_user else {}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        match_stage['chain'] = chain
    elif chain_filter:
        match_stage.update(chain_filter)
    
    pipeline = []
    if match_stage:
        pipeline.append({"$match": match_stage})
    pipeline.append({
        "$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "paid_amount": {"$sum": "$paid_amount"}
        }
    })
    
    results = await db.fees.aggregate(pipeline).to_list(10)
    
    return {
        "summary": results,
        "total_fees": sum(r.get("total_amount", 0) for r in results),
        "total_collected": sum(r.get("paid_amount", 0) for r in results)
    }

# ============ STAFF TASK ASSIGNMENT (Principal → Staff) ============

@api_router.get("/staff-tasks", response_model=List[Dict])
async def get_staff_tasks(
    assigned_to: Optional[str] = None,
    task_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get staff tasks (Principal assigns to staff)"""
    # When querying by a specific assignee, do NOT apply the chain filter.
    # This ensures a task assigned to a user (e.g. a principal assigned by a
    # director) is always visible to that user, even if the task's chain
    # differs from the assignee's own chain (e.g. director chain 'IHEZA' vs
    # principal school chain 'DUP').
    if assigned_to:
        query = {"assigned_to": assigned_to}
    else:
        query = get_chain_filter(current_user) if current_user else {}
    if task_status:
        query["status"] = task_status
    
    # Field projection: only return the fields the frontend actually renders.
    # Limit to 100 tasks to prevent memory overload on production
    tasks = await db.staff_tasks.find(
        query,
        {"_id": 0, "notes": 0}
    ).sort("created_at", -1).to_list(100)
    return [serialize_doc(t) for t in tasks]


@api_router.post("/staff-tasks", response_model=Dict)
async def create_staff_task(task: StaffTask, current_user: dict = Depends(get_current_user)):
    """Principal assigns task to staff"""
    if current_user and current_user.get('role') not in ['principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only principal, director, or coordinator can assign staff tasks")
    
    task_doc = task.model_dump()
    task_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    task_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.staff_tasks.insert_one(task_doc)
    task_doc.pop('_id', None)
    return task_doc

@api_router.put("/staff-tasks/{task_id}")
async def update_staff_task(task_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    """Update staff task status or details"""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If marking as completed, add completion timestamp
    if updates.get("status") == "completed":
        updates["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.staff_tasks.update_one({"id": task_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = await db.staff_tasks.find_one({"id": task_id}, {"_id": 0})
    return serialize_doc(task)

@api_router.delete("/staff-tasks/{task_id}")
async def delete_staff_task(task_id: str, current_user: dict = Depends(get_current_user)):
    if current_user and current_user.get('role') not in ['principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only principal can delete staff tasks")
    
    # Move to bin before deleting
    await move_to_bin("staff_tasks", task_id, current_user or {})
    result = await db.staff_tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True, "message": "Task moved to bin"}

@api_router.get("/staff-tasks/report")
async def get_staff_tasks_report(current_user: dict = Depends(get_current_user)):
    """Get task completion report for all staff"""
    chain_filter = get_chain_filter(current_user) if current_user else {}
    
    tasks = await db.staff_tasks.find(chain_filter, {"_id": 0}).to_list(1000)
    
    total = len(tasks)
    completed = len([t for t in tasks if t.get("status") == "completed"])
    pending = len([t for t in tasks if t.get("status") == "pending"])
    in_progress = len([t for t in tasks if t.get("status") == "in_progress"])
    overdue = len([t for t in tasks if t.get("status") == "overdue"])
    
    # Group by staff
    staff_stats = {}
    for task in tasks:
        staff_id = task.get("assigned_to")
        if staff_id not in staff_stats:
            staff_stats[staff_id] = {
                "name": task.get("assigned_to_name", "Unknown"),
                "role": task.get("assigned_to_role", "Unknown"),
                "total": 0, "completed": 0, "pending": 0
            }
        staff_stats[staff_id]["total"] += 1
        if task.get("status") == "completed":
            staff_stats[staff_id]["completed"] += 1
        elif task.get("status") == "pending":
            staff_stats[staff_id]["pending"] += 1
    
    return {
        "total_tasks": total,
        "completed": completed,
        "pending": pending,
        "in_progress": in_progress,
        "overdue": overdue,
        "completion_rate": round(completed / total * 100, 2) if total > 0 else 0,
        "staff_breakdown": list(staff_stats.values())
    }

# ============ STUDENT TASKS (Teacher → Students) ============

@api_router.get("/student-tasks", response_model=List[Dict])
async def get_student_tasks(
    class_name: Optional[str] = None,
    task_type: Optional[str] = None,
    assigned_by: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get student tasks (homework, classwork, packages, tests)"""
    query = get_chain_filter(current_user) if current_user else {}
    if class_name:
        query["class_name"] = class_name
    if task_type:
        query["task_type"] = task_type
    if assigned_by:
        query["assigned_by"] = assigned_by
    
    tasks = await db.student_tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(t) for t in tasks]

@api_router.post("/student-tasks", response_model=Dict)
async def create_student_task(task: StudentTask, current_user: dict = Depends(get_current_user)):
    """Teacher assigns task to students"""
    if current_user and current_user.get('role') not in ['teacher', 'academic', 'section_leader', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only teachers can assign student tasks")
    
    task_doc = task.model_dump()
    task_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.student_tasks.insert_one(task_doc)
    
    # Create completion records for assigned students or all students in class
    if task_doc.get("assigned_to") and len(task_doc["assigned_to"]) > 0:
        student_ids = task_doc["assigned_to"]
    else:
        # Get all students in the class
        students = await db.students.find({"class_name": task_doc["class_name"]}, {"id": 1}).to_list(100)
        student_ids = [s["id"] for s in students]
    
    # Create completion records
    for student_id in student_ids:
        completion = {
            "id": str(uuid.uuid4()),
            "task_id": task_doc["id"],
            "student_id": student_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.student_task_completions.insert_one(completion)
    
    # Send push notifications to assigned students
    try:
        task_title = task_doc.get("title", "New Task")
        task_type = task_doc.get("task_type", "task")
        subject_name = task_doc.get("subject_name", "")
        body = f"New {task_type}: {task_title}"
        if subject_name:
            body += f" ({subject_name})"
        if task_doc.get("due_date"):
            body += f" - Due: {task_doc['due_date']}"
        await send_push_to_students(student_ids, "New Task Assigned", body, "/portal/student-portal")
    except Exception as e:
        logger.warning(f"Failed to send task push notifications: {e}")
    
    task_doc.pop('_id', None)
    return task_doc


@api_router.get("/student-tasks/{task_id}")
async def get_student_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific student task with completion status"""
    task = await db.student_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Get completions
    completions = await db.student_task_completions.find({"task_id": task_id}, {"_id": 0}).to_list(100)
    
    # Enrich with student names
    for comp in completions:
        student = await db.students.find_one({"id": comp["student_id"]}, {"_id": 0, "password_hash": 0})
        if student:
            comp["student_name"] = f"{student.get('first_name', '')} {student.get('last_name', '')}"
            comp["admission_no"] = student.get("admission_no")
    
    return {
        **serialize_doc(task),
        "completions": [serialize_doc(c) for c in completions],
        "total_students": len(completions),
        "completed_count": len([c for c in completions if c.get("status") == "completed"])
    }

@api_router.put("/student-tasks/{task_id}/mark-completion")
async def mark_student_task_completion(
    task_id: str,
    data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """Teacher marks student task as completed"""
    if current_user and current_user.get('role') not in ['teacher', 'academic', 'section_leader', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only teachers can mark task completion")
    
    student_id = data.get("student_id")
    completion_status = data.get("status", "completed")
    score = data.get("score")
    feedback = data.get("feedback")
    
    update_data = {
        "status": completion_status,
        "marked_by": current_user.get("sub") if current_user else None
    }
    
    if completion_status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    if score is not None:
        update_data["score"] = score
    if feedback:
        update_data["feedback"] = feedback
    
    result = await db.student_task_completions.update_one(
        {"task_id": task_id, "student_id": student_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Completion record not found")
    
    return {"success": True, "message": "Task completion updated"}

@api_router.delete("/student-tasks/{task_id}")
async def delete_student_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a student task - Teachers can delete their own tasks"""
    if current_user and current_user.get('role') not in ['teacher', 'academic', 'section_leader', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Not authorized to delete tasks")
    
    # Move to bin before deleting
    await move_to_bin("student_tasks", task_id, current_user or {})
    
    # Delete the task
    result = await db.student_tasks.delete_one({"id": task_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Also delete all completions for this task
    await db.student_task_completions.delete_many({"task_id": task_id})
    
    return {"success": True, "message": "Task moved to bin"}

@api_router.get("/my-tasks")
async def get_my_student_tasks(current_user: dict = Depends(get_current_user)):
    """Get tasks assigned to current student"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    student_id = current_user.get("sub")
    
    # Get completion records for this student
    completions = await db.student_task_completions.find(
        {"student_id": student_id}, {"_id": 0}
    ).to_list(100)
    
    tasks = []
    for comp in completions:
        task = await db.student_tasks.find_one({"id": comp["task_id"]}, {"_id": 0})
        if task:
            tasks.append({
                **serialize_doc(task),
                "my_status": comp.get("status"),
                "score": comp.get("score"),
                "feedback": comp.get("feedback")
            })
    
    return tasks

# ============ ACADEMIC HUB (Lesson Plans, Schemes, Evaluations, Assessments) ============

@api_router.get("/lesson-plans", response_model=List[Dict])
async def get_lesson_plans(
    subject: Optional[str] = None,
    class_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if subject:
        query["subject"] = subject
    if class_name:
        query["class_name"] = class_name
    
    plans = await db.lesson_plans.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [serialize_doc(p) for p in plans]

@api_router.post("/lesson-plans", response_model=Dict)
async def create_lesson_plan(plan: LessonPlan, current_user: dict = Depends(get_current_user)):
    plan_doc = plan.model_dump()
    plan_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    plan_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.lesson_plans.insert_one(plan_doc)
    plan_doc.pop('_id', None)
    return plan_doc

@api_router.get("/lesson-plans/{plan_id}")
async def get_lesson_plan(plan_id: str):
    plan = await db.lesson_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Lesson plan not found")
    return serialize_doc(plan)

@api_router.put("/lesson-plans/{plan_id}")
async def update_lesson_plan(plan_id: str, updates: Dict):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.lesson_plans.update_one({"id": plan_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lesson plan not found")
    plan = await db.lesson_plans.find_one({"id": plan_id}, {"_id": 0})
    return serialize_doc(plan)

@api_router.delete("/lesson-plans/{plan_id}")
async def delete_lesson_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    # Move to bin before deleting
    await move_to_bin("lesson_plans", plan_id, current_user or {})
    result = await db.lesson_plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lesson plan not found")
    return {"success": True, "message": "Lesson plan moved to bin"}

# Scheme of Work
@api_router.get("/schemes-of-work", response_model=List[Dict])
async def get_schemes_of_work(
    subject: Optional[str] = None,
    class_name: Optional[str] = None,
    term: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if subject:
        query["subject"] = subject
    if class_name:
        query["class_name"] = class_name
    if term:
        query["term"] = term
    
    schemes = await db.schemes_of_work.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [serialize_doc(s) for s in schemes]

@api_router.post("/schemes-of-work", response_model=Dict)
async def create_scheme_of_work(scheme: SchemeOfWork, current_user: dict = Depends(get_current_user)):
    scheme_doc = scheme.model_dump()
    scheme_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    scheme_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.schemes_of_work.insert_one(scheme_doc)
    scheme_doc.pop('_id', None)
    return scheme_doc

@api_router.get("/schemes-of-work/{scheme_id}")
async def get_scheme_of_work(scheme_id: str):
    scheme = await db.schemes_of_work.find_one({"id": scheme_id}, {"_id": 0})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme of work not found")
    return serialize_doc(scheme)

@api_router.put("/schemes-of-work/{scheme_id}")
async def update_scheme_of_work(scheme_id: str, updates: Dict):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.schemes_of_work.update_one({"id": scheme_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scheme of work not found")
    scheme = await db.schemes_of_work.find_one({"id": scheme_id}, {"_id": 0})
    return serialize_doc(scheme)

# Subject Evaluations
@api_router.get("/subject-evaluations", response_model=List[Dict])
async def get_subject_evaluations(
    subject: Optional[str] = None,
    class_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if subject:
        query["subject"] = subject
    if class_name:
        query["class_name"] = class_name
    
    evals = await db.subject_evaluations.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [serialize_doc(e) for e in evals]

@api_router.post("/subject-evaluations", response_model=Dict)
async def create_subject_evaluation(evaluation: SubjectEvaluation, current_user: dict = Depends(get_current_user)):
    eval_doc = evaluation.model_dump()
    eval_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    eval_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.subject_evaluations.insert_one(eval_doc)
    eval_doc.pop('_id', None)
    return eval_doc

@api_router.get("/subject-evaluations/{eval_id}")
async def get_subject_evaluation(eval_id: str):
    evaluation = await db.subject_evaluations.find_one({"id": eval_id}, {"_id": 0})
    if not evaluation:
        raise HTTPException(status_code=404, detail="Subject evaluation not found")
    return serialize_doc(evaluation)

@api_router.put("/subject-evaluations/{eval_id}")
async def update_subject_evaluation(eval_id: str, updates: Dict):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.subject_evaluations.update_one({"id": eval_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subject evaluation not found")
    evaluation = await db.subject_evaluations.find_one({"id": eval_id}, {"_id": 0})
    return serialize_doc(evaluation)

# Assessments
@api_router.get("/assessments", response_model=List[Dict])
async def get_assessments(
    subject: Optional[str] = None,
    class_name: Optional[str] = None,
    assessment_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if subject:
        query["subject"] = subject
    if class_name:
        query["class_name"] = class_name
    if assessment_type:
        query["assessment_type"] = assessment_type
    
    assessments = await db.assessments.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [serialize_doc(a) for a in assessments]

@api_router.post("/assessments", response_model=Dict)
async def create_assessment(assessment: Assessment, current_user: dict = Depends(get_current_user)):
    assessment_doc = assessment.model_dump()
    assessment_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    assessment_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.assessments.insert_one(assessment_doc)
    assessment_doc.pop('_id', None)
    return assessment_doc

@api_router.get("/assessments/{assessment_id}")
async def get_assessment(assessment_id: str):
    assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return serialize_doc(assessment)

@api_router.put("/assessments/{assessment_id}")
async def update_assessment(assessment_id: str, updates: Dict):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.assessments.update_one({"id": assessment_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assessment not found")
    assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    return serialize_doc(assessment)

@api_router.delete("/assessments/{assessment_id}")
async def delete_assessment(assessment_id: str, current_user: dict = Depends(get_current_user)):
    # Move to bin before deleting
    await move_to_bin("assessments", assessment_id, current_user or {})
    result = await db.assessments.delete_one({"id": assessment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"success": True, "message": "Assessment moved to bin"}

# ============ TIMETABLE ROUTES ============
# Timetable is scoped per chain. Only Academic & Principal can edit.
TIMETABLE_EDIT_ROLES = ['academic', 'principal']

@api_router.get("/timetable")
async def get_timetable(chain: str = None, current_user: dict = Depends(get_current_user)):
    """Get the timetable for the current user's chain. All roles can view.
    Directors/Coordinators can pass a ?chain= param to view a specific chain."""
    query = {}
    # If a chain param is provided (Director/Coordinator), use it.
    # Otherwise fall back to the user's own chain filter.
    if chain:
        query["chain"] = chain
    else:
        query = get_chain_filter(current_user) if current_user else {}
    # Timetable is stored as a single document per chain
    query["type"] = "timetable"
    timetable = await db.timetables.find_one(query, {"_id": 0})
    if not timetable:
        return {"rows": [], "updated_at": None}
    return serialize_doc(timetable)

@api_router.post("/timetable")
async def save_timetable(payload: Dict, current_user: dict = Depends(get_current_user)):
    """Save the timetable. Only Academic & Principal can edit."""
    if current_user and current_user.get('role') not in TIMETABLE_EDIT_ROLES:
        raise HTTPException(status_code=403, detail="Only Academic & Principal can edit the timetable")
    
    rows = payload.get("rows", [])
    if not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="rows must be a list")
    
    # Use the chain from the payload if provided (Director/Coordinator saving to a
    # specific chain), otherwise fall back to the user's own chain.
    chain = payload.get("chain") or (current_user.get("chain") if current_user else None)
    query = {"type": "timetable"}
    if chain:
        query["chain"] = chain
    
    update = {
        "$set": {
            "rows": rows,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user.get("name") if current_user else None,
            "updated_by_role": current_user.get("role") if current_user else None,
        }
    }
    if chain:
        update["$set"]["chain"] = chain
    
    result = await db.timetables.update_one(query, update, upsert=True)
    return {"success": True, "message": "Timetable saved successfully", "updated_at": update["$set"]["updated_at"]}


# ============ COMMUNICATIONS ROUTES ============


@api_router.get("/communications", response_model=List[Dict])
async def get_communications(
    comm_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get communications/messages"""
    query = get_chain_filter(current_user) if current_user else {}
    if comm_status:
        query["status"] = comm_status
    
    communications = await db.communications.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [serialize_doc(c) for c in communications]

# ============ ANNOUNCEMENTS ROUTES ============

@api_router.get("/announcements", response_model=List[Dict])
async def get_announcements(
    announcement_status: Optional[str] = "published",
    announcement_type: Optional[str] = None,
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get announcements (all portals can view)"""
    query = get_chain_filter(current_user) if current_user else {}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        query['chain'] = chain
    
    if announcement_status:
        query["status"] = announcement_status
    if announcement_type:
        query["announcement_type"] = announcement_type
    
    announcements = await db.announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [serialize_doc(a) for a in announcements]

@api_router.post("/announcements", response_model=Dict)
async def create_announcement(announcement: Announcement, current_user: dict = Depends(get_current_user)):
    """Create announcement (Secretary only)"""
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary can create announcements")
    
    announcement_doc = announcement.model_dump()
    announcement_doc["chain"] = current_user.get("chain") if current_user else None
    announcement_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    announcement_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.announcements.insert_one(announcement_doc)
    announcement_doc.pop('_id', None)
    
    # Send push notifications to students in the announcement's chain
    try:
        chain = announcement_doc.get("chain")
        if chain:
            # Get all students in this chain
            students = await db.students.find({"chain": chain}, {"id": 1}).to_list(2000)
            student_ids = [s["id"] for s in students]
            if student_ids:
                title = announcement_doc.get("title", "New Announcement")
                content = announcement_doc.get("content", "")
                body = content[:120] + ("..." if len(content) > 120 else "")
                await send_push_to_students(student_ids, title, body, "/portal/student-portal")
    except Exception as e:
        logger.warning(f"Failed to send announcement push notifications: {e}")
    
    return announcement_doc


@api_router.get("/announcements/{announcement_id}")
async def get_announcement(announcement_id: str, current_user: dict = Depends(get_current_user)):
    announcement = await db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return serialize_doc(announcement)

@api_router.put("/announcements/{announcement_id}")
async def update_announcement(announcement_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    """Update announcement (Secretary only)"""
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary can edit announcements")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.announcements.update_one({"id": announcement_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    announcement = await db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    return serialize_doc(announcement)

@api_router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, current_user: dict = Depends(get_current_user)):
    """Delete announcement (Secretary only)"""
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary can delete announcements")
    
    # Move to bin before deleting
    await move_to_bin("announcements", announcement_id, current_user or {})
    result = await db.announcements.delete_one({"id": announcement_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"success": True, "message": "Announcement moved to bin"}

# ============ BIN / RECYCLE BIN ROUTES ============

@api_router.get("/bin")
async def get_bin_items(current_user: dict = Depends(get_current_user)):
    """Get all items in the bin for the user's chain"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    chain_filter = get_chain_filter(current_user)
    query = {**chain_filter}
    
    items = await db.bin.find(query, {"_id": 0}).sort("deleted_at", -1).to_list(200)
    return [serialize_doc(a) for a in items]


@api_router.post("/bin/restore/{item_id}")
async def restore_bin_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Restore an item from the bin back to its original collection - Principal only"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if current_user.get('role') != 'principal':
        raise HTTPException(status_code=403, detail="Only principals can restore items from the bin")
    
    # Find the item in bin
    bin_item = await db.bin.find_one({"id": item_id}, {"_id": 0})
    if not bin_item:
        raise HTTPException(status_code=404, detail="Bin item not found")
    
    original_collection = bin_item.get("original_collection")
    original_data = bin_item.get("original_data", {})
    
    if not original_collection or not original_data:
        raise HTTPException(status_code=400, detail="Invalid bin item - missing original data")
    
    # Restore to original collection
    collection_map = {
        "students": db.students,
        "staff": db.users,
        "tasks": db.tasks,
        "staff_tasks": db.staff_tasks,
        "student_tasks": db.student_tasks,
        "classes": db.classes,
        "subjects": db.subjects,
        "announcements": db.announcements,
        "lesson_plans": db.lesson_plans,
        "assessments": db.assessments,
        "payments": db.payments,
        "qr_codes": db.qr_codes,
        "almanac_events": db.almanac_events,
        "fee_structures": db.fee_structures,
    }
    
    target_collection = collection_map.get(original_collection)
    if target_collection is None:
        raise HTTPException(status_code=400, detail=f"Unknown collection: {original_collection}")
    
    # Check if item already exists (restore or create new)
    existing = await target_collection.find_one({"id": original_data.get("id")})
    if existing:
        # Update the existing record
        await target_collection.update_one(
            {"id": original_data.get("id")},
            {"$set": original_data}
        )
    else:
        # Insert as new
        await target_collection.insert_one(original_data)
    
    # Remove from bin
    await db.bin.delete_one({"id": item_id})
    
    return {"success": True, "message": "Item restored successfully"}


@api_router.delete("/bin/{item_id}")
async def permanently_delete_bin_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Permanently delete an item from the bin - Principal only"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if current_user.get('role') != 'principal':
        raise HTTPException(status_code=403, detail="Only principals can permanently delete items from the bin")
    
    result = await db.bin.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bin item not found")
    
    return {"success": True, "message": "Item permanently deleted"}


@api_router.delete("/bin")
async def empty_bin(current_user: dict = Depends(get_current_user)):
    """Empty all items from the bin for the user's chain - Principal only"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if current_user.get('role') != 'principal':
        raise HTTPException(status_code=403, detail="Only principals can empty the bin")
    
    chain_filter = get_chain_filter(current_user)
    result = await db.bin.delete_many(chain_filter)
    
    return {"success": True, "message": f"Permanently deleted {result.deleted_count} items"}


# Helper function to move an item to the bin
async def move_to_bin(collection_name: str, item_id: str, deleted_by: dict, chain: str = None):
    """Move a deleted item to the bin collection for potential restoration"""
    collection_map = {
        "students": db.students,
        "staff": db.users,
        "tasks": db.tasks,
        "staff_tasks": db.staff_tasks,
        "student_tasks": db.student_tasks,
        "classes": db.classes,
        "subjects": db.subjects,
        "announcements": db.announcements,
        "lesson_plans": db.lesson_plans,
        "assessments": db.assessments,
        "payments": db.payments,
        "qr_codes": db.qr_codes,
        "almanac_events": db.almanac_events,
        "fee_structures": db.fee_structures,
    }
    
    source_collection = collection_map.get(collection_name)
    if source_collection is None:
        return False
    
    # Get the original data before deleting
    original_data = await source_collection.find_one({"id": item_id}, {"_id": 0})
    if not original_data:
        return False
    
    # Create bin entry
    deleted_by_name = (
        deleted_by.get("name") or 
        f"{deleted_by.get('first_name', '')} {deleted_by.get('last_name', '')}".strip() or
        deleted_by.get("access_code", "Unknown")
    )
    bin_entry = {
        "id": str(uuid.uuid4()),
        "original_collection": collection_name,
        "original_id": item_id,
        "original_data": original_data,
        "deleted_by": {
            "id": deleted_by.get("id") or deleted_by.get("sub"),
            "name": deleted_by_name,
            "role": deleted_by.get("role"),
        },
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "chain": chain or original_data.get("chain", ""),
        "item_type": collection_name,
        "item_summary": _get_item_summary(collection_name, original_data),
    }
    
    await db.bin.insert_one(bin_entry)
    return True


def _get_item_summary(collection_name: str, data: dict) -> str:
    """Generate a human-readable summary of the deleted item"""
    summaries = {
        "students": f"{data.get('first_name', '')} {data.get('last_name', '')} ({data.get('admission_no', 'N/A')})",
        "staff": f"{data.get('name') or data.get('first_name', '')} {data.get('last_name', '')} ({data.get('access_code', 'N/A')})",
        "tasks": data.get("title") or data.get("description", "Untitled Task"),
        "staff_tasks": data.get("title") or data.get("description", "Untitled Task"),
        "student_tasks": data.get("title") or data.get("description", "Untitled Task"),
        "classes": data.get("name", "Untitled Class"),
        "subjects": data.get("name", "Untitled Subject"),
        "announcements": data.get("title", "Untitled Announcement"),
        "lesson_plans": data.get("title") or data.get("topic", "Untitled Lesson Plan"),
        "assessments": data.get("title", "Untitled Assessment"),
        "payments": f"Payment of {data.get('amount', 'N/A')} by {data.get('student_name', 'N/A')}",
        "qr_codes": f"QR Code - {data.get('label', data.get('id', 'N/A'))}",
        "almanac_events": data.get("title", "Untitled Event"),
        "fee_structures": data.get("name", "Untitled Fee Structure"),
    }
    return summaries.get(collection_name, f"Deleted {collection_name} item")


# ============ STUDENT PORTAL ROUTES ============

@api_router.get("/student-portal/my-info")
async def get_student_my_info(current_user: dict = Depends(get_current_user)):
    """Get current student's info"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    student_id = current_user.get("sub")
    student = await db.students.find_one({"id": student_id}, {"_id": 0, "password_hash": 0})
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    return serialize_doc(student)

@api_router.get("/student-portal/my-tasks")
async def get_student_my_tasks(current_user: dict = Depends(get_current_user)):
    """Get tasks assigned to current student"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    student_id = current_user.get("sub")
    
    # Get completion records for this student
    completions = await db.student_task_completions.find(
        {"student_id": student_id}, {"_id": 0}
    ).to_list(100)
    
    tasks = []
    for comp in completions:
        task = await db.student_tasks.find_one({"id": comp["task_id"]}, {"_id": 0})
        if task:
            tasks.append({
                **serialize_doc(task),
                "my_status": comp.get("status"),
                "score": comp.get("score"),
                "feedback": comp.get("feedback"),
                "completion_id": comp.get("id")
            })
    
    # Sort by created_at descending
    tasks.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return tasks

@api_router.get("/student-portal/my-report-cards")
async def get_student_my_report_cards(current_user: dict = Depends(get_current_user)):
    """Get report cards sent to current student"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    student_id = current_user.get("sub")
    
    # Get sent report cards for this student
    report_cards = await db.report_cards.find(
        {"student_id": student_id, "status": "sent"}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with grades data
    enriched_cards = []
    for rc in report_cards:
        grades = await db.grades.find(
            {"student_id": student_id, "term": rc.get("term")}, {"_id": 0}
        ).to_list(50)
        
        # Get subjects for names
        subjects = await db.subjects.find({}, {"_id": 0}).to_list(100)
        subject_map = {}
        for s in subjects:
            subject_map[s.get("id")] = s.get("name")
            subject_map[s.get("_id")] = s.get("name")
        
        enriched_grades = []
        for g in grades:
            enriched_grades.append({
                **g,
                "subject_name": subject_map.get(g.get("subject_id"), "Unknown")
            })
        
        total_score = sum(g.get("score", 0) for g in grades)
        avg = total_score / len(grades) if grades else 0
        
        def get_grade(score):
            if score >= 81: return "A"
            if score >= 61: return "B"
            if score >= 41: return "C"
            if score >= 21: return "D"
            return "F"
        
        enriched_cards.append({
            **serialize_doc(rc),
            "grades": enriched_grades,
            "total_score": round(total_score, 2),
            "average": round(avg, 2),
            "overall_grade": get_grade(avg)
        })

    
    return enriched_cards

@api_router.get("/student-portal/my-fees")
async def get_student_my_fees(current_user: dict = Depends(get_current_user)):
    """Get fee status for current student"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    student_id = current_user.get("sub")
    
    # Get student
    student = await db.students.find_one({"id": student_id}, {"_id": 0, "password_hash": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    chain = student.get("chain")
    class_name = student.get("class_name")
    
    # Get student's fee record (edited by secretary)
    student_fee = await db.student_fees.find_one({"student_id": student_id}, {"_id": 0})
    
    # Get applicable fee structures (for display)
    fee_structures = await db.fee_structures.find({
        "chain": chain,
        "status": "active",
        "$or": [{"class_name": class_name}, {"class_name": None}, {"class_name": ""}]
    }, {"_id": 0}).to_list(50)
    
    # Get payments for this student
    payments = await db.payments.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Calculate totals - use student_fees if available (edited by secretary), otherwise calculate from structures
    if student_fee and student_fee.get("amount"):
        total_fees = student_fee.get("amount", 0)
    else:
        total_fees = sum(f.get("amount", 0) for f in fee_structures)
    
    total_paid = sum(p.get("amount", 0) for p in payments)
    balance = total_fees - total_paid
    
    return {
        "fee_structures": [serialize_doc(f) for f in fee_structures],
        "payments": [serialize_doc(p) for p in payments],
        "total_fees": total_fees,
        "total_paid": total_paid,
        "balance": balance,
        "status": "fully_paid" if balance <= 0 else ("partial" if total_paid > 0 else "unpaid")
    }

@api_router.get("/student-portal/my-grades")
async def get_student_my_grades(
    term: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get grades for current student"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    student_id = current_user.get("sub")
    
    query = {"student_id": student_id}
    if term:
        query["term"] = term
    
    grades = await db.grades.find(query, {"_id": 0}).to_list(100)
    
    # Get subjects for names
    subjects = await db.subjects.find({}, {"_id": 0}).to_list(100)
    subject_map = {}
    for s in subjects:
        subject_map[s.get("id")] = s.get("name")
        subject_map[s.get("_id")] = s.get("name")
    
    enriched_grades = []
    for g in grades:
        enriched_grades.append({
            **serialize_doc(g),
            "subject_name": subject_map.get(g.get("subject_id"), "Unknown")
        })
    
    return enriched_grades


@api_router.get("/student-portal/my-announcements")
async def get_student_announcements(current_user: dict = Depends(get_current_user)):
    """Get announcements visible to student - filtered by student's chain"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    student_chain = current_user.get('chain', '')
    
    # Students should only see announcements from their own chain
    # DLP students should NOT see DUP secretary announcements
    # DUP students should NOT see DLP secretary announcements
    # IHEZA users (directors/coordinators) can see all announcements
    if current_user.get('role') in ['director', 'coordinator']:
        announcements = await db.announcements.find({
            "status": "published"
        }, {"_id": 0}).sort("created_at", -1).to_list(50)
    else:
        announcements = await db.announcements.find({
            "status": "published",
            "chain": student_chain
        }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Resolve creator names: created_by may be a UUID, so look up the actual user name
    result = []
    for a in announcements:
        a = dict(a)
        creator_name = a.get('created_by_name')
        # If no stored name, try to resolve from users collection
        if not creator_name:
            creator_id = a.get('created_by')
            if creator_id:
                creator = await db.users.find_one(
                    {"$or": [{"id": creator_id}, {"sub": creator_id}, {"access_code": creator_id}]},
                    {"_id": 0, "name": 1, "first_name": 1, "last_name": 1}
                )
                if creator:
                    creator_name = creator.get('name') or f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
        a['created_by_name'] = creator_name or 'Unknown'
        result.append(serialize_doc(a))
    
    return result


# ============ EXPENSES ============

@api_router.get("/expenses")
async def get_expenses(chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all expenses for the user's chain"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    chain_filter = get_chain_filter(current_user)
    query = {**chain_filter}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user.get('role') in ['director', 'coordinator']:
        query['chain'] = chain
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(e) for e in expenses]


@api_router.post("/expenses")
async def create_expense(expense: dict, current_user: dict = Depends(get_current_user)):
    """Create a new expense entry"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    allowed_roles = ['principal', 'director', 'coordinator', 'secretary']
    if current_user.get('role') not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to create expenses")
    
    expense_id = str(uuid.uuid4())
    chain = expense.get('chain') or current_user.get('chain') or 'IHEZA'
    
    expense_doc = {
        "id": expense_id,
        "description": expense.get('description', ''),
        "amount": float(expense.get('amount', 0)),
        "category": expense.get('category', 'other'),
        "payment_method": expense.get('payment_method', 'cash'),
        "vendor": expense.get('vendor', ''),
        "receipt_number": expense.get('receipt_number', ''),
        "notes": expense.get('notes', ''),
        "expense_date": expense.get('expense_date', datetime.now(timezone.utc).isoformat()),
        "chain": chain,
        "created_by": current_user.get('_id') or current_user.get('id', ''),
        "created_by_name": current_user.get('name') or current_user.get('first_name', 'Unknown'),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.expenses.insert_one(expense_doc)
    return serialize_doc(expense_doc)


@api_router.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, expense: dict, current_user: dict = Depends(get_current_user)):
    """Update an existing expense"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    allowed_roles = ['principal', 'director', 'coordinator', 'secretary']
    if current_user.get('role') not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to update expenses")
    
    existing = await db.expenses.find_one({"id": expense_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_data = {
        "description": expense.get('description', existing.get('description', '')),
        "amount": float(expense.get('amount', existing.get('amount', 0))),
        "category": expense.get('category', existing.get('category', 'other')),
        "payment_method": expense.get('payment_method', existing.get('payment_method', 'cash')),
        "vendor": expense.get('vendor', existing.get('vendor', '')),
        "receipt_number": expense.get('receipt_number', existing.get('receipt_number', '')),
        "notes": expense.get('notes', existing.get('notes', '')),
        "expense_date": expense.get('expense_date', existing.get('expense_date', '')),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    updated = await db.expenses.find_one({"id": expense_id})
    return serialize_doc(updated)


@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an expense"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    allowed_roles = ['principal', 'director', 'coordinator', 'secretary']
    if current_user.get('role') not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to delete expenses")
    
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    return {"success": True, "message": "Expense deleted successfully"}


# ============ SYNC & HEALTH ============

@api_router.get("/sync")
async def get_sync_data(
    chain: Optional[str] = None,
    counts_only: Optional[bool] = False,
    page: int = 1,
    page_size: int = 1000,
    current_user: dict = Depends(get_current_user),
    response: Response = None
):
    """Get all data for frontend sync - supports chain filter for IHEZA users.

    Memory optimization:
    - `counts_only=true` returns ONLY document counts (no full arrays). The
      Dashboard only needs counts, so this avoids downloading 1000 students +
      1000 users + 100 classes + 200 subjects just to count them.
    - Field projections strip heavy/unneeded fields from list responses.
    - The `staff` key is removed (it duplicated `users` in the payload).
    - Pagination (page/page_size) lets large datasets be fetched in chunks so
      a single response never exceeds the reverse-proxy buffer.
    - A short Cache-Control header lets the browser/reverse proxy serve repeat
      sync loads from cache instead of re-hitting the origin.
    """
    chain_filter = get_chain_filter(current_user) if current_user else {}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        chain_filter['chain'] = chain

    # Short cache window so repeat sync loads (e.g. every dashboard mount)
    # are served from the browser/reverse-proxy cache instead of the origin.
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=30"

    # Counts-only mode: return just counts to minimize memory/bandwidth.
    if counts_only:
        return {
            "users": await db.users.count_documents(chain_filter),
            "students": await db.students.count_documents(chain_filter),
            "classes": await db.classes.count_documents(chain_filter),
            "subjects": await db.subjects.count_documents(chain_filter),
            "synced_at": datetime.now(timezone.utc).isoformat()
        }

    # Pagination for full mode so large datasets are fetched in chunks.
    page = max(1, page)
    page_size = max(1, min(1000, page_size))
    skip = (page - 1) * page_size

    # Full mode with field projections to keep payloads lean.
    # Only return the fields the frontend actually renders.
    users = await db.users.find(
        chain_filter,
        {"_id": 0, "password_hash": 0, "photo_url": 0}
    ).skip(skip).limit(page_size).to_list(page_size)
    students = await db.students.find(
        chain_filter,
        {"_id": 0, "password_hash": 0, "photo_url": 0}
    ).skip(skip).limit(page_size).to_list(page_size)
    classes = await db.classes.find(
        chain_filter,
        {"_id": 0, "students": 0}
    ).skip(skip).limit(page_size).to_list(page_size)
    subjects = await db.subjects.find(
        chain_filter,
        {"_id": 0}
    ).skip(skip).limit(page_size).to_list(page_size)
    
    return {
        "users": [serialize_doc(u) for u in users],
        "students": [serialize_doc(s) for s in students],
        "classes": [serialize_doc(c) for c in classes],
        "subjects": [serialize_doc(s) for s in subjects],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_users": await db.users.count_documents(chain_filter),
            "total_students": await db.students.count_documents(chain_filter),
            "total_classes": await db.classes.count_documents(chain_filter),
            "total_subjects": await db.subjects.count_documents(chain_filter),
        },
        "synced_at": datetime.now(timezone.utc).isoformat()
    }



# ============ DASHBOARD AGGREGATION ENDPOINT ============
# Collapses the Dashboard's 7-call "What's New" burst (payments, documents,
# grades, subjects, users, almanac, admissions) into a SINGLE request. The
# frontend previously fired these 7 calls in parallel per chain; this endpoint
# does the same aggregation server-side, dramatically reducing request count
# and origin load under concurrent dashboard loads.

@api_router.get("/dashboard/whats-new")
async def get_dashboard_whats_new(
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    response: Response = None
):
    """Aggregate all 'What's New' dashboard data for a chain in one request.

    Performance optimizations:
    - Strips base64 receipt images from payments (1-5 MB each) so the payload
      stays small even when there are many payments.
    - Sets a short Cache-Control header so the browser/reverse proxy can serve
      repeat dashboard loads from cache instead of hitting the origin.
    """
    chain_filter = get_chain_filter(current_user) if current_user else {}

    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        chain_filter['chain'] = chain

    # Fetch all datasets in parallel (these are DB queries, not HTTP calls, so
    # asyncio.gather is safe and efficient here).
    # IMPORTANT: payments projection strips receipt_image / receipt_images
    # (1-5 MB base64 blobs each) — they are NOT needed for the "What's New"
    # recent-payments list and would bloat the response enormously.
    payments, documents, grades, subjects, users, almanac, admissions = await asyncio.gather(
        db.payments.find(chain_filter, {"_id": 0, "receipt_image": 0, "receipt_images": 0}).sort("created_at", -1).to_list(1000),
        db.documents.find(chain_filter, {"_id": 0}).sort("uploadedAt", -1).to_list(500),
        db.grades.find(chain_filter, {"_id": 0}).to_list(1000),
        db.subjects.find(chain_filter, {"_id": 0}).to_list(200),
        db.users.find(chain_filter, {"_id": 0, "password_hash": 0}).to_list(1000),
        db.almanac_events.find(chain_filter, {"_id": 0}).to_list(1000),
        db.admissions.find(chain_filter, {"_id": 0}).sort("created_at", -1).to_list(500),
    )


    payments = [serialize_doc(p) for p in payments]
    documents = [serialize_doc(d) for d in documents]
    grades = [serialize_doc(g) for g in grades]
    subjects = [serialize_doc(s) for s in subjects]
    users = [serialize_doc(u) for u in users]
    almanac = [serialize_doc(e) for e in almanac]
    admissions = [serialize_doc(a) for a in admissions]

    # ---- 1. Recent payments (most recent 5) ----
    recent_payments = sorted(
        payments,
        key=lambda p: p.get('created_at') or '',
        reverse=True
    )[:5]

    # ---- 2. Recent documents (excluding project pics) ----
    def is_project_pic(d):
        return (
            d.get('isProjectPic') is True
            or (d.get('metadata') or {}).get('uploadedFrom') == 'projects'
            or ((d.get('metadata') or {}).get('caption') and str(d.get('type') or '').startswith('image/'))
        )

    recent_documents = [
        d for d in documents if not is_project_pic(d)
    ]
    recent_documents = sorted(
        recent_documents,
        key=lambda d: d.get('uploadedAt') or '',
        reverse=True
    )[:5]

    # ---- 2b. Teacher submission ranking ----
    teacher_submission_counts = {}
    for d in documents:
        teacher = (d.get('metadata') or {}).get('teacher') or d.get('uploaded_by') or 'Unknown'
        teacher_submission_counts[teacher] = teacher_submission_counts.get(teacher, 0) + 1
    teacher_submissions = [
        {"name": name, "count": count}
        for name, count in sorted(
            teacher_submission_counts.items(),
            key=lambda kv: kv[1],
            reverse=True
        )[:5]
    ]

    # ---- 2c. Recent project pics (3 most recent) ----
    project_pics = [
        {
            "id": d.get('id'),
            "name": d.get('name'),
            "data": d.get('data'),
            "caption": d.get('caption') or (d.get('metadata') or {}).get('caption') or '',
            "uploadedAt": d.get('uploadedAt'),
            "uploaded_by": (d.get('metadata') or {}).get('teacher') or d.get('uploaded_by') or 'Unknown'
        }
        for d in documents if is_project_pic(d) and d.get('data')
    ]
    project_pics = sorted(
        project_pics,
        key=lambda p: p.get('uploadedAt') or '',
        reverse=True
    )[:3]

    # ---- 3. Teacher performance analytics ----
    subject_teacher_map = {}
    for sub in subjects:
        if sub.get('teacher_id'):
            subject_teacher_map[sub.get('id')] = sub.get('teacher_id')

    teacher_name_map = {}
    for u in users:
        if u.get('role') in ('teacher', 'academic'):
            teacher_name_map[u.get('id')] = (
                u.get('name')
                or f"{u.get('first_name') or ''} {u.get('last_name') or ''}".strip()
                or u.get('access_code')
            )

    teacher_scores = {}
    for g in grades:
        teacher_id = subject_teacher_map.get(g.get('subject_id'))
        if not teacher_id:
            continue
        entry = teacher_scores.setdefault(teacher_id, {"total": 0, "count": 0, "subject": ''})
        entry["total"] += g.get('score') or 0
        entry["count"] += 1
        entry["subject"] = g.get('subject_id')

    teacher_analytics = sorted(
        [
            {
                "teacherId": tid,
                "teacherName": teacher_name_map.get(tid, 'Unknown Teacher'),
                "average": round(data["total"] / data["count"], 1) if data["count"] > 0 else 0,
                "subjectCount": data["count"],
            }
            for tid, data in teacher_scores.items()
        ],
        key=lambda t: t["average"],
        reverse=True
    )[:3]

    # ---- 4. Upcoming events ----
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    upcoming_events = []
    for e in almanac:
        try:
            start = datetime.fromisoformat(e.get('start_date', '').replace('Z', '+00:00'))
        except (ValueError, TypeError):
            continue
        # Normalize to an offset-aware datetime so we can compare against
        # `today` (which is UTC-aware). Stored start_date values may be
        # offset-naive (no timezone suffix), which previously raised
        # "TypeError: can't compare offset-naive and offset-aware datetimes"
        # and crashed the whole endpoint with a 500.
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if start >= today:
            upcoming_events.append(e)
    upcoming_events = sorted(
        upcoming_events,
        key=lambda e: e.get('start_date') or '',
    )[:5]

    # ---- 5. New admissions (most recent 5) ----
    recent_admissions = sorted(
        admissions,
        key=lambda a: a.get('created_at') or '',
        reverse=True
    )[:5]

    # Short cache window so the browser/reverse proxy can serve repeat
    # dashboard loads from cache instead of re-hitting the origin. 30s is
    # short enough that "What's New" stays reasonably fresh while still
    # absorbing concurrent dashboard-load bursts.
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=30"

    return {
        "chain": chain,
        "payments": recent_payments,
        "documents": recent_documents,
        "teacherAnalytics": teacher_analytics,
        "teacherSubmissions": teacher_submissions,
        "projectPics": project_pics,
        "upcomingEvents": upcoming_events,
        "newAdmissions": recent_admissions,
    }


@api_router.get("/")
async def root():
    return {"message": "IHEZA School Management API", "version": "2.0.0", "status": "running"}


@api_router.get("/health")
async def health_check():
    try:
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

# ============ DLP DATA IMPORT ============

@api_router.post("/import-dlp-data")
async def import_dlp_data(current_user: dict = Depends(get_current_user)):
    """Import DLP students, classes, and subjects - Principal/Director only"""
    if not current_user or current_user.get('role') not in ['principal', 'director']:
        raise HTTPException(status_code=403, detail="Only Principal or Director can import data")
    
    results = {"classes": 0, "students": 0, "subjects": 0}
    
    # DLP Classes
    DLP_CLASSES = [
        {"name": "Grade 1A", "level": "Grade 1", "capacity": 40},
        {"name": "Grade 1B", "level": "Grade 1", "capacity": 40},
        {"name": "Grade 2A", "level": "Grade 2", "capacity": 40},
        {"name": "Grade 2B", "level": "Grade 2", "capacity": 40},
        {"name": "Grade 3A", "level": "Grade 3", "capacity": 40},
        {"name": "Grade 3B", "level": "Grade 3", "capacity": 40},
    ]
    
    # Import classes
    for cls in DLP_CLASSES:
        existing = await db.classes.find_one({"name": cls["name"], "chain": "DLP"})
        if not existing:
            class_doc = {
                "id": str(uuid.uuid4()),
                "name": cls["name"],
                "level": cls["level"],
                "capacity": cls["capacity"],
                "chain": "DLP",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.classes.insert_one(class_doc)
            results["classes"] += 1
    
    # Get class IDs
    classes = await db.classes.find({"chain": "DLP"}, {"_id": 0}).to_list(20)
    class_map = {c["name"]: c["id"] for c in classes}
    
    # DLP Students (88 students)
    DLP_STUDENTS = [
        {"first_name": "Ahmed", "last_name": "Hassan", "admission_no": "DLP/STU0001/2024", "class_name": "Grade 1A", "gender": "MALE"},
        {"first_name": "Fatma", "last_name": "Ali", "admission_no": "DLP/STU0002/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
        {"first_name": "Omar", "last_name": "Salim", "admission_no": "DLP/STU0003/2024", "class_name": "Grade 1B", "gender": "MALE"},
        {"first_name": "Aisha", "last_name": "Mohamed", "admission_no": "DLP/STU0004/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
        {"first_name": "Yusuf", "last_name": "Ibrahim", "admission_no": "DLP/STU0005/2024", "class_name": "Grade 2A", "gender": "MALE"},
        {"first_name": "Zainab", "last_name": "Rashid", "admission_no": "DLP/STU0006/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
        {"first_name": "Hassan", "last_name": "Juma", "admission_no": "DLP/STU0007/2024", "class_name": "Grade 2B", "gender": "MALE"},
        {"first_name": "Mariam", "last_name": "Abdi", "admission_no": "DLP/STU0008/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
        {"first_name": "Khalid", "last_name": "Omar", "admission_no": "DLP/STU0009/2024", "class_name": "Grade 3A", "gender": "MALE"},
        {"first_name": "Salma", "last_name": "Ahmed", "admission_no": "DLP/STU0010/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
        {"first_name": "Ibrahim", "last_name": "Hassan", "admission_no": "DLP/STU0011/2024", "class_name": "Grade 3B", "gender": "MALE"},
        {"first_name": "Halima", "last_name": "Yusuf", "admission_no": "DLP/STU0012/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
        {"first_name": "Abdi", "last_name": "Mohamed", "admission_no": "DLP/STU0013/2024", "class_name": "Grade 1A", "gender": "MALE"},
        {"first_name": "Khadija", "last_name": "Ali", "admission_no": "DLP/STU0014/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
        {"first_name": "Said", "last_name": "Salim", "admission_no": "DLP/STU0015/2024", "class_name": "Grade 1B", "gender": "MALE"},
        {"first_name": "Amina", "last_name": "Rashid", "admission_no": "DLP/STU0016/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
        {"first_name": "Hamza", "last_name": "Juma", "admission_no": "DLP/STU0017/2024", "class_name": "Grade 2A", "gender": "MALE"},
        {"first_name": "Rahma", "last_name": "Abdi", "admission_no": "DLP/STU0018/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
        {"first_name": "Musa", "last_name": "Omar", "admission_no": "DLP/STU0019/2024", "class_name": "Grade 2B", "gender": "MALE"},
        {"first_name": "Safia", "last_name": "Hassan", "admission_no": "DLP/STU0020/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
        {"first_name": "Ali", "last_name": "Ibrahim", "admission_no": "DLP/STU0021/2024", "class_name": "Grade 3A", "gender": "MALE"},
        {"first_name": "Maryam", "last_name": "Yusuf", "admission_no": "DLP/STU0022/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
        {"first_name": "Juma", "last_name": "Mohamed", "admission_no": "DLP/STU0023/2024", "class_name": "Grade 3B", "gender": "MALE"},
        {"first_name": "Nasra", "last_name": "Ali", "admission_no": "DLP/STU0024/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
        {"first_name": "Rashid", "last_name": "Salim", "admission_no": "DLP/STU0025/2024", "class_name": "Grade 1A", "gender": "MALE"},
        {"first_name": "Fatuma", "last_name": "Rashid", "admission_no": "DLP/STU0026/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
        {"first_name": "Salim", "last_name": "Juma", "admission_no": "DLP/STU0027/2024", "class_name": "Grade 1B", "gender": "MALE"},
        {"first_name": "Asma", "last_name": "Abdi", "admission_no": "DLP/STU0028/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
        {"first_name": "Mohamed", "last_name": "Omar", "admission_no": "DLP/STU0029/2024", "class_name": "Grade 2A", "gender": "MALE"},
        {"first_name": "Hafsa", "last_name": "Hassan", "admission_no": "DLP/STU0030/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
        {"first_name": "Issa", "last_name": "Ibrahim", "admission_no": "DLP/STU0031/2024", "class_name": "Grade 2B", "gender": "MALE"},
        {"first_name": "Rukia", "last_name": "Yusuf", "admission_no": "DLP/STU0032/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
        {"first_name": "Bakari", "last_name": "Mohamed", "admission_no": "DLP/STU0033/2024", "class_name": "Grade 3A", "gender": "MALE"},
        {"first_name": "Jamila", "last_name": "Ali", "admission_no": "DLP/STU0034/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
        {"first_name": "Suleiman", "last_name": "Salim", "admission_no": "DLP/STU0035/2024", "class_name": "Grade 3B", "gender": "MALE"},
        {"first_name": "Safiya", "last_name": "Rashid", "admission_no": "DLP/STU0036/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
        {"first_name": "Yunus", "last_name": "Juma", "admission_no": "DLP/STU0037/2024", "class_name": "Grade 1A", "gender": "MALE"},
        {"first_name": "Nuru", "last_name": "Abdi", "admission_no": "DLP/STU0038/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
        {"first_name": "Idris", "last_name": "Omar", "admission_no": "DLP/STU0039/2024", "class_name": "Grade 1B", "gender": "MALE"},
        {"first_name": "Sumaiya", "last_name": "Hassan", "admission_no": "DLP/STU0040/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
        {"first_name": "Abubakar", "last_name": "Ibrahim", "admission_no": "DLP/STU0041/2024", "class_name": "Grade 2A", "gender": "MALE"},
        {"first_name": "Asha", "last_name": "Yusuf", "admission_no": "DLP/STU0042/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
        {"first_name": "Hamis", "last_name": "Mohamed", "admission_no": "DLP/STU0043/2024", "class_name": "Grade 2B", "gender": "MALE"},
        {"first_name": "Hawa", "last_name": "Ali", "admission_no": "DLP/STU0044/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
        {"first_name": "Seif", "last_name": "Salim", "admission_no": "DLP/STU0045/2024", "class_name": "Grade 3A", "gender": "MALE"},
        {"first_name": "Tatu", "last_name": "Rashid", "admission_no": "DLP/STU0046/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
        {"first_name": "Omari", "last_name": "Juma", "admission_no": "DLP/STU0047/2024", "class_name": "Grade 3B", "gender": "MALE"},
        {"first_name": "Zawadi", "last_name": "Abdi", "admission_no": "DLP/STU0048/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
        {"first_name": "Hashim", "last_name": "Omar", "admission_no": "DLP/STU0049/2024", "class_name": "Grade 1A", "gender": "MALE"},
        {"first_name": "Waridi", "last_name": "Hassan", "admission_no": "DLP/STU0050/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
        {"first_name": "Mwinyi", "last_name": "Ibrahim", "admission_no": "DLP/STU0051/2024", "class_name": "Grade 1B", "gender": "MALE"},
        {"first_name": "Baraka", "last_name": "Yusuf", "admission_no": "DLP/STU0052/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
        {"first_name": "Jafari", "last_name": "Mohamed", "admission_no": "DLP/STU0053/2024", "class_name": "Grade 2A", "gender": "MALE"},
        {"first_name": "Neema", "last_name": "Ali", "admission_no": "DLP/STU0054/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
        {"first_name": "Zuberi", "last_name": "Salim", "admission_no": "DLP/STU0055/2024", "class_name": "Grade 2B", "gender": "MALE"},
        {"first_name": "Pili", "last_name": "Rashid", "admission_no": "DLP/STU0056/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
        {"first_name": "Daudi", "last_name": "Juma", "admission_no": "DLP/STU0057/2024", "class_name": "Grade 3A", "gender": "MALE"},
        {"first_name": "Mwajuma", "last_name": "Abdi", "admission_no": "DLP/STU0058/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
        {"first_name": "Ramadhan", "last_name": "Omar", "admission_no": "DLP/STU0059/2024", "class_name": "Grade 3B", "gender": "MALE"},
        {"first_name": "Shani", "last_name": "Hassan", "admission_no": "DLP/STU0060/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
        {"first_name": "Shabani", "last_name": "Ibrahim", "admission_no": "DLP/STU0061/2024", "class_name": "Grade 1A", "gender": "MALE"},
        {"first_name": "Riziki", "last_name": "Yusuf", "admission_no": "DLP/STU0062/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
        {"first_name": "Kombo", "last_name": "Mohamed", "admission_no": "DLP/STU0063/2024", "class_name": "Grade 1B", "gender": "MALE"},
        {"first_name": "Mariamu", "last_name": "Ali", "admission_no": "DLP/STU0064/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
        {"first_name": "Haji", "last_name": "Salim", "admission_no": "DLP/STU0065/2024", "class_name": "Grade 2A", "gender": "MALE"},
        {"first_name": "Hadija", "last_name": "Rashid", "admission_no": "DLP/STU0066/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
        {"first_name": "Jumanne", "last_name": "Juma", "admission_no": "DLP/STU0067/2024", "class_name": "Grade 2B", "gender": "MALE"},
        {"first_name": "Sikitu", "last_name": "Abdi", "admission_no": "DLP/STU0068/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
        {"first_name": "Hemedi", "last_name": "Omar", "admission_no": "DLP/STU0069/2024", "class_name": "Grade 3A", "gender": "MALE"},
        {"first_name": "Tausi", "last_name": "Hassan", "admission_no": "DLP/STU0070/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
        {"first_name": "Masoud", "last_name": "Ibrahim", "admission_no": "DLP/STU0071/2024", "class_name": "Grade 3B", "gender": "MALE"},
        {"first_name": "Mwanaisha", "last_name": "Yusuf", "admission_no": "DLP/STU0072/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
        {"first_name": "Nassor", "last_name": "Mohamed", "admission_no": "DLP/STU0073/2024", "class_name": "Grade 1A", "gender": "MALE"},
        {"first_name": "Zuhura", "last_name": "Ali", "admission_no": "DLP/STU0074/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
        {"first_name": "Makame", "last_name": "Salim", "admission_no": "DLP/STU0075/2024", "class_name": "Grade 1B", "gender": "MALE"},
        {"first_name": "Mwanakombo", "last_name": "Rashid", "admission_no": "DLP/STU0076/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
        {"first_name": "Vuai", "last_name": "Juma", "admission_no": "DLP/STU0077/2024", "class_name": "Grade 2A", "gender": "MALE"},
        {"first_name": "Aziza", "last_name": "Abdi", "admission_no": "DLP/STU0078/2024", "class_name": "Grade 2A", "gender": "FEMALE"},
        {"first_name": "Khamis", "last_name": "Omar", "admission_no": "DLP/STU0079/2024", "class_name": "Grade 2B", "gender": "MALE"},
        {"first_name": "Saada", "last_name": "Hassan", "admission_no": "DLP/STU0080/2024", "class_name": "Grade 2B", "gender": "FEMALE"},
        {"first_name": "Shaaban", "last_name": "Ibrahim", "admission_no": "DLP/STU0081/2024", "class_name": "Grade 3A", "gender": "MALE"},
        {"first_name": "Binti", "last_name": "Yusuf", "admission_no": "DLP/STU0082/2024", "class_name": "Grade 3A", "gender": "FEMALE"},
        {"first_name": "Machano", "last_name": "Mohamed", "admission_no": "DLP/STU0083/2024", "class_name": "Grade 3B", "gender": "MALE"},
        {"first_name": "Mwanajuma", "last_name": "Ali", "admission_no": "DLP/STU0084/2024", "class_name": "Grade 3B", "gender": "FEMALE"},
        {"first_name": "Salehe", "last_name": "Salim", "admission_no": "DLP/STU0085/2024", "class_name": "Grade 1A", "gender": "MALE"},
        {"first_name": "Rehema", "last_name": "Rashid", "admission_no": "DLP/STU0086/2024", "class_name": "Grade 1A", "gender": "FEMALE"},
        {"first_name": "Mzee", "last_name": "Juma", "admission_no": "DLP/STU0087/2024", "class_name": "Grade 1B", "gender": "MALE"},
        {"first_name": "Subira", "last_name": "Abdi", "admission_no": "DLP/STU0088/2024", "class_name": "Grade 1B", "gender": "FEMALE"},
    ]
    
    # Import students
    for student in DLP_STUDENTS:
        existing = await db.students.find_one({"admission_no": student["admission_no"]})
        class_id = class_map.get(student["class_name"])
        
        if not existing:
            student_doc = {
                "id": str(uuid.uuid4()),
                "admission_no": student["admission_no"],
                "first_name": student["first_name"],
                "last_name": student["last_name"],
                "class_name": student["class_name"],
                "class_id": class_id,
                "gender": student["gender"],
                "chain": "DLP",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.students.insert_one(student_doc)
            results["students"] += 1
    
    # DLP Subjects
    DLP_SUBJECTS = [
        {"name": "Kiswahili", "code": "KIS"},
        {"name": "English", "code": "ENG"},
        {"name": "Mathematics", "code": "MATH"},
        {"name": "Religion", "code": "REL"},
        {"name": "Art & Sport", "code": "ART"},
        {"name": "Environment", "code": "ENV"},
    ]
    
    # Import subjects
    for subj in DLP_SUBJECTS:
        existing = await db.subjects.find_one({"name": subj["name"], "chain": "DLP"})
        if not existing:
            subj_doc = {
                "id": str(uuid.uuid4()),
                "name": subj["name"],
                "code": subj["code"],
                "chain": "DLP",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.subjects.insert_one(subj_doc)
            results["subjects"] += 1
    
    return {
        "message": "DLP data imported successfully",
        "imported": results,
        "total_dlp_students": await db.students.count_documents({"chain": "DLP"}),
        "total_dlp_classes": await db.classes.count_documents({"chain": "DLP"}),
        "total_dlp_subjects": await db.subjects.count_documents({"chain": "DLP"})
    }

@api_router.post("/import-dup-grade7")
async def import_dup_grade7_data(current_user: dict = Depends(get_current_user)):
    """Import REAL DUP Grade 7 students and Almanac events - Principal/Director only"""
    if not current_user or current_user.get('role') not in ['principal', 'director']:
        raise HTTPException(status_code=403, detail="Only Principal or Director can import data")
    
    results = {"students_inserted": 0, "students_updated": 0, "fake_deleted": 0, "almanac_inserted": 0, "almanac_updated": 0}
    
    # ========== REAL GRADE 7 STUDENTS (11 students) ==========
    REAL_GRADE7_STUDENTS = [
        {
            "address": "",
            "admission_no": "DUP/STU0013/2019",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.442160+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "WALID",
            "gender": "male",
            "id": "249317a6-36c6-4946-b578-140625a28f3f",
            "last_name": "ALI",
            "name": "WALID ALI",
            "parent_contact": "773515052",
            "parent_email": "",
            "parent_name": "KHAMIS",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.442160+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0012/2022",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.441521+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "SUHEIL",
            "gender": "male",
            "id": "4c344554-e6c1-4658-89be-626f3439041d",
            "last_name": "KHAMIS",
            "name": "SUHEIL KHAMIS",
            "parent_contact": "773908844",
            "parent_email": "",
            "parent_name": "TAHIR",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.441521+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0011/2025",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.440858+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "SAIMINA",
            "gender": "female",
            "id": "8b386562-071c-4d12-a2d5-3abdcb6a766b",
            "last_name": "TAHIR",
            "name": "SAIMINA TAHIR",
            "parent_contact": "625879800",
            "parent_email": "",
            "parent_name": "ALI KHAMIS",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.440858+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0009/2020",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.440376+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "NURFAT",
            "gender": "female",
            "id": "8a3fd390-2b8c-418e-9976-241674a8c82d",
            "last_name": "SAID",
            "name": "NURFAT SAID",
            "parent_contact": "773803231",
            "parent_email": "",
            "parent_name": "OSMAN",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.440376+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0008/2020",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.439850+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "MAWADDAH",
            "gender": "female",
            "id": "bd2ca508-4919-4337-8bf9-0f72d57fac49",
            "last_name": "OSMAN",
            "name": "MAWADDAH OSMAN",
            "parent_contact": "777456202",
            "parent_email": "",
            "parent_name": "HAFIDHI",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.439850+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0007/2022",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.439315+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "MALHA",
            "gender": "female",
            "id": "5ae185fc-30f2-4cdb-9b6c-6028d00edbf5",
            "last_name": "HAFIDHI",
            "name": "MALHA HAFIDHI",
            "parent_contact": "712346777",
            "parent_email": "",
            "parent_name": "ABDALLA",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.439315+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0006/2020",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.438802+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "ISMAIL",
            "gender": "male",
            "id": "a137a7ce-13bd-4ed9-98c0-0a776f8dfa3d",
            "last_name": "ABDALLA",
            "name": "ISMAIL ABDALLA",
            "parent_contact": "77525132",
            "parent_email": "",
            "parent_name": "YUSSUF",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.438802+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0005/2023",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.438287+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "IDAROUS",
            "gender": "male",
            "id": "281e5bd5-8983-47e0-bf30-8f3e417cacd1",
            "last_name": "YUSSUF",
            "name": "IDAROUS YUSSUF",
            "parent_contact": "656444373",
            "parent_email": "",
            "parent_name": "HABIB",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.438287+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0004/2024",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.437682+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "ASMAA",
            "gender": "female",
            "id": "5b3e6640-ae05-4932-9dab-18f31856e42c",
            "last_name": "HABIB",
            "name": "ASMAA HABIB",
            "parent_contact": "77903323",
            "parent_email": "",
            "parent_name": "AMEIR",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.437682+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0003/2019",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.437042+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "AMMAR",
            "gender": "male",
            "id": "23b71262-91e7-4e62-b75b-74313a205f77",
            "last_name": "AMEIR",
            "name": "AMMAR AMEIR",
            "parent_contact": "776410998",
            "parent_email": "",
            "parent_name": "CHANDE",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.437042+00:00"
        },
        {
            "address": "",
            "admission_no": "DUP/STU0002/2024",
            "chain": "DUP",
            "class_id": "30d7bba0-1e3a-4928-965f-4b2e9a20f15a",
            "class_name": "GRADE 7",
            "created_at": "2026-04-28T06:43:12.434354+00:00",
            "date_of_birth": "2015-01-01",
            "first_name": "ABUBAKAR",
            "gender": "male",
            "id": "45973005-d63e-4975-8f64-d2e545484be2",
            "last_name": "SLIM",
            "name": "ABUBAKAR SLIM",
            "parent_contact": "773441040",
            "parent_email": "",
            "parent_name": "SLIM",
            "password_hash": "$2b$12$PZhsbUlZoAKqwNGnRi7oOuIotQ/j3kxNXeTzxjhZMjoy1C3ehyPWK",
            "role": "student",
            "status": "active",
            "updated_at": "2026-04-28T06:43:12.434354+00:00"
        }
    ]
    
    # ========== REAL ALMANAC EVENTS (34 events) ==========
    REAL_ALMANAC_EVENTS = [
        {"id": "bd8e1b69-02c1-47a2-8c31-7c1a6f2f2364", "title": "Result", "description": "Result Day", "start_date": "2026-11-28", "end_date": "2026-11-28", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T11:12:36.141975+00:00", "chain": "DUP"},
        {"id": "5ddd434d-35f1-4ec5-bdfc-2eb3ff507c8a", "title": "End of ACADEMIC Year 2026", "description": "Closing school", "start_date": "2026-11-27", "end_date": "2026-11-27", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T11:12:14.761359+00:00", "chain": "DUP"},
        {"id": "583b90ee-1718-4991-8951-d122a22ccb34", "title": "Final Examination Day", "description": "Last term Examination", "start_date": "2026-11-11", "end_date": "2026-11-11", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T11:11:24.532206+00:00", "chain": "DUP"},
        {"id": "3f03a567-ed60-48e6-9378-cf277f3b68a6", "title": "Final Examination Preparation", "description": "typing , copying and submitting to Academic Office", "start_date": "2026-10-16", "end_date": "2026-10-16", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T11:10:36.753337+00:00", "chain": "DUP"},
        {"id": "659a75ee-7995-444a-bd36-d52323989503", "title": "National", "description": "Nyerere Day", "start_date": "2026-10-14", "end_date": "2026-10-14", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T11:09:45.434529+00:00", "chain": "DUP"},
        {"id": "697d8f92-737a-4b8e-85b1-fe2ae3085c25", "title": "Final Examination Preparation", "description": "submission of examinations to examination to Panel", "start_date": "2026-10-09", "end_date": "2026-10-09", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T11:09:15.698527+00:00", "chain": "DUP"},
        {"id": "a76ba4e6-1c5d-4def-a3fb-9e6d8f23d0f3", "title": "Result", "description": "result day", "start_date": "2026-09-26", "end_date": "2026-09-26", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T11:04:30.705784+00:00", "chain": "DUP"},
        {"id": "c5922731-5214-4214-ba26-f8285a9af03b", "title": "Examination", "description": "2nd midterm test", "start_date": "2026-09-02", "end_date": "2026-09-02", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T11:01:42.302286+00:00", "chain": "DUP"},
        {"id": "7d6d8a48-13fe-475b-bdc7-6e6d1d6b8ffe", "title": "National", "description": "Maulid", "start_date": "2026-08-27", "end_date": "2026-08-27", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:55:52.237818+00:00", "chain": "DUP"},
        {"id": "f74d40a2-6228-40b2-82ad-31c4bc5019fe", "title": "2nd midterm examination preparation", "description": "typing , copying and submitting to the Academic office", "start_date": "2026-08-14", "end_date": "2026-08-14", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:53:38.602953+00:00", "chain": "DUP"},
        {"id": "d544ce7d-9aef-4ef8-9058-aac0258c58ef", "title": "2nd midterm examination preparation", "description": "submitting examinations to Academic Office", "start_date": "2026-08-07", "end_date": "2026-08-07", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:52:46.221341+00:00", "chain": "DUP"},
        {"id": "d6b162cb-6157-4d43-b34a-96b77b9d3098", "title": "Leisure", "description": "School Trip", "start_date": "2026-07-25", "end_date": "2026-07-25", "visibility": "Activity", "eventType": "Activity", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:51:34.163774+00:00", "chain": "DUP"},
        {"id": "3583fa79-2c48-4146-9344-1fa00cfeae63", "title": "Islamic", "description": "Madrasa Event", "start_date": "2026-07-11", "end_date": "2026-07-11", "visibility": "Activity", "eventType": "Activity", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:50:51.358036+00:00", "chain": "DUP"},
        {"id": "c9031228-70d6-4766-a86d-f48b0fa0ef9d", "title": "Back to school", "description": "Opening School", "start_date": "2026-07-04", "end_date": "2026-07-04", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:49:32.624717+00:00", "chain": "DUP"},
        {"id": "ce63abab-7ebe-4f82-8a86-9d805927911c", "title": "Short Break", "description": "closing school for the first term break", "start_date": "2026-06-26", "end_date": "2026-06-26", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:48:41.864447+00:00", "chain": "DUP"},
        {"id": "287b4da7-0643-411d-8de2-642391bd8f69", "title": "Examinations", "description": "1st Term Examinations", "start_date": "2026-06-08", "end_date": "2026-06-08", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:47:05.703070+00:00", "chain": "DUP"},
        {"id": "2dee5f4b-8b95-4810-bdc9-cc9dc04d6113", "title": "Back to School", "description": "opening school", "start_date": "2026-06-01", "end_date": "2026-06-01", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:46:15.788323+00:00", "chain": "DUP"},
        {"id": "4ea6735a-d31b-4d45-8497-a8db7686c14a", "title": "Short Break", "description": "Closing School for Eid el Adha", "start_date": "2026-05-22", "end_date": "2026-05-22", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:45:06.055751+00:00", "chain": "DUP"},
        {"id": "a6d1bef3-7609-449a-9488-542b980b6433", "title": "1st Term Examination Preparations", "description": "typing , copying and submitting to the Academic Office", "start_date": "2026-05-12", "end_date": "2026-05-12", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:43:08.629272+00:00", "chain": "DUP"},
        {"id": "4057a2c6-f218-424c-8d4b-4335e81dc528", "title": "1st Term Exams Preparations", "description": "submission of examinations to examination panel", "start_date": "2026-05-08", "end_date": "2026-05-08", "visibility": "Exam", "eventType": "Exam", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:40:33.254180+00:00", "chain": "DUP"},
        {"id": "e71dcf46-1db9-47e5-9a89-92d05ae19ddc", "title": "National", "description": "Labor Day", "start_date": "2026-05-01", "end_date": "2026-05-01", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:39:24.209291+00:00", "chain": "DUP"},
        {"id": "abde6ecf-d88d-49d3-aadf-a4565fcd317e", "title": "National", "description": "Union Day", "start_date": "2026-04-26", "end_date": "2026-04-26", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:38:34.671844+00:00", "chain": "DUP"},
        {"id": "9d815b9e-5fcf-49e6-864c-d3e9cfe8b110", "title": "Break", "description": "Easter Monday", "start_date": "2026-04-06", "end_date": "2026-04-06", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:37:52.332816+00:00", "chain": "DUP"},
        {"id": "0a4a1d2c-c039-416b-9e9b-ce2029ac4981", "title": "break", "description": "karume day", "start_date": "2026-04-07", "end_date": "2026-04-07", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:37:27.535439+00:00", "chain": "DUP"},
        {"id": "8530b0bc-0cbe-48d2-963f-994264b016c6", "title": "BREAK", "description": "Good Friday", "start_date": "2026-04-03", "end_date": "2026-04-03", "visibility": "Holiday", "eventType": "Holiday", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:37:05.767166+00:00", "chain": "DUP"},
        {"id": "338fbf36-e875-4bd9-9d7d-9957a611a9bc", "title": "Meeting", "description": "Teacher Parent Meeting And results collecting", "start_date": "2026-04-04", "end_date": "2026-04-04", "visibility": "Meeting", "eventType": "Meeting", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:36:27.306885+00:00", "chain": "DUP"},
        {"id": "2e0e45aa-434a-4292-88d1-f31e0592ecbe", "title": "Short Break", "description": "Closing School For Eid El Fitr", "start_date": "2026-03-13", "end_date": "2026-03-13", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:35:08.049020+00:00", "chain": "DUP"},
        {"id": "7da60372-181e-4ad9-92b9-bef5c5508e35", "title": "Examination Day", "description": "1st midterm Examinations", "start_date": "2026-03-04", "end_date": "2026-03-04", "visibility": "Activity", "eventType": "Activity", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:34:16.018146+00:00", "chain": "DUP"},
        {"id": "fdd61e04-d314-4c66-a81d-4294474c749f", "title": "Examination Day", "description": "1st midterm Examinations", "start_date": "2026-03-04", "end_date": "2026-03-04", "visibility": "Activity", "eventType": "Activity", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:34:13.791419+00:00", "chain": "DUP"},
        {"id": "4cb40be4-837a-43be-84c0-fa83a136022a", "title": "1st midterm Exams Preparations", "description": "submission of exams to the Academic Offiice", "start_date": "2026-02-18", "end_date": "2026-02-18", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:33:15.209859+00:00", "chain": "DUP"},
        {"id": "0ee85dc2-b63c-405d-823a-54918e4eddd7", "title": "1st midterm Exams Preparations", "description": "Typing, printing and copying of examinations", "start_date": "2026-02-13", "end_date": "2026-02-13", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:32:39.760267+00:00", "chain": "DUP"},
        {"id": "661c5f48-be3f-4c4a-ad58-f3426fe944dd", "title": "1st midterm Exams Preparations", "description": "Submission of Examinations to Examination Panel", "start_date": "2026-02-09", "end_date": "2026-02-09", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:31:23.012627+00:00", "chain": "DUP"},
        {"id": "301bf21b-715c-4cbf-8238-8b2c655f8766", "title": "OPENING SCHOOL", "description": "Academic Year 2026", "start_date": "2026-01-13", "end_date": "2026-01-13", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-04-07T10:29:55.872313+00:00", "chain": "DUP"},
        {"id": "86a8b404-945d-451b-ba70-1108ec781e84", "title": "Back to School", "description": "End of eid-fitr holiday", "start_date": "2026-03-30", "end_date": "2026-03-30", "visibility": "Other", "eventType": "Other", "created_by": None, "created_by_role": "principal", "created_at": "2026-03-27T20:28:12.231617+00:00", "chain": "DUP"}
    ]
    
    # Delete fake Grade 7 students
    FAKE_STUDENT_NAMES = [
        "Khalid Omar", "Fatma Hassan", "Ibrahim Salim", "Zainab Ali", 
        "Ahmed Juma", "Maryam Rashid", "Hassan Mohamed", "Aisha Abdi", 
        "Yusuf Bakari", "Salma Hamisi", "Omar Said"
    ]
    
    # Build query to find fake students
    fake_names_conditions = []
    for name in FAKE_STUDENT_NAMES:
        parts = name.split()
        if len(parts) == 2:
            fake_names_conditions.append({"first_name": parts[0], "last_name": parts[1]})
    
    if fake_names_conditions:
        delete_result = await db.students.delete_many({
            "class_name": "GRADE 7",
            "chain": "DUP",
            "$or": fake_names_conditions
        })
        results["fake_deleted"] = delete_result.deleted_count
    
    # Insert/Update real Grade 7 students
    for student in REAL_GRADE7_STUDENTS:
        existing = await db.students.find_one({
            "$or": [
                {"admission_no": student["admission_no"]},
                {"id": student["id"]}
            ]
        })
        
        if existing:
            await db.students.update_one(
                {"_id": existing["_id"]},
                {"$set": student}
            )
            results["students_updated"] += 1
        else:
            await db.students.insert_one(student)
            results["students_inserted"] += 1
    
    # Insert/Update almanac events
    for event in REAL_ALMANAC_EVENTS:
        existing = await db.almanac_events.find_one({"id": event["id"]})
        
        if existing:
            await db.almanac_events.update_one(
                {"_id": existing["_id"]},
                {"$set": event}
            )
            results["almanac_updated"] += 1
        else:
            await db.almanac_events.insert_one(event)
            results["almanac_inserted"] += 1
    
    # Get current counts
    total_dup_students = await db.students.count_documents({"chain": "DUP"})
    total_grade7 = await db.students.count_documents({"class_name": "GRADE 7", "chain": "DUP"})
    total_almanac = await db.almanac_events.count_documents({"chain": "DUP"})
    
    # Get Grade 7 student names for verification
    grade7_students = await db.students.find(
        {"class_name": "GRADE 7", "chain": "DUP"},
        {"first_name": 1, "last_name": 1, "admission_no": 1, "_id": 0}
    ).to_list(length=100)
    
    return {
        "message": "REAL DUP Grade 7 students and Almanac events imported successfully!",
        "imported": results,
        "verification": {
            "total_dup_students": total_dup_students,
            "total_grade7_students": total_grade7,
            "total_dup_almanac_events": total_almanac,
            "grade7_students": grade7_students
        }
    }

# ============ DYNAMIC PWA MANIFEST ============

@api_router.get("/manifest/{chain_code}")
async def get_chain_manifest(chain_code: str):
    """Generate a dynamic manifest.json for a specific chain"""
    from fastapi.responses import JSONResponse
    
    # Get chain info
    chain = await db.chains.find_one({"code": chain_code.upper()}, {"_id": 0})
    
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    
    display_name = chain.get("display_name") or chain.get("name") or chain_code.upper()
    
    manifest = {
        "short_name": chain_code.upper(),
        "name": f"{display_name} - IHEZA",
        "description": f"{display_name} School Management Portal - Powered by IHEZA",
        "icons": [
            {
                "src": "/favicon.ico",
                "sizes": "64x64 32x32 24x24 16x16",
                "type": "image/x-icon"
            },
            {
                "src": "/logo192.png",
                "type": "image/png",
                "sizes": "192x192",
                "purpose": "any maskable"
            },
            {
                "src": "/logo512.png",
                "type": "image/png",
                "sizes": "512x512",
                "purpose": "any maskable"
            }
        ],
        "start_url": f"/chain/{chain_code.upper()}",
        "display": "standalone",
        "theme_color": "#0369a1",
        "background_color": "#e0f2fe",
        "orientation": "any",
        "scope": "/",
        "categories": ["education", "productivity"],
        "prefer_related_applications": False
    }
    
    return JSONResponse(content=manifest, media_type="application/manifest+json")

# ============ SEED DATA ============

@api_router.post("/seed")
async def seed_database():
    """Seed the database with initial data using new formats"""
    
    # Check if already seeded
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        return {"message": "Database already has data", "users": existing_users}
    
    current_year = datetime.now().year
    
    # Default users with new access code format
    default_users = [
        {
            "id": str(uuid.uuid4()),
            "access_code": f"IHEZA/DIRECTOR/001/{current_year}",
            "first_name": "Director",
            "last_name": "Admin",
            "email": "director@iheza.edu",
            "role": "director",
            "chain": "IHEZA",
            "status": "active",
            "password_hash": hash_password("director123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "access_code": f"IHEZA/COORDINATOR/001/{current_year}",
            "first_name": "Coordinator",
            "last_name": "Admin",
            "email": "coordinator@iheza.edu",
            "role": "coordinator",
            "chain": "IHEZA",
            "status": "active",
            "password_hash": hash_password("coordinator123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "access_code": f"DUP/PRINCIPAL/001/{current_year}",
            "first_name": "Principal",
            "last_name": "DUP",
            "email": "principal@dup.edu",
            "role": "principal",
            "chain": "DUP",
            "status": "active",
            "password_hash": hash_password("principal123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "access_code": f"DUP/TEACHER/001/{current_year}",
            "first_name": "Teacher",
            "last_name": "One",
            "email": "teacher1@dup.edu",
            "role": "teacher",
            "chain": "DUP",
            "status": "active",
            "password_hash": hash_password("teacher123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "access_code": f"DUP/ACADEMIC/001/{current_year}",
            "first_name": "Academic",
            "last_name": "Officer",
            "email": "academic@dup.edu",
            "role": "academic",
            "chain": "DUP",
            "status": "active",
            "password_hash": hash_password("academic123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "access_code": f"DUP/SECRETARY/001/{current_year}",
            "first_name": "Secretary",
            "last_name": "Admin",
            "email": "secretary@dup.edu",
            "role": "secretary",
            "chain": "DUP",
            "status": "active",
            "password_hash": hash_password("secretary123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "access_code": f"DUP/SECTION-LEADER/001/{current_year}",
            "first_name": "Section",
            "last_name": "Leader",
            "email": "sectionleader@dup.edu",
            "role": "section_leader",
            "chain": "DUP",
            "status": "active",
            "password_hash": hash_password("section123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        # Add staff for other chains
        {
            "id": str(uuid.uuid4()),
            "access_code": f"DLP/PRINCIPAL/001/{current_year}",
            "first_name": "Principal",
            "last_name": "DLP",
            "email": "principal@dlp.edu",
            "role": "principal",
            "chain": "DLP",
            "status": "active",
            "password_hash": hash_password("principal123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "access_code": f"LALE/PRINCIPAL/001/{current_year}",
            "first_name": "Principal",
            "last_name": "LALE",
            "email": "principal@lale.edu",
            "role": "principal",
            "chain": "LALE",
            "status": "active",
            "password_hash": hash_password("principal123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "access_code": f"OLGUN/PRINCIPAL/001/{current_year}",
            "first_name": "Principal",
            "last_name": "OLGUN",
            "email": "principal@olgun.edu",
            "role": "principal",
            "chain": "OLGUN",
            "status": "active",
            "password_hash": hash_password("principal123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
    ]
    
    await db.users.insert_many(default_users)
    
    # Default classes for each chain
    default_classes = []
    for chain in SCHOOL_PREFIXES:
        default_classes.extend([
            {"id": str(uuid.uuid4()), "name": "Grade 1A", "level": "Grade 1", "section": "A", "chain": chain, "capacity": 40, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Grade 1B", "level": "Grade 1", "section": "B", "chain": chain, "capacity": 40, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Grade 2A", "level": "Grade 2", "section": "A", "chain": chain, "capacity": 40, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Grade 3A", "level": "Grade 3", "section": "A", "chain": chain, "capacity": 40, "created_at": datetime.now(timezone.utc).isoformat()},
        ])
    
    await db.classes.insert_many(default_classes)
    
    # Default subjects for each chain
    # Standard subjects for all classes
    standard_subjects = ["Mathematics", "English", "Kiswahili", "Science and Technology", "Social Science", "Creative Art and Sport (CAS)"]
    # Additional subjects (Religion and Arabic separate for most classes, combined for Grade 4)
    additional_subjects = ["Religion", "Arabic"]
    
    subject_names = standard_subjects + additional_subjects
    default_subjects = []
    for chain in SCHOOL_PREFIXES:
        for subj in subject_names:
            default_subjects.append({
                "id": str(uuid.uuid4()),
                "name": subj,
                "code": subj[:4].upper(),
                "chain": chain,
                "description": subj,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        # Add combined "Religion and Arabic" for Grade 4
        default_subjects.append({
            "id": str(uuid.uuid4()),
            "name": "Religion and Arabic",
            "code": "RELA",
            "chain": chain,
            "description": "Combined Religion and Arabic for Grade 4",
            "grade_specific": "Grade 4",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.subjects.insert_many(default_subjects)
    
    # Sample students for DUP
    sample_students = [
        {
            "id": str(uuid.uuid4()),
            "admission_no": f"DUP/STU0001/{current_year}",
            "first_name": "Ali",
            "last_name": "Hassan",
            "gender": "MALE",
            "class_name": "Grade 1A",
            "admission_date": f"{current_year}-01-10",
            "chain": "DUP",
            "parent_name": "Hassan Omar",
            "parent_phone": "+255712345678",
            "status": "active",
            "password_hash": hash_password("student123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "admission_no": f"DUP/STU0002/{current_year}",
            "first_name": "Fatma",
            "last_name": "Juma",
            "gender": "FEMALE",
            "class_name": "Grade 1A",
            "admission_date": f"{current_year}-01-10",
            "chain": "DUP",
            "parent_name": "Juma Ali",
            "parent_phone": "+255712345679",
            "status": "active",
            "password_hash": hash_password("student123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "admission_no": f"DUP/STU0003/{current_year}",
            "first_name": "Omar",
            "last_name": "Said",
            "gender": "MALE",
            "class_name": "Grade 2A",
            "admission_date": f"{current_year}-01-10",
            "chain": "DUP",
            "parent_name": "Said Bakari",
            "parent_phone": "+255712345680",
            "status": "active",
            "password_hash": hash_password("student123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        # Students for other chains
        {
            "id": str(uuid.uuid4()),
            "admission_no": f"DLP/STU0001/{current_year}",
            "first_name": "Amina",
            "last_name": "Mohamed",
            "gender": "FEMALE",
            "class_name": "Grade 1A",
            "admission_date": f"{current_year}-01-10",
            "chain": "DLP",
            "parent_name": "Mohamed Ali",
            "parent_phone": "+255712345681",
            "status": "active",
            "password_hash": hash_password("student123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "admission_no": f"LALE/STU0001/{current_year}",
            "first_name": "Yusuf",
            "last_name": "Hamad",
            "gender": "MALE",
            "class_name": "Grade 1A",
            "admission_date": f"{current_year}-01-10",
            "chain": "LALE",
            "parent_name": "Hamad Salim",
            "parent_phone": "+255712345682",
            "status": "active",
            "password_hash": hash_password("student123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
    ]
    
    await db.students.insert_many(sample_students)
    
    return {
        "success": True,
        "message": "Database seeded successfully with new access code formats",
        "seeded": {
            "users": len(default_users),
            "classes": len(default_classes),
            "subjects": len(default_subjects),
            "students": len(sample_students)
        },
        "demo_credentials": {
            "director": f"IHEZA/DIRECTOR/001/{current_year} / director123",
            "coordinator": f"IHEZA/COORDINATOR/001/{current_year} / coordinator123",
            "principal_dup": f"DUP/PRINCIPAL/001/{current_year} / principal123",
            "teacher": f"DUP/TEACHER/001/{current_year} / teacher123",
            "student": f"DUP/STU0001/{current_year} / student123"
        }
    }

# ============ E-BOOK ROUTES ============

@api_router.get("/ebooks")
async def get_ebooks(
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all e-books, optionally filtered by chain"""
    query = {}
    if chain:
        query["chain"] = chain
    
    ebooks = await db.ebooks.find(query).sort("title", 1).to_list(100)
    
    # Ensure locked field exists and every book has an id
    result = []
    for book in ebooks:
        # Convert _id to id if no id field exists
        if "id" not in book or not book["id"]:
            book["id"] = str(book["_id"])
        # Remove _id from response
        book.pop("_id", None)
        if "locked" not in book:
            book["locked"] = False
        result.append(book)
    
    return result


@api_router.get("/ebooks/{ebook_id}/content")
async def get_ebook_content(
    ebook_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the content of an e-book file with lock enforcement"""
    # Find the ebook - try by id first, then by _id (for backward compatibility)
    ebook = await db.ebooks.find_one({"id": ebook_id}, {"_id": 0})
    if not ebook:
        # Fallback: try to find by MongoDB _id (for ebooks that don't have an id field)
        from bson.objectid import ObjectId
        try:
            ebook = await db.ebooks.find_one({"_id": ObjectId(ebook_id)}, {"_id": 0})
        except Exception:
            pass
    if not ebook:
        raise HTTPException(status_code=404, detail="e-Book not found")
    
    # Check if the book is locked
    is_locked = ebook.get("locked", False)
    if is_locked and current_user:
        user_role = current_user.get("role", "").lower()
        can_bypass = user_role in ["principal", "director", "coordinator"]
        if not can_bypass:
            raise HTTPException(status_code=403, detail="This e-book is locked by the principal")
    elif is_locked and not current_user:
        raise HTTPException(status_code=403, detail="This e-book is locked by the principal")
    
    # Get the file path
    file_url = ebook.get("file_url", "")
    if not file_url:
        raise HTTPException(status_code=404, detail="e-Book file not available")
    
    # Resolve the file path
    file_path = ROOT_DIR / file_url.lstrip("/")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="e-Book file not found on server")
    
    # Read and return the file content
    content = file_path.read_text(encoding="utf-8")
    return Response(content=content, media_type="text/html")


@api_router.patch("/ebooks/{ebook_id}/toggle-lock")
async def toggle_ebook_lock(
    ebook_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle the lock status of an e-book (principal/director/coordinator only)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_role = current_user.get("role", "").lower()
    if user_role not in ["principal", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="Only principal, director, or coordinator can lock/unlock e-books")
    
    ebook = await db.ebooks.find_one({"id": ebook_id})
    if not ebook:
        raise HTTPException(status_code=404, detail="e-Book not found")
    
    current_locked = ebook.get("locked", False)
    new_locked = not current_locked
    
    await db.ebooks.update_one(
        {"id": ebook_id},
        {"$set": {"locked": new_locked}}
    )
    
    return {"locked": new_locked, "id": ebook_id}


@api_router.delete("/ebooks/{ebook_id}")
async def delete_ebook(
    ebook_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an e-book (principal/director/coordinator only)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_role = current_user.get("role", "").lower()
    if user_role not in ["principal", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="Only principal, director, or coordinator can delete e-books")
    
    result = await db.ebooks.delete_one({"id": ebook_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="e-Book not found")
    
    return {"success": True, "message": "e-Book deleted successfully"}


# ============ ROOT-LEVEL HEALTH ENDPOINT ============
# The health checker / load balancer pings "/health" (not "/api/health").
# Registering at the app root ensures the health check succeeds and the
# app is not marked unhealthy (which previously triggered restart loops).
@app.get("/health")
async def root_health_check():
    """Root-level health check for load balancer / health checker.

    Kept lightweight and fast: the DB ping uses a short timeout so a slow
    database can never make this endpoint hang (which would recreate the
    upstream-timeout problem). Always returns HTTP 200 so the load balancer
    never marks the app unhealthy and triggers a restart loop.
    """
    try:
        # Ping with a short timeout so /health never hangs on a slow DB
        await client.admin.command('ping', maxTimeMS=2000)
        return {"status": "healthy", "database": "connected"}
    except Exception:
        # Gracefully degrade: still return 200 so the LB keeps the app up
        return {"status": "healthy", "database": "unreachable"}

# ============ ADMISSION MODELS & ENDPOINTS ============

class AdmissionRecord(BaseModel):
    """Student admission application record"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Applicant info
    student_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    height_cm: Optional[str] = None
    weight_kg: Optional[str] = None
    nationality: Optional[str] = None
    # Address & contact
    mkoa: Optional[str] = None
    wilaya: Optional[str] = None
    shehia: Optional[str] = None
    correspondence_address: Optional[str] = None
    phone_1: Optional[str] = None
    phone_2: Optional[str] = None
    tribe: Optional[str] = None
    religion: Optional[str] = None
    # Last school & medical
    last_school: Optional[str] = None
    last_school_year: Optional[str] = None
    final_exam_result: Optional[str] = None
    medical_info: Optional[str] = None
    # Parent / guardian
    father_name: Optional[str] = None
    father_profession: Optional[str] = None
    mother_name: Optional[str] = None
    mother_profession: Optional[str] = None
    emergency_contact_1: Optional[str] = None
    emergency_contact_2: Optional[str] = None
    # Consent & signature
    guardian_1_name: Optional[str] = None
    guardian_1_signature: Optional[str] = None
    guardian_2_name: Optional[str] = None
    guardian_2_signature: Optional[str] = None
    # Admission metadata
    admission_date: Optional[str] = None
    passport_photo: Optional[str] = None  # base64 data URI
    status: str = "pending"  # pending, approved, rejected
    chain: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.get("/admissions")
async def get_admissions(
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all admission records. Directors/Coordinators see all chains; others see their own chain.
    
    This endpoint merges records from BOTH the `admissions` collection AND the `students` collection,
    so that students registered via the Students component automatically appear in the Admission list.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    query = {}
    if chain:
        query["chain"] = chain
    else:
        query = get_chain_filter(current_user)
    
    # 1. Fetch admission records from the admissions collection (exclude heavy passport photos)
    admissions = await db.admissions.find(query, {"_id": 0, "passport_photo": 0}).sort("created_at", -1).to_list(300)
    admission_list = [serialize_doc(a) for a in admissions]
    
    # 2. Fetch students from the students collection and merge them in
    #    This ensures students added via the Students component appear in the Admission list.
    #    Exclude heavy fields like passport_photo and profile_pic
    students_query = dict(query)
    students = await db.students.find(students_query, {"_id": 0, "password_hash": 0, "passport_photo": 0, "profile_pic": 0}).to_list(500)
    
    # Build a set of existing admission student names (case-insensitive) to avoid duplicates
    existing_names = set()
    for a in admission_list:
        name = (a.get('student_name') or '').strip().lower()
        if name:
            existing_names.add(name)
    
    # Also track existing admission numbers to avoid duplicates
    existing_admission_nos = set()
    for a in admission_list:
        an = (a.get('admission_no') or '').strip().upper()
        if an:
            existing_admission_nos.add(an)
    
    for s in students:
        # Build a full student name
        first = s.get('first_name') or ''
        last = s.get('last_name') or ''
        full_name = f"{first} {last}".strip()
        admission_no = (s.get('admission_no') or '').upper()
        
        # Skip if this student already has an admission record (avoid duplicates)
        if admission_no and admission_no in existing_admission_nos:
            continue
        if full_name and full_name.lower() in existing_names:
            continue
        
        # Map student fields to admission fields so the Admission UI can display them
        student_as_admission = {
            "id": s.get('id') or str(uuid.uuid4()),
            "student_name": full_name or s.get('student_name') or 'Unnamed',
            "gender": (s.get('gender') or '').lower(),
            "date_of_birth": s.get('date_of_birth') or '',
            "place_of_birth": s.get('place_of_birth') or '',
            "height_cm": s.get('height_cm') or '',
            "weight_kg": s.get('weight_kg') or '',
            "nationality": s.get('nationality') or '',
            "mkoa": s.get('mkoa') or '',
            "wilaya": s.get('wilaya') or '',
            "shehia": s.get('shehia') or '',
            "correspondence_address": s.get('correspondence_address') or '',
            "phone_1": s.get('parent_phone') or s.get('phone_1') or '',
            "phone_2": s.get('phone_2') or '',
            "tribe": s.get('tribe') or '',
            "religion": s.get('religion') or '',
            "last_school": s.get('last_school') or '',
            "last_school_year": s.get('last_school_year') or '',
            "final_exam_result": s.get('final_exam_result') or '',
            "medical_info": s.get('medical_info') or '',
            "father_name": s.get('father_name') or '',
            "father_profession": s.get('father_profession') or '',
            "mother_name": s.get('mother_name') or '',
            "mother_profession": s.get('mother_profession') or '',
            "emergency_contact_1": s.get('emergency_contact_1') or '',
            "emergency_contact_2": s.get('emergency_contact_2') or '',
            "guardian_1_name": s.get('guardian_1_name') or s.get('parent_name') or '',
            "guardian_1_signature": s.get('guardian_1_signature') or '',
            "guardian_2_name": s.get('guardian_2_name') or '',
            "guardian_2_signature": s.get('guardian_2_signature') or '',
            "admission_date": s.get('admission_date') or '',
            "passport_photo": s.get('passport_photo') or '',
            "status": s.get('status') or 'approved',
            "chain": s.get('chain') or '',
            "class_name": s.get('class_name') or '',
            "admission_no": admission_no,
            "first_name": first,
            "last_name": last,
            "parent_name": s.get('parent_name') or '',
            "parent_phone": s.get('parent_phone') or '',
            "source": "students",  # Mark as coming from the students collection
            "created_at": s.get('created_at') or datetime.now(timezone.utc).isoformat(),
            "updated_at": s.get('updated_at') or datetime.now(timezone.utc).isoformat(),
        }
        admission_list.append(student_as_admission)
    
    # Sort merged list by created_at descending (newest first)
    def sort_key(item):
        created = item.get('created_at') or ''
        # created_at may be a datetime or ISO string
        if isinstance(created, datetime):
            return created.timestamp()
        try:
            return datetime.fromisoformat(str(created).replace('Z', '+00:00')).timestamp()
        except Exception:
            return 0
    
    admission_list.sort(key=sort_key, reverse=True)
    
    return admission_list

@api_router.get("/admissions/{admission_id}")
async def get_admission(admission_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single admission record by ID"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    admission = await db.admissions.find_one({"id": admission_id}, {"_id": 0})
    if not admission:
        raise HTTPException(status_code=404, detail="Admission record not found")
    return serialize_doc(admission)

@api_router.post("/admissions")
async def create_admission(payload: Dict, current_user: dict = Depends(get_current_user)):
    """Create a new admission record. Allowed for secretary, principal, director, coordinator.
    
    This endpoint ALSO creates a student record in the `students` collection so that
    students admitted via the Admission form automatically appear in the Students component.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    role = current_user.get('role', '').lower()
    if role not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Not authorized to create admission records")
    
    # Determine chain
    chain = payload.get("chain") or current_user.get("chain") or ''
    
    # Validate passport_photo size if provided (max 500KB)
    passport_photo = payload.get("passport_photo")
    if passport_photo and passport_photo.startswith("data:image/"):
        try:
            import base64 as _b64
            base64_part = passport_photo.split(",", 1)[1] if "," in passport_photo else passport_photo
            decoded_size = len(_b64.b64decode(base64_part))
            if decoded_size > 500 * 1024:
                raise HTTPException(status_code=400, detail="Passport photo must be less than 500KB")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid passport photo image data")
    
    # Build admission_no from chain + student_number + year if not provided
    admission_no = payload.get("admission_no") or ''
    if not admission_no:
        student_number = payload.get("student_number") or ''
        admission_year = payload.get("admission_year") or str(datetime.now().year)
        if chain and student_number:
            admission_no = f"{chain}/STU{str(student_number).zfill(4)}/{admission_year}"
    
    # Build first_name / last_name from student_name if not provided
    first_name = payload.get("first_name") or ''
    last_name = payload.get("last_name") or ''
    student_name = payload.get("student_name") or ''
    if not first_name and not last_name and student_name:
        parts = student_name.strip().split(' ', 1)
        first_name = parts[0] if parts else ''
        last_name = parts[1] if len(parts) > 1 else ''
    
    admission = {
        "id": str(uuid.uuid4()),
        "student_name": student_name or f"{first_name} {last_name}".strip(),
        "first_name": first_name,
        "last_name": last_name,
        "admission_no": admission_no,
        "chain": chain,
        "class_name": payload.get("class_name"),
        "parent_name": payload.get("parent_name"),
        "parent_phone": payload.get("parent_phone"),
        "date_of_birth": payload.get("date_of_birth"),
        "place_of_birth": payload.get("place_of_birth"),
        "height_cm": payload.get("height_cm"),
        "weight_kg": payload.get("weight_kg"),
        "nationality": payload.get("nationality"),
        "mkoa": payload.get("mkoa"),
        "wilaya": payload.get("wilaya"),
        "shehia": payload.get("shehia"),
        "correspondence_address": payload.get("correspondence_address"),
        "phone_1": payload.get("phone_1"),
        "phone_2": payload.get("phone_2"),
        "tribe": payload.get("tribe"),
        "religion": payload.get("religion"),
        "last_school": payload.get("last_school"),
        "last_school_year": payload.get("last_school_year"),
        "final_exam_result": payload.get("final_exam_result"),
        "medical_info": payload.get("medical_info"),
        "father_name": payload.get("father_name"),
        "father_profession": payload.get("father_profession"),
        "mother_name": payload.get("mother_name"),
        "mother_profession": payload.get("mother_profession"),
        "emergency_contact_1": payload.get("emergency_contact_1"),
        "emergency_contact_2": payload.get("emergency_contact_2"),
        "guardian_1_name": payload.get("guardian_1_name"),
        "guardian_1_signature": payload.get("guardian_1_signature"),
        "guardian_2_name": payload.get("guardian_2_name"),
        "guardian_2_signature": payload.get("guardian_2_signature"),
        "admission_date": payload.get("admission_date"),
        "passport_photo": payload.get("passport_photo"),
        "status": payload.get("status", "pending"),
        "created_by": current_user.get("id"),
        "created_by_name": current_user.get("name") or f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.admissions.insert_one(admission)
    
    # ALSO create a student record so the student appears in the Students component
    # Only if we have enough info (first_name, last_name, chain)
    if first_name and last_name and chain:
        # Check if a student with this admission_no already exists
        if admission_no:
            existing_student = await db.students.find_one({"admission_no": admission_no.upper()})
            if not existing_student:
                student_doc = {
                    "id": str(uuid.uuid4()),
                    "admission_no": admission_no.upper(),
                    "first_name": first_name,
                    "last_name": last_name,
                    "gender": (payload.get("gender") or '').upper(),
                    "date_of_birth": payload.get("date_of_birth"),
                    "class_id": payload.get("class_id"),
                    "class_name": payload.get("class_name"),
                    "admission_date": payload.get("admission_date") or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                    "status": "active",
                    "chain": chain,
                    "parent_name": payload.get("parent_name"),
                    "parent_phone": payload.get("parent_phone"),
                    "password_hash": hash_password(payload.get("password") or f"{chain.lower()}{admission_no.replace(chr(47), '').replace('STU', '').replace(chain, '')}"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.students.insert_one(student_doc)
    
    return serialize_doc(admission)


@api_router.put("/admissions/{admission_id}")
async def update_admission(admission_id: str, payload: Dict, current_user: dict = Depends(get_current_user)):
    """Update an existing admission record. Allowed for secretary, principal, director, coordinator.
    
    If the admission record came from the `students` collection (source: "students"),
    this endpoint ALSO updates the corresponding student record so both stay in sync.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    role = current_user.get('role', '').lower()
    if role not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Not authorized to update admission records")
    
    # First check if this is a student-sourced admission (from the students collection)
    # The admission_id might be a student's UUID id
    student = await db.students.find_one({"id": admission_id}, {"_id": 0, "password_hash": 0})
    
    if student:
        # This is a student-sourced admission - update the student record
        student_updates = {}
        
        # Map admission fields to student fields
        first_name = payload.get("first_name") or ''
        last_name = payload.get("last_name") or ''
        student_name = payload.get("student_name") or ''
        if not first_name and not last_name and student_name:
            parts = student_name.strip().split(' ', 1)
            first_name = parts[0] if parts else ''
            last_name = parts[1] if len(parts) > 1 else ''
        
        if first_name:
            student_updates["first_name"] = first_name
        if last_name:
            student_updates["last_name"] = last_name
        if payload.get("gender") is not None:
            student_updates["gender"] = (payload.get("gender") or '').upper()
        if payload.get("date_of_birth") is not None:
            student_updates["date_of_birth"] = payload.get("date_of_birth")
        if payload.get("class_name") is not None:
            student_updates["class_name"] = payload.get("class_name")
        if payload.get("parent_name") is not None:
            student_updates["parent_name"] = payload.get("parent_name")
        if payload.get("parent_phone") is not None:
            student_updates["parent_phone"] = payload.get("parent_phone")
        if payload.get("chain") is not None:
            student_updates["chain"] = payload.get("chain")
        if payload.get("admission_date") is not None:
            student_updates["admission_date"] = payload.get("admission_date")
        if payload.get("passport_photo") is not None:
            # Validate passport_photo size (max 500KB)
            passport_photo = payload.get("passport_photo")
            if passport_photo and passport_photo.startswith("data:image/"):
                try:
                    import base64 as _b64
                    base64_part = passport_photo.split(",", 1)[1] if "," in passport_photo else passport_photo
                    decoded_size = len(_b64.b64decode(base64_part))
                    if decoded_size > 500 * 1024:
                        raise HTTPException(status_code=400, detail="Passport photo must be less than 500KB")
                except HTTPException:
                    raise
                except Exception:
                    raise HTTPException(status_code=400, detail="Invalid passport photo image data")
            student_updates["passport_photo"] = passport_photo
        if payload.get("status") is not None:
            student_updates["status"] = payload.get("status")
        if payload.get("password"):
            student_updates["password_hash"] = hash_password(payload.get("password"))
        
        student_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.students.update_one({"id": admission_id}, {"$set": student_updates})
        
        # Also check if there's an admission record for this student and update it
        admission_record = await db.admissions.find_one({"admission_no": student.get("admission_no", "").upper()})
        if admission_record:
            admission_update = {k: v for k, v in payload.items() if k not in ("id", "_id", "created_at", "created_by")}
            admission_update["updated_at"] = datetime.now(timezone.utc)
            await db.admissions.update_one({"id": admission_record["id"]}, {"$set": admission_update})
        
        updated_student = await db.students.find_one({"id": admission_id}, {"_id": 0, "password_hash": 0})
        return serialize_doc(updated_student)
    
    # Otherwise, update the admission record in the admissions collection
    existing = await db.admissions.find_one({"id": admission_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Admission record not found")
    
    update_data = {k: v for k, v in payload.items() if k not in ("id", "_id", "created_at", "created_by")}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.admissions.update_one({"id": admission_id}, {"$set": update_data})
    updated = await db.admissions.find_one({"id": admission_id}, {"_id": 0})
    return serialize_doc(updated)

@api_router.delete("/admissions/{admission_id}")
async def delete_admission(admission_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an admission record. Allowed for secretary, principal, director, coordinator.
    
    If the admission record came from the `students` collection (source: "students"),
    this endpoint ALSO deletes the corresponding student record so both stay in sync.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    role = current_user.get('role', '').lower()
    if role not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Not authorized to delete admission records")
    
    # First check if this is a student-sourced admission (from the students collection)
    student = await db.students.find_one({"id": admission_id}, {"_id": 0})
    if student:
        # Move the student to the bin before deleting (so it can be restored)
        try:
            await move_to_bin("students", admission_id, current_user or {})
        except Exception as e:
            print(f"Warning: Failed to move student to bin: {e}")
            # Continue with deletion even if bin move fails
        
        # Delete the student record
        await db.students.delete_one({"id": admission_id})
        
        # Also delete any admission record for this student
        admission_record = await db.admissions.find_one({"admission_no": student.get("admission_no", "").upper()})
        if admission_record:
            await db.admissions.delete_one({"id": admission_record["id"]})
        
        return {"success": True, "message": "Student moved to bin"}
    
    # Otherwise, delete the admission record from the admissions collection
    result = await db.admissions.delete_one({"id": admission_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admission record not found")
    return {"success": True, "message": "Admission record deleted"}



# Include routers
app.include_router(api_router)
app.include_router(users_router, prefix="/api")



# CORS configuration - explicitly allow production domain
allowed_origins = [
    "https://iheza.online",
    "https://www.iheza.online",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add preview URL if set
preview_url = os.environ.get('REACT_APP_BACKEND_URL', '')
if preview_url:
    allowed_origins.append(preview_url)

# Also allow any origin from CORS_ORIGINS env var
env_origins = os.environ.get('CORS_ORIGINS', '')
if env_origins:
    allowed_origins.extend(env_origins.split(','))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],  # Allow all origins for maximum compatibility
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
