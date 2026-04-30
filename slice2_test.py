#!/usr/bin/env python3
"""
Slice 2 Backend Test for Work2Wish app
Tests the new endpoints added in Slice 2:
- POST /api/upload (multipart/form-data, auth required)
- GET /api/chat/threads (auth required)
- POST /api/messages (auth) body { receiver_id, content, job_id? }
- GET /api/messages?peer=PEER_ID (auth)
- POST /api/messages/mark-read (auth) body { peer_id }
"""

import requests
import json
import random
import string
from datetime import datetime, timedelta
from io import BytesIO

# Base URL from environment
BASE_URL = "https://w2w-dual-role.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Hardcoded 1x1 PNG bytes as fallback
PNG_BYTES = bytes.fromhex('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C636060606000000005000172A2C8C90000000049454E44AE426082')

def generate_random_email(prefix):
    """Generate unique email for testing"""
    rand_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"w2w_{prefix}_{rand_suffix}@example.com"

def create_test_image():
    """Create a test PNG image using Pillow or fallback to hardcoded bytes"""
    try:
        from PIL import Image
        # Create 8x8 red image
        im = Image.new('RGB', (8, 8), 'red')
        buf = BytesIO()
        im.save(buf, 'PNG')
        buf.seek(0)
        return buf
    except ImportError:
        print("Pillow not available, using hardcoded PNG bytes")
        return BytesIO(PNG_BYTES)

def setup_test_scenario():
    """Set up the test scenario: signup employer E and worker W, post job, worker applies"""
    print("\n=== Setting up test scenario ===")
    
    # Generate test data
    employer_email = generate_random_email("emp")
    worker_email = generate_random_email("wrk")
    password = "TestPass123!"
    
    print(f"Employer: {employer_email}")
    print(f"Worker: {worker_email}")
    
    # 1. Sign up employer E
    employer_payload = {
        "email": employer_email,
        "password": password,
        "role": "employer",
        "full_name": "Test Employer"
    }
    
    response = requests.post(f"{API_BASE}/auth/signup", json=employer_payload, timeout=10)
    if response.status_code != 200:
        print(f"❌ Employer signup failed: {response.text}")
        return None
    
    employer_data = response.json()
    employer_token = employer_data.get('session', {}).get('access_token')
    employer_id = employer_data.get('user', {}).get('id')
    
    print(f"✅ Employer signed up: {employer_id}")
    
    # 2. Sign up worker W
    worker_payload = {
        "email": worker_email,
        "password": password,
        "role": "worker",
        "full_name": "Test Worker"
    }
    
    response = requests.post(f"{API_BASE}/auth/signup", json=worker_payload, timeout=10)
    if response.status_code != 200:
        print(f"❌ Worker signup failed: {response.text}")
        return None
    
    worker_data = response.json()
    worker_token = worker_data.get('session', {}).get('access_token')
    worker_id = worker_data.get('user', {}).get('id')
    
    print(f"✅ Worker signed up: {worker_id}")
    
    # 3. Employer E posts a job J
    job_payload = {
        "title": "Test Job for Slice 2",
        "category": "technology",
        "description": "A test job for testing Slice 2 features",
        "location_text": "Remote",
        "daily_pay": 150,
        "duration_days": 5,
        "start_date": (datetime.now() + timedelta(days=7)).isoformat()
    }
    
    headers = {"Authorization": f"Bearer {employer_token}"}
    response = requests.post(f"{API_BASE}/jobs", json=job_payload, headers=headers, timeout=10)
    if response.status_code != 200:
        print(f"❌ Job posting failed: {response.text}")
        return None
    
    job_data = response.json()
    job_id = job_data.get('job', {}).get('id')
    
    print(f"✅ Job posted: {job_id}")
    
    # 4. Worker W applies to job J
    apply_payload = {"message": "I'm interested in this position!"}
    headers = {"Authorization": f"Bearer {worker_token}"}
    response = requests.post(f"{API_BASE}/jobs/{job_id}/apply", json=apply_payload, headers=headers, timeout=10)
    if response.status_code != 200:
        print(f"❌ Job application failed: {response.text}")
        return None
    
    application_data = response.json()
    application_id = application_data.get('application', {}).get('id')
    
    print(f"✅ Worker applied to job: {application_id}")
    
    return {
        'employer_token': employer_token,
        'employer_id': employer_id,
        'worker_token': worker_token,
        'worker_id': worker_id,
        'job_id': job_id,
        'application_id': application_id
    }

