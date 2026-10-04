"""PayPal REST integration for PROMPTERA Pro recurring subscriptions.

Uses PayPal's REST API directly via httpx (no deprecated SDK). All credentials
come from the environment; when they are not configured every helper short
circuits so the rest of the app keeps working with the existing "needs
credentials" checkout response.

Flow (recurring):
  1. ensure_plan()      -> lazily create a Product + Billing Plan (per plan_id),
                           cached in Mongo so it is only created once.
  2. create_subscription() -> create a PayPal subscription and return its id +
                           the buyer approval URL (opened in an in-app browser).
  3. buyer approves -> PayPal redirects back to the app deep link.
  4. get_subscription() -> confirm status ACTIVE/APPROVED, then grant Pro.
  5. webhook (verify_webhook) -> reliable server-to-server activation/cancel.
"""

from __future__ import annotations

import base64
import logging
import os
import time
from typing import Any, Optional

import httpx

logger = logging.getLogger("promptera.paypal")

# ---------------------------------------------------------------------------
# Config (all from .env; nothing hardcoded)
# ---------------------------------------------------------------------------
CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "").strip()
SECRET = os.environ.get("PAYPAL_SECRET", "").strip()
ENVIRONMENT = os.environ.get("PAYPAL_ENV", "sandbox").strip().lower()
WEBHOOK_ID = os.environ.get("PAYPAL_WEBHOOK_ID", "").strip()
BRAND_NAME = os.environ.get("PAYPAL_BRAND_NAME", "PROMPTERA").strip()

# Optional pre-created plan ids (skip auto creation if provided).
PLAN_ID_ENV = {
    "pro_monthly": os.environ.get("PAYPAL_PRO_MONTHLY_PLAN_ID", "").strip(),
    "pro_yearly": os.environ.get("PAYPAL_PRO_YEARLY_PLAN_ID", "").strip(),
}

BASE_URL = (
    "https://api-m.paypal.com" if ENVIRONMENT == "live" else "https://api-m.sandbox.paypal.com"
)

# PayPal does not support IDR, so every PayPal charge is in USD.
PAYPAL_CURRENCY = "USD"
PLAN_INTERVAL = {"pro_monthly": "MONTH", "pro_yearly": "YEAR"}
PLAN_LABEL = {"pro_monthly": "PROMPTERA Pro Monthly", "pro_yearly": "PROMPTERA Pro Yearly"}

_token_cache: dict[str, Any] = {"token": None, "exp": 0.0}


def configured() -> bool:
    """True when PayPal client credentials are present."""
    return bool(CLIENT_ID and SECRET)


