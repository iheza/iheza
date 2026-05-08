# IHEZA School Management System - Documentation Table of Contents

## 1. Introduction & Overview
### 1.1. System Purpose & Vision
- Educational management platform for Tanzanian schools
- Multi-chain architecture for school groups (DLP, DUP, etc.)
- Role-based access control with strict data isolation

### 1.2. Key Features
- Student Information Management
- Staff & Teacher Management  
- Academic Management (Grades, Report Cards)
- Attendance Tracking (Manual & QR-based)
- Fee Management & Financial Tracking
- Task Assignment & Management
- Academic Hub with Custom Forms
- Progressive Web App (PWA) Support
- Chain-based Data Isolation

### 1.3. Technology Stack
- **Frontend**: React 18, Redux Toolkit, Shadcn/UI, Tailwind CSS
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Authentication**: JWT-based with role-based permissions
- **Deployment**: PWA with Service Worker for offline support

## 2. System Architecture
### 2.1. High-Level Architecture
- Frontend-Backend Communication
- Database Schema Overview
- Chain Isolation Mechanism
- Authentication Flow

### 2.2. Directory Structure
```
/app
├── backend/           # FastAPI backend
│   ├── routes/       # Modular API routes
│   ├── tests/        # Backend tests
│   └── server.py     # Main application
├── frontend/         # React frontend
│   ├── src/
│   │   ├── pages/    # Application pages
│   │   ├── components/ # Reusable components
│   │   ├── services/ # API service layer
│   │   ├── store/    # Redux state management
│   │   └── config/   # Configuration files
└── memory/           # Project documentation
```

### 2.3. Database Collections
- Users (staff & students)
- Students
- Grades
- Report Cards
- Attendance Records
- Subjects
- Fees & Payments
- Tasks
- Almanac Events
- Special Fees & Notes

## 3. User Roles & Permissions
### 3.1. Role Hierarchy
1. **Director** - System-wide oversight
2. **Coordinator** - Multi-chain coordination
3. **Principal** - School-level administration
4. **Academic** - Academic management
5. **Teacher** - Classroom management
6. **Secretary** - Administrative tasks
7. **Section Leader** - Section/Department management
8. **Student** - Student portal access

### 3.2. Access Code Format
- Format: `PREFIX/ROLE/NUMBER/YEAR`
- Examples: `DLP/PRINCIPAL/0001/2024`, `DUP/STU0078/2016`
- Chain Prefixes: DLP, DUP, IHEZA

### 3.3. Portal-Specific Permissions
- **Student Portal**: Restricted to "My Portal" only
- **Staff Management**: Principal/Secretary only
- **Class Management**: Principal/Secretary only
- **Academic Hub**: Hidden from Directors
- **Grades Access**: Teacher, Academic, Section Leader, Principal
- **Report Cards**: Academic & Section Leader (edit/send), Students (view only)

## 4. Installation & Setup
### 4.1. Prerequisites
- Python 3.7+
- Node.js 16+
- MongoDB 4.4+
- Git

### 4.2. Backend Setup
```bash
cd /app/backend
pip install -r requirements.txt
cp .env.example .env  # Configure environment variables
python server.py
```

### 4.3. Frontend Setup
```bash
cd /app/frontend
yarn install
yarn start  # Development server
yarn build  # Production build
```

### 4.4. Database Initialization
- Staff import scripts
- Student import scripts
- Subject configuration
- Chain setup

## 5. Authentication & Security
### 5.1. Login Flow
- Portal selection
- Access code + password authentication
- JWT token generation
- Chain validation

### 5.2. Password Policies
- Staff: Password required
- Students: Passwordless authentication
- Default passwords: `CHAIN00000` (e.g., `DLP00000`)

### 5.3. Session Management
- JWT token expiration (24 hours)
- Automatic token refresh
- Logout functionality

## 6. Core Modules
### 6.1. Dashboard
- Role-specific dashboard views
- Quick access to common tasks
- System statistics

### 6.2. Student Management
#### 6.2.1. Student Records
- Add/Edit/Delete students (Secretary/Principal only)
- Student profile management
- Enrollment management

#### 6.2.2. Student Portal
- My Tasks (homework, classwork)
- My Report Cards (view only)
- My Fees (payment tracking)
- Announcements (chain-filtered)

### 6.3. Staff Management
- Staff directory
- Role assignment
- Profile management
- Chain-based filtering

### 6.4. Class Management
- Class creation/deletion (Principal/Secretary only)
- Subject assignment
- Student enrollment
- Class statistics

