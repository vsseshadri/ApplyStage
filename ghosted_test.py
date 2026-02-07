#!/usr/bin/env python3
import requests

BASE_URL = "http://localhost:8001"
HEADERS = {"Authorization": "Bearer test_token_abc123"}

# Create a ghosted job
print("Creating ghosted job...")
job_data = {
    "company_name": "GhostedCompany",
    "position": "Software Engineer", 
    "location": {"city": "San Francisco", "state": "California"},
    "salary_range": {"min": 100000, "max": 150000},
    "work_mode": "remote",
    "job_type": "full_time",
    "status": "ghosted"
}

response = requests.post(f"{BASE_URL}/api/jobs", headers=HEADERS, json=job_data)
print(f"Ghosted job creation: {response.status_code}")
if response.status_code == 200:
    job = response.json()
    job_id = job["job_id"]
    print(f"Created ghosted job ID: {job_id}")
    
    # Test dashboard stats with ghosted job
    response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=HEADERS)
    print(f"Dashboard stats: {response.status_code}")
    if response.status_code == 200:
        stats = response.json()
        print(f"Ghosted count: {stats.get('ghosted', 0)}")
        print(f"Total jobs: {stats.get('total', 0)}")
    
    # Test AI insights with ghosted job
    response = requests.get(f"{BASE_URL}/api/dashboard/ai-insights", headers=HEADERS)
    print(f"AI insights: {response.status_code}")
    if response.status_code == 200:
        insights = response.json()
        print(f"Insights count: {len(insights.get('insights', []))}")
        print(f"Follow-ups count: {len(insights.get('follow_ups', []))}")
        
        # Check for ghosted-related insights
        for insight in insights.get('insights', []):
            if 'ghost' in insight.get('text', '').lower():
                print(f"Found ghosted insight: {insight.get('text')}")
    
    # Clean up
    response = requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=HEADERS)
    print(f"Cleanup: {response.status_code}")