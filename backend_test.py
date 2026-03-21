#!/usr/bin/env python3
"""
Backend Test Suite for CareerFlow API
Testing conditional editability of salary_range and recruiter_email fields
"""
import requests
import json
import uuid
from datetime import datetime
import sys

# Backend URL from environment
BACKEND_URL = "https://careerflow-deploy-1.preview.emergentagent.com"
TEST_TOKEN = "test_token_abc123"

def print_test(title, passed, details=""):
    """Print test result with formatting"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {title}")
    if details:
        print(f"  {details}")
    print()

def test_conditional_editability():
    """
    Test the conditional editability of salary_range and recruiter_email fields.
    
    Per review request:
    1. Create job WITHOUT salary and recruiter_email 
    2. Update that job WITH salary and recruiter_email (should work since original empty)
    3. Create job WITH salary and recruiter_email already set
    4. Update that job - verify salary and email persist
    5. Cleanup
    """
    
    headers = {"Authorization": f"Bearer {TEST_TOKEN}", "Content-Type": "application/json"}
    test_results = []
    job_ids_to_cleanup = []
    
    print("🧪 TESTING: Conditional Editability of salary_range and recruiter_email")
    print("=" * 70)
    print()
    
    # Step 0: Verify backend connectivity and auth
    try:
        auth_response = requests.get(f"{BACKEND_URL}/api/auth/me", headers=headers, timeout=10)
        if auth_response.status_code == 200:
            print_test("Backend connectivity and authentication", True, f"Connected to {BACKEND_URL}")
        else:
            print_test("Backend connectivity and authentication", False, f"Auth failed: {auth_response.status_code}")
            return
    except Exception as e:
        print_test("Backend connectivity and authentication", False, f"Connection error: {str(e)}")
        return
    
    # Test 1: Create job WITHOUT salary and recruiter_email
    print("TEST 1: Create job WITHOUT salary and recruiter_email")
    job_data_empty = {
        "company_name": "Edit Test Corp A",
        "position": "Data Analyst", 
        "date_applied": "2026-03-17T00:00:00.000Z",
        "job_type": "Full-Time",
        "location": {"state": "Texas", "city": "Austin"},
        "work_mode": "hybrid",
        "status": "applied",
        "salary_range": {"min": 0, "max": 0},
        "recruiter_email": ""
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/api/jobs", headers=headers, json=job_data_empty, timeout=10)
        if response.status_code in [200, 201]:
            job_1 = response.json()
            job_1_id = job_1.get("job_id")
            job_ids_to_cleanup.append(job_1_id)
            
            # Verify empty values
            salary_range = job_1.get("salary_range", {})
            recruiter_email = job_1.get("recruiter_email", "")
            
            salary_empty = salary_range.get("min", 0) == 0 and salary_range.get("max", 0) == 0
            email_empty = recruiter_email == "" or recruiter_email is None
            
            if salary_empty and email_empty:
                print_test("Create job with empty salary and email", True, 
                          f"Job created: {job_1.get('company_name')} - {job_1.get('position')}")
                print(f"  ✓ salary_range: {salary_range} (min:0, max:0)")
                print(f"  ✓ recruiter_email: '{recruiter_email}' (empty)")
            else:
                print_test("Create job with empty salary and email", False,
                          f"Values not empty - salary: {salary_range}, email: '{recruiter_email}'")
        else:
            print_test("Create job with empty salary and email", False, 
                      f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        print_test("Create job with empty salary and email", False, f"Error: {str(e)}")
        return
    
    # Test 2: Update job WITH salary and recruiter_email (simulating user filling in empty fields)
    print("TEST 2: Update job WITH salary and recruiter_email (filling empty fields)")
    update_data_with_values = {
        "salary_range": {"min": 75000, "max": 95000},
        "recruiter_email": "hr@editcorp.com"
    }
    
    try:
        response = requests.put(f"{BACKEND_URL}/api/jobs/{job_1_id}", headers=headers, json=update_data_with_values, timeout=10)
        if response.status_code == 200:
            updated_job_1 = response.json()
            
            salary_range = updated_job_1.get("salary_range", {})
            recruiter_email = updated_job_1.get("recruiter_email", "")
            
            salary_correct = salary_range.get("min") == 75000 and salary_range.get("max") == 95000
            email_correct = recruiter_email == "hr@editcorp.com"
            
            if salary_correct and email_correct:
                print_test("Update job with salary and email values", True,
                          "Successfully updated previously empty fields")
                print(f"  ✓ salary_range: {salary_range}")
                print(f"  ✓ recruiter_email: '{recruiter_email}'")
            else:
                print_test("Update job with salary and email values", False,
                          f"Values not saved correctly - salary: {salary_range}, email: '{recruiter_email}'")
        else:
            print_test("Update job with salary and email values", False,
                      f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        print_test("Update job with salary and email values", False, f"Error: {str(e)}")
    
    # Test 3: Create job WITH salary and recruiter_email already set
    print("TEST 3: Create job WITH salary and recruiter_email already set")
    job_data_with_values = {
        "company_name": "Edit Test Corp B",
        "position": "Product Manager",
        "date_applied": "2026-03-17T00:00:00.000Z", 
        "job_type": "Full-Time",
        "location": {"state": "California", "city": "San Francisco"},
        "work_mode": "remote",
        "status": "applied",
        "salary_range": {"min": 100000, "max": 140000},
        "recruiter_email": "pm-recruiter@testcorp.com"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/api/jobs", headers=headers, json=job_data_with_values, timeout=10)
        if response.status_code in [200, 201]:
            job_2 = response.json()
            job_2_id = job_2.get("job_id")
            job_ids_to_cleanup.append(job_2_id)
            
            salary_range = job_2.get("salary_range", {})
            recruiter_email = job_2.get("recruiter_email", "")
            
            salary_correct = salary_range.get("min") == 100000 and salary_range.get("max") == 140000
            email_correct = recruiter_email == "pm-recruiter@testcorp.com"
            
            if salary_correct and email_correct:
                print_test("Create job with preset salary and email", True,
                          f"Job created: {job_2.get('company_name')} - {job_2.get('position')}")
                print(f"  ✓ salary_range: {salary_range}")
                print(f"  ✓ recruiter_email: '{recruiter_email}'")
            else:
                print_test("Create job with preset salary and email", False,
                          f"Values not saved - salary: {salary_range}, email: '{recruiter_email}'")
        else:
            print_test("Create job with preset salary and email", False,
                      f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        print_test("Create job with preset salary and email", False, f"Error: {str(e)}")
        return
    
    # Test 4: Update job - verify salary and email persist 
    print("TEST 4: Update job - verify salary and email persist")
    update_data_same_values = {
        "salary_range": {"min": 100000, "max": 140000},
        "recruiter_email": "pm-recruiter@testcorp.com",
        "notes": "Updated job notes"  # Add a different field to confirm update worked
    }
    
    try:
        response = requests.put(f"{BACKEND_URL}/api/jobs/{job_2_id}", headers=headers, json=update_data_same_values, timeout=10)
        if response.status_code == 200:
            updated_job_2 = response.json()
            
            salary_range = updated_job_2.get("salary_range", {})
            recruiter_email = updated_job_2.get("recruiter_email", "")
            notes = updated_job_2.get("notes", "")
            
            salary_unchanged = salary_range.get("min") == 100000 and salary_range.get("max") == 140000
            email_unchanged = recruiter_email == "pm-recruiter@testcorp.com"
            notes_updated = notes == "Updated job notes"
            
            if salary_unchanged and email_unchanged and notes_updated:
                print_test("Update job - values persist correctly", True,
                          "Salary and email values unchanged, other fields updated")
                print(f"  ✓ salary_range: {salary_range} (unchanged)")
                print(f"  ✓ recruiter_email: '{recruiter_email}' (unchanged)")
                print(f"  ✓ notes: '{notes}' (updated)")
            else:
                print_test("Update job - values persist correctly", False,
                          f"Values changed unexpectedly - salary: {salary_range}, email: '{recruiter_email}', notes: '{notes}'")
        else:
            print_test("Update job - values persist correctly", False,
                      f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        print_test("Update job - values persist correctly", False, f"Error: {str(e)}")
    
    # Test 5: Cleanup - Delete both test jobs
    print("TEST 5: Cleanup - Delete test jobs")
    cleanup_success = True
    
    for job_id in job_ids_to_cleanup:
        try:
            response = requests.delete(f"{BACKEND_URL}/api/jobs/{job_id}", headers=headers, timeout=10)
            if response.status_code != 200:
                cleanup_success = False
                print(f"  ❌ Failed to delete job {job_id}: {response.status_code}")
        except Exception as e:
            cleanup_success = False
            print(f"  ❌ Error deleting job {job_id}: {str(e)}")
    
    if cleanup_success:
        print_test("Cleanup test jobs", True, f"Successfully deleted {len(job_ids_to_cleanup)} test jobs")
    else:
        print_test("Cleanup test jobs", False, "Some jobs may not have been deleted")
    
    print()
    print("=" * 70)
    print("🏁 CONDITIONAL EDITABILITY TEST COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    test_conditional_editability()