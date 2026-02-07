#!/usr/bin/env python3
"""
Backend API Testing for Checklist Progress Persistence
Testing the new checklist progress endpoints and related functionality
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://repo-preview-43.emergent.host"
TEST_TOKEN = "test_token_abc123"
HEADERS = {
    "Authorization": f"Bearer {TEST_TOKEN}",
    "Content-Type": "application/json"
}

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_symbol} {test_name}: {status}")
    if details:
        print(f"    {details}")

def test_backend_connectivity():
    """Test basic backend connectivity"""
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            user_data = response.json()
            log_test("Backend Connectivity", "PASS", f"Connected as user: {user_data.get('email', 'Unknown')}")
            return True
        else:
            log_test("Backend Connectivity", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Backend Connectivity", "FAIL", f"Error: {str(e)}")
        return False

def test_interview_checklist_endpoint():
    """Test the interview checklist endpoint that previously had routing issues"""
    try:
        # Test different stages
        stages = ["system_design", "phone_screen", "coding_round_1", "behavioural"]
        
        for stage in stages:
            # Test without company parameter
            response = requests.get(f"{BASE_URL}/api/interview-checklist/{stage}", headers=HEADERS, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "title" in data and "items" in data:
                    log_test(f"Interview Checklist - {stage}", "PASS", f"Returned {len(data['items'])} checklist items")
                else:
                    log_test(f"Interview Checklist - {stage}", "FAIL", "Missing required fields in response")
                    return False
            else:
                log_test(f"Interview Checklist - {stage}", "FAIL", f"Status: {response.status_code}")
                return False
            
            # Test with company parameter
            response = requests.get(f"{BASE_URL}/api/interview-checklist/{stage}?company=Google", headers=HEADERS, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "company" in data and data["company"] == "Google":
                    log_test(f"Interview Checklist - {stage} with company", "PASS", "Company parameter handled correctly")
                else:
                    log_test(f"Interview Checklist - {stage} with company", "FAIL", "Company parameter not handled")
                    return False
            else:
                log_test(f"Interview Checklist - {stage} with company", "FAIL", f"Status: {response.status_code}")
                return False
        
        return True
    except Exception as e:
        log_test("Interview Checklist Endpoint", "FAIL", f"Error: {str(e)}")
        return False

def test_checklist_progress_persistence():
    """Test the new checklist progress persistence endpoints"""
    try:
        # Create a test job first to get a valid job_id
        job_data = {
            "company_name": "TestCompany",
            "position": "Software Engineer",
            "location": {"city": "San Francisco", "state": "California"},
            "salary_range": {"min": 100000, "max": 150000},
            "work_mode": "remote",
            "job_type": "full_time",
            "status": "applied",
            "is_priority": True
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", headers=HEADERS, json=job_data, timeout=10)
        if response.status_code != 200:
            log_test("Create Test Job for Checklist", "FAIL", f"Status: {response.status_code}")
            return False
        
        job = response.json()
        job_id = job["job_id"]
        stage = "system_design"
        
        log_test("Create Test Job for Checklist", "PASS", f"Created job with ID: {job_id}")
        
        # Test 1: GET checklist progress for new job (should return empty)
        response = requests.get(f"{BASE_URL}/api/checklist-progress/{job_id}/{stage}", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "completed_items" in data and data["completed_items"] == []:
                log_test("GET Checklist Progress (Empty)", "PASS", "Returns empty completed_items for new job")
            else:
                log_test("GET Checklist Progress (Empty)", "FAIL", f"Expected empty array, got: {data}")
                return False
        else:
            log_test("GET Checklist Progress (Empty)", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Test 2: PUT checklist progress (save some completed items)
        progress_data = {
            "job_id": job_id,
            "stage": stage,
            "completed_items": ["sd1", "sd2", "sd3"]
        }
        
        response = requests.put(f"{BASE_URL}/api/checklist-progress", headers=HEADERS, json=progress_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "completed_items" in data:
                log_test("PUT Checklist Progress", "PASS", f"Saved {len(progress_data['completed_items'])} completed items")
            else:
                log_test("PUT Checklist Progress", "FAIL", "Missing required fields in response")
                return False
        else:
            log_test("PUT Checklist Progress", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Test 3: GET checklist progress again (should return saved items)
        response = requests.get(f"{BASE_URL}/api/checklist-progress/{job_id}/{stage}", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "completed_items" in data and data["completed_items"] == ["sd1", "sd2", "sd3"]:
                log_test("GET Checklist Progress (Saved)", "PASS", "Returns saved completed_items correctly")
            else:
                log_test("GET Checklist Progress (Saved)", "FAIL", f"Expected ['sd1', 'sd2', 'sd3'], got: {data['completed_items']}")
                return False
        else:
            log_test("GET Checklist Progress (Saved)", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Test 4: Update checklist progress (modify existing)
        updated_progress_data = {
            "job_id": job_id,
            "stage": stage,
            "completed_items": ["sd1", "sd2", "sd3", "sd4", "sd5"]
        }
        
        response = requests.put(f"{BASE_URL}/api/checklist-progress", headers=HEADERS, json=updated_progress_data, timeout=10)
        if response.status_code == 200:
            log_test("PUT Checklist Progress (Update)", "PASS", "Updated existing progress successfully")
        else:
            log_test("PUT Checklist Progress (Update)", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Test 5: Verify updated progress
        response = requests.get(f"{BASE_URL}/api/checklist-progress/{job_id}/{stage}", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "completed_items" in data and len(data["completed_items"]) == 5:
                log_test("GET Updated Checklist Progress", "PASS", f"Returns {len(data['completed_items'])} updated items")
            else:
                log_test("GET Updated Checklist Progress", "FAIL", f"Expected 5 items, got: {len(data.get('completed_items', []))}")
                return False
        else:
            log_test("GET Updated Checklist Progress", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Test 6: Test different stage for same job
        different_stage = "phone_screen"
        response = requests.get(f"{BASE_URL}/api/checklist-progress/{job_id}/{different_stage}", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "completed_items" in data and data["completed_items"] == []:
                log_test("GET Different Stage Progress", "PASS", "Different stage returns empty progress correctly")
            else:
                log_test("GET Different Stage Progress", "FAIL", "Different stage should return empty progress")
                return False
        else:
            log_test("GET Different Stage Progress", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Clean up: Delete the test job
        response = requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            log_test("Cleanup Test Job", "PASS", "Test job deleted successfully")
        else:
            log_test("Cleanup Test Job", "WARN", f"Could not delete test job: {response.status_code}")
        
        return True
        
    except Exception as e:
        log_test("Checklist Progress Persistence", "FAIL", f"Error: {str(e)}")
        return False

def test_ghosted_status_in_dashboard():
    """Test that ghosted status is correctly handled in dashboard stats"""
    try:
        # Create a test job with ghosted status
        job_data = {
            "company_name": "GhostedCompany",
            "position": "Software Engineer",
            "location": {"city": "San Francisco", "state": "California"},
            "salary_range": {"min": 100000, "max": 150000},
            "work_mode": "remote",
            "job_type": "full_time",
            "status": "ghosted",
            "is_priority": False
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", headers=HEADERS, json=job_data, timeout=10)
        if response.status_code != 200:
            log_test("Create Ghosted Job", "FAIL", f"Status: {response.status_code}")
            return False
        
        job = response.json()
        job_id = job["job_id"]
        log_test("Create Ghosted Job", "PASS", f"Created ghosted job with ID: {job_id}")
        
        # Test dashboard stats include ghosted status
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            stats = response.json()
            if "ghosted" in stats and isinstance(stats["ghosted"], int):
                log_test("Dashboard Stats - Ghosted Status", "PASS", f"Ghosted count: {stats['ghosted']}")
            else:
                log_test("Dashboard Stats - Ghosted Status", "FAIL", "Ghosted status not found in dashboard stats")
                return False
        else:
            log_test("Dashboard Stats - Ghosted Status", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Test AI insights handle ghosted jobs correctly
        response = requests.get(f"{BASE_URL}/api/dashboard/ai-insights", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            insights = response.json()
            if "insights" in insights and "follow_ups" in insights:
                log_test("AI Insights - Ghosted Handling", "PASS", "AI insights endpoint working with ghosted jobs")
            else:
                log_test("AI Insights - Ghosted Handling", "FAIL", "AI insights missing required fields")
                return False
        else:
            log_test("AI Insights - Ghosted Handling", "FAIL", f"Status: {response.status_code}")
            return False
        
        # Clean up: Delete the ghosted test job
        response = requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            log_test("Cleanup Ghosted Job", "PASS", "Ghosted test job deleted successfully")
        else:
            log_test("Cleanup Ghosted Job", "WARN", f"Could not delete ghosted test job: {response.status_code}")
        
        return True
        
    except Exception as e:
        log_test("Ghosted Status Dashboard", "FAIL", f"Error: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print("=" * 80)
    print("BACKEND API TESTING - CHECKLIST PROGRESS PERSISTENCE")
    print("=" * 80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Token: {TEST_TOKEN}")
    print("-" * 80)
    
    tests = [
        ("Backend Connectivity", test_backend_connectivity),
        ("Interview Checklist Endpoint", test_interview_checklist_endpoint),
        ("Checklist Progress Persistence", test_checklist_progress_persistence),
        ("Ghosted Status Dashboard", test_ghosted_status_in_dashboard)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running: {test_name}")
        print("-" * 40)
        
        if test_func():
            passed += 1
        else:
            print(f"❌ {test_name} FAILED - stopping further tests")
            break
    
    print("\n" + "=" * 80)
    print(f"TESTING COMPLETE: {passed}/{total} test suites passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Backend endpoints are working correctly!")
        return 0
    else:
        print("❌ SOME TESTS FAILED - Check the details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())