#!/usr/bin/env python3
"""
CareerFlow Backend API Testing - Upcoming Stage Sync and Upcoming Interviews
Test the upcoming_stage sync and upcoming interviews functionality as specified in review request.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone
import sys

# Test configuration
BASE_URL = "https://application-intel.preview.emergentagent.com/api"
TEST_TOKEN = "test_token_abc123"

class CareerFlowAPITester:
    def __init__(self):
        self.session = None
        self.headers = {
            "Authorization": f"Bearer {TEST_TOKEN}",
            "Content-Type": "application/json"
        }
        self.test_job_id = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    async def test_backend_connectivity(self):
        """Test 1: Verify backend connectivity"""
        try:
            async with self.session.get(f"{BASE_URL}/auth/me", headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    self.log_result("Backend Connectivity", True, f"Connected as {data.get('name', 'Test User')}")
                    return True
                else:
                    self.log_result("Backend Connectivity", False, f"HTTP {response.status}")
                    return False
        except Exception as e:
            self.log_result("Backend Connectivity", False, f"Connection error: {str(e)}")
            return False
    
    async def test_create_job_with_upcoming_stage(self):
        """Test 2: Create a job with upcoming_stage set"""
        job_data = {
            "company_name": "TestSync Corp",
            "position": "Software Engineer",
            "location": {"city": "San Francisco", "state": "California"},
            "salary_range": {"min": 120000, "max": 180000},
            "work_mode": "remote",
            "job_type": "Software Engineer",
            "status": "phone_screen",
            "upcoming_stage": "phone_screen",
            "upcoming_schedule": "03/15/2026",
            "date_applied": "2026-02-25T00:00:00Z",
            "is_priority": True
        }
        
        try:
            async with self.session.post(f"{BASE_URL}/jobs", headers=self.headers, json=job_data) as response:
                if response.status == 200:
                    data = await response.json()
                    self.test_job_id = data.get("job_id")
                    
                    # Verify both status and upcoming_stage are set correctly
                    if (data.get("status") == "phone_screen" and 
                        data.get("upcoming_stage") == "phone_screen" and
                        data.get("upcoming_schedule") == "03/15/2026"):
                        self.log_result("Create Job with Upcoming Stage", True, 
                                      f"Job created with ID: {self.test_job_id}, status: {data.get('status')}, upcoming_stage: {data.get('upcoming_stage')}")
                        return True
                    else:
                        self.log_result("Create Job with Upcoming Stage", False, 
                                      f"Status/upcoming_stage mismatch - status: {data.get('status')}, upcoming_stage: {data.get('upcoming_stage')}")
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Create Job with Upcoming Stage", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Create Job with Upcoming Stage", False, f"Error: {str(e)}")
            return False
    
    async def test_upcoming_interviews_endpoint(self):
        """Test 3: Verify the job appears in upcoming interviews"""
        try:
            async with self.session.get(f"{BASE_URL}/dashboard/upcoming-interviews", headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Look for our TestSync Corp job
                    testsync_job = None
                    for interview in data:
                        if interview.get("company_name") == "TestSync Corp":
                            testsync_job = interview
                            break
                    
                    if testsync_job:
                        if (testsync_job.get("stage") == "phone_screen" and
                            "Mar 15, 2026" in testsync_job.get("schedule_date", "")):
                            self.log_result("Upcoming Interviews Endpoint", True, 
                                          f"TestSync Corp job found with stage: {testsync_job.get('stage')}, date: {testsync_job.get('schedule_date')}")
                            return True
                        else:
                            self.log_result("Upcoming Interviews Endpoint", False, 
                                          f"TestSync Corp job found but incorrect data - stage: {testsync_job.get('stage')}, date: {testsync_job.get('schedule_date')}")
                            return False
                    else:
                        self.log_result("Upcoming Interviews Endpoint", False, 
                                      f"TestSync Corp job not found in upcoming interviews. Found {len(data)} interviews total")
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Upcoming Interviews Endpoint", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Upcoming Interviews Endpoint", False, f"Error: {str(e)}")
            return False
    
    async def test_update_job_upcoming_stage(self):
        """Test 4: Update the job with a new upcoming_stage"""
        if not self.test_job_id:
            self.log_result("Update Job Upcoming Stage", False, "No test job ID available")
            return False
        
        update_data = {
            "status": "system_design",
            "upcoming_stage": "system_design",
            "upcoming_schedule": "03/20/2026"
        }
        
        try:
            async with self.session.put(f"{BASE_URL}/jobs/{self.test_job_id}", headers=self.headers, json=update_data) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if (data.get("status") == "system_design" and 
                        data.get("upcoming_stage") == "system_design" and
                        data.get("upcoming_schedule") == "03/20/2026"):
                        self.log_result("Update Job Upcoming Stage", True, 
                                      f"Job updated - status: {data.get('status')}, upcoming_stage: {data.get('upcoming_stage')}, schedule: {data.get('upcoming_schedule')}")
                        return True
                    else:
                        self.log_result("Update Job Upcoming Stage", False, 
                                      f"Update failed - status: {data.get('status')}, upcoming_stage: {data.get('upcoming_stage')}")
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Update Job Upcoming Stage", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Update Job Upcoming Stage", False, f"Error: {str(e)}")
            return False
    
    async def test_updated_upcoming_interviews(self):
        """Test 5: Verify updated upcoming interviews"""
        try:
            async with self.session.get(f"{BASE_URL}/dashboard/upcoming-interviews", headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Look for our updated TestSync Corp job
                    testsync_job = None
                    for interview in data:
                        if interview.get("company_name") == "TestSync Corp":
                            testsync_job = interview
                            break
                    
                    if testsync_job:
                        if (testsync_job.get("stage") == "system_design" and
                            "Mar 20, 2026" in testsync_job.get("schedule_date", "")):
                            self.log_result("Updated Upcoming Interviews", True, 
                                          f"TestSync Corp job updated correctly - stage: {testsync_job.get('stage')}, date: {testsync_job.get('schedule_date')}")
                            return True
                        else:
                            self.log_result("Updated Upcoming Interviews", False, 
                                          f"TestSync Corp job not updated correctly - stage: {testsync_job.get('stage')}, date: {testsync_job.get('schedule_date')}")
                            return False
                    else:
                        self.log_result("Updated Upcoming Interviews", False, 
                                      "TestSync Corp job not found in updated upcoming interviews")
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Updated Upcoming Interviews", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Updated Upcoming Interviews", False, f"Error: {str(e)}")
            return False
    
    async def test_custom_status_support(self):
        """Test 6: Test custom status support"""
        if not self.test_job_id:
            self.log_result("Custom Status Support", False, "No test job ID available")
            return False
        
        update_data = {
            "status": "custom_interview_stage",
            "upcoming_stage": "custom_interview_stage",
            "upcoming_schedule": "03/25/2026"
        }
        
        try:
            async with self.session.put(f"{BASE_URL}/jobs/{self.test_job_id}", headers=self.headers, json=update_data) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if (data.get("status") == "custom_interview_stage" and 
                        data.get("upcoming_stage") == "custom_interview_stage" and
                        data.get("upcoming_schedule") == "03/25/2026"):
                        self.log_result("Custom Status Support", True, 
                                      f"Custom status saved correctly - status: {data.get('status')}, upcoming_stage: {data.get('upcoming_stage')}")
                        return True
                    else:
                        self.log_result("Custom Status Support", False, 
                                      f"Custom status not saved correctly - status: {data.get('status')}, upcoming_stage: {data.get('upcoming_stage')}")
                        return False
                else:
                    error_text = await response.text()
                    self.log_result("Custom Status Support", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Custom Status Support", False, f"Error: {str(e)}")
            return False
    
    async def test_cleanup(self):
        """Test 7: Cleanup - Delete the test job"""
        if not self.test_job_id:
            self.log_result("Cleanup", True, "No test job to cleanup")
            return True
        
        try:
            async with self.session.delete(f"{BASE_URL}/jobs/{self.test_job_id}", headers=self.headers) as response:
                if response.status == 200:
                    self.log_result("Cleanup", True, f"Test job {self.test_job_id} deleted successfully")
                    return True
                else:
                    error_text = await response.text()
                    self.log_result("Cleanup", False, f"HTTP {response.status}: {error_text}")
                    return False
        except Exception as e:
            self.log_result("Cleanup", False, f"Error: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting CareerFlow Backend API Testing - Upcoming Stage Sync and Upcoming Interviews")
        print(f"📡 Testing against: {BASE_URL}")
        print("=" * 80)
        
        # Test sequence as specified in review request
        tests = [
            self.test_backend_connectivity,
            self.test_create_job_with_upcoming_stage,
            self.test_upcoming_interviews_endpoint,
            self.test_update_job_upcoming_stage,
            self.test_updated_upcoming_interviews,
            self.test_custom_status_support,
            self.test_cleanup
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                result = await test()
                if result:
                    passed += 1
                print()  # Add spacing between tests
            except Exception as e:
                self.log_result(test.__name__, False, f"Unexpected error: {str(e)}")
                print()
        
        # Summary
        print("=" * 80)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed ({(passed/total)*100:.1f}% success rate)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Upcoming stage sync and upcoming interviews functionality working correctly!")
        else:
            print("⚠️  SOME TESTS FAILED - See details above")
            
        return passed == total

async def main():
    """Main test runner"""
    async with CareerFlowAPITester() as tester:
        success = await tester.run_all_tests()
        return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)