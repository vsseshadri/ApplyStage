#!/usr/bin/env python3
import requests

BASE_URL = "http://localhost:8001"
HEADERS = {"Authorization": "Bearer test_token_abc123"}

# Test 1: Create a job first
print("Creating test job...")
job_data = {
    "company_name": "TestCompany",
    "position": "Software Engineer", 
    "location": {"city": "San Francisco", "state": "California"},
    "salary_range": {"min": 100000, "max": 150000},
    "work_mode": "remote",
    "job_type": "full_time",
    "status": "applied"
}

response = requests.post(f"{BASE_URL}/api/jobs", headers=HEADERS, json=job_data)
print(f"Job creation: {response.status_code}")
if response.status_code == 200:
    job = response.json()
    job_id = job["job_id"]
    print(f"Created job ID: {job_id}")
    
    # Test 2: Test checklist progress endpoints
    print("\nTesting checklist progress endpoints...")
    
    # GET empty progress
    response = requests.get(f"{BASE_URL}/api/checklist-progress/{job_id}/system_design", headers=HEADERS)
    print(f"GET empty progress: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")
    
    # PUT progress
    progress_data = {
        "job_id": job_id,
        "stage": "system_design", 
        "completed_items": ["sd1", "sd2"]
    }
    response = requests.put(f"{BASE_URL}/api/checklist-progress", headers=HEADERS, json=progress_data)
    print(f"PUT progress: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")
    
    # GET saved progress
    response = requests.get(f"{BASE_URL}/api/checklist-progress/{job_id}/system_design", headers=HEADERS)
    print(f"GET saved progress: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")
    
    # Clean up
    response = requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=HEADERS)
    print(f"Cleanup: {response.status_code}")

# Test 3: Test interview checklist
print("\nTesting interview checklist...")
response = requests.get(f"{BASE_URL}/api/interview-checklist/system_design", headers=HEADERS)
print(f"Interview checklist: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Title: {data.get('title')}")
    print(f"Items count: {len(data.get('items', []))}")
else:
    print(f"Error: {response.text}")

# Test 4: Test with company parameter
print("\nTesting interview checklist with company...")
response = requests.get(f"{BASE_URL}/api/interview-checklist/system_design?company=Google", headers=HEADERS)
print(f"Interview checklist with company: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Title: {data.get('title')}")
    print(f"Company: {data.get('company')}")
    print(f"Items count: {len(data.get('items', []))}")
else:
    print(f"Error: {response.text}")

# Test 5: Test ghosted status in dashboard
print("\nTesting ghosted status in dashboard...")
response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=HEADERS)
print(f"Dashboard stats: {response.status_code}")
if response.status_code == 200:
    stats = response.json()
    print(f"Ghosted count: {stats.get('ghosted', 'N/A')}")
else:
    print(f"Error: {response.text}")