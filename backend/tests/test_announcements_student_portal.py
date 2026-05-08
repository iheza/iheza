"""
Test suite for IHEZA School Management System - Announcements & Student Portal
Tests role-based access control for announcements and student portal features
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CREDENTIALS = {
    "secretary": {"accessCode": "DUP/SECRETARY/001/2026", "password": "secretary123", "portal": "secretary"},
    "student": {"accessCode": "DUP/STU0001/2026", "password": "student123", "portal": "student"},
    "teacher": {"accessCode": "DUP/TEACHER/001/2026", "password": "teacher123", "portal": "teacher"},
    "principal": {"accessCode": "DUP/PRINCIPAL/001/2026", "password": "principal123", "portal": "principal"},
}


class TestAuthentication:
    """Test login for all roles"""
    
    def test_secretary_login(self):
        """Secretary can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth", json=CREDENTIALS["secretary"])
        assert response.status_code == 200, f"Secretary login failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["user"]["role"] == "secretary"
        assert "sessionToken" in data
        print(f"✓ Secretary login successful - role: {data['user']['role']}")
    
    def test_student_login(self):
        """Student can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth", json=CREDENTIALS["student"])
        assert response.status_code == 200, f"Student login failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["user"]["role"] == "student"
        assert "sessionToken" in data
        print(f"✓ Student login successful - role: {data['user']['role']}")
    
    def test_teacher_login(self):
        """Teacher can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth", json=CREDENTIALS["teacher"])
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["user"]["role"] == "teacher"
        print(f"✓ Teacher login successful - role: {data['user']['role']}")
    
    def test_principal_login(self):
        """Principal can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth", json=CREDENTIALS["principal"])
        assert response.status_code == 200, f"Principal login failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["user"]["role"] == "principal"
        print(f"✓ Principal login successful - role: {data['user']['role']}")


def get_auth_token(role: str) -> str:
    """Helper to get auth token for a role"""
    response = requests.post(f"{BASE_URL}/api/auth", json=CREDENTIALS[role])
    if response.status_code == 200:
        return response.json().get("sessionToken")
    return None


class TestAnnouncementsRBAC:
    """Test role-based access control for announcements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for each role"""
        self.secretary_token = get_auth_token("secretary")
        self.student_token = get_auth_token("student")
        self.teacher_token = get_auth_token("teacher")
        self.principal_token = get_auth_token("principal")
        self.test_announcement_id = None
    
    def test_secretary_can_create_announcement(self):
        """Secretary can create announcements"""
        headers = {"Authorization": f"Bearer {self.secretary_token}"}
        announcement_data = {
            "id": str(uuid.uuid4()),
            "title": f"TEST_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "This is a test announcement created by secretary",
            "announcement_type": "general",
            "priority": "normal",
            "chain": "DUP",
            "created_by": "test_secretary",
            "created_by_name": "Test Secretary",
            "status": "published"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        assert response.status_code == 200, f"Secretary create announcement failed: {response.text}"
        data = response.json()
        assert data["title"] == announcement_data["title"]
        self.__class__.test_announcement_id = data["id"]
        print(f"✓ Secretary created announcement: {data['title']}")
        return data["id"]
    
    def test_secretary_can_view_announcements(self):
        """Secretary can view announcements"""
        headers = {"Authorization": f"Bearer {self.secretary_token}"}
        response = requests.get(f"{BASE_URL}/api/announcements", headers=headers)
        assert response.status_code == 200, f"Secretary view announcements failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Secretary can view announcements - count: {len(data)}")
    
    def test_student_can_view_announcements(self):
        """Student can view announcements (read-only)"""
        headers = {"Authorization": f"Bearer {self.student_token}"}
        response = requests.get(f"{BASE_URL}/api/announcements", headers=headers)
        assert response.status_code == 200, f"Student view announcements failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Student can view announcements - count: {len(data)}")
    
    def test_teacher_can_view_announcements(self):
        """Teacher can view announcements (read-only)"""
        headers = {"Authorization": f"Bearer {self.teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/announcements", headers=headers)
        assert response.status_code == 200, f"Teacher view announcements failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Teacher can view announcements - count: {len(data)}")
    
    def test_principal_can_view_announcements(self):
        """Principal can view announcements (read-only)"""
        headers = {"Authorization": f"Bearer {self.principal_token}"}
        response = requests.get(f"{BASE_URL}/api/announcements", headers=headers)
        assert response.status_code == 200, f"Principal view announcements failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Principal can view announcements - count: {len(data)}")
    
    def test_student_cannot_create_announcement(self):
        """Student cannot create announcements (should be forbidden)"""
        headers = {"Authorization": f"Bearer {self.student_token}"}
        announcement_data = {
            "id": str(uuid.uuid4()),
            "title": "TEST_Student_Announcement",
            "content": "This should fail",
            "announcement_type": "general",
            "priority": "normal",
            "chain": "DUP",
            "created_by": "test_student",
            "status": "published"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        # Student should get 403 Forbidden
        assert response.status_code == 403, f"Student should not be able to create announcements, got: {response.status_code}"
        print(f"✓ Student correctly denied from creating announcements (403)")
    
    def test_teacher_cannot_create_announcement(self):
        """Teacher cannot create announcements (should be forbidden)"""
        headers = {"Authorization": f"Bearer {self.teacher_token}"}
        announcement_data = {
            "id": str(uuid.uuid4()),
            "title": "TEST_Teacher_Announcement",
            "content": "This should fail",
            "announcement_type": "general",
            "priority": "normal",
            "chain": "DUP",
            "created_by": "test_teacher",
            "status": "published"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        # Teacher should get 403 Forbidden
        assert response.status_code == 403, f"Teacher should not be able to create announcements, got: {response.status_code}"
        print(f"✓ Teacher correctly denied from creating announcements (403)")
    
    def test_secretary_can_edit_announcement(self):
        """Secretary can edit announcements"""
        # First create an announcement
        headers = {"Authorization": f"Bearer {self.secretary_token}"}
        announcement_data = {
            "id": str(uuid.uuid4()),
            "title": f"TEST_Edit_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "Original content",
            "announcement_type": "general",
            "priority": "normal",
            "chain": "DUP",
            "created_by": "test_secretary",
            "status": "published"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        assert create_response.status_code == 200
        announcement_id = create_response.json()["id"]
        
        # Now edit it
        update_data = {"content": "Updated content by secretary"}
        update_response = requests.put(
            f"{BASE_URL}/api/announcements/{announcement_id}",
            json=update_data,
            headers=headers
        )
        assert update_response.status_code == 200, f"Secretary edit announcement failed: {update_response.text}"
        data = update_response.json()
        assert data["content"] == "Updated content by secretary"
        print(f"✓ Secretary can edit announcements")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/announcements/{announcement_id}", headers=headers)
    
    def test_student_cannot_edit_announcement(self):
        """Student cannot edit announcements"""
        # First create an announcement as secretary
        sec_headers = {"Authorization": f"Bearer {self.secretary_token}"}
        announcement_data = {
            "id": str(uuid.uuid4()),
            "title": f"TEST_NoEdit_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "Original content",
            "announcement_type": "general",
            "priority": "normal",
            "chain": "DUP",
            "created_by": "test_secretary",
            "status": "published"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=sec_headers
        )
        assert create_response.status_code == 200
        announcement_id = create_response.json()["id"]
        
        # Try to edit as student
        stu_headers = {"Authorization": f"Bearer {self.student_token}"}
        update_data = {"content": "Student trying to edit"}
        update_response = requests.put(
            f"{BASE_URL}/api/announcements/{announcement_id}",
            json=update_data,
            headers=stu_headers
        )
        assert update_response.status_code == 403, f"Student should not be able to edit announcements, got: {update_response.status_code}"
        print(f"✓ Student correctly denied from editing announcements (403)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/announcements/{announcement_id}", headers=sec_headers)
    
    def test_secretary_can_delete_announcement(self):
        """Secretary can delete announcements"""
        headers = {"Authorization": f"Bearer {self.secretary_token}"}
        announcement_data = {
            "id": str(uuid.uuid4()),
            "title": f"TEST_Delete_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "To be deleted",
            "announcement_type": "general",
            "priority": "normal",
            "chain": "DUP",
            "created_by": "test_secretary",
            "status": "published"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=headers
        )
        assert create_response.status_code == 200
        announcement_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/announcements/{announcement_id}",
            headers=headers
        )
        assert delete_response.status_code == 200, f"Secretary delete announcement failed: {delete_response.text}"
        print(f"✓ Secretary can delete announcements")
    
    def test_student_cannot_delete_announcement(self):
        """Student cannot delete announcements"""
        # First create an announcement as secretary
        sec_headers = {"Authorization": f"Bearer {self.secretary_token}"}
        announcement_data = {
            "id": str(uuid.uuid4()),
            "title": f"TEST_NoDelete_Announcement_{uuid.uuid4().hex[:8]}",
            "content": "Should not be deleted by student",
            "announcement_type": "general",
            "priority": "normal",
            "chain": "DUP",
            "created_by": "test_secretary",
            "status": "published"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/announcements",
            json=announcement_data,
            headers=sec_headers
        )
        assert create_response.status_code == 200
        announcement_id = create_response.json()["id"]
        
        # Try to delete as student
        stu_headers = {"Authorization": f"Bearer {self.student_token}"}
        delete_response = requests.delete(
            f"{BASE_URL}/api/announcements/{announcement_id}",
            headers=stu_headers
        )
        assert delete_response.status_code == 403, f"Student should not be able to delete announcements, got: {delete_response.status_code}"
        print(f"✓ Student correctly denied from deleting announcements (403)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/announcements/{announcement_id}", headers=sec_headers)


class TestStudentPortalEndpoints:
    """Test student portal API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup student token"""
        self.student_token = get_auth_token("student")
    
    def test_student_my_tasks_endpoint(self):
        """Student can access my-tasks endpoint"""
        headers = {"Authorization": f"Bearer {self.student_token}"}
        response = requests.get(f"{BASE_URL}/api/student-portal/my-tasks", headers=headers)
        assert response.status_code == 200, f"Student my-tasks failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Student can access my-tasks - count: {len(data)}")
    
    def test_student_my_report_cards_endpoint(self):
        """Student can access my-report-cards endpoint"""
        headers = {"Authorization": f"Bearer {self.student_token}"}
        response = requests.get(f"{BASE_URL}/api/student-portal/my-report-cards", headers=headers)
        assert response.status_code == 200, f"Student my-report-cards failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Student can access my-report-cards - count: {len(data)}")
    
    def test_student_my_fees_endpoint(self):
        """Student can access my-fees endpoint"""
        headers = {"Authorization": f"Bearer {self.student_token}"}
        response = requests.get(f"{BASE_URL}/api/student-portal/my-fees", headers=headers)
        assert response.status_code == 200, f"Student my-fees failed: {response.text}"
        data = response.json()
        # Check expected fields
        assert "total_fees" in data or "fee_structures" in data
        print(f"✓ Student can access my-fees")
    
    def test_student_my_announcements_endpoint(self):
        """Student can access my-announcements endpoint"""
        headers = {"Authorization": f"Bearer {self.student_token}"}
        response = requests.get(f"{BASE_URL}/api/student-portal/my-announcements", headers=headers)
        assert response.status_code == 200, f"Student my-announcements failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Student can access my-announcements - count: {len(data)}")
    
    def test_student_my_info_endpoint(self):
        """Student can access my-info endpoint"""
        headers = {"Authorization": f"Bearer {self.student_token}"}
        response = requests.get(f"{BASE_URL}/api/student-portal/my-info", headers=headers)
        assert response.status_code == 200, f"Student my-info failed: {response.text}"
        data = response.json()
        assert "first_name" in data or "admission_no" in data
        print(f"✓ Student can access my-info")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_announcements(self):
        """Remove test announcements"""
        token = get_auth_token("secretary")
        if not token:
            pytest.skip("Could not get secretary token for cleanup")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/announcements", headers=headers)
        
        if response.status_code == 200:
            announcements = response.json()
            deleted = 0
            for ann in announcements:
                if ann.get("title", "").startswith("TEST_"):
                    del_response = requests.delete(
                        f"{BASE_URL}/api/announcements/{ann['id']}",
                        headers=headers
                    )
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"✓ Cleaned up {deleted} test announcements")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
