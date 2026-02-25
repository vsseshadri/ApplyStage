#!/usr/bin/env python3
"""
CareerFlow Backend API Testing Suite
Tests the Settings page cleanup changes to ensure core functionality still works
and removed endpoints properly return 404.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "https://career-dash-refine.preview.emergentagent.com/api"
TEST_TOKEN = "test_token_abc123"

class BackendTester:
    def __init__(self):
        self.session = None
        self.headers = {
            "Authorization": f"Bearer {TEST_TOKEN}",
            "Content-Type": "application/json"
        }
        self.results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name, success, details, expected_status=200, actual_status=None):
        """Log test result with details"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "expected_status": expected_status,
            "actual_status": actual_status,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        print(f"{status} - {test_name}: {details}")
        
    async def test_authentication(self):
        """Test GET /api/auth/me - Should work with test authentication"""
        try:
            async with self.session.get(f"{BASE_URL}/auth/me", headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if "user_id" in data and "email" in data:
                        self.log_result(
                            "Authentication", 
                            True, 
                            f"Auth working correctly. User: {data.get('email', 'N/A')}", 
                            200, 
                            response.status
                        )
                        return True
                    else:
                        self.log_result(
                            "Authentication", 
                            False, 
                            f"Missing required fields in response: {data}", 
                            200, 
                            response.status
                        )
                        return False
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Authentication", 
                        False, 
                        f"HTTP {response.status}: {error_text}", 
                        200, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Authentication", False, f"Exception: {str(e)}")
            return False
    
    async def test_health_check(self):
        """Test GET /api/health - Should return healthy status"""
        try:
            async with self.session.get(f"{BASE_URL}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    self.log_result(
                        "Health Check", 
                        True, 
                        f"Health endpoint working: {data}", 
                        200, 
                        response.status
                    )
                    return True
                elif response.status == 404:
                    self.log_result(
                        "Health Check", 
                        False, 
                        "Health endpoint not implemented (404)", 
                        200, 
                        response.status
                    )
                    return False
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Health Check", 
                        False, 
                        f"HTTP {response.status}: {error_text}", 
                        200, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
            return False
    
    async def test_target_goals_update(self):
        """Test PUT /api/user/target-goals with body {"weekly_target": 15, "monthly_target": 50}"""
        try:
            payload = {"weekly_target": 15, "monthly_target": 50}
            async with self.session.put(
                f"{BASE_URL}/user/target-goals", 
                headers=self.headers,
                json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("weekly_target") == 15 and data.get("monthly_target") == 50:
                        self.log_result(
                            "Target Goals Update", 
                            True, 
                            f"Successfully updated targets: {data}", 
                            200, 
                            response.status
                        )
                        return True
                    else:
                        self.log_result(
                            "Target Goals Update", 
                            False, 
                            f"Targets not saved correctly: {data}", 
                            200, 
                            response.status
                        )
                        return False
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Target Goals Update", 
                        False, 
                        f"HTTP {response.status}: {error_text}", 
                        200, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Target Goals Update", False, f"Exception: {str(e)}")
            return False
    
    async def test_target_goals_get(self):
        """Test GET /api/user/target-goals - Should return saved targets"""
        try:
            async with self.session.get(f"{BASE_URL}/user/target-goals", headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if "weekly_target" in data and "monthly_target" in data:
                        self.log_result(
                            "Target Goals Get", 
                            True, 
                            f"Retrieved targets: weekly={data.get('weekly_target')}, monthly={data.get('monthly_target')}", 
                            200, 
                            response.status
                        )
                        return True
                    else:
                        self.log_result(
                            "Target Goals Get", 
                            False, 
                            f"Missing target fields: {data}", 
                            200, 
                            response.status
                        )
                        return False
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Target Goals Get", 
                        False, 
                        f"HTTP {response.status}: {error_text}", 
                        200, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Target Goals Get", False, f"Exception: {str(e)}")
            return False
    
    async def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats - Should return proper statistics without errors"""
        try:
            async with self.session.get(f"{BASE_URL}/dashboard/stats", headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    required_fields = ["total", "applied", "by_location", "by_work_mode", "target_progress"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        self.log_result(
                            "Dashboard Stats", 
                            True, 
                            f"Stats returned with all required fields. Total jobs: {data.get('total', 0)}", 
                            200, 
                            response.status
                        )
                        return True
                    else:
                        self.log_result(
                            "Dashboard Stats", 
                            False, 
                            f"Missing required fields: {missing_fields}", 
                            200, 
                            response.status
                        )
                        return False
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Dashboard Stats", 
                        False, 
                        f"HTTP {response.status}: {error_text}", 
                        200, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Dashboard Stats", False, f"Exception: {str(e)}")
            return False
    
    async def test_removed_endpoint_email_weekly(self):
        """Test GET /api/email-summary/weekly → Should return 404"""
        try:
            async with self.session.get(f"{BASE_URL}/email-summary/weekly", headers=self.headers) as response:
                if response.status == 404:
                    self.log_result(
                        "Removed Endpoint - Email Weekly", 
                        True, 
                        "Correctly returns 404 (endpoint removed)", 
                        404, 
                        response.status
                    )
                    return True
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Removed Endpoint - Email Weekly", 
                        False, 
                        f"Expected 404 but got {response.status}: {error_text}", 
                        404, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Removed Endpoint - Email Weekly", False, f"Exception: {str(e)}")
            return False
    
    async def test_removed_endpoint_email_monthly(self):
        """Test GET /api/email-summary/monthly → Should return 404"""
        try:
            async with self.session.get(f"{BASE_URL}/email-summary/monthly", headers=self.headers) as response:
                if response.status == 404:
                    self.log_result(
                        "Removed Endpoint - Email Monthly", 
                        True, 
                        "Correctly returns 404 (endpoint removed)", 
                        404, 
                        response.status
                    )
                    return True
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Removed Endpoint - Email Monthly", 
                        False, 
                        f"Expected 404 but got {response.status}: {error_text}", 
                        404, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Removed Endpoint - Email Monthly", False, f"Exception: {str(e)}")
            return False
    
    async def test_removed_endpoint_reports_get(self):
        """Test GET /api/reports → Should return 404"""
        try:
            async with self.session.get(f"{BASE_URL}/reports", headers=self.headers) as response:
                if response.status == 404:
                    self.log_result(
                        "Removed Endpoint - Reports Get", 
                        True, 
                        "Correctly returns 404 (endpoint removed)", 
                        404, 
                        response.status
                    )
                    return True
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Removed Endpoint - Reports Get", 
                        False, 
                        f"Expected 404 but got {response.status}: {error_text}", 
                        404, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Removed Endpoint - Reports Get", False, f"Exception: {str(e)}")
            return False
    
    async def test_removed_endpoint_reports_generate(self):
        """Test POST /api/reports/generate/weekly → Should return 404"""
        try:
            async with self.session.post(f"{BASE_URL}/reports/generate/weekly", headers=self.headers) as response:
                if response.status == 404:
                    self.log_result(
                        "Removed Endpoint - Reports Generate", 
                        True, 
                        "Correctly returns 404 (endpoint removed)", 
                        404, 
                        response.status
                    )
                    return True
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Removed Endpoint - Reports Generate", 
                        False, 
                        f"Expected 404 but got {response.status}: {error_text}", 
                        404, 
                        response.status
                    )
                    return False
        except Exception as e:
            self.log_result("Removed Endpoint - Reports Generate", False, f"Exception: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting CareerFlow Backend API Tests")
        print(f"📍 Testing URL: {BASE_URL}")
        print(f"🔑 Using test token: {TEST_TOKEN}")
        print("=" * 60)
        
        # Core functionality tests
        print("\n📋 CORE FUNCTIONALITY TESTS:")
        await self.test_authentication()
        await self.test_health_check()
        await self.test_target_goals_update()
        await self.test_target_goals_get()
        await self.test_dashboard_stats()
        
        # Removed endpoints verification
        print("\n🗑️ REMOVED ENDPOINTS VERIFICATION:")
        await self.test_removed_endpoint_email_weekly()
        await self.test_removed_endpoint_email_monthly()
        await self.test_removed_endpoint_reports_get()
        await self.test_removed_endpoint_reports_generate()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY:")
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed_tests, failed_tests, self.results

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        passed, failed, results = await tester.run_all_tests()
        
        # Exit with appropriate code
        if failed > 0:
            print(f"\n⚠️  {failed} test(s) failed. Check the details above.")
            sys.exit(1)
        else:
            print(f"\n🎉 All {passed} tests passed! Backend API is working correctly.")
            sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())