## 7. Academic Management
### 7.1. Grade Entry System
- Teacher grade entry by Class → Subject → Term
- Auto-grade calculation (A-F scale)
- Class statistics (average, highest, lowest, pass rate)
- Auto-fill remarks based on grades

### 7.2. Report Card System
- Academic/Section Leader: Edit and send report cards
- Behavior marks (neatness, cooperation, responsibility, punctuality, discipline)
- Teacher and principal comments
- Student view of sent reports
- DOC export with professional styling

### 7.3. Academic Hub
#### 7.3.1. Lesson Plans
- Comprehensive lesson planning forms
- Word export functionality
- Template management

#### 7.3.2. Scheme of Work
- Tanzania/Zanzibar curriculum formats
- Term-based planning
- Word export functionality

#### 7.3.3. Subject Evaluation
- Topic coverage tracking
- Progress monitoring
- Word export functionality

#### 7.3.4. Continuous Assessment
- Assessment form creation
- Rubric management
- Word export functionality

## 8. Attendance Management
### 8.1. Manual Attendance
- Landscape attendance book UI
- Click-cycling for status: `/` and `\` (Present), `.` (Absent)
- Day initials (S, M, T, W...) above dates
- Bulk attendance marking

### 8.2. QR-Based Attendance
#### 8.2.1. QR Code Generation
- Principal generates QR codes (expires in 1 year)
- Format: `PREFIX-QR-XXXXXXXX`
- School chain prefix validation

#### 8.2.2. QR Scanning Flow
1. Staff scans wall QR code
2. System verifies QR code matches school chain
3. Access code auto-filled if valid
4. Auto-determines Check In vs Check Out
   - First scan in 24 hours = Check In
   - Second scan = Check Out
5. Late detection: Check-in after 8:00 AM marked as LATE

#### 8.2.3. QR Code Management
- QR code generation
- Expiration tracking
- Usage statistics

## 9. Financial Management
### 9.1. Fee Structure Management
- Chain-specific fee structures
- Fee breakdown by category
- Payment schedule configuration

### 9.2. Student Fees
- Total fees per student (editable by Secretary/Principal)
- Payment recording
- Balance calculation
- Payment history

### 9.3. Special Fees
- Additional fee types
- Custom fee descriptions
- Chain-specific special fees

### 9.4. Financial Reports
- Payment summaries
- Outstanding balances
- Revenue tracking
- DOC export functionality

## 10. Task Management
### 10.1. Task Assignment
- Principal assigns tasks to staff
- Task categories: Pending, In Progress, Completed
- Blinking indicator for pending tasks
- Chain-filtered staff lists

### 10.2. My Tasks
- Staff view of assigned tasks
- Task status updates
- Due date tracking
- Priority levels

### 10.3. Classroom Tasks
- Teacher assigns tasks to students
- Homework, classwork, tests
- Student view in "My Tasks" tab

## 11. Communication & Calendar
### 11.1. Announcements
- Chain-filtered announcements
- Publication status control
- Student portal visibility

### 11.2. Almanac (Calendar)
- Monthly calendar view
- Event types: Holiday, Exam, Meeting, Activity, Other
- Year selector (2024-2028)
- Upcoming events sidebar
- Edit permissions: Section Leader & Principal only
- Read-only view for other users

## 12. Chain System
### 12.1. Chain Concept
- Data isolation between school chains
- Chain prefixes: DLP, DUP, IHEZA
- Cross-chain visibility restrictions

### 12.2. Chain Configuration
- Chain-specific subjects
- Chain-specific fee structures
- Chain-specific user management
- Chain landing pages

### 12.3. Chain Verification
- Backend chain filtering on all endpoints
- Frontend chain validation
- Data isolation testing procedures

## 13. Progressive Web App (PWA)
### 13.1. PWA Features
- Installable on mobile/desktop
- Offline caching via Service Worker
- App-like experience
- Automatic updates

### 13.2. Service Worker Configuration
- Cache management
- Update detection
- Cache busting strategies

### 13.3. PWA Installation
- Install prompt component
- Compatibility detection
- Installation guidance

## 14. Mobile Responsiveness
### 14.1. Responsive Design
- Mobile (375px), Tablet (768px), Laptop (1024px) breakpoints
- Hamburger menu for mobile navigation
- Touch-friendly interfaces
- No horizontal overflow

### 14.2. Mobile-Specific Features
- QR code scanning optimization
- Touch-based attendance marking
- Mobile-formatted reports

## 15. API Documentation
### 15.1. Authentication Endpoints
- `POST /api/auth` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info

### 15.2. User Management Endpoints
- `GET /api/users` - Get users (chain-filtered)
- `POST /api/users` - Create user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### 15.3. Student Endpoints
- `GET /api/students` - Get students (chain-filtered)
- `POST /api/students` - Create student
- `PUT /api/students/{id}` - Update student
- `GET /api/student-portal/my-fees` - Student fees
- `GET /api/student-portal/my-report-cards` - Student report cards

### 15.4. Academic Endpoints
- `GET /api/grades` - Get grades
- `POST /api/grades` - Save grade
- `PUT /api/grades/{id}` - Update grade
- `GET /api/report-cards` - Get report cards
- `POST /api/report-cards` - Save report card
- `POST /api/report-cards/{id}/send` - Send to student

### 15.5. Attendance Endpoints
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Mark attendance
- `POST /api/qr-codes/verify` - Verify QR code
- `POST /api/attendance/qr-checkin` - QR check-in/out

### 15.6. Fee Management Endpoints
- `GET /api/fees` - Get fee records
- `POST /api/fees` - Record payment
- `GET /api/fee-structures` - Get fee structures
- `POST /api/special-fees` - Add special fee

### 15.7. Task Management Endpoints
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/my-tasks` - Get user's tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/{id}` - Update task

