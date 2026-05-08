#!/usr/bin/env python3
"""
Test script to check attendance API issue
"""
import asyncio
import sys
import os
sys.path.insert(0, '/app/backend')

# Mock the database connection for testing
class MockDB:
    def __init__(self):
        self.attendance = MockCollection()

class MockCollection:
    def __init__(self):
        # Simulate some attendance records
        self.records = [
            {
                "id": "1",
                "target_type": "student",
                "target_id": "student-001",
                "chain": "DUP",
                "date": "2025-04-01",
                "status": "present",
                "recorded_by": "teacher-001"
            },
            {
                "id": "2",
                "target_type": "student",
                "target_id": "student-002",
                "chain": "DUP",
                "date": "2025-04-01",
                "status": "absent",
                "recorded_by": "teacher-001"
            },
            {
                "id": "3",
                "target_type": "staff",
                "target_id": "teacher-001",
                "chain": "DUP",
                "date": "2025-04-01",
                "status": "present",
                "recorded_by": "system"
            }
        ]
    
    async def find(self, query, projection=None):
        # Simple query filtering
        filtered = []
        for record in self.records:
            match = True
            for key, value in query.items():
                if key not in record or record[key] != value:
                    match = False
                    break
            if match:
                # Apply projection
                if projection:
                    filtered_record = {}
                    for k, v in record.items():
                        if k not in projection.get('_id', 0):
                            filtered_record[k] = v
                    filtered.append(filtered_record)
                else:
                    filtered.append(record)
        return MockCursor(filtered)
    
    async def find_one(self, query):
        for record in self.records:
            match = True
            for key, value in query.items():
                if key not in record or record[key] != value:
                    match = False
                    break
            if match:
                return record
        return None

class MockCursor:
    def __init__(self, data):
        self.data = data
    
    async def to_list(self, length):
        return self.data[:length]

# Test the get_attendance logic from server.py
async def test_server_attendance():
    print("Testing server.py attendance logic...")
    
    # Mock db
    db = MockDB()
    
    # Simulate get_chain_filter function
    def get_chain_filter(user):
        if not user:
            return {}
        role = user.get('role', '')
        chain = user.get('chain', '')
        if role in ['director', 'coordinator']:
            return {}
        return {'chain': chain}
    
    # Test 1: No user (unauthenticated)
    print("\nTest 1: No user (unauthenticated)")
    query = get_chain_filter(None)
    if 'target_type' in {'target_type': 'student'}:
        query['target_type'] = 'student'
    print(f"Query: {query}")
    records = await db.attendance.find(query, {"_id": 0}).to_list(1000)
    print(f"Records found: {len(records)}")
    for r in records:
        print(f"  - {r['target_type']} {r['target_id']} ({r['chain']})")
    
    # Test 2: Teacher from DUP chain
    print("\nTest 2: Teacher from DUP chain")
    user = {'role': 'teacher', 'chain': 'DUP'}
    query = get_chain_filter(user)
    if 'target_type' in {'target_type': 'student'}:
        query['target_type'] = 'student'
    print(f"Query: {query}")
    records = await db.attendance.find(query, {"_id": 0}).to_list(1000)
    print(f"Records found: {len(records)}")
    
    # Test 3: Teacher from different chain (DLP)
    print("\nTest 3: Teacher from DLP chain (should see no records)")
    user = {'role': 'teacher', 'chain': 'DLP'}
    query = get_chain_filter(user)
    if 'target_type' in {'target_type': 'student'}:
        query['target_type'] = 'student'
    print(f"Query: {query}")
    records = await db.attendance.find(query, {"_id": 0}).to_list(1000)
    print(f"Records found: {len(records)}")

# Test the get_attendance logic from modular attendance.py
async def test_modular_attendance():
    print("\n\nTesting modular attendance.py logic...")
    
    db = MockDB()
    
    def get_chain_filter(user):
        if not user:
            return {}
        role = user.get('role', '')
        chain = user.get('chain', '')
        if role in ['director', 'coordinator']:
            return {}
        return {'chain': chain}
    
    # Test with month parameter
    print("\nTest with month parameter: 2025-04")
    user = {'role': 'teacher', 'chain': 'DUP'}
    query = get_chain_filter(user)
    query['target_type'] = 'student'
    month = '2025-04'
    if month:
        query['date'] = {"$regex": f"^{month}"}
    print(f"Query: {query}")
    # Note: Our mock doesn't support regex queries, but real MongoDB would
    
    # Check what the frontend does
    print("\nFrontend logic analysis:")
    print("1. Calls dataService.getAttendance({ target_type: 'student' })")
    print("2. Gets all student attendance records")
    print("3. Filters client-side by month: r.date?.startsWith(selectedMonth)")
    print("4. If no records for selected month, shows empty table")

if __name__ == "__main__":
    asyncio.run(test_server_attendance())
    asyncio.run(test_modular_attendance())
    
    print("\n\nPossible issues identified:")
    print("1. Wrong server running (server.py instead of server_new.py)")
    print("2. Attendance records missing 'chain' field or wrong chain value")
    print("3. User authentication issue - current_user might be None")
    print("4. No student attendance records in database")
    print("5. Frontend filtering logic issue")
    print("\nRecommendation: Check which server is actually running and test the API endpoint directly.")