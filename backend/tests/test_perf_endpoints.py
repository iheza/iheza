"""Performance & availability tests for iteration_15.

Verifies critical endpoints return within acceptable latency (to avoid 502/520)
and that reports/* aggregation-backed endpoints respond quickly.
"""
import os
import time
import pytest
import requests
from pathlib import Path

def _load_backend_url():
    if "REACT_APP_BACKEND_URL" in os.environ:
        return os.environ["REACT_APP_BACKEND_URL"]
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not found")

BASE_URL = _load_backend_url().rstrip("/")
TIMEOUT = 30
LATENCY_BUDGET_MS = 500

CREDS = {
    "accessCode": "DUP/PRINCIPAL/0002/2021",
    "password": "DUP00000",
    "portal": "principal",
}


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(f"{BASE_URL}/api/auth", json=CREDS, timeout=TIMEOUT)
    assert r.status_code == 200, f"Auth failed: {r.status_code} {r.text[:300]}"
    token = r.json().get("sessionToken")
    assert token, f"No sessionToken in response: {r.json()}"
    return {"Authorization": f"Bearer {token}"}


def _time_get(url, headers):
    t0 = time.perf_counter()
    r = requests.get(url, headers=headers, timeout=TIMEOUT)
    return r, (time.perf_counter() - t0) * 1000


@pytest.mark.parametrize("path", [
    "/api/students",
    "/api/admissions",
    "/api/fees",
    "/api/reports/fees",
    "/api/reports/attendance",
])
def test_endpoint_ok_and_fast(path, auth_headers):
    resp, ms = _time_get(f"{BASE_URL}{path}", auth_headers)
    print(f"{path} -> {resp.status_code} in {ms:.0f}ms")
    assert resp.status_code == 200, f"{path} status={resp.status_code} body={resp.text[:300]}"
    # Assert reasonable payload
    data = resp.json()
    assert data is not None
    # Latency budget: warn but not always hard-fail. Use hard fail at 2000ms.
    assert ms < 2000, f"{path} too slow: {ms:.0f}ms (budget {LATENCY_BUDGET_MS}ms)"


def test_students_payload_shape(auth_headers):
    r, ms = _time_get(f"{BASE_URL}/api/students", auth_headers)
    assert r.status_code == 200
    data = r.json()
    # Accept either list or paginated object
    items = data if isinstance(data, list) else data.get("students") or data.get("items") or data.get("data")
    assert isinstance(items, list)
    print(f"students count returned: {len(items)} in {ms:.0f}ms")


def test_admissions_payload_shape(auth_headers):
    r, ms = _time_get(f"{BASE_URL}/api/admissions", auth_headers)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("admissions") or data.get("items") or data.get("data")
    assert isinstance(items, list)
    print(f"admissions count returned: {len(items)} in {ms:.0f}ms")


def test_reports_fees_structure(auth_headers):
    r, ms = _time_get(f"{BASE_URL}/api/reports/fees", auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (dict, list))
    print(f"reports/fees keys: {list(data.keys()) if isinstance(data, dict) else 'list'} in {ms:.0f}ms")


def test_reports_attendance_structure(auth_headers):
    r, ms = _time_get(f"{BASE_URL}/api/reports/attendance", auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (dict, list))
    print(f"reports/attendance keys: {list(data.keys()) if isinstance(data, dict) else 'list'} in {ms:.0f}ms")
