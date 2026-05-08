"""
Test cases for Student Portal fixes:
1. My Fees tab shows correct total fees from student_fees collection (secretary-edited amount)
2. Report Cards endpoint returns proper data for DOCX export
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://build-app-now-34.preview.emergentagent.com')

# Test student credentials
STUDENT_ADMISSION_NO = "DUP/STU0078/2016"
EXPECTED_TOTAL_FEES = 2500000.0  # Secretary-edited amount from student_fees collection
FEE_STRUCTURES_TOTAL = 1575000  # Base fee structures total (should NOT be used for total)


class TestStudentPortalMyFees:
    """Test My Fees endpoint returns correct total from student_fees collection"""
    
    @pytest.fixture
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth",
            json={
                "accessCode": STUDENT_ADMISSION_NO,
                "password": "",
                "portal": "student"
            }
        )
        assert response.status_code == 200, f"Student login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        return data.get("sessionToken")
    
    def test_student_login_success(self, student_token):
        """Test student can login with admission number (no password required)"""
        assert student_token is not None
        assert len(student_token) > 0
        print(f"SUCCESS: Student login successful, token received")
    
    def test_my_fees_returns_correct_total(self, student_token):
        """Test that my-fees endpoint returns total from student_fees collection (2,500,000)"""
        response = requests.get(
            f"{BASE_URL}/api/student-portal/my-fees",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200, f"My fees request failed: {response.text}"
        
        data = response.json()
        
        # Verify total_fees is from student_fees collection (secretary-edited amount)
        total_fees = data.get("total_fees", 0)
        assert total_fees == EXPECTED_TOTAL_FEES, \
            f"Expected total_fees={EXPECTED_TOTAL_FEES}, got {total_fees}. " \
            f"If {FEE_STRUCTURES_TOTAL}, endpoint is incorrectly using fee_structures instead of student_fees"
        
        print(f"SUCCESS: Total fees = TZS {total_fees:,.0f} (correct from student_fees)")
        
        # Verify other fields exist
        assert "total_paid" in data
        assert "balance" in data
        assert "status" in data
        assert "fee_structures" in data
        assert "payments" in data
        
        # Verify balance calculation
        expected_balance = total_fees - data.get("total_paid", 0)
        assert data.get("balance") == expected_balance, \
            f"Balance calculation incorrect: expected {expected_balance}, got {data.get('balance')}"
        
        print(f"SUCCESS: Balance = TZS {data.get('balance'):,.0f}")
        print(f"SUCCESS: Status = {data.get('status')}")


class TestStudentPortalReportCards:
    """Test Report Cards endpoint returns proper data for DOCX export"""
    
    @pytest.fixture
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth",
            json={
                "accessCode": STUDENT_ADMISSION_NO,
                "password": "",
                "portal": "student"
            }
        )
        assert response.status_code == 200
        return response.json().get("sessionToken")
    
    def test_my_report_cards_endpoint(self, student_token):
        """Test that my-report-cards endpoint returns report card data"""
        response = requests.get(
            f"{BASE_URL}/api/student-portal/my-report-cards",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200, f"Report cards request failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of report cards"
        
        if len(data) > 0:
            report_card = data[0]
            
            # Verify required fields for DOCX export
            assert "term" in report_card, "Missing 'term' field"
            assert "academic_year" in report_card, "Missing 'academic_year' field"
            
            # Verify grades array exists (needed for exportReportCard)
            assert "grades" in report_card, "Missing 'grades' field"
            
            # Verify behavior marks exist
            behavior_fields = ["neatness", "cooperation", "responsibility", "punctuality", "discipline"]
            for field in behavior_fields:
                assert field in report_card, f"Missing behavior field: {field}"
            
            print(f"SUCCESS: Report card found for {report_card.get('term')} {report_card.get('academic_year')}")
            print(f"SUCCESS: Grades count = {len(report_card.get('grades', []))}")
            print(f"SUCCESS: Average = {report_card.get('average')}")
            print(f"SUCCESS: Position = {report_card.get('position')}/{report_card.get('total_students')}")
        else:
            print("INFO: No report cards found for this student")


class TestHealthAndAuth:
    """Basic health and auth tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print("SUCCESS: Health endpoint OK, database connected")
    
    def test_student_login_with_invalid_admission_no(self):
        """Test that invalid admission number is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/auth",
            json={
                "accessCode": "INVALID/STU0000/2020",
                "password": "",
                "portal": "student"
            }
        )
        assert response.status_code in [400, 401], \
            f"Expected 400/401 for invalid admission number, got {response.status_code}"
        print("SUCCESS: Invalid admission number correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
