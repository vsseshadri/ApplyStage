#!/usr/bin/env python3
"""
Backend API Testing for CareerFlow Job Tracking App
Testing POST /api/jobs endpoint to ensure job creation is working properly
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone
import sys
import traceback

# Backend URL from environment
BACKEND_URL = "https://interview-coach-96.preview.emergentagent.com"
TEST_TOKEN = "test_token_abc123"

class JobAPITester:
    def __init__(self):
        self.session = None
        self.headers = {
            "Authorization": f"Bearer {TEST_TOKEN}",
            "Content-Type": "application/json"
        }
        self.created_job_ids = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def test_backend_connectivity(self):
        """Test basic backend connectivity"""
        print("🔗 Testing backend connectivity...")
        try:
            async with self.session.get(f"{BACKEND_URL}/api/auth/me", headers=self.headers) as response:
                if response.status == 200:
                    user_data = await response.json()
                    print(f"✅ Backend connected successfully. User: {user_data.get('email', 'Unknown')}")
                    return True
                else:
                    print(f"❌ Backend connectivity failed. Status: {response.status}")
                    return False
        except Exception as e:
            print(f"❌ Backend connectivity error: {str(e)}")
            return False
    
    async def test_create_job_basic(self):
        """Test POST /api/jobs with basic required fields"""
        print("\n📝 Testing POST /api/jobs - Basic job creation...")
        
        job_data = {
            "company_name": "TechCorp Solutions",
            "position": "Senior Software Engineer",
            "location": {
                "city": "San Francisco",
                "state": "California"
            },
            "salary_range": {
                "min": 120000.0,
                "max": 160000.0
            },
            "work_mode": "hybrid",
            "job_type": "full_time",
            "date_applied": datetime.now(timezone.utc).isoformat(),
            "status": "applied",
            "is_priority": False
        }
        
        try:
            async with self.session.post(
                f"{BACKEND_URL}/api/jobs",
                headers=self.headers,
                json=job_data
            ) as response:
                
                if response.status == 200:
                    job_response = await response.json()
                    job_id = job_response.get("job_id")
                    
                    if job_id:
                        self.created_job_ids.append(job_id)
                        print(f"✅ Job created successfully. Job ID: {job_id}")
                        
                        # Verify response structure
                        required_fields = ["job_id", "user_id", "company_name", "position", "created_at"]
                        missing_fields = [field for field in required_fields if field not in job_response]
                        
                        if missing_fields:
                            print(f"⚠️ Missing fields in response: {missing_fields}")
                            return False
                        
                        # Verify data matches input
                        if (job_response["company_name"] == job_data["company_name"] and
                            job_response["position"] == job_data["position"] and
                            job_response["work_mode"] == job_data["work_mode"]):
                            print("✅ Job data matches input correctly")
                            return True
                        else:
                            print("❌ Job data doesn't match input")
                            return False
                    else:
                        print("❌ No job_id in response")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ Job creation failed. Status: {response.status}, Error: {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Job creation error: {str(e)}")
            traceback.print_exc()
            return False
    
    async def test_create_job_all_fields(self):
        """Test POST /api/jobs with all optional fields"""
        print("\n📝 Testing POST /api/jobs - Job creation with all fields...")
        
        job_data = {
            "company_name": "InnovateTech Inc",
            "position": "Principal Backend Engineer",
            "location": {
                "city": "Austin",
                "state": "Texas"
            },
            "salary_range": {
                "min": 140000.0,
                "max": 180000.0
            },
            "work_mode": "remote",
            "job_type": "full_time",
            "job_url": "https://innovatetech.com/careers/backend-engineer",
            "recruiter_email": "recruiter@innovatetech.com",
            "resume_file": "resume_v2.pdf",
            "date_applied": "2026-02-15T10:30:00Z",
            "follow_up_days": 7,
            "status": "applied",
            "upcoming_stage": "phone_screen",
            "upcoming_schedule": "02/25/2026",
            "notes": "Applied through LinkedIn. Recruiter mentioned fast-growing team.",
            "custom_stages": ["technical_assessment", "culture_fit"],
            "is_priority": True
        }
        
        try:
            async with self.session.post(
                f"{BACKEND_URL}/api/jobs",
                headers=self.headers,
                json=job_data
            ) as response:
                
                if response.status == 200:
                    job_response = await response.json()
                    job_id = job_response.get("job_id")
                    
                    if job_id:
                        self.created_job_ids.append(job_id)
                        print(f"✅ Job with all fields created successfully. Job ID: {job_id}")
                        
                        # Verify optional fields are preserved
                        optional_checks = [
                            ("job_url", job_data["job_url"]),
                            ("recruiter_email", job_data["recruiter_email"]),
                            ("upcoming_stage", job_data["upcoming_stage"]),
                            ("upcoming_schedule", job_data["upcoming_schedule"]),
                            ("notes", job_data["notes"]),
                            ("is_priority", job_data["is_priority"])
                        ]
                        
                        all_good = True
                        for field, expected_value in optional_checks:
                            if job_response.get(field) != expected_value:
                                print(f"⚠️ Field mismatch - {field}: expected {expected_value}, got {job_response.get(field)}")
                                all_good = False
                        
                        if all_good:
                            print("✅ All optional fields preserved correctly")
                            return True
                        else:
                            print("❌ Some optional fields not preserved correctly")
                            return False
                    else:
                        print("❌ No job_id in response")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ Job creation with all fields failed. Status: {response.status}, Error: {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Job creation with all fields error: {str(e)}")
            traceback.print_exc()
            return False
    
    async def test_get_jobs_empty(self):
        """Test GET /api/jobs when no jobs exist (baseline)"""
        print("\n📋 Testing GET /api/jobs - Initial state...")
        
        try:
            async with self.session.get(f"{BACKEND_URL}/api/jobs", headers=self.headers) as response:
                if response.status == 200:
                    jobs_response = await response.json()
                    
                    # Verify response structure
                    if "jobs" in jobs_response and "pagination" in jobs_response:
                        job_count = len(jobs_response["jobs"])
                        total_count = jobs_response["pagination"]["total_count"]
                        print(f"✅ GET /api/jobs working. Found {job_count} jobs (total: {total_count})")
                        return True
                    else:
                        print("❌ Invalid response structure for GET /api/jobs")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ GET /api/jobs failed. Status: {response.status}, Error: {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ GET /api/jobs error: {str(e)}")
            return False
    
    async def test_get_jobs_with_data(self):
        """Test GET /api/jobs after creating jobs"""
        print("\n📋 Testing GET /api/jobs - After job creation...")
        
        try:
            async with self.session.get(f"{BACKEND_URL}/api/jobs", headers=self.headers) as response:
                if response.status == 200:
                    jobs_response = await response.json()
                    
                    jobs = jobs_response.get("jobs", [])
                    pagination = jobs_response.get("pagination", {})
                    
                    if len(jobs) >= len(self.created_job_ids):
                        print(f"✅ GET /api/jobs returned {len(jobs)} jobs (expected at least {len(self.created_job_ids)})")
                        
                        # Verify created jobs are in the response
                        returned_job_ids = [job.get("job_id") for job in jobs]
                        found_jobs = [job_id for job_id in self.created_job_ids if job_id in returned_job_ids]
                        
                        if len(found_jobs) == len(self.created_job_ids):
                            print(f"✅ All {len(self.created_job_ids)} created jobs found in GET response")
                            
                            # Verify job structure
                            sample_job = jobs[0]
                            required_fields = ["job_id", "company_name", "position", "status", "created_at"]
                            missing_fields = [field for field in required_fields if field not in sample_job]
                            
                            if not missing_fields:
                                print("✅ Job objects have correct structure")
                                return True
                            else:
                                print(f"❌ Missing fields in job objects: {missing_fields}")
                                return False
                        else:
                            print(f"❌ Only found {len(found_jobs)} of {len(self.created_job_ids)} created jobs")
                            return False
                    else:
                        print(f"❌ Expected at least {len(self.created_job_ids)} jobs, got {len(jobs)}")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ GET /api/jobs failed. Status: {response.status}, Error: {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ GET /api/jobs error: {str(e)}")
            return False
    
    async def test_job_validation(self):
        """Test POST /api/jobs validation with invalid data"""
        print("\n🔍 Testing POST /api/jobs - Input validation...")
        
        # Test missing required fields
        invalid_job_data = {
            "position": "Software Engineer",
            # Missing company_name, location, salary_range, work_mode, job_type
        }
        
        try:
            async with self.session.post(
                f"{BACKEND_URL}/api/jobs",
                headers=self.headers,
                json=invalid_job_data
            ) as response:
                
                if response.status == 422:  # Validation error expected
                    print("✅ Validation correctly rejected incomplete job data")
                    return True
                elif response.status == 200:
                    print("⚠️ API accepted incomplete job data (should validate)")
                    return False
                else:
                    print(f"❌ Unexpected status for invalid data: {response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Validation test error: {str(e)}")
            return False
    
    async def test_get_specific_job(self):
        """Test GET /api/jobs/{job_id} for individual job retrieval"""
        print("\n🔍 Testing GET /api/jobs/{job_id} - Individual job retrieval...")
        
        if not self.created_job_ids:
            print("⚠️ No jobs created to test individual retrieval")
            return True
        
        job_id = self.created_job_ids[0]
        
        try:
            async with self.session.get(f"{BACKEND_URL}/api/jobs/{job_id}", headers=self.headers) as response:
                if response.status == 200:
                    job_data = await response.json()
                    
                    if job_data.get("job_id") == job_id:
                        print(f"✅ Individual job retrieval working. Job ID: {job_id}")
                        return True
                    else:
                        print(f"❌ Job ID mismatch in individual retrieval")
                        return False
                elif response.status == 404:
                    print(f"❌ Job not found: {job_id}")
                    return False
                else:
                    error_text = await response.text()
                    print(f"❌ Individual job retrieval failed. Status: {response.status}, Error: {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Individual job retrieval error: {str(e)}")
            return False
    
    async def test_response_format(self):
        """Test POST /api/jobs response format and status codes"""
        print("\n🔍 Testing POST /api/jobs - Response format and status codes...")
        
        job_data = {
            "company_name": "ResponseTest Corp",
            "position": "QA Engineer",
            "location": {
                "city": "Seattle",
                "state": "Washington"
            },
            "salary_range": {
                "min": 90000.0,
                "max": 120000.0
            },
            "work_mode": "remote",
            "job_type": "full_time",
            "date_applied": datetime.now(timezone.utc).isoformat(),
            "status": "applied"
        }
        
        try:
            async with self.session.post(
                f"{BACKEND_URL}/api/jobs",
                headers=self.headers,
                json=job_data
            ) as response:
                
                # Check status code
                if response.status != 200:
                    print(f"❌ Expected status 200, got {response.status}")
                    return False
                
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'application/json' not in content_type:
                    print(f"❌ Expected JSON response, got content-type: {content_type}")
                    return False
                
                job_response = await response.json()
                job_id = job_response.get("job_id")
                
                if job_id:
                    self.created_job_ids.append(job_id)
                    
                    # Verify response contains all expected fields
                    expected_fields = [
                        "job_id", "user_id", "company_name", "position", 
                        "location", "salary_range", "work_mode", "job_type",
                        "status", "created_at", "updated_at"
                    ]
                    
                    missing_fields = [field for field in expected_fields if field not in job_response]
                    
                    if not missing_fields:
                        print("✅ Response format correct with all expected fields")
                        return True
                    else:
                        print(f"❌ Missing fields in response: {missing_fields}")
                        return False
                else:
                    print("❌ No job_id in response")
                    return False
                    
        except Exception as e:
            print(f"❌ Response format test error: {str(e)}")
            return False
    
    async def cleanup_test_jobs(self):
        """Clean up created test jobs"""
        print(f"\n🧹 Cleaning up {len(self.created_job_ids)} test jobs...")
        
        cleanup_success = 0
        for job_id in self.created_job_ids:
            try:
                async with self.session.delete(f"{BACKEND_URL}/api/jobs/{job_id}", headers=self.headers) as response:
                    if response.status == 200:
                        cleanup_success += 1
                    else:
                        print(f"⚠️ Failed to delete job {job_id}: {response.status}")
            except Exception as e:
                print(f"⚠️ Error deleting job {job_id}: {str(e)}")
        
        print(f"✅ Cleaned up {cleanup_success}/{len(self.created_job_ids)} test jobs")
        return cleanup_success == len(self.created_job_ids)

async def run_job_api_tests():
    """Run all job API tests"""
    print("🚀 Starting CareerFlow Job API Tests - POST /api/jobs Endpoint")
    print("=" * 70)
    
    test_results = []
    
    async with JobAPITester() as tester:
        # Test sequence
        tests = [
            ("Backend Connectivity", tester.test_backend_connectivity),
            ("GET /api/jobs (baseline)", tester.test_get_jobs_empty),
            ("POST /api/jobs (basic fields)", tester.test_create_job_basic),
            ("POST /api/jobs (all fields)", tester.test_create_job_all_fields),
            ("POST /api/jobs (response format)", tester.test_response_format),
            ("GET /api/jobs (with data)", tester.test_get_jobs_with_data),
            ("GET /api/jobs/{id}", tester.test_get_specific_job),
            ("Input Validation", tester.test_job_validation),
        ]
        
        for test_name, test_func in tests:
            try:
                result = await test_func()
                test_results.append((test_name, result))
                if not result:
                    print(f"⚠️ Test '{test_name}' failed, continuing with remaining tests...")
            except Exception as e:
                print(f"❌ Test '{test_name}' crashed: {str(e)}")
                test_results.append((test_name, False))
        
        # Cleanup
        await tester.cleanup_test_jobs()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! POST /api/jobs endpoint is working correctly.")
        print("✅ Job creation with all required fields (company_name, position, date_applied, job_type) working")
        print("✅ Jobs are saved and returned correctly")
        print("✅ Response status codes and format are correct")
        print("✅ GET /api/jobs returns created jobs properly")
        return True
    else:
        print("⚠️ Some tests failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(run_job_api_tests())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n⏹️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test suite crashed: {str(e)}")
        traceback.print_exc()
        sys.exit(1)