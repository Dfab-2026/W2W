#!/usr/bin/env python3
"""
Backend test for Work2Wish forgot password / reset password functionality (Slice 4)
Tests the new endpoints:
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- Verification that POST /api/auth/verify-otp rejects reset OTPs
"""

import os
import sys
import requests
import json
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

BASE_URL = os.environ['NEXT_PUBLIC_BASE_URL']
SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

def get_otp(email):
    """Retrieve the latest unconsumed OTP for an email from Supabase"""
    try:
        r = requests.get(
            f'{SUPABASE_URL}/rest/v1/otp_codes?email=eq.{email}&consumed=eq.false&order=created_at.desc&limit=1',
            headers={'apikey': SUPABASE_SERVICE_KEY, 'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'}
        )
        if r.status_code == 200 and r.json():
            return r.json()[0]['code']
        return None
    except Exception as e:
        print(f"Error getting OTP: {e}")
        return None

def get_reset_otp(email):
    """Retrieve the latest unconsumed RESET OTP for an email from Supabase"""
    try:
        r = requests.get(
            f'{SUPABASE_URL}/rest/v1/otp_codes?email=eq.{email}&consumed=eq.false&payload->>type=eq.reset&order=created_at.desc&limit=1',
            headers={'apikey': SUPABASE_SERVICE_KEY, 'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'}
        )
        if r.status_code == 200 and r.json():
            return r.json()[0]['code']
        return None
    except Exception as e:
        print(f"Error getting reset OTP: {e}")
        return None

