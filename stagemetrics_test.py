#!/usr/bin/env python3
"""
StageMetrics Backend API Testing Script
Tests the specific endpoints requested in the review.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from the review request
BACKEND_URL = "https://apptracker-19.preview.emergentagent.com"

# Test token for authenticated endpoints (from backend code)
TEST_TOKEN = "test_token_abc123"

def test_health_endpoint():
    """Test the health check endpoint"""
    print("🔍 Testing Health Check Endpoint...")
    try:
        url = f"{BACKEND_URL}/api/health"
        response = requests.get(url, timeout=10)
        
        print(f"   URL: {url}")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 404:
            print("   ❌ FAIL: Health endpoint not found (404)")
            return False
        elif response.status_code == 200:
            print("   ✅ PASS: Health endpoint responding")
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
            except:
                print(f"   Response: {response.text}")
            return True
        else:
            print(f"   ❌ FAIL: Unexpected status code {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL: Request failed - {str(e)}")
        return False

def test_positions_endpoint():
    """Test the positions list endpoint with authentication"""
    print("\n🔍 Testing Positions List Endpoint...")
    try:
        url = f"{BACKEND_URL}/api/positions"
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"   URL: {url}")
        print(f"   Headers: Authorization: Bearer {TEST_TOKEN}")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASS: Positions endpoint responding correctly")
            try:
                data = response.json()
                print(f"   Response Type: {type(data)}")
                print(f"   Response Length: {len(data) if isinstance(data, list) else 'N/A'}")
                if isinstance(data, list) and len(data) > 0:
                    print(f"   Sample Item: {json.dumps(data[0], indent=2)}")
                else:
                    print(f"   Response: {json.dumps(data, indent=2)}")
            except Exception as e:
                print(f"   Response (raw): {response.text}")
            return True
        elif response.status_code == 401:
            print("   ❌ FAIL: Authentication failed (401)")
            print(f"   Response: {response.text}")
            return False
        else:
            print(f"   ❌ FAIL: Unexpected status code {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL: Request failed - {str(e)}")
        return False

def test_dashboard_stats_endpoint():
    """Test the dashboard stats endpoint with mock authentication"""
    print("\n🔍 Testing Dashboard Stats Endpoint...")
    try:
        url = f"{BACKEND_URL}/api/dashboard/stats"
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"   URL: {url}")
        print(f"   Headers: Authorization: Bearer {TEST_TOKEN}")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASS: Dashboard stats endpoint responding correctly")
            try:
                data = response.json()
                print(f"   Response Type: {type(data)}")
                
                # Check for expected dashboard stats fields
                expected_fields = ['total', 'applied', 'by_location', 'by_work_mode', 'by_position']
                found_fields = [field for field in expected_fields if field in data]
                print(f"   Expected Fields Found: {found_fields}")
                
                if len(found_fields) >= 3:
                    print("   ✅ Response contains expected dashboard statistics")
                else:
                    print("   ⚠️  Response may be missing some expected fields")
                
                # Show sample of response
                print(f"   Sample Response: {json.dumps(dict(list(data.items())[:5]), indent=2)}")
                
            except Exception as e:
                print(f"   Response (raw): {response.text}")
            return True
        elif response.status_code == 401:
            print("   ❌ FAIL: Authentication failed (401)")
            print(f"   Response: {response.text}")
            return False
        else:
            print(f"   ❌ FAIL: Unexpected status code {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL: Request failed - {str(e)}")
        return False

def test_jobs_endpoint():
    """Test the jobs list endpoint with mock authentication"""
    print("\n🔍 Testing Jobs List Endpoint...")
    try:
        url = f"{BACKEND_URL}/api/jobs"
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"   URL: {url}")
        print(f"   Headers: Authorization: Bearer {TEST_TOKEN}")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASS: Jobs endpoint responding correctly")
            try:
                data = response.json()
                print(f"   Response Type: {type(data)}")
                
                # Check for expected jobs response structure
                if isinstance(data, dict) and 'jobs' in data:
                    jobs = data['jobs']
                    pagination = data.get('pagination', {})
                    print(f"   Jobs Count: {len(jobs)}")
                    print(f"   Pagination: {pagination}")
                    
                    if len(jobs) > 0:
                        print(f"   Sample Job: {json.dumps(jobs[0], indent=2, default=str)}")
                    else:
                        print("   No jobs found (empty list)")
                        
                elif isinstance(data, list):
                    print(f"   Jobs Count: {len(data)}")
                    if len(data) > 0:
                        print(f"   Sample Job: {json.dumps(data[0], indent=2, default=str)}")
                else:
                    print(f"   Unexpected Response Format: {json.dumps(data, indent=2, default=str)}")
                
            except Exception as e:
                print(f"   JSON Parse Error: {str(e)}")
                print(f"   Response (raw): {response.text}")
            return True
        elif response.status_code == 401:
            print("   ❌ FAIL: Authentication failed (401)")
            print(f"   Response: {response.text}")
            return False
        else:
            print(f"   ❌ FAIL: Unexpected status code {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL: Request failed - {str(e)}")
        return False

def test_backend_connectivity():
    """Test basic backend connectivity"""
    print("🔍 Testing Backend Connectivity...")
    try:
        # Try to reach the backend root
        response = requests.get(BACKEND_URL, timeout=10)
        print(f"   Backend URL: {BACKEND_URL}")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code in [200, 404, 405]:  # Any of these means backend is responding
            print("   ✅ PASS: Backend is responding")
            return True
        else:
            print(f"   ❌ FAIL: Backend returned {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL: Cannot reach backend - {str(e)}")
        return False

def main():
    """Run all backend API tests"""
    print("=" * 60)
    print("🚀 STAGEMETRICS BACKEND API TESTING")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Token: {TEST_TOKEN}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Track test results
    results = {}
    
    # Test 1: Backend Connectivity
    results['connectivity'] = test_backend_connectivity()
    
    # Test 2: Health Check
    results['health'] = test_health_endpoint()
    
    # Test 3: Positions List
    results['positions'] = test_positions_endpoint()
    
    # Test 4: Dashboard Stats
    results['dashboard_stats'] = test_dashboard_stats_endpoint()
    
    # Test 5: Jobs List
    results['jobs'] = test_jobs_endpoint()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the details above.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)