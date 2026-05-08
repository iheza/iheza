import requests
import sys
from datetime import datetime
import json

class ExtendedIHEZAAPITester:
    def __init__(self, base_url="https://build-app-now-34.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_student_id = None
        self.test_staff_id = None

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

    def test_login(self):
        """Test login and get token"""
        success, response = self.run_test(
            "Director Login",
            "POST",
            "api/auth",
            200,
            data={
                "accessCode": "DIRECTOR001",
                "password": "director123",
                "portal": "director"
            }
        )
        if success and isinstance(response, dict) and 'sessionToken' in response:
            self.token = response['sessionToken']
            print(f"   ✅ Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_student_edit_functionality(self):
        """Test student edit functionality - create, update, verify"""
        print("\n📋 TESTING STUDENT EDIT FUNCTIONALITY")
        
        # 1. Create a test student
        test_student = {
            "admission_number": f"EDIT{datetime.now().strftime('%H%M%S')}",
            "name": "Edit Test Student",
            "class_name": "Form 1A",
            "section": "A",
            "parent_name": "Test Parent",
            "parent_phone": "+255700000000",
            "gender": "Male",
            "password": "test123"
        }
        
        success, response = self.run_test(
            "Create Student for Edit Test",
            "POST",
            "api/students",
            200,
            data=test_student
        )
        
        if not success or not isinstance(response, dict) or 'id' not in response:
            return False
        
        self.test_student_id = response['id']
        
        # 2. Update the student (simulate edit functionality)
        updated_data = {
            "name": "Updated Student Name",
            "parent_name": "Updated Parent Name",
            "parent_phone": "+255700000001",
            "gender": "Female"
        }
        
        success, response = self.run_test(
            "Update Student (Edit)",
            "PUT",
            f"api/students/{self.test_student_id}",
            200,
            data=updated_data
        )
        
        if not success:
            return False
        
        # 3. Verify the update
        success, response = self.run_test(
            "Verify Student Update",
            "GET",
            f"api/students/{self.test_student_id}",
            200
        )
        
        if success and isinstance(response, dict):
            if (response.get('name') == 'Updated Student Name' and 
                response.get('parent_name') == 'Updated Parent Name'):
                print("   ✅ Student edit functionality working correctly")
                return True
            else:
                print("   ❌ Student data not updated correctly")
                return False
        
        return False

    def test_staff_edit_functionality(self):
        """Test staff edit functionality - create, update, verify"""
        print("\n📋 TESTING STAFF EDIT FUNCTIONALITY")
        
        # 1. Create a test staff member
        test_staff = {
            "employee_id": f"STAFF{datetime.now().strftime('%H%M%S')}",
            "name": "Edit Test Staff",
            "role": "Teacher",
            "department": "Mathematics",
            "email": "test@iheza.edu",
            "phone": "+255700000000",
            "password": "test123"
        }
        
        success, response = self.run_test(
            "Create Staff for Edit Test",
            "POST",
            "api/staff",
            200,
            data=test_staff
        )
        
        if not success or not isinstance(response, dict) or 'id' not in response:
            return False
        
        self.test_staff_id = response['id']
        
        # 2. Update the staff member (simulate edit functionality)
        updated_data = {
            "name": "Updated Staff Name",
            "role": "Coordinator",
            "department": "Science",
            "email": "updated@iheza.edu",
            "phone": "+255700000001"
        }
        
        success, response = self.run_test(
            "Update Staff (Edit)",
            "PUT",
            f"api/staff/{self.test_staff_id}",
            200,
            data=updated_data
        )
        
        if not success:
            return False
        
        # 3. Verify the update
        success, response = self.run_test(
            "Verify Staff Update",
            "GET",
            f"api/staff/{self.test_staff_id}",
            200
        )
        
        if success and isinstance(response, dict):
            if (response.get('name') == 'Updated Staff Name' and 
                response.get('role') == 'Coordinator'):
                print("   ✅ Staff edit functionality working correctly")
                return True
            else:
                print("   ❌ Staff data not updated correctly")
                return False
        
        return False

    def test_attendance_functionality(self):
        """Test attendance recording functionality"""
        print("\n📋 TESTING ATTENDANCE FUNCTIONALITY")
        
        # Get a student to record attendance for
        success, students = self.run_test(
            "Get Students for Attendance",
            "GET",
            "api/students",
            200
        )
        
        if not success or not isinstance(students, list) or len(students) == 0:
            print("   ❌ No students found for attendance test")
            return False
        
        student = students[0]
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Record attendance
        attendance_data = {
            "student_id": student['id'],
            "class_id": "Form 1A",
            "date": today,
            "status": "present",
            "recorded_by": "qr_scanner"
        }
        
        success, response = self.run_test(
            "Record Attendance",
            "POST",
            "api/attendance",
            200,
            data=attendance_data
        )
        
        if not success:
            return False
        
        # Verify attendance was recorded
        success, response = self.run_test(
            "Get Today's Attendance",
            "GET",
            f"api/attendance?class_id=Form 1A&date={today}",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            print("   ✅ Attendance functionality working correctly")
            return True
        
        return False

    def test_grades_functionality(self):
        """Test grades recording functionality"""
        print("\n📋 TESTING GRADES FUNCTIONALITY")
        
        # Get students and subjects
        success, students = self.run_test("Get Students for Grades", "GET", "api/students", 200)
        if not success or not isinstance(students, list) or len(students) == 0:
            return False
        
        success, subjects = self.run_test("Get Subjects for Grades", "GET", "api/subjects", 200)
        if not success or not isinstance(subjects, list) or len(subjects) == 0:
            return False
        
        student = students[0]
        subject = subjects[0]
        
        # Record a grade
        grade_data = {
            "student_id": student['id'],
            "subject_id": subject['id'],
            "term": "Term 1",
            "score": 85.5,
            "grade": "A",
            "remarks": "Excellent performance",
            "recorded_by": "teacher"
        }
        
        success, response = self.run_test(
            "Record Grade",
            "POST",
            "api/grades",
            200,
            data=grade_data
        )
        
        if not success:
            return False
        
        # Get grades for the student
        success, response = self.run_test(
            "Get Student Grades",
            "GET",
            f"api/grades?student_id={student['id']}&term=Term 1",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            print("   ✅ Grades functionality working correctly")
            return True
        
        return False

    def cleanup(self):
        """Clean up test data"""
        print("\n📋 CLEANING UP TEST DATA")
        
        if self.test_student_id:
            self.run_test(
                "Delete Test Student",
                "DELETE",
                f"api/students/{self.test_student_id}",
                200
            )
        
        if self.test_staff_id:
            self.run_test(
                "Delete Test Staff",
                "DELETE",
                f"api/staff/{self.test_staff_id}",
                200
            )

def main():
    print("🚀 Starting Extended IHEZA API Tests for New Features")
    print("=" * 70)
    
    tester = ExtendedIHEZAAPITester()
    
    # Login first
    if not tester.test_login():
        print("❌ Login failed - cannot proceed with tests")
        return 1
    
    # Test edit functionalities
    student_edit_success = tester.test_student_edit_functionality()
    staff_edit_success = tester.test_staff_edit_functionality()
    
    # Test attendance functionality
    attendance_success = tester.test_attendance_functionality()
    
    # Test grades functionality
    grades_success = tester.test_grades_functionality()
    
    # Cleanup
    tester.cleanup()
    
    # Print results
    print("\n" + "=" * 70)
    print("📊 EXTENDED TEST RESULTS SUMMARY")
    print("=" * 70)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    print("\n🎯 FEATURE TEST RESULTS:")
    print(f"   Student Edit: {'✅ PASS' if student_edit_success else '❌ FAIL'}")
    print(f"   Staff Edit: {'✅ PASS' if staff_edit_success else '❌ FAIL'}")
    print(f"   Attendance: {'✅ PASS' if attendance_success else '❌ FAIL'}")
    print(f"   Grades: {'✅ PASS' if grades_success else '❌ FAIL'}")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for test in tester.failed_tests:
            error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
            print(f"   • {test['name']}: {error_msg}")
    
    # Return success if all feature tests pass
    all_features_pass = all([student_edit_success, staff_edit_success, attendance_success, grades_success])
    
    if all_features_pass:
        print("\n🎉 All feature tests passed!")
        return 0
    else:
        print("\n💥 Some feature tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())