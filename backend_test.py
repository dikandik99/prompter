"""
Backend API tests for PROMPTERA PayPal subscription integration.

Tests the graceful fallback behavior when PayPal credentials are empty,
and validates the unified entitlement activation wiring.
"""

import requests
import json
import sys
from typing import Optional

# Backend URL from frontend/.env
BASE_URL = "https://prompter-app-2.preview.emergentagent.com/api"

# Test user credentials (will be generated)
test_email = "paypal_test_user_2024@example.com"
test_password = "TestPass123456"
test_name = "PayPal Test User"

# Global variables to store test data
access_token: Optional[str] = None
order_id_paypal: Optional[str] = None
order_id_midtrans: Optional[str] = None

def print_test(name: str):
    """Print test case header."""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(passed: bool, message: str):
    """Print test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    return passed

def register_and_login():
    """Register a new test user and get access token."""
    global access_token
    
    print_test("SETUP: Register and login test user")
    
    # Register
    try:
        resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "name": test_name
            },
            timeout=30
        )
        
        if resp.status_code == 409:
            # User already exists, try login
            print("User already exists, attempting login...")
            resp = requests.post(
                f"{BASE_URL}/auth/login",
                json={
                    "email": test_email,
                    "password": test_password
                },
                timeout=30
            )
        
        if resp.status_code not in [200, 201]:
            print(f"❌ Registration/Login failed: {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        access_token = data.get("access_token")
        
        if not access_token:
            print("❌ No access token in response")
            return False
        
        print(f"✅ Successfully authenticated")
        print(f"   Email: {test_email}")
        print(f"   Token: {access_token[:20]}...")
        return True
        
    except Exception as e:
        print(f"❌ Exception during registration/login: {e}")
        return False

def test_1_config():
    """Test 1: GET /api/config should return paypal_enabled=false and paypal_env=sandbox."""
    print_test("1. GET /api/config - PayPal configuration")
    
    try:
        resp = requests.get(f"{BASE_URL}/config", timeout=30)
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}")
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check paypal_enabled
        if "paypal_enabled" not in data:
            return print_result(False, "Missing 'paypal_enabled' in response")
        
        if data["paypal_enabled"] != False:
            return print_result(False, f"Expected paypal_enabled=false, got {data['paypal_enabled']}")
        
        # Check paypal_env
        if "paypal_env" not in data:
            return print_result(False, "Missing 'paypal_env' in response")
        
        if data["paypal_env"] != "sandbox":
            return print_result(False, f"Expected paypal_env='sandbox', got {data['paypal_env']}")
        
        return print_result(True, "Config returns paypal_enabled=false and paypal_env='sandbox'")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_2_checkout_paypal():
    """Test 2: POST /api/subscription/checkout with PayPal provider (no credentials)."""
    global order_id_paypal
    
    print_test("2. POST /api/subscription/checkout - PayPal (no credentials)")
    
    if not access_token:
        return print_result(False, "No access token available")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/subscription/checkout",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "plan_id": "pro_monthly",
                "provider": "paypal",
                "country": "ID",
                "return_url": "frontend://paypal-return",
                "cancel_url": "frontend://paypal-cancel"
            },
            timeout=30
        )
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check status
        if data.get("status") != "pending":
            return print_result(False, f"Expected status='pending', got {data.get('status')}")
        
        # Check checkout_url is null
        if data.get("checkout_url") is not None:
            return print_result(False, f"Expected checkout_url=null, got {data.get('checkout_url')}")
        
        # Check message mentions credentials
        message = data.get("message", "").lower()
        if "credential" not in message and "paypal" not in message:
            return print_result(False, f"Expected message to mention credentials, got: {data.get('message')}")
        
        # Capture order_id
        order_id_paypal = data.get("order_id")
        if not order_id_paypal:
            return print_result(False, "No order_id in response")
        
        print(f"   Order ID: {order_id_paypal}")
        return print_result(True, "PayPal checkout returns pending with needs-credentials message")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_3_checkout_midtrans():
    """Test 3: POST /api/subscription/checkout with Midtrans provider."""
    global order_id_midtrans
    
    print_test("3. POST /api/subscription/checkout - Midtrans (generic path)")
    
    if not access_token:
        return print_result(False, "No access token available")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/subscription/checkout",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "plan_id": "pro_monthly",
                "provider": "midtrans",
                "country": "ID",
                "return_url": "frontend://midtrans-return",
                "cancel_url": "frontend://midtrans-cancel"
            },
            timeout=30
        )
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check status
        if data.get("status") != "pending":
            return print_result(False, f"Expected status='pending', got {data.get('status')}")
        
        # Check checkout_url is null
        if data.get("checkout_url") is not None:
            return print_result(False, f"Expected checkout_url=null, got {data.get('checkout_url')}")
        
        # Check message mentions credentials
        message = data.get("message", "").lower()
        if "credential" not in message:
            return print_result(False, f"Expected message to mention credentials, got: {data.get('message')}")
        
        # Capture order_id
        order_id_midtrans = data.get("order_id")
        if not order_id_midtrans:
            return print_result(False, "No order_id in response")
        
        print(f"   Order ID: {order_id_midtrans}")
        return print_result(True, "Midtrans checkout returns pending with needs-credentials message")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_4_paypal_capture():
    """Test 4: POST /api/subscription/paypal/capture should return 400 (no credentials)."""
    print_test("4. POST /api/subscription/paypal/capture - No credentials")
    
    if not access_token:
        return print_result(False, "No access token available")
    
    if not order_id_paypal:
        return print_result(False, "No PayPal order_id available from test 2")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/subscription/paypal/capture",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"order_id": order_id_paypal},
            timeout=30
        )
        
        if resp.status_code != 400:
            return print_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check error message
        detail = data.get("detail", "").lower()
        if "paypal" not in detail or "not configured" not in detail:
            return print_result(False, f"Expected 'PayPal is not configured' message, got: {data.get('detail')}")
        
        return print_result(True, "Capture returns 400 with 'PayPal is not configured' message")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_5_webhook_activation():
    """Test 5: POST /api/subscription/webhook/paypal - Activation webhook."""
    print_test("5. POST /api/subscription/webhook/paypal - ACTIVATED event")
    
    if not order_id_paypal:
        return print_result(False, "No PayPal order_id available from test 2")
    
    try:
        # Send activation webhook
        resp = requests.post(
            f"{BASE_URL}/subscription/webhook/paypal",
            json={
                "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
                "resource": {
                    "id": "I-TESTSUB123",
                    "custom_id": order_id_paypal
                }
            },
            timeout=30
        )
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Webhook response: {json.dumps(data, indent=2)}")
        
        # Check webhook response
        if not data.get("ok"):
            return print_result(False, f"Expected ok=true, got {data.get('ok')}")
        
        if not data.get("matched"):
            return print_result(False, f"Expected matched=true, got {data.get('matched')}")
        
        # Now check entitlement
        resp2 = requests.get(
            f"{BASE_URL}/subscription/me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30
        )
        
        if resp2.status_code != 200:
            return print_result(False, f"Entitlement check failed: {resp2.status_code}")
        
        entitlement = resp2.json()
        print(f"Entitlement: {json.dumps(entitlement, indent=2)}")
        
        # Check plan is pro
        if entitlement.get("plan") != "pro":
            return print_result(False, f"Expected plan='pro', got {entitlement.get('plan')}")
        
        # Check provider is paypal
        if entitlement.get("provider") != "paypal":
            return print_result(False, f"Expected provider='paypal', got {entitlement.get('provider')}")
        
        return print_result(True, "Webhook activation successful, entitlement upgraded to Pro")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_6_webhook_cancellation():
    """Test 6: POST /api/subscription/webhook/paypal - Cancellation webhook."""
    print_test("6. POST /api/subscription/webhook/paypal - CANCELLED event")
    
    if not order_id_paypal:
        return print_result(False, "No PayPal order_id available from test 2")
    
    try:
        # Send cancellation webhook
        resp = requests.post(
            f"{BASE_URL}/subscription/webhook/paypal",
            json={
                "event_type": "BILLING.SUBSCRIPTION.CANCELLED",
                "resource": {
                    "id": "I-TESTSUB123",
                    "custom_id": order_id_paypal
                }
            },
            timeout=30
        )
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Webhook response: {json.dumps(data, indent=2)}")
        
        # Check webhook response
        if not data.get("ok"):
            return print_result(False, f"Expected ok=true, got {data.get('ok')}")
        
        # Now check entitlement
        resp2 = requests.get(
            f"{BASE_URL}/subscription/me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30
        )
        
        if resp2.status_code != 200:
            return print_result(False, f"Entitlement check failed: {resp2.status_code}")
        
        entitlement = resp2.json()
        print(f"Entitlement: {json.dumps(entitlement, indent=2)}")
        
        # Check status is canceled
        if entitlement.get("status") != "canceled":
            return print_result(False, f"Expected status='canceled', got {entitlement.get('status')}")
        
        # Check plan is back to free
        if entitlement.get("plan") != "free":
            return print_result(False, f"Expected plan='free', got {entitlement.get('plan')}")
        
        return print_result(True, "Webhook cancellation successful, entitlement downgraded to Free")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_7_webhook_unknown_order():
    """Test 7: POST /api/subscription/webhook/paypal - Unknown order."""
    print_test("7. POST /api/subscription/webhook/paypal - Unknown order")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/subscription/webhook/paypal",
            json={
                "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
                "resource": {
                    "id": "I-UNKNOWN",
                    "custom_id": "does-not-exist"
                }
            },
            timeout=30
        )
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check webhook response
        if not data.get("ok"):
            return print_result(False, f"Expected ok=true, got {data.get('ok')}")
        
        if data.get("matched") != False:
            return print_result(False, f"Expected matched=false, got {data.get('matched')}")
        
        return print_result(True, "Unknown order webhook returns ok=true, matched=false")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_8_regression_pricing():
    """Test 8: REGRESSION - GET /api/pricing for ID and US."""
    print_test("8. REGRESSION - GET /api/pricing")
    
    try:
        # Test ID pricing
        resp_id = requests.get(f"{BASE_URL}/pricing?country=ID", timeout=30)
        if resp_id.status_code != 200:
            return print_result(False, f"ID pricing failed: {resp_id.status_code}")
        
        data_id = resp_id.json()
        print(f"ID Pricing: currency={data_id.get('currency')}, plans={len(data_id.get('plans', []))}")
        
        if data_id.get("currency") != "IDR":
            return print_result(False, f"Expected IDR currency for ID, got {data_id.get('currency')}")
        
        if len(data_id.get("plans", [])) != 2:
            return print_result(False, f"Expected 2 plans for ID, got {len(data_id.get('plans', []))}")
        
        # Test US pricing
        resp_us = requests.get(f"{BASE_URL}/pricing?country=US", timeout=30)
        if resp_us.status_code != 200:
            return print_result(False, f"US pricing failed: {resp_us.status_code}")
        
        data_us = resp_us.json()
        print(f"US Pricing: currency={data_us.get('currency')}, plans={len(data_us.get('plans', []))}")
        
        if data_us.get("currency") != "USD":
            return print_result(False, f"Expected USD currency for US, got {data_us.get('currency')}")
        
        if len(data_us.get("plans", [])) != 2:
            return print_result(False, f"Expected 2 plans for US, got {len(data_us.get('plans', []))}")
        
        return print_result(True, "Pricing endpoints return correct currencies and plans")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_9_regression_dev_activate():
    """Test 9: REGRESSION - POST /api/subscription/dev-activate."""
    print_test("9. REGRESSION - POST /api/subscription/dev-activate")
    
    if not access_token:
        return print_result(False, "No access token available")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/subscription/dev-activate",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "plan_id": "pro_yearly",
                "provider": "paypal",
                "country": "ID"
            },
            timeout=30
        )
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check plan is pro
        if data.get("plan") != "pro":
            return print_result(False, f"Expected plan='pro', got {data.get('plan')}")
        
        return print_result(True, "Dev-activate successfully grants Pro entitlement")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_10_regression_cancel():
    """Test 10: REGRESSION - POST /api/subscription/cancel."""
    print_test("10. REGRESSION - POST /api/subscription/cancel")
    
    if not access_token:
        return print_result(False, "No access token available")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/subscription/cancel",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30
        )
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check status is canceled
        if data.get("status") != "canceled":
            return print_result(False, f"Expected status='canceled', got {data.get('status')}")
        
        return print_result(True, "Cancel endpoint successfully cancels subscription")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_11_regression_ai_languages():
    """Test 11: REGRESSION - GET /api/ai/languages."""
    print_test("11. REGRESSION - GET /api/ai/languages")
    
    try:
        resp = requests.get(f"{BASE_URL}/ai/languages", timeout=30)
        
        if resp.status_code != 200:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        
        data = resp.json()
        print(f"Response: languages={len(data.get('languages', []))}, modes={len(data.get('modes', []))}")
        
        if not data.get("languages"):
            return print_result(False, "No languages in response")
        
        if not data.get("modes"):
            return print_result(False, "No modes in response")
        
        return print_result(True, "AI languages endpoint returns language and mode lists")
        
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def save_test_credentials():
    """Save test credentials to /app/memory/test_credentials.md."""
    print_test("CLEANUP: Save test credentials")
    
    try:
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write("# Test Credentials for PROMPTERA Backend\n\n")
            f.write("## PayPal Integration Test User\n\n")
            f.write(f"- **Email**: {test_email}\n")
            f.write(f"- **Password**: {test_password}\n")
            f.write(f"- **Name**: {test_name}\n")
            f.write(f"- **Access Token**: {access_token[:30] if access_token else 'N/A'}...\n")
            f.write(f"\n## Test Order IDs\n\n")
            f.write(f"- **PayPal Order**: {order_id_paypal}\n")
            f.write(f"- **Midtrans Order**: {order_id_midtrans}\n")
            f.write(f"\n## Notes\n\n")
            f.write("- These credentials were generated during PayPal integration testing\n")
            f.write("- The user has been through activation/cancellation cycles\n")
            f.write("- Current entitlement status may vary\n")
        
        print("✅ Test credentials saved to /app/memory/test_credentials.md")
        return True
        
    except Exception as e:
        print(f"❌ Failed to save credentials: {e}")
        return False

def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("PROMPTERA BACKEND - PayPal Integration Tests")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print("="*80)
    
    results = []
    
    # Setup
    if not register_and_login():
        print("\n❌ FATAL: Could not authenticate. Aborting tests.")
        sys.exit(1)
    
    # Run tests
    results.append(("Test 1: Config", test_1_config()))
    results.append(("Test 2: Checkout PayPal", test_2_checkout_paypal()))
    results.append(("Test 3: Checkout Midtrans", test_3_checkout_midtrans()))
    results.append(("Test 4: PayPal Capture", test_4_paypal_capture()))
    results.append(("Test 5: Webhook Activation", test_5_webhook_activation()))
    results.append(("Test 6: Webhook Cancellation", test_6_webhook_cancellation()))
    results.append(("Test 7: Webhook Unknown Order", test_7_webhook_unknown_order()))
    results.append(("Test 8: Regression Pricing", test_8_regression_pricing()))
    results.append(("Test 9: Regression Dev-Activate", test_9_regression_dev_activate()))
    results.append(("Test 10: Regression Cancel", test_10_regression_cancel()))
    results.append(("Test 11: Regression AI Languages", test_11_regression_ai_languages()))
    
    # Save credentials
    save_test_credentials()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    if passed == total:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
