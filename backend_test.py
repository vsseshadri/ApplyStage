#!/usr/bin/env python3
"""
Backend API Testing for CareerFlow App - Upcoming Interviews Flow
Tests the specific flow reported by user regarding missing "Upcoming Interviews" section
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BACKEND_URL = "https://share-to-jobs.preview.emergentagent.com"
TEST_TOKEN = "test_token_abc123"
HEADERS = {
    "Authorization": f"Bearer {TEST_TOKEN}",
    "Content-Type": "application/json"
}

def log_test(test_name, status, details=""):
    """Log test results with clear formatting"""
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_symbol} {status} - {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def test_health_endpoint():
    """Test 1: Check if backend is running properly via health endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log_test("Health Endpoint", "PASS", f"Status: {data.get('status', 'healthy')}")
            return True
        else:
            log_test("Health Endpoint", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        log_test("Health Endpoint", "FAIL", f"Connection error: {str(e)}")
        return False

def test_authentication():
    """Test authentication with test token"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/auth/me", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            user_data = response.json()
            log_test("Authentication", "PASS", f"User: {user_data.get('name', 'Test User')} ({user_data.get('email', 'test@example.com')})")
            return True
        else:
            log_test("Authentication", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        log_test("Authentication", "FAIL", f"Connection error: {str(e)}")
        return False

def test_upcoming_interviews_empty():
    """Test 2: Test upcoming interviews endpoint (should work even if empty)"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/dashboard/upcoming-interviews", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            interviews = response.json()
            log_test("Upcoming Interviews (Empty)", "PASS", f"Returned {len(interviews)} interviews")
            return True
        else:
            log_test("Upcoming Interviews (Empty)", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        log_test("Upcoming Interviews (Empty)", "FAIL", f"Connection error: {str(e)}")
        return False

def create_test_job_with_interview():
    """Test 3: Create a test job with upcoming interview data"""
    try:
        # Create job with upcoming interview scheduled for next week
        future_date = (datetime.now() + timedelta(days=7)).strftime("%m/%d/%Y")
        
        job_data = {
            "company_name": "TechCorp Solutions",
            "position": "Senior Software Engineer",
            "location": {"city": "San Francisco", "state": "California"},
            "salary_range": {"min": 120000, "max": 160000},
            "work_mode": "hybrid",
            "job_type": "Software Engineer",
            "status": "phone_screen",
            "upcoming_stage": "system_design",
            "upcoming_schedule": future_date,
            "date_applied": datetime.now().isoformat(),
            "is_priority": True,
            "notes": "Test job for upcoming interviews functionality"
        }
        
        response = requests.post(f"{BACKEND_URL}/api/jobs", headers=HEADERS, json=job_data, timeout=10)
        
        if response.status_code == 200:
            job = response.json()
            job_id = job.get("job_id")
            log_test("Create Job with Interview", "PASS", f"Job ID: {job_id}, Interview: {job.get('upcoming_stage')} on {job.get('upcoming_schedule')}")
            return job_id
        else:
            log_test("Create Job with Interview", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        log_test("Create Job with Interview", "FAIL", f"Connection error: {str(e)}")
        return None

def test_upcoming_interviews_with_data():
    """Test 4: Verify upcoming interviews endpoint returns the created interview"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/dashboard/upcoming-interviews", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            interviews = response.json()
            
            if len(interviews) > 0:
                interview = interviews[0]
                company = interview.get("company_name")
                stage = interview.get("stage")
                schedule = interview.get("schedule_date")
                days_until = interview.get("days_until")
                
                log_test("Upcoming Interviews (With Data)", "PASS", 
                        f"Found interview: {company} - {stage} on {schedule} ({days_until} days away)")
                return True
            else:
                log_test("Upcoming Interviews (With Data)", "FAIL", "No interviews returned despite creating one")
                return False
        else:
            log_test("Upcoming Interviews (With Data)", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        log_test("Upcoming Interviews (With Data)", "FAIL", f"Connection error: {str(e)}")
        return False

def test_dashboard_stats():
    """Additional test: Check if dashboard stats include upcoming interview data"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/dashboard/stats", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            stats = response.json()
            total_jobs = stats.get("total", 0)
            phone_screen_count = stats.get("phone_screen", 0)
            
            log_test("Dashboard Stats", "PASS", f"Total jobs: {total_jobs}, Phone screen: {phone_screen_count}")
            return True
        else:
            log_test("Dashboard Stats", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        log_test("Dashboard Stats", "FAIL", f"Connection error: {str(e)}")
        return False

def cleanup_test_jobs():
    """Clean up test jobs created during testing"""
    try:
        # Get all jobs
        response = requests.get(f"{BACKEND_URL}/api/jobs", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            jobs_data = response.json()
            jobs = jobs_data.get("jobs", [])
            
            # Delete test jobs
            deleted_count = 0
            for job in jobs:
                if job.get("company_name") == "TechCorp Solutions" and "Test job for upcoming interviews" in job.get("notes", ""):
                    job_id = job.get("job_id")
                    delete_response = requests.delete(f"{BACKEND_URL}/api/jobs/{job_id}", headers=HEADERS, timeout=10)
                    if delete_response.status_code == 200:
                        deleted_count += 1
            
            if deleted_count > 0:
                log_test("Cleanup Test Jobs", "PASS", f"Deleted {deleted_count} test job(s)")
            else:
                log_test("Cleanup Test Jobs", "PASS", "No test jobs to clean up")
            return True
        else:
            log_test("Cleanup Test Jobs", "FAIL", f"Could not fetch jobs: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        log_test("Cleanup Test Jobs", "FAIL", f"Connection error: {str(e)}")
        return False

def main():
    """Run the complete upcoming interviews flow test"""
    print("=" * 80)
    print("CAREERFLOW BACKEND API TESTING - UPCOMING INTERVIEWS FLOW")
    print("=" * 80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Token: {TEST_TOKEN}")
    print("=" * 80)
    print()
    
    # Track test results
    test_results = []
    
    # Test 1: Health check
    print("🔍 Testing Backend Health...")
    health_ok = test_health_endpoint()
    test_results.append(("Health Endpoint", health_ok))
    
    if not health_ok:
        print("❌ Backend health check failed. Stopping tests.")
        return
    
    # Test authentication
    print("🔐 Testing Authentication...")
    auth_ok = test_authentication()
    test_results.append(("Authentication", auth_ok))
    
    if not auth_ok:
        print("❌ Authentication failed. Stopping tests.")
        return
    
    # Test 2: Empty upcoming interviews
    print("📅 Testing Upcoming Interviews (Empty State)...")
    empty_interviews_ok = test_upcoming_interviews_empty()
    test_results.append(("Upcoming Interviews (Empty)", empty_interviews_ok))
    
    # Test 3: Create job with interview
    print("➕ Creating Test Job with Upcoming Interview...")
    job_id = create_test_job_with_interview()
    job_created = job_id is not None
    test_results.append(("Create Job with Interview", job_created))
    
    # Test 4: Upcoming interviews with data
    if job_created:
        print("📋 Testing Upcoming Interviews (With Data)...")
        interviews_with_data_ok = test_upcoming_interviews_with_data()
        test_results.append(("Upcoming Interviews (With Data)", interviews_with_data_ok))
    
    # Additional test: Dashboard stats
    print("📊 Testing Dashboard Stats...")
    stats_ok = test_dashboard_stats()
    test_results.append(("Dashboard Stats", stats_ok))
    
    # Cleanup
    print("🧹 Cleaning up test data...")
    cleanup_ok = cleanup_test_jobs()
    test_results.append(("Cleanup", cleanup_ok))
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print()
    print(f"OVERALL RESULT: {passed}/{total} tests passed ({round(passed/total*100, 1)}% success rate)")
    
    if passed == total:
        print("🎉 All tests passed! The upcoming interviews functionality is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the details above for issues.")
    
    print("=" * 80)

if __name__ == "__main__":
    main()