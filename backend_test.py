#!/usr/bin/env python3
"""
Backend API Testing for CareerFlow Email Summary Endpoints
Tests the weekly and monthly email summary endpoints as requested.
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://apptracker-19.preview.emergentagent.com"
TEST_TOKEN = "test_token_abc123"

def test_email_summary_endpoints():
    """Test the weekly and monthly email summary endpoints"""
    
    print("🧪 TESTING EMAIL SUMMARY ENDPOINTS")
    print("=" * 50)
    
    headers = {
        "Authorization": f"Bearer {TEST_TOKEN}",
        "Content-Type": "application/json"
    }
    
    test_results = []
    
    # Test 1: Set communication email first
    print("\n1️⃣ Testing PUT /api/user/communication-email")
    try:
        email_data = {"communication_email": "user@example.com"}
        response = requests.put(
            f"{BACKEND_URL}/api/user/communication-email",
            headers=headers,
            json=email_data,
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ PASS - Communication email set successfully")
            test_results.append(("PUT /api/user/communication-email", "PASS", "Email set successfully"))
        else:
            print(f"❌ FAIL - Status: {response.status_code}, Response: {response.text}")
            test_results.append(("PUT /api/user/communication-email", "FAIL", f"Status {response.status_code}"))
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")
        test_results.append(("PUT /api/user/communication-email", "ERROR", str(e)))
    
    # Test 2: GET Weekly Email Summary
    print("\n2️⃣ Testing GET /api/email-summary/weekly")
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/email-summary/weekly",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ["subject", "body", "to_email", "from_date", "to_date", "stats"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"❌ FAIL - Missing fields: {missing_fields}")
                test_results.append(("GET /api/email-summary/weekly", "FAIL", f"Missing fields: {missing_fields}"))
            else:
                print("✅ PASS - Weekly summary structure correct")
                print(f"   📧 Subject: {data['subject'][:50]}...")
                print(f"   📅 Date Range: {data['from_date']} to {data['to_date']}")
                print(f"   📊 Stats: {data['stats']}")
                
                # Verify date range is last 7 days (dates are in format "Feb-09-2026")
                try:
                    from_date = datetime.strptime(data['from_date'], "%b-%d-%Y")
                    to_date = datetime.strptime(data['to_date'], "%b-%d-%Y")
                    expected_days = 7
                    actual_days = (to_date - from_date).days
                    
                    if abs(actual_days - expected_days) <= 1:  # Allow 1 day tolerance
                        print(f"   ✅ Date range correct: {actual_days} days")
                        test_results.append(("GET /api/email-summary/weekly", "PASS", "Structure and date range correct"))
                    else:
                        print(f"   ❌ Date range incorrect: {actual_days} days (expected ~{expected_days})")
                        test_results.append(("GET /api/email-summary/weekly", "FAIL", f"Date range: {actual_days} days"))
                except ValueError as e:
                    print(f"   ❌ Date format error: {e}")
                    test_results.append(("GET /api/email-summary/weekly", "FAIL", f"Date format error: {e}"))
        else:
            print(f"❌ FAIL - Status: {response.status_code}, Response: {response.text}")
            test_results.append(("GET /api/email-summary/weekly", "FAIL", f"Status {response.status_code}"))
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")
        test_results.append(("GET /api/email-summary/weekly", "ERROR", str(e)))
    
    # Test 3: GET Monthly Email Summary
    print("\n3️⃣ Testing GET /api/email-summary/monthly")
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/email-summary/monthly",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ["subject", "body", "to_email", "from_date", "to_date", "stats"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"❌ FAIL - Missing fields: {missing_fields}")
                test_results.append(("GET /api/email-summary/monthly", "FAIL", f"Missing fields: {missing_fields}"))
            else:
                print("✅ PASS - Monthly summary structure correct")
                print(f"   📧 Subject: {data['subject'][:50]}...")
                print(f"   📅 Date Range: {data['from_date']} to {data['to_date']}")
                print(f"   📊 Stats: {data['stats']}")
                
                # Verify date range is last 30 days
                from_date = datetime.fromisoformat(data['from_date'].replace('Z', '+00:00'))
                to_date = datetime.fromisoformat(data['to_date'].replace('Z', '+00:00'))
                expected_days = 30
                actual_days = (to_date - from_date).days
                
                if abs(actual_days - expected_days) <= 2:  # Allow 2 day tolerance for month variations
                    print(f"   ✅ Date range correct: {actual_days} days")
                    test_results.append(("GET /api/email-summary/monthly", "PASS", "Structure and date range correct"))
                else:
                    print(f"   ❌ Date range incorrect: {actual_days} days (expected ~{expected_days})")
                    test_results.append(("GET /api/email-summary/monthly", "FAIL", f"Date range: {actual_days} days"))
        else:
            print(f"❌ FAIL - Status: {response.status_code}, Response: {response.text}")
            test_results.append(("GET /api/email-summary/monthly", "FAIL", f"Status {response.status_code}"))
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")
        test_results.append(("GET /api/email-summary/monthly", "ERROR", str(e)))
    
    # Test 4: Verify email format validation
    print("\n4️⃣ Testing email validation (invalid email)")
    try:
        invalid_email_data = {"communication_email": "invalid-email"}
        response = requests.put(
            f"{BACKEND_URL}/api/user/communication-email",
            headers=headers,
            json=invalid_email_data,
            timeout=10
        )
        
        if response.status_code == 400:
            print("✅ PASS - Invalid email rejected with 400 error")
            test_results.append(("Email validation", "PASS", "Invalid email properly rejected"))
        else:
            print(f"❌ FAIL - Expected 400, got {response.status_code}")
            test_results.append(("Email validation", "FAIL", f"Expected 400, got {response.status_code}"))
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")
        test_results.append(("Email validation", "ERROR", str(e)))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, status, _ in test_results if status == "PASS")
    total = len(test_results)
    
    for test_name, status, details in test_results:
        status_icon = "✅" if status == "PASS" else "❌"
        print(f"{status_icon} {test_name}: {status} - {details}")
    
    print(f"\n🎯 OVERALL: {passed}/{total} tests PASSED ({(passed/total)*100:.1f}% success rate)")
    
    if passed == total:
        print("🎉 ALL EMAIL SUMMARY TESTS PASSED!")
        return True
    else:
        print("⚠️  Some tests failed - see details above")
        return False

if __name__ == "__main__":
    print("🚀 CareerFlow Email Summary API Testing")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    print(f"🔑 Using test token authentication")
    
    success = test_email_summary_endpoints()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)