#!/usr/bin/env python3
"""
Backend API Testing Script for CareerFlow CSV Import Feature
Tests salary_range and recruiter_email field support in job creation/updates
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://prep-boost-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
TEST_TOKEN = "test_token_abc123"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {TEST_TOKEN}',
            'Content-Type': 'application/json'
        })
        self.created_job_id = None

    def test_auth(self) -> Dict[str, Any]:
        """Test authentication endpoint"""
        print("🔐 Testing Authentication...")
        try:
            response = self.session.get(f"{API_BASE}/auth/me")
            if response.status_code == 200:
                user_data = response.json()
                print(f"✅ PASS - Authentication successful. User: {user_data.get('email', 'Unknown')}")
                return {"status": "PASS", "data": user_data}
            else:
                print(f"❌ FAIL - Auth endpoint returned {response.status_code}: {response.text}")
                return {"status": "FAIL", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            print(f"❌ FAIL - Auth request failed: {e}")
            return {"status": "FAIL", "error": str(e)}

    def test_create_job_with_salary_and_recruiter(self) -> Dict[str, Any]:
        """Test POST /api/jobs with salary_range and recruiter_email"""
        print("\n💼 Testing Job Creation with Salary Range and Recruiter Email...")
        
        job_data = {
            "company_name": "CSV Import Test Corp",
            "position": "Software Engineer", 
            "date_applied": "2026-03-17T00:00:00.000Z",
            "job_type": "Full-Time",
            "location": {"state": "California", "city": "San Jose"},
            "work_mode": "remote",
            "status": "applied",
            "salary_range": {"min": 85000, "max": 120000},
            "recruiter_email": "recruiter@testcorp.com",
            "job_url": "",
            "notes": "",
            "follow_up_days": 7,
            "is_priority": False
        }
        
        try:
            response = self.session.post(f"{API_BASE}/jobs", json=job_data)
            if response.status_code == 200:
                job = response.json()
                self.created_job_id = job.get('job_id')
                
                # Verify salary_range and recruiter_email are preserved
                salary_range = job.get('salary_range', {})
                recruiter_email = job.get('recruiter_email')
                
                if (salary_range.get('min') == 85000 and 
                    salary_range.get('max') == 120000 and 
                    recruiter_email == "recruiter@testcorp.com"):
                    print(f"✅ PASS - Job created successfully with correct salary_range and recruiter_email")
                    print(f"   Job ID: {self.created_job_id}")
                    print(f"   Salary Range: ${salary_range.get('min'):,} - ${salary_range.get('max'):,}")
                    print(f"   Recruiter Email: {recruiter_email}")
                    return {"status": "PASS", "job_id": self.created_job_id, "data": job}
                else:
                    print(f"❌ FAIL - Job created but salary_range or recruiter_email incorrect")
                    print(f"   Expected salary: {{min: 85000, max: 120000}}, got: {salary_range}")
                    print(f"   Expected recruiter: recruiter@testcorp.com, got: {recruiter_email}")
                    return {"status": "FAIL", "error": "Incorrect field values"}
            else:
                print(f"❌ FAIL - Job creation failed: HTTP {response.status_code}")
                print(f"   Response: {response.text}")
                return {"status": "FAIL", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            print(f"❌ FAIL - Job creation request failed: {e}")
            return {"status": "FAIL", "error": str(e)}

    def test_get_jobs_verify_creation(self) -> Dict[str, Any]:
        """Test GET /api/jobs and verify the created job appears with correct data"""
        print("\n📋 Testing Job List Retrieval...")
        
        if not self.created_job_id:
            print("❌ FAIL - No job ID available to verify")
            return {"status": "FAIL", "error": "No job ID"}
        
        try:
            response = self.session.get(f"{API_BASE}/jobs")
            if response.status_code == 200:
                jobs_data = response.json()
                jobs = jobs_data.get('jobs', [])
                
                # Find our created job
                created_job = None
                for job in jobs:
                    if job.get('job_id') == self.created_job_id:
                        created_job = job
                        break
                
                if created_job:
                    salary_range = created_job.get('salary_range', {})
                    recruiter_email = created_job.get('recruiter_email')
                    company_name = created_job.get('company_name')
                    
                    if (salary_range.get('min') == 85000 and 
                        salary_range.get('max') == 120000 and 
                        recruiter_email == "recruiter@testcorp.com" and
                        company_name == "CSV Import Test Corp"):
                        print(f"✅ PASS - Job found in list with correct salary_range and recruiter_email")
                        print(f"   Company: {company_name}")
                        print(f"   Salary Range: ${salary_range.get('min'):,} - ${salary_range.get('max'):,}")
                        print(f"   Recruiter Email: {recruiter_email}")
                        return {"status": "PASS", "data": created_job}
                    else:
                        print(f"❌ FAIL - Job found but with incorrect data")
                        return {"status": "FAIL", "error": "Incorrect data"}
                else:
                    print(f"❌ FAIL - Created job not found in job list")
                    return {"status": "FAIL", "error": "Job not found"}
            else:
                print(f"❌ FAIL - Job list retrieval failed: HTTP {response.status_code}")
                return {"status": "FAIL", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            print(f"❌ FAIL - Job list request failed: {e}")
            return {"status": "FAIL", "error": str(e)}

    def test_update_job_salary_and_recruiter(self) -> Dict[str, Any]:
        """Test PUT /api/jobs/{job_id} with updated salary_range and recruiter_email"""
        print("\n✏️ Testing Job Update with New Salary Range and Recruiter Email...")
        
        if not self.created_job_id:
            print("❌ FAIL - No job ID available to update")
            return {"status": "FAIL", "error": "No job ID"}
        
        update_data = {
            "salary_range": {"min": 90000, "max": 130000},
            "recruiter_email": "new.recruiter@testcorp.com"
        }
        
        try:
            response = self.session.put(f"{API_BASE}/jobs/{self.created_job_id}", json=update_data)
            if response.status_code == 200:
                job = response.json()
                
                # Verify updated salary_range and recruiter_email
                salary_range = job.get('salary_range', {})
                recruiter_email = job.get('recruiter_email')
                
                if (salary_range.get('min') == 90000 and 
                    salary_range.get('max') == 130000 and 
                    recruiter_email == "new.recruiter@testcorp.com"):
                    print(f"✅ PASS - Job updated successfully with new salary_range and recruiter_email")
                    print(f"   Updated Salary Range: ${salary_range.get('min'):,} - ${salary_range.get('max'):,}")
                    print(f"   Updated Recruiter Email: {recruiter_email}")
                    return {"status": "PASS", "data": job}
                else:
                    print(f"❌ FAIL - Job updated but salary_range or recruiter_email incorrect")
                    print(f"   Expected salary: {{min: 90000, max: 130000}}, got: {salary_range}")
                    print(f"   Expected recruiter: new.recruiter@testcorp.com, got: {recruiter_email}")
                    return {"status": "FAIL", "error": "Incorrect updated values"}
            else:
                print(f"❌ FAIL - Job update failed: HTTP {response.status_code}")
                print(f"   Response: {response.text}")
                return {"status": "FAIL", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            print(f"❌ FAIL - Job update request failed: {e}")
            return {"status": "FAIL", "error": str(e)}

    def test_get_individual_job_verify_update(self) -> Dict[str, Any]:
        """Test GET /api/jobs/{job_id} and verify the update persisted"""
        print("\n🔍 Testing Individual Job Retrieval to Verify Update...")
        
        if not self.created_job_id:
            print("❌ FAIL - No job ID available to verify")
            return {"status": "FAIL", "error": "No job ID"}
        
        try:
            response = self.session.get(f"{API_BASE}/jobs/{self.created_job_id}")
            if response.status_code == 200:
                job = response.json()
                
                # Verify persisted updates
                salary_range = job.get('salary_range', {})
                recruiter_email = job.get('recruiter_email')
                company_name = job.get('company_name')
                
                if (salary_range.get('min') == 90000 and 
                    salary_range.get('max') == 130000 and 
                    recruiter_email == "new.recruiter@testcorp.com"):
                    print(f"✅ PASS - Updated job data persisted correctly")
                    print(f"   Company: {company_name}")
                    print(f"   Final Salary Range: ${salary_range.get('min'):,} - ${salary_range.get('max'):,}")
                    print(f"   Final Recruiter Email: {recruiter_email}")
                    return {"status": "PASS", "data": job}
                else:
                    print(f"❌ FAIL - Updated job data did not persist correctly")
                    print(f"   Expected salary: {{min: 90000, max: 130000}}, got: {salary_range}")
                    print(f"   Expected recruiter: new.recruiter@testcorp.com, got: {recruiter_email}")
                    return {"status": "FAIL", "error": "Update not persisted"}
            else:
                print(f"❌ FAIL - Individual job retrieval failed: HTTP {response.status_code}")
                return {"status": "FAIL", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            print(f"❌ FAIL - Individual job request failed: {e}")
            return {"status": "FAIL", "error": str(e)}

    def test_cleanup_delete_job(self) -> Dict[str, Any]:
        """Test DELETE /api/jobs/{job_id} to clean up test data"""
        print("\n🗑️ Testing Cleanup - Deleting Test Job...")
        
        if not self.created_job_id:
            print("❌ FAIL - No job ID available to delete")
            return {"status": "FAIL", "error": "No job ID"}
        
        try:
            response = self.session.delete(f"{API_BASE}/jobs/{self.created_job_id}")
            if response.status_code == 200:
                print(f"✅ PASS - Test job deleted successfully")
                print(f"   Deleted Job ID: {self.created_job_id}")
                return {"status": "PASS"}
            else:
                print(f"❌ FAIL - Job deletion failed: HTTP {response.status_code}")
                print(f"   Response: {response.text}")
                return {"status": "FAIL", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            print(f"❌ FAIL - Job deletion request failed: {e}")
            return {"status": "FAIL", "error": str(e)}

    def run_all_tests(self):
        """Run all CSV import backend support tests"""
        print("🚀 Starting CSV Import Backend Support Tests")
        print("=" * 60)
        print(f"Backend URL: {BASE_URL}")
        print(f"API Base: {API_BASE}")
        print("=" * 60)
        
        results = {}
        
        # Test sequence
        results['auth'] = self.test_auth()
        if results['auth']['status'] != 'PASS':
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with other tests.")
            return results
        
        results['create_job'] = self.test_create_job_with_salary_and_recruiter()
        results['get_jobs_verify'] = self.test_get_jobs_verify_creation()
        results['update_job'] = self.test_update_job_salary_and_recruiter()
        results['get_job_verify_update'] = self.test_get_individual_job_verify_update()
        results['cleanup'] = self.test_cleanup_delete_job()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = []
        failed_tests = []
        
        for test_name, result in results.items():
            status = result.get('status', 'UNKNOWN')
            if status == 'PASS':
                passed_tests.append(test_name)
                print(f"✅ {test_name.replace('_', ' ').title()}: PASS")
            else:
                failed_tests.append(test_name)
                error = result.get('error', 'Unknown error')
                print(f"❌ {test_name.replace('_', ' ').title()}: FAIL - {error}")
        
        total_tests = len(results)
        passed_count = len(passed_tests)
        success_rate = (passed_count / total_tests) * 100 if total_tests > 0 else 0
        
        print(f"\n🎯 Overall Results: {passed_count}/{total_tests} tests passed ({success_rate:.1f}% success rate)")
        
        if passed_count == total_tests:
            print("🎉 ALL TESTS PASSED! CSV import backend support is working correctly.")
        else:
            print(f"⚠️ {len(failed_tests)} test(s) failed. Review the issues above.")
        
        return results

def main():
    """Main function to run CSV import backend tests"""
    tester = BackendTester()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    all_passed = all(r.get('status') == 'PASS' for r in results.values())
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()