#!/usr/bin/env python3
"""
Quick test for analytics endpoints
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
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://jobvault-2.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Test data
TEST_USER_EMAIL = "testuser@jobtracker.com"
TEST_SESSION_TOKEN = f"test_session_{uuid.uuid4().hex[:16]}"

async def test_analytics():
    """Test analytics endpoints"""
    
    # Setup MongoDB connection
    mongo_client = AsyncIOMotorClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    
    # Create test user and session
    test_user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    test_user = {
        "user_id": test_user_id,
        "email": TEST_USER_EMAIL,
        "name": "Test User",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.delete_one({"email": TEST_USER_EMAIL})
    await db.users.insert_one(test_user)
    
    test_session = {
        "user_id": test_user_id,
        "session_token": TEST_SESSION_TOKEN,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.user_sessions.delete_one({"session_token": TEST_SESSION_TOKEN})
    await db.user_sessions.insert_one(test_session)
    
    auth_headers = {"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
    
    # Create a test job
    test_job = {
        "job_id": f"job_{uuid.uuid4().hex[:12]}",
        "user_id": test_user_id,
        "company": "Test Company",
        "position": "Software Engineer",
        "job_family": "Software Engineer",
        "location": "Remote",
        "work_type": "remote",
        "applied_date": datetime.now(timezone.utc),
        "current_stage": "Applied",
        "stage_history": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.jobs.insert_one(test_job)
    
    # Test endpoints
    async with aiohttp.ClientSession() as session:
        print("Testing /api/dashboard/stats...")
        async with session.get(f"{API_BASE}/dashboard/stats", headers=auth_headers) as response:
            print(f"Status: {response.status}")
            if response.status == 200:
                data = await response.json()
                print(f"✅ Dashboard stats: {data}")
            else:
                error = await response.text()
                print(f"❌ Error: {error}")
        
        print("\nTesting /api/analytics...")
        async with session.get(f"{API_BASE}/analytics", headers=auth_headers) as response:
            print(f"Status: {response.status}")
            if response.status == 200:
                data = await response.json()
                print(f"✅ Analytics: {data}")
            else:
                error = await response.text()
                print(f"❌ Error: {error}")
        
        print("\nTesting /api/analytics/patterns...")
        async with session.get(f"{API_BASE}/analytics/patterns", headers=auth_headers) as response:
            print(f"Status: {response.status}")
            if response.status == 200:
                data = await response.json()
                print(f"✅ Patterns: {data}")
            else:
                error = await response.text()
                print(f"❌ Error: {error}")
    
    # Cleanup
    await db.users.delete_one({"email": TEST_USER_EMAIL})
    await db.user_sessions.delete_one({"session_token": TEST_SESSION_TOKEN})
    await db.jobs.delete_one({"job_id": test_job["job_id"]})
    mongo_client.close()

if __name__ == "__main__":
    asyncio.run(test_analytics())