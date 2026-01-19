#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Job Tracking App
Tests all endpoints with proper authentication and data validation
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
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://jobjourney-4.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Test data
TEST_USER_EMAIL = "testuser@jobtracker.com"
TEST_USER_NAME = "John Doe"
TEST_SESSION_TOKEN = f"test_session_{uuid.uuid4().hex[:16]}"

class JobTrackerAPITester:
    def __init__(self):
        self.session = None
        self.mongo_client = None
        self.db = None
        self.auth_headers = {}
        self.test_user_id = None
        self.test_job_id = None
        self.results = {
            'auth': {},
            'jobs': {},
            'dashboard': {},
            'analytics': {},
            'templates': {},
            'other': {}
        }

    async def setup(self):
        """Setup test environment"""
        print("🔧 Setting up test environment...")
        
        # Setup HTTP session
        self.session = aiohttp.ClientSession()
        
        # Setup MongoDB connection
        self.mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        # Create test user and session
        await self.create_test_user_and_session()
        
        print(f"✅ Test environment ready. Backend URL: {API_BASE}")

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
            "subscription": {"type": "free", "expiresAt": None},
            "preferences": {
                "theme": "auto",
                "notifications": True,
                "emailSummary": {"weekly": True, "monthly": True}
            },
            "created_at": datetime.now(timezone.utc)
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
        print(f"✅ Test session created: {TEST_SESSION_TOKEN[:20]}...")

    async def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test GET /api/auth/me
        try:
            async with self.session.get(f"{API_BASE}/auth/me", headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('email') == TEST_USER_EMAIL:
                        self.results['auth']['get_me'] = {'status': 'PASS', 'message': 'Successfully retrieved user info'}
                        print("✅ GET /api/auth/me - PASS")
                    else:
                        self.results['auth']['get_me'] = {'status': 'FAIL', 'message': f'Wrong user data: {data}'}
                        print("❌ GET /api/auth/me - FAIL: Wrong user data")
                else:
                    self.results['auth']['get_me'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ GET /api/auth/me - FAIL: Status {response.status}")
        except Exception as e:
            self.results['auth']['get_me'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ GET /api/auth/me - ERROR: {e}")

        # Test POST /api/auth/logout
        try:
            async with self.session.post(f"{API_BASE}/auth/logout", headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if 'message' in data:
                        self.results['auth']['logout'] = {'status': 'PASS', 'message': 'Successfully logged out'}
                        print("✅ POST /api/auth/logout - PASS")
                        
                        # Recreate session for further tests
                        await self.create_test_user_and_session()
                    else:
                        self.results['auth']['logout'] = {'status': 'FAIL', 'message': f'Unexpected response: {data}'}
                        print("❌ POST /api/auth/logout - FAIL: Unexpected response")
                else:
                    self.results['auth']['logout'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ POST /api/auth/logout - FAIL: Status {response.status}")
        except Exception as e:
            self.results['auth']['logout'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ POST /api/auth/logout - ERROR: {e}")

    async def test_job_crud_endpoints(self):
        """Test job CRUD endpoints with AI categorization"""
        print("\n💼 Testing Job CRUD Endpoints...")
        
        # Test POST /api/jobs (Create job)
        job_data = {
            "company": "TechCorp Inc",
            "position": "Senior Software Engineer",
            "location": "San Francisco, CA",
            "salary_range": {"min": 120000, "max": 180000, "currency": "USD"},
            "work_type": "hybrid",
            "applied_date": datetime.now(timezone.utc).isoformat(),
            "current_stage": "Applied",
            "custom_stages": [],
            "url": "https://techcorp.com/careers/senior-swe",
            "notes": "Exciting opportunity in AI/ML team"
        }
        
        try:
            async with self.session.post(f"{API_BASE}/jobs", 
                                       json=job_data, 
                                       headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('job_id') and data.get('ai_insights'):
                        self.test_job_id = data['job_id']
                        ai_insights = data['ai_insights']
                        if ai_insights.get('job_family') and ai_insights.get('confidence'):
                            self.results['jobs']['create'] = {
                                'status': 'PASS', 
                                'message': f'Job created with AI categorization: {ai_insights["job_family"]} (confidence: {ai_insights["confidence"]})'
                            }
                            print(f"✅ POST /api/jobs - PASS (AI categorized as: {ai_insights['job_family']})")
                        else:
                            self.results['jobs']['create'] = {'status': 'FAIL', 'message': 'AI insights missing or incomplete'}
                            print("❌ POST /api/jobs - FAIL: AI insights missing")
                    else:
                        self.results['jobs']['create'] = {'status': 'FAIL', 'message': 'Job ID or AI insights missing'}
                        print("❌ POST /api/jobs - FAIL: Missing job_id or ai_insights")
                else:
                    error_text = await response.text()
                    self.results['jobs']['create'] = {'status': 'FAIL', 'message': f'Status: {response.status}, Error: {error_text}'}
                    print(f"❌ POST /api/jobs - FAIL: Status {response.status}")
        except Exception as e:
            self.results['jobs']['create'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ POST /api/jobs - ERROR: {e}")

        # Test GET /api/jobs (List jobs)
        try:
            async with self.session.get(f"{API_BASE}/jobs", headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if isinstance(data, list) and len(data) > 0:
                        job = data[0]
                        if 'total_business_days_aging' in job and 'stage_business_days_aging' in job:
                            self.results['jobs']['list'] = {'status': 'PASS', 'message': f'Retrieved {len(data)} jobs with aging calculations'}
                            print(f"✅ GET /api/jobs - PASS ({len(data)} jobs retrieved)")
                        else:
                            self.results['jobs']['list'] = {'status': 'FAIL', 'message': 'Business day aging calculations missing'}
                            print("❌ GET /api/jobs - FAIL: Missing aging calculations")
                    else:
                        self.results['jobs']['list'] = {'status': 'FAIL', 'message': 'No jobs returned or invalid format'}
                        print("❌ GET /api/jobs - FAIL: No jobs or invalid format")
                else:
                    self.results['jobs']['list'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ GET /api/jobs - FAIL: Status {response.status}")
        except Exception as e:
            self.results['jobs']['list'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ GET /api/jobs - ERROR: {e}")

        # Test GET /api/jobs/{job_id} (Get specific job)
        if self.test_job_id:
            try:
                async with self.session.get(f"{API_BASE}/jobs/{self.test_job_id}", headers=self.auth_headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('job_id') == self.test_job_id:
                            self.results['jobs']['get_by_id'] = {'status': 'PASS', 'message': 'Successfully retrieved specific job'}
                            print("✅ GET /api/jobs/{job_id} - PASS")
                        else:
                            self.results['jobs']['get_by_id'] = {'status': 'FAIL', 'message': 'Wrong job returned'}
                            print("❌ GET /api/jobs/{job_id} - FAIL: Wrong job")
                    else:
                        self.results['jobs']['get_by_id'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                        print(f"❌ GET /api/jobs/{job_id} - FAIL: Status {response.status}")
            except Exception as e:
                self.results['jobs']['get_by_id'] = {'status': 'ERROR', 'message': str(e)}
                print(f"❌ GET /api/jobs/{job_id} - ERROR: {e}")

        # Test PUT /api/jobs/{job_id} (Update job)
        if self.test_job_id:
            update_data = {
                "notes": "Updated notes with additional information",
                "current_stage": "Phone Screen"
            }
            try:
                async with self.session.put(f"{API_BASE}/jobs/{self.test_job_id}", 
                                          json=update_data, 
                                          headers=self.auth_headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('notes') == update_data['notes']:
                            self.results['jobs']['update'] = {'status': 'PASS', 'message': 'Successfully updated job'}
                            print("✅ PUT /api/jobs/{job_id} - PASS")
                        else:
                            self.results['jobs']['update'] = {'status': 'FAIL', 'message': 'Job not properly updated'}
                            print("❌ PUT /api/jobs/{job_id} - FAIL: Not updated")
                    else:
                        self.results['jobs']['update'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                        print(f"❌ PUT /api/jobs/{job_id} - FAIL: Status {response.status}")
            except Exception as e:
                self.results['jobs']['update'] = {'status': 'ERROR', 'message': str(e)}
                print(f"❌ PUT /api/jobs/{job_id} - ERROR: {e}")

        # Test POST /api/jobs/{job_id}/stage (Update job stage)
        if self.test_job_id:
            stage_data = {
                "stage": "Technical Interview",
                "outcome": "passed",
                "notes": "Great technical discussion"
            }
            try:
                async with self.session.post(f"{API_BASE}/jobs/{self.test_job_id}/stage", 
                                           json=stage_data, 
                                           headers=self.auth_headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if 'message' in data:
                            self.results['jobs']['update_stage'] = {'status': 'PASS', 'message': 'Successfully updated job stage'}
                            print("✅ POST /api/jobs/{job_id}/stage - PASS")
                        else:
                            self.results['jobs']['update_stage'] = {'status': 'FAIL', 'message': 'Unexpected response format'}
                            print("❌ POST /api/jobs/{job_id}/stage - FAIL: Unexpected response")
                    else:
                        self.results['jobs']['update_stage'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                        print(f"❌ POST /api/jobs/{job_id}/stage - FAIL: Status {response.status}")
            except Exception as e:
                self.results['jobs']['update_stage'] = {'status': 'ERROR', 'message': str(e)}
                print(f"❌ POST /api/jobs/{job_id}/stage - ERROR: {e}")

    async def test_dashboard_endpoints(self):
        """Test dashboard statistics endpoints"""
        print("\n📊 Testing Dashboard Endpoints...")
        
        # Test GET /api/dashboard/stats
        try:
            async with self.session.get(f"{API_BASE}/dashboard/stats", headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    required_fields = ['total_applications', 'by_stage', 'by_job_family', 'by_work_type', 'average_aging_days']
                    if all(field in data for field in required_fields):
                        self.results['dashboard']['stats'] = {'status': 'PASS', 'message': f'Dashboard stats retrieved with {data["total_applications"]} applications'}
                        print(f"✅ GET /api/dashboard/stats - PASS ({data['total_applications']} applications)")
                    else:
                        missing = [f for f in required_fields if f not in data]
                        self.results['dashboard']['stats'] = {'status': 'FAIL', 'message': f'Missing fields: {missing}'}
                        print(f"❌ GET /api/dashboard/stats - FAIL: Missing fields {missing}")
                else:
                    self.results['dashboard']['stats'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ GET /api/dashboard/stats - FAIL: Status {response.status}")
        except Exception as e:
            self.results['dashboard']['stats'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ GET /api/dashboard/stats - ERROR: {e}")

    async def test_analytics_endpoints(self):
        """Test analytics endpoints"""
        print("\n📈 Testing Analytics Endpoints...")
        
        # Test GET /api/analytics
        try:
            async with self.session.get(f"{API_BASE}/analytics", headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    required_fields = ['total_applications', 'weekly_trends', 'success_rate', 'avg_response_time']
                    if all(field in data for field in required_fields):
                        self.results['analytics']['basic'] = {'status': 'PASS', 'message': 'Analytics data retrieved successfully'}
                        print("✅ GET /api/analytics - PASS")
                    else:
                        missing = [f for f in required_fields if f not in data]
                        self.results['analytics']['basic'] = {'status': 'FAIL', 'message': f'Missing fields: {missing}'}
                        print(f"❌ GET /api/analytics - FAIL: Missing fields {missing}")
                else:
                    self.results['analytics']['basic'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ GET /api/analytics - FAIL: Status {response.status}")
        except Exception as e:
            self.results['analytics']['basic'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ GET /api/analytics - ERROR: {e}")

        # Test GET /api/analytics/patterns (AI-powered)
        try:
            async with self.session.get(f"{API_BASE}/analytics/patterns", headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if 'total_applications' in data:
                        if 'insights' in data or 'error' in data:
                            # Either AI insights or error message is acceptable
                            self.results['analytics']['patterns'] = {'status': 'PASS', 'message': 'Pattern analysis completed (AI or fallback)'}
                            print("✅ GET /api/analytics/patterns - PASS")
                        else:
                            self.results['analytics']['patterns'] = {'status': 'FAIL', 'message': 'No insights or error handling'}
                            print("❌ GET /api/analytics/patterns - FAIL: No insights")
                    else:
                        self.results['analytics']['patterns'] = {'status': 'FAIL', 'message': 'Invalid response format'}
                        print("❌ GET /api/analytics/patterns - FAIL: Invalid format")
                else:
                    self.results['analytics']['patterns'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ GET /api/analytics/patterns - FAIL: Status {response.status}")
        except Exception as e:
            self.results['analytics']['patterns'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ GET /api/analytics/patterns - ERROR: {e}")

    async def test_template_endpoints(self):
        """Test template endpoints"""
        print("\n📋 Testing Template Endpoints...")
        
        # Test GET /api/templates
        try:
            async with self.session.get(f"{API_BASE}/templates", headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if 'default' in data and 'custom' in data:
                        default_templates = data['default']
                        if len(default_templates) >= 6:  # Should have 6 default job families
                            self.results['templates']['get'] = {'status': 'PASS', 'message': f'Retrieved {len(default_templates)} default templates'}
                            print(f"✅ GET /api/templates - PASS ({len(default_templates)} default templates)")
                        else:
                            self.results['templates']['get'] = {'status': 'FAIL', 'message': f'Only {len(default_templates)} default templates found'}
                            print(f"❌ GET /api/templates - FAIL: Only {len(default_templates)} templates")
                    else:
                        self.results['templates']['get'] = {'status': 'FAIL', 'message': 'Missing default or custom templates'}
                        print("❌ GET /api/templates - FAIL: Missing template categories")
                else:
                    self.results['templates']['get'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ GET /api/templates - FAIL: Status {response.status}")
        except Exception as e:
            self.results['templates']['get'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ GET /api/templates - ERROR: {e}")

        # Test POST /api/templates (Create custom template)
        template_data = {
            "job_family": "Custom Test Role",
            "stages": ["Applied", "Custom Screen", "Custom Interview", "Final Decision"]
        }
        try:
            async with self.session.post(f"{API_BASE}/templates", 
                                       json=template_data, 
                                       headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('template_id') and data.get('job_family') == template_data['job_family']:
                        self.results['templates']['create'] = {'status': 'PASS', 'message': 'Custom template created successfully'}
                        print("✅ POST /api/templates - PASS")
                    else:
                        self.results['templates']['create'] = {'status': 'FAIL', 'message': 'Template not properly created'}
                        print("❌ POST /api/templates - FAIL: Not created properly")
                else:
                    self.results['templates']['create'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ POST /api/templates - FAIL: Status {response.status}")
        except Exception as e:
            self.results['templates']['create'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ POST /api/templates - ERROR: {e}")

    async def test_other_endpoints(self):
        """Test other endpoints"""
        print("\n🔧 Testing Other Endpoints...")
        
        # Test GET /api/jobs/export/csv
        try:
            async with self.session.get(f"{API_BASE}/jobs/export/csv", headers=self.auth_headers) as response:
                if response.status == 200:
                    content_type = response.headers.get('content-type', '')
                    if 'text/csv' in content_type:
                        csv_data = await response.text()
                        if 'Company,Position' in csv_data:  # Check CSV header
                            self.results['other']['csv_export'] = {'status': 'PASS', 'message': 'CSV export working correctly'}
                            print("✅ GET /api/jobs/export/csv - PASS")
                        else:
                            self.results['other']['csv_export'] = {'status': 'FAIL', 'message': 'Invalid CSV format'}
                            print("❌ GET /api/jobs/export/csv - FAIL: Invalid CSV")
                    else:
                        self.results['other']['csv_export'] = {'status': 'FAIL', 'message': f'Wrong content type: {content_type}'}
                        print(f"❌ GET /api/jobs/export/csv - FAIL: Wrong content type")
                else:
                    self.results['other']['csv_export'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ GET /api/jobs/export/csv - FAIL: Status {response.status}")
        except Exception as e:
            self.results['other']['csv_export'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ GET /api/jobs/export/csv - ERROR: {e}")

        # Test POST /api/subscription/verify (Placeholder)
        sub_data = {
            "receipt": "test_receipt_data",
            "platform": "ios"
        }
        try:
            async with self.session.post(f"{API_BASE}/subscription/verify", 
                                       json=sub_data, 
                                       headers=self.auth_headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('verified') is True:
                        self.results['other']['subscription'] = {'status': 'PASS', 'message': 'Subscription verification (placeholder) working'}
                        print("✅ POST /api/subscription/verify - PASS (placeholder)")
                    else:
                        self.results['other']['subscription'] = {'status': 'FAIL', 'message': 'Subscription not verified'}
                        print("❌ POST /api/subscription/verify - FAIL: Not verified")
                else:
                    self.results['other']['subscription'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                    print(f"❌ POST /api/subscription/verify - FAIL: Status {response.status}")
        except Exception as e:
            self.results['other']['subscription'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ POST /api/subscription/verify - ERROR: {e}")

    async def test_error_cases(self):
        """Test error handling"""
        print("\n⚠️  Testing Error Cases...")
        
        # Test 401 Unauthorized
        try:
            async with self.session.get(f"{API_BASE}/auth/me") as response:  # No auth header
                if response.status == 401:
                    self.results['other']['auth_error'] = {'status': 'PASS', 'message': '401 error handling works'}
                    print("✅ 401 Unauthorized handling - PASS")
                else:
                    self.results['other']['auth_error'] = {'status': 'FAIL', 'message': f'Expected 401, got {response.status}'}
                    print(f"❌ 401 Unauthorized handling - FAIL: Got {response.status}")
        except Exception as e:
            self.results['other']['auth_error'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ 401 Unauthorized handling - ERROR: {e}")

        # Test 404 Not Found
        try:
            async with self.session.get(f"{API_BASE}/jobs/nonexistent_job_id", headers=self.auth_headers) as response:
                if response.status == 404:
                    self.results['other']['not_found_error'] = {'status': 'PASS', 'message': '404 error handling works'}
                    print("✅ 404 Not Found handling - PASS")
                else:
                    self.results['other']['not_found_error'] = {'status': 'FAIL', 'message': f'Expected 404, got {response.status}'}
                    print(f"❌ 404 Not Found handling - FAIL: Got {response.status}")
        except Exception as e:
            self.results['other']['not_found_error'] = {'status': 'ERROR', 'message': str(e)}
            print(f"❌ 404 Not Found handling - ERROR: {e}")

    async def cleanup_test_job(self):
        """Clean up test job"""
        if self.test_job_id:
            try:
                async with self.session.delete(f"{API_BASE}/jobs/{self.test_job_id}", headers=self.auth_headers) as response:
                    if response.status == 200:
                        self.results['jobs']['delete'] = {'status': 'PASS', 'message': 'Job deleted successfully'}
                        print("✅ DELETE /api/jobs/{job_id} - PASS")
                    else:
                        self.results['jobs']['delete'] = {'status': 'FAIL', 'message': f'Status: {response.status}'}
                        print(f"❌ DELETE /api/jobs/{job_id} - FAIL: Status {response.status}")
            except Exception as e:
                self.results['jobs']['delete'] = {'status': 'ERROR', 'message': str(e)}
                print(f"❌ DELETE /api/jobs/{job_id} - ERROR: {e}")

    async def cleanup(self):
        """Cleanup test environment"""
        print("\n🧹 Cleaning up test environment...")
        
        # Clean up test data
        if self.db:
            await self.db.users.delete_one({"email": TEST_USER_EMAIL})
            await self.db.user_sessions.delete_one({"session_token": TEST_SESSION_TOKEN})
            if self.test_job_id:
                await self.db.jobs.delete_one({"job_id": self.test_job_id})
        
        # Close connections
        if self.session:
            await self.session.close()
        if self.mongo_client:
            self.mongo_client.close()
        
        print("✅ Cleanup completed")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📋 TEST SUMMARY")
        print("="*60)
        
        total_tests = 0
        passed_tests = 0
        failed_tests = 0
        error_tests = 0
        
        for category, tests in self.results.items():
            if tests:
                print(f"\n{category.upper()}:")
                for test_name, result in tests.items():
                    status = result['status']
                    message = result['message']
                    
                    if status == 'PASS':
                        print(f"  ✅ {test_name}: {message}")
                        passed_tests += 1
                    elif status == 'FAIL':
                        print(f"  ❌ {test_name}: {message}")
                        failed_tests += 1
                    else:  # ERROR
                        print(f"  🔥 {test_name}: {message}")
                        error_tests += 1
                    
                    total_tests += 1
        
        print(f"\n{'='*60}")
        print(f"TOTAL TESTS: {total_tests}")
        print(f"✅ PASSED: {passed_tests}")
        print(f"❌ FAILED: {failed_tests}")
        print(f"🔥 ERRORS: {error_tests}")
        print(f"SUCCESS RATE: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        print("="*60)

    async def run_all_tests(self):
        """Run all tests"""
        try:
            await self.setup()
            await self.test_auth_endpoints()
            await self.test_job_crud_endpoints()
            await self.test_dashboard_endpoints()
            await self.test_analytics_endpoints()
            await self.test_template_endpoints()
            await self.test_other_endpoints()
            await self.test_error_cases()
            await self.cleanup_test_job()
        except Exception as e:
            print(f"🔥 Critical error during testing: {e}")
        finally:
            await self.cleanup()
            self.print_summary()

async def main():
    """Main test runner"""
    print("🚀 Starting Job Tracker Backend API Tests")
    print(f"Backend URL: {API_BASE}")
    
    tester = JobTrackerAPITester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())