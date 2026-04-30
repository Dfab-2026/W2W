#!/usr/bin/env python3
"""
Debug script to check authentication flow
"""

import requests
import json
import random
import string

# Base URL from environment
BASE_URL = "https://w2w-dual-role.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def generate_random_email(prefix):
    """Generate unique email for testing"""
    rand_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"w2w_test_{prefix}_{rand_suffix}@example.com"

def debug_auth_flow():
    """Debug the authentication flow"""
    print("🔍 Debugging Authentication Flow")
    
    # Generate test data
    employer_email = generate_random_email("emp_debug")
    password = "TestPass123!"
    
    print(f"Test email: {employer_email}")
    
    # Test signup
    print("\n=== Testing Signup ===")
    signup_payload = {
        "email": employer_email,
        "password": password,
        "role": "employer",
        "full_name": "Debug Employer"
    }
    
    signup_response = requests.post(f"{API_BASE}/auth/signup", json=signup_payload, timeout=10)
    print(f"Signup Status: {signup_response.status_code}")
    print(f"Signup Response: {signup_response.text}")
    
    if signup_response.status_code != 200:
        print("❌ Signup failed")
        return
    
    signup_data = signup_response.json()
    print(f"Signup successful - User ID: {signup_data.get('user', {}).get('id')}")
    
    # Extract token from signup
    signup_token = signup_data.get('session', {}).get('access_token')
    print(f"Signup token: {signup_token[:50]}..." if signup_token else "No token from signup")
    
    # Test login
    print("\n=== Testing Login ===")
    login_payload = {
        "email": employer_email,
        "password": password
    }
    
    login_response = requests.post(f"{API_BASE}/auth/login", json=login_payload, timeout=10)
    print(f"Login Status: {login_response.status_code}")
    print(f"Login Response: {login_response.text}")
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return
    
    login_data = login_response.json()
    print(f"Login successful - Role: {login_data.get('role')}")
    
    # Extract token from login
    login_token = login_data.get('session', {}).get('access_token')
    print(f"Login token: {login_token[:50]}..." if login_token else "No token from login")
    
    # Test /me with both tokens
    for token_name, token in [("signup", signup_token), ("login", login_token)]:
        if not token:
            print(f"⚠️  No {token_name} token to test")
            continue
            
        print(f"\n=== Testing /me with {token_name} token ===")
        headers = {"Authorization": f"Bearer {token}"}
        me_response = requests.get(f"{API_BASE}/me", headers=headers, timeout=10)
        print(f"/me Status: {me_response.status_code}")
        print(f"/me Response: {me_response.text}")
        
        if me_response.status_code == 200:
            me_data = me_response.json()
            profile = me_data.get('profile')
            if profile:
                print(f"Profile role: {profile.get('role')}")
                print(f"Profile name: {profile.get('full_name')}")
            else:
                print("⚠️  No profile in response")
        
        # Test posting job with this token
        print(f"\n=== Testing job posting with {token_name} token ===")
        job_data = {
            "title": "Debug Job",
            "category": "technology",
            "description": "Test job for debugging",
            "location_text": "Test Location",
            "daily_pay": 100,
            "duration_days": 1
        }
        
        job_response = requests.post(f"{API_BASE}/jobs", json=job_data, headers=headers, timeout=10)
        print(f"Job posting Status: {job_response.status_code}")
        print(f"Job posting Response: {job_response.text}")

if __name__ == "__main__":
    debug_auth_flow()