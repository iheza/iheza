#!/usr/bin/env python3
"""
Import students and fee data into IHEZA School Management System
This script imports 103 students from CSV data with their payment information
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import bcrypt
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'iheza_db')]

# Default password for all students
DEFAULT_PASSWORD = "student123"

# ALL STUDENTS FROM CSV FILES (103 total)
ALL_CSV_STUDENTS = [
    # GRADE 4A (20 students)
    {"firstName": "LUQMAN", "lastName": "ABDUL-RAHMAN L", "admissionNumber": "DUP/STU0078/2016", "grade": "GRADE 4A", "parentName": "ABDULRAHMAN", "parentContact": "0"},
    {"firstName": "ARQAM", "lastName": "ALI L", "admissionNumber": "DUP/STU0079/2017", "grade": "GRADE 4A", "parentName": "ALI", "parentContact": "0773 230 697"},
    {"firstName": "IS-HAQ", "lastName": "MSELLEM L", "admissionNumber": "DUP/STU0080/2016", "grade": "GRADE 4A", "parentName": "MSELLEM", "parentContact": "0"},
    {"firstName": "ARAFA", "lastName": "SHAFII HAJI", "admissionNumber": "DUP/STU0081/2015", "grade": "GRADE 4A", "parentName": "SHAFII", "parentContact": "0673 218 783"},
    {"firstName": "KASSIM", "lastName": "IDDI L", "admissionNumber": "DUP/STU0082/2017", "grade": "GRADE 4A", "parentName": "IDDI", "parentContact": "0"},
    {"firstName": "MUKHTAR", "lastName": "KHAMIS L", "admissionNumber": "DUP/STU0083/2016", "grade": "GRADE 4A", "parentName": "KHAMIS", "parentContact": "0"},
    {"firstName": "MAYSAM", "lastName": "MOH'D L", "admissionNumber": "DUP/STU0084/2016", "grade": "GRADE 4A", "parentName": "MOH'D", "parentContact": "0"},
    {"firstName": "RUHAYLA", "lastName": "RAMADHAN L", "admissionNumber": "DUP/STU0085/2017", "grade": "GRADE 4A", "parentName": "RAMADHAN", "parentContact": "0"},
    {"firstName": "RAUDHAT", "lastName": "JABIR L", "admissionNumber": "DUP/STU0086/2017", "grade": "GRADE 4A", "parentName": "JABIR", "parentContact": "0"},
    {"firstName": "ASMAHAN", "lastName": "HAMID BILAL", "admissionNumber": "DUP/STU0087/2017", "grade": "GRADE 4A", "parentName": "HAMID", "parentContact": "0777 426 556"},
    {"firstName": "ATKA", "lastName": "SULEIMAN HAJI", "admissionNumber": "DUP/STU0089/2016", "grade": "GRADE 4A", "parentName": "SULEIMAN", "parentContact": "0673 218 783"},
    {"firstName": "KHADIJA", "lastName": "SULEIMAN L", "admissionNumber": "DUP/STU0090/2016", "grade": "GRADE 4A", "parentName": "SULEIMAN", "parentContact": "0"},
    {"firstName": "FAHEEM", "lastName": "FAUZ JUMAANE", "admissionNumber": "DUP/STU0091/2015", "grade": "GRADE 4A", "parentName": "FAUZ", "parentContact": "0773 488 689"},
    {"firstName": "MOH'D", "lastName": "SAID L", "admissionNumber": "DUP/STU0092/2017", "grade": "GRADE 4A", "parentName": "JUMAANSAID", "parentContact": "0"},
    {"firstName": "MUKTHADIR", "lastName": "RAMADHAN L", "admissionNumber": "DUP/STU0093/2017", "grade": "GRADE 4A", "parentName": "RAMADHAN", "parentContact": "0"},
    {"firstName": "HASSAN", "lastName": "OSMAN ABDI", "admissionNumber": "DUP/STU0094/2017", "grade": "GRADE 4A", "parentName": "OSMAN", "parentContact": "0680 218 783"},
    {"firstName": "NASSOR", "lastName": "AMRAN L", "admissionNumber": "DUP/STU0140/2017", "grade": "GRADE 4A", "parentName": "AMRAN", "parentContact": "0"},
    {"firstName": "SUHAYB", "lastName": "SALEH L", "admissionNumber": "DUP/STU0141/2017", "grade": "GRADE 4A", "parentName": "SALEH", "parentContact": "0"},
    {"firstName": "ASHA", "lastName": "PANDU L", "admissionNumber": "DUP/STU0142/2017", "grade": "GRADE 4A", "parentName": "PANDU", "parentContact": "0"},
    {"firstName": "ARIF", "lastName": "HAFIDH L", "admissionNumber": "DUP/STU0143/2017", "grade": "GRADE 4A", "parentName": "HAFIDH", "parentContact": "0"},
    
    # GRADE 4B (20 students)
    {"firstName": "HAWA", "lastName": "SAID ALI", "admissionNumber": "DUP/STU0095/2023", "grade": "GRADE 4B", "parentName": "SAID", "parentContact": "0719 573 201"},
    {"firstName": "AJMAL", "lastName": "ABDUL-RAHMAN HAJI", "admissionNumber": "DUP/STU0096/2023", "grade": "GRADE 4B", "parentName": "HAJI", "parentContact": "0777 016 270"},
    {"firstName": "HUSSEIN", "lastName": "OTHMAN ABDI", "admissionNumber": "DUP/STU0097/2023", "grade": "GRADE 4B", "parentName": "ABDI", "parentContact": "745205092"},
    {"firstName": "IBTISAM", "lastName": "UTHMAN YUNUS", "admissionNumber": "DUP/STU0098/2023", "grade": "GRADE 4B", "parentName": "UTHMAN", "parentContact": "0773 017 878"},
    {"firstName": "FAHMI", "lastName": "KARAMA JUMAANE", "admissionNumber": "DUP/STU0099/2023", "grade": "GRADE 4B", "parentName": "KARAMA", "parentContact": "0"},
    {"firstName": "ALI", "lastName": "MOHAMMED ALI", "admissionNumber": "DUP/STU0100/2023", "grade": "GRADE 4B", "parentName": "MOHAMMED", "parentContact": "0"},
    {"firstName": "LUBAYNA", "lastName": "AMER KAMAL", "admissionNumber": "DUP/STU0101/2023", "grade": "GRADE 4B", "parentName": "AMER", "parentContact": "9715 664 116 44"},
    {"firstName": "MARYAM", "lastName": "JUMA MOHAMMED", "admissionNumber": "DUP/STU0102/2023", "grade": "GRADE 4B", "parentName": "JUMA", "parentContact": "0679 218 783"},
    {"firstName": "MOHAMMED", "lastName": "ABDUL-RAHMAN MOHAMMED", "admissionNumber": "DUP/STU0103/2023", "grade": "GRADE 4B", "parentName": "ABDUL-RAHMAN", "parentContact": "0774 818 291"},
    {"firstName": "MUDRICK", "lastName": "MASHAKA MUSSA", "admissionNumber": "DUP/STU0104/2023", "grade": "GRADE 4B", "parentName": "MASHAKA", "parentContact": "0714 467435"},
    {"firstName": "FATMA", "lastName": "SULEIMAN BAKAR", "admissionNumber": "DUP/STU0105/2023", "grade": "GRADE 4B", "parentName": "SULEIMAN", "parentContact": "0"},
    {"firstName": "ASHFAYNA", "lastName": "MASOUD KHAMIS", "admissionNumber": "DUP/STU0106/2023", "grade": "GRADE 4B", "parentName": "IBADMASOUD", "parentContact": "0"},
    {"firstName": "NAJMA", "lastName": "KHAMIS JUMA", "admissionNumber": "DUP/STU0107/2023", "grade": "GRADE 4B", "parentName": "KHAMIS", "parentContact": "0773 462 800"},
    {"firstName": "MAHSEEN", "lastName": "SALEH HASSAN", "admissionNumber": "DUP/STU0108/2023", "grade": "GRADE 4B", "parentName": "SALEH", "parentContact": "0"},
    {"firstName": "NAWFAL", "lastName": "SAID FARAJI", "admissionNumber": "DUP/STU0109/2023", "grade": "GRADE 4B", "parentName": "SAID", "parentContact": "0776 705 848"},
    {"firstName": "RAMLA", "lastName": "HAADIH OMAR", "admissionNumber": "DUP/STU0110/2023", "grade": "GRADE 4B", "parentName": "HAADIH", "parentContact": "0678 218 783"},
    {"firstName": "SAMIR", "lastName": "SAID ALI", "admissionNumber": "DUP/STU0111/2023", "grade": "GRADE 4B", "parentName": "ALI", "parentContact": "0777 766 764"},
    {"firstName": "YAKOUT", "lastName": "HASSAN YAKOUT", "admissionNumber": "DUP/STU0112/2023", "grade": "GRADE 4B", "parentName": "YAKOUT", "parentContact": "0680 218 783"},
    {"firstName": "YUSRA", "lastName": "ABDALLAH MOHAMMED", "admissionNumber": "DUP/STU0113/2023", "grade": "GRADE 4B", "parentName": "MOHAMMED", "parentContact": "0676 218 783"},
    {"firstName": "ASHFAYNA", "lastName": "RASHID MWALIM", "admissionNumber": "DUP/STU0138/2025", "grade": "GRADE 4B", "parentName": "RASHID", "parentContact": "0"},
    
    # GRADE 5A (11 students)
    {"firstName": "AISHA", "lastName": "ALI JUMA", "admissionNumber": "DUP/STU0058/2020", "grade": "GRADE 5A", "parentName": "ALI", "parentContact": "0"},
    {"firstName": "ALINA", "lastName": "BAKAR KASSIM", "admissionNumber": "DUP/STU0061/2022", "grade": "GRADE 5A", "parentName": "BAKAR", "parentContact": "0"},
    {"firstName": "FATNA", "lastName": "HAJI KECHE", "admissionNumber": "DUP/STU0062/2025", "grade": "GRADE 5A", "parentName": "HAJI", "parentContact": "0"},
    {"firstName": "RANIYA", "lastName": "RASHID HAMAD", "admissionNumber": "DUP/STU0065/2022", "grade": "GRADE 5A", "parentName": "RASHID", "parentContact": "0"},
    {"firstName": "MIZA", "lastName": "AME JUMA", "admissionNumber": "DUP/STU0066/2024", "grade": "GRADE 5A", "parentName": "AME", "parentContact": "0"},
    {"firstName": "SHAMSA", "lastName": "MOHAMMED JUMA", "admissionNumber": "DUP/STU0069/2023", "grade": "GRADE 5A", "parentName": "MOHAMMED", "parentContact": "0"},
    {"firstName": "SHAYMAA", "lastName": "KARAMA JUMAANE", "admissionNumber": "DUP/STU0070/2020", "grade": "GRADE 5A", "parentName": "KARAMA", "parentContact": "0"},
    {"firstName": "RIFU", "lastName": "ABDUL-SALAAM HASSAN", "admissionNumber": "DUP/STU0074/2024", "grade": "GRADE 5A", "parentName": "ABDUL-SALAAM", "parentContact": "0"},
    {"firstName": "KASSIM", "lastName": "HAJI KASSIM", "admissionNumber": "DUP/STU0075/2023", "grade": "GRADE 5A", "parentName": "KASSIM", "parentContact": "0"},
    {"firstName": "ABDULLAH", "lastName": "MOHAMMED ABDALLAH", "admissionNumber": "DUP/STU0076/2024", "grade": "GRADE 5A", "parentName": "MOHAMMED", "parentContact": "0"},
    {"firstName": "NADIR", "lastName": "CHANDE OMAR", "admissionNumber": "DUP/STU0077/2025", "grade": "GRADE 5A", "parentName": "CHANDE", "parentContact": "0"},
    
    # GRADE 5B (13 students)
    {"firstName": "ASMAA", "lastName": "SAID AME", "admissionNumber": "DUP/STU0045/2024", "grade": "GRADE 5B", "parentName": "SAID", "parentContact": "0"},
    {"firstName": "AYMAN", "lastName": "SULEIMAN MOHAMMED", "admissionNumber": "DUP/STU0046/2020", "grade": "GRADE 5B", "parentName": "SULEIMAN", "parentContact": "0"},
    {"firstName": "FARHAT", "lastName": "KHALFAN HASSAN", "admissionNumber": "DUP/STU0047/2020", "grade": "GRADE 5B", "parentName": "HASSAN", "parentContact": "0"},
    {"firstName": "FARINA", "lastName": "RIDH-WAN ISSA", "admissionNumber": "DUP/STU0048/2023", "grade": "GRADE 5B", "parentName": "RIDH-WAN", "parentContact": "0"},
    {"firstName": "MANAL", "lastName": "THABIT SALIM", "admissionNumber": "DUP/STU0049/2020", "grade": "GRADE 5B", "parentName": "THABIT", "parentContact": "0"},
    {"firstName": "MUNIRA", "lastName": "MASSOUD L", "admissionNumber": "DUP/STU0051/2023", "grade": "GRADE 5B", "parentName": "MASSOUD", "parentContact": "0"},
    {"firstName": "NAHYA", "lastName": "ABDUL-WAHAB L", "admissionNumber": "DUP/STU0052/2023", "grade": "GRADE 5B", "parentName": "ABDULWAHAB", "parentContact": "0"},
    {"firstName": "WEMA", "lastName": "RAMADHAN MWIGA", "admissionNumber": "DUP/STU0053/2024", "grade": "GRADE 5B", "parentName": "RAMADHAN", "parentContact": "0"},
    {"firstName": "DHULQARNAYN", "lastName": "AHMAD LUT", "admissionNumber": "DUP/STU0055/2022", "grade": "GRADE 5B", "parentName": "AHMAD", "parentContact": "0"},
    {"firstName": "MOH'D", "lastName": "MBAROUK L", "admissionNumber": "DUP/STU0056/2021", "grade": "GRADE 5B", "parentName": "MBAROUK", "parentContact": "0"},
    {"firstName": "SULEIMAN", "lastName": "MOH'D MSHANA", "admissionNumber": "DUP/STU0057/2024", "grade": "GRADE 5B", "parentName": "MOH'D", "parentContact": "0"},
    {"firstName": "WALEED", "lastName": "MOH'D L", "admissionNumber": "DUP/STU0136/2021", "grade": "GRADE 5B", "parentName": "MOH'D", "parentContact": "0"},
    {"firstName": "ZAHEED", "lastName": "MOH'D L", "admissionNumber": "DUP/STU0148/2024", "grade": "GRADE 5B", "parentName": "MOH'D", "parentContact": "0"},
    
    # GRADE 6A (14 students)
    {"firstName": "MUNKADIR", "lastName": "HAJI HABIB", "admissionNumber": "DUP/STU0029/2020", "grade": "GRADE 6A", "parentName": "HAJI", "parentContact": "774446811"},
    {"firstName": "ASMA", "lastName": "ALI JUMA", "admissionNumber": "DUP/STU0030/2024", "grade": "GRADE 6A", "parentName": "ALI", "parentContact": "777500044"},
    {"firstName": "MWAJUMA", "lastName": "SHAIB SULEIMAN", "admissionNumber": "DUP/STU0031/2024", "grade": "GRADE 6A", "parentName": "SULEIMAN", "parentContact": "0"},
    {"firstName": "BALQIIS", "lastName": "SAID MOHAMMED", "admissionNumber": "DUP/STU0032/2025", "grade": "GRADE 6A", "parentName": "SAID", "parentContact": "0"},
    {"firstName": "NAIMA", "lastName": "RAMADHAN ALI", "admissionNumber": "DUP/STU0033/2022", "grade": "GRADE 6A", "parentName": "ALI", "parentContact": "773344644"},
    {"firstName": "RAGHIB", "lastName": "RASHID HAMAD", "admissionNumber": "DUP/STU0034/2019", "grade": "GRADE 6A", "parentName": "RASHID", "parentContact": "688354648"},
    {"firstName": "RAHMA", "lastName": "KHALFAN MMAKA", "admissionNumber": "DUP/STU0035/2019", "grade": "GRADE 6A", "parentName": "RASHID", "parentContact": "773280754"},
    {"firstName": "FARDEEN", "lastName": "MOHAMMED IBRAHIM", "admissionNumber": "DUP/STU0036/2021", "grade": "GRADE 6A", "parentName": "KHALFAN", "parentContact": "777599972"},
    {"firstName": "MAHIRA", "lastName": "MOHAMMED ABDALLAH", "admissionNumber": "DUP/STU0037/2019", "grade": "GRADE 6A", "parentName": "SULEIMAN", "parentContact": "777416924"},
    {"firstName": "MYTHAM", "lastName": "RAMADHAN MOHAMMED", "admissionNumber": "DUP/STU0038/2024", "grade": "GRADE 6A", "parentName": "KHALFAN", "parentContact": "777490000"},
    {"firstName": "RUSHDA", "lastName": "KHAMIS JUMA", "admissionNumber": "DUP/STU0039/2024", "grade": "GRADE 6A", "parentName": "ABDALLAH", "parentContact": "774868962"},
    {"firstName": "SAID", "lastName": "OMAR SAID", "admissionNumber": "DUP/STU0040/2019", "grade": "GRADE 6A", "parentName": "KHAMIS", "parentContact": "773462800"},
    {"firstName": "ABDULRAHMAN", "lastName": "JUMA ZIDIKHEIR", "admissionNumber": "DUP/STU0041/2019", "grade": "GRADE 6A", "parentName": "OMAR", "parentContact": "773152315"},
    {"firstName": "ALI", "lastName": "ABDULLAH ALI", "admissionNumber": "DUP/STU0042/2023", "grade": "GRADE 6A", "parentName": "ALI", "parentContact": "773230647"},
    
    # GRADE 6B (14 students)
    {"firstName": "ABDALLAH", "lastName": "HAMID BILAL", "admissionNumber": "DUP/STU0015/2025", "grade": "GRADE 6B", "parentName": "BILAL", "parentContact": "777411204"},
    {"firstName": "AMIYNA", "lastName": "JUMA ZIDIKHEIR", "admissionNumber": "DUP/STU0016/2020", "grade": "GRADE 6B", "parentName": "ZIDIKHEIR", "parentContact": "777525732"},
    {"firstName": "NAFDA", "lastName": "NADIR NASSOR", "admissionNumber": "DUP/STU0137/2026", "grade": "GRADE 6B", "parentName": "NASSOR", "parentContact": "777525752"},
    {"firstName": "NAHWAD", "lastName": "SAID ALI", "admissionNumber": "DUP/STU0135/2025", "grade": "GRADE 6B", "parentName": "ALI", "parentContact": "773441258"},
    {"firstName": "MUZAYNA", "lastName": "HAJI HABIB", "admissionNumber": "DUP/STU0019/2026", "grade": "GRADE 6B", "parentName": "ZIDIKHEIR", "parentContact": "773912724"},
    {"firstName": "ZULEIKHA", "lastName": "MUTHIR MOH'D", "admissionNumber": "DUP/STU0020/2024", "grade": "GRADE 6B", "parentName": "JUMA", "parentContact": "773441258"},
    {"firstName": "RUHAYYA", "lastName": "ABDALLAH KHAMIS", "admissionNumber": "DUP/STU0021/2019", "grade": "GRADE 6B", "parentName": "MOHAMMED", "parentContact": "774868962"},
    {"firstName": "RIYAAD", "lastName": "KHALFAN HAROUB", "admissionNumber": "DUP/STU0022/2023", "grade": "GRADE 6B", "parentName": "MOHAMMED", "parentContact": "775000000"},
    {"firstName": "IMRAN", "lastName": "HAJI SALIM", "admissionNumber": "DUP/STU0023/2020", "grade": "GRADE 6B", "parentName": "SALIM", "parentContact": "778500606"},
    {"firstName": "JUNAITHAR", "lastName": "JUMA KOMBO", "admissionNumber": "DUP/STU0024/2020", "grade": "GRADE 6B", "parentName": "KOMBO", "parentContact": "777100046"},
    {"firstName": "KHALFAN", "lastName": "ABDALLAH MATAR", "admissionNumber": "DUP/STU0025/2019", "grade": "GRADE 6B", "parentName": "MATTAR", "parentContact": "0"},
    {"firstName": "SALMA", "lastName": "ALI ABDI", "admissionNumber": "DUP/STU0026/2019", "grade": "GRADE 6B", "parentName": "ABDALLAH", "parentContact": "778865555"},
    {"firstName": "MARYAM", "lastName": "MOHAMMED KAMAL", "admissionNumber": "DUP/STU0027/2019", "grade": "GRADE 6B", "parentName": "KAMAL", "parentContact": "777490414"},
    {"firstName": "RAYYAN", "lastName": "SULEIMAN ABDALLAH", "admissionNumber": "DUP/STU0018/2020", "grade": "GRADE 6B", "parentName": "SULEIMAN", "parentContact": "777411775"},
    
    # GRADE 7 (11 students)
    {"firstName": "ABUBAKAR", "lastName": "SLIM", "admissionNumber": "DUP/STU0002/2024", "grade": "GRADE 7", "parentName": "SLIM", "parentContact": "773441040"},
    {"firstName": "AMMAR", "lastName": "AMEIR", "admissionNumber": "DUP/STU0003/2019", "grade": "GRADE 7", "parentName": "CHANDE", "parentContact": "776410998"},
    {"firstName": "ASMAA", "lastName": "HABIB", "admissionNumber": "DUP/STU0004/2024", "grade": "GRADE 7", "parentName": "AMEIR", "parentContact": "77903323"},
    {"firstName": "IDAROUS", "lastName": "YUSSUF", "admissionNumber": "DUP/STU0005/2023", "grade": "GRADE 7", "parentName": "HABIB", "parentContact": "656444373"},
    {"firstName": "ISMAIL", "lastName": "ABDALLA", "admissionNumber": "DUP/STU0006/2020", "grade": "GRADE 7", "parentName": "YUSSUF", "parentContact": "77525132"},
    {"firstName": "MALHA", "lastName": "HAFIDHI", "admissionNumber": "DUP/STU0007/2022", "grade": "GRADE 7", "parentName": "ABDALLA", "parentContact": "712346777"},
    {"firstName": "MAWADDAH", "lastName": "OSMAN", "admissionNumber": "DUP/STU0008/2020", "grade": "GRADE 7", "parentName": "HAFIDHI", "parentContact": "777456202"},
    {"firstName": "NURFAT", "lastName": "SAID", "admissionNumber": "DUP/STU0009/2020", "grade": "GRADE 7", "parentName": "OSMAN", "parentContact": "773803231"},
    {"firstName": "SAIMINA", "lastName": "TAHIR", "admissionNumber": "DUP/STU0011/2025", "grade": "GRADE 7", "parentName": "ALI KHAMIS", "parentContact": "625879800"},
    {"firstName": "SUHEIL", "lastName": "KHAMIS", "admissionNumber": "DUP/STU0012/2022", "grade": "GRADE 7", "parentName": "TAHIR", "parentContact": "773908844"},
    {"firstName": "WALID", "lastName": "ALI", "admissionNumber": "DUP/STU0013/2019", "grade": "GRADE 7", "parentName": "KHAMIS", "parentContact": "773515052"},
]

# Payment data from the fee records (extracted from user's data)
PAYMENT_DATA = [
    {"admissionNumber": "DUP/STU0053/2024", "totalFee": 1515000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0099/2023", "totalFee": 1987500, "paid": 50000, "paymentDate": "12/25/2025"},
    {"admissionNumber": "DUP/STU0110/2023", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0020/2024", "totalFee": 1575000, "paid": 787500, "paymentDate": "2/12/2026"},
    {"admissionNumber": "DUP/STU0038/2024", "totalFee": 1575000, "paid": 15000, "paymentDate": "1/13/2026"},
    {"admissionNumber": "DUP/STU0082/2017", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0011/2025", "totalFee": 1975000, "paid": 987500, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0102/2023", "totalFee": 0, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0015/2025", "totalFee": 1975000, "paid": 500000, "paymentDate": "2/4/2026"},
    {"admissionNumber": "DUP/STU0037/2019", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0046/2020", "totalFee": 1975000, "paid": 250000, "paymentDate": "2/12/2026"},
    {"admissionNumber": "DUP/STU0025/2019", "totalFee": 1575000, "paid": 788000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0095/2023", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0109/2023", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0006/2020", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0009/2020", "totalFee": 1575000, "paid": 1000000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0012/2022", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0098/2023", "totalFee": 1575000, "paid": 855000, "paymentDate": "1/30/2026"},
    {"admissionNumber": "DUP/STU0105/2023", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0135/2025", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0140/2017", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0051/2023", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0085/2017", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0018/2020", "totalFee": 1575000, "paid": 1575000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0026/2019", "totalFee": 1575000, "paid": 700000, "paymentDate": "2/12/2026"},
    {"admissionNumber": "DUP/STU0031/2024", "totalFee": 1515000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0047/2020", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0080/2016", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0143/2017", "totalFee": 1575000, "paid": 788000, "paymentDate": "2/11/2026"},
    {"admissionNumber": "DUP/STU0056/2021", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0137/2026", "totalFee": 1735000, "paid": 660000, "paymentDate": "2/12/2026"},
    {"admissionNumber": "DUP/STU0007/2022", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0033/2022", "totalFee": 1575000, "paid": 500000, "paymentDate": "1/13/2026"},
    {"admissionNumber": "DUP/STU0052/2023", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0108/2023", "totalFee": 2135000, "paid": 1100000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0049/2020", "totalFee": 1575000, "paid": 787500, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0100/2023", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0136/2021", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0002/2024", "totalFee": 1575000, "paid": 787500, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0030/2024", "totalFee": 1515000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0041/2019", "totalFee": 1975000, "paid": 800000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0092/2017", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0096/2023", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0008/2020", "totalFee": 1125000, "paid": 660000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0093/2017", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0138/2025", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0074/2024", "totalFee": 1975000, "paid": 500000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0112/2023", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0021/2019", "totalFee": 1515000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0023/2020", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0058/2020", "totalFee": 1515000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0107/2023", "totalFee": 1975000, "paid": 987500, "paymentDate": "2/12/2026"},
    {"admissionNumber": "DUP/STU0148/2020", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0035/2019", "totalFee": 1575000, "paid": 700000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0045/2024", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0055/2022", "totalFee": 1575000, "paid": 370000, "paymentDate": "2/13/2026"},
    {"admissionNumber": "DUP/STU0097/2023", "totalFee": 1125000, "paid": 630000, "paymentDate": "2/12/2026"},
    {"admissionNumber": "DUP/STU0048/2023", "totalFee": 1975000, "paid": 987500, "paymentDate": "2/11/2026"},
    {"admissionNumber": "DUP/STU0083/2016", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0086/2017", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0078/2016", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0084/2016", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0141/2017", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0022/2023", "totalFee": 1975000, "paid": 1975000, "paymentDate": "2/9/2026"},
    {"admissionNumber": "DUP/STU0034/2019", "totalFee": 1975000, "paid": 500000, "paymentDate": "4/9/2026"},
    {"admissionNumber": "DUP/STU0042/2023", "totalFee": 1975000, "paid": 250000, "paymentDate": "2/9/2026"},
    {"admissionNumber": "DUP/STU0057/2024", "totalFee": 1975000, "paid": 987500, "paymentDate": "2/9/2026"},
    {"admissionNumber": "DUP/STU0065/2022", "totalFee": 1975000, "paid": 500000, "paymentDate": "2/9/2026"},
    {"admissionNumber": "DUP/STU0091/2015", "totalFee": 1975000, "paid": 700000, "paymentDate": "2/11/2026"},
    {"admissionNumber": "DUP/STU0013/2019", "totalFee": 1975000, "paid": 900000, "paymentDate": "2/4/2026"},
    {"admissionNumber": "DUP/STU0027/2019", "totalFee": 1975000, "paid": 500000, "paymentDate": "1/13/2026"},
    {"admissionNumber": "DUP/STU0040/2019", "totalFee": 1975000, "paid": 1975000, "paymentDate": "2/9/2026"},
    {"admissionNumber": "DUP/STU0070/2020", "totalFee": 1975000, "paid": 500000, "paymentDate": "2/9/2026"},
    {"admissionNumber": "DUP/STU0081/2015", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0090/2016", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0104/2023", "totalFee": 1975000, "paid": 987500, "paymentDate": "1/9/2026"},
    {"admissionNumber": "DUP/STU0024/2020", "totalFee": 1975000, "paid": 900000, "paymentDate": "2/11/2026"},
    {"admissionNumber": "DUP/STU0039/2024", "totalFee": 1975000, "paid": 987500, "paymentDate": "2/9/2026"},
    {"admissionNumber": "DUP/STU0142/2017", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0005/2023", "totalFee": 1975000, "paid": 700000, "paymentDate": "2/11/2026"},
    {"admissionNumber": "DUP/STU0077/2025", "totalFee": 1975000, "paid": 245000, "paymentDate": "2/3/2026"},
    {"admissionNumber": "DUP/STU0079/2017", "totalFee": 1975000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0087/2017", "totalFee": 1975000, "paid": 900000, "paymentDate": "2/11/2026"},
    {"admissionNumber": "DUP/STU0016/2020", "totalFee": 1975000, "paid": 800000, "paymentDate": "2/9/2026"},
    {"admissionNumber": "DUP/STU0089/2016", "totalFee": 1575000, "paid": 0, "paymentDate": None},
    {"admissionNumber": "DUP/STU0094/2017", "totalFee": 1575000, "paid": 600000, "paymentDate": "2/11/2026"},
    {"admissionNumber": "DUP/STU0003/2019", "totalFee": 1975000, "paid": 500000, "paymentDate": "3/2/2026"},
    {"admissionNumber": "DUP/STU0004/2024", "totalFee": 1575000, "paid": 987500, "paymentDate": "2/6/2026"},
    {"admissionNumber": "DUP/STU0032/2025", "totalFee": 1975000, "paid": 665000, "paymentDate": "2/9/2026"},
]

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def clear_existing_data():
    """Clear existing student and fee data"""
    print("Clearing existing data...")
    await db.students.delete_many({"chain": "DUP"})
    await db.student_fees.delete_many({"chain": "DUP"})
    await db.payments.delete_many({"chain": "DUP"})
    # Keep fee structures but reset
    print("Existing data cleared!")

async def create_classes():
    """Create or update class records"""
    print("Creating classes...")
    classes = [
        {"name": "GRADE 4A", "level": "primary", "capacity": 30},
        {"name": "GRADE 4B", "level": "primary", "capacity": 30},
        {"name": "GRADE 5A", "level": "primary", "capacity": 30},
        {"name": "GRADE 5B", "level": "primary", "capacity": 30},
        {"name": "GRADE 6A", "level": "primary", "capacity": 30},
        {"name": "GRADE 6B", "level": "primary", "capacity": 30},
        {"name": "GRADE 7", "level": "primary", "capacity": 30},
    ]
    
    for cls in classes:
        existing = await db.classes.find_one({"name": cls["name"], "chain": "DUP"})
        if not existing:
            class_doc = {
                "id": str(uuid.uuid4()),
                "name": cls["name"],
                "level": cls["level"],
                "capacity": cls["capacity"],
                "chain": "DUP",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.classes.insert_one(class_doc)
            print(f"  Created class: {cls['name']}")
        else:
            print(f"  Class already exists: {cls['name']}")
    
    print("Classes created!")

async def create_fee_structures():
    """Create fee structures for DUP school"""
    print("Creating fee structures...")
    
    # Check if fee structures already exist
    existing = await db.fee_structures.find_one({"chain": "DUP", "name": "Tuition Fee"})
    if existing:
        print("  Fee structures already exist, skipping...")
        return existing["id"]
    
    fee_structure = {
        "id": str(uuid.uuid4()),
        "name": "Tuition Fee",
        "description": "Annual school tuition fee",
        "amount": 1575000,  # Base amount
        "chain": "DUP",
        "class_name": None,
        "mandatory": True,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.fee_structures.insert_one(fee_structure)
    print(f"  Created fee structure: {fee_structure['name']}")
    
    return fee_structure["id"]

async def import_students():
    """Import all students from CSV data"""
    print(f"\nImporting {len(ALL_CSV_STUDENTS)} students...")
    
    password_hash = hash_password(DEFAULT_PASSWORD)
    imported = 0
    
    for student_data in ALL_CSV_STUDENTS:
        # Check if student already exists
        existing = await db.students.find_one({"admission_no": student_data["admissionNumber"]})
        if existing:
            print(f"  Student already exists: {student_data['admissionNumber']}")
            continue
        
        student_doc = {
            "id": str(uuid.uuid4()),
            "admission_no": student_data["admissionNumber"],
            "first_name": student_data["firstName"],
            "last_name": student_data["lastName"],
            "name": f"{student_data['firstName']} {student_data['lastName']}",
            "class_name": student_data["grade"],
            "date_of_birth": "2015-01-01",
            "gender": "male",
            "chain": "DUP",
            "parent_name": student_data["parentName"],
            "parent_contact": student_data["parentContact"],
            "parent_email": "",
            "address": "",
            "status": "active",
            "role": "student",
            "password_hash": password_hash,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.students.insert_one(student_doc)
        imported += 1
    
    print(f"  Imported {imported} students!")
    return imported

async def import_fee_records(fee_structure_id: str):
    """Import student fee records and payments"""
    print("\nImporting fee records and payments...")
    
    # Build a map of admission numbers to student IDs
    students = await db.students.find({"chain": "DUP"}, {"_id": 0, "id": 1, "admission_no": 1, "name": 1}).to_list(500)
    student_map = {s["admission_no"]: s for s in students}
    
    fees_imported = 0
    payments_imported = 0
    
    for payment_record in PAYMENT_DATA:
        admission_no = payment_record["admissionNumber"]
        student = student_map.get(admission_no)
        
        if not student:
            print(f"  Student not found: {admission_no}")
            continue
        
        student_id = student["id"]
        
        # Create student fee record
        fee_doc = {
            "id": str(uuid.uuid4()),
            "student_id": student_id,
            "chain": "DUP",
            "amount": payment_record["totalFee"],
            "fee_type": "tuition",
            "status": "paid" if payment_record["paid"] >= payment_record["totalFee"] else ("partial" if payment_record["paid"] > 0 else "pending"),
            "due_date": "2026-03-31",
            "paid_amount": payment_record["paid"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Delete existing fee record for this student if any
        await db.student_fees.delete_many({"student_id": student_id})
        await db.student_fees.insert_one(fee_doc)
        fees_imported += 1
        
        # Create payment record if paid amount > 0
        if payment_record["paid"] > 0 and payment_record["paymentDate"]:
            payment_doc = {
                "id": str(uuid.uuid4()),
                "student_id": student_id,
                "fee_structure_id": fee_structure_id,
                "amount": payment_record["paid"],
                "payment_method": "cash",
                "reference_no": f"PAY-{admission_no.replace('/', '-')}",
                "received_by": "system-import",
                "chain": "DUP",
                "notes": "Imported from records",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Delete existing payments for this student
            await db.payments.delete_many({"student_id": student_id})
            await db.payments.insert_one(payment_doc)
            payments_imported += 1
    
    print(f"  Imported {fees_imported} fee records and {payments_imported} payments!")

async def verify_import():
    """Verify the import was successful"""
    print("\n=== VERIFICATION ===")
    
    # Count students
    students_count = await db.students.count_documents({"chain": "DUP"})
    print(f"Total students in database: {students_count}")
    
    # Count by class
    pipeline = [
        {"$match": {"chain": "DUP"}},
        {"$group": {"_id": "$class_name", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    
    class_counts = await db.students.aggregate(pipeline).to_list(20)
    print("\nStudents by class:")
    for cc in class_counts:
        print(f"  {cc['_id']}: {cc['count']} students")
    
    # Count classes
    classes_count = await db.classes.count_documents({"chain": "DUP"})
    print(f"\nTotal classes: {classes_count}")
    
    # Count fee records
    fees_count = await db.student_fees.count_documents({"chain": "DUP"})
    print(f"Total fee records: {fees_count}")
    
    # Count payments
    payments_count = await db.payments.count_documents({"chain": "DUP"})
    print(f"Total payment records: {payments_count}")
    
    # Calculate totals
    pipeline = [
        {"$match": {"chain": "DUP"}},
        {"$group": {
            "_id": None,
            "total_fees": {"$sum": "$amount"},
            "total_paid": {"$sum": "$paid_amount"}
        }}
    ]
    
    totals = await db.student_fees.aggregate(pipeline).to_list(1)
    if totals:
        t = totals[0]
        print(f"\nFinancial Summary:")
        print(f"  Total Fees: TSh {t['total_fees']:,.0f}")
        print(f"  Total Paid: TSh {t['total_paid']:,.0f}")
        print(f"  Outstanding: TSh {t['total_fees'] - t['total_paid']:,.0f}")

async def main():
    print("=" * 60)
    print("IHEZA School Management System - Data Import")
    print("=" * 60)
    
    # Clear existing data
    await clear_existing_data()
    
    # Create classes
    await create_classes()
    
    # Create fee structures
    fee_structure_id = await create_fee_structures()
    
    # Import students
    await import_students()
    
    # Import fee records and payments
    await import_fee_records(fee_structure_id)
    
    # Verify import
    await verify_import()
    
    print("\n" + "=" * 60)
    print("Import completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
