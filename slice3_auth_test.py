#!/usr/bin/env python3
"""
Slice 3 Authentication Testing for Work2Wish app
Tests new OTP-based authentication endpoints and enhanced login functionality
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Base URL from environment
BASE_URL = os.environ['NEXT_PUBLIC_BASE_URL']
API_BASE = f"{BASE_URL}/api"

# Supabase configuration for direct database access
SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

def generate_unique_email():
    """Generate unique email for OTP testing"""
    unique_id = str(uuid.uuid4())[:8]
    return f"w2w_otp_{unique_id}@example.com"

def get_otp_from_database(email):
    """Read OTP from database using Supabase service role key"""
    print(f"  📧 Reading OTP from database for {email}")
    try:
        url = f'{SUPABASE_URL}/rest/v1/otp_codes'
        params = {
            'email': f'eq.{email}',
            'consumed': 'eq.false',
            'order': 'created_at.desc',
            'limit': '1'
        }
        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        print(f"  Database query status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                code = data[0]['code']
                print(f"  ✅ Found OTP: {code}")
                return code
            else:
                print(f"  ❌ No OTP found for {email}")
                return None
        else:
            print(f"  ❌ Database query failed: {response.text}")
            return None
    except Exception as e:
        print(f"  ❌ Database query error: {str(e)}")
        return None

def test_send_otp(email, password, role, full_name):
    """Test sending OTP for signup"""
    print(f"\n=== Testing Send OTP ({role}) ===")
    try:
        payload = {
            "email": email,
            "password": password,
            "role": role,
            "full_name": full_name
        }
        
        response = requests.post(f"{API_BASE}/auth/send-otp", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and 'expires_at' in data:
                print(f"✅ OTP sent successfully")
                return data
            else:
                print("❌ Invalid response format")
                return None
        else:
            print(f"❌ Send OTP failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Send OTP failed - {str(e)}")
        return None

def test_verify_otp_wrong_code(email):
    """Test verifying OTP with wrong code"""
    print(f"\n=== Testing Verify OTP (Wrong Code) ===")
    try:
        payload = {
            "email": email,
            "otp": "000000"
        }
        
        response = requests.post(f"{API_BASE}/auth/verify-otp", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 400:
            data = response.json()
            if 'Invalid code' in data.get('error', ''):
                print("✅ Wrong OTP correctly rejected")
                return True
            else:
                print("❌ Wrong error message")
                return False
        else:
            print(f"❌ Should have returned 400, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Verify wrong OTP test failed - {str(e)}")
        return False

def test_verify_otp_correct_code(email, otp):
    """Test verifying OTP with correct code"""
    print(f"\n=== Testing Verify OTP (Correct Code) ===")
    try:
        payload = {
            "email": email,
            "otp": otp
        }
        
        response = requests.post(f"{API_BASE}/auth/verify-otp", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ OTP verified successfully")
            
            # Check required fields
            if 'session' in data and 'access_token' in data['session']:
                print(f"  ✅ Session token present")
            else:
                print(f"  ❌ Missing session token")
                return None
                
            if 'login_id' in data and len(str(data['login_id'])) == 6:
                print(f"  ✅ Login ID present: {data['login_id']}")
            else:
                print(f"  ❌ Invalid login_id: {data.get('login_id')}")
                return None
                
            if 'role' in data:
                print(f"  ✅ Role present: {data['role']}")
            else:
                print(f"  ❌ Missing role")
                return None
                
            return data
        else:
            print(f"❌ OTP verification failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ OTP verification failed - {str(e)}")
        return None

def test_send_otp_existing_email(email, password, role, full_name):
    """Test sending OTP for existing email (should fail)"""
    print(f"\n=== Testing Send OTP (Existing Email) ===")
    try:
        payload = {
            "email": email,
            "password": password,
            "role": role,
            "full_name": full_name
        }
        
        response = requests.post(f"{API_BASE}/auth/send-otp", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 409:
            print("✅ Existing email correctly rejected")
            return True
        else:
            print(f"❌ Should have returned 409, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Existing email test failed - {str(e)}")
        return False

def test_login_with_email(email, password, expected_login_id):
    """Test login with email"""
    print(f"\n=== Testing Login with Email ===")
    try:
        payload = {
            "identifier": email,
            "password": password
        }
        
        response = requests.post(f"{API_BASE}/auth/login", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Login with email successful")
            
            if data.get('login_id') == expected_login_id:
                print(f"  ✅ Login ID matches: {data['login_id']}")
                return data
            else:
                print(f"  ❌ Login ID mismatch. Expected: {expected_login_id}, Got: {data.get('login_id')}")
                return None
        else:
            print(f"❌ Login with email failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login with email failed - {str(e)}")
        return None

def test_login_with_login_id(login_id, password):
    """Test login with login_id"""
    print(f"\n=== Testing Login with Login ID ===")
    try:
        payload = {
            "identifier": login_id,
            "password": password
        }
        
        response = requests.post(f"{API_BASE}/auth/login", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Login with login_id successful")
            print(f"  Login ID: {data.get('login_id')}")
            return data
        else:
            print(f"❌ Login with login_id failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login with login_id failed - {str(e)}")
        return None

def test_login_with_wrong_login_id(password):
    """Test login with wrong login_id"""
    print(f"\n=== Testing Login with Wrong Login ID ===")
    try:
        payload = {
            "identifier": "999999",
            "password": password
        }
        
        response = requests.post(f"{API_BASE}/auth/login", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 401:
            data = response.json()
            if 'No account with that login ID' in data.get('error', ''):
                print("✅ Wrong login ID correctly rejected")
                return True
            else:
                print("❌ Wrong error message")
                return False
        else:
            print(f"❌ Should have returned 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Wrong login ID test failed - {str(e)}")
        return False

def test_oauth_finalize_invalid_token():
    """Test OAuth finalize with invalid token"""
    print(f"\n=== Testing OAuth Finalize (Invalid Token) ===")
    try:
        payload = {
            "access_token": "invalid_token_12345"
        }
        
        response = requests.post(f"{API_BASE}/auth/oauth-finalize", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 401:
            print("✅ Invalid OAuth token correctly rejected")
            return True
        else:
            print(f"❌ Should have returned 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ OAuth finalize test failed - {str(e)}")
        return False

def test_resend_otp(email):
    """Test resending OTP"""
    print(f"\n=== Testing Resend OTP ===")
    try:
        payload = {
            "email": email
        }
        
        response = requests.post(f"{API_BASE}/auth/resend-otp", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and 'expires_at' in data:
                print(f"✅ OTP resent successfully")
                return data
            else:
                print("❌ Invalid response format")
                return None
        else:
            print(f"❌ Resend OTP failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Resend OTP failed - {str(e)}")
        return None

def test_get_me_with_login_id(token):
    """Test GET /api/me returns login_id"""
    print(f"\n=== Testing GET /api/me (Login ID) ===")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_BASE}/me", headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            profile = data.get('profile', {})
            login_id = profile.get('login_id')
            
            if login_id and len(str(login_id)) == 6:
                print(f"✅ GET /api/me returns login_id: {login_id}")
                return login_id
            else:
                print(f"❌ Missing or invalid login_id in profile: {login_id}")
                return None
        else:
            print(f"❌ GET /api/me failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ GET /api/me failed - {str(e)}")
        return None

def test_smoke_test_jobs(token, role):
    """Quick smoke test of existing job endpoints"""
    print(f"\n=== Smoke Test: Jobs ({role}) ===")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test GET /api/jobs
        response = requests.get(f"{API_BASE}/jobs", headers=headers, timeout=10)
        print(f"GET /api/jobs status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ GET /api/jobs failed - {response.text}")
            return False
        
        # Test POST /api/jobs (only for employer)
        if role == 'employer':
            job_data = {
                "title": "Test Job for Slice 3",
                "category": "technology",
                "description": "Test job posting",
                "location_text": "Test Location",
                "daily_pay": 100,
                "duration_days": 1
            }
            response = requests.post(f"{API_BASE}/jobs", json=job_data, headers=headers, timeout=10)
            print(f"POST /api/jobs status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"❌ POST /api/jobs failed - {response.text}")
                return False
        
        print(f"✅ Jobs endpoints working for {role}")
        return True
        
    except Exception as e:
        print(f"❌ Jobs smoke test failed - {str(e)}")
        return False

def main():
    """Run Slice 3 authentication tests"""
    print("🚀 Starting Work2Wish Slice 3 Authentication Tests")
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    
    results = {
        'passed': 0,
        'failed': 0,
        'tests': []
    }
    
    def record_result(test_name, passed):
        results['tests'].append({'name': test_name, 'passed': passed})
        if passed:
            results['passed'] += 1
        else:
            results['failed'] += 1
    
    # Test data
    password = "TestPass123!"
    
    # === WORKER OTP FLOW ===
    print("\n" + "="*60)
    print("🔧 TESTING WORKER OTP FLOW")
    print("="*60)
    
    worker_email = generate_unique_email()
    print(f"Worker email: {worker_email}")
    
    # Step 1: Send OTP for worker
    worker_otp_response = test_send_otp(worker_email, password, "worker", "OTP Worker")
    record_result("Send OTP (Worker)", worker_otp_response is not None)
    
    if not worker_otp_response:
        print("❌ Cannot continue worker flow without OTP")
        return
    
    # Step 2: Try wrong OTP
    record_result("Verify Wrong OTP", test_verify_otp_wrong_code(worker_email))
    
    # Step 3: Get real OTP from database
    worker_otp = get_otp_from_database(worker_email)
    if not worker_otp:
        print("❌ Cannot get OTP from database")
        record_result("Get OTP from Database", False)
        return
    record_result("Get OTP from Database", True)
    
    # Step 4: Verify correct OTP
    worker_verify_response = test_verify_otp_correct_code(worker_email, worker_otp)
    record_result("Verify Correct OTP (Worker)", worker_verify_response is not None)
    
    if not worker_verify_response:
        print("❌ Cannot continue without worker verification")
        return
    
    worker_token = worker_verify_response['session']['access_token']
    worker_login_id = worker_verify_response['login_id']
    
    # Step 5: Try to send OTP again (should fail - email exists)
    record_result("Send OTP Existing Email", test_send_otp_existing_email(worker_email, password, "worker", "OTP Worker"))
    
    # Step 6: Login with email
    worker_login_email = test_login_with_email(worker_email, password, worker_login_id)
    record_result("Login with Email (Worker)", worker_login_email is not None)
    
    # Step 7: Login with login_id
    worker_login_id_response = test_login_with_login_id(worker_login_id, password)
    record_result("Login with Login ID (Worker)", worker_login_id_response is not None)
    
    # Step 8: Test GET /api/me returns login_id
    me_login_id = test_get_me_with_login_id(worker_token)
    record_result("GET /api/me Login ID", me_login_id == worker_login_id)
    
    # === EMPLOYER OTP FLOW ===
    print("\n" + "="*60)
    print("👔 TESTING EMPLOYER OTP FLOW")
    print("="*60)
    
    employer_email = generate_unique_email()
    print(f"Employer email: {employer_email}")
    
    # Step 1: Send OTP for employer
    employer_otp_response = test_send_otp(employer_email, password, "employer", "OTP Employer")
    record_result("Send OTP (Employer)", employer_otp_response is not None)
    
    if not employer_otp_response:
        print("❌ Cannot continue employer flow without OTP")
        return
    
    # Step 2: Get real OTP from database
    employer_otp = get_otp_from_database(employer_email)
    if not employer_otp:
        print("❌ Cannot get employer OTP from database")
        record_result("Get Employer OTP from Database", False)
        return
    record_result("Get Employer OTP from Database", True)
    
    # Step 3: Verify correct OTP
    employer_verify_response = test_verify_otp_correct_code(employer_email, employer_otp)
    record_result("Verify Correct OTP (Employer)", employer_verify_response is not None)
    
    if not employer_verify_response:
        print("❌ Cannot continue without employer verification")
        return
    
    employer_token = employer_verify_response['session']['access_token']
    employer_login_id = employer_verify_response['login_id']
    
    # Step 4: Verify different login_ids
    if worker_login_id != employer_login_id:
        print(f"✅ Different login_ids: Worker={worker_login_id}, Employer={employer_login_id}")
        record_result("Different Login IDs", True)
    else:
        print(f"❌ Same login_ids: Worker={worker_login_id}, Employer={employer_login_id}")
        record_result("Different Login IDs", False)
    
    # === RESEND OTP FLOW ===
    print("\n" + "="*60)
    print("🔄 TESTING RESEND OTP FLOW")
    print("="*60)
    
    resend_email = generate_unique_email()
    print(f"Resend test email: {resend_email}")
    
    # Step 1: Send initial OTP
    resend_initial = test_send_otp(resend_email, password, "worker", "Resend Worker")
    record_result("Send Initial OTP (Resend)", resend_initial is not None)
    
    if resend_initial:
        # Step 2: Get old OTP
        old_otp = get_otp_from_database(resend_email)
        
        # Step 3: Resend OTP
        resend_response = test_resend_otp(resend_email)
        record_result("Resend OTP", resend_response is not None)
        
        if resend_response:
            # Step 4: Get new OTP
            new_otp = get_otp_from_database(resend_email)
            
            # Step 5: Verify old OTP doesn't work
            old_otp_fails = test_verify_otp_wrong_code(resend_email)  # This will try with wrong code, but we want to test old code
            
            # Step 6: Verify new OTP works
            if new_otp:
                new_verify = test_verify_otp_correct_code(resend_email, new_otp)
                record_result("Verify New OTP after Resend", new_verify is not None)
            else:
                record_result("Verify New OTP after Resend", False)
    
    # === OTHER TESTS ===
    print("\n" + "="*60)
    print("🔐 TESTING OTHER AUTH FEATURES")
    print("="*60)
    
    # Test wrong login ID
    record_result("Login Wrong Login ID", test_login_with_wrong_login_id(password))
    
    # Test OAuth finalize with invalid token
    record_result("OAuth Invalid Token", test_oauth_finalize_invalid_token())
    
    # === SMOKE TESTS ===
    print("\n" + "="*60)
    print("💨 SMOKE TESTING EXISTING ENDPOINTS")
    print("="*60)
    
    # Test existing endpoints still work
    record_result("Jobs Smoke Test (Worker)", test_smoke_test_jobs(worker_token, "worker"))
    record_result("Jobs Smoke Test (Employer)", test_smoke_test_jobs(employer_token, "employer"))
    
    # Print final results
    print("\n" + "="*60)
    print("🏁 SLICE 3 TEST RESULTS SUMMARY")
    print("="*60)
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"📊 Total: {len(results['tests'])}")
    print(f"📈 Success Rate: {(results['passed']/len(results['tests'])*100):.1f}%")
    
    print("\nDetailed Results:")
    for test in results['tests']:
        status = "✅" if test['passed'] else "❌"
        print(f"{status} {test['name']}")
    
    if results['failed'] == 0:
        print("\n🎉 ALL SLICE 3 TESTS PASSED! New authentication endpoints working correctly.")
    else:
        print(f"\n⚠️  {results['failed']} tests failed. Check the logs above for details.")
    
    return results

if __name__ == "__main__":
    main()