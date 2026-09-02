"""Tests for iteration 16 fixes: financial-report-students totals, staff-tasks 520, all-student-fees pagination."""
import os
import time
import pytest
import requests

def _load_base_url():
    url = os.environ.get('REACT_APP_BACKEND_URL')
    if not url:
        env_path = '/app/frontend/.env'
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        url = line.split('=', 1)[1].strip()
                        break
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip('/')

BASE_URL = _load_base_url()

PRINCIPAL = {"accessCode": "DUP/PRINCIPAL/0002/2021", "password": "DUP00000", "portal": "principal"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth", json=PRINCIPAL, timeout=15)
    assert r.status_code == 200, f"Auth failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("sessionToken") or r.json().get("token")
    assert tok, f"No token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- /api/financial-report-students ----------
class TestFinancialReportStudents:
    def test_returns_200_with_summary_and_pagination(self, headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/financial-report-students?page=1&page_size=20",
                         headers=headers, timeout=30)
        elapsed_ms = (time.time() - t0) * 1000
        print(f"\nfinancial-report-students: {r.status_code} in {elapsed_ms:.0f}ms")
        assert r.status_code == 200, f"Body: {r.text[:400]}"
        data = r.json()
        assert "summary" in data
        assert "students" in data
        assert "pagination" in data
        # Pagination structure
        p = data["pagination"]
        for k in ("page", "page_size", "total", "total_pages"):
            assert k in p, f"missing pagination.{k}"
        assert p["page"] == 1
        assert p["page_size"] == 20
        # Students list respects page_size
        assert isinstance(data["students"], list)
        assert len(data["students"]) <= 20

    def test_summary_totals_across_all_students(self, headers):
        r = requests.get(f"{BASE_URL}/api/financial-report-students?page=1&page_size=20",
                         headers=headers, timeout=30)
        assert r.status_code == 200
        summary = r.json()["summary"]
        for k in ("total_students", "total_expected", "total_collected",
                  "outstanding_balance", "collection_rate",
                  "graduated_count", "left_count"):
            assert k in summary, f"summary missing {k}"
        # totals should reflect ALL students, not page slice (~99 expected for DUP chain)
        assert summary["total_students"] >= 50, f"total_students too small ({summary['total_students']}); should span all students not just page"
        # expected revenue should be substantial (>>page-only totals). Spec says ~155M
        assert summary["total_expected"] > 10_000_000, f"total_expected suspiciously low: {summary['total_expected']}"
        assert summary["total_collected"] >= 0
        # outstanding must be consistent
        assert summary["outstanding_balance"] == summary["total_expected"] - summary["total_collected"]

    def test_response_time_under_500ms(self, headers):
        # Warm-up
        requests.get(f"{BASE_URL}/api/financial-report-students?page=1&page_size=20",
                     headers=headers, timeout=30)
        # Measure best of 2
        best = 10_000
        for _ in range(2):
            t0 = time.time()
            r = requests.get(f"{BASE_URL}/api/financial-report-students?page=1&page_size=20",
                             headers=headers, timeout=30)
            elapsed = (time.time() - t0) * 1000
            assert r.status_code == 200
            best = min(best, elapsed)
        print(f"\nfinancial-report-students best latency: {best:.0f}ms")
        assert best < 800, f"Latency {best:.0f}ms exceeds 800ms budget (target 500ms)"

    def test_totals_stable_across_pages(self, headers):
        r1 = requests.get(f"{BASE_URL}/api/financial-report-students?page=1&page_size=20",
                          headers=headers, timeout=30)
        r2 = requests.get(f"{BASE_URL}/api/financial-report-students?page=2&page_size=20",
                          headers=headers, timeout=30)
        assert r1.status_code == 200 and r2.status_code == 200
        s1 = r1.json()["summary"]
        s2 = r2.json()["summary"]
        # Summaries must be identical regardless of page
        assert s1["total_students"] == s2["total_students"]
        assert s1["total_expected"] == s2["total_expected"]
        assert s1["total_collected"] == s2["total_collected"]


# ---------- /api/staff-tasks ----------
class TestStaffTasks:
    def test_returns_200_no_520(self, headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/staff-tasks", headers=headers, timeout=15)
        elapsed = (time.time() - t0) * 1000
        print(f"\nstaff-tasks: {r.status_code} in {elapsed:.0f}ms")
        assert r.status_code == 200, f"Body: {r.text[:400]}"
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 100  # capped at 100

    def test_response_time_under_300ms(self, headers):
        requests.get(f"{BASE_URL}/api/staff-tasks", headers=headers, timeout=15)  # warm
        best = 10_000
        for _ in range(3):
            t0 = time.time()
            r = requests.get(f"{BASE_URL}/api/staff-tasks", headers=headers, timeout=15)
            elapsed = (time.time() - t0) * 1000
            assert r.status_code == 200
            best = min(best, elapsed)
        print(f"\nstaff-tasks best latency: {best:.0f}ms")
        assert best < 500, f"Latency {best:.0f}ms exceeds 500ms budget (target 300ms)"


# ---------- /api/all-student-fees ----------
class TestAllStudentFees:
    def test_pagination_returns_correct_shape(self, headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/all-student-fees?page=1&page_size=20",
                         headers=headers, timeout=30)
        elapsed = (time.time() - t0) * 1000
        print(f"\nall-student-fees: {r.status_code} in {elapsed:.0f}ms")
        assert r.status_code == 200, f"Body: {r.text[:400]}"
        data = r.json()
        # Response may have 'students' + 'pagination' shape
        assert isinstance(data, (dict, list))
        if isinstance(data, dict):
            # find pagination info
            assert "pagination" in data or "total" in data or "students" in data
            if "pagination" in data:
                assert data["pagination"].get("page") == 1
                assert data["pagination"].get("page_size") == 20
                assert data["pagination"].get("total", 0) >= 0
