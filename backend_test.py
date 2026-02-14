#!/usr/bin/env python3
"""
Backend API Testing for CareerFlow Target Goals Functionality
Tests the target goals endpoints and dashboard integration
"""

import asyncio
import httpx
import json
from datetime import datetime

# Configuration
BASE_URL = "https://apptracker-19.preview.emergentagent.com"
TEST_TOKEN = "test_token_abc123"
HEADERS = {
    "Authorization": f"Bearer {TEST_TOKEN}",
    "Content-Type": "application/json"
}

class TestResults:
    def __init__(self):
        self.tests = []
        self.passed = 0
        self.failed = 0
    
    def add_test(self, name, passed, details="", error=""):
        self.tests.append({
            "name": name,
            "passed": passed,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"TARGET GOALS API TEST RESULTS")
        print(f"{'='*60}")
        print(f"Total Tests: {len(self.tests)}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/len(self.tests)*100):.1f}%" if self.tests else "0%")
        print(f"{'='*60}")
        
        for test in self.tests:
            status = "✅ PASS" if test["passed"] else "❌ FAIL"
            print(f"{status} - {test['name']}")
            if test["details"]:
                print(f"    Details: {test['details']}")
            if test["error"]:
                print(f"    Error: {test['error']}")
            print()

async def test_backend_connectivity():
    """Test basic backend connectivity"""
    results = TestResults()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BASE_URL}/api/auth/me", headers=HEADERS)
            
            if response.status_code == 200:
                user_data = response.json()
                results.add_test(
                    "Backend Connectivity", 
                    True, 
                    f"Connected successfully. User: {user_data.get('email', 'Unknown')}"
                )
            else:
                results.add_test(
                    "Backend Connectivity", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
    except Exception as e:
        results.add_test("Backend Connectivity", False, error=str(e))
    
    return results

async def test_preferences_endpoint():
    """Test /api/preferences endpoint with query parameters for target goals"""
    results = TestResults()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test PUT /api/preferences with query parameters
            url = f"{BASE_URL}/api/preferences?weekly_target=15&monthly_target=50"
            body = {"weekly_email": True, "monthly_email": True}
            
            response = await client.put(url, headers=HEADERS, json=body)
            
            if response.status_code == 200:
                results.add_test(
                    "PUT /api/preferences with target goals", 
                    True, 
                    f"Successfully updated preferences with target goals. Response: {response.json()}"
                )
            elif response.status_code == 404:
                results.add_test(
                    "PUT /api/preferences with target goals", 
                    False, 
                    "Endpoint not found - /api/preferences endpoint may not be implemented",
                    f"HTTP 404: {response.text}"
                )
            else:
                results.add_test(
                    "PUT /api/preferences with target goals", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
    except Exception as e:
        results.add_test("PUT /api/preferences with target goals", False, error=str(e))
    
    return results

async def test_target_goals_endpoints():
    """Test dedicated target goals endpoints"""
    results = TestResults()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            
            # Test 1: GET /api/user/target-goals (initial state)
            response = await client.get(f"{BASE_URL}/api/user/target-goals", headers=HEADERS)
            
            if response.status_code == 200:
                initial_goals = response.json()
                results.add_test(
                    "GET /api/user/target-goals (initial)", 
                    True, 
                    f"Retrieved initial target goals: {initial_goals}"
                )
            else:
                results.add_test(
                    "GET /api/user/target-goals (initial)", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                return results
            
            # Test 2: PUT /api/user/target-goals
            new_goals = {"weekly_target": 20, "monthly_target": 60}
            response = await client.put(f"{BASE_URL}/api/user/target-goals", headers=HEADERS, json=new_goals)
            
            if response.status_code == 200:
                updated_goals = response.json()
                results.add_test(
                    "PUT /api/user/target-goals", 
                    True, 
                    f"Successfully updated target goals: {updated_goals}"
                )
                
                # Verify the update worked
                if (updated_goals.get("weekly_target") == 20 and 
                    updated_goals.get("monthly_target") == 60):
                    results.add_test(
                        "Target goals update verification", 
                        True, 
                        "Target goals were updated correctly"
                    )
                else:
                    results.add_test(
                        "Target goals update verification", 
                        False, 
                        f"Expected weekly_target=20, monthly_target=60, got {updated_goals}"
                    )
            else:
                results.add_test(
                    "PUT /api/user/target-goals", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
            
            # Test 3: GET /api/user/target-goals (after update)
            response = await client.get(f"{BASE_URL}/api/user/target-goals", headers=HEADERS)
            
            if response.status_code == 200:
                final_goals = response.json()
                results.add_test(
                    "GET /api/user/target-goals (after update)", 
                    True, 
                    f"Retrieved updated target goals: {final_goals}"
                )
                
                # Verify persistence
                if (final_goals.get("weekly_target") == 20 and 
                    final_goals.get("monthly_target") == 60):
                    results.add_test(
                        "Target goals persistence verification", 
                        True, 
                        "Target goals persisted correctly in database"
                    )
                else:
                    results.add_test(
                        "Target goals persistence verification", 
                        False, 
                        f"Target goals not persisted correctly: {final_goals}"
                    )
            else:
                results.add_test(
                    "GET /api/user/target-goals (after update)", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
    except Exception as e:
        results.add_test("Target Goals Endpoints", False, error=str(e))
    
    return results

async def test_target_progress_endpoint():
    """Test /api/dashboard/target-progress endpoint"""
    results = TestResults()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BASE_URL}/api/dashboard/target-progress", headers=HEADERS)
            
            if response.status_code == 200:
                progress_data = response.json()
                results.add_test(
                    "GET /api/dashboard/target-progress", 
                    True, 
                    f"Retrieved target progress: {progress_data}"
                )
                
                # Verify structure
                required_fields = ["weekly", "monthly", "message"]
                weekly_fields = ["current", "target", "percentage"]
                monthly_fields = ["current", "target", "percentage"]
                
                missing_fields = []
                for field in required_fields:
                    if field not in progress_data:
                        missing_fields.append(field)
                
                if "weekly" in progress_data:
                    for field in weekly_fields:
                        if field not in progress_data["weekly"]:
                            missing_fields.append(f"weekly.{field}")
                
                if "monthly" in progress_data:
                    for field in monthly_fields:
                        if field not in progress_data["monthly"]:
                            missing_fields.append(f"monthly.{field}")
                
                if not missing_fields:
                    results.add_test(
                        "Target progress structure validation", 
                        True, 
                        "All required fields present in target progress response"
                    )
                else:
                    results.add_test(
                        "Target progress structure validation", 
                        False, 
                        f"Missing fields: {missing_fields}"
                    )
                    
            else:
                results.add_test(
                    "GET /api/dashboard/target-progress", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
    except Exception as e:
        results.add_test("Target Progress Endpoint", False, error=str(e))
    
    return results

async def test_dashboard_stats_target_integration():
    """Test if /api/dashboard/stats includes target_progress field"""
    results = TestResults()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BASE_URL}/api/dashboard/stats", headers=HEADERS)
            
            if response.status_code == 200:
                stats_data = response.json()
                results.add_test(
                    "GET /api/dashboard/stats", 
                    True, 
                    f"Retrieved dashboard stats successfully"
                )
                
                # Check if target_progress is included
                if "target_progress" in stats_data:
                    target_progress = stats_data["target_progress"]
                    results.add_test(
                        "Dashboard stats target_progress integration", 
                        True, 
                        f"target_progress field found in dashboard stats: {target_progress}"
                    )
                    
                    # Verify target_progress structure
                    required_fields = ["weekly", "monthly", "message"]
                    missing_fields = [field for field in required_fields if field not in target_progress]
                    
                    if not missing_fields:
                        results.add_test(
                            "Dashboard target_progress structure validation", 
                            True, 
                            "target_progress has all required fields in dashboard stats"
                        )
                    else:
                        results.add_test(
                            "Dashboard target_progress structure validation", 
                            False, 
                            f"Missing fields in target_progress: {missing_fields}"
                        )
                else:
                    results.add_test(
                        "Dashboard stats target_progress integration", 
                        False, 
                        "target_progress field not found in dashboard stats response"
                    )
                    
            else:
                results.add_test(
                    "GET /api/dashboard/stats", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
    except Exception as e:
        results.add_test("Dashboard Stats Target Integration", False, error=str(e))
    
    return results

async def main():
    """Run all target goals tests"""
    print("Starting CareerFlow Target Goals API Testing...")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Token: {TEST_TOKEN}")
    print("-" * 60)
    
    all_results = TestResults()
    
    # Test 1: Backend connectivity
    print("Testing backend connectivity...")
    connectivity_results = await test_backend_connectivity()
    all_results.tests.extend(connectivity_results.tests)
    all_results.passed += connectivity_results.passed
    all_results.failed += connectivity_results.failed
    
    if connectivity_results.failed > 0:
        print("❌ Backend connectivity failed. Stopping tests.")
        all_results.print_summary()
        return
    
    # Test 2: Preferences endpoint with query parameters
    print("Testing /api/preferences endpoint with target goals...")
    preferences_results = await test_preferences_endpoint()
    all_results.tests.extend(preferences_results.tests)
    all_results.passed += preferences_results.passed
    all_results.failed += preferences_results.failed
    
    # Test 3: Dedicated target goals endpoints
    print("Testing dedicated target goals endpoints...")
    target_goals_results = await test_target_goals_endpoints()
    all_results.tests.extend(target_goals_results.tests)
    all_results.passed += target_goals_results.passed
    all_results.failed += target_goals_results.failed
    
    # Test 4: Target progress endpoint
    print("Testing target progress endpoint...")
    target_progress_results = await test_target_progress_endpoint()
    all_results.tests.extend(target_progress_results.tests)
    all_results.passed += target_progress_results.passed
    all_results.failed += target_progress_results.failed
    
    # Test 5: Dashboard stats integration
    print("Testing dashboard stats target integration...")
    dashboard_results = await test_dashboard_stats_target_integration()
    all_results.tests.extend(dashboard_results.tests)
    all_results.passed += dashboard_results.passed
    all_results.failed += dashboard_results.failed
    
    # Print final results
    all_results.print_summary()
    
    # Summary for main agent
    print(f"\n{'='*60}")
    print("SUMMARY FOR MAIN AGENT:")
    print(f"{'='*60}")
    
    if all_results.failed == 0:
        print("✅ ALL TARGET GOALS TESTS PASSED")
        print("All target goals functionality is working correctly.")
    else:
        print(f"❌ {all_results.failed} TEST(S) FAILED")
        print("Issues found with target goals functionality:")
        for test in all_results.tests:
            if not test["passed"]:
                print(f"  - {test['name']}: {test.get('error', test.get('details', 'Unknown error'))}")

if __name__ == "__main__":
    asyncio.run(main())