def test_forgot_password_reset_flow():
    """Test the complete forgot password and reset password flow"""
    print("🧪 Testing Forgot Password / Reset Password Flow")
    print("=" * 60)
    
    # Generate unique test email
    test_uuid = str(uuid.uuid4())[:8]
    email = f"w2w_pwreset_{test_uuid}@example.com"
    old_password = "OldPass123!"
    new_password = "NewPass456!"
    
    print(f"📧 Test email: {email}")
    
    try:
        # Step 1: Create a user via OTP signup flow
        print("\n1️⃣ Creating user via OTP signup...")
        
        # Send OTP for signup
        signup_otp_response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "email": email,
            "password": old_password,
            "role": "worker",
            "full_name": "Test Worker"
        })
        
        if signup_otp_response.status_code != 200:
            print(f"❌ Failed to send signup OTP: {signup_otp_response.status_code} - {signup_otp_response.text}")
            return False
        
        print("✅ Signup OTP sent successfully")
        
        # Get signup OTP from database
        signup_otp = get_otp(email)
        if not signup_otp:
            print("❌ Failed to retrieve signup OTP from database")
            return False
        
        print(f"✅ Retrieved signup OTP: {signup_otp}")
        
        # Verify OTP to create user
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "email": email,
            "otp": signup_otp
        })
        
        if verify_response.status_code != 200:
            print(f"❌ Failed to verify signup OTP: {verify_response.status_code} - {verify_response.text}")
            return False
        
        verify_data = verify_response.json()
        print(f"✅ User created successfully with login_id: {verify_data.get('login_id')}")
        
        # Step 2: Verify user can login with old password
        print("\n2️⃣ Verifying login with old password...")
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": old_password
        })
        
        if login_response.status_code != 200:
            print(f"❌ Failed to login with old password: {login_response.status_code} - {login_response.text}")
            return False
        
        print("✅ Login with old password successful")
        
        # Step 3: Test forgot password endpoint
        print("\n3️⃣ Testing forgot password endpoint...")
        
        forgot_response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": email
        })
        
        if forgot_response.status_code != 200:
            print(f"❌ Forgot password failed: {forgot_response.status_code} - {forgot_response.text}")
            return False
        
        forgot_data = forgot_response.json()
        if not forgot_data.get('ok'):
            print(f"❌ Forgot password response invalid: {forgot_data}")
            return False
        
        print("✅ Forgot password request successful")
        
        # Step 4: Get reset OTP from database
        print("\n4️⃣ Retrieving reset OTP from database...")
        
        reset_otp = get_reset_otp(email)
        if not reset_otp:
            print("❌ Failed to retrieve reset OTP from database")
            return False
        
        print(f"✅ Retrieved reset OTP: {reset_otp}")
        
        # Step 5: Test wrong OTP on reset password
        print("\n5️⃣ Testing wrong OTP on reset password...")
        
        wrong_reset_response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": email,
            "otp": "000000",
            "new_password": new_password
        })
        
        if wrong_reset_response.status_code != 400:
            print(f"❌ Wrong OTP should return 400, got: {wrong_reset_response.status_code}")
            return False
        
        wrong_data = wrong_reset_response.json()
        if "Invalid code" not in wrong_data.get('error', ''):
            print(f"❌ Wrong OTP error message incorrect: {wrong_data}")
            return False
        
        print("✅ Wrong OTP correctly rejected with 'Invalid code'")
        
        # Step 6: Test short password
        print("\n6️⃣ Testing short password validation...")
        
        short_pass_response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": email,
            "otp": reset_otp,
            "new_password": "abc"
        })
        
        if short_pass_response.status_code != 400:
            print(f"❌ Short password should return 400, got: {short_pass_response.status_code}")
            return False
        
        short_data = short_pass_response.json()
        if "at least 6 characters" not in short_data.get('error', ''):
            print(f"❌ Short password error message incorrect: {short_data}")
            return False
        
        print("✅ Short password correctly rejected")
        
        # Step 7: Reset password with correct OTP
        print("\n7️⃣ Resetting password with correct OTP...")
        
        reset_response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": email,
            "otp": reset_otp,
            "new_password": new_password
        })
        
        if reset_response.status_code != 200:
            print(f"❌ Password reset failed: {reset_response.status_code} - {reset_response.text}")
            return False
        
        reset_data = reset_response.json()
        if not reset_data.get('ok') or not reset_data.get('session'):
            print(f"❌ Password reset response invalid: {reset_data}")
            return False
        
        print("✅ Password reset successful with auto-signin")
        
        # Step 8: Verify login with old password fails
        print("\n8️⃣ Verifying old password no longer works...")
        
        old_login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": old_password
        })
        
        if old_login_response.status_code != 401:
            print(f"❌ Old password should fail with 401, got: {old_login_response.status_code}")
            return False
        
        print("✅ Old password correctly rejected")
        
        # Step 9: Verify login with new password works
        print("\n9️⃣ Verifying new password works...")
        
        new_login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": new_password
        })
        
        if new_login_response.status_code != 200:
            print(f"❌ New password login failed: {new_login_response.status_code} - {new_login_response.text}")
            return False
        
        print("✅ New password login successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

def test_anti_enumeration():
    """Test anti-enumeration protection"""
    print("\n🔒 Testing Anti-Enumeration Protection")
    print("=" * 50)
    
    try:
        # Test forgot password with non-existent email
        nonexistent_email = f"nonexistent_user_{uuid.uuid4()}@example.com"
        
        forgot_response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": nonexistent_email
        })
        
        if forgot_response.status_code != 200:
            print(f"❌ Anti-enumeration failed: {forgot_response.status_code} - {forgot_response.text}")
            return False
        
        forgot_data = forgot_response.json()
        if not forgot_data.get('ok'):
            print(f"❌ Anti-enumeration response invalid: {forgot_data}")
            return False
        
        print("✅ Anti-enumeration protection working - returns 200 for non-existent email")
        
        # Verify no OTP was created for non-existent email
        otp = get_otp(nonexistent_email)
        if otp:
            print(f"❌ OTP should not be created for non-existent email, but got: {otp}")
            return False
        
        print("✅ No OTP created for non-existent email")
        
        return True
        
    except Exception as e:
        print(f"❌ Anti-enumeration test failed: {e}")
        return False

def test_reset_otp_rejection_in_verify():
    """Test that reset OTPs are rejected in verify-otp endpoint"""
    print("\n🚫 Testing Reset OTP Rejection in Verify-OTP")
    print("=" * 50)
    
    # Generate unique test email
    test_uuid = str(uuid.uuid4())[:8]
    email = f"w2w_reset_reject_{test_uuid}@example.com"
    password = "TestPass123!"
    
    try:
        # Step 1: Create a user first
        print("1️⃣ Creating user for reset OTP test...")
        
        # Send OTP for signup
        signup_otp_response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "email": email,
            "password": password,
            "role": "worker",
            "full_name": "Test Worker"
        })
        
        if signup_otp_response.status_code != 200:
            print(f"❌ Failed to send signup OTP: {signup_otp_response.status_code}")
            return False
        
        # Get and verify signup OTP
        signup_otp = get_otp(email)
        if not signup_otp:
            print("❌ Failed to get signup OTP")
            return False
        
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "email": email,
            "otp": signup_otp
        })
        
        if verify_response.status_code != 200:
            print(f"❌ Failed to verify signup OTP: {verify_response.status_code}")
            return False
        
        print("✅ User created successfully")
        
        # Step 2: Generate a reset OTP
        print("2️⃣ Generating reset OTP...")
        
        forgot_response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": email
        })
        
        if forgot_response.status_code != 200:
            print(f"❌ Failed to generate reset OTP: {forgot_response.status_code}")
            return False
        
        # Get reset OTP
        reset_otp = get_reset_otp(email)
        if not reset_otp:
            print("❌ Failed to get reset OTP")
            return False
        
        print(f"✅ Reset OTP generated: {reset_otp}")
        
        # Step 3: Try to use reset OTP in verify-otp endpoint
        print("3️⃣ Testing reset OTP rejection in verify-otp...")
        
        verify_reset_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "email": email,
            "otp": reset_otp
        })
        
        if verify_reset_response.status_code != 400:
            print(f"❌ Reset OTP should be rejected with 400, got: {verify_reset_response.status_code}")
            return False
        
        verify_data = verify_reset_response.json()
        expected_message = "This code is for password reset, not signup."
        if expected_message not in verify_data.get('error', ''):
            print(f"❌ Wrong error message. Expected '{expected_message}', got: {verify_data}")
            return False
        
        print("✅ Reset OTP correctly rejected in verify-otp endpoint")
        
        return True
        
    except Exception as e:
        print(f"❌ Reset OTP rejection test failed: {e}")
        return False

