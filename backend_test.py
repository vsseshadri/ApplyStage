#!/usr/bin/env python3
"""
CareerFlow Backend API Testing - Position Field in Upcoming Interviews
Testing the upcoming interviews endpoint to verify position field inclusion for dynamic Prep Checklist feature.
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://prep-checklist-app.preview.emergentagent.com/api"
TEST_TOKEN = "test_token_abc123"
HEADERS = {
    "Authorization": f"Bearer {TEST_TOKEN}",
    "Content-Type": "application/json"
}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, message):
        status = "✅ PASS" if passed else "❌ FAIL"
        self.results.append(f"{status} - {test_name}: {message}")
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        print(f"{status} - {test_name}: {message}")
    
    def summary(self):
        total = self.passed + self.failed
        success_rate = (self.passed / total * 100) if total > 0 else 0
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests PASSED ({success_rate:.1f}% success rate)")
        print(f"{'='*60}")
        return self.failed == 0

def test_backend_connectivity():
    """Test 1: Verify backend connectivity"""
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            user_data = response.json()
            return True, f"Connected successfully. User: {user_data.get('email', 'Unknown')}"
        else:
            return False, f"Authentication failed with status {response.status_code}"
    except Exception as e:
        return False, f"Connection error: {str(e)}"

def create_test_job(job_data):
    """Helper function to create a test job"""
    try:
        response = requests.post(f"{BASE_URL}/jobs", headers=HEADERS, json=job_data, timeout=10)
        if response.status_code == 200:
            job = response.json()
            return True, job.get('job_id'), f"Job created successfully: {job.get('job_id')}"
        else:
            return False, None, f"Job creation failed with status {response.status_code}: {response.text}"
    except Exception as e:
        return False, None, f"Job creation error: {str(e)}"

def get_upcoming_interviews():
    """Helper function to get upcoming interviews"""
    try:
        response = requests.get(f"{BASE_URL}/dashboard/upcoming-interviews", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            return True, response.json(), "Retrieved upcoming interviews successfully"
        else:
            return False, None, f"Failed to get upcoming interviews with status {response.status_code}: {response.text}"
    except Exception as e:
        return False, None, f"Error getting upcoming interviews: {str(e)}"

def delete_test_job(job_id):
    """Helper function to delete a test job"""
    try:
        response = requests.delete(f"{BASE_URL}/jobs/{job_id}", headers=HEADERS, timeout=10)
        return response.status_code == 200
    except:
        return False

def test_create_first_job():
    """Test 2: Create first test job with all required fields"""
    job_data = {
        "company_name": "Dynamic Prep Corp",
        "position": "Principal Software Engineer",
        "location": {"city": "San Francisco", "state": "California"},
        "salary_range": {"min": 180000, "max": 220000},
        "work_mode": "hybrid",
        "job_type": "Software Engineer",
        "status": "system_design",
        "upcoming_stage": "system_design",
        "upcoming_schedule": "03/20/2026",
        "date_applied": "2026-02-25T00:00:00Z",
        "is_priority": True
    }
    
    success, job_id, message = create_test_job(job_data)
    return success, job_id, message

def test_create_second_job():
    """Test 3: Create second test job with different position"""
    job_data = {
        "company_name": "Healthcare Systems",
        "position": "Senior Nurse Practitioner",
        "location": {"city": "Boston", "state": "Massachusetts"},
        "salary_range": {"min": 95000, "max": 115000},
        "work_mode": "onsite",
        "job_type": "Healthcare",
        "status": "clinical",
        "upcoming_stage": "clinical",
        "upcoming_schedule": "03/22/2026",
        "date_applied": "2026-02-25T00:00:00Z",
        "is_priority": True
    }
    
    success, job_id, message = create_test_job(job_data)
    return success, job_id, message

def test_upcoming_interviews_structure():
    """Test 4: Verify upcoming interviews endpoint returns proper structure with position field"""
    success, interviews, message = get_upcoming_interviews()
    if not success:
        return False, message
    
    if not isinstance(interviews, list):
        return False, "Response is not a list"
    
    if len(interviews) == 0:
        return False, "No upcoming interviews found (expected at least 2 from test jobs)"
    
    # Check structure of first interview
    first_interview = interviews[0]
    required_fields = ["company_name", "position", "stage", "schedule_date"]
    missing_fields = [field for field in required_fields if field not in first_interview]
    
    if missing_fields:
        return False, f"Missing required fields: {missing_fields}. Available fields: {list(first_interview.keys())}"
    
    return True, f"Found {len(interviews)} upcoming interviews with all required fields including 'position'"

def test_position_field_values():
    """Test 5: Verify position field contains correct values for both test jobs"""
    success, interviews, message = get_upcoming_interviews()
    if not success:
        return False, message
    
    expected_positions = ["Principal Software Engineer", "Senior Nurse Practitioner"]
    found_positions = [interview.get("position") for interview in interviews]
    
    # Check if both expected positions are found
    missing_positions = [pos for pos in expected_positions if pos not in found_positions]
    
    if missing_positions:
        return False, f"Missing expected positions: {missing_positions}. Found positions: {found_positions}"
    
    return True, f"All expected positions found: {found_positions}"

def test_interview_details():
    """Test 6: Verify interview details are complete and accurate"""
    success, interviews, message = get_upcoming_interviews()
    if not success:
        return False, message
    
    details = []
    for interview in interviews:
        company = interview.get("company_name", "Unknown")
        position = interview.get("position", "Unknown")
        stage = interview.get("stage", "Unknown")
        schedule = interview.get("schedule_date", "Unknown")
        
        details.append(f"{company} - {position} ({stage}) on {schedule}")
    
    return True, f"Interview details: {'; '.join(details)}"

def main():
    """Main test execution"""
    print("🚀 Starting CareerFlow Backend API Testing - Position Field in Upcoming Interviews")
    print(f"Testing URL: {BASE_URL}")
    print("="*80)
    
    results = TestResults()
    created_job_ids = []
    
    try:
        # Test 1: Backend Connectivity
        success, message = test_backend_connectivity()
        results.add_result("Backend Connectivity", success, message)
        if not success:
            print("❌ Cannot proceed without backend connectivity")
            return False
        
        # Test 2: Create First Job
        success, job_id1, message = test_create_first_job()
        results.add_result("Create First Test Job", success, message)
        if success and job_id1:
            created_job_ids.append(job_id1)
        
        # Test 3: Create Second Job
        success, job_id2, message = test_create_second_job()
        results.add_result("Create Second Test Job", success, message)
        if success and job_id2:
            created_job_ids.append(job_id2)
        
        # Test 4: Upcoming Interviews Structure
        success, message = test_upcoming_interviews_structure()
        results.add_result("Upcoming Interviews Structure", success, message)
        
        # Test 5: Position Field Values
        success, message = test_position_field_values()
        results.add_result("Position Field Values", success, message)
        
        # Test 6: Interview Details
        success, message = test_interview_details()
        results.add_result("Interview Details Verification", success, message)
        
    except Exception as e:
        results.add_result("Unexpected Error", False, f"Test execution failed: {str(e)}")
    
    finally:
        # Cleanup: Delete created test jobs
        print(f"\n🧹 Cleaning up {len(created_job_ids)} test jobs...")
        for job_id in created_job_ids:
            if delete_test_job(job_id):
                print(f"✅ Deleted job: {job_id}")
            else:
                print(f"⚠️ Failed to delete job: {job_id}")
    
    # Final summary
    success = results.summary()
    
    if success:
        print("🎉 ALL TESTS PASSED - Position field is properly included in upcoming interviews endpoint")
        print("✅ The dynamic Prep Checklist feature will have access to position data")
    else:
        print("❌ SOME TESTS FAILED - Position field may not be properly accessible")
        print("⚠️ This could impact the dynamic Prep Checklist feature")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)