# IHEZA School Management System - PRD

## Original Problem Statement
Migrate a React/Vite zip file ("iheza-project.zip") for the "IHEZA School Management System" to a FastAPI + MongoDB stack while enforcing strict Role Hierarchy, Access Code Formats, and Chain System Data Visibility.

## Core Requirements
- **Student Portal Restriction**: Student Portal strictly limited to "My Portal" (My Tasks, Report Cards, My Fees, Announcements)
- **Strict RBAC enforcement**: Students page Add/Edit limited to Secretary/Principal. Staff management limited to Principals. Add/Delete Classes limited to Principal/Secretary.
- **Landscape Attendance Book**: Custom UI to mark attendance via click-cycling (`/` and `\` for Present, `.` for Absent)
- **QR Auto Check-in/Out**: Scanning Location QR automatically checks logged-in user in/out, flags "Late" if after 8:00 AM
- **Academic Hub Custom Forms**: Embed raw React templates (Lesson Plans, Continuous Assessment, Scheme of Work, Subject Evaluation) in Academic Hub. Hide from Directors.

## Tech Stack
- **Frontend**: React 18, Redux Toolkit, Shadcn/UI, Lucide React Icons
- **Backend**: FastAPI, Motor (async MongoDB driver)
- **Database**: MongoDB
- **Auth**: JWT-based, passwordless for students

## User Roles & Access
| Role | Grades | Report Cards | Academic Hub |
|------|--------|--------------|--------------|
| Director | ❌ | ❌ | ❌ |
| Coordinator | ❌ | ❌ | ✅ |
| Principal | ✅ | ❌ | ✅ |
| Academic | ✅ | ✅ (Edit/Send) | ✅ |
| Teacher | ✅ | ❌ | ✅ |
| Secretary | ❌ | ❌ | ✅ |
| Section Leader | ✅ | ✅ (Edit/Send) | ✅ |
| Student | ❌ | View Only | ❌ |

## Grading Scale
| Score Range | Grade | Description |
|-------------|-------|-------------|
| 81-100 | A | Excellent |
| 61-80 | B | Very Good |
| 41-60 | C | Good |
| 21-40 | D | Satisfactory |
| 0-20 | F | Fail |

## Implemented Features

### Session: December 26, 2025

#### Grade Entry System ✅
- Teachers enter marks for students by Class → Subject → Term
- Auto-calculates grade based on score (A: 81+, B: 61-80, C: 41-60, D: 21-40, F: <21)
- Shows class statistics (average, highest, lowest, pass rate)
- Saves to `grades` collection in MongoDB

#### Report Card System ✅
- Academic/Section Leader can search students by class
- Edit behavior marks (neatness, cooperation, responsibility, punctuality, discipline) 1-5 stars
- Edit teacher and principal comments
- Save and Send to Student functionality
- Students see sent reports in "My Portal > Report Cards"

#### Reports > Academic Tab ✅
- Added student search dropdown (Class → Student → Term)
- Displays report card with grades, behavior, comments
- Read-only view for all staff portals

#### Subject Updates ✅
- "Science" → "Science and Technology"
- "Islamic Studies" → "Religion"

#### Academic Hub Templates ✅
- Lesson Plans (full form with Word export)
- Scheme of Work (Tanzania/Zanzibar formats with Word export)
- Subject Evaluation (topic coverage tracking with Word export)
- Assessments (Continuous Assessment form with Word export)
- Black font color fix for all form text areas

#### Navigation Updates ✅
- Removed "Grades" from Director, Coordinator, Secretary navigation
- Report Cards only accessible to Academic and Section Leader

### Session: December 27, 2025 (Continued)

#### QR Attendance Flow Fix ✅ (NEW)
- **Correct Flow Implemented**:
  1. Principal prints QR code (expires in 1 year), displayed on wall
  2. Staff scans wall QR code (format: PREFIX-QR-XXXXXXXX)
  3. System verifies QR code matches school chain prefix
  4. If valid, success message shown, user's access code auto-filled
  5. System auto-determines Check In vs Check Out (first scan in 24hrs = Check In, second = Check Out)
  6. Shows only ONE relevant action button
- Late detection: Check-in after 8:00 AM marked as LATE with duration
- QR code tracking stored in attendance records

#### PWA Installation Support ✅ (NEW)
- Added manifest.json with IHEZA branding
- Added service worker for offline caching
- PWA install prompt component shows on compatible devices
- Users can install the app on mobile/desktop for quick access

#### Mobile Responsive Hamburger Menu ✅
- Sidebar hidden by default on mobile
- Hamburger menu button in topbar opens sidebar overlay
- Click outside overlay closes sidebar
- Smooth animations for open/close transitions

#### Light Blue Theme ✅
- Applied light blue gradient background throughout the system
- Home page: `linear-gradient(135deg, #e3f2fd, #bbdefb)`
- Login page: Light blue with white card
- Portal cards: White/light background with dark blue text (#0f4c81)
- All headers use dark blue color for visibility

#### Mobile Responsive Design ✅
- Comprehensive responsive CSS added for all screen sizes
- Mobile (375px), Tablet (768px), Laptop (1024px) breakpoints
- No horizontal overflow on any viewport
- Forms, cards, tables scale properly

#### Almanac Component ✅ (NEW)
- Calendar view showing current month with day highlights
- Year selector (2024-2028)
- Upcoming Events sidebar
- **Only Section Leader and Principal can add/edit/delete events**
- All other users have read-only view with notice
- Event types: Holiday, Exam, Meeting, Activity, Other
- API: GET/POST/DELETE `/api/almanac`

#### My Tasks Component ✅ (NEW)
- Staff receive tasks assigned by Principal
- Shows Pending, In Progress, Completed sections
- **Blinking indicator** when pending tasks exist
- Click task to view details and update status
- **Available to**: Academic, Teacher, Secretary, Section Leader
- **NOT available to**: Student, Director, Coordinator, Principal (who assigns)
- API: GET `/api/tasks/my-tasks`, POST/PUT/DELETE `/api/tasks`

#### Navigation Updates ✅
- **Fees removed from Director and Coordinator** (only Principal and Secretary)
- **Almanac added** to all portals (including Student)
- **My Tasks added** to staff who receive tasks
- **Fee Structure** visible to all staff and students

#### QR Access Code Enhancement ✅
- QR scanner now recognizes staff access code format (PREFIX/ROLE/NUMBER/YEAR)
- When scanned, populates access code field for manual processing
- Original location QR format (PREFIX-QR-XXXXXXXX) still works for auto check-in

#### Login Page Cleanup ✅
- Removed demo credentials section
- Removed format hints
- Clean login form

### Session: April 21, 2026

#### Chain Isolation Verification ✅ (NEW)
- **Verified** backend chain filtering is working correctly on all critical endpoints
- `/api/sync`, `/api/students`, `/api/staff`, `/api/classes` all apply `get_chain_filter()`
- DLP Principal sees ONLY DLP data: 88 students, 1 staff member, 6 classes
- DUP data completely hidden from DLP users
- **Critical**: If production shows mixed data (e.g., 192 students), user must:
  1. Deploy latest code to production
  2. Clear browser cache/ServiceWorker (Ctrl+Shift+R or clear site data)
- Created DLP Principal user: `DLP/PRINCIPAL/0001/2024` / `DLP00000`

#### Task Assignment Chain Isolation Fix ✅ (NEW)
- Fixed `TaskAssignment.js` to use `apiClient` with auth token instead of raw `fetch()`
- Staff list now correctly filtered by chain - DLP Principal only sees DLP staff
- Tasks created/updated/deleted all use authenticated API calls

#### Gender Count Fix ✅ (NEW)  
- Fixed Students page and Classes page gender counting to handle both 'M'/'MALE' and 'F'/'FEMALE' values
- Stats now show correct Boys/Girls counts: 42 Boys, 46 Girls for DLP chain

#### DLP Fee Structure 2026 ✅ (NEW)
- Created chain-specific fee structure for DLP with completely different content
- DLP shows: IHEZA - DENIZ LOWER PRIMARY - School Fees Structure 2026
- Sections: 1. New Admission (Entry Fees + Note about LALE BUSTANI), 2. School Fees Breakdown (Monthly/Installment table), 3. Uniform, 4. Discount, 5. Payment Details (EXIM BANK Account 0150028734)
- DUP continues to see original 2025 fee structure (Deniz Upper Primary)

#### Teacher → Student Portal Data Visibility ✅ (VERIFIED)
- **Classroom Tasks** → Students see in "My Tasks" tab (homework, classwork, tests assigned by teachers)
- **Announcements** → Students see in "Announcements" tab (chain-filtered, published status only)
- **Report Cards** → Students see in "Report Cards" tab (when sent by staff)
- **Fees** → Students see in "My Fees" tab (overridden amounts from student_fees collection)
- All data is properly chain-filtered (DLP students only see DLP data)

#### DLP Subjects Configuration ✅ (NEW)
- Added 6 subjects specifically for DLP chain: Kiswahili, English, Mathematics, Religion, Art & Sport, Environment
- Removed other legacy subjects (Science and Technology, Social Science, Arabic, etc.) from DLP chain
- Subjects are chain-filtered via API - DLP users only see DLP subjects in all dropdowns
- Verified working in: Grades page, Classroom page (Assign Task modal)

#### Redux Profile Update Fix ✅ (VERIFIED)
- `authSlice.js` has `updateCurrentUser` action for immediate Header/Sidebar updates
- `Staff.js` dispatches state changes when editing own profile
- Profile picture and name update instantly without logout/login

### Session: April 4, 2026

#### Student Portal Total Fees Fix ✅
- Fixed `/api/student-portal/my-fees` endpoint to fetch `total_fees` from `student_fees` collection
- Secretary can edit Total Fees per student; Student Portal now reflects this edited amount
- Previously showed fee structures total (e.g., 1,575,000); now shows secretary-edited amount (e.g., 2,500,000)
- Balance calculation updated accordingly

#### Student Portal Report Card DOC Styling Fix ✅ (NEW)
- Student Portal's "Download DOC" button now uses `exportReportCard` from `docExport.js`
- Generates proper `.docx` files with professional CSS styling (Times New Roman, proper borders, colors)
- Matches the styling used in the main Reports component
- Previously generated raw HTML `.doc` files with poor formatting

### Session: April 1, 2026

#### Subject Management Updates ✅ (VERIFIED)
- **Social Studies → Social Science** (global rename)
- **Creative Art and Sport (CAS)** added to all classes
- **Religion and Arabic** combined subject for Grade 4 only
- Filtering logic in Grades.js dynamically shows correct subjects per grade:
  - Grade 4: Shows "Religion and Arabic" (combined), hides separate Religion/Arabic
  - Other Grades: Shows separate "Religion" and "Arabic", hides combined subject

#### Editable Total Fees ✅ (NEW)
- Total Fees in student fee summary (Fees > Payments) is now editable by Secretary/Principal
- Click on Total Fees value to enter edit mode
- Auto-saves after 1.5 seconds of no typing or on blur (no save button needed)
- Balance automatically recalculates
- Financial Reports total expected updates immediately
- API: `PUT /api/student-fees/{student_id}/total`

#### Fees Management Cleanup ✅ (NEW)
- **Removed Fee Structures tab** - Page now shows student list directly
- **Record Payment button** always visible for Secretary/Principal (not dependent on balance > 0)
- **Financial Reports Export DOC** fixed with white background for all elements

#### Report Card Download Fix ✅ (NEW)
- Fixed TypeError in `exportReportCard` function
- Added `Array.isArray()` checks for `behavior_marks` and `grades` arrays
- Report cards now download successfully as .docx files

#### Report Card UI Fix ✅ (NEW)
- Fixed white text color on Subject, Score, Remarks columns
- Now displays in black (#1a1a1a) for better readability

#### Auto-Fill Remarks in Grades ✅ (NEW)
- Remarks auto-fill based on grade letter when entering scores
- Existing grades without remarks get auto-filled on page load
- Grade-based remarks:
  - **A**: "Excellent performance! Keep up the outstanding work."
  - **B**: "Very good work. Shows strong understanding of the subject."
  - **C**: "Good effort. Continue working to improve further."
  - **D**: "Satisfactory. More practice and attention needed."
  - **F**: "Needs significant improvement. Extra support recommended."

#### Backend Refactoring (Phase 1) ✅ (NEW)
- Created modular route structure under `/app/backend/routes/`
- Extracted routes:
  - `auth.py` - Authentication routes
  - `users.py` - User & Staff management
  - `students.py` - Student management
  - `classes.py` - Classes & Subjects
  - `attendance.py` - Attendance & QR codes
- Shared utilities:
  - `database.py` - MongoDB connection config
  - `dependencies.py` - Models, validators, helpers
- Original server.py preserved with backup
- Remaining routes can be incrementally migrated

#### Previous Session Features ✅
- Profile pictures in Layout header and sidebar
- Teachers directory (read-only) for Student/Director/Coordinator
- Attendance UI with day initials (S, M, T, W...) above dates
- Payment Edit/Delete functionality for Secretary
- Download as DOC button in Academic Reports
- Term dropdowns include "Final" option
- PWA Service Worker with cache-busting
- East Africa Time (UTC+3) for attendance

### Previous Sessions
- Student Portal restricted to My Portal only
- Landscape Attendance Book with /\ and . marking
- QR Auto Check-in/out with late calculation
- Staff management RBAC enforcement
- Dynamic class dropdowns

## Database Collections
- `users`: Staff and students with role, chain, access_code
- `students`: Student records
- `grades`: {student_id, subject_id, chain, term, score, grade, remarks, recorded_by}
- `report_cards`: {student_id, term, academic_year, behavior_marks, comments, status: draft/sent}
- `attendance`: {target_id, target_type, date, status, check_in_time, check_out_time, is_late}
- `subjects`: {name, code, chain} - includes "Science and Technology", "Religion"
- `special_fees`: {student_id, fee_type, amount, description, chain, added_by, created_at}
- `student_fees`: {student_id, amount, paid_amount, chain}
- `payments`: {student_id, fee_type, amount, payment_method, reference_no, uniform_fee_details, admission_fee_details, received_by, chain}
- `student_special_details`: {student_id, special_notes, chain, added_by, updated_at}
- `almanac_events`: {id, title, description, start_date, end_date, visibility, eventType, created_by, created_at}
- `tasks`: {id, title, description, assigned_to, assigned_by, priority, due_date, status, chain, created_at, updated_at}

## API Endpoints
- `GET /api/grades` - Get grades with filters
- `POST /api/grades` - Save grade record
- `PUT /api/grades/{id}` - Update grade
- `GET /api/student-report-card/{student_id}` - Get full report card with grades
- `POST /api/report-cards` - Save report card metadata
- `POST /api/report-cards/{id}/send` - Mark as sent to student
- `GET /api/student-portal/my-report-cards` - Student's sent reports
- `GET /api/all-student-fees` - Get all student fee records with special_notes and fee_type
- `POST /api/special-fees` - Add special fee (Secretary only)
- `GET /api/special-fees` - Get special fees with filters
- `POST /api/student-special-details` - Save special notes for a student (Secretary only)
- `GET /api/student-special-details/{student_id}` - Get special notes for a student
- `GET /api/almanac` - Get all almanac events
- `POST /api/almanac` - Create event (Section Leader/Principal only)
- `DELETE /api/almanac?id={id}` - Delete event (Section Leader/Principal only)
- `GET /api/tasks/my-tasks` - Get tasks assigned to current user
- `GET /api/tasks` - Get all tasks (Principal/Director/Coordinator only)
- `POST /api/tasks` - Create task (Principal/Director/Coordinator only)
- `PUT /api/tasks/{id}` - Update task status
- `DELETE /api/tasks/{id}` - Delete task (Principal/Director/Coordinator only)
- `POST /api/qr-codes/verify` - Verify QR code format and return school info
- `POST /api/attendance/qr-checkin` - Manual check-in/check-out with access code and QR tracking

## Test Credentials
- Student: `DUP/STU0078/2016` (no password)
- DUP Principal: `DUP/PRINCIPAL/0002/2021` / `DUP00000`
- DLP Principal: `DLP/PRINCIPAL/0001/2024` / `DLP00000`
- Director: `IHEZA/DIRECTOR/0001/2020` / `IHEZA00000`
- Secretary: `DUP/SECRETARY/0001/2024` / `DUP00000`
- Teacher: `DUP/TEACHER/0001/2024` / `DUP00000`
- Academic: `DUP/ACADEMIC/0002/2022` / `DUP00000`

## Backlog / Future Tasks
1. **P0**: Continue Backend Route Extraction - Remaining routes (grades, fees, reports, academic_hub, tasks, student_portal) can be incrementally migrated to `/app/backend/routes/`
2. **P1**: Comprehensive Cross-Chain Visibility Testing
3. **P2**: Real-time notifications via WebSocket
4. **P2**: Email/SMS notification integrations
5. **P2**: Parent portal for viewing student progress

### Session: April 28, 2026

#### Real Grade 7 Students & Almanac Import ✅
- **Replaced fake Grade 7 students** (Khalid, Fatma, Ibrahim, etc.) with **11 real students**:
  - ABUBAKAR SLIM, AMMAR AMEIR, ASMAA HABIB, IDAROUS YUSSUF, ISMAIL ABDALLA
  - MALHA HAFIDHI, MAWADDAH OSMAN, NURFAT SAID, SAIMINA TAHIR, SUHEIL KHAMIS, WALID ALI
- **Imported 34 real Almanac events** for DUP chain (academic year 2026 calendar)
- Updated `/api/import-dup-grade7` endpoint to use real production data
- Dashboard "Import Grade 7" button now imports real students and almanac events
- **Preview environment**: Data successfully imported and verified
- **Production note**: User needs to deploy and click "Import" button from Dashboard

## Verified Test Credentials
- Principal: `DUP/PRINCIPAL/0002/2021` / `DUP00000`
- Academic: `DUP/ACADEMIC/0002/2022` / `DUP00000`
- Secretary: `DUP/SECRETARY/0001/2024` / `DUP00000`
- Teacher: `DUP/TEACHER/0001/2024` / `DUP00000`
- Student: `DUP/STU0078/2016` (Password blank)

### Session: September 2, 2026

#### CRITICAL P0 Fixes - Memory Overload & 502/520 Crashes ✅
**Problem**: Production app crashing due to massive unpaginated MongoDB queries loading into memory, coupled with aggressive frontend polling and large base64 image uploads.

**Implemented Fixes (September 2, 2026)**:
1. **Route Shadowing Fixed**: Moved `/api/users/chains` static route BEFORE parameterized `/api/users/{user_id}` to fix route shadowing
2. **Parameter Shadowing Fixed**: Renamed `status` parameters to `fee_status`, `task_status`, `report_status`, `comm_status`, `announcement_status` to avoid shadowing `fastapi.status` import
3. **Bare Except Fixed**: Changed `except:` to `except Exception:`
4. **Service Worker Fixed**: Changed `clients` to `self.clients` in sw.js
5. **Pagination Limits Drastically Reduced**:
   - `/api/all-student-fees`: page_size capped at 100 (was 1000), student projection limited to essential fields only
   - `/api/financial-report-students`: Added pagination (page_size=50 default, max 100), essential fields only
   - `/api/staff-tasks`: Reduced from 500 to 100 tasks max
   - `/api/students`: 500 records max, excludes passport_photo/profile_pic
   - `/api/admissions`: 300+500 records, excludes passport_photo
   - `/api/attendance`: 1000 records with minimal projection
   - `/api/reports/attendance`: Changed to MongoDB aggregation pipeline (no data loaded into memory)
   - Background tasks: `.to_list(None)` → `.to_list(5000-10000)`
6. **500KB Image Upload Limit**: Added to profile pic upload and admission passport photo endpoints
7. **Database Cleanup**: Script created and run to delete existing heavy base64 images

**Response Times (All Under 300ms)**:
- `/api/all-student-fees`: 135-198ms
- `/api/financial-report-students`: 133-156ms  
- `/api/staff-tasks`: 128-137ms
- `/api/students`: 148ms
- `/api/admissions`: 174ms
- `/api/reports/fees`: 253ms

**Files Modified**:
- `/app/backend/server.py` - All pagination and parameter fixes
- `/app/frontend/public/sw.js` - self.clients fix
- `/app/backend/cleanup_images.py` - Image cleanup script (run once)

**Testing (September 2, 2026)**: 
- All 9 backend tests passed, all 3 chain landing pages verified
- Response times: students 120-300ms, admissions 223-337ms, fees 121ms, reports 121-133ms
- All responses well under 500ms budget (production 502/520 risk eliminated)

**Production Cleanup Script**: `/app/backend/production_cleanup.py`
- Run this script on your production MongoDB to remove existing heavy base64 images
- Usage: `export MONGO_URL="your_connection_string" && python production_cleanup.py`

## Backlog / Future Tasks
1. **P0 (Fixed)**: ~~Memory Overload & 502/520 Crashes~~ ✅
2. **P0 (Pending)**: Chain Landing Page Mixing - Mobile dashboards sometimes show wrong chain links
3. **P1 (Pending)**: Mobile Horizontal Scrolling Bug - Test showed no issues on 375px viewport, but should verify on real devices
4. **P1 (Pending)**: Student Dashboard Duplication - Verify students only see appropriate features
5. **P2**: Continue Backend Route Extraction - server.py is 7827 lines, should split into routers
6. **P2**: Real-time notifications via WebSocket
7. **P2**: Email/SMS notification integrations
8. **P2**: Parent portal for viewing student progress
