"""
Test QR Attendance Flow - IHEZA School Management System
Tests:
1. QR code verify endpoint
2. Manual attendance check-in/check-out API
3. Staff attendance today endpoint
4. Login flow for Principal portal
5. PWA manifest.json accessibility
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://build-app-now-34.preview.emergentagent.com')

# Test credentials from review request
PRINCIPAL_CREDENTIALS = {
    "accessCode": "DUP/PRINCIPAL/0002/2021",
    "password": "DUP00000",
    "portal": "principal"
}

TEACHER_CREDENTIALS = {
    "accessCode": "DUP/TEACHER/0001/2024",
    "password": "DUP00000",
    "portal": "teacher"
}



class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print(f"✓ Health check passed: {data}")
    
    def test_pwa_manifest_accessible(self):
        """Test PWA manifest.json is accessible"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "IHEZA" in data.get("name", "") or "IHEZA" in data.get("short_name", "")
        print(f"✓ PWA manifest accessible: {data.get('name')}")


class TestPrincipalLogin:
    """Test Principal portal login flow"""
    
    def test_principal_login_success(self):
        """Test Principal can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth", json=PRINCIPAL_CREDENTIALS)
        
        if response.status_code == 401:
            # Principal might not exist in seed data, skip test
            print(f"⚠ Principal login returned 401 - user may not exist in seed data")
            pytest.skip("Principal user not found in database")
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "sessionToken" in data
        assert data.get("portal") == "principal"
        print(f"✓ Principal login successful: {data.get('user', {}).get('name')}")
        return data.get("sessionToken")
    
    def test_principal_login_invalid_password(self):
        """Test Principal login with wrong password"""
        bad_creds = {
            "accessCode": PRINCIPAL_CREDENTIALS["accessCode"],
            "password": "wrongpassword",
            "portal": "principal"
        }
        response = requests.post(f"{BASE_URL}/api/auth", json=bad_creds)
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected")


class TestTeacherLogin:
    """Test Teacher portal login flow"""
    
    def test_teacher_login_success(self):
        """Test Teacher can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth", json=TEACHER_CREDENTIALS)
        
        if response.status_code == 401:
            print(f"⚠ Teacher login returned 401 - user may not exist in seed data")
            pytest.skip("Teacher user not found in database")
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "sessionToken" in data
        assert data.get("portal") == "teacher"
        print(f"✓ Teacher login successful: {data.get('user', {}).get('name')}")
        return data.get("sessionToken")


