# IHEZA Backend Routes - Modular Architecture

This directory contains modular route handlers for the IHEZA School Management System.

## Structure

```
routes/
├── __init__.py         # Package initialization
├── auth.py             # Authentication routes (/auth, /me, /logout)
├── users.py            # User & Staff management routes
├── students.py         # Student management routes
├── classes.py          # Classes & Subjects routes
├── attendance.py       # Attendance & QR Code routes
```

## Migration Status

The routes have been extracted from the monolithic `server.py` into modular files.
These can be imported and included in a FastAPI app as follows:

```python
from routes.auth import router as auth_router
from routes.users import router as users_router
# ... etc

app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
```

## Remaining Routes to Extract

The following route groups remain in server.py and can be extracted as needed:
- grades.py - Grades & Report cards
- fees.py - Fees, Payments, Financial reports
- almanac.py - Almanac, Tasks
- reports.py - Report generation
- academic_hub.py - Lesson plans, Schemes of work, Assessments
- communications.py - Announcements
- student_portal.py - Student-specific endpoints

## Shared Dependencies

All routes import from:
- `database.py` - MongoDB connection and configuration
- `dependencies.py` - Shared models, validators, and utilities
