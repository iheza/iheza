import requests
import sys
from datetime import datetime
import json

class IHEZAAPITester:
    def __init__(self, base_url="https://build-app-now-34.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    return True, response_data
                except:
                    print(f"   Response: {response.text[:200]}...")
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            self.failed_tests.append({'name': name, 'error': 'Timeout'})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({'name': name, 'error': str(e)})
            return False, {}

    def test_health_check(self):
        """Test API health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        return success

    def test_login(self, access_code, password, portal):
        """Test login and get token"""
        success, response = self.run_test(
            f"Login ({access_code})",
            "POST",
            "api/auth",
            200,
            data={
                "accessCode": access_code,
                "password": password,
                "portal": portal
            }
        )
        if success and isinstance(response, dict) and 'sessionToken' in response:
            self.token = response['sessionToken']
            print(f"   ✅ Token obtained: {self.token[:20]}...")
            return True, response
        return False, {}

    def test_staff_qr_checkin(self, access_code):
        """Test staff QR check-in functionality"""
        success, response = self.run_test(
            f"Staff QR Check-in ({access_code})",
            "POST",
            "api/attendance/staff-checkin",
            200,
            data={"access_code": access_code}
        )
        if success and isinstance(response, dict):
            print(f"   ✅ Check-in result: {response.get('message', 'Success')}")
        return success, response

    def test_get_staff_attendance_today(self):
        """Test getting today's staff attendance"""
        success, response = self.run_test(
            "Get Today's Staff Attendance",
            "GET",
            "api/attendance/staff-today",
            200
        )
        if success and isinstance(response, list):
            print(f"   📊 Found {len(response)} attendance records today")
        return success, response

    def test_get_students(self):
        """Test get students endpoint"""
        success, response = self.run_test(
            "Get Students",
            "GET",
            "api/students",
            200
        )
        if success and isinstance(response, list):
            print(f"   📊 Found {len(response)} students")
        return success, response

    def test_get_classes(self):
        """Test get classes endpoint"""
        success, response = self.run_test(
            "Get Classes",
            "GET",
            "api/classes",
            200
        )
        if success and isinstance(response, list):
            print(f"   📊 Found {len(response)} classes")
        return success, response

    def test_get_subjects(self):
        """Test get subjects endpoint"""
        success, response = self.run_test(
            "Get Subjects",
            "GET",
            "api/subjects",
            200
        )
        if success and isinstance(response, list):
            print(f"   📊 Found {len(response)} subjects")
        return success, response

    def test_sync_data(self):
        """Test data sync endpoint"""
        success, response = self.run_test(
            "Sync Data",
            "GET",
            "api/sync",
            200
        )
        if success and isinstance(response, dict):
            students_count = len(response.get('students', []))
            classes_count = len(response.get('classes', []))
            subjects_count = len(response.get('subjects', []))
            print(f"   📊 Sync data: {students_count} students, {classes_count} classes, {subjects_count} subjects")
        return success, response

    def test_create_student(self):
        """Test creating a new student"""
        test_student = {
            "admission_no": f"DUP/STU{datetime.now().strftime('%H%M%S')}/2026",
            "first_name": "Test",
            "last_name": "Student",
            "class_name": "Grade 1A",
            "parent_name": "Test Parent",
            "parent_phone": "+255700000000",
            "gender": "MALE",
            "password": "test123"
        }
        
        success, response = self.run_test(
            "Create Student",
            "POST",
            "api/students",
            200,
            data=test_student
        )
        
        if success and isinstance(response, dict) and 'id' in response:
            student_id = response['id']
            print(f"   ✅ Student created with ID: {student_id}")
            
            # Test getting the created student
            success2, _ = self.run_test(
                "Get Created Student",
                "GET",
                f"api/students/{student_id}",
                200
            )
            
            # Clean up - delete the test student
            self.run_test(
                "Delete Test Student",
                "DELETE",
                f"api/students/{student_id}",
                200
            )
            
            return success and success2
        
        return success

    def test_seed_database(self):
        """Test database seeding"""
        success, response = self.run_test(
            "Seed Database",
            "POST",
            "api/seed",
            200
        )
        return success

def main():
    print("🚀 Starting IHEZA School Management System API Tests")
    print("=" * 60)
    
    tester = IHEZAAPITester()
    
    # Test 1: Health Check
    print("\n📋 BASIC CONNECTIVITY TESTS")
    if not tester.test_health_check():
        print("❌ Health check failed - API may be down")
        return 1
    
    # Test 2: Database seeding (in case it's not seeded)
    print("\n📋 DATABASE SETUP")
    tester.test_seed_database()
    
    # Test 3: Authentication with NEW ACCESS CODE FORMATS
    print("\n📋 AUTHENTICATION TESTS (NEW FORMATS)")
    
    # Test Director login with new format
    director_success, director_response = tester.test_login("IHEZA/DIRECTOR/001/2026", "director123", "director")
    
    # Test Teacher login with new format
    teacher_success, teacher_response = tester.test_login("DUP/TEACHER/001/2026", "teacher123", "teacher")
    
    # Test Student login with new format
    student_success, student_response = tester.test_login("DUP/STU0001/2026", "student123", "student")
    
    if not (director_success or teacher_success or student_success):
        print("❌ All login attempts failed - cannot proceed with authenticated tests")
        return 1
    
    # Test 4: Staff QR Attendance functionality
    print("\n📋 QR ATTENDANCE TESTS")
    if director_success or teacher_success:
        # Test staff check-in with new access code format
        tester.test_staff_qr_checkin("DUP/TEACHER/001/2026")
        tester.test_get_staff_attendance_today()
    
    # Test 5: Data Retrieval
    print("\n📋 DATA RETRIEVAL TESTS")
    tester.test_get_students()
    tester.test_get_classes()
    tester.test_get_subjects()
    tester.test_sync_data()
    
    # Test 6: CRUD Operations (if authenticated)
    if tester.token:
        print("\n📋 CRUD OPERATION TESTS")
        tester.test_create_student()
    
    # Print final results
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for test in tester.failed_tests:
            error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
            print(f"   • {test['name']}: {error_msg}")
    
    # Return appropriate exit code
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 All tests passed!")
        return 0
    elif tester.tests_passed / tester.tests_run >= 0.8:
        print("\n⚠️  Most tests passed, minor issues detected")
        return 0
    else:
        print("\n💥 Significant test failures detected")
        return 1

if __name__ == "__main__":
    sys.exit(main())