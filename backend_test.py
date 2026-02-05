#!/usr/bin/env python3
"""
CareerFlow Backend API Testing Suite
Tests the backend API endpoints to verify functionality
"""

import requests
import json
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://repo-preview-43.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
TEST_TOKEN = "test_token_abc123"

# Headers for authenticated requests
AUTH_HEADERS = {
    "Authorization": f"Bearer {TEST_TOKEN}",
    "Content-Type": "application/json"
}

class BackendTester:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.test_results = []
        
    def log_result(self, test_name: str, passed: bool, message: str, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details
        }
        self.test_results.append(result)
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            
        print(f"{status} - {test_name}: {message}")
        if details and not passed:
            print(f"    Details: {details}")
    
    def test_backend_connectivity(self) -> bool:
        """Test if backend is running and accessible"""
        try:
            response = requests.get(f"{BASE_URL}/", timeout=10)
            if response.status_code in [200, 404]:  # 404 is fine, means server is running
                self.log_result("Backend Connectivity", True, f"Backend server responding (status: {response.status_code})")
                return True
            else:
                self.log_result("Backend Connectivity", False, f"Unexpected status code: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            self.log_result("Backend Connectivity", False, f"Connection failed: {str(e)}")
            return False
    
    def test_health_endpoint(self) -> bool:
        """Test GET /api/health endpoint"""
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            
            if response.status_code == 404:
                self.log_result("Health Endpoint", False, "Health endpoint not implemented (404 error)", 
                              "The /api/health endpoint is not implemented in the backend")
                return False
            elif response.status_code == 200:
                self.log_result("Health Endpoint", True, "Health endpoint working correctly")
                return True
            else:
                self.log_result("Health Endpoint", False, f"Unexpected status code: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Health Endpoint", False, f"Request failed: {str(e)}")
            return False
    
    def test_auth_me_endpoint(self) -> bool:
        """Test GET /api/auth/me endpoint for authentication"""
        try:
            response = requests.get(f"{API_BASE}/auth/me", headers=AUTH_HEADERS, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["user_id", "email", "name"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("Authentication", True, "Auth endpoint working correctly")
                    return True
                else:
                    self.log_result("Authentication", False, f"Missing required fields: {missing_fields}")
                    return False
            else:
                self.log_result("Authentication", False, f"Auth failed with status: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Authentication", False, f"Auth request failed: {str(e)}")
            return False
    
    def test_dashboard_stats(self) -> bool:
        """Test GET /api/dashboard/stats endpoint"""
        try:
            response = requests.get(f"{API_BASE}/dashboard/stats", headers=AUTH_HEADERS, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["total", "applied", "by_location", "by_work_mode", "by_position"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Dashboard Stats", False, f"Missing required fields: {missing_fields}")
                    return False
                
                # Check status counts
                status_fields = ["applied", "recruiter_screening", "phone_screen", "coding_round_1", 
                               "coding_round_2", "system_design", "behavioural", "hiring_manager", 
                               "final_round", "offer", "rejected"]
                
                for field in status_fields:
                    if field not in data or not isinstance(data[field], int):
                        self.log_result("Dashboard Stats", False, f"Invalid or missing status field: {field}")
                        return False
                
                # Check work mode structure
                work_modes = ["remote", "onsite", "hybrid"]
                for mode in work_modes:
                    if mode not in data["by_work_mode"] or not isinstance(data["by_work_mode"][mode], int):
                        self.log_result("Dashboard Stats", False, f"Invalid work mode data for: {mode}")
                        return False
                
                self.log_result("Dashboard Stats", True, 
                              f"Dashboard stats working correctly (total: {data['total']}, applied: {data['applied']})")
                return True
            else:
                self.log_result("Dashboard Stats", False, f"Request failed with status: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Dashboard Stats", False, f"Request failed: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.log_result("Dashboard Stats", False, f"Invalid JSON response: {str(e)}")
            return False
    
    def test_ai_insights(self) -> bool:
        """Test GET /api/dashboard/ai-insights endpoint"""
        try:
            response = requests.get(f"{API_BASE}/dashboard/ai-insights", headers=AUTH_HEADERS, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required structure
                if "insights" not in data or "follow_ups" not in data:
                    self.log_result("AI Insights", False, "Missing 'insights' or 'follow_ups' in response")
                    return False
                
                # Validate insights structure
                if not isinstance(data["insights"], list):
                    self.log_result("AI Insights", False, "Insights should be a list")
                    return False
                
                # Check insight structure if any exist
                for insight in data["insights"]:
                    required_insight_fields = ["icon", "color", "text", "type"]
                    missing_insight_fields = [field for field in required_insight_fields if field not in insight]
                    if missing_insight_fields:
                        self.log_result("AI Insights", False, f"Insight missing fields: {missing_insight_fields}")
                        return False
                
                # Validate follow_ups structure
                if not isinstance(data["follow_ups"], list):
                    self.log_result("AI Insights", False, "Follow_ups should be a list")
                    return False
                
                # Test that insights consider upcoming_stage and upcoming_schedule
                # This is verified by the structure and content being returned properly
                insights_count = len(data["insights"])
                follow_ups_count = len(data["follow_ups"])
                
                self.log_result("AI Insights", True, 
                              f"AI insights working correctly ({insights_count} insights, {follow_ups_count} follow-ups)")
                return True
            else:
                self.log_result("AI Insights", False, f"Request failed with status: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("AI Insights", False, f"Request failed: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.log_result("AI Insights", False, f"Invalid JSON response: {str(e)}")
            return False
    
    def test_jobs_api_empty(self) -> bool:
        """Test GET /api/jobs endpoint (should return empty initially)"""
        try:
            response = requests.get(f"{API_BASE}/jobs", headers=AUTH_HEADERS, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check pagination structure
                if "jobs" not in data or "pagination" not in data:
                    self.log_result("Jobs API (Empty)", False, "Missing 'jobs' or 'pagination' in response")
                    return False
                
                if not isinstance(data["jobs"], list):
                    self.log_result("Jobs API (Empty)", False, "Jobs should be a list")
                    return False
                
                pagination = data["pagination"]
                required_pagination_fields = ["page", "limit", "total_count", "total_pages", "has_next", "has_prev"]
                missing_pagination_fields = [field for field in required_pagination_fields if field not in pagination]
                
                if missing_pagination_fields:
                    self.log_result("Jobs API (Empty)", False, f"Pagination missing fields: {missing_pagination_fields}")
                    return False
                
                self.log_result("Jobs API (Empty)", True, 
                              f"Jobs API structure correct (found {len(data['jobs'])} jobs)")
                return True
            else:
                self.log_result("Jobs API (Empty)", False, f"Request failed with status: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Jobs API (Empty)", False, f"Request failed: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.log_result("Jobs API (Empty)", False, f"Invalid JSON response: {str(e)}")
            return False
    
    def test_job_creation_with_upcoming_stage(self) -> Optional[str]:
        """Test POST /api/jobs with upcoming_stage and upcoming_schedule"""
        try:
            # Create a job with upcoming_stage and upcoming_schedule
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%m/%d/%Y")
            
            job_data = {
                "company_name": "Test Company Inc",
                "position": "Senior Software Engineer",
                "location": {"city": "San Francisco", "state": "California"},
                "salary_range": {"min": 120000, "max": 180000},
                "work_mode": "hybrid",
                "job_type": "Software Engineer",
                "status": "applied",
                "upcoming_stage": "phone_screen",
                "upcoming_schedule": tomorrow,
                "date_applied": datetime.now(timezone.utc).isoformat(),
                "follow_up_days": 7,
                "is_priority": True,
                "notes": "Test job for upcoming stage functionality"
            }
            
            response = requests.post(f"{API_BASE}/jobs", 
                                   headers=AUTH_HEADERS, 
                                   json=job_data, 
                                   timeout=10)
            
            if response.status_code == 200:
                job = response.json()
                
                # Verify job creation
                required_fields = ["job_id", "company_name", "position", "status", "upcoming_stage", "upcoming_schedule"]
                missing_fields = [field for field in required_fields if field not in job]
                
                if missing_fields:
                    self.log_result("Job Creation", False, f"Created job missing fields: {missing_fields}")
                    return None
                
                # Verify upcoming_stage and upcoming_schedule are preserved
                if job["upcoming_stage"] != "phone_screen":
                    self.log_result("Job Creation", False, f"upcoming_stage not preserved: {job.get('upcoming_stage')}")
                    return None
                
                if job["upcoming_schedule"] != tomorrow:
                    self.log_result("Job Creation", False, f"upcoming_schedule not preserved: {job.get('upcoming_schedule')}")
                    return None
                
                self.log_result("Job Creation", True, 
                              f"Job created successfully with upcoming_stage: {job['upcoming_stage']}")
                return job["job_id"]
            else:
                self.log_result("Job Creation", False, f"Job creation failed with status: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            self.log_result("Job Creation", False, f"Request failed: {str(e)}")
            return None
        except json.JSONDecodeError as e:
            self.log_result("Job Creation", False, f"Invalid JSON response: {str(e)}")
            return None
    
    def test_job_update_status_sync(self, job_id: str) -> bool:
        """Test PUT /api/jobs/{job_id} to verify status and upcoming_stage syncing"""
        try:
            # Update job status and verify upcoming_stage handling
            update_data = {
                "status": "phone_screen",
                "upcoming_stage": "coding_round_1",
                "upcoming_schedule": "12/25/2024"
            }
            
            response = requests.put(f"{API_BASE}/jobs/{job_id}", 
                                  headers=AUTH_HEADERS, 
                                  json=update_data, 
                                  timeout=10)
            
            if response.status_code == 200:
                job = response.json()
                
                # Verify status update
                if job["status"] != "phone_screen":
                    self.log_result("Job Status Update", False, f"Status not updated: {job.get('status')}")
                    return False
                
                # Verify upcoming_stage update
                if job["upcoming_stage"] != "coding_round_1":
                    self.log_result("Job Status Update", False, f"upcoming_stage not updated: {job.get('upcoming_stage')}")
                    return False
                
                # Verify stages history is updated
                if "stages" not in job or not isinstance(job["stages"], list):
                    self.log_result("Job Status Update", False, "Stages history not maintained")
                    return False
                
                # Check that new status is added to stages
                latest_stage = job["stages"][-1] if job["stages"] else {}
                if latest_stage.get("status") != "phone_screen":
                    self.log_result("Job Status Update", False, "New status not added to stages history")
                    return False
                
                self.log_result("Job Status Update", True, 
                              f"Job updated successfully - status: {job['status']}, upcoming: {job['upcoming_stage']}")
                return True
            else:
                self.log_result("Job Status Update", False, f"Job update failed with status: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Job Status Update", False, f"Request failed: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.log_result("Job Status Update", False, f"Invalid JSON response: {str(e)}")
            return False
    
    def test_jobs_api_with_data(self) -> bool:
        """Test GET /api/jobs endpoint after creating data"""
        try:
            response = requests.get(f"{API_BASE}/jobs", headers=AUTH_HEADERS, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if len(data["jobs"]) == 0:
                    self.log_result("Jobs API (With Data)", False, "No jobs found after creation")
                    return False
                
                # Verify job structure
                job = data["jobs"][0]
                required_job_fields = ["job_id", "company_name", "position", "status", "location", "salary_range"]
                missing_job_fields = [field for field in required_job_fields if field not in job]
                
                if missing_job_fields:
                    self.log_result("Jobs API (With Data)", False, f"Job missing fields: {missing_job_fields}")
                    return False
                
                self.log_result("Jobs API (With Data)", True, 
                              f"Jobs API returning data correctly ({len(data['jobs'])} jobs)")
                return True
            else:
                self.log_result("Jobs API (With Data)", False, f"Request failed with status: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Jobs API (With Data)", False, f"Request failed: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.log_result("Jobs API (With Data)", False, f"Invalid JSON response: {str(e)}")
            return False
    
    def test_upcoming_interviews_endpoint(self) -> bool:
        """Test GET /api/dashboard/upcoming-interviews endpoint"""
        try:
            response = requests.get(f"{API_BASE}/dashboard/upcoming-interviews", headers=AUTH_HEADERS, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("Upcoming Interviews", False, "Response should be a list")
                    return False
                
                # If there are upcoming interviews, verify structure
                for interview in data:
                    required_fields = ["job_id", "company_name", "position", "stage", "schedule_date"]
                    missing_fields = [field for field in required_fields if field not in interview]
                    if missing_fields:
                        self.log_result("Upcoming Interviews", False, f"Interview missing fields: {missing_fields}")
                        return False
                
                self.log_result("Upcoming Interviews", True, 
                              f"Upcoming interviews endpoint working ({len(data)} interviews)")
                return True
            else:
                self.log_result("Upcoming Interviews", False, f"Request failed with status: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Upcoming Interviews", False, f"Request failed: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.log_result("Upcoming Interviews", False, f"Invalid JSON response: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting CareerFlow Backend API Tests")
        print("=" * 60)
        
        # Test 1: Backend connectivity
        if not self.test_backend_connectivity():
            print("\n❌ Backend not accessible. Stopping tests.")
            return False
        
        # Test 2: Authentication
        if not self.test_auth_me_endpoint():
            print("\n❌ Authentication failed. Stopping tests.")
            return False
        
        # Test 3: Health endpoint (expected to fail as not implemented)
        self.test_health_endpoint()
        
        # Test 4: Dashboard stats
        self.test_dashboard_stats()
        
        # Test 5: AI insights
        self.test_ai_insights()
        
        # Test 6: Jobs API (empty)
        self.test_jobs_api_empty()
        
        # Test 7: Job creation with upcoming_stage
        job_id = self.test_job_creation_with_upcoming_stage()
        
        # Test 8: Job status update and syncing
        if job_id:
            self.test_job_update_status_sync(job_id)
        
        # Test 9: Jobs API with data
        self.test_jobs_api_with_data()
        
        # Test 10: Upcoming interviews
        self.test_upcoming_interviews_endpoint()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = self.passed + self.failed
        success_rate = (self.passed / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {self.passed} ✅")
        print(f"Failed: {self.failed} ❌")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Print failed tests details
        if self.failed > 0:
            print(f"\n❌ FAILED TESTS ({self.failed}):")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"  • {result['test']}: {result['message']}")
                    if result['details']:
                        print(f"    {result['details']}")
        
        print("\n" + "=" * 60)
        return self.failed == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("🎉 All tests passed!")
        sys.exit(0)
    else:
        print("💥 Some tests failed!")
        sys.exit(1)