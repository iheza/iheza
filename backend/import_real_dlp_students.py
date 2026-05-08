"""
Import Real DLP Students Script
================================
This script:
1. Deletes all existing fake DLP students from the database
2. Imports the real DLP student data provided by the school
3. Sets up proper classes and subjects for DLP chain

Usage:
    python import_real_dlp_students.py [--live] [--preview]
    
    --live    : Run against the live production database
    --preview : Run against the preview/test database
    (default) : Run against local development database
"""

import sys
import os
import json
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient

# ============ CONFIGURATION ============

# Database connections
DATABASES = {
    'local': {
        'uri': 'mongodb://localhost:27017',
        'db': 'test_database'
    },
    'preview': {
        'uri': 'mongodb://localhost:27017',
        'db': 'test_database'
    },
    'live': {
        'uri': 'mongodb://localhost:27017',
        'db': 'iheza_db'
    }
}

# ============ REAL DLP STUDENT DATA ============

# Grade 1A Students
GRADE_1A = [
    {"admission_no": "DLP/STU0414/2026", "first_name": "ISSA", "last_name": "MOHAMMED KHALFAN", "gender": "MALE", "parent_name": "MOHAMMED KHALFAN MOHAMMED", "parent_phone": "0777468337"},
    {"admission_no": "DLP/STU0418/2026", "first_name": "MANNA", "last_name": "FAROUK MAULID", "gender": "FEMALE", "parent_name": "FAROUK MAULID ABDULLAH", "parent_phone": "0777999292"},
    {"admission_no": "DLP/STU0419/2026", "first_name": "MAZROUK", "last_name": "HASSAN MAZROUK", "gender": "MALE", "parent_name": "HASSAN MAZROUK HASSAN", "parent_phone": "0767102550"},
    {"admission_no": "DLP/STU0420/2026", "first_name": "MOHAMMED", "last_name": "ALLY HAJI", "gender": "MALE", "parent_name": "HAJI ALLY", "parent_phone": ""},
    {"admission_no": "DLP/STU0421/2026", "first_name": "MUAMMAR", "last_name": "ABDULATIF IBRAHIM", "gender": "MALE", "parent_name": "ABDUL-LATIF IBRAHIM YUSSUF", "parent_phone": "0779808671"},
    {"admission_no": "DLP/STU0423/2026", "first_name": "MUKHLIS", "last_name": "RAMADHAN IBADI", "gender": "MALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0426/2026", "first_name": "NURAYYA", "last_name": "KHAMIS JUMA", "gender": "FEMALE", "parent_name": "KHAMIS JUMA MWALIM", "parent_phone": "0773462800"},
    {"admission_no": "DLP/STU0428/2026", "first_name": "RAHIL", "last_name": "ADAM", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0429/2026", "first_name": "RANIA", "last_name": "HILAL AMOUR", "gender": "FEMALE", "parent_name": "HILAL SAID AMOUR", "parent_phone": "0657132387"},
    {"admission_no": "DLP/STU0430/2026", "first_name": "SABRA", "last_name": "SALUM FAKI", "gender": "FEMALE", "parent_name": "SALUM FAKI ALI", "parent_phone": "0777858448"},
    {"admission_no": "DLP/STU0431/2026", "first_name": "SAHIR", "last_name": "HASSAN BUDDAH", "gender": "MALE", "parent_name": "HASSAN BUDDAH JUMA", "parent_phone": "0776376028"},
    {"admission_no": "DLP/STU0432/2026", "first_name": "SAID", "last_name": "KASSIM SAID", "gender": "MALE", "parent_name": "KASSIM SAID YUSSUF", "parent_phone": "0773512654"},
    {"admission_no": "DLP/STU0433/2026", "first_name": "SARA", "last_name": "SAID ALI", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0435/2026", "first_name": "ZAYD", "last_name": "NASSOR KHAMIS", "gender": "MALE", "parent_name": "NASSOR KHAMIS NASSOR", "parent_phone": "078002333"},
    {"admission_no": "DLP/STU0416/2026", "first_name": "JUNAYNA", "last_name": "SHAIB", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0402/2026", "first_name": "AHSEN", "last_name": "ABDALLAH KHAMIS", "gender": "MALE", "parent_name": "ABDALLAH KHAMIS JUMA", "parent_phone": "0779333111"},
    {"admission_no": "DLP/STU0400/2026", "first_name": "ABDULWAHID", "last_name": "RIDHWAAN ISSA", "gender": "MALE", "parent_name": "RIDHWAN ISSA AHMADA", "parent_phone": "0772686908"},
    {"admission_no": "DLP/STU0409/2026", "first_name": "FARSHAD", "last_name": "ALI OMAR", "gender": "MALE", "parent_name": "ALI OMAR RASHID", "parent_phone": ""},
    {"admission_no": "DLP/STU0412/2026", "first_name": "IBRAHIM", "last_name": "SAID AME", "gender": "MALE", "parent_name": "SAID AME KHAMIS", "parent_phone": "0773542046"},
    {"admission_no": "DLP/STU0406/2026", "first_name": "DHULKIFLI", "last_name": "ABDILLAHI JUMA", "gender": "MALE", "parent_name": "ABDILLAH JUMA UKUSI", "parent_phone": "0772102040"},
]

# Grade 1B Students
GRADE_1B = [
    {"admission_no": "DLP/STU0415/2026", "first_name": "JAMILA", "last_name": "KHAMIS HAMAD", "gender": "FEMALE", "parent_name": "KHAMIS HAMAD OMAR", "parent_phone": "0713177771"},
    {"admission_no": "DLP/STU0417/2026", "first_name": "KABIR", "last_name": "IDDI KASSIM", "gender": "MALE", "parent_name": "IDDI KASSIM KICHULO", "parent_phone": "0714467435"},
    {"admission_no": "DLP/STU0422/2026", "first_name": "MUAYYID", "last_name": "FADHIL MOHAMMED", "gender": "MALE", "parent_name": "FADHIL MOHAMMED FAKI", "parent_phone": "0772802020"},
    {"admission_no": "DLP/STU0424/2026", "first_name": "NABIL", "last_name": "ALI KHALIFA", "gender": "MALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0425/2026", "first_name": "NARMEEN", "last_name": "OTHMAN MKUBWA", "gender": "FEMALE", "parent_name": "OTHMAN MKUBWA ALI", "parent_phone": "0772454797"},
    {"admission_no": "DLP/STU0427/2026", "first_name": "OMAR", "last_name": "NDANYUNGU OMAR", "gender": "MALE", "parent_name": "NDANYUNGU OMAR NDANYUNGU", "parent_phone": "0718537900"},
    {"admission_no": "DLP/STU0434/2026", "first_name": "TAREEQ", "last_name": "MOHAMMED MSHANA", "gender": "MALE", "parent_name": "MOHAMMED SULEIMAN MSHANA", "parent_phone": "0719093414"},
    {"admission_no": "DLP/STU0399/2026", "first_name": "AAFREEN", "last_name": "MUHARAMI SULEIMAN", "gender": "FEMALE", "parent_name": "MUHARAMI SULEIMAN MOHAMMED", "parent_phone": "0787317213"},
    {"admission_no": "DLP/STU0402/2026", "first_name": "AHMAD", "last_name": "MOHAMMED JUMA", "gender": "MALE", "parent_name": "MOHAMED JUMA BUDDAH", "parent_phone": "0715320678"},
    {"admission_no": "DLP/STU0403/2026", "first_name": "AYSSOR", "last_name": "AHMED KHAMIS", "gender": "FEMALE", "parent_name": "AHMED KHAMIS HAMAD", "parent_phone": "0774621252"},
    {"admission_no": "DLP/STU0404/2026", "first_name": "DAUD", "last_name": "KASSIM DAUD", "gender": "MALE", "parent_name": "KASSIM DAUD SULEIMAN", "parent_phone": "0714606090"},
    {"admission_no": "DLP/STU0405/2026", "first_name": "DHULHULAIFAT", "last_name": "ABDILLAH JUMA", "gender": "FEMALE", "parent_name": "ABDILLAH JUMA UKUSI", "parent_phone": "0772102040"},
    {"admission_no": "DLP/STU0407/2026", "first_name": "FARHEEN", "last_name": "HASSANI OMARI", "gender": "FEMALE", "parent_name": "HASSANI OMARI MAYA", "parent_phone": "0773022429"},
    {"admission_no": "DLP/STU0408/2026", "first_name": "FARHIYAH", "last_name": "KOMBO HAJI", "gender": "FEMALE", "parent_name": "KOMBO HAJI HAMADI", "parent_phone": "+97477960636"},
    {"admission_no": "DLP/STU0410/2026", "first_name": "GABBY", "last_name": "ABDALLAH MASOUD", "gender": "MALE", "parent_name": "ABDALLAH MASOUD MOHAMMED", "parent_phone": "0777061248"},
    {"admission_no": "DLP/STU0411/2026", "first_name": "HIKMAN", "last_name": "HAJI SULEIMAN", "gender": "MALE", "parent_name": "HAJI SULEIMAN JUMA", "parent_phone": "0628579799"},
    {"admission_no": "DLP/STU0413/2026", "first_name": "ILHAM", "last_name": "NTILA MASOGO", "gender": "FEMALE", "parent_name": "NTILA ABDALLAH MASOGO", "parent_phone": "0628384143"},
]

# Grade 2A Students
GRADE_2A = [
    {"admission_no": "DLP/STU0370/2025", "first_name": "FATMA", "last_name": "ALI OMAR", "gender": "FEMALE", "parent_name": "ALI OMAR RASHID", "parent_phone": "0714 740 479"},
    {"admission_no": "DLP/STU0398/2025", "first_name": "FARIS", "last_name": "", "gender": "MALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0372/2025", "first_name": "INTISAR", "last_name": "DAUD SADIQ", "gender": "FEMALE", "parent_name": "SAUD SADIQ MAGESA", "parent_phone": "0719 906 407"},
    {"admission_no": "DLP/STU0391/2025", "first_name": "JAMAAL", "last_name": "PANDU MUHUSIN", "gender": "MALE", "parent_name": "PANDU MUHUSIN ALI", "parent_phone": "0777 245 457"},
    {"admission_no": "DLP/STU0382/2025", "first_name": "MARYAM", "last_name": "OSMAN ABDI", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0437/2025", "first_name": "MOHAMED", "last_name": "SEIF KHELEF", "gender": "MALE", "parent_name": "SEIF KHELEF MOHAMMED", "parent_phone": "0718589117"},
    {"admission_no": "DLP/STU0384/2025", "first_name": "NAHYA", "last_name": "AMRAN MASOUD", "gender": "FEMALE", "parent_name": "AMRAN MASOUD AMRAN", "parent_phone": "0777 415 900"},
    {"admission_no": "DLP/STU0371/2025", "first_name": "NIMAAH", "last_name": "OMARI MHANGO", "gender": "FEMALE", "parent_name": "OMARI MHANGO MHANGO", "parent_phone": "0658 873 919"},
    {"admission_no": "DLP/STU0385/2025", "first_name": "RAYA", "last_name": "SAID ALI", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0386/2025", "first_name": "RAYYAN", "last_name": "ABDULLA OTHMAN", "gender": "FEMALE", "parent_name": "ABDULLA OTHMAN ALI", "parent_phone": "0773 157 383"},
    {"admission_no": "DLP/STU0387/2025", "first_name": "REHEMA", "last_name": "SULEIMAN HASSAN", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0434/2025", "first_name": "RIYADH", "last_name": "HILAL AMOUR", "gender": "MALE", "parent_name": "HILAL SAID AMOUR", "parent_phone": "0657132387"},
    {"admission_no": "DLP/STU0436/2025", "first_name": "SAHIM", "last_name": "SULEIMAN JUMA", "gender": "MALE", "parent_name": "SULEIMAN JUMA ISHAKA", "parent_phone": "0777025190"},
    {"admission_no": "DLP/STU0388/2025", "first_name": "SALMA", "last_name": "SAID FARAJI", "gender": "FEMALE", "parent_name": "SAID FARAJI ABDALLA", "parent_phone": "0776 705 848"},
    {"admission_no": "DLP/STU0366/2025", "first_name": "SHAHZAD", "last_name": "SHAABAN MTUMWA", "gender": "MALE", "parent_name": "SHAABAN MTUMWA UTHMAN", "parent_phone": "0655 615 016"},
    {"admission_no": "DLP/STU0353/2025", "first_name": "SUHAIL", "last_name": "SALUM FAKIH", "gender": "MALE", "parent_name": "SALUM FAKIH ALI", "parent_phone": "0777 858 448"},
    {"admission_no": "DLP/STU0389/2025", "first_name": "SUHAILA", "last_name": "ALI ABDI", "gender": "FEMALE", "parent_name": "ALI ABDI ALI", "parent_phone": "0773 230 647"},
    {"admission_no": "DLP/STU0360/2025", "first_name": "THAMRAT", "last_name": "HAMID TAHIR", "gender": "FEMALE", "parent_name": "HAMID TAHIR KASSIM", "parent_phone": "0772 989 977"},
    {"admission_no": "DLP/STU0358/2025", "first_name": "THUMAIRAT", "last_name": "HAMID TAHIR", "gender": "FEMALE", "parent_name": "HAMID TAHIR KASSIM", "parent_phone": "0772 989 977"},
    {"admission_no": "DLP/STU0355/2025", "first_name": "ZUWENA", "last_name": "MUHAMMED SALUM", "gender": "FEMALE", "parent_name": "MUHAMMED SALUM", "parent_phone": "0777 765 922"},
    {"admission_no": "", "first_name": "ASHA", "last_name": "JUMA ABDULRAHMAN", "gender": "FEMALE", "parent_name": "JUMA ABDULRAHMAN ZIDIKHERI", "parent_phone": ""},
    {"admission_no": "", "first_name": "WIYYAM", "last_name": "MOHAMMED SHEHA", "gender": "FEMALE", "parent_name": "MOHAMMED SHEHA MOHAMMED", "parent_phone": "0777 568 386"},
]

# Grade 2B Students
GRADE_2B = [
    {"admission_no": "DLP/STU0374/2025", "first_name": "AADIL", "last_name": "ABDULSALAAM SALUM", "gender": "MALE", "parent_name": "ABDULSALAAM SALUM HASSAN", "parent_phone": "0773 239 595"},
    {"admission_no": "DLP/STU0390/2025", "first_name": "ABDULBASIT", "last_name": "MOHAMMED ABDALLAH", "gender": "MALE", "parent_name": "MOHAMMED ABDALLAH", "parent_phone": "0777 417 425"},
    {"admission_no": "DLP/STU0376/2025", "first_name": "AHYAN", "last_name": "UTHMAN YUNUS", "gender": "MALE", "parent_name": "UTHMAN YUNUS HASSAN", "parent_phone": "0773 017 878"},
    {"admission_no": "DLP/STU0364/2025", "first_name": "ARISH", "last_name": "MUSTAPHA CIPRIAN", "gender": "MALE", "parent_name": "MUSTAPHA CIPRIAN MALYA", "parent_phone": "0655 527 225"},
    {"admission_no": "DLP/STU0352/2025", "first_name": "LUKMAAN", "last_name": "ABDULRAHMAN HAJI", "gender": "MALE", "parent_name": "ABDULRAHMAN HAJI KONDO", "parent_phone": "0777 016 270"},
    {"admission_no": "DLP/STU0361/2025", "first_name": "MAD-HAT", "last_name": "DAUDALLY", "gender": "FEMALE", "parent_name": "DAUD ALLY MOHAMMED", "parent_phone": "0774 250 914"},
    {"admission_no": "DLP/STU0438/2025", "first_name": "MASOUD", "last_name": "RAMADHAN SHAALI", "gender": "MALE", "parent_name": "RAMADHAN SHAALI CHOUM", "parent_phone": "0772897503"},
    {"admission_no": "DLP/STU0354/2025", "first_name": "MUSLIM", "last_name": "ABDALLA SALEHE", "gender": "MALE", "parent_name": "ABDALLA SALEHEATHUMANI", "parent_phone": "0777 910 910"},
    {"admission_no": "DLP/STU0357/2025", "first_name": "MUZNA", "last_name": "MASOUD YUSSUF", "gender": "FEMALE", "parent_name": "MASOUD YUSSUF ALAWI", "parent_phone": "0712 346 777"},
    {"admission_no": "DLP/STU0375/2025", "first_name": "NAEEM", "last_name": "KHAMIS HAMAD", "gender": "MALE", "parent_name": "KHAMIS HAMAD OMAR", "parent_phone": "0777 421 505"},
    {"admission_no": "DLP/STU0356/2025", "first_name": "NARMIN", "last_name": "SAID ALI", "gender": "FEMALE", "parent_name": "SAID ALI KHAMIS", "parent_phone": "0773 297 999"},
    {"admission_no": "DLP/STU0377/2025", "first_name": "RAGHIB", "last_name": "MOHAMED SEIF", "gender": "MALE", "parent_name": "MOHAMMED SEIF MSABAH", "parent_phone": "0778 488296"},
    {"admission_no": "DLP/STU0369/2025", "first_name": "RAHMINA", "last_name": "SIMAI KIBORO", "gender": "FEMALE", "parent_name": "SIMAI KIBORO YUSSUF", "parent_phone": "0778 848 023"},
    {"admission_no": "DLP/STU0381/2025", "first_name": "RUHEEN", "last_name": "MOHAMMED IBRAHIM", "gender": "FEMALE", "parent_name": "MOHAMMED IBRAHIM ABDUL-RAHMAN", "parent_phone": ""},
    {"admission_no": "DLP/STU0380/2025", "first_name": "RUQAIYYA", "last_name": "SAID AME", "gender": "FEMALE", "parent_name": "SAID AME KHAMIS", "parent_phone": ""},
    {"admission_no": "DLP/STU0435/2025", "first_name": "SALAMA", "last_name": "MOHAMMAD IBRAHIM", "gender": "FEMALE", "parent_name": "MUHAMMAD IBRAHIM USSI", "parent_phone": "0778181871"},
    {"admission_no": "DLP/STU0378/2025", "first_name": "SAMEED", "last_name": "MOHAMED SULEIMAN", "gender": "MALE", "parent_name": "MOHAMED SULEIMAN MSHANA", "parent_phone": "0719 063 414"},
    {"admission_no": "DLP/STU0351/2025", "first_name": "TAQLIF", "last_name": "HAMZA YAHYA", "gender": "MALE", "parent_name": "HAMZA YAHYA SUKWA", "parent_phone": "0772 272 722"},
    {"admission_no": "DLP/STU0359/2025", "first_name": "THAURAT", "last_name": "HAMID TAHIR", "gender": "FEMALE", "parent_name": "HAMID TAHIR KASSIM", "parent_phone": "0772 989 977"},
]

# Grade 3A Students
GRADE_3A = [
    {"admission_no": "DLP/STU0317/2024", "first_name": "AHMAD", "last_name": "ABDALLA AHMED", "gender": "MALE", "parent_name": "ABDALLA AHMED", "parent_phone": "0654 987472"},
    {"admission_no": "DLP/STU0439/2024", "first_name": "ALEENA", "last_name": "ABDALLAH KHAMIS", "gender": "FEMALE", "parent_name": "ABDALLAH KHAMIS JUMA", "parent_phone": "0779333111"},
    {"admission_no": "DLP/STU0316/2024", "first_name": "ARSHAN", "last_name": "BAKARI KASSIM", "gender": "MALE", "parent_name": "BAKARI KASSIM BAKARI", "parent_phone": "0772 701525"},
    {"admission_no": "DLP/STU0288/2024", "first_name": "ASHFAT", "last_name": "OMAR SAID", "gender": "FEMALE", "parent_name": "OMAR SAID OMAR", "parent_phone": "0773 066625"},
    {"admission_no": "DLP/STU0310/2024", "first_name": "BILQISS", "last_name": "NASSIR ABDULRAZAK", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0286/2024", "first_name": "BUTHAYNA", "last_name": "FADHIL SALEH", "gender": "FEMALE", "parent_name": "FADHIL SALEH OTHMAN", "parent_phone": "0673 521155"},
    {"admission_no": "DLP/STU0308/2024", "first_name": "ISRIYYA", "last_name": "HAJI SALUM", "gender": "FEMALE", "parent_name": "HAJI SALUM HUSSEIN", "parent_phone": "0777 100046"},
    {"admission_no": "DLP/STU0283/2024", "first_name": "KAMAAL", "last_name": "HAJI KASSIM", "gender": "MALE", "parent_name": "HAJI KASSIM HAJI", "parent_phone": "0772 171304"},
    {"admission_no": "DLP/STU0309/2024", "first_name": "KAUTHAR", "last_name": "KHALFAN MMAKA", "gender": "FEMALE", "parent_name": "KHALFAN MMAKA HAMAD", "parent_phone": "0772 430093"},
    {"admission_no": "DLP/STU0315/2024", "first_name": "KHAMIS", "last_name": "NASSOR KHAMIS", "gender": "MALE", "parent_name": "NASSOR KHAMIS", "parent_phone": ""},
    {"admission_no": "DLP/STU0443/2024", "first_name": "MALIHA", "last_name": "SALEH HASSAN", "gender": "FEMALE", "parent_name": "SALEH HASSAN KHAMIS", "parent_phone": "0773919243"},
    {"admission_no": "DLP/STU0311/2024", "first_name": "MURAT", "last_name": "ABDULRAHMAN KHALFAN", "gender": "MALE", "parent_name": "ABDULRAHMAN KHALFAN AL-KHAIFY", "parent_phone": "0776 176 245"},
    {"admission_no": "DLP/STU0294/2024", "first_name": "NASREEN", "last_name": "OTHMAN MKUBWA", "gender": "FEMALE", "parent_name": "OTHMAN MKUBWA ALI", "parent_phone": "0772 454 797"},
    {"admission_no": "DLP/STU0281/2024", "first_name": "NAWAL-NOUR", "last_name": "SAID OMAR", "gender": "FEMALE", "parent_name": "SAID OMAR SAID", "parent_phone": "0777 488670"},
    {"admission_no": "DLP/STU0297/2024", "first_name": "SADIDAH", "last_name": "MOHAMMED MAHMOUD", "gender": "FEMALE", "parent_name": "MOHAMMED MAHMOUD ABDALLA", "parent_phone": ""},
    {"admission_no": "DLP/STU0285/2024", "first_name": "SANAYA", "last_name": "IBRAHIM NASSOR", "gender": "FEMALE", "parent_name": "IBRAHIM NASSOR MOHAMMED", "parent_phone": "0656 679225"},
    {"admission_no": "DLP/STU0295/2024", "first_name": "SHADYA", "last_name": "SALEH DOTO", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0313/2024", "first_name": "YUNUS", "last_name": "UTHMAN YUNUS", "gender": "MALE", "parent_name": "UTHMAM YUNUS HASSAN", "parent_phone": "0773 017878"},
]

# Grade 3B Students
GRADE_3B = [
    {"admission_no": "DLP/STU0306/2024", "first_name": "ABDUL-AZIZ", "last_name": "KHAMIS HUSSEIN", "gender": "MALE", "parent_name": "KHAMIS HUSSEIN MUSSA", "parent_phone": "0715 856363"},
    {"admission_no": "DLP/STU0296/2024", "first_name": "ABDULKARIM", "last_name": "OMAR AMOUR", "gender": "MALE", "parent_name": "OMAR AMOUR SALIM", "parent_phone": "0777 033 441"},
    {"admission_no": "DLP/STU0298/2024", "first_name": "AMINA", "last_name": "AHMADA YAKOUT", "gender": "FEMALE", "parent_name": "AHMADA YAKOUT", "parent_phone": "0774 879101"},
    {"admission_no": "DLP/STU0440/2024", "first_name": "ASHMAL", "last_name": "ABDALLAH KHAMIS", "gender": "FEMALE", "parent_name": "ABDALLAH KHAMIS JUMA", "parent_phone": "0779333111"},
    {"admission_no": "DLP/STU0289/2024", "first_name": "ASHRAF", "last_name": "OMAR SAID", "gender": "MALE", "parent_name": "OMAR SAID OMAR", "parent_phone": "0773 066625"},
    {"admission_no": "DLP/STU0300/2024", "first_name": "ASRAA", "last_name": "HAMAD HABIBU", "gender": "FEMALE", "parent_name": "OMAR SAID OMAR", "parent_phone": "0623 597560"},
    {"admission_no": "DLP/STU0301/2024", "first_name": "AYMAN", "last_name": "SALUM MUSSA", "gender": "FEMALE", "parent_name": "SALUM MUSSA HAJI", "parent_phone": ""},
    {"admission_no": "DLP/STU0318/2024", "first_name": "KHALIL", "last_name": "ABDALLAH MATTAR", "gender": "MALE", "parent_name": "ABDALLA MATTAR SALUM", "parent_phone": "0778 865555"},
    {"admission_no": "DLP/STU0305/2024", "first_name": "MAHIR", "last_name": "JUMA FOUM", "gender": "MALE", "parent_name": "JUMA KOMO FOUM", "parent_phone": "0773 162510"},
    {"admission_no": "DLP/STU0284/2024", "first_name": "MU'AMMAR", "last_name": "HAFIDH KHAMIS", "gender": "MALE", "parent_name": "HAFIDH KHAMIS MAKAME", "parent_phone": "0773 599922"},
    {"admission_no": "DLP/STU0303/2024", "first_name": "MUAYYAD", "last_name": "MOHAMMED KAMAL", "gender": "MALE", "parent_name": "MOHAMMED KAMAL BASHA", "parent_phone": "0772 210016"},
    {"admission_no": "DLP/STU0302/2024", "first_name": "OTHMAN", "last_name": "ABDALLULLA OTHMAN", "gender": "MALE", "parent_name": "ABDULLA OTHMAN ALI", "parent_phone": "0773 957383"},
    {"admission_no": "DLP/STU0299/2024", "first_name": "RAGHDAA", "last_name": "MOHAMMED SEIF", "gender": "FEMALE", "parent_name": "MOHAMMED SEIF MSABAH", "parent_phone": "0778 488296"},
    {"admission_no": "", "first_name": "RAHIL", "last_name": "RASHID HAMAD", "gender": "MALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0444/2024", "first_name": "RAUHIYA", "last_name": "ALLY ATHUMANI", "gender": "FEMALE", "parent_name": "", "parent_phone": ""},
    {"admission_no": "DLP/STU0304/2024", "first_name": "SHEMSA", "last_name": "ALI JUMA", "gender": "FEMALE", "parent_name": "ALI JUMA MOHAMMED", "parent_phone": "0777 777271"},
    {"admission_no": "DLP/STU0314/2024", "first_name": "SULEIMAN", "last_name": "AHMED SULEIMAN", "gender": "MALE", "parent_name": "AHMED SULEIMAN MOHAMED", "parent_phone": "0777 576161"},
    {"admission_no": "DLP/STU0293/2024", "first_name": "TAHMID", "last_name": "HAMZA YAHYA", "gender": "MALE", "parent_name": "HAMZA YAHYA SUKWA", "parent_phone": "0772 272722"},
]

# ============ CLASSES ============
DLP_CLASSES = [
    {"name": "Grade 1A", "code": "1A", "grade": 1, "section": "A"},
    {"name": "Grade 1B", "code": "1B", "grade": 1, "section": "B"},
    {"name": "Grade 2A", "code": "2A", "grade": 2, "section": "A"},
    {"name": "Grade 2B", "code": "2B", "grade": 2, "section": "B"},
    {"name": "Grade 3A", "code": "3A", "grade": 3, "section": "A"},
    {"name": "Grade 3B", "code": "3B", "grade": 3, "section": "B"},
]

# ============ SUBJECTS ============
DLP_SUBJECTS = [
    {"name": "Mathematics", "code": "MATH", "category": "core"},
    {"name": "English Language", "code": "ENG", "category": "core"},
    {"name": "Kiswahili", "code": "KISW", "category": "core"},
    {"name": "Science", "code": "SCI", "category": "core"},
    {"name": "Islamic Studies", "code": "ISLAM", "category": "core"},
    {"name": "Social Studies", "code": "SOC", "category": "core"},
]

# ============ MAIN SCRIPT ============

def get_db():
    """Get database connection based on command line arguments."""
    if '--live' in sys.argv:
        config = DATABASES['live']
    elif '--preview' in sys.argv:
        config = DATABASES['preview']
    else:
        config = DATABASES['local']
    
    print(f"Connecting to: {config['uri']}/{config['db']}")
    client = MongoClient(config['uri'])
    db = client[config['db']]
    return db

def delete_fake_students(db):
    """Delete all existing DLP students from the database."""
    result = db.students.delete_many({"chain": "DLP"})
    print(f"Deleted {result.deleted_count} fake DLP students")
    return result.deleted_count

def delete_fake_classes(db):
    """Delete all existing DLP classes from the database."""
    result = db.classes.delete_many({"chain": "DLP"})
    print(f"Deleted {result.deleted_count} fake DLP classes")
    return result.deleted_count

def delete_fake_subjects(db):
    """Delete all existing DLP subjects from the database."""
    result = db.subjects.delete_many({"chain": "DLP"})
    print(f"Deleted {result.deleted_count} fake DLP subjects")
    return result.deleted_count

def import_classes(db):
    """Import DLP classes."""
    count = 0
    for cls in DLP_CLASSES:
        doc = {
            "_id": str(uuid.uuid4()),
            "id": str(uuid.uuid4()),
            "name": cls["name"],
            "code": cls["code"],
            "grade": cls["grade"],
            "section": cls["section"],
            "chain": "DLP",
            "status": "active",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        db.classes.insert_one(doc)

        count += 1
        print(f"  Created class: {cls['name']}")
    print(f"Imported {count} DLP classes")
    return count

def import_subjects(db):
    """Import DLP subjects."""
    count = 0
    for subj in DLP_SUBJECTS:
        doc = {
            "_id": str(uuid.uuid4()),
            "id": str(uuid.uuid4()),
            "name": subj["name"],
            "code": subj["code"],
            "category": subj["category"],
            "chain": "DLP",
            "status": "active",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        db.subjects.insert_one(doc)
        count += 1
        print(f"  Created subject: {subj['name']}")
    print(f"Imported {count} DLP subjects")
    return count

def import_students(db):
    """Import real DLP students into their respective classes."""
    # Get class mappings
    class_map = {}
    for cls in db.classes.find({"chain": "DLP"}):
        class_map[cls["code"]] = cls["_id"]
    
    print(f"Class mappings: {class_map}")
    
    # Map grade sections to class codes and names
    grade_class_map = {
        "1A": "1A", "1B": "1B",
        "2A": "2A", "2B": "2B",
        "3A": "3A", "3B": "3B",
    }
    
    # Build class name lookup from DLP_CLASSES
    class_name_map = {}
    for cls in DLP_CLASSES:
        class_name_map[cls["code"]] = cls["name"]
    
    all_students = [
        ("1A", GRADE_1A),
        ("1B", GRADE_1B),
        ("2A", GRADE_2A),
        ("2B", GRADE_2B),
        ("3A", GRADE_3A),
        ("3B", GRADE_3B),
    ]
    
    total = 0
    for grade_code, students in all_students:
        class_id = class_map.get(grade_code)
        if not class_id:
            print(f"  WARNING: No class found for {grade_code}, skipping {len(students)} students")
            continue
        
        class_name = class_name_map.get(grade_code, f"Grade {grade_code}")
        
        count = 0
        for student in students:
            # Generate admission number if missing
            admission_no = student["admission_no"]
            if not admission_no:
                # Generate one
                year = "2026" if grade_code.startswith("1") else ("2025" if grade_code.startswith("2") else "2024")
                seq = 500 + count
                admission_no = f"DLP/STU{seq:04d}/{year}"
            
            full_name = f"{student['first_name']} {student['last_name']}".strip()
            
            doc = {
                "_id": str(uuid.uuid4()),
                "id": str(uuid.uuid4()),
                "admission_no": admission_no,
                "first_name": student["first_name"],
                "last_name": student["last_name"],
                "full_name": full_name,
                "gender": student["gender"],
                "class_id": class_id,
                "class_code": grade_code,
                "class_name": class_name,
                "chain": "DLP",
                "status": "active",
                "parent_name": student["parent_name"],
                "parent_phone": student["parent_phone"],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }

            db.students.insert_one(doc)
            count += 1
            total += 1
        
        print(f"  Imported {count} students into Grade {grade_code}")
    
    print(f"Total students imported: {total}")
    return total

def main():
    print("=" * 60)
    print("DLP REAL DATA IMPORT SCRIPT")
    print("=" * 60)
    
    # Confirm
    target = "LIVE" if '--live' in sys.argv else ("PREVIEW" if '--preview' in sys.argv else "LOCAL")
    print(f"\nTarget database: {target}")
    print("This will DELETE all existing DLP data and replace with real data!")
    response = input("Are you sure? (yes/no): ")
    if response.lower() != 'yes':
        print("Aborted.")
        return
    
    db = get_db()
    
    # Step 1: Delete fake data
    print("\n--- Step 1: Deleting fake DLP data ---")
    delete_fake_students(db)
    delete_fake_classes(db)
    delete_fake_subjects(db)
    
    # Step 2: Import real classes
    print("\n--- Step 2: Importing DLP classes ---")
    import_classes(db)
    
    # Step 3: Import real subjects
    print("\n--- Step 3: Importing DLP subjects ---")
    import_subjects(db)
    
    # Step 4: Import real students
    print("\n--- Step 4: Importing real DLP students ---")
    import_students(db)
    
    print("\n" + "=" * 60)
    print("IMPORT COMPLETE!")
    print("=" * 60)

if __name__ == "__main__":
    main()