def test_regression_signup_login():
    """Quick regression test for existing signup/login flow"""
    print("\n🔄 Regression Test: Signup/Login Flow")
    print("=" * 40)
    
    # Generate unique test email
    test_uuid = str(uuid.uuid4())[:8]
    email = f"w2w_regression_{test_uuid}@example.com"
    password = "RegTest123!"
    
    try:
        # Test signup flow
        print("1️⃣ Testing signup flow...")
        
        signup_otp_response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "email": email,
            "password": password,
            "role": "employer",
            "full_name": "Test Employer"
        })
        
        if signup_otp_response.status_code != 200:
            print(f"❌ Signup OTP failed: {signup_otp_response.status_code}")
            return False
        
        signup_otp = get_otp(email)
        if not signup_otp:
            print("❌ Failed to get signup OTP")
            return False
        
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "email": email,
            "otp": signup_otp
        })
        
        if verify_response.status_code != 200:
            print(f"❌ Signup verification failed: {verify_response.status_code}")
            return False
        
        verify_data = verify_response.json()
        login_id = verify_data.get('login_id')
        
        print(f"✅ Signup successful, login_id: {login_id}")
        
        # Test login flow
        print("2️⃣ Testing login flow...")
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False
        
        login_data = login_response.json()
        if login_data.get('login_id') != login_id:
            print(f"❌ Login_id mismatch: {login_data.get('login_id')} vs {login_id}")
            return False
        
        print("✅ Login successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Regression test failed: {e}")
        return False

def test_missing_fields():
    """Test error handling for missing required fields"""
    print("\n❗ Testing Missing Field Validation")
    print("=" * 40)
    
    try:
        # Test forgot-password without email
        print("1️⃣ Testing forgot-password without email...")
        
        forgot_response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={})
        
        if forgot_response.status_code != 400:
            print(f"❌ Should return 400 for missing email, got: {forgot_response.status_code}")
            return False
        
        print("✅ Forgot-password correctly rejects missing email")
        
        # Test reset-password with missing fields
        print("2️⃣ Testing reset-password with missing fields...")
        
        reset_response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": "test@example.com"
            # Missing otp and new_password
        })
        
        if reset_response.status_code != 400:
            print(f"❌ Should return 400 for missing fields, got: {reset_response.status_code}")
            return False
        
        print("✅ Reset-password correctly rejects missing fields")
        
        return True
        
    except Exception as e:
        print(f"❌ Missing field validation test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Work2Wish Forgot Password / Reset Password Tests")
    print("=" * 70)
    
    tests = [
        ("Forgot Password / Reset Password Flow", test_forgot_password_reset_flow),
        ("Anti-Enumeration Protection", test_anti_enumeration),
        ("Reset OTP Rejection in Verify-OTP", test_reset_otp_rejection_in_verify),
        ("Regression: Signup/Login Flow", test_regression_signup_login),
        ("Missing Field Validation", test_missing_fields),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*70}")
        print(f"🧪 Running: {test_name}")
        print(f"{'='*70}")
        
        try:
            result = test_func()
            results.append((test_name, result))
            
            if result:
                print(f"\n✅ {test_name} - PASSED")
            else:
                print(f"\n❌ {test_name} - FAILED")
                
        except Exception as e:
            print(f"\n💥 {test_name} - ERROR: {e}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'='*70}")
    print("📊 TEST SUMMARY")
    print(f"{'='*70}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n🎯 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Forgot password / reset password functionality is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please review the output above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)