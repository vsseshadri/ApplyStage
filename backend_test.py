#!/usr/bin/env python3
"""
CareerFlow Backend API Testing Script
Tests the AI insights changes to verify upcoming_stage functionality
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://repo-preview-43.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
TEST_TOKEN = "test_token_abc123"

class CareerFlowTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {TEST_TOKEN}",
            "Content-Type": "application/json"
        })
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
    
    def test_health_endpoint(self):
        """Test 1: Health check endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("Health Check", True, f"Status: {data.get('status')}, Database: {data.get('database')}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unhealthy status: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_endpoint(self):
        """Test authentication endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/auth/me")
            
            if response.status_code == 200:
                user_data = response.json()
                self.log_test("Authentication", True, f"User: {user_data.get('email')}")
                return True
            else:
                self.log_test("Authentication", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def cleanup_test_jobs(self):
        """Clean up any existing test jobs"""
        try:
            # Get existing jobs
            response = self.session.get(f"{API_BASE}/jobs")
            if response.status_code == 200:
                jobs_data = response.json()
                jobs = jobs_data.get("jobs", [])
                
                # Delete test jobs
                for job in jobs:
                    if job.get("company_name", "").startswith("TestCompany"):
                        delete_response = self.session.delete(f"{API_BASE}/jobs/{job['job_id']}")
                        if delete_response.status_code == 200:
                            print(f"    Cleaned up test job: {job['company_name']}")
                            
        except Exception as e:
            print(f"    Cleanup warning: {str(e)}")
    
    def create_test_job(self, company_name, status="applied", upcoming_stage=None, upcoming_schedule=None, is_priority=False):
        """Create a test job application"""
        job_data = {
            "company_name": company_name,
            "position": "Software Engineer",
            "location": {"city": "San Francisco", "state": "California"},
            "salary_range": {"min": 120000, "max": 180000},
            "work_mode": "remote",
            "job_type": "Software Engineer",
            "status": status,
            "is_priority": is_priority,
            "date_applied": (datetime.now() - timedelta(days=5)).isoformat()
        }
        
        if upcoming_stage:
            job_data["upcoming_stage"] = upcoming_stage
        if upcoming_schedule:
            job_data["upcoming_schedule"] = upcoming_schedule
            
        try:
            response = self.session.post(f"{API_BASE}/jobs", json=job_data)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"    Failed to create job {company_name}: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"    Exception creating job {company_name}: {str(e)}")
            return None
    
    def test_ai_insights_basic(self):
        """Test 2: Basic AI insights endpoint functionality"""
        try:
            response = self.session.get(f"{API_BASE}/dashboard/ai-insights")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if "insights" in data and "follow_ups" in data:
                    insights = data.get("insights", [])
                    follow_ups = data.get("follow_ups", [])
                    
                    self.log_test("AI Insights Basic Structure", True, 
                                f"Found {len(insights)} insights and {len(follow_ups)} follow-ups")
                    return True
                else:
                    self.log_test("AI Insights Basic Structure", False, 
                                f"Missing required fields. Response: {data}")
                    return False
            else:
                self.log_test("AI Insights Basic Structure", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("AI Insights Basic Structure", False, f"Exception: {str(e)}")
            return False
    
    def test_ai_insights_upcoming_stage(self):
        """Test 3: AI insights with upcoming_stage functionality"""
        print("\n--- Setting up test data for upcoming_stage testing ---")
        
        # Clean up first
        self.cleanup_test_jobs()
        
        # Create test jobs with different scenarios
        test_jobs = []
        
        # Job 1: Priority job with upcoming_stage (should show "Upcoming" prefix)
        job1 = self.create_test_job(
            company_name="TestCompanyA",
            status="applied", 
            upcoming_stage="phone_screen",
            upcoming_schedule="12/30/2024",
            is_priority=True
        )
        if job1:
            test_jobs.append(job1)
            print(f"    Created priority job with upcoming_stage: {job1['company_name']}")
        
        # Job 2: Priority job without upcoming_stage (should show current status)
        job2 = self.create_test_job(
            company_name="TestCompanyB",
            status="recruiter_screening",
            is_priority=True
        )
        if job2:
            test_jobs.append(job2)
            print(f"    Created priority job without upcoming_stage: {job2['company_name']}")
        
        # Job 3: Non-priority job with upcoming_stage (should not appear in priority insights)
        job3 = self.create_test_job(
            company_name="TestCompanyC",
            status="applied",
            upcoming_stage="coding_round_1",
            upcoming_schedule="12/31/2024",
            is_priority=False
        )
        if job3:
            test_jobs.append(job3)
            print(f"    Created non-priority job with upcoming_stage: {job3['company_name']}")
        
        if not test_jobs:
            self.log_test("AI Insights Upcoming Stage", False, "Failed to create test jobs")
            return False
        
        print(f"\n--- Testing AI insights with {len(test_jobs)} test jobs ---")
        
        try:
            # Get AI insights
            response = self.session.get(f"{API_BASE}/dashboard/ai-insights")
            
            if response.status_code != 200:
                self.log_test("AI Insights Upcoming Stage", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            data = response.json()
            insights = data.get("insights", [])
            
            print(f"    Received {len(insights)} insights")
            
            # Analyze insights for upcoming_stage functionality
            upcoming_stage_found = False
            regular_stage_found = False
            correct_format_found = False
            
            for insight in insights:
                text = insight.get("text", "")
                print(f"    Insight: {text}")
                
                # Check for TestCompanyA (should have "Upcoming" prefix)
                if "TestCompanyA" in text:
                    if "Upcoming" in text and "Phone Screen" in text:
                        upcoming_stage_found = True
                        correct_format_found = True
                        print(f"    ✅ Found upcoming stage insight: {text}")
                    elif "Phone Screen" in text:
                        print(f"    ⚠️  Found TestCompanyA insight but missing 'Upcoming' prefix: {text}")
                
                # Check for TestCompanyB (should show current status without "Upcoming")
                if "TestCompanyB" in text:
                    if "Recruiter Screening" in text and "Upcoming" not in text:
                        regular_stage_found = True
                        print(f"    ✅ Found regular stage insight: {text}")
                    elif "Recruiter Screening" in text:
                        print(f"    ⚠️  Found TestCompanyB insight with unexpected 'Upcoming' prefix: {text}")
            
            # Evaluate results
            success = True
            details = []
            
            if upcoming_stage_found:
                details.append("✅ Upcoming stage insights working correctly")
            else:
                details.append("❌ Upcoming stage insights not found or incorrect format")
                success = False
            
            if regular_stage_found:
                details.append("✅ Regular stage insights working correctly")
            else:
                details.append("❌ Regular stage insights not found")
                success = False
            
            if correct_format_found:
                details.append("✅ Correct 'Company (Upcoming Stage): tip' format found")
            else:
                details.append("❌ Expected format 'Company (Upcoming Stage): tip' not found")
                success = False
            
            self.log_test("AI Insights Upcoming Stage", success, "; ".join(details))
            
            # Clean up test jobs
            print("\n--- Cleaning up test data ---")
            self.cleanup_test_jobs()
            
            return success
            
        except Exception as e:
            self.log_test("AI Insights Upcoming Stage", False, f"Exception: {str(e)}")
            # Clean up on error
            self.cleanup_test_jobs()
            return False
    
    def test_no_500_errors(self):
        """Test 4: Verify no 500 errors on key endpoints"""
        endpoints_to_test = [
            "/health",
            "/auth/me", 
            "/dashboard/stats",
            "/dashboard/ai-insights",
            "/dashboard/upcoming-interviews",
            "/jobs"
        ]
        
        all_success = True
        error_details = []
        
        for endpoint in endpoints_to_test:
            try:
                response = self.session.get(f"{API_BASE}{endpoint}")
                
                if response.status_code == 500:
                    all_success = False
                    error_details.append(f"{endpoint}: HTTP 500")
                elif response.status_code >= 400:
                    # Log other errors but don't fail the test (might be expected like 401, 404)
                    error_details.append(f"{endpoint}: HTTP {response.status_code} (non-500)")
                else:
                    error_details.append(f"{endpoint}: HTTP {response.status_code} ✅")
                    
            except Exception as e:
                all_success = False
                error_details.append(f"{endpoint}: Exception - {str(e)}")
        
        self.log_test("No 500 Errors", all_success, "; ".join(error_details))
        return all_success
    
    def run_all_tests(self):
        """Run all tests and return summary"""
        print("🚀 Starting CareerFlow Backend API Tests")
        print("=" * 60)
        
        # Run tests in order
        test_methods = [
            self.test_health_endpoint,
            self.test_auth_endpoint, 
            self.test_ai_insights_basic,
            self.test_ai_insights_upcoming_stage,
            self.test_no_500_errors
        ]
        
        for test_method in test_methods:
            print()
            test_method()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{status} - {result['test']}")
        
        print(f"\nResults: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All tests passed! AI insights upcoming_stage functionality is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Please review the issues above.")
            return False

def main():
    """Main test execution"""
    tester = CareerFlowTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()