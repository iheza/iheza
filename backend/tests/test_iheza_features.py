"""
IHEZA School Management System - Feature Tests
Tests for student import, fee management, login, and portal features
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://build-app-now-34.preview.emergentagent.com')

class TestStudentLogin:
    """Test student login functionality"""
    
    def test_student_login_dup_stu0078_2016(self):
        """Test login for student DUP/STU0078/2016"""
        response = requests.post(f"{BASE_URL}/api/auth", json={
            "accessCode": "DUP/STU0078/2016",
            "password": "student123",
            "portal": "student"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["user"]["accessCode"] == "DUP/STU0078/2016"
        assert data["user"]["firstName"] == "LUQMAN"
        assert data["user"]["role"] == "student"
        assert "sessionToken" in data
        print(f"PASS: Student DUP/STU0078/2016 login successful")
    
    def test_student_login_dup_stu0091_2015(self):
        """Test login for student DUP/STU0091/2015"""
        response = requests.post(f"{BASE_URL}/api/auth", json={
            "accessCode": "DUP/STU0091/2015",
            "password": "student123",
            "portal": "student"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["user"]["accessCode"] == "DUP/STU0091/2015"
        assert data["user"]["firstName"] == "FAHEEM"
        print(f"PASS: Student DUP/STU0091/2015 login successful")
    
    def test_student_login_invalid_password(self):
        """Test login with invalid password"""
        response = requests.post(f"{BASE_URL}/api/auth", json={
            "accessCode": "DUP/STU0078/2016",
            "password": "wrongpassword",
            "portal": "student"
        })
        assert response.status_code == 401
        print(f"PASS: Invalid password rejected correctly")


class TestStaffLogin:
    """Test staff login functionality"""
    
    def test_secretary_login(self):
        """Test secretary login"""
        response = requests.post(f"{BASE_URL}/api/auth", json={
            "accessCode": "DUP/SECRETARY/001/2026",
            "password": "secretary123",
            "portal": "secretary"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["user"]["role"] == "secretary"
        print(f"PASS: Secretary login successful")
    
    def test_teacher_login(self):
        """Test teacher login"""
        response = requests.post(f"{BASE_URL}/api/auth", json={
            "accessCode": "DUP/TEACHER/001/2026",
            "password": "teacher123",
            "portal": "teacher"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["user"]["role"] == "teacher"
        print(f"PASS: Teacher login successful")


class TestStudentsAPI:
    """Test students API endpoints"""
    
    def test_get_all_students(self):
        """Test getting all students - should return 103+ students"""
        response = requests.get(f"{BASE_URL}/api/students")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least 103 imported students
        assert len(data) >= 103
        print(f"PASS: Retrieved {len(data)} students (expected >= 103)")
    
    def test_students_have_correct_classes(self):
        """Test that students are assigned to correct classes"""
        response = requests.get(f"{BASE_URL}/api/students")
        assert response.status_code == 200
        data = response.json()
        
        # Count students by class
        class_counts = {}
        for student in data:
            class_name = student.get("class_name", "Unknown")
            class_counts[class_name] = class_counts.get(class_name, 0) + 1
        
        # Expected class distribution
        expected_classes = ["GRADE 4A", "GRADE 4B", "GRADE 5A", "GRADE 5B", "GRADE 6A", "GRADE 6B", "GRADE 7"]
        for cls in expected_classes:
            assert cls in class_counts, f"Class {cls} not found"
            print(f"  {cls}: {class_counts[cls]} students")
        
        print(f"PASS: Students distributed across expected classes")


class TestClassesAPI:
    """Test classes API endpoints"""
    
    def test_get_classes(self):
        """Test getting all classes"""
        response = requests.get(f"{BASE_URL}/api/classes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check for expected classes
        class_names = [c.get("name") for c in data]
        expected = ["GRADE 4A", "GRADE 4B", "GRADE 5A", "GRADE 5B", "GRADE 6A", "GRADE 6B", "GRADE 7"]
        for cls in expected:
            assert cls in class_names, f"Class {cls} not found"
        
        print(f"PASS: All expected classes found: {expected}")


class TestFinancialReport:
    """Test financial report API"""
    
    def test_financial_report_totals(self):
        """Test financial report returns correct totals"""
        response = requests.get(f"{BASE_URL}/api/financial-report")
        assert response.status_code == 200
        data = response.json()
        
        # Check expected values
        assert "total_expected" in data
        assert "total_collected" in data
        assert "total_students" in data
        assert "collection_rate" in data
        
        # Verify expected revenue is TZS 154,157,500
        assert data["total_expected"] == 154157500, f"Expected 154157500, got {data['total_expected']}"
        
        # Verify collected amount is TZS 34,826,000
        assert data["total_collected"] == 34826000, f"Expected 34826000, got {data['total_collected']}"
        
        # Verify collection rate is approximately 22.59%
        assert 22 <= data["collection_rate"] <= 23, f"Expected ~22.59%, got {data['collection_rate']}%"
        
        print(f"PASS: Financial report totals correct")
        print(f"  Total Expected: TZS {data['total_expected']:,}")
        print(f"  Total Collected: TZS {data['total_collected']:,}")
        print(f"  Collection Rate: {data['collection_rate']}%")


class TestAllStudentFees:
    """Test all student fees API"""
    
    def test_all_student_fees_endpoint(self):
        """Test all-student-fees endpoint returns fee data"""
        response = requests.get(f"{BASE_URL}/api/all-student-fees")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should have fee records for students
        assert len(data) > 0
        
        # Check structure of fee records
        if len(data) > 0:
            record = data[0]
            assert "id" in record
            assert "name" in record
            assert "total_fee" in record
            assert "paid" in record
            assert "outstanding" in record
            assert "status" in record
        
        print(f"PASS: Retrieved {len(data)} student fee records")


class TestFeeStructures:
    """Test fee structures API"""
    
    def test_get_fee_structures(self):
        """Test getting fee structures"""
        response = requests.get(f"{BASE_URL}/api/fee-structures")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should have at least one fee structure
        assert len(data) >= 1
        
        # Check structure
        if len(data) > 0:
            structure = data[0]
            assert "name" in structure
            assert "amount" in structure
        
        print(f"PASS: Retrieved {len(data)} fee structures")


class TestPayments:
    """Test payments API"""
    
    def test_get_payments(self):
        """Test getting payments"""
        response = requests.get(f"{BASE_URL}/api/payments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should have payment records from import
        assert len(data) > 0
        
        print(f"PASS: Retrieved {len(data)} payment records")


class TestStudentFeesSummary:
    """Test individual student fee summary"""
    
    def test_student_fee_summary(self):
        """Test getting fee summary for a specific student"""
        # First get a student ID
        students_response = requests.get(f"{BASE_URL}/api/students")
        students = students_response.json()
        
        if len(students) > 0:
            student_id = students[0]["id"]
            response = requests.get(f"{BASE_URL}/api/student-fees/{student_id}")
            assert response.status_code == 200
            data = response.json()
            
            assert "student" in data
            assert "total_fees" in data
            assert "total_paid" in data
            assert "balance" in data
            assert "status" in data
            
            print(f"PASS: Student fee summary retrieved successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
