#!/usr/bin/env python3
"""
Debug script to check database state after signup
"""

import requests
import json
import random
import string
import time

# Base URL from environment
BASE_URL = "https://w2w-dual-role.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def generate_random_email(prefix):
    """Generate unique email for testing"""
    rand_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"w2w_test_{prefix}_{rand_suffix}@example.com"

def debug_profile_creation():
    """Debug profile creation after signup"""
    print("🔍 Debugging Profile Creation")
    
    # Generate test data
    employer_email = generate_random_email("emp_profile")
    password = "TestPass123!"
    
    print(f"Test email: {employer_email}")
    
    # Test signup
    print("\n=== Testing Signup ===")
    signup_payload = {
        "email": employer_email,
        "password": password,
        "role": "employer",
        "full_name": "Profile Debug Employer"
    }
    
    signup_response = requests.post(f"{API_BASE}/auth/signup", json=signup_payload, timeout=10)
    print(f"Signup Status: {signup_response.status_code}")
    
    if signup_response.status_code != 200:
        print(f"❌ Signup failed: {signup_response.text}")
        return
    
    signup_data = signup_response.json()
    user_id = signup_data.get('user', {}).get('id')
    print(f"✅ Signup successful - User ID: {user_id}")
    print(f"Signup role returned: {signup_data.get('role')}")
    
    # Wait a moment for database consistency
    print("\n⏳ Waiting 2 seconds for database consistency...")
    time.sleep(2)
    
    # Test immediate login
    print("\n=== Testing Immediate Login ===")
    login_payload = {
        "email": employer_email,
        "password": password
    }
    
    login_response = requests.post(f"{API_BASE}/auth/login", json=login_payload, timeout=10)
    print(f"Login Status: {login_response.status_code}")
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    login_data = login_response.json()
    print(f"Login role returned: {login_data.get('role')}")
    print(f"Profile in login: {login_data.get('profile')}")
    
    # Test /me endpoint
    token = login_data.get('session', {}).get('access_token')
    if token:
        print("\n=== Testing /me endpoint ===")
        headers = {"Authorization": f"Bearer {token}"}
        me_response = requests.get(f"{API_BASE}/me", headers=headers, timeout=10)
        print(f"/me Status: {me_response.status_code}")
        
        if me_response.status_code == 200:
            me_data = me_response.json()
            print(f"Profile from /me: {me_data.get('profile')}")
            print(f"Extra from /me: {me_data.get('extra')}")
        else:
            print(f"❌ /me failed: {me_response.text}")

if __name__ == "__main__":
    debug_profile_creation()