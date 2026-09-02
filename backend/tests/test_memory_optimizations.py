"""Tests for P0 memory optimizations: pagination, counts_only sync, route shadowing fix, staff-tasks task_status param."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://build-app-now-34.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DUP_PRINCIPAL = {"accessCode": "DUP/PRINCIPAL/0002/2021", "password": "DUP00000", "portal": "principal"}


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def principal_token(session):
    r = session.post(f"{API}/auth", json=DUP_PRINCIPAL, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("sessionToken") or data.get("token") or data.get("access_token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="session")
def auth_session(session, principal_token):
    session.headers.update({"Authorization": f"Bearer {principal_token}"})
    return session


# ---------- Health ----------
def test_health_endpoint(session):
    r = session.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") in ("healthy", "ok")


# ---------- Route shadowing fix: /users/chains must return list, not 404/attempt to be user_id ----------
def test_users_chains_no_route_shadowing(session):
    r = session.get(f"{API}/users/chains", timeout=15)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
    data = r.json()
    assert isinstance(data, list), f"Expected list, got {type(data)}"


# ---------- Sync endpoint with counts_only=true ----------
def test_sync_counts_only(auth_session):
    r = auth_session.get(f"{API}/sync?counts_only=true", timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
    data = r.json()
    # Must be counts (ints), NOT arrays
    for key in ("users", "students", "classes", "subjects"):
        assert key in data, f"Missing {key}"
        assert isinstance(data[key], int), f"{key} should be int count in counts_only mode, got {type(data[key])}"
    assert "synced_at" in data


def test_sync_full_mode_returns_arrays(auth_session):
    r = auth_session.get(f"{API}/sync?page=1&page_size=50", timeout=60)
    assert r.status_code == 200
    data = r.json()
    for key in ("users", "students", "classes", "subjects"):
        assert isinstance(data[key], list), f"{key} should be list in full mode"
    assert "pagination" in data


def test_sync_page_size_capped(auth_session):
    # page_size should cap at 1000
    r = auth_session.get(f"{API}/sync?page_size=99999", timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert data["pagination"]["page_size"] <= 1000


# ---------- staff-tasks task_status param (renamed from status) ----------
def test_staff_tasks_task_status_param(auth_session):
    r = auth_session.get(f"{API}/staff-tasks?task_status=pending", timeout=15)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    assert isinstance(r.json(), list)


def test_staff_tasks_no_filter(auth_session):
    r = auth_session.get(f"{API}/staff-tasks", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Login flow ----------
def test_dup_principal_login(session):
    r = session.post(f"{API}/auth", json=DUP_PRINCIPAL, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert (data.get("sessionToken") or data.get("token") or data.get("access_token"))
    user = data.get("user", {})
    assert user.get("role", "").lower() == "principal" or "principal" in str(data).lower()