class TestQRCodeVerify:
    """Test QR code verification endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth", json=TEACHER_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        # Try principal if teacher doesn't exist
        response = requests.post(f"{BASE_URL}/api/auth", json=PRINCIPAL_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        return None
    
    def test_qr_verify_valid_dup_code(self, auth_token):
        """Test QR verify with valid DUP prefix code"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/qr-codes/verify",
            json={"qr_code": "DUP-QR-ABC12345"},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == True
        assert data.get("chain") == "DUP"
        assert "school_name" in data
        print(f"✓ QR verify DUP code: valid={data.get('valid')}, school={data.get('school_name')}")
    
    def test_qr_verify_valid_iheza_code(self, auth_token):
        """Test QR verify with valid IHEZA prefix code"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/qr-codes/verify",
            json={"qr_code": "IHEZA-QR-XYZ98765"},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == True
        assert data.get("chain") == "IHEZA"
        print(f"✓ QR verify IHEZA code: valid={data.get('valid')}, school={data.get('school_name')}")
    
    def test_qr_verify_invalid_format(self, auth_token):
        """Test QR verify with invalid format"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/qr-codes/verify",
            json={"qr_code": "INVALID-CODE"},
            headers=headers
        )
        
        # Should return 400 for invalid format
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert data.get("valid") == False
        print("✓ Invalid QR format correctly handled")
    
    def test_qr_verify_unknown_prefix(self, auth_token):
        """Test QR verify with unknown school prefix"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/qr-codes/verify",
            json={"qr_code": "UNKNOWN-QR-123456"},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == False
        print(f"✓ Unknown prefix correctly rejected: {data.get('message')}")


class TestManualAttendance:
    """Test manual attendance check-in/check-out API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth", json=TEACHER_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        response = requests.post(f"{BASE_URL}/api/auth", json=PRINCIPAL_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        return None
    
    def test_qr_checkin_requires_access_code(self, auth_token):
        """Test that check-in requires access code"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr-checkin",
            json={"action": "check_in"},
            headers=headers
        )
        
        assert response.status_code == 400
        print("✓ Check-in correctly requires access code")
    
    def test_qr_checkin_invalid_access_code(self, auth_token):
        """Test check-in with invalid access code format"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr-checkin",
            json={
                "access_code": "INVALID",
                "action": "check_in",
                "qr_code": "DUP-QR-ABC12345"
            },
            headers=headers
        )
        
        assert response.status_code == 400
        print("✓ Invalid access code format correctly rejected")
    
    def test_qr_checkin_valid_teacher(self, auth_token):
        """Test check-in with valid teacher access code"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr-checkin",
            json={
                "access_code": TEACHER_CREDENTIALS["accessCode"],
                "action": "check_in",
                "qr_code": "DUP-QR-ABC12345"
            },
            headers=headers
        )
        
        # Could be 200 (success), 400 (already checked in), or 404 (user not found)
        if response.status_code == 404:
            print(f"⚠ Teacher not found in database - skipping")
            pytest.skip("Teacher user not found")
        
        if response.status_code == 400:
            data = response.json()
            # Already checked in is acceptable
            if "already" in data.get("detail", "").lower():
                print(f"✓ Teacher already checked in today")
                return
        
        assert response.status_code == 200, f"Check-in failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("action") in ["check_in", "check_out", "already_complete"]
        print(f"✓ Teacher check-in: action={data.get('action')}, time={data.get('check_in_time')}")


class TestStaffAttendanceToday:
    """Test staff attendance today endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth", json=TEACHER_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        response = requests.post(f"{BASE_URL}/api/auth", json=PRINCIPAL_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        return None
    
    def test_get_staff_attendance_today(self, auth_token):
        """Test getting today's staff attendance"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/attendance/staff-today",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Staff attendance today: {len(data)} records")
        
        # Verify record structure if any exist
        if len(data) > 0:
            record = data[0]
            assert "target_id" in record
            assert "date" in record
            print(f"  First record: target_id={record.get('target_id')}, date={record.get('date')}")
    
    def test_get_staff_attendance_with_chain_filter(self, auth_token):
        """Test getting staff attendance with chain filter"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/attendance/staff-today?chain=DUP",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All records should be for DUP chain
        for record in data:
            assert record.get("chain") == "DUP" or record.get("chain") is None
        
        print(f"✓ Staff attendance with DUP filter: {len(data)} records")


class TestUsersEndpoint:
    """Test users endpoint for staff list"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth", json=TEACHER_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        response = requests.post(f"{BASE_URL}/api/auth", json=PRINCIPAL_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        return None
    
    def test_get_users_list(self, auth_token):
        """Test getting users list"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Users list: {len(data)} users")
        
        # Verify user structure
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "first_name" in user or "firstName" in user
            assert "role" in user
            print(f"  Sample user: {user.get('first_name')} {user.get('last_name')} ({user.get('role')})")


class TestQRCodesEndpoint:
    """Test QR codes management endpoint"""
    
    @pytest.fixture
    def principal_token(self):
        """Get principal auth token"""
        response = requests.post(f"{BASE_URL}/api/auth", json=PRINCIPAL_CREDENTIALS)
        if response.status_code == 200:
            return response.json().get("sessionToken")
        return None
    
    def test_get_qr_codes_list(self, principal_token):
        """Test getting QR codes list (Principal only)"""
        if not principal_token:
            pytest.skip("Principal token not available")
        
        headers = {"Authorization": f"Bearer {principal_token}"}
        response = requests.get(f"{BASE_URL}/api/qr-codes", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ QR codes list: {len(data)} codes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