class PayPalError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Low level helpers
# ---------------------------------------------------------------------------
async def _get_access_token() -> str:
    now = time.time()
    if _token_cache["token"] and _token_cache["exp"] - 60 > now:
        return _token_cache["token"]
    if not configured():
        raise PayPalError("PayPal credentials are not configured")
    basic = base64.b64encode(f"{CLIENT_ID}:{SECRET}".encode()).decode()
    async with httpx.AsyncClient(timeout=30) as hc:
        r = await hc.post(
            f"{BASE_URL}/v1/oauth2/token",
            headers={
                "Authorization": f"Basic {basic}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
    if r.status_code != 200:
        logger.error("PayPal token error %s: %s", r.status_code, r.text)
        raise PayPalError("Failed to obtain PayPal access token")
    data = r.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["exp"] = now + float(data.get("expires_in", 3000))
    return _token_cache["token"]


async def _request(method: str, path: str, token: str, json_body: Optional[dict] = None) -> dict:
    async with httpx.AsyncClient(timeout=30) as hc:
        r = await hc.request(
            method,
            f"{BASE_URL}{path}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=json_body,
        )
    if r.status_code >= 400:
        logger.error("PayPal %s %s -> %s: %s", method, path, r.status_code, r.text)
        raise PayPalError(f"PayPal API error ({r.status_code})")
    return r.json() if r.content else {}


# ---------------------------------------------------------------------------
# Product + plan provisioning (cached in Mongo)
# ---------------------------------------------------------------------------
async def _ensure_product(db, token: str) -> str:
    existing = await db.paypal_meta.find_one({"_id": f"product:{ENVIRONMENT}"})
    if existing and existing.get("product_id"):
        return existing["product_id"]
    body = {
        "name": BRAND_NAME + " Pro",
        "description": BRAND_NAME + " Pro subscription",
        "type": "SERVICE",
        "category": "SOFTWARE",
    }
    res = await _request("POST", "/v1/catalogs/products", token, body)
    product_id = res["id"]
    await db.paypal_meta.update_one(
        {"_id": f"product:{ENVIRONMENT}"},
        {"$set": {"product_id": product_id}},
        upsert=True,
    )
    return product_id


async def ensure_plan(db, plan_id: str, amount_usd: float) -> str:
    """Return a PayPal billing plan id for our internal plan_id, creating the
    Product/Plan once and caching the id in Mongo (or using an env override)."""
    if PLAN_ID_ENV.get(plan_id):
        return PLAN_ID_ENV[plan_id]

    cache_key = f"plan:{ENVIRONMENT}:{plan_id}:{amount_usd}"
    cached = await db.paypal_meta.find_one({"_id": cache_key})
    if cached and cached.get("paypal_plan_id"):
        return cached["paypal_plan_id"]

    token = await _get_access_token()
    product_id = await _ensure_product(db, token)
    body = {
        "product_id": product_id,
        "name": PLAN_LABEL.get(plan_id, plan_id),
        "status": "ACTIVE",
        "billing_cycles": [
            {
                "frequency": {"interval_unit": PLAN_INTERVAL.get(plan_id, "MONTH"), "interval_count": 1},
                "tenure_type": "REGULAR",
                "sequence": 1,
                "total_cycles": 0,  # 0 = charge indefinitely until cancelled
                "pricing_scheme": {
                    "fixed_price": {"value": f"{amount_usd:.2f}", "currency_code": PAYPAL_CURRENCY}
                },
            }
        ],
        "payment_preferences": {
            "auto_bill_outstanding": True,
            "setup_fee_failure_action": "CONTINUE",
            "payment_failure_threshold": 1,
        },
    }
    res = await _request("POST", "/v1/billing/plans", token, body)
    paypal_plan_id = res["id"]
    await db.paypal_meta.update_one(
        {"_id": cache_key},
        {"$set": {"paypal_plan_id": paypal_plan_id, "plan_id": plan_id, "amount": amount_usd}},
        upsert=True,
    )
    return paypal_plan_id


# ---------------------------------------------------------------------------
# Subscription lifecycle
# ---------------------------------------------------------------------------
async def create_subscription(
    paypal_plan_id: str, custom_id: str, return_url: str, cancel_url: str
) -> dict:
    token = await _get_access_token()
    body = {
        "plan_id": paypal_plan_id,
        "custom_id": custom_id,
        "application_context": {
            "brand_name": BRAND_NAME,
            "user_action": "SUBSCRIBE_NOW",
            "shipping_preference": "NO_SHIPPING",
            "return_url": return_url,
            "cancel_url": cancel_url,
        },
    }
    res = await _request("POST", "/v1/billing/subscriptions", token, body)
    approve = next((l["href"] for l in res.get("links", []) if l.get("rel") == "approve"), None)
    return {"subscription_id": res.get("id"), "status": res.get("status"), "approval_url": approve}


async def get_subscription(subscription_id: str) -> dict:
    token = await _get_access_token()
    return await _request("GET", f"/v1/billing/subscriptions/{subscription_id}", token)


async def cancel_subscription(subscription_id: str, reason: str = "User requested cancel") -> None:
    token = await _get_access_token()
    try:
        await _request(
            "POST",
            f"/v1/billing/subscriptions/{subscription_id}/cancel",
            token,
            {"reason": reason},
        )
    except PayPalError as exc:  # already cancelled / expired – non fatal
        logger.warning("PayPal cancel ignored for %s: %s", subscription_id, exc)


# ---------------------------------------------------------------------------
# Webhook signature verification
# ---------------------------------------------------------------------------
async def verify_webhook(headers: dict, event: dict) -> bool:
    """Verify a webhook event using PayPal's verify-webhook-signature API.

    Returns True only when PayPal reports SUCCESS. If no WEBHOOK_ID is
    configured we cannot verify, so we return False (caller decides policy)."""
    if not (configured() and WEBHOOK_ID):
        return False

    def h(name: str) -> str:
        return headers.get(name) or headers.get(name.lower()) or ""

    token = await _get_access_token()
    body = {
        "transmission_id": h("paypal-transmission-id"),
        "transmission_time": h("paypal-transmission-time"),
        "cert_url": h("paypal-cert-url"),
        "auth_algo": h("paypal-auth-algo"),
        "transmission_sig": h("paypal-transmission-sig"),
        "webhook_id": WEBHOOK_ID,
        "webhook_event": event,
    }
    try:
        res = await _request("POST", "/v1/notifications/verify-webhook-signature", token, body)
    except PayPalError:
        return False
    return res.get("verification_status") == "SUCCESS"
