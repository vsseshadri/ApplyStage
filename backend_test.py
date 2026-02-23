#!/usr/bin/env python3
"""
Backend API Testing for CareerFlow Dashboard
Testing the 3 new endpoints as specified in review request:
1. GET /api/dashboard/pastdue-interviews
2. GET /api/dashboard/motivation-awards  
3. GET /api/reports
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
import sys

# Configuration
BACKEND_URL = "https://career-dash-refine.preview.emergentagent.com"
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
    
    def add_result(self, test_name, passed, message=""):
        self.results.append({
            "test": test_name,
            "status": "✅ PASS" if passed else "❌ FAIL", 
            "message": message
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{self.passed + self.failed} tests passed")
        print(f"{'='*60}")
        for result in self.results:
            print(f"{result['status']} - {result['test']}")
            if result['message']:
                print(f"    {result['message']}")
        print(f"{'='*60}")

async def test_backend_connectivity():
    """Test basic backend connectivity"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/api/auth/me", headers=HEADERS) as response:
                if response.status == 200:
                    data = await response.json()
                    return True, f"Connected successfully. User: {data.get('name', 'Test User')}"
                else:
                    return False, f"Auth failed with status {response.status}"
    except Exception as e:
        return False, f"Connection error: {str(e)}"

async def test_pastdue_interviews():
    """Test GET /api/dashboard/pastdue-interviews endpoint"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/api/dashboard/pastdue-interviews", headers=HEADERS) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate response structure
                    if isinstance(data, list):
                        # Check if we have any past due interviews
                        if len(data) == 0:
                            return True, "Endpoint working correctly. No past-due interviews found (expected for new user)."
                        
                        # If we have data, validate structure
                        required_fields = ["job_id", "company_name", "position", "stage", "status", "schedule_date", "schedule_raw", "days_overdue"]
                        for item in data:
                            missing_fields = [field for field in required_fields if field not in item]
                            if missing_fields:
                                return False, f"Missing required fields in response: {missing_fields}"
                            
                            # Validate days_overdue is positive (past due)
                            if item.get("days_overdue", 0) <= 0:
                                return False, f"Invalid days_overdue value: {item.get('days_overdue')} (should be > 0 for past due)"
                        
                        return True, f"Endpoint working correctly. Found {len(data)} past-due interviews with proper structure."
                    else:
                        return False, f"Expected list response, got {type(data)}"
                else:
                    return False, f"HTTP {response.status}: {await response.text()}"
    except Exception as e:
        return False, f"Request error: {str(e)}"

async def test_motivation_awards():
    """Test GET /api/dashboard/motivation-awards endpoint"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/api/dashboard/motivation-awards", headers=HEADERS) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate response structure
                    required_top_level = ["awards", "weekly_progress", "monthly_progress"]
                    missing_top_level = [field for field in required_top_level if field not in data]
                    if missing_top_level:
                        return False, f"Missing required top-level fields: {missing_top_level}"
                    
                    # Validate awards array
                    awards = data.get("awards", [])
                    if not isinstance(awards, list):
                        return False, f"Awards should be a list, got {type(awards)}"
                    
                    # If awards exist, validate structure
                    if awards:
                        award_required_fields = ["type", "icon", "color", "title", "message", "current", "target", "percentage"]
                        for award in awards:
                            missing_award_fields = [field for field in award_required_fields if field not in award]
                            if missing_award_fields:
                                return False, f"Missing required award fields: {missing_award_fields}"
                    
                    # Validate weekly_progress structure
                    weekly_progress = data.get("weekly_progress", {})
                    progress_required_fields = ["current", "target", "percentage"]
                    missing_weekly_fields = [field for field in progress_required_fields if field not in weekly_progress]
                    if missing_weekly_fields:
                        return False, f"Missing weekly_progress fields: {missing_weekly_fields}"
                    
                    # Validate monthly_progress structure
                    monthly_progress = data.get("monthly_progress", {})
                    missing_monthly_fields = [field for field in progress_required_fields if field not in monthly_progress]
                    if missing_monthly_fields:
                        return False, f"Missing monthly_progress fields: {missing_monthly_fields}"
                    
                    # Validate data types
                    if not isinstance(weekly_progress.get("current"), int):
                        return False, f"weekly_progress.current should be int, got {type(weekly_progress.get('current'))}"
                    if not isinstance(weekly_progress.get("target"), int):
                        return False, f"weekly_progress.target should be int, got {type(weekly_progress.get('target'))}"
                    if not isinstance(weekly_progress.get("percentage"), int):
                        return False, f"weekly_progress.percentage should be int, got {type(weekly_progress.get('percentage'))}"
                    
                    return True, f"Endpoint working correctly. Awards: {len(awards)}, Weekly: {weekly_progress['current']}/{weekly_progress['target']} ({weekly_progress['percentage']}%), Monthly: {monthly_progress['current']}/{monthly_progress['target']} ({monthly_progress['percentage']}%)"
                else:
                    return False, f"HTTP {response.status}: {await response.text()}"
    except Exception as e:
        return False, f"Request error: {str(e)}"

