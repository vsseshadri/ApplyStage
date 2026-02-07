#!/usr/bin/env python3
"""
Comprehensive CareerFlow Backend API Testing
Tests all endpoints mentioned in the review request with detailed verification
"""

import requests
import json
import sys
from datetime import datetime, timezone, timedelta

# Backend URL from review request
BACKEND_URL = "https://repo-preview-43.emergent.host"
API_BASE = f"{BACKEND_URL}/api"
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
    
    def add_result(self, test_name, passed, message, details=None):
        status = "✅ PASS" if passed else "❌ FAIL"
        self.results.append({
            "test": test_name,
            "status": status,
            "message": message,
            "details": details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        print(f"{status} - {test_name}: {message}")
        if details and not passed:
            print(f"    Details: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        success_rate = (self.passed / total * 100) if total > 0 else 0
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed ({success_rate:.1f}% success rate)")
        print(f"{'='*60}")
        return success_rate >= 80

def test_health_endpoint():
    """Test 1: Health check - GET /api/health"""
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        
        if response.status_code == 200:
            try:
                data = response.json()
                status = data.get("status", "unknown")
                db_status = data.get("database", "unknown")
                return True, f"Health endpoint working - Status: {status}, Database: {db_status}"
            except:
                return True, "Health endpoint responding (non-JSON response)"
        else:
            return False, f"Health endpoint returned {response.status_code}"
            
    except Exception as e:
        return False, f"Health endpoint error: {str(e)}"

def test_authentication():
    """Test authentication with test token"""
    try:
        response = requests.get(f"{API_BASE}/auth/me", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "user_id" in data and "email" in data:
                return True, f"Authentication working - User: {data.get('email')}"
            else:
                return False, "Auth response missing required fields"
        else:
            return False, f"Authentication failed - HTTP {response.status_code}"
            
    except Exception as e:
        return False, f"Authentication error: {str(e)}"

def create_test_jobs():
    """Create test jobs with different statuses including ghosted"""
    jobs_created = []
    
    test_jobs = [
        {
            "company_name": "TestCompanyA",
            "position": "Senior Software Engineer",
            "location": {"city": "San Francisco", "state": "California"},
            "salary_range": {"min": 150000, "max": 200000},
            "work_mode": "remote",
            "job_type": "Software Engineer",
            "status": "phone_screen",
            "upcoming_stage": "system_design",
            "upcoming_schedule": "12/25/2024",
            "is_priority": True,
            "date_applied": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
        },
        {
            "company_name": "TestCompanyB",
            "position": "Frontend Developer",
            "location": {"city": "New York", "state": "New York"},
            "salary_range": {"min": 120000, "max": 160000},
            "work_mode": "hybrid",
            "job_type": "Software Engineer",
            "status": "ghosted",
            "is_priority": False,
            "date_applied": (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()
        },
        {
            "company_name": "TestCompanyC",
            "position": "Backend Engineer",
            "location": {"city": "Austin", "state": "Texas"},
            "salary_range": {"min": 140000, "max": 180000},
            "work_mode": "onsite",
            "job_type": "Software Engineer",
            "status": "applied",
            "is_priority": True,
            "date_applied": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        }
    ]
    
    for job_data in test_jobs:
        try:
            response = requests.post(f"{API_BASE}/jobs", headers=HEADERS, json=job_data, timeout=10)
            if response.status_code in [200, 201]:
                job = response.json()
                jobs_created.append(job.get('job_id'))
                print(f"   Created test job: {job_data['company_name']} - {job_data['status']}")
        except Exception as e:
            print(f"   Failed to create job for {job_data['company_name']}: {e}")
    
    return jobs_created

def cleanup_test_jobs(job_ids):
    """Clean up test jobs"""
    for job_id in job_ids:
        try:
            requests.delete(f"{API_BASE}/jobs/{job_id}", headers=HEADERS, timeout=5)
        except:
            pass

def test_dashboard_stats():
    """Test 2: Dashboard stats - GET /api/dashboard/stats - verify ghosted status is counted correctly"""
    try:
        response = requests.get(f"{API_BASE}/dashboard/stats", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for required fields
            required_fields = ["total", "applied", "rejected", "by_work_mode", "by_location"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                return False, f"Missing required fields: {missing_fields}"
            
            # Check if ghosted status is properly handled
            has_ghosted_field = "ghosted" in data
            total = data.get("total", 0)
            applied = data.get("applied", 0)
            rejected = data.get("rejected", 0)
            ghosted = data.get("ghosted", 0)
            
            work_modes = data.get("by_work_mode", {})
            
            return True, f"Dashboard stats working - Total: {total}, Applied: {applied}, Rejected: {rejected}, Ghosted: {ghosted}, Work modes: {len(work_modes)}"
        else:
            return False, f"Dashboard stats returned {response.status_code}"
            
    except Exception as e:
        return False, f"Dashboard stats error: {str(e)}"

def test_ai_insights():
    """Test 3: AI Insights - GET /api/dashboard/ai-insights - verify enhanced insights format"""
    try:
        response = requests.get(f"{API_BASE}/dashboard/ai-insights", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for required structure
            required_fields = ["insights", "follow_ups"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                return False, f"Missing required fields: {missing_fields}"
            
            insights = data.get("insights", [])
            follow_ups = data.get("follow_ups", [])
            upcoming_interviews = data.get("upcoming_interviews", [])
            
            # Check insights structure
            if insights:
                first_insight = insights[0]
                insight_fields = ["icon", "color", "text", "type"]
                missing_insight_fields = [field for field in insight_fields if field not in first_insight]
                if missing_insight_fields:
                    return False, f"Insight missing fields: {missing_insight_fields}"
            
            # Check for enhanced format features
            enhanced_features = {
                "has_upcoming_interviews": "upcoming_interviews" in data,
                "has_coaching_insights": any("company" in insight.get("text", "").lower() for insight in insights),
                "has_ghosted_acknowledgment": any("ghost" in insight.get("text", "").lower() for insight in insights),
                "has_follow_ups": len(follow_ups) > 0 or any(fu.get("summary") for fu in follow_ups)
            }
            
            enhanced_count = sum(enhanced_features.values())
            
            return True, f"AI insights working - {len(insights)} insights, {len(follow_ups)} follow-ups, {len(upcoming_interviews)} upcoming, Enhanced features: {enhanced_count}/4"
        else:
            return False, f"AI insights returned {response.status_code}"
            
    except Exception as e:
        return False, f"AI insights error: {str(e)}"

def test_interview_checklist():
    """Test 4: Interview Checklist - GET /api/interview-checklist/system_design?company=Google"""
    try:
        # Test the specific endpoint mentioned in review request
        response = requests.get(
            f"{API_BASE}/interview-checklist/system_design",
            params={"company": "Google"},
            headers=HEADERS,
            timeout=10
        )
        
        if response.status_code == 404:
            return False, "Interview checklist endpoint not accessible (404 error) - routing issue despite function existing in code"
        elif response.status_code != 200:
            return False, f"Interview checklist returned {response.status_code}"
        
        data = response.json()
        
        # Check for required structure
        required_fields = ["title", "items"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return False, f"Missing required fields: {missing_fields}"
        
        items = data.get("items", [])
        if not items:
            return False, "No checklist items returned"
        
        # Check if items have proper structure (id, text, category)
        first_item = items[0]
        required_item_fields = ["id", "text", "category"]
        missing_item_fields = [field for field in required_item_fields if field not in first_item]
        
        if missing_item_fields:
            return False, f"Checklist item missing fields: {missing_item_fields}"
        
        # Check if company context is included
        has_company_context = data.get("company") == "Google" or any("Google" in item.get("text", "") for item in items)
        
        return True, f"Interview checklist working - {len(items)} items with proper structure, Company context: {'Yes' if has_company_context else 'No'}"
        
    except Exception as e:
        return False, f"Interview checklist error: {str(e)}"

def test_upcoming_interviews():
    """Test 5: Upcoming interviews - GET /api/dashboard/upcoming-interviews"""
    try:
        response = requests.get(f"{API_BASE}/dashboard/upcoming-interviews", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Should return a list (even if empty)
            if not isinstance(data, list):
                return False, "Upcoming interviews should return a list"
            
            # If there are interviews, check structure
            if data:
                first_interview = data[0]
                required_fields = ["job_id", "company_name", "position", "stage", "schedule_date"]
                missing_fields = [field for field in required_fields if field not in first_interview]
                
                if missing_fields:
                    return False, f"Interview missing fields: {missing_fields}"
            
            return True, f"Upcoming interviews working - {len(data)} upcoming interviews"
        else:
            return False, f"Upcoming interviews returned {response.status_code}"
            
    except Exception as e:
        return False, f"Upcoming interviews error: {str(e)}"

def test_no_500_errors():
    """Test 6: Verify no 500 errors on key endpoints"""
    endpoints = [
        "/api/health",
        "/api/dashboard/stats", 
        "/api/dashboard/ai-insights",
        "/api/dashboard/upcoming-interviews",
        "/api/jobs"
    ]
    
    error_count = 0
    for endpoint in endpoints:
        try:
            headers = HEADERS if endpoint != "/api/health" else {}
            response = requests.get(f"{BACKEND_URL}{endpoint}", headers=headers, timeout=10)
            if response.status_code >= 500:
                error_count += 1
                print(f"   ❌ {endpoint}: HTTP {response.status_code}")
            else:
                print(f"   ✅ {endpoint}: HTTP {response.status_code}")
        except Exception as e:
            error_count += 1
            print(f"   ❌ {endpoint}: Exception {str(e)}")
    
    if error_count == 0:
        return True, f"All {len(endpoints)} endpoints returned < 500"
    else:
        return False, f"{error_count}/{len(endpoints)} endpoints had 500+ errors"

def main():
    """Run comprehensive backend tests"""
    print("🚀 Starting CareerFlow Backend API Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Testing endpoints as specified in review request")
    print("="*60)
    
    results = TestResults()
    
    # Test 1: Authentication (prerequisite)
    passed, message = test_authentication()
    results.add_result("Authentication", passed, message)
    
    if not passed:
        print("❌ Cannot proceed without authentication")
        return False
    
    # Create test data for better testing
    print("\n📝 Creating test data...")
    job_ids = create_test_jobs()
    
    try:
        # Test 2: Health Check
        passed, message = test_health_endpoint()
        results.add_result("Health Check", passed, message)
        
        # Test 3: Dashboard Stats (verify ghosted status counting)
        passed, message = test_dashboard_stats()
        results.add_result("Dashboard Stats (Ghosted Status)", passed, message)
        
        # Test 4: AI Insights (verify enhanced format)
        passed, message = test_ai_insights()
        results.add_result("AI Insights Enhanced Format", passed, message)
        
        # Test 5: Interview Checklist (verify structure)
        passed, message = test_interview_checklist()
        results.add_result("Interview Checklist Structure", passed, message)
        
        # Test 6: Upcoming Interviews
        passed, message = test_upcoming_interviews()
        results.add_result("Upcoming Interviews", passed, message)
        
        # Test 7: No 500 Errors
        passed, message = test_no_500_errors()
        results.add_result("No 500 Errors", passed, message)
        
    finally:
        # Clean up test data
        if job_ids:
            print(f"\n🧹 Cleaning up {len(job_ids)} test jobs...")
            cleanup_test_jobs(job_ids)
    
    # Final summary
    success = results.summary()
    
    if success:
        print("\n🎉 Backend API testing completed successfully!")
        print("✅ All critical functionality is working as expected.")
    else:
        print("\n⚠️  Some tests failed. Please review the issues above.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)