"""
Import Real Grade 7 Students and Almanac Events to Production Database
Target: mongodb+srv://build-app-now-34:d73em5klqs2c73c1psf0@customer-apps.hfcqut.mongodb.net
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# Production MongoDB connection with longer timeout and TLS settings
PRODUCTION_MONGO_URL = "mongodb+srv://build-app-now-34:d73em5klqs2c73c1psf0@customer-apps.hfcqut.mongodb.net/?retryWrites=true&w=majority&serverSelectionTimeoutMS=30000&connectTimeoutMS=30000"
DB_NAME = "test_database"

# ============ REAL GRADE 7 STUDENTS (11 students) ============
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

# ============ REAL ALMANAC EVENTS (29 events) ============
REAL_ALMANAC_EVENTS = [
    {
        "id": "bd8e1b69-02c1-47a2-8c31-7c1a6f2f2364",
        "title": "Result",
        "description": "Result Day",
        "start_date": "2026-11-28",
        "end_date": "2026-11-28",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T11:12:36.141975+00:00",
        "chain": "DUP"
    },
    {
        "id": "5ddd434d-35f1-4ec5-bdfc-2eb3ff507c8a",
        "title": "End of ACADEMIC Year 2026",
        "description": "Closing school",
        "start_date": "2026-11-27",
        "end_date": "2026-11-27",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T11:12:14.761359+00:00",
        "chain": "DUP"
    },
    {
        "id": "583b90ee-1718-4991-8951-d122a22ccb34",
        "title": "Final Examination Day",
        "description": "Last term Examination",
        "start_date": "2026-11-11",
        "end_date": "2026-11-11",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T11:11:24.532206+00:00",
        "chain": "DUP"
    },
    {
        "id": "3f03a567-ed60-48e6-9378-cf277f3b68a6",
        "title": "Final Examination Preparation",
        "description": "typing , copying and submitting to Academic Office",
        "start_date": "2026-10-16",
        "end_date": "2026-10-16",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T11:10:36.753337+00:00",
        "chain": "DUP"
    },
    {
        "id": "659a75ee-7995-444a-bd36-d52323989503",
        "title": "National",
        "description": "Nyerere Day",
        "start_date": "2026-10-14",
        "end_date": "2026-10-14",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T11:09:45.434529+00:00",
        "chain": "DUP"
    },
    {
        "id": "697d8f92-737a-4b8e-85b1-fe2ae3085c25",
        "title": "Final Examination Preparation",
        "description": "submission of examinations to examination to Panel",
        "start_date": "2026-10-09",
        "end_date": "2026-10-09",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T11:09:15.698527+00:00",
        "chain": "DUP"
    },
    {
        "id": "a76ba4e6-1c5d-4def-a3fb-9e6d8f23d0f3",
        "title": "Result",
        "description": "result day",
        "start_date": "2026-09-26",
        "end_date": "2026-09-26",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T11:04:30.705784+00:00",
        "chain": "DUP"
    },
    {
        "id": "c5922731-5214-4214-ba26-f8285a9af03b",
        "title": "Examination",
        "description": "2nd midterm test",
        "start_date": "2026-09-02",
        "end_date": "2026-09-02",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T11:01:42.302286+00:00",
        "chain": "DUP"
    },
    {
        "id": "7d6d8a48-13fe-475b-bdc7-6e6d1d6b8ffe",
        "title": "National",
        "description": "Maulid",
        "start_date": "2026-08-27",
        "end_date": "2026-08-27",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:55:52.237818+00:00",
        "chain": "DUP"
    },
    {
        "id": "f74d40a2-6228-40b2-82ad-31c4bc5019fe",
        "title": "2nd midterm examination preparation",
        "description": "typing , copying and submitting to the Academic office",
        "start_date": "2026-08-14",
        "end_date": "2026-08-14",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:53:38.602953+00:00",
        "chain": "DUP"
    },
    {
        "id": "d544ce7d-9aef-4ef8-9058-aac0258c58ef",
        "title": "2nd midterm examination preparation",
        "description": "submitting examinations to Academic Office",
        "start_date": "2026-08-07",
        "end_date": "2026-08-07",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:52:46.221341+00:00",
        "chain": "DUP"
    },
    {
        "id": "d6b162cb-6157-4d43-b34a-96b77b9d3098",
        "title": "Leisure",
        "description": "School Trip",
        "start_date": "2026-07-25",
        "end_date": "2026-07-25",
        "visibility": "Activity",
        "eventType": "Activity",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:51:34.163774+00:00",
        "chain": "DUP"
    },
    {
        "id": "3583fa79-2c48-4146-9344-1fa00cfeae63",
        "title": "Islamic",
        "description": "Madrasa Event",
        "start_date": "2026-07-11",
        "end_date": "2026-07-11",
        "visibility": "Activity",
        "eventType": "Activity",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:50:51.358036+00:00",
        "chain": "DUP"
    },
    {
        "id": "c9031228-70d6-4766-a86d-f48b0fa0ef9d",
        "title": "Back to school",
        "description": "Opening School",
        "start_date": "2026-07-04",
        "end_date": "2026-07-04",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:49:32.624717+00:00",
        "chain": "DUP"
    },
    {
        "id": "ce63abab-7ebe-4f82-8a86-9d805927911c",
        "title": "Short Break",
        "description": "closing school for the first term break",
        "start_date": "2026-06-26",
        "end_date": "2026-06-26",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:48:41.864447+00:00",
        "chain": "DUP"
    },
    {
        "id": "287b4da7-0643-411d-8de2-642391bd8f69",
        "title": "Examinations",
        "description": "1st Term Examinations",
        "start_date": "2026-06-08",
        "end_date": "2026-06-08",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:47:05.703070+00:00",
        "chain": "DUP"
    },
    {
        "id": "2dee5f4b-8b95-4810-bdc9-cc9dc04d6113",
        "title": "Back to School",
        "description": "opening school",
        "start_date": "2026-06-01",
        "end_date": "2026-06-01",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:46:15.788323+00:00",
        "chain": "DUP"
    },
    {
        "id": "4ea6735a-d31b-4d45-8497-a8db7686c14a",
        "title": "Short Break",
        "description": "Closing School for Eid el Adha",
        "start_date": "2026-05-22",
        "end_date": "2026-05-22",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:45:06.055751+00:00",
        "chain": "DUP"
    },
    {
        "id": "a6d1bef3-7609-449a-9488-542b980b6433",
        "title": "1st Term Examination Preparations",
        "description": "typing , copying and submitting to the Academic Office",
        "start_date": "2026-05-12",
        "end_date": "2026-05-12",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:43:08.629272+00:00",
        "chain": "DUP"
    },
    {
        "id": "4057a2c6-f218-424c-8d4b-4335e81dc528",
        "title": "1st Term Exams Preparations",
        "description": "submission of examinations to examination panel",
        "start_date": "2026-05-08",
        "end_date": "2026-05-08",
        "visibility": "Exam",
        "eventType": "Exam",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:40:33.254180+00:00",
        "chain": "DUP"
    },
    {
        "id": "e71dcf46-1db9-47e5-9a89-92d05ae19ddc",
        "title": "National",
        "description": "Labor Day",
        "start_date": "2026-05-01",
        "end_date": "2026-05-01",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:39:24.209291+00:00",
        "chain": "DUP"
    },
    {
        "id": "abde6ecf-d88d-49d3-aadf-a4565fcd317e",
        "title": "National",
        "description": "Union Day",
        "start_date": "2026-04-26",
        "end_date": "2026-04-26",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:38:34.671844+00:00",
        "chain": "DUP"
    },
    {
        "id": "9d815b9e-5fcf-49e6-864c-d3e9cfe8b110",
        "title": "Break",
        "description": "Easter Monday",
        "start_date": "2026-04-06",
        "end_date": "2026-04-06",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:37:52.332816+00:00",
        "chain": "DUP"
    },
    {
        "id": "0a4a1d2c-c039-416b-9e9b-ce2029ac4981",
        "title": "break",
        "description": "karume day",
        "start_date": "2026-04-07",
        "end_date": "2026-04-07",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:37:27.535439+00:00",
        "chain": "DUP"
    },
    {
        "id": "8530b0bc-0cbe-48d2-963f-994264b016c6",
        "title": "BREAK",
        "description": "Good Friday",
        "start_date": "2026-04-03",
        "end_date": "2026-04-03",
        "visibility": "Holiday",
        "eventType": "Holiday",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:37:05.767166+00:00",
        "chain": "DUP"
    },
    {
        "id": "338fbf36-e875-4bd9-9d7d-9957a611a9bc",
        "title": "Meeting",
        "description": "Teacher Parent Meeting And results collecting",
        "start_date": "2026-04-04",
        "end_date": "2026-04-04",
        "visibility": "Meeting",
        "eventType": "Meeting",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:36:27.306885+00:00",
        "chain": "DUP"
    },
    {
        "id": "2e0e45aa-434a-4292-88d1-f31e0592ecbe",
        "title": "Short Break",
        "description": "Closing School For Eid El Fitr",
        "start_date": "2026-03-13",
        "end_date": "2026-03-13",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:35:08.049020+00:00",
        "chain": "DUP"
    },
    {
        "id": "7da60372-181e-4ad9-92b9-bef5c5508e35",
        "title": "Examination Day",
        "description": "1st midterm Examinations",
        "start_date": "2026-03-04",
        "end_date": "2026-03-04",
        "visibility": "Activity",
        "eventType": "Activity",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:34:16.018146+00:00",
        "chain": "DUP"
    },
    {
        "id": "fdd61e04-d314-4c66-a81d-4294474c749f",
        "title": "Examination Day",
        "description": "1st midterm Examinations",
        "start_date": "2026-03-04",
        "end_date": "2026-03-04",
        "visibility": "Activity",
        "eventType": "Activity",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:34:13.791419+00:00",
        "chain": "DUP"
    },
    {
        "id": "4cb40be4-837a-43be-84c0-fa83a136022a",
        "title": "1st midterm Exams Preparations",
        "description": "submission of exams to the Academic Offiice",
        "start_date": "2026-02-18",
        "end_date": "2026-02-18",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:33:15.209859+00:00",
        "chain": "DUP"
    },
    {
        "id": "0ee85dc2-b63c-405d-823a-54918e4eddd7",
        "title": "1st midterm Exams Preparations",
        "description": "Typing, printing and copying of examinations",
        "start_date": "2026-02-13",
        "end_date": "2026-02-13",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:32:39.760267+00:00",
        "chain": "DUP"
    },
    {
        "id": "661c5f48-be3f-4c4a-ad58-f3426fe944dd",
        "title": "1st midterm Exams Preparations",
        "description": "Submission of Examinations to Examination Panel",
        "start_date": "2026-02-09",
        "end_date": "2026-02-09",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:31:23.012627+00:00",
        "chain": "DUP"
    },
    {
        "id": "301bf21b-715c-4cbf-8238-8b2c655f8766",
        "title": "OPENING SCHOOL",
        "description": "Academic Year 2026",
        "start_date": "2026-01-13",
        "end_date": "2026-01-13",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-04-07T10:29:55.872313+00:00",
        "chain": "DUP"
    },
    {
        "id": "86a8b404-945d-451b-ba70-1108ec781e84",
        "title": "Back to School",
        "description": "End of eid-fitr holiday",
        "start_date": "2026-03-30",
        "end_date": "2026-03-30",
        "visibility": "Other",
        "eventType": "Other",
        "created_by": None,
        "created_by_role": "principal",
        "created_at": "2026-03-27T20:28:12.231617+00:00",
        "chain": "DUP"
    }
]

# List of fake student names to delete
FAKE_STUDENT_NAMES = [
    "Khalid Omar", "Fatma Hassan", "Ibrahim Salim", "Zainab Ali", 
    "Ahmed Juma", "Maryam Rashid", "Hassan Mohamed", "Aisha Abdi", 
    "Yusuf Bakari", "Salma Hamisi", "Omar Said"
]


async def import_data():
    """Import real Grade 7 students and almanac events to production database"""
    print("=" * 60)
    print("PRODUCTION DATABASE IMPORT SCRIPT")
    print("=" * 60)
    print(f"Target Database: {DB_NAME}")
    print(f"Students to import: {len(REAL_GRADE7_STUDENTS)}")
    print(f"Almanac events to import: {len(REAL_ALMANAC_EVENTS)}")
    print("=" * 60)
    
    # Connect to production database
    client = AsyncIOMotorClient(PRODUCTION_MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Test connection
        await client.admin.command('ping')
        print("✅ Connected to production database successfully!")
        
        # ========== STEP 1: Delete fake Grade 7 students ==========
        print("\n--- Step 1: Removing fake Grade 7 students ---")
        
        # Delete by matching fake names in GRADE 7 class
        fake_names_query = {
            "class_name": "GRADE 7",
            "chain": "DUP",
            "$or": [{"name": name} for name in FAKE_STUDENT_NAMES]
        }
        
        # Count before deletion
        fake_count = await db.students.count_documents(fake_names_query)
        print(f"Found {fake_count} fake students to delete")
        
        if fake_count > 0:
            delete_result = await db.students.delete_many(fake_names_query)
            print(f"✅ Deleted {delete_result.deleted_count} fake students")
        
        # ========== STEP 2: Insert real Grade 7 students ==========
        print("\n--- Step 2: Inserting real Grade 7 students ---")
        
        students_inserted = 0
        students_updated = 0
        
        for student in REAL_GRADE7_STUDENTS:
            # Check if student already exists by admission_no or id
            existing = await db.students.find_one({
                "$or": [
                    {"admission_no": student["admission_no"]},
                    {"id": student["id"]}
                ]
            })
            
            if existing:
                # Update existing student
                await db.students.update_one(
                    {"_id": existing["_id"]},
                    {"$set": student}
                )
                students_updated += 1
                print(f"  Updated: {student['first_name']} {student['last_name']}")
            else:
                # Insert new student
                await db.students.insert_one(student)
                students_inserted += 1
                print(f"  Inserted: {student['first_name']} {student['last_name']}")
        
        print(f"✅ Students - Inserted: {students_inserted}, Updated: {students_updated}")
        
        # ========== STEP 3: Insert almanac events ==========
        print("\n--- Step 3: Inserting almanac events ---")
        
        events_inserted = 0
        events_updated = 0
        
        for event in REAL_ALMANAC_EVENTS:
            # Check if event already exists by id
            existing = await db.almanac_events.find_one({"id": event["id"]})
            
            if existing:
                # Update existing event
                await db.almanac_events.update_one(
                    {"_id": existing["_id"]},
                    {"$set": event}
                )
                events_updated += 1
            else:
                # Insert new event
                await db.almanac_events.insert_one(event)
                events_inserted += 1
        
        print(f"✅ Almanac events - Inserted: {events_inserted}, Updated: {events_updated}")
        
        # ========== VERIFICATION ==========
        print("\n--- Verification ---")
        
        # Count Grade 7 students
        grade7_count = await db.students.count_documents({
            "class_name": "GRADE 7",
            "chain": "DUP"
        })
        print(f"Total DUP Grade 7 students in database: {grade7_count}")
        
        # List Grade 7 students
        grade7_students = await db.students.find(
            {"class_name": "GRADE 7", "chain": "DUP"},
            {"first_name": 1, "last_name": 1, "admission_no": 1, "_id": 0}
        ).to_list(length=100)
        
        print("\nCurrent Grade 7 students:")
        for s in grade7_students:
            print(f"  - {s.get('first_name', '')} {s.get('last_name', '')} ({s.get('admission_no', '')})")
        
        # Count almanac events
        almanac_count = await db.almanac_events.count_documents({"chain": "DUP"})
        print(f"\nTotal DUP almanac events in database: {almanac_count}")
        
        print("\n" + "=" * 60)
        print("✅ IMPORT COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(import_data())