async def test_reports_endpoint():
    """Test GET /api/reports endpoint"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/api/reports", headers=HEADERS) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate response structure
                    if isinstance(data, list):
                        # Check if we have any reports
                        if len(data) == 0:
                            return True, "Endpoint working correctly. No reports found (expected for new user)."
                        
                        # If we have data, validate structure
                        required_fields = ["report_id", "report_type", "title", "date_range", "created_at", "is_read"]
                        for item in data:
                            missing_fields = [field for field in required_fields if field not in item]
                            if missing_fields:
                                return False, f"Missing required fields in response: {missing_fields}"
                            
                            # Validate is_read field specifically (this is what the review request asks for)
                            if "is_read" not in item:
                                return False, "Missing is_read field (required for notification badge count)"
                            
                            if not isinstance(item.get("is_read"), bool):
                                return False, f"is_read should be boolean, got {type(item.get('is_read'))}: {item.get('is_read')}"
                            
                            # Validate report_type
                            if item.get("report_type") not in ["weekly", "monthly"]:
                                return False, f"Invalid report_type: {item.get('report_type')} (should be 'weekly' or 'monthly')"
                        
                        unread_count = len([r for r in data if not r.get("is_read", True)])
                        return True, f"Endpoint working correctly. Found {len(data)} reports, {unread_count} unread (is_read field present for badge count)."
                    else:
                        return False, f"Expected list response, got {type(data)}"
                else:
                    return False, f"HTTP {response.status}: {await response.text()}"
    except Exception as e:
        return False, f"Request error: {str(e)}"

async def create_test_data():
    """Create some test data to make the endpoints more meaningful"""
    try:
        async with aiohttp.ClientSession() as session:
            # Create a job with past due interview
            past_date = (datetime.now() - timedelta(days=3)).strftime("%m/%d/%Y")
            job_data = {
                "company_name": "TestCompany Past Due",
                "position": "Software Engineer",
                "location": {"city": "San Francisco", "state": "California"},
                "salary_range": {"min": 120000, "max": 150000},
                "work_mode": "remote",
                "job_type": "full_time",
                "status": "phone_screen",
                "upcoming_stage": "system_design",
                "upcoming_schedule": past_date,
                "date_applied": (datetime.now() - timedelta(days=10)).isoformat()
            }
            
            async with session.post(f"{BACKEND_URL}/api/jobs", headers=HEADERS, json=job_data) as response:
                if response.status == 200:
                    job_result = await response.json()
                    return True, f"Created test job with past due interview: {job_result.get('job_id')}"
                else:
                    return False, f"Failed to create test job: HTTP {response.status}"
                    
    except Exception as e:
        return False, f"Error creating test data: {str(e)}"

async def generate_test_report():
    """Generate a test report to test the reports endpoint"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/api/reports/generate/weekly", headers=HEADERS) as response:
                if response.status == 200:
                    report_result = await response.json()
                    return True, f"Generated test weekly report: {report_result.get('report_id')}"
                else:
                    return False, f"Failed to generate test report: HTTP {response.status}"
    except Exception as e:
        return False, f"Error generating test report: {str(e)}"

async def main():
    """Main test execution"""
    print("🚀 Starting Backend API Testing for CareerFlow Dashboard")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Token: {TEST_TOKEN}")
    print("="*60)
    
    results = TestResults()
    
    # Test 1: Backend Connectivity
    print("1️⃣  Testing backend connectivity...")
    passed, message = await test_backend_connectivity()
    results.add_result("Backend Connectivity", passed, message)
    
    if not passed:
        print("❌ Cannot connect to backend. Stopping tests.")
        results.print_summary()
        return
    
    # Test 2: Create test data for more meaningful tests
    print("2️⃣  Creating test data...")
    passed, message = await create_test_data()
    results.add_result("Test Data Creation", passed, message)
    
    # Test 3: Generate test report
    print("3️⃣  Generating test report...")
    passed, message = await generate_test_report()
    results.add_result("Test Report Generation", passed, message)
    
    # Test 4: Past Due Interviews Endpoint
    print("4️⃣  Testing GET /api/dashboard/pastdue-interviews...")
    passed, message = await test_pastdue_interviews()
    results.add_result("Past Due Interviews Endpoint", passed, message)
    
    # Test 5: Motivation Awards Endpoint
    print("5️⃣  Testing GET /api/dashboard/motivation-awards...")
    passed, message = await test_motivation_awards()
    results.add_result("Motivation Awards Endpoint", passed, message)
    
    # Test 6: Reports Endpoint
    print("6️⃣  Testing GET /api/reports...")
    passed, message = await test_reports_endpoint()
    results.add_result("Reports Endpoint", passed, message)
    
    # Print final results
    results.print_summary()
    
    # Return exit code based on results
    if results.failed > 0:
        print(f"\n❌ {results.failed} test(s) failed. Check the issues above.")
        sys.exit(1)
    else:
        print(f"\n✅ All {results.passed} tests passed! The new backend endpoints are working correctly.")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())