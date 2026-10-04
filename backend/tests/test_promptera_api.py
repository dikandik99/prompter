"""PROMPTERA backend API test suite.

Covers: health/config, auth (register/login/me), pricing, subscription flows,
AI gateway (disabled), analytics event allowlist.
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load frontend .env for EXPO_PUBLIC_BACKEND_URL (public URL used by the app)
load_dotenv(Path("/app/frontend/.env"))
BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE, "EXPO_PUBLIC_BACKEND_URL not set"
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_user(client):
    """Register a fresh unique user and return token+email+id."""
    email = f"test_{uuid.uuid4().hex[:10]}@promptera.app"
    password = "secret123"
    r = client.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "Pytest User"})
    assert r.status_code == 201, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": password, "token": data["access_token"], "user": data["user"]}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- health / config ----------------
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        body = r.json()
        assert body["app"] == "PROMPTERA"
        assert body["status"] == "ok"

    def test_config_ai_disabled(self, client):
        r = client.get(f"{API}/config")
        assert r.status_code == 200
        body = r.json()
        assert body["ai_enabled"] is False
        assert body["default_country"] == "ID"
        assert body["default_language"] == "id"


# ---------------- auth ----------------
class TestAuth:
    def test_register_returns_token_and_user(self, test_user):
        assert test_user["token"]
        assert test_user["user"]["email"] == test_user["email"]
        assert "id" in test_user["user"]

    def test_duplicate_register_returns_409(self, client, test_user):
        r = client.post(f"{API}/auth/register", json={"email": test_user["email"], "password": "anotherpass"})
        assert r.status_code == 409

    def test_login_success(self, client, test_user):
        r = client.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]})
        assert r.status_code == 200
        data = r.json()
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == test_user["email"]

    def test_login_wrong_password_401(self, client, test_user):
        r = client.post(f"{API}/auth/login", json={"email": test_user["email"], "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_without_token_401(self, client):
        r = client.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token_401(self, client):
        r = client.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
        assert r.status_code == 401

    def test_me_with_token_returns_entitlement(self, client, test_user):
        r = client.get(f"{API}/auth/me", headers=auth_headers(test_user["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == test_user["email"]
        assert "entitlement" in body
        assert body["entitlement"]["plan"] == "free"


# ---------------- pricing ----------------
class TestPricing:
    def test_pricing_id_idr(self, client):
        r = client.get(f"{API}/pricing", params={"country": "ID"})
        assert r.status_code == 200
        data = r.json()
        assert data["currency"] == "IDR"
        assert data["symbol"] == "Rp"
        plans = {p["id"]: p for p in data["plans"]}
        assert plans["pro_monthly"]["price_display"] == "Rp249.000"
        assert plans["pro_yearly"]["price_display"] == "Rp1.199.000"
        assert plans["pro_yearly"]["best_value"] is True
        assert plans["pro_yearly"]["monthly_equivalent"] == "Rp99.917"
        assert plans["pro_yearly"]["savings_pct"] > 0
        # providers include midtrans for ID
        assert "midtrans" in data["providers"]
        # features list present
        assert isinstance(data["features"], list) and len(data["features"]) >= 5

    def test_pricing_us_usd(self, client):
        r = client.get(f"{API}/pricing", params={"country": "US"})
        assert r.status_code == 200
        data = r.json()
        assert data["currency"] == "USD"
        assert data["symbol"] == "$"
        plans = {p["id"]: p for p in data["plans"]}
        assert plans["pro_monthly"]["price_display"].startswith("$")
        assert plans["pro_yearly"]["best_value"] is True


# ---------------- subscription ----------------
class TestSubscription:
    def test_sub_me_default_free(self, client, test_user):
        r = client.get(f"{API}/subscription/me", headers=auth_headers(test_user["token"]))
        assert r.status_code == 200
        assert r.json()["plan"] == "free"

    def test_checkout_pending(self, client, test_user):
        r = client.post(
            f"{API}/subscription/checkout",
            headers=auth_headers(test_user["token"]),
            json={"plan_id": "pro_monthly", "provider": "midtrans", "country": "ID"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "pending"
        assert body["provider"] == "midtrans"
        assert "order_id" in body
        assert "message" in body

    def test_dev_activate_then_cancel_flow(self, client, test_user):
        # Activate
        r = client.post(
            f"{API}/subscription/dev-activate",
            headers=auth_headers(test_user["token"]),
            json={"plan_id": "pro_yearly", "provider": "paypal", "country": "ID"},
        )
        assert r.status_code == 200
        ent = r.json()
        assert ent["plan"] == "pro"
        assert ent["current_period_end"] is not None

        # /auth/me reflects pro
        r2 = client.get(f"{API}/auth/me", headers=auth_headers(test_user["token"]))
        assert r2.json()["entitlement"]["plan"] == "pro"

        # Cancel sets back to free
        r3 = client.post(f"{API}/subscription/cancel", headers=auth_headers(test_user["token"]))
        assert r3.status_code == 200
        assert r3.json()["plan"] == "free"


# ---------------- AI gateway (disabled by design) ----------------
class TestAI:
    def test_translate_disabled_returns_503(self, client, test_user):
        r = client.post(
            f"{API}/ai/translate",
            headers=auth_headers(test_user["token"]),
            json={"text": "Halo dunia", "source_lang": "id", "target_lang": "en", "mode": "natural"},
        )
        assert r.status_code == 503

    def test_translate_requires_auth(self, client):
        r = client.post(
            f"{API}/ai/translate",
            json={"text": "Hi", "target_lang": "en"},
        )
        assert r.status_code == 401

    def test_usage_shows_disabled(self, client, test_user):
        r = client.get(f"{API}/ai/usage", headers=auth_headers(test_user["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["enabled"] is False
        assert body["plan"] in ("free", "pro")
        assert "used" in body and "limit" in body and "remaining" in body

    def test_languages_and_modes(self, client):
        r = client.get(f"{API}/ai/languages")
        assert r.status_code == 200
        body = r.json()
        assert len(body["languages"]) == 13
        assert len(body["modes"]) == 5


# ---------------- analytics ----------------
class TestAnalytics:
    def test_allowed_event(self, client):
        r = client.post(f"{API}/analytics/event", json={"event": "app_opened", "properties": {"src": "pytest"}})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_disallowed_event(self, client):
        r = client.post(f"{API}/analytics/event", json={"event": "evil_hack", "properties": {}})
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False
        assert body.get("reason") == "event_not_allowed"