### 15.8. Calendar Endpoints
- `GET /api/almanac` - Get calendar events
- `POST /api/almanac` - Create event
- `DELETE /api/almanac` - Delete event

## 16. Deployment Guide
### 16.1. Production Deployment
- Server requirements
- Environment configuration
- SSL certificate setup
- Domain configuration

### 16.2. Database Deployment
- MongoDB production setup
- User authentication
- Backup procedures
- Migration scripts

### 16.3. Chain Deployment
- Adding new school chains
- Chain-specific configuration
- User migration procedures

### 16.4. Update Procedures
- Code deployment process
- Database migration
- Cache clearing procedures
- Service worker updates

## 17. Testing & Quality Assurance
### 17.1. Test Credentials
- Director: `IHEZA/DIRECTOR/0001/2020` / `IHEZA00000`
- DUP Principal: `DUP/PRINCIPAL/0002/2021` / `DUP00000`
- DLP Principal: `DLP/PRINCIPAL/0001/2024` / `DLP00000`
- Secretary: `DUP/SECRETARY/0001/2024` / `DUP00000`
- Teacher: `DUP/TEACHER/0001/2024` / `DUP00000`
- Academic: `DUP/ACADEMIC/0002/2022` / `DUP00000`
- Student: `DUP/STU0078/2016` (no password)

### 17.2. Testing Procedures
- Chain isolation testing
- Role-based permission testing
- Cross-browser compatibility
- Mobile responsiveness testing

### 17.3. Automated Testing
- Backend API tests
- Frontend component tests
- Integration tests
- End-to-end tests

## 18. Troubleshooting & Support
### 18.1. Common Issues
- Login failures
- Chain data mixing
- Cache issues
- Service worker problems

### 18.2. Debugging Procedures
- Browser developer tools
- Server logs
- Database queries
- Network traffic analysis

### 18.3. Cache Management
- Browser cache clearing
- Service worker unregistration
- LocalStorage cleanup
- Session management

## 19. Maintenance & Updates
### 19.1. Regular Maintenance
- Database backups
- Log rotation
- Performance monitoring
- Security updates

### 19.2. Update Procedures
- Version control workflow
- Database migration scripts
- Rollback procedures
- User notification

## 20. Appendices
### 20.1. Glossary
- Chain: School group with data isolation
- Portal: Role-specific interface
- Access Code: Unique user identifier
- PREFIX: School chain identifier

### 20.2. Grading Scale
- A (81-100): Excellent
- B (61-80): Very Good  
- C (41-60): Good
- D (21-40): Satisfactory
- F (0-20): Fail

### 20.3. Time Zone Configuration
- East Africa Time (UTC+3)
- Attendance time calculations
- Report date formatting

### 20.4. File Structure Reference
- Complete file tree
- Configuration file locations
- Template file locations

---

## Documentation Status
- ✅ **Complete**: Core system documentation
- 🔄 **In Progress**: API endpoint details
- 📋 **Planned**: Deployment guides
- 🔧 **Needs Update**: Recent feature additions

## Version Information
- **System Version**: 2.0.0
- **Last Updated**: April 2026
- **Documentation Version**: 1.0.0