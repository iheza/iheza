"""
Shared dependencies for IHEZA School Management System routes
Contains constants, models, helper functions, and authentication
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import re
import bcrypt
import jwt
import logging

from database import db, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS

# Configure logging
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer(auto_error=False)

# ============ CONSTANTS ============

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
    """Validate staff access code format: INITIAL/ROLE/NUMBER/YEAR"""
    pattern = r'^([A-Z]+)/([A-Z-]+)/(\d{3,4})/(\d{4})$'
    match = re.match(pattern, access_code.upper())
    
    if not match:
        return {'valid': False, 'error': 'Invalid format. Expected: PREFIX/ROLE/NUMBER/YEAR'}
    
    prefix, role, number, year = match.groups()
    role_normalized = role.lower().replace('-', '_')
    
    # Allow any chain prefix (not just predefined ones)
    # This allows new chains like BACA, etc.
    # if prefix not in ALL_PREFIXES:
    #     return {'valid': False, 'error': f'Invalid prefix. Must be one of: {", ".join(ALL_PREFIXES)}'}
    
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
    """Validate student admission number format: INITIAL/STUXXXX/YEAR"""
    pattern = r'^([A-Z]+)/STU(\d{4})/(\d{4})$'
    match = re.match(pattern, admission_no.upper())
    
    if not match:
        return {'valid': False, 'error': 'Invalid format. Expected: PREFIX/STUXXXX/YEAR'}
    
    prefix, student_number, year = match.groups()
    
    # Allow any chain prefix for students (not just predefined ones)
    # This allows new chains like BACA, etc.
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
    return f"{prefix}/{role_upper}/001/{year}"

def generate_student_admission_number(prefix: str, year: int = None) -> str:
    """Generate a new student admission number"""
    if year is None:
        year = datetime.now().year
    return f"{prefix}/STU0001/{year}"

# ============ PASSWORD & JWT HELPERS ============

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

# ============ UTILITY FUNCTIONS ============

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
        # DLP data should ONLY be visible to DLP chain users and IHEZA (directors/coordinators)
        # DUP principals should NOT see DLP students/classes
        if chain == 'DUP':
            return {'chain': {'$in': ['DUP']}}
        return {'chain': chain}
    
    return {}  # No chain filter if chain is empty

def can_register(registrar_role: str, target_role: str) -> bool:
    """Check if a role can register another role"""
    role_info = ROLES.get(registrar_role, {})
    return target_role in role_info.get('can_register', [])

# ============ PYDANTIC MODELS ============

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
    gender: str
    date_of_birth: Optional[str] = None
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    admission_date: Optional[str] = None
    status: str = "active"
    chain: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None

class StudentCreate(StudentBase):
    password: str

class LoginRequest(BaseModel):
    accessCode: str
    password: str
    portal: str
    chain: Optional[str] = None

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
    target_type: str
    target_id: str
    chain: str
    date: str
    status: str
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

class FeeStructure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    amount: float
    chain: str
    class_name: Optional[str] = None
    mandatory: bool = True
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    fee_structure_id: Optional[str] = None
    fee_type: Optional[str] = None
    amount: float
    payment_method: str = "cash"
    reference_no: Optional[str] = None
    received_by: Optional[str] = None
    chain: Optional[str] = None
    notes: Optional[str] = None
    uniform_fee_details: Optional[str] = None
    admission_fee_details: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReportCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    term: str
    academic_year: str
    chain: str
    neatness: int = 3
    cooperation: int = 3
    responsibility: int = 3
    punctuality: int = 3
    discipline: int = 3
    teacher_comment: Optional[str] = None
    principal_comment: Optional[str] = None
    position: Optional[int] = None
    total_students: Optional[int] = None
    status: str = "draft"
    sent_at: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    announcement_type: str = "general"
    target_audience: List[str] = []
    chain: str
    priority: str = "normal"
    attachments: List[str] = []
    created_by: str
    created_by_name: Optional[str] = None
    status: str = "published"
    expires_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StaffTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    assigned_to: str
    assigned_to_name: Optional[str] = None
    assigned_to_role: Optional[str] = None
    assigned_by: str
    assigned_by_name: Optional[str] = None
    chain: str
    priority: str = "medium"
    due_date: Optional[str] = None
    status: str = "pending"
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    task_type: str
    class_name: str
    assigned_to: List[str] = []
    assigned_by: str
    assigned_by_name: Optional[str] = None
    chain: str
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    due_date: Optional[str] = None
    attachments: List[str] = []
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentTaskCompletion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    student_id: str
    status: str = "pending"
    submitted_at: Optional[str] = None
    completed_at: Optional[str] = None
    marked_by: Optional[str] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LessonPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    class_name: str
    topic: str
    duration: str
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
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SchemeOfWork(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    class_name: str
    term: str
    academic_year: str
    weeks: List[Dict[str, Any]] = []
    created_by: str
    chain: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubjectEvaluation(BaseModel):
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
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subject: str
    class_name: str
    assessment_type: str
    duration: Optional[str] = None
    total_marks: float = 100
    instructions: Optional[str] = None
    questions: List[Dict[str, Any]] = []
    created_by: str
    chain: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
