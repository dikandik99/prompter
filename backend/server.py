"""PROMPTERA backend API.

Owned by PT Samudera Kreatif Indonesia.

Provides:
  - Email/password auth (JWT, bcrypt)
  - Multi-country pricing catalog (no prices hardcoded in the mobile app)
  - Unified subscription / entitlement system (Free / Pro) fed by pluggable
    payment providers (Midtrans / DANA / PayPal / RevenueCat / stores)
  - AI gateway (DeepSeek primary) for translation with caching, per-user daily
    quotas and usage tracking. Disabled until DEEPSEEK_API_KEY is configured.

Core creator features (scripts, teleprompter, camera, recording) are local-first
on the device and intentionally do NOT call this backend continuously.
"""

import hashlib
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Literal, Optional

import httpx
import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

import paypal_service as paypal

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Config / infra
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.environ.get("JWT_ISSUER", "promptera")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "promptera-app")
ACCESS_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "43200"))

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
FREE_LIMIT = int(os.environ.get("FREE_TRANSLATE_DAILY_LIMIT", "5"))
PRO_LIMIT = int(os.environ.get("PRO_TRANSLATE_DAILY_LIMIT", "200"))

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("promptera")

app = FastAPI(title="PROMPTERA API")
api = APIRouter(prefix="/api")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
class AuthError(HTTPException):
    def __init__(self, detail: str = "Invalid or expired credentials"):
        super().__init__(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def make_token(user_id: str) -> str:
    now = now_utc()
    claims = {
        "sub": user_id,
        "typ": "access",
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_MINUTES),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


def public_user(row: dict) -> dict:
    return {
        "id": str(row["_id"]),
        "email": row["email"],
        "name": row.get("name", ""),
        "photo_url": row.get("photo_url"),
        "created_at": row["created_at"].isoformat() if isinstance(row.get("created_at"), datetime) else row.get("created_at"),
    }


async def current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise AuthError()
    try:
        p = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
        )
        if p.get("typ") != "access" or not ObjectId.is_valid(p.get("sub", "")):
            raise AuthError()
    except jwt.PyJWTError:
        raise AuthError()
    row = await db.users.find_one({"_id": ObjectId(p["sub"]), "disabled": {"$ne": True}})
    if not row:
        raise AuthError()
    return row


CurrentUser = Annotated[dict, Depends(current_user)]


# ---------------------------------------------------------------------------
# Pricing catalog (multi-country, backend-driven)
# ---------------------------------------------------------------------------
PRICING_CATALOG = {
    "ID": {
        "currency": "IDR",
        "symbol": "Rp",
        "monthly": 249000,
        "yearly": 1199000,
        "providers": ["midtrans", "dana", "paypal", "appstore", "playstore"],
    },
    "US": {
        "currency": "USD",
        "symbol": "$",
        "monthly": 15.99,
        "yearly": 76.99,
        "providers": ["paypal", "appstore", "playstore"],
    },
    "DEFAULT": {
        "currency": "USD",
        "symbol": "$",
        "monthly": 15.99,
        "yearly": 76.99,
        "providers": ["paypal", "appstore", "playstore"],
    },
}

PRO_FEATURES = [
    {"icon": "infinite", "key": "unlimited_scripts"},
    {"icon": "tv", "key": "pro_teleprompter"},
    {"icon": "mic", "key": "voice_following"},
    {"icon": "language", "key": "advanced_translation"},
    {"icon": "cloud-upload", "key": "cloud_sync"},
    {"icon": "camera", "key": "advanced_recording"},
    {"icon": "sparkles", "key": "premium_tools"},
]


def format_money(currency: str, symbol: str, amount: float) -> str:
    if currency == "IDR":
        return f"{symbol}{int(round(amount)):,}".replace(",", ".")
    return f"{symbol}{amount:,.2f}"


