#!/usr/bin/env python3
"""
Focused test for Email Summary API endpoints
Tests the specific endpoints requested in the review
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')

# Configuration
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://launchready-4.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Test data
TEST_USER_EMAIL = "emailtest@jobtracker.com"
TEST_USER_NAME = "Email Test User"
TEST_SESSION_TOKEN = f"email_test_session_{uuid.uuid4().hex[:16]}"

class EmailSummaryTester:
    def __init__(self):
        self.session = None
        self.mongo_client = None
        self.db = None
        self.auth_headers = {}
        self.test_user_id = None
        self.test_results = []

    async def setup(self):
        """Setup test environment"""
        print("🔧 Setting up email summary test environment...")
        
        # Setup HTTP session
        self.session = aiohttp.ClientSession()
        
        # Setup MongoDB connection
        self.mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        # Create test user and session
        await self.create_test_user_and_session()
        
        # Create some test job data for meaningful summaries
        await self.create_test_jobs()
        
        print(f"✅ Email summary test environment ready. Backend URL: {API_BASE}")

    async def create_test_user_and_session(self):
        """Create test user and session in MongoDB"""
        print("👤 Creating test user and session...")
        
        # Generate test user ID
        self.test_user_id = f"user_{uuid.uuid4().hex[:12]}"
        
        # Create test user
        test_user = {
            "user_id": self.test_user_id,
            "email": TEST_USER_EMAIL,
            "name": TEST_USER_NAME,
            "picture": "https://example.com/avatar.jpg",
            "payment_status": "trial",
            "trial_end_date": datetime.now(timezone.utc) + timedelta(days=7),
            "applications_count": 0,
            "preferences": {"weekly_email": True, "monthly_email": True},
            "created_at": datetime.now(timezone.utc),
            "communication_email": None  # Will be set by the test
        }
        
        # Insert or update user
        await self.db.users.delete_one({"email": TEST_USER_EMAIL})
        await self.db.users.insert_one(test_user)
        
        # Create test session
        test_session = {
            "user_id": self.test_user_id,
            "session_token": TEST_SESSION_TOKEN,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        }
        
        # Insert session
        await self.db.user_sessions.delete_one({"session_token": TEST_SESSION_TOKEN})
        await self.db.user_sessions.insert_one(test_session)
        
        # Set auth headers
        self.auth_headers = {"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        
        print(f"✅ Test user created: {TEST_USER_EMAIL}")

    async def create_test_jobs(self):
        """Create some test job applications for meaningful summaries"""
        print("💼 Creating test job applications...")
        
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        test_jobs = [
            {
                "job_id": f"job_{uuid.uuid4().hex[:12]}",
                "user_id": self.test_user_id,
                "company_name": "TechCorp Inc",
                "position": "Senior Software Engineer",
                "location": {"city": "San Francisco", "state": "California"},
                "salary_range": {"min": 120000, "max": 180000},
                "work_mode": "remote",
                "job_url": "https://techcorp.com/careers",
                "date_applied": week_ago,
                "status": "applied",
                "stages": [{"status": "applied", "timestamp": week_ago.isoformat()}],
                "custom_stages": [],
                "reminders": [],
                "is_priority": False,
                "created_at": week_ago,
                "updated_at": week_ago
            },
            {
                "job_id": f"job_{uuid.uuid4().hex[:12]}",
                "user_id": self.test_user_id,
                "company_name": "DataFlow Systems",
                "position": "Data Scientist",
                "location": {"city": "New York", "state": "New York"},
                "salary_range": {"min": 110000, "max": 160000},
                "work_mode": "hybrid",
                "job_url": "https://dataflow.com/careers",
                "date_applied": month_ago,
                "status": "phone_screen",
                "stages": [
                    {"status": "applied", "timestamp": month_ago.isoformat()},
                    {"status": "phone_screen", "timestamp": (month_ago + timedelta(days=5)).isoformat()}
                ],
                "custom_stages": [],
                "reminders": [],
                "is_priority": True,
                "created_at": month_ago,
                "updated_at": month_ago + timedelta(days=5)
            },
            {
                "job_id": f"job_{uuid.uuid4().hex[:12]}",
                "user_id": self.test_user_id,
                "company_name": "CloudTech Solutions",
                "position": "DevOps Engineer",
                "location": {"city": "Austin", "state": "Texas"},
                "salary_range": {"min": 100000, "max": 140000},
                "work_mode": "onsite",
                "job_url": "https://cloudtech.com/careers",
                "date_applied": now - timedelta(days=3),
                "status": "applied",
                "stages": [{"status": "applied", "timestamp": (now - timedelta(days=3)).isoformat()}],
                "custom_stages": [],
                "reminders": [],
                "is_priority": False,
                "created_at": now - timedelta(days=3),
                "updated_at": now - timedelta(days=3)
            }
        ]
        
        # Clean up any existing test jobs
        await self.db.job_applications.delete_many({"user_id": self.test_user_id})
        
        # Insert test jobs
        await self.db.job_applications.insert_many(test_jobs)
        
        print(f"✅ Created {len(test_jobs)} test job applications")

    async def test_communication_email_valid(self):
        """Test PUT /api/user/communication-email with valid email"""
        print("\n📧 Test 1: PUT /api/user/communication-email (valid email)")
        print("-" * 50)
        
        valid_email = "test@example.com"
        
        try:
            async with self.session.put(f"{API_BASE}/user/communication-email", 
                                      json={"communication_email": valid_email}, 
                                      headers=self.auth_headers) as response:
                
                status = response.status
                response_text = await response.text()
                
                print(f"Status Code: {status}")
                print(f"Response: {response_text}")
                
                if status == 200:
                    data = await response.json()
                    if data.get('communication_email') == valid_email:
                        print("✅ PASS - Valid email accepted and saved")
                        self.test_results.append(("Valid Email Update", "PASS", "Email correctly saved"))
                        return True
                    else:
                        print("❌ FAIL - Email not returned correctly in response")
                        self.test_results.append(("Valid Email Update", "FAIL", "Email not returned correctly"))
                        return False
                else:
                    print(f"❌ FAIL - Unexpected status code: {status}")
                    self.test_results.append(("Valid Email Update", "FAIL", f"Status: {status}"))
                    return False
                    
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            self.test_results.append(("Valid Email Update", "ERROR", str(e)))
            return False

    async def test_communication_email_invalid(self):
        """Test PUT /api/user/communication-email with invalid email"""
        print("\n📧 Test 2: PUT /api/user/communication-email (invalid email)")
        print("-" * 50)
        
        invalid_email = "invalid-email"
        
        try:
            async with self.session.put(f"{API_BASE}/user/communication-email", 
                                      json={"communication_email": invalid_email}, 
                                      headers=self.auth_headers) as response:
                
                status = response.status
                response_text = await response.text()
                
                print(f"Status Code: {status}")
                print(f"Response: {response_text}")
                
                if status == 400:
                    data = await response.json()
                    if "Invalid email format" in data.get('detail', ''):
                        print("✅ PASS - Invalid email properly rejected with correct error message")
                        self.test_results.append(("Invalid Email Rejection", "PASS", "Proper validation and error message"))
                        return True
                    else:
                        print("❌ FAIL - Wrong error message")
                        self.test_results.append(("Invalid Email Rejection", "FAIL", "Wrong error message"))
                        return False
                else:
                    print(f"❌ FAIL - Expected 400 for invalid email, got: {status}")
                    self.test_results.append(("Invalid Email Rejection", "FAIL", f"Expected 400, got {status}"))
                    return False
                    
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            self.test_results.append(("Invalid Email Rejection", "ERROR", str(e)))
            return False

    async def test_weekly_summary(self):
        """Test GET /api/email-summary/weekly"""
        print("\n📊 Test 3: GET /api/email-summary/weekly")
        print("-" * 50)
        
        try:
            async with self.session.get(f"{API_BASE}/email-summary/weekly", 
                                      headers=self.auth_headers) as response:
                
                status = response.status
                response_text = await response.text()
                
                print(f"Status Code: {status}")
                print(f"Response Length: {len(response_text)} characters")
                
                if status == 200:
                    data = await response.json()
                    
                    # Check required fields
                    required_fields = ["subject", "body", "to_email", "stats"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        print("✅ All required fields present")
                        
                        # Check subject format
                        subject = data.get("subject", "")
                        print(f"Subject: {subject}")
                        
                        if "Weekly Summary for the week" in subject:
                            print("✅ Subject format correct")
                            
                            # Check stats structure
                            stats = data.get("stats", {})
                            expected_stats = ["weekly_applications", "status_counts", "follow_ups_count"]
                            missing_stats = [stat for stat in expected_stats if stat not in stats]
                            
                            if not missing_stats:
                                print("✅ Stats structure correct")
                                print(f"Weekly Applications: {stats.get('weekly_applications', 0)}")
                                print(f"Status Counts: {stats.get('status_counts', {})}")
                                print(f"Follow-ups Count: {stats.get('follow_ups_count', 0)}")
                                
                                # Check email content
                                body = data.get("body", "")
                                if len(body) > 100 and "WEEKLY METRICS" in body:
                                    print("✅ Email body contains expected content")
                                    self.test_results.append(("Weekly Summary", "PASS", "All fields and content correct"))
                                    return True
                                else:
                                    print("❌ Email body missing expected content")
                                    self.test_results.append(("Weekly Summary", "FAIL", "Email body incomplete"))
                                    return False
                            else:
                                print(f"❌ Missing stats fields: {missing_stats}")
                                self.test_results.append(("Weekly Summary", "FAIL", f"Missing stats: {missing_stats}"))
                                return False
                        else:
                            print(f"❌ Subject format incorrect: {subject}")
                            self.test_results.append(("Weekly Summary", "FAIL", "Wrong subject format"))
                            return False
                    else:
                        print(f"❌ Missing required fields: {missing_fields}")
                        self.test_results.append(("Weekly Summary", "FAIL", f"Missing fields: {missing_fields}"))
                        return False
                else:
                    print(f"❌ FAIL - Unexpected status code: {status}")
                    self.test_results.append(("Weekly Summary", "FAIL", f"Status: {status}"))
                    return False
                    
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            self.test_results.append(("Weekly Summary", "ERROR", str(e)))
            return False

    async def test_monthly_summary(self):
        """Test GET /api/email-summary/monthly"""
        print("\n📊 Test 4: GET /api/email-summary/monthly")
        print("-" * 50)
        
        try:
            async with self.session.get(f"{API_BASE}/email-summary/monthly", 
                                      headers=self.auth_headers) as response:
                
                status = response.status
                response_text = await response.text()
                
                print(f"Status Code: {status}")
                print(f"Response Length: {len(response_text)} characters")
                
                if status == 200:
                    data = await response.json()
                    
                    # Check required fields
                    required_fields = ["subject", "body", "to_email", "stats"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        print("✅ All required fields present")
                        
                        # Check subject format
                        subject = data.get("subject", "")
                        print(f"Subject: {subject}")
                        
                        if "Monthly Summary for" in subject:
                            print("✅ Subject format correct")
                            
                            # Check stats structure
                            stats = data.get("stats", {})
                            expected_stats = ["total_applications", "monthly_applications", "status_counts", "work_mode_counts", "response_rate"]
                            missing_stats = [stat for stat in expected_stats if stat not in stats]
                            
                            if not missing_stats:
                                print("✅ Stats structure correct")
                                print(f"Total Applications: {stats.get('total_applications', 0)}")
                                print(f"Monthly Applications: {stats.get('monthly_applications', 0)}")
                                print(f"Response Rate: {stats.get('response_rate', 0)}%")
                                
                                # Check email content
                                body = data.get("body", "")
                                if len(body) > 200 and "MONTHLY OVERVIEW" in body:
                                    print("✅ Email body contains expected content")
                                    self.test_results.append(("Monthly Summary", "PASS", "All fields and content correct"))
                                    return True
                                else:
                                    print("❌ Email body missing expected content")
                                    self.test_results.append(("Monthly Summary", "FAIL", "Email body incomplete"))
                                    return False
                            else:
                                print(f"❌ Missing stats fields: {missing_stats}")
                                self.test_results.append(("Monthly Summary", "FAIL", f"Missing stats: {missing_stats}"))
                                return False
                        else:
                            print(f"❌ Subject format incorrect: {subject}")
                            self.test_results.append(("Monthly Summary", "FAIL", "Wrong subject format"))
                            return False
                    else:
                        print(f"❌ Missing required fields: {missing_fields}")
                        self.test_results.append(("Monthly Summary", "FAIL", f"Missing fields: {missing_fields}"))
                        return False
                else:
                    print(f"❌ FAIL - Unexpected status code: {status}")
                    self.test_results.append(("Monthly Summary", "FAIL", f"Status: {status}"))
                    return False
                    
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            self.test_results.append(("Monthly Summary", "ERROR", str(e)))
            return False

    async def cleanup(self):
        """Cleanup test environment"""
        print("\n🧹 Cleaning up email summary test environment...")
        
        # Clean up test data
        if self.db is not None:
            await self.db.users.delete_one({"email": TEST_USER_EMAIL})
            await self.db.user_sessions.delete_one({"session_token": TEST_SESSION_TOKEN})
            await self.db.job_applications.delete_many({"user_id": self.test_user_id})
        
        # Close connections
        if self.session:
            await self.session.close()
        if self.mongo_client:
            self.mongo_client.close()
        
        print("✅ Cleanup completed")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📋 EMAIL SUMMARY API TEST RESULTS")
        print("="*60)
        
        passed = 0
        failed = 0
        errors = 0
        
        for test_name, status, message in self.test_results:
            if status == "PASS":
                print(f"✅ {test_name}: {message}")
                passed += 1
            elif status == "FAIL":
                print(f"❌ {test_name}: {message}")
                failed += 1
            else:  # ERROR
                print(f"🔥 {test_name}: {message}")
                errors += 1
        
        total = len(self.test_results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"\n{'='*60}")
        print(f"TOTAL TESTS: {total}")
        print(f"✅ PASSED: {passed}")
        print(f"❌ FAILED: {failed}")
        print(f"🔥 ERRORS: {errors}")
        print(f"SUCCESS RATE: {success_rate:.1f}%")
        print("="*60)
        
        return success_rate == 100.0

    async def run_all_tests(self):
        """Run all email summary tests"""
        try:
            await self.setup()
            
            # Run tests in sequence
            test1 = await self.test_communication_email_valid()
            test2 = await self.test_communication_email_invalid()
            test3 = await self.test_weekly_summary()
            test4 = await self.test_monthly_summary()
            
            all_passed = test1 and test2 and test3 and test4
            
        except Exception as e:
            print(f"🔥 Critical error during testing: {e}")
            all_passed = False
        finally:
            await self.cleanup()
            return self.print_summary()

async def main():
    """Main test runner"""
    print("🚀 Starting Email Summary API Tests")
    print(f"Backend URL: {API_BASE}")
    print(f"Test Time: {datetime.now()}")
    
    tester = EmailSummaryTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n🎉 All email summary API tests PASSED!")
    else:
        print("\n⚠️ Some email summary API tests FAILED!")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)