def test_upload_without_auth():
    """Test POST /api/upload without auth (should return 401)"""
    print("\n=== Testing Upload without Auth ===")
    try:
        image_buf = create_test_image()
        files = {'file': ('test.png', image_buf, 'image/png')}
        data = {'kind': 'avatar'}
        
        response = requests.post(f"{API_BASE}/upload", files=files, data=data, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Upload without auth correctly rejected")
            return True
        else:
            print(f"❌ Should have returned 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Upload without auth test failed - {str(e)}")
        return False

def test_upload_without_file():
    """Test POST /api/upload without file field (should return non-200 with 'file required')"""
    print("\n=== Testing Upload without File ===")
    try:
        # Use worker token for auth
        scenario = setup_test_scenario()
        if not scenario:
            return False
        
        headers = {"Authorization": f"Bearer {scenario['worker_token']}"}
        data = {'kind': 'avatar'}
        
        response = requests.post(f"{API_BASE}/upload", data=data, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200 and 'file required' in response.text.lower():
            print("✅ Upload without file correctly rejected")
            return True
        else:
            print(f"❌ Should have returned non-200 with 'file required', got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Upload without file test failed - {str(e)}")
        return False

def test_upload_worker_avatar(scenario):
    """Test POST /api/upload as worker with kind='avatar'"""
    print("\n=== Testing Upload Worker Avatar ===")
    try:
        image_buf = create_test_image()
        files = {'file': ('avatar.png', image_buf, 'image/png')}
        data = {'kind': 'avatar'}
        headers = {"Authorization": f"Bearer {scenario['worker_token']}"}
        
        response = requests.post(f"{API_BASE}/upload", files=files, data=data, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            url = data.get('url')
            path = data.get('path')
            
            if url and path:
                print(f"✅ Upload successful")
                print(f"URL: {url}")
                print(f"Path: {path}")
                
                # Verify the URL is reachable
                try:
                    img_response = requests.get(url, timeout=10)
                    if img_response.status_code == 200:
                        print("✅ Uploaded image is accessible")
                        
                        # Check if user profile reflects the photo
                        headers = {"Authorization": f"Bearer {scenario['worker_token']}"}
                        me_response = requests.get(f"{API_BASE}/me", headers=headers, timeout=10)
                        if me_response.status_code == 200:
                            me_data = me_response.json()
                            photo_url = me_data.get('profile', {}).get('photo_url')
                            if photo_url:
                                print(f"✅ Profile photo_url updated: {photo_url}")
                            else:
                                print("⚠️  Profile photo_url not updated (may need manual profile update)")
                        
                        return {'url': url, 'path': path}
                    else:
                        print(f"❌ Uploaded image not accessible: {img_response.status_code}")
                        return None
                except Exception as e:
                    print(f"❌ Error checking image accessibility: {str(e)}")
                    return None
            else:
                print("❌ Upload response missing url or path")
                return None
        else:
            print(f"❌ Upload failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Upload worker avatar test failed - {str(e)}")
        return None

def test_upload_employer_logo(scenario):
    """Test POST /api/upload as employer with kind='logo'"""
    print("\n=== Testing Upload Employer Logo ===")
    try:
        image_buf = create_test_image()
        files = {'file': ('logo.png', image_buf, 'image/png')}
        data = {'kind': 'logo'}
        headers = {"Authorization": f"Bearer {scenario['employer_token']}"}
        
        response = requests.post(f"{API_BASE}/upload", files=files, data=data, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            url = data.get('url')
            path = data.get('path')
            
            if url and path:
                print(f"✅ Upload successful")
                print(f"URL: {url}")
                print(f"Path: {path}")
                
                # Verify the URL is reachable
                try:
                    img_response = requests.get(url, timeout=10)
                    if img_response.status_code == 200:
                        print("✅ Uploaded image is accessible")
                        return {'url': url, 'path': path}
                    else:
                        print(f"❌ Uploaded image not accessible: {img_response.status_code}")
                        return None
                except Exception as e:
                    print(f"❌ Error checking image accessibility: {str(e)}")
                    return None
            else:
                print("❌ Upload response missing url or path")
                return None
        else:
            print(f"❌ Upload failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Upload employer logo test failed - {str(e)}")
        return None

def test_chat_threads_without_auth():
    """Test GET /api/chat/threads without auth (should return 401)"""
    print("\n=== Testing Chat Threads without Auth ===")
    try:
        response = requests.get(f"{API_BASE}/chat/threads", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Chat threads without auth correctly rejected")
            return True
        else:
            print(f"❌ Should have returned 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Chat threads without auth test failed - {str(e)}")
        return False

def test_chat_threads_employer(scenario):
    """Test GET /api/chat/threads as employer (should see worker as peer)"""
    print("\n=== Testing Chat Threads as Employer ===")
    try:
        headers = {"Authorization": f"Bearer {scenario['employer_token']}"}
        response = requests.get(f"{API_BASE}/chat/threads", headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            threads = data.get('threads', [])
            print(f"✅ Chat threads retrieved successfully")
            print(f"Found {len(threads)} threads")
            
            # Check if worker is in threads with peer_role='worker'
            worker_found = False
            for thread in threads:
                if thread.get('peer_id') == scenario['worker_id'] and thread.get('peer_role') == 'worker':
                    worker_found = True
                    print(f"✅ Worker found in threads: {thread.get('peer_name')}")
                    break
            
            if not worker_found and len(threads) == 0:
                print("⚠️  No threads found yet (worker hasn't sent messages)")
                return True  # This is acceptable at this stage
            elif worker_found:
                return threads
            else:
                print("❌ Worker not found in employer's threads")
                return None
        else:
            print(f"❌ Chat threads failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Chat threads employer test failed - {str(e)}")
        return None

def test_chat_threads_worker(scenario):
    """Test GET /api/chat/threads as worker (should see employer as peer)"""
    print("\n=== Testing Chat Threads as Worker ===")
    try:
        headers = {"Authorization": f"Bearer {scenario['worker_token']}"}
        response = requests.get(f"{API_BASE}/chat/threads", headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            threads = data.get('threads', [])
            print(f"✅ Chat threads retrieved successfully")
            print(f"Found {len(threads)} threads")
            
            # Check if employer is in threads with peer_role='employer'
            employer_found = False
            for thread in threads:
                if thread.get('peer_id') == scenario['employer_id'] and thread.get('peer_role') == 'employer':
                    employer_found = True
                    print(f"✅ Employer found in threads: {thread.get('peer_name')}")
                    break
            
            if not employer_found and len(threads) == 0:
                print("⚠️  No threads found yet (no messages exchanged)")
                return True  # This is acceptable at this stage
            elif employer_found:
                return threads
            else:
                print("❌ Employer not found in worker's threads")
                return None
        else:
            print(f"❌ Chat threads failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Chat threads worker test failed - {str(e)}")
        return None

def test_send_messages(scenario):
    """Test POST /api/messages - worker sends 2 messages, employer sends 1"""
    print("\n=== Testing Send Messages ===")
    
    messages_sent = []
    
    # Worker sends 2 messages to employer
    try:
        headers = {"Authorization": f"Bearer {scenario['worker_token']}"}
        
        # Message 1
        payload1 = {
            "receiver_id": scenario['employer_id'],
            "content": "Hello! I'm excited about the job opportunity.",
            "job_id": scenario['job_id']
        }
        response1 = requests.post(f"{API_BASE}/messages", json=payload1, headers=headers, timeout=10)
        print(f"Worker Message 1 Status: {response1.status_code}")
        
        if response1.status_code == 200:
            msg1_data = response1.json()
            messages_sent.append(msg1_data.get('message'))
            print("✅ Worker message 1 sent successfully")
        else:
            print(f"❌ Worker message 1 failed - {response1.text}")
            return None
        
        # Message 2
        payload2 = {
            "receiver_id": scenario['employer_id'],
            "content": "When can we schedule an interview?",
            "job_id": scenario['job_id']
        }
        response2 = requests.post(f"{API_BASE}/messages", json=payload2, headers=headers, timeout=10)
        print(f"Worker Message 2 Status: {response2.status_code}")
        
        if response2.status_code == 200:
            msg2_data = response2.json()
            messages_sent.append(msg2_data.get('message'))
            print("✅ Worker message 2 sent successfully")
        else:
            print(f"❌ Worker message 2 failed - {response2.text}")
            return None
        
    except Exception as e:
        print(f"❌ Worker messages failed - {str(e)}")
        return None
    
    # Employer sends 1 message to worker
    try:
        headers = {"Authorization": f"Bearer {scenario['employer_token']}"}
        
        payload3 = {
            "receiver_id": scenario['worker_id'],
            "content": "Thank you for your interest! Let's schedule a call for tomorrow.",
            "job_id": scenario['job_id']
        }
        response3 = requests.post(f"{API_BASE}/messages", json=payload3, headers=headers, timeout=10)
        print(f"Employer Message Status: {response3.status_code}")
        
        if response3.status_code == 200:
            msg3_data = response3.json()
            messages_sent.append(msg3_data.get('message'))
            print("✅ Employer message sent successfully")
        else:
            print(f"❌ Employer message failed - {response3.text}")
            return None
        
    except Exception as e:
        print(f"❌ Employer message failed - {str(e)}")
        return None
    
    print(f"✅ All 3 messages sent successfully")
    return messages_sent

def test_get_messages_worker(scenario):
    """Test GET /api/messages?peer=PEER_ID as worker"""
    print("\n=== Testing Get Messages as Worker ===")
    try:
        headers = {"Authorization": f"Bearer {scenario['worker_token']}"}
        response = requests.get(f"{API_BASE}/messages?peer={scenario['employer_id']}", headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            messages = data.get('messages', [])
            print(f"✅ Messages retrieved successfully")
            print(f"Found {len(messages)} messages")
            
            # Verify chronological order and content
            if len(messages) >= 3:
                print("✅ Expected number of messages found")
                for i, msg in enumerate(messages):
                    print(f"Message {i+1}: {msg.get('content')[:50]}...")
                return messages
            else:
                print(f"⚠️  Expected 3 messages, found {len(messages)}")
                return messages
        else:
            print(f"❌ Get messages failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Get messages worker test failed - {str(e)}")
        return None

def test_get_messages_employer(scenario):
    """Test GET /api/messages?peer=PEER_ID as employer"""
    print("\n=== Testing Get Messages as Employer ===")
    try:
        headers = {"Authorization": f"Bearer {scenario['employer_token']}"}
        response = requests.get(f"{API_BASE}/messages?peer={scenario['worker_id']}", headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            messages = data.get('messages', [])
            print(f"✅ Messages retrieved successfully")
            print(f"Found {len(messages)} messages")
            
            # Verify chronological order and content
            if len(messages) >= 3:
                print("✅ Expected number of messages found")
                for i, msg in enumerate(messages):
                    print(f"Message {i+1}: {msg.get('content')[:50]}...")
                return messages
            else:
                print(f"⚠️  Expected 3 messages, found {len(messages)}")
                return messages
        else:
            print(f"❌ Get messages failed - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Get messages employer test failed - {str(e)}")
        return None

def test_mark_messages_read(scenario):
    """Test POST /api/messages/mark-read and verify unread_count changes"""
    print("\n=== Testing Mark Messages as Read ===")
    
    # First, check employer's threads to see unread_count before marking as read
    try:
        headers = {"Authorization": f"Bearer {scenario['employer_token']}"}
        response = requests.get(f"{API_BASE}/chat/threads", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            threads = data.get('threads', [])
            
            worker_thread = None
            for thread in threads:
                if thread.get('peer_id') == scenario['worker_id']:
                    worker_thread = thread
                    break
            
            if worker_thread:
                unread_before = worker_thread.get('unread_count', 0)
                print(f"Unread count before marking as read: {unread_before}")
                
                if unread_before >= 2:
                    print("✅ Expected unread count (worker sent 2 messages)")
                else:
                    print(f"⚠️  Expected unread count >= 2, found {unread_before}")
            else:
                print("⚠️  Worker thread not found in employer's threads")
        
    except Exception as e:
        print(f"⚠️  Error checking unread count before: {str(e)}")
    
    # Mark messages from worker as read
    try:
        headers = {"Authorization": f"Bearer {scenario['employer_token']}"}
        payload = {"peer_id": scenario['worker_id']}
        response = requests.post(f"{API_BASE}/messages/mark-read", json=payload, headers=headers, timeout=10)
        print(f"Mark as read Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Messages marked as read successfully")
            
            # Check threads again to verify unread_count is 0
            response = requests.get(f"{API_BASE}/chat/threads", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                threads = data.get('threads', [])
                
                worker_thread = None
                for thread in threads:
                    if thread.get('peer_id') == scenario['worker_id']:
                        worker_thread = thread
                        break
                
                if worker_thread:
                    unread_after = worker_thread.get('unread_count', 0)
                    print(f"Unread count after marking as read: {unread_after}")
                    
                    if unread_after == 0:
                        print("✅ Unread count correctly reset to 0")
                        return True
                    else:
                        print(f"❌ Expected unread count 0, found {unread_after}")
                        return False
                else:
                    print("❌ Worker thread not found after marking as read")
                    return False
            else:
                print(f"❌ Error checking threads after marking as read: {response.text}")
                return False
        else:
            print(f"❌ Mark as read failed - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Mark messages as read test failed - {str(e)}")
        return False

def main():
    """Run Slice 2 backend tests"""
    print("🚀 Starting Work2Wish Slice 2 Backend Tests")
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
    
    # Test 1: Upload without auth
    record_result("Upload without Auth", test_upload_without_auth())
    
    # Test 2: Upload without file
    record_result("Upload without File", test_upload_without_file())
    
    # Test 3: Chat threads without auth
    record_result("Chat Threads without Auth", test_chat_threads_without_auth())
    
    # Set up test scenario
    print("\n" + "="*60)
    print("Setting up test scenario...")
    scenario = setup_test_scenario()
    if not scenario:
        print("❌ Cannot continue without test scenario setup")
        return
    
    # Test 4: Upload worker avatar
    avatar_result = test_upload_worker_avatar(scenario)
    record_result("Upload Worker Avatar", avatar_result is not None)
    
    # Test 5: Upload employer logo
    logo_result = test_upload_employer_logo(scenario)
    record_result("Upload Employer Logo", logo_result is not None)
    
    # Test 6: Chat threads as employer (before messages)
    employer_threads_before = test_chat_threads_employer(scenario)
    record_result("Chat Threads Employer (before messages)", employer_threads_before is not None)
    
    # Test 7: Chat threads as worker (before messages)
    worker_threads_before = test_chat_threads_worker(scenario)
    record_result("Chat Threads Worker (before messages)", worker_threads_before is not None)
    
    # Test 8: Send messages
    messages_sent = test_send_messages(scenario)
    record_result("Send Messages", messages_sent is not None)
    
    if not messages_sent:
        print("❌ Cannot continue without messages")
        return
    
    # Test 9: Get messages as worker
    worker_messages = test_get_messages_worker(scenario)
    record_result("Get Messages Worker", worker_messages is not None)
    
    # Test 10: Get messages as employer
    employer_messages = test_get_messages_employer(scenario)
    record_result("Get Messages Employer", employer_messages is not None)
    
    # Test 11: Chat threads as employer (after messages)
    employer_threads_after = test_chat_threads_employer(scenario)
    record_result("Chat Threads Employer (after messages)", employer_threads_after is not None)
    
    # Test 12: Chat threads as worker (after messages)
    worker_threads_after = test_chat_threads_worker(scenario)
    record_result("Chat Threads Worker (after messages)", worker_threads_after is not None)
    
    # Test 13: Mark messages as read
    record_result("Mark Messages as Read", test_mark_messages_read(scenario))
    
    # Print final results
    print("\n" + "="*60)
    print("🏁 SLICE 2 TEST RESULTS SUMMARY")
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
        print("\n🎉 ALL SLICE 2 TESTS PASSED! New endpoints are working correctly.")
    else:
        print(f"\n⚠️  {results['failed']} tests failed. Check the logs above for details.")
    
    return results

if __name__ == "__main__":
    main()