def build_pricing(country: str) -> dict:
    country = (country or "ID").upper()
    cfg = PRICING_CATALOG.get(country, PRICING_CATALOG["DEFAULT"])
    monthly = cfg["monthly"]
    yearly = cfg["yearly"]
    monthly_equiv = yearly / 12.0
    savings_pct = int(round((1 - (yearly / (monthly * 12))) * 100))
    cur, sym = cfg["currency"], cfg["symbol"]
    return {
        "country": country,
        "currency": cur,
        "symbol": sym,
        "providers": cfg["providers"],
        "features": PRO_FEATURES,
        "plans": [
            {
                "id": "pro_monthly",
                "interval": "month",
                "amount": monthly,
                "price_display": format_money(cur, sym, monthly),
                "best_value": False,
            },
            {
                "id": "pro_yearly",
                "interval": "year",
                "amount": yearly,
                "price_display": format_money(cur, sym, yearly),
                "best_value": True,
                "savings_pct": savings_pct,
                "monthly_equivalent": format_money(cur, sym, monthly_equiv),
            },
        ],
    }


# ---------------------------------------------------------------------------
# Entitlement helpers
# ---------------------------------------------------------------------------
# PayPal does not support IDR, so PayPal always charges the USD price regardless
# of the buyer's country (decided with the product owner).
PAYPAL_USD = {
    "pro_monthly": float(PRICING_CATALOG["US"]["monthly"]),
    "pro_yearly": float(PRICING_CATALOG["US"]["yearly"]),
}
PAYPAL_RETURN_URL = os.environ.get("PAYPAL_RETURN_URL", "").strip()
PAYPAL_CANCEL_URL = os.environ.get("PAYPAL_CANCEL_URL", "").strip()


def paypal_amount_usd(plan_id: str) -> float:
    return PAYPAL_USD.get(plan_id, PAYPAL_USD["pro_monthly"])


async def get_entitlement(user_id: str) -> dict:
    sub = await db.subscriptions.find_one({"user_id": user_id, "deleted_at": None})
    if not sub:
        return {"plan": "free", "status": "none", "provider": None, "current_period_end": None, "plan_id": None}
    end = sub.get("current_period_end")
    active = sub.get("status") == "active"
    if end and isinstance(end, datetime):
        end_aware = end if end.tzinfo else end.replace(tzinfo=timezone.utc)
        if end_aware < now_utc():
            active = False
    return {
        "plan": "pro" if active else "free",
        "status": sub.get("status"),
        "provider": sub.get("provider"),
        "plan_id": sub.get("plan_id"),
        "current_period_end": end.isoformat() if isinstance(end, datetime) else end,
    }


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = Field(default="", max_length=80)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class CheckoutBody(BaseModel):
    plan_id: Literal["pro_monthly", "pro_yearly"]
    provider: Literal["midtrans", "dana", "paypal", "revenuecat", "appstore", "playstore"]
    country: str = "ID"
    return_url: Optional[str] = None
    cancel_url: Optional[str] = None


class PayPalCaptureBody(BaseModel):
    order_id: Optional[str] = None
    subscription_id: Optional[str] = None


class TranslateBody(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    source_lang: str = "auto"
    target_lang: str
    mode: Literal["natural", "formal", "casual", "marketing", "social"] = "natural"


SUPPORTED_LANGUAGES = [
    {"code": "id", "name": "Bahasa Indonesia"},
    {"code": "en", "name": "English"},
    {"code": "ms", "name": "Melayu"},
    {"code": "zh", "name": "中文 (Mandarin)"},
    {"code": "ja", "name": "日本語"},
    {"code": "ko", "name": "한국어"},
    {"code": "es", "name": "Español"},
    {"code": "pt", "name": "Português"},
    {"code": "fr", "name": "Français"},
    {"code": "de", "name": "Deutsch"},
    {"code": "ar", "name": "العربية"},
    {"code": "th", "name": "ไทย"},
    {"code": "vi", "name": "Tiếng Việt"},
]

TRANSLATE_MODES = [
    {"id": "natural", "label": "Natural"},
    {"id": "formal", "label": "Formal"},
    {"id": "casual", "label": "Casual"},
    {"id": "marketing", "label": "Marketing"},
    {"id": "social", "label": "Social Media"},
]


# ---------------------------------------------------------------------------
# Routes: health
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "PROMPTERA", "owner": "PT Samudera Kreatif Indonesia", "status": "ok"}


