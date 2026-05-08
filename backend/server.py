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
    notes: Optional[str] = None
    uniform_fee_details: Optional[str] = None
    admission_fee_details: Optional[str] = None
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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != '_id'}
    for key, value in result.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
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
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": "User deleted"}

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

@api_router.get("/users/chains")
async def get_chains():
    """Get all chains from database"""
    # Temporarily allow unauthenticated access for testing
    chains = await db.chains.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return [serialize_doc(chain) for chain in chains] if chains else []

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
    if current_user.get('role') not in ['director', 'coordinator', 'principal']:
        raise HTTPException(status_code=403, detail="Only directors, coordinators, and principals can delete staff")
    
    result = await db.users.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    return {"success": True, "message": "Staff member deleted"}

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
    students = await db.students.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [serialize_doc(s) for s in students]

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
    result = await db.students.delete_one({"id": student_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"success": True, "message": "Student deleted"}

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
async def delete_class(class_id: str):
    result = await db.classes.delete_one({"id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"success": True, "message": "Class deleted"}

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
async def delete_subject(subject_id: str):
    result = await db.subjects.delete_one({"id": subject_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"success": True, "message": "Subject deleted"}

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
    # Sort by date descending to get newest records first, increase limit to 5000
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    return [serialize_doc(r) for r in records]

@api_router.post("/attendance", response_model=Dict)
async def record_attendance(record: AttendanceRecord, current_user: dict = Depends(get_current_user)):
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
    
    # Define late threshold (8:00 AM East Africa Time)
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
    
    # Define late threshold (8:00 AM East Africa Time)
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
    
    result = await db.qr_codes.delete_one({"id": qr_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="QR code not found")
    
    return {"success": True, "message": "QR code deleted"}

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
async def get_fees(student_id: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = get_chain_filter(current_user) if current_user else {}
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
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
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can manage fee structures")
    
    structure_doc = structure.model_dump()
    structure_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    structure_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.fee_structures.insert_one(structure_doc)
    structure_doc.pop('_id', None)
    return structure_doc

@api_router.put("/fee-structures/{structure_id}")
async def update_fee_structure(structure_id: str, updates: Dict, current_user: dict = Depends(get_current_user)):
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can manage fee structures")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.fee_structures.update_one({"id": structure_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    structure = await db.fee_structures.find_one({"id": structure_id}, {"_id": 0})
    return serialize_doc(structure)

@api_router.delete("/fee-structures/{structure_id}")
async def delete_fee_structure(structure_id: str, current_user: dict = Depends(get_current_user)):
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can manage fee structures")
    
    # Soft delete - set status to inactive
    result = await db.fee_structures.update_one(
        {"id": structure_id}, 
        {"$set": {"status": "inactive", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    return {"success": True, "message": "Fee structure deleted"}

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
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
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
    
    result = await db.almanac_events.delete_one({"id": id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}


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
    
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True}


@api_router.post("/payments", response_model=Dict)
async def record_payment(payment: Payment, current_user: dict = Depends(get_current_user)):
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
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
            # Get student info for chain
            student = await db.students.find_one({"id": student_id}, {"_id": 0})
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
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
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

@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a payment record"""
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary or principal can delete payments")
    
    # Find existing payment
    existing_payment = await db.payments.find_one({"id": payment_id})
    if not existing_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    payment_amount = existing_payment.get("amount", 0)
    student_id = existing_payment.get("student_id")
    
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
    
    # Get student
    student = await db.students.find_one({"id": student_id}, {"_id": 0, "password_hash": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    chain = student.get("chain")
    class_name = student.get("class_name")
    
    # Get all payments for this student - this is the source of truth
    payments = await db.payments.find({"student_id": student_id}, {"_id": 0}).to_list(100)
    total_paid = sum(p.get("amount", 0) for p in payments)
    
    # Check student_fees collection for total fee amount
    student_fee = await db.student_fees.find_one({"student_id": student_id}, {"_id": 0})
    
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
    
    return {
        "student": serialize_doc(student),
        "fee_structures": [serialize_doc(f) for f in fee_structures],
        "payments": [serialize_doc(p) for p in payments],
        "total_fees": total_fees,
        "total_paid": total_paid,
        "balance": balance,
        "status": "fully_paid" if balance <= 0 else ("partial" if total_paid > 0 else "unpaid")
    }

@api_router.put("/student-fees/{student_id}/total")
async def update_student_total_fees(student_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Update total fees for a student - Secretary/Principal only"""
    
    user_role = current_user.get("role", "").lower()
    if user_role not in ["secretary", "principal", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="Not authorized to update fees")
    
    # Get student
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
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

@api_router.get("/all-student-fees")
async def get_all_student_fees(
    class_name: Optional[str] = None,
    status: Optional[str] = None,
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all student fee records with student details for fee management display"""
    if current_user and current_user.get('role') not in ['secretary', 'principal', 'director', 'coordinator']:
        raise HTTPException(status_code=403, detail="Only secretary, principal, director, or coordinator can view all fee records")
    
    # For Directors/Coordinators, use the explicit chain param if provided
    user_role = current_user.get('role', '').lower() if current_user else ''
    if user_role in ['director', 'coordinator'] and chain:
        chain_filter = {'chain': chain.upper()}
    else:
        chain_filter = get_chain_filter(current_user) if current_user else {}
    
    # Get all students
    student_query = {**chain_filter}
    if class_name:
        student_query["class_name"] = class_name
    
    students = await db.students.find(student_query, {"_id": 0, "password_hash": 0}).to_list(1000)
    student_map = {s["id"]: s for s in students}
    
    # Get all student fee records
    fee_records = await db.student_fees.find(chain_filter, {"_id": 0}).to_list(5000)
    fee_map = {f["student_id"]: f for f in fee_records}
    
    # Get all special details
    special_details = await db.student_special_details.find(chain_filter, {"_id": 0}).to_list(5000)
    special_details_map = {sd["student_id"]: sd for sd in special_details}
    
    # Get special fees to determine fee types
    special_fees = await db.special_fees.find(chain_filter, {"_id": 0}).to_list(5000)
    special_fee_map = {}
    for sf in special_fees:
        sid = sf.get("student_id")
        if sid not in special_fee_map:
            special_fee_map[sid] = sf.get("fee_type", "tuition")
    
    # Get all payments grouped by student - THIS IS THE SOURCE OF TRUTH FOR PAID AMOUNTS
    payments = await db.payments.find(chain_filter, {"_id": 0}).to_list(5000)
    payment_map = {}
    paid_totals = {}  # Track total paid per student
    fee_type_from_payment = {}  # Track fee type from payments
    for p in payments:
        sid = p.get("student_id")
        if sid not in payment_map:
            payment_map[sid] = []
            paid_totals[sid] = 0
        payment_map[sid].append(p)
        paid_totals[sid] += p.get("amount", 0)
        # Store fee type from payment if available
        if p.get("fee_type"):
            fee_type_from_payment[sid] = p.get("fee_type")
    
    result = []
    for student in students:
        student_id = student["id"]
        fee_record = fee_map.get(student_id, {})
        student_payments = payment_map.get(student_id, [])
        
        total_fee = fee_record.get("amount", 0)
        # Use calculated paid amount from payments collection
        paid_amount = paid_totals.get(student_id, 0)
        outstanding = total_fee - paid_amount
        
        # Determine status
        if total_fee == 0:
            fee_status = "no_fee"
        elif outstanding <= 0:
            fee_status = "paid"
        elif paid_amount > 0:
            fee_status = "partial"
        else:
            fee_status = "unpaid"
        
        # Apply status filter
        if status and fee_status != status:
            continue
        
        # Get latest payment date
        last_payment_date = None
        if student_payments:
            sorted_payments = sorted(student_payments, key=lambda x: x.get("created_at", ""), reverse=True)
            last_payment_date = sorted_payments[0].get("created_at")
        
        # Get special notes and fee type
        student_special = special_details_map.get(student_id, {})
        fee_type = fee_type_from_payment.get(student_id) or special_fee_map.get(student_id, "tuition")
        
        result.append({
            "id": student_id,
            "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
            "admission_no": student.get("admission_no", ""),
            "class_name": student.get("class_name", "N/A"),
            "total_fee": total_fee,
            "paid": paid_amount,
            "outstanding": outstanding,
            "status": fee_status,
            "last_payment_date": last_payment_date,
            "special_notes": student_special.get("special_notes", ""),
            "fee_type": fee_type
        })
    
    # Sort by name
    result.sort(key=lambda x: x["name"])
    
    return result

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
    student_fees = await db.student_fees.find(chain_filter, {"_id": 0}).to_list(5000)
    
    # Get all payments
    payments = await db.payments.find(chain_filter, {"_id": 0}).sort("created_at", -1).to_list(5000)
    
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

# ============ REPORT CARDS ROUTES ============

@api_router.get("/report-cards", response_model=List[Dict])
async def get_report_cards(
    student_id: Optional[str] = None,
    term: Optional[str] = None,
    academic_year: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = get_chain_filter(current_user) if current_user else {}
    if student_id:
        query["student_id"] = student_id
    if term:
        query["term"] = term
    if academic_year:
        query["academic_year"] = academic_year
    if status:
        query["status"] = status
    
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
    
    records = await db.attendance.find(query, {"_id": 0}).to_list(5000)
    
    total = len(records)
    present = len([r for r in records if r.get("status") == "present"])
    absent = len([r for r in records if r.get("status") == "absent"])
    late = len([r for r in records if r.get("status") == "late"])
    
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
    
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    
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
        status = r.get("status", "absent")
        if status in by_date[date]:
            by_date[date][status] += 1
    
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
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get staff tasks (Principal assigns to staff)"""
    query = get_chain_filter(current_user) if current_user else {}
    if assigned_to:
        query["assigned_to"] = assigned_to
    if status:
        query["status"] = status
    
    tasks = await db.staff_tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
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
    
    result = await db.staff_tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True, "message": "Task deleted"}

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
    status = data.get("status", "completed")
    score = data.get("score")
    feedback = data.get("feedback")
    
    update_data = {
        "status": status,
        "marked_by": current_user.get("sub") if current_user else None
    }
    
    if status == "completed":
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
    
    # Delete the task
    result = await db.student_tasks.delete_one({"id": task_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Also delete all completions for this task
    await db.student_task_completions.delete_many({"task_id": task_id})
    
    return {"success": True, "message": "Task deleted"}

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
async def delete_lesson_plan(plan_id: str):
    result = await db.lesson_plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lesson plan not found")
    return {"success": True}

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
async def delete_assessment(assessment_id: str):
    result = await db.assessments.delete_one({"id": assessment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"success": True}

# ============ COMMUNICATIONS ROUTES ============

@api_router.get("/communications", response_model=List[Dict])
async def get_communications(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get communications/messages"""
    query = get_chain_filter(current_user) if current_user else {}
    if status:
        query["status"] = status
    
    communications = await db.communications.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [serialize_doc(c) for c in communications]

# ============ ANNOUNCEMENTS ROUTES ============

@api_router.get("/announcements", response_model=List[Dict])
async def get_announcements(
    status: Optional[str] = "published",
    announcement_type: Optional[str] = None,
    chain: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get announcements (all portals can view)"""
    query = get_chain_filter(current_user) if current_user else {}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        query['chain'] = chain
    
    if status:
        query["status"] = status
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
    
    result = await db.announcements.delete_one({"id": announcement_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"success": True, "message": "Announcement deleted"}

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
    
    return [serialize_doc(a) for a in announcements]

# ============ SYNC & HEALTH ============

@api_router.get("/sync")
async def get_sync_data(chain: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all data for frontend sync - supports chain filter for IHEZA users"""
    chain_filter = get_chain_filter(current_user) if current_user else {}
    
    # Allow IHEZA users (directors/coordinators) to filter by specific chain
    if chain and current_user and current_user.get('role') in ['director', 'coordinator']:
        chain_filter['chain'] = chain
    
    users = await db.users.find(chain_filter, {"_id": 0, "password_hash": 0}).to_list(1000)
    students = await db.students.find(chain_filter, {"_id": 0, "password_hash": 0}).to_list(1000)
    classes = await db.classes.find(chain_filter, {"_id": 0}).to_list(100)
    subjects = await db.subjects.find(chain_filter, {"_id": 0}).to_list(200)
    
    return {
        "users": [serialize_doc(u) for u in users],
        "students": [serialize_doc(s) for s in students],
        "staff": [serialize_doc(u) for u in users],
        "classes": [serialize_doc(c) for c in classes],
        "subjects": [serialize_doc(s) for s in subjects],
        "synced_at": datetime.now(timezone.utc).isoformat()
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
