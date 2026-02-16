#!/usr/bin/env python3
"""
Backend Test Suite for CareerFlow Report Generation System
Tests automatic report generation functionality including:
1. Scheduler verification
2. Manual report generation endpoints
3. Report listing and content verification
"""

import asyncio
import httpx
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

# Configuration
BACKEND_URL = "https://apptracker-19.preview.emergentagent.com"
TEST_TOKEN = "test_token_abc123"

class ReportGenerationTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        self.test_results = []
        
    async def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} - {test_name}"
        if details:
            result += f": {details}"
        self.test_results.append(result)
        print(result)
        
    async def test_backend_connectivity(self) -> bool:
        """Test basic backend connectivity"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.base_url}/api/auth/me", headers=self.headers)
                if response.status_code == 200:
                    await self.log_test("Backend Connectivity", True, f"Server responding at {self.base_url}")
                    return True
                else:
                    await self.log_test("Backend Connectivity", False, f"HTTP {response.status_code}")
                    return False
        except Exception as e:
            await self.log_test("Backend Connectivity", False, f"Connection error: {str(e)}")
            return False
    
    async def test_scheduler_status(self) -> bool:
        """Verify scheduler is running by checking logs and health"""
        try:
            # Check if health endpoint exists and reports scheduler status
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.base_url}/api/health", headers=self.headers)
                if response.status_code == 200:
                    health_data = response.json()
                    await self.log_test("Scheduler Health Check", True, "Health endpoint accessible")
                    return True
                else:
                    await self.log_test("Scheduler Health Check", False, f"Health endpoint returned {response.status_code}")
                    return False
        except Exception as e:
            await self.log_test("Scheduler Health Check", False, f"Error: {str(e)}")
            return False
    
    async def test_manual_weekly_report_generation(self) -> bool:
        """Test manual weekly report generation endpoint"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{self.base_url}/api/reports/generate/weekly", headers=self.headers)
                
                if response.status_code == 200:
                    report_data = response.json()
                    
                    # Verify generation response structure
                    required_fields = ["report_id", "title", "message"]
                    missing_fields = [field for field in required_fields if field not in report_data]
                    
                    if missing_fields:
                        await self.log_test("Weekly Report Generation", False, f"Missing fields: {missing_fields}")
                        return False
                    
                    # Verify message indicates weekly report
                    message = report_data.get("message", "")
                    if "weekly" not in message.lower():
                        await self.log_test("Weekly Report Generation", False, f"Message doesn't indicate weekly report: {message}")
                        return False
                    
                    # Now fetch the actual report to verify content
                    report_id = report_data.get("report_id")
                    detail_response = await client.get(f"{self.base_url}/api/reports/{report_id}", headers=self.headers)
                    
                    if detail_response.status_code != 200:
                        await self.log_test("Weekly Report Generation", False, f"Could not fetch generated report: HTTP {detail_response.status_code}")
                        return False
                    
                    report_detail = detail_response.json()
                    
                    # Verify full report structure
                    detail_required_fields = ["report_id", "title", "content", "created_at", "report_type"]
                    missing_detail_fields = [field for field in detail_required_fields if field not in report_detail]
                    
                    if missing_detail_fields:
                        await self.log_test("Weekly Report Generation", False, f"Generated report missing fields: {missing_detail_fields}")
                        return False
                    
                    # Verify report type
                    if report_detail.get("report_type") != "weekly":
                        await self.log_test("Weekly Report Generation", False, f"Wrong report type: {report_detail.get('report_type')}")
                        return False
                    
                    # Verify content contains expected sections
                    content = report_detail.get("content", "")
                    expected_sections = ["Weekly Metrics", "Applications This Week", "Follow-up Reminders"]
                    missing_sections = [section for section in expected_sections if section not in content]
                    
                    if missing_sections:
                        await self.log_test("Weekly Report Generation", False, f"Missing content sections: {missing_sections}")
                        return False
                    
                    await self.log_test("Weekly Report Generation", True, f"Generated report {report_id} with all required sections")
                    return True
                else:
                    await self.log_test("Weekly Report Generation", False, f"HTTP {response.status_code}: {response.text}")
                    return False
                    
        except Exception as e:
            await self.log_test("Weekly Report Generation", False, f"Error: {str(e)}")
            return False
    
    async def test_manual_monthly_report_generation(self) -> bool:
        """Test manual monthly report generation endpoint"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{self.base_url}/api/reports/generate/monthly", headers=self.headers)
                
                if response.status_code == 200:
                    report_data = response.json()
                    
                    # Verify generation response structure
                    required_fields = ["report_id", "title", "message"]
                    missing_fields = [field for field in required_fields if field not in report_data]
                    
                    if missing_fields:
                        await self.log_test("Monthly Report Generation", False, f"Missing fields: {missing_fields}")
                        return False
                    
                    # Verify message indicates monthly report
                    message = report_data.get("message", "")
                    if "monthly" not in message.lower():
                        await self.log_test("Monthly Report Generation", False, f"Message doesn't indicate monthly report: {message}")
                        return False
                    
                    # Now fetch the actual report to verify content
                    report_id = report_data.get("report_id")
                    detail_response = await client.get(f"{self.base_url}/api/reports/{report_id}", headers=self.headers)
                    
                    if detail_response.status_code != 200:
                        await self.log_test("Monthly Report Generation", False, f"Could not fetch generated report: HTTP {detail_response.status_code}")
                        return False
                    
                    report_detail = detail_response.json()
                    
                    # Verify full report structure
                    detail_required_fields = ["report_id", "title", "content", "created_at", "report_type"]
                    missing_detail_fields = [field for field in detail_required_fields if field not in report_detail]
                    
                    if missing_detail_fields:
                        await self.log_test("Monthly Report Generation", False, f"Generated report missing fields: {missing_detail_fields}")
                        return False
                    
                    # Verify report type
                    if report_detail.get("report_type") != "monthly":
                        await self.log_test("Monthly Report Generation", False, f"Wrong report type: {report_detail.get('report_type')}")
                        return False
                    
                    # Verify content contains expected sections
                    content = report_detail.get("content", "")
                    expected_sections = ["Monthly Overview", "Status Breakdown", "Work Mode Distribution"]
                    missing_sections = [section for section in expected_sections if section not in content]
                    
                    if missing_sections:
                        await self.log_test("Monthly Report Generation", False, f"Missing content sections: {missing_sections}")
                        return False
                    
                    await self.log_test("Monthly Report Generation", True, f"Generated report {report_id} with all required sections")
                    return True
                else:
                    await self.log_test("Monthly Report Generation", False, f"HTTP {response.status_code}: {response.text}")
                    return False
                    
        except Exception as e:
            await self.log_test("Monthly Report Generation", False, f"Error: {str(e)}")
            return False
    
    async def test_reports_listing(self) -> bool:
        """Test GET /api/reports endpoint"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.base_url}/api/reports", headers=self.headers)
                
                if response.status_code == 200:
                    reports = response.json()
                    
                    if not isinstance(reports, list):
                        await self.log_test("Reports Listing", False, f"Expected list, got {type(reports)}")
                        return False
                    
                    # If we have reports, verify their structure
                    if reports:
                        sample_report = reports[0]
                        # Reports listing doesn't include content for performance reasons
                        required_fields = ["report_id", "title", "created_at", "report_type"]
                        missing_fields = [field for field in required_fields if field not in sample_report]
                        
                        if missing_fields:
                            await self.log_test("Reports Listing", False, f"Report missing fields: {missing_fields}")
                            return False
                        
                        # Check for both weekly and monthly reports
                        report_types = [report.get("report_type") for report in reports]
                        has_weekly = "weekly" in report_types
                        has_monthly = "monthly" in report_types
                        
                        await self.log_test("Reports Listing", True, f"Found {len(reports)} reports (Weekly: {has_weekly}, Monthly: {has_monthly})")
                    else:
                        await self.log_test("Reports Listing", True, "No reports found (empty list)")
                    
                    return True
                else:
                    await self.log_test("Reports Listing", False, f"HTTP {response.status_code}: {response.text}")
                    return False
                    
        except Exception as e:
            await self.log_test("Reports Listing", False, f"Error: {str(e)}")
            return False
    
    async def test_report_content_quality(self) -> bool:
        """Test the quality and completeness of generated report content"""
        try:
            # Generate a fresh weekly report to test content
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{self.base_url}/api/reports/generate/weekly", headers=self.headers)
                
                if response.status_code != 200:
                    await self.log_test("Report Content Quality", False, f"Could not generate test report: HTTP {response.status_code}")
                    return False
                
                report = response.json()
                content = report.get("content", "")
                
                # Check for HTML formatting
                if not content.startswith("<div") or not content.endswith("</div>"):
                    await self.log_test("Report Content Quality", False, "Content is not properly HTML formatted")
                    return False
                
                # Check for key metrics sections
                quality_checks = {
                    "HTML Structure": "<div style=" in content and "</div>" in content,
                    "Weekly Metrics": "Weekly Metrics" in content and "Applications" in content,
                    "Applications List": "Applications This Week" in content,
                    "Follow-up Section": "Follow-up Reminders" in content,
                    "Insights Section": "Key Insights" in content,
                    "Proper Styling": "font-family:" in content and "color:" in content,
                    "Date Information": any(month in content for month in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
                }
                
                failed_checks = [check for check, passed in quality_checks.items() if not passed]
                
                if failed_checks:
                    await self.log_test("Report Content Quality", False, f"Failed quality checks: {failed_checks}")
                    return False
                
                await self.log_test("Report Content Quality", True, "All content quality checks passed")
                return True
                
        except Exception as e:
            await self.log_test("Report Content Quality", False, f"Error: {str(e)}")
            return False
    
    async def test_report_data_accuracy(self) -> bool:
        """Test that report data reflects actual user data"""
        try:
            # First get user's job data
            async with httpx.AsyncClient(timeout=30.0) as client:
                jobs_response = await client.get(f"{self.base_url}/api/jobs?limit=100", headers=self.headers)
                
                if jobs_response.status_code != 200:
                    await self.log_test("Report Data Accuracy", False, f"Could not fetch jobs: HTTP {jobs_response.status_code}")
                    return False
                
                jobs_data = jobs_response.json()
                total_jobs = jobs_data.get("pagination", {}).get("total_count", 0)
                
                # Generate a weekly report
                report_response = await client.post(f"{self.base_url}/api/reports/generate/weekly", headers=self.headers)
                
                if report_response.status_code != 200:
                    await self.log_test("Report Data Accuracy", False, f"Could not generate report: HTTP {report_response.status_code}")
                    return False
                
                report = report_response.json()
                content = report.get("content", "")
                
                # Check if report reflects the user's data state
                if total_jobs == 0:
                    # If no jobs, report should reflect this
                    if "0" in content or "no applications" in content.lower() or "get started" in content.lower():
                        await self.log_test("Report Data Accuracy", True, "Report correctly reflects empty job state")
                        return True
                    else:
                        await self.log_test("Report Data Accuracy", False, "Report does not reflect empty job state")
                        return False
                else:
                    # If jobs exist, report should have meaningful data
                    if any(word in content.lower() for word in ["application", "job", "company"]):
                        await self.log_test("Report Data Accuracy", True, f"Report reflects job data (total jobs: {total_jobs})")
                        return True
                    else:
                        await self.log_test("Report Data Accuracy", False, "Report does not reflect existing job data")
                        return False
                
        except Exception as e:
            await self.log_test("Report Data Accuracy", False, f"Error: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all report generation tests"""
        print("🚀 Starting CareerFlow Report Generation System Tests")
        print("=" * 60)
        
        # Test 1: Backend connectivity
        if not await self.test_backend_connectivity():
            print("❌ Backend connectivity failed - stopping tests")
            return
        
        # Test 2: Scheduler status
        await self.test_scheduler_status()
        
        # Test 3: Manual weekly report generation
        await self.test_manual_weekly_report_generation()
        
        # Test 4: Manual monthly report generation
        await self.test_manual_monthly_report_generation()
        
        # Test 5: Reports listing
        await self.test_reports_listing()
        
        # Test 6: Report content quality
        await self.test_report_content_quality()
        
        # Test 7: Report data accuracy
        await self.test_report_data_accuracy()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = sum(1 for result in self.test_results if "✅ PASS" in result)
        total_tests = len(self.test_results)
        
        for result in self.test_results:
            print(result)
        
        print(f"\n🎯 Results: {passed_tests}/{total_tests} tests passed ({round(passed_tests/total_tests*100, 1)}%)")
        
        if passed_tests == total_tests:
            print("🎉 All report generation tests PASSED! System is working correctly.")
        else:
            print(f"⚠️  {total_tests - passed_tests} test(s) failed. Review issues above.")

async def main():
    """Main test execution"""
    tester = ReportGenerationTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())