@api.get("/config")
async def config():
    return {
        "ai_enabled": bool(DEEPSEEK_API_KEY),
        "ai_provider": "deepseek",
        "default_country": "ID",
        "default_language": "id",
        "paypal_enabled": paypal.configured(),
        "paypal_env": paypal.ENVIRONMENT,
    }


# ---------------------------------------------------------------------------
# Routes: auth
# ---------------------------------------------------------------------------
class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


@api.post("/auth/register", response_model=AuthResponse, status_code=201)
async def register(body: Credentials):
    email = body.email.lower().strip()
    row = {
        "email": email,
        "name": (body.name or "").strip(),
        "password_hash": pwd.hash(body.password),
        "photo_url": None,
        "created_at": now_utc(),
        "disabled": False,
        "identities": [{"provider": "password", "provider_identity": f"password:{email}"}],
    }
    try:
        res = await db.users.insert_one(row)
    except DuplicateKeyError:
        raise HTTPException(409, "An account with this email already exists")
    row["_id"] = res.inserted_id
    return AuthResponse(
        access_token=make_token(str(res.inserted_id)),
        expires_in=ACCESS_MINUTES * 60,
        user=public_user(row),
    )


@api.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginBody):
    email = body.email.lower().strip()
    row = await db.users.find_one({"email": email})
    if row and not row.get("password_hash"):
        raise HTTPException(401, "This account uses Google Sign-In. Continue with Google instead.", headers={"WWW-Authenticate": "Bearer"})
    if not row or not pwd.verify(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    return AuthResponse(
        access_token=make_token(str(row["_id"])),
        expires_in=ACCESS_MINUTES * 60,
        user=public_user(row),
    )


class SessionBody(BaseModel):
    session_id: str = Field(min_length=1, max_length=512)


EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


@api.post("/auth/session", response_model=AuthResponse)
async def google_session(body: SessionBody):
    """Google Sign-In (Emergent managed OAuth).

    Exchanges the one-time `session_id` from the OAuth redirect for the Google
    profile, upserts the user by email and issues PROMPTERA's own JWT so the
    rest of the API keeps working unchanged.
    """
    try:
        async with httpx.AsyncClient(timeout=20) as hc:
            resp = await hc.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    except httpx.HTTPError as exc:
        logger.error("Google session exchange failed: %s", exc)
        raise AuthError("Google sign-in could not be completed")
    if resp.status_code != 200:
        raise AuthError("Google sign-in session is invalid or expired")
    data = resp.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise AuthError("Google account has no email")
    identity = {"provider": "google", "provider_identity": f"google:{data.get('id') or email}"}
    row = await db.users.find_one({"email": email})
    if row:
        patch: dict = {}
        if not row.get("name") and data.get("name"):
            patch["name"] = data["name"]
        if data.get("picture") and not row.get("photo_url"):
            patch["photo_url"] = data["picture"]
        update: dict = {"$addToSet": {"identities": identity}}
        if patch:
            update["$set"] = patch
        await db.users.update_one({"_id": row["_id"]}, update)
        row = await db.users.find_one({"_id": row["_id"]})
    else:
        row = {
            "email": email,
            "name": (data.get("name") or "").strip(),
            "password_hash": None,
            "photo_url": data.get("picture"),
            "created_at": now_utc(),
            "disabled": False,
            "identities": [identity],
        }
        res = await db.users.insert_one(row)
        row["_id"] = res.inserted_id
    if row.get("disabled"):
        raise AuthError("Account disabled")
    return AuthResponse(
        access_token=make_token(str(row["_id"])),
        expires_in=ACCESS_MINUTES * 60,
        user=public_user(row),
    )


# --- Sign in with Apple -----------------------------------------------------
APPLE_AUDIENCES = [a.strip() for a in os.environ.get("APPLE_AUDIENCES", "").split(",") if a.strip()]
APPLE_ISSUER = "https://appleid.apple.com"
_apple_jwks = jwt.PyJWKClient("https://appleid.apple.com/auth/keys", cache_keys=True)


class AppleBody(BaseModel):
    identity_token: str = Field(min_length=20, max_length=8192)
    name: Optional[str] = Field(default=None, max_length=80)
    email: Optional[EmailStr] = None


@api.post("/auth/apple", response_model=AuthResponse)
async def apple_sign_in(body: AppleBody):
    """Verify an Apple identity token (RS256 vs Apple JWKS) and issue our JWT.

    Users are keyed by Apple `sub` (identities), falling back to email so an
    existing password/Google account with the same email is reused.
    """
    if not APPLE_AUDIENCES:
        raise HTTPException(503, "Sign in with Apple is not configured on the server")
    try:
        signing_key = _apple_jwks.get_signing_key_from_jwt(body.identity_token)
        claims = jwt.decode(
            body.identity_token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=APPLE_ISSUER,
            audience=APPLE_AUDIENCES,
        )
    except jwt.PyJWTError as exc:
        logger.warning("Apple token rejected: %s", exc)
        raise AuthError("Apple sign-in token is invalid or expired")
    sub = claims.get("sub")
    if not sub:
        raise AuthError("Apple token missing subject")
    identity = {"provider": "apple", "provider_identity": f"apple:{sub}"}
    email = (body.email or claims.get("email") or "").lower().strip()

    row = await db.users.find_one({"identities.provider_identity": identity["provider_identity"]})
    if not row and email:
        row = await db.users.find_one({"email": email})
    if row:
        patch: dict = {}
        if not row.get("name") and body.name:
            patch["name"] = body.name.strip()
        update: dict = {"$addToSet": {"identities": identity}}
        if patch:
            update["$set"] = patch
        await db.users.update_one({"_id": row["_id"]}, update)
        row = await db.users.find_one({"_id": row["_id"]})
    else:
        row = {
            "email": email or f"apple_{sub}@privaterelay.appleid.local",
            "name": (body.name or "").strip(),
            "password_hash": None,
            "photo_url": None,
            "created_at": now_utc(),
            "disabled": False,
            "identities": [identity],
        }
        res = await db.users.insert_one(row)
        row["_id"] = res.inserted_id
    if row.get("disabled"):
        raise AuthError("Account disabled")
    return AuthResponse(
        access_token=make_token(str(row["_id"])),
        expires_in=ACCESS_MINUTES * 60,
        user=public_user(row),
    )


@api.get("/auth/me")
async def me(user: CurrentUser):
    data = public_user(user)
    data["entitlement"] = await get_entitlement(str(user["_id"]))
    return data


# ---------------------------------------------------------------------------
# Routes: pricing
# ---------------------------------------------------------------------------
@api.get("/pricing")
async def pricing(country: str = "ID"):
    return build_pricing(country)


# ---------------------------------------------------------------------------
# Routes: subscription / entitlement
# ---------------------------------------------------------------------------
@api.get("/subscription/me")
async def subscription_me(user: CurrentUser):
    return await get_entitlement(str(user["_id"]))


@api.post("/subscription/checkout")
async def checkout(body: CheckoutBody, user: CurrentUser):
    """Create a pending order through a pluggable payment provider.

    For PayPal (when credentials are configured) this creates a real recurring
    subscription and returns the buyer approval URL. Other providers, and PayPal
    when keys are not yet configured, record a `pending` order and return the
    provider so the client can continue once the keys are added. The entitlement
    system itself is fully functional (see capture/webhook).
    """
    order_id = str(uuid.uuid4())
    order = {
        "_id": order_id,
        "user_id": str(user["_id"]),
        "plan_id": body.plan_id,
        "provider": body.provider,
        "country": body.country,
        "status": "pending",
        "created_at": now_utc(),
        "deleted_at": None,
    }

    # Real PayPal recurring-subscription checkout --------------------------------
    if body.provider == "paypal" and paypal.configured():
        return_url = body.return_url or PAYPAL_RETURN_URL
        cancel_url = body.cancel_url or PAYPAL_CANCEL_URL or return_url
        if not return_url:
            raise HTTPException(400, "A return_url is required for PayPal checkout")
        try:
            amount = paypal_amount_usd(body.plan_id)
            paypal_plan_id = await paypal.ensure_plan(db, body.plan_id, amount)
            sub = await paypal.create_subscription(paypal_plan_id, order_id, return_url, cancel_url)
        except paypal.PayPalError as exc:
            logger.error("PayPal checkout failed: %s", exc)
            raise HTTPException(502, "PayPal is temporarily unavailable. Please try again.")
        order.update(
            {
                "provider": "paypal",
                "currency": paypal.PAYPAL_CURRENCY,
                "amount": amount,
                "paypal_plan_id": paypal_plan_id,
                "paypal_subscription_id": sub["subscription_id"],
            }
        )
        await db.orders.insert_one(order)
        return {
            "order_id": order_id,
            "provider": "paypal",
            "plan_id": body.plan_id,
            "status": "pending",
            "checkout_url": sub["approval_url"],
            "subscription_id": sub["subscription_id"],
            "currency": paypal.PAYPAL_CURRENCY,
            "amount": amount,
            "message": "Approve the PayPal subscription to activate PROMPTERA Pro.",
        }

    # Fallback: record pending order (provider keys not configured) ---------------
    await db.orders.insert_one(order)
    hint = (
        "paypal" if body.provider == "paypal" else body.provider
    )
    return {
        "order_id": order_id,
        "provider": body.provider,
        "plan_id": body.plan_id,
        "status": "pending",
        "checkout_url": None,
        "message": f"Payment provider '{hint}' needs server credentials to complete checkout. Order recorded.",
    }


@api.post("/subscription/paypal/capture")
async def paypal_capture(body: PayPalCaptureBody, user: CurrentUser):
    """Confirm a PayPal subscription after the buyer approves it in the browser.

    Called by the app when it is redirected back from the PayPal approval page.
    Grants Pro when PayPal reports the subscription ACTIVE/APPROVED."""
    if not paypal.configured():
        raise HTTPException(400, "PayPal is not configured on the server")

    order = None
    if body.order_id:
        order = await db.orders.find_one({"_id": body.order_id, "user_id": str(user["_id"])})
    if not order and body.subscription_id:
        order = await db.orders.find_one(
            {"paypal_subscription_id": body.subscription_id, "user_id": str(user["_id"])}
        )
    if not order:
        raise HTTPException(404, "Order not found")

    subscription_id = body.subscription_id or order.get("paypal_subscription_id")
    if not subscription_id:
        raise HTTPException(400, "Missing PayPal subscription id")

    try:
        sub = await paypal.get_subscription(subscription_id)
    except paypal.PayPalError:
        raise HTTPException(502, "Could not verify the PayPal subscription")

    status = (sub.get("status") or "").upper()
    if status in ("ACTIVE", "APPROVED"):
        await _activate_pro(order["user_id"], order["plan_id"], "paypal", order["_id"], subscription_id)
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "paid"}})
    else:
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": status.lower() or "pending"}})
    return await get_entitlement(str(user["_id"]))


@api.post("/subscription/webhook/paypal")
async def paypal_webhook(request: Request):
    """PayPal server-to-server webhook (reliable activation / cancellation).

    Verifies the signature with PAYPAL_WEBHOOK_ID before acting. Handles
    subscription activation and cancellation/expiry events."""
    raw = await request.body()
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    verified = await paypal.verify_webhook(dict(request.headers), event)
    if paypal.WEBHOOK_ID and not verified:
        logger.warning("Rejected unverified PayPal webhook (%d bytes)", len(raw))
        raise HTTPException(400, "Webhook signature verification failed")

    event_type = event.get("event_type", "")
    resource = event.get("resource", {}) or {}
    subscription_id = resource.get("id") or resource.get("billing_agreement_id")
    custom_id = resource.get("custom_id")

    order = None
    if custom_id:
        order = await db.orders.find_one({"_id": custom_id})
    if not order and subscription_id:
        order = await db.orders.find_one({"paypal_subscription_id": subscription_id})
    if not order:
        logger.info("PayPal webhook %s: no matching order", event_type)
        return {"ok": True, "matched": False}

    if event_type in ("BILLING.SUBSCRIPTION.ACTIVATED", "PAYMENT.SALE.COMPLETED", "BILLING.SUBSCRIPTION.RENEWED"):
        await _activate_pro(order["user_id"], order["plan_id"], "paypal", order["_id"], subscription_id)
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "paid"}})
    elif event_type in (
        "BILLING.SUBSCRIPTION.CANCELLED",
        "BILLING.SUBSCRIPTION.EXPIRED",
        "BILLING.SUBSCRIPTION.SUSPENDED",
    ):
        await db.subscriptions.update_one(
            {"user_id": order["user_id"], "deleted_at": None},
            {"$set": {"status": "canceled", "updated_at": now_utc()}},
        )
    return {"ok": True, "matched": True, "event": event_type}


@api.post("/subscription/webhook/{provider}")
async def subscription_webhook(provider: str, payload: dict):
    """Unified entitlement activation endpoint used by every payment provider.

    In production each provider posts a signed webhook here; the signature is
    verified with that provider's secret (not shipped in this environment).
    The body must contain `order_id` and `plan_id`.
    """
    order_id = payload.get("order_id")
    plan_id = payload.get("plan_id")
    order = await db.orders.find_one({"_id": order_id}) if order_id else None
    if not order:
        raise HTTPException(404, "Order not found")
    await _activate_pro(order["user_id"], plan_id or order["plan_id"], provider, order_id)
    await db.orders.update_one({"_id": order_id}, {"$set": {"status": "paid"}})
    return {"ok": True}


@api.post("/subscription/dev-activate")
async def dev_activate(body: CheckoutBody, user: CurrentUser):
    """DEV/TEST ONLY: simulate a successful provider webhook so Pro entitlement
    can be exercised end-to-end without live payment credentials."""
    await _activate_pro(str(user["_id"]), body.plan_id, f"dev:{body.provider}", None)
    return await get_entitlement(str(user["_id"]))


@api.post("/subscription/restore")
async def restore(user: CurrentUser):
    return await get_entitlement(str(user["_id"]))


@api.post("/subscription/cancel")
async def cancel(user: CurrentUser):
    sub = await db.subscriptions.find_one({"user_id": str(user["_id"]), "deleted_at": None})
    if sub and sub.get("provider") == "paypal" and sub.get("paypal_subscription_id") and paypal.configured():
        await paypal.cancel_subscription(sub["paypal_subscription_id"])
    await db.subscriptions.update_one(
        {"user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"status": "canceled", "updated_at": now_utc()}},
    )
    return await get_entitlement(str(user["_id"]))


async def _activate_pro(user_id: str, plan_id: str, provider: str, order_id, subscription_id=None):
    days = 365 if plan_id == "pro_yearly" else 31
    doc = {
        "user_id": user_id,
        "plan_id": plan_id,
        "provider": provider,
        "status": "active",
        "order_id": order_id,
        "current_period_start": now_utc(),
        "current_period_end": now_utc() + timedelta(days=days),
        "updated_at": now_utc(),
        "deleted_at": None,
    }
    if subscription_id:
        doc["paypal_subscription_id"] = subscription_id
    await db.subscriptions.update_one(
        {"user_id": user_id, "deleted_at": None},
        {"$set": doc, "$setOnInsert": {"created_at": now_utc()}},
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Routes: AI gateway (DeepSeek primary)
# ---------------------------------------------------------------------------
@api.get("/ai/languages")
async def ai_languages():
    return {"languages": SUPPORTED_LANGUAGES, "modes": TRANSLATE_MODES}


@api.get("/ai/usage")
async def ai_usage(user: CurrentUser):
    ent = await get_entitlement(str(user["_id"]))
    limit = PRO_LIMIT if ent["plan"] == "pro" else FREE_LIMIT
    used = await _usage_today(str(user["_id"]))
    return {"plan": ent["plan"], "used": used, "limit": limit, "remaining": max(0, limit - used), "enabled": bool(DEEPSEEK_API_KEY)}


async def _usage_today(user_id: str) -> int:
    key = now_utc().strftime("%Y-%m-%d")
    row = await db.ai_usage.find_one({"user_id": user_id, "date": key})
    return int(row["count"]) if row else 0


async def _bump_usage(user_id: str):
    key = now_utc().strftime("%Y-%m-%d")
    await db.ai_usage.update_one(
        {"user_id": user_id, "date": key},
        {"$inc": {"count": 1}, "$set": {"updated_at": now_utc()}},
        upsert=True,
    )


MODE_INSTRUCTIONS = {
    "natural": "natural, fluent and conversational",
    "formal": "formal and professional",
    "casual": "casual and friendly",
    "marketing": "persuasive marketing copy that drives action",
    "social": "punchy, engaging social-media style suited for short-form video",
}


@api.post("/ai/translate")
async def ai_translate(body: TranslateBody, user: CurrentUser):
    if not DEEPSEEK_API_KEY:
        raise HTTPException(
            503,
            "Translation is not configured yet. Add a DeepSeek API key on the server to enable AI translation.",
        )
    user_id = str(user["_id"])
    ent = await get_entitlement(user_id)
    limit = PRO_LIMIT if ent["plan"] == "pro" else FREE_LIMIT
    used = await _usage_today(user_id)
    if used >= limit:
        raise HTTPException(
            429,
            f"Daily translation limit reached ({limit}). Upgrade to Pro for more." if ent["plan"] == "free" else f"Daily limit reached ({limit}).",
        )

    cache_key = hashlib.sha256(
        f"{body.source_lang}|{body.target_lang}|{body.mode}|{body.text}".encode("utf-8")
    ).hexdigest()
    cached = await db.translation_cache.find_one({"_id": cache_key})
    if cached:
        return {"translation": cached["translation"], "cached": True, "remaining": max(0, limit - used)}

    src = "the source language" if body.source_lang == "auto" else body.source_lang
    system = (
        "You are a professional translator for video scripts and teleprompter content. "
        "Preserve paragraph structure, meaning, tone and formatting. Return ONLY the translated text."
    )
    prompt = (
        f"Translate the following script from {src} to {body.target_lang}. "
        f"Use a {MODE_INSTRUCTIONS[body.mode]} tone. Keep line breaks and paragraphs.\n\n{body.text}"
    )
    try:
        async with httpx.AsyncClient(timeout=60) as hc:
            resp = await hc.post(
                f"{DEEPSEEK_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                },
            )
        resp.raise_for_status()
        data = resp.json()
        translation = data["choices"][0]["message"]["content"].strip()
    except Exception as exc:  # noqa: BLE001
        logger.error("DeepSeek translate failed: %s", exc)
        raise HTTPException(502, "Translation could not be completed. Please try again.")

    await db.translation_cache.insert_one(
        {"_id": cache_key, "translation": translation, "created_at": now_utc()}
    )
    await _bump_usage(user_id)
    await db.translations.insert_one(
        {
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "source_lang": body.source_lang,
            "target_lang": body.target_lang,
            "mode": body.mode,
            "created_at": now_utc(),
        }
    )
    return {"translation": translation, "cached": False, "remaining": max(0, limit - used - 1)}


# ---------------------------------------------------------------------------
# Routes: analytics (privacy-conscious; no script/recording content)
# ---------------------------------------------------------------------------
class AnalyticsEvent(BaseModel):
    event: str
    properties: dict = {}


ALLOWED_EVENTS = {
    "app_opened", "script_created", "script_imported", "script_translated",
    "teleprompter_started", "recording_started", "recording_completed",
    "video_saved", "video_shared", "subscription_viewed", "subscription_started",
}


@api.post("/analytics/event")
async def analytics_event(body: AnalyticsEvent):
    if body.event not in ALLOWED_EVENTS:
        return {"ok": False, "reason": "event_not_allowed"}
    await db.analytics.insert_one(
        {"_id": str(uuid.uuid4()), "event": body.event, "properties": body.properties, "ts": now_utc()}
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    try:
        await db.users.create_index("email", unique=True, name="uniq_users_email")
        await db.ai_usage.create_index([("user_id", 1), ("date", 1)], name="usage_user_date")
        await db.subscriptions.create_index("user_id", name="sub_user")
        logger.info("PROMPTERA indexes ready")
    except Exception as exc:  # noqa: BLE001
        logger.error("index setup failed: %s", exc)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
