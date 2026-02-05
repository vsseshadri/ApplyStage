#!/usr/bin/env python3
"""
Focused Backend API Testing for My Jobs FAB functionality
Tests the specific backend APIs that support My Jobs page and FAB visibility
"""

import requests
import json
import sys
from datetime import datetime, timezone

# Backend URL from environment
BACKEND_URL = "https://repo-preview-43.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test authentication token
TEST_TOKEN = "test_token_abc123"

def test_backend_connectivity():
    """Test if backend server is responding"""
    try:
        response = requests.get(BACKEND_URL, timeout=10)
        print(f"✅ Backend connectivity: Server responding (Status: {response.status_code})")
        return True
    except Exception as e:
        print(f"❌ Backend connectivity: Failed - {e}")
        return False

def test_auth_me():
    """Test authentication endpoint"""
    try:
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        
        if response.status_code == 200:
            user_data = response.json()
            print(f"✅ Auth /api/auth/me: Working - User: {user_data.get('name', 'Test User')}")
            return True, user_data
        else:
            print(f"❌ Auth /api/auth/me: Failed - Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ Auth /api/auth/me: Failed - {e}")
        return False, None

def test_jobs_list_empty():
    """Test jobs listing endpoint when no jobs exist"""
    try:
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = requests.get(f"{API_BASE}/jobs", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            jobs = data.get('jobs', [])
            pagination = data.get('pagination', {})
            
            print(f"✅ Jobs List (Empty): Working - {len(jobs)} jobs, Total: {pagination.get('total_count', 0)}")
            return True, len(jobs)
        else:
            print(f"❌ Jobs List: Failed - Status {response.status_code}")
            return False, 0
    except Exception as e:
        print(f"❌ Jobs List: Failed - {e}")
        return False, 0

def test_create_job():
    """Test creating a job application with correct format"""
    try:
        headers = {
            "Authorization": f"Bearer {TEST_TOKEN}",
            "Content-Type": "application/json"
        }
        
        # Use the correct format based on the backend schema
        job_data = {
            "company_name": "TechCorp Inc",
            "position": "Senior Software Engineer", 
            "location": {
                "city": "San Francisco",
                "state": "California"
            },
            "salary_range": {
                "min": 120000.0,
                "max": 180000.0
            },
            "work_mode": "hybrid",
            "job_type": "Software Engineer",
            "job_url": "https://techcorp.com/careers/senior-swe",
            "date_applied": datetime.now(timezone.utc).isoformat(),
            "status": "applied",
            "is_priority": True,
            "notes": "Test job for FAB functionality verification",
            "custom_stages": []
        }
        
        response = requests.post(f"{API_BASE}/jobs", headers=headers, json=job_data, timeout=10)
        
        if response.status_code == 200:
            job = response.json()
            job_id = job.get('job_id')
            print(f"✅ Create Job: Working - Created job {job_id} at {job.get('company_name')}")
            return True, job_id
        else:
            print(f"❌ Create Job: Failed - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
    except Exception as e:
        print(f"❌ Create Job: Failed - {e}")
        return False, None

def test_jobs_list_with_data():
    """Test jobs listing endpoint when jobs exist - This is what My Jobs page calls"""
    try:
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = requests.get(f"{API_BASE}/jobs", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            jobs = data.get('jobs', [])
            pagination = data.get('pagination', {})
            
            print(f"✅ Jobs List (With Data): Working - {len(jobs)} jobs, Total: {pagination.get('total_count', 0)}")
            
            # Verify job data structure for My Jobs page
            if jobs:
                job = jobs[0]
                required_fields = ['job_id', 'company_name', 'position', 'status', 'created_at']
                missing_fields = [field for field in required_fields if field not in job]
                
                if not missing_fields:
                    print(f"✅ Job Data Structure: Complete - All required fields present")
                    print(f"   Sample job: {job.get('company_name')} - {job.get('position')} ({job.get('status')})")
                else:
                    print(f"⚠️ Job Data Structure: Missing fields - {missing_fields}")
                
            return True, len(jobs)
        else:
            print(f"❌ Jobs List (With Data): Failed - Status {response.status_code}")
            return False, 0
    except Exception as e:
        print(f"❌ Jobs List (With Data): Failed - {e}")
        return False, 0

def test_fab_visibility_logic():
    """Test the logic that determines FAB visibility (jobs.length > 0)"""
    try:
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = requests.get(f"{API_BASE}/jobs", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            jobs = data.get('jobs', [])
            job_count = len(jobs)
            
            # This is the key logic for FAB visibility
            fab_should_be_visible = job_count > 0
            
            print(f"✅ FAB Visibility Logic: jobs.length = {job_count}")
            print(f"   FAB should be visible: {fab_should_be_visible}")
            
            if fab_should_be_visible:
                print(f"   ✅ CRITICAL: With {job_count} job(s), FAB should appear in bottom-right")
            else:
                print(f"   ⚠️ NOTICE: With 0 jobs, FAB should be hidden (need to add jobs first)")
                
            return True, fab_should_be_visible
        else:
            print(f"❌ FAB Visibility Logic: Failed - Status {response.status_code}")
            return False, False
    except Exception as e:
        print(f"❌ FAB Visibility Logic: Failed - {e}")
        return False, False

def cleanup_test_job(job_id):
    """Clean up test job"""
    if not job_id:
        return
        
    try:
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = requests.delete(f"{API_BASE}/jobs/{job_id}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            print(f"✅ Cleanup: Test job {job_id} deleted successfully")
        else:
            print(f"⚠️ Cleanup: Could not delete test job {job_id} - Status {response.status_code}")
    except Exception as e:
        print(f"⚠️ Cleanup: Failed to delete test job - {e}")

def main():
    """Run focused backend tests for My Jobs FAB functionality"""
    print("=" * 80)
    print("BACKEND API TESTING - MY JOBS FAB FUNCTIONALITY")
    print("=" * 80)
    print(f"Testing backend APIs at: {BACKEND_URL}")
    print(f"Focus: APIs that support My Jobs page and FAB visibility")
    print("-" * 80)
    
    # Track test results
    tests_passed = 0
    total_tests = 0
    job_id = None
    
    # Test 1: Backend connectivity
    total_tests += 1
    if test_backend_connectivity():
        tests_passed += 1
    
    # Test 2: Authentication (required for My Jobs access)
    total_tests += 1
    auth_success, user_data = test_auth_me()
    if auth_success:
        tests_passed += 1
    
    # Test 3: Jobs list (initial state)
    total_tests += 1
    list_success, initial_job_count = test_jobs_list_empty()
    if list_success:
        tests_passed += 1
    
    # Test 4: FAB visibility logic (initial state)
    total_tests += 1
    fab_logic_success, initial_fab_visible = test_fab_visibility_logic()
    if fab_logic_success:
        tests_passed += 1
    
    # Test 5: Create a test job (simulates adding job via FAB)
    total_tests += 1
    create_success, job_id = test_create_job()
    if create_success:
        tests_passed += 1
    
    # Test 6: Jobs list after adding job (what My Jobs page shows)
    total_tests += 1
    list_success_after, final_job_count = test_jobs_list_with_data()
    if list_success_after:
        tests_passed += 1
    
    # Test 7: FAB visibility logic after adding job
    total_tests += 1
    fab_logic_success_after, final_fab_visible = test_fab_visibility_logic()
    if fab_logic_success_after:
        tests_passed += 1
    
    # Cleanup
    cleanup_test_job(job_id)
    
    # Summary
    print("-" * 80)
    print("MY JOBS FAB BACKEND TEST SUMMARY")
    print("-" * 80)
    print(f"Tests Passed: {tests_passed}/{total_tests} ({(tests_passed/total_tests)*100:.1f}%)")
    print()
    
    print("FAB VISIBILITY TEST RESULTS:")
    print(f"• Initial state: {initial_job_count} jobs → FAB visible: {initial_fab_visible}")
    print(f"• After adding job: {final_job_count} jobs → FAB visible: {final_fab_visible}")
    print()
    
    print("BACKEND API ENDPOINTS SUPPORTING MY JOBS FAB:")
    print(f"• GET /api/jobs - Returns job list (determines FAB visibility)")
    print(f"• POST /api/jobs - Creates new jobs (triggered by FAB click)")
    print(f"• GET /api/auth/me - Authentication (required for access)")
    print()
    
    if create_success and final_job_count > 0:
        print("✅ CRITICAL FINDING: Backend APIs working correctly")
        print("   → Jobs can be created and retrieved")
        print("   → FAB should be visible when jobs.length > 0")
        print("   → My Jobs page should display job list properly")
    else:
        print("❌ CRITICAL ISSUE: Backend APIs have problems")
        print("   → This may affect My Jobs page and FAB functionality")
    
    print()
    print("FRONTEND TESTING NOTE:")
    print("⚠️  The actual FAB visibility and UI testing is FRONTEND functionality")
    print("    Backend APIs provide the data, but UI behavior needs frontend testing")
    print("    This test confirms backend support for the My Jobs FAB feature")
    
    if tests_passed >= 5:  # At least core functionality working
        return 0
    else:
        return 1

if __name__ == "__main__":
    sys.exit(main())