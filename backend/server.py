from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
# from sendgrid import SendGridAPIClient
# from sendgrid.helpers.mail import Mail
import csv
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    payment_status: str = "trial"
    trial_end_date: Optional[datetime] = None
    applications_count: int = 0
    preferences: Dict[str, Any] = {"weekly_email": True, "monthly_email": True}
    created_at: datetime

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class JobApplication(BaseModel):
    job_id: str
    user_id: str
    company_name: str
    position: str
    location: Dict[str, str]
    salary_range: Dict[str, float]
    work_mode: str
    job_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    resume_file: Optional[str] = None
    date_applied: Optional[datetime] = None
    follow_up_days: Optional[int] = None
    status: str = "applied"
    stages: List[Dict[str, Any]] = []
    custom_stages: List[str] = []
    reminders: List[Dict[str, Any]] = []
    is_priority: bool = False
    created_at: datetime
    updated_at: datetime

class JobApplicationCreate(BaseModel):
    company_name: str
    position: str
    location: Dict[str, str]
    salary_range: Dict[str, float]
    work_mode: str
    job_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    resume_file: Optional[str] = None
    date_applied: Optional[str] = None
    follow_up_days: Optional[int] = None
    status: str = "applied"
    custom_stages: List[str] = []
    is_priority: bool = False

class JobApplicationUpdate(BaseModel):
    company_name: Optional[str] = None
    position: Optional[str] = None
    location: Optional[Dict[str, str]] = None
    salary_range: Optional[Dict[str, float]] = None
    work_mode: Optional[str] = None
    job_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    resume_file: Optional[str] = None
    date_applied: Optional[str] = None
    is_priority: Optional[bool] = None
    follow_up_days: Optional[int] = None
    status: Optional[str] = None
    custom_stages: Optional[List[str]] = None

class CustomPosition(BaseModel):
    position_id: str
    user_id: str
    position_name: str
    created_at: datetime

class CustomPositionCreate(BaseModel):
    position_name: str

class ReminderCreate(BaseModel):
    job_id: str
    reminder_date: datetime
    message: str

class UserPreferences(BaseModel):
    weekly_email: bool
    monthly_email: bool

class PaymentVerification(BaseModel):
    receipt: str
    platform: str

async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)

@api_router.post("/auth/exchange-session")
async def exchange_session(session_id: str):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")
            
            user_data = response.json()
            
            existing_user = await db.users.find_one(
                {"email": user_data["email"]},
                {"_id": 0}
            )
            
            user_id = None
            if existing_user:
                user_id = existing_user["user_id"]
            else:
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                new_user = {
                    "user_id": user_id,
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "picture": user_data.get("picture"),
                    "payment_status": "trial",
                    "trial_end_date": datetime.now(timezone.utc) + timedelta(days=7),
                    "applications_count": 0,
                    "preferences": {"weekly_email": True, "monthly_email": True},
                    "created_at": datetime.now(timezone.utc)
                }
                await db.users.insert_one(new_user)
            
            session_token = user_data["session_token"]
            await db.user_sessions.insert_one({
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc)
            })
            
            return SessionDataResponse(**user_data)
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Authentication service error: {str(e)}")

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if not authorization:
        return {"message": "Logged out"}
    
    session_token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    await db.user_sessions.delete_one({"session_token": session_token})
    
    return {"message": "Logged out successfully"}

class AppleAuthRequest(BaseModel):
    identityToken: Optional[str] = None
    email: Optional[str] = None
    fullName: Optional[Dict[str, str]] = None
    user: str

@api_router.post("/auth/apple")
async def apple_auth(auth_data: AppleAuthRequest):
    """Handle Apple Sign-In authentication"""
    try:
        # In production, you would verify the identityToken with Apple's servers
        # For now, we'll create/update the user based on the provided data
        
        user_id = f"apple_{auth_data.user[:12]}"
        
        # Get name from fullName if provided
        name = "Apple User"
        if auth_data.fullName:
            given_name = auth_data.fullName.get("givenName", "")
            family_name = auth_data.fullName.get("familyName", "")
            if given_name or family_name:
                name = f"{given_name} {family_name}".strip()
        
        # Get email (may be None if user chose to hide it)
        email = auth_data.email or f"{user_id}@privaterelay.appleid.com"
        
        # Check if user exists
        existing_user = await db.users.find_one({"user_id": user_id})
        
        if not existing_user:
            # Create new user with 7-day trial
            trial_end = datetime.now(timezone.utc) + timedelta(days=7)
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": None,
                "payment_status": "trial",
                "trial_end_date": trial_end,
                "applications_count": 0,
                "preferences": {"weekly_email": True, "monthly_email": True},
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(new_user)
        else:
            # Update name/email if provided (Apple only sends on first sign-in)
            if auth_data.email or auth_data.fullName:
                update_data = {}
                if auth_data.email:
                    update_data["email"] = email
                if auth_data.fullName and name != "Apple User":
                    update_data["name"] = name
                if update_data:
                    await db.users.update_one({"user_id": user_id}, {"$set": update_data})
        
        # Create session
        session_token = str(uuid.uuid4())
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        return {"session_token": session_token, "user_id": user_id}
        
    except Exception as e:
        logging.error(f"Apple auth error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@api_router.get("/jobs", response_model=List[JobApplication])
async def get_jobs(current_user: User = Depends(get_current_user)):
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return [JobApplication(**job) for job in jobs]

@api_router.post("/jobs", response_model=JobApplication)
async def create_job(job_data: JobApplicationCreate, current_user: User = Depends(get_current_user)):
    if current_user.payment_status == "trial":
        if current_user.trial_end_date:
            trial_end = current_user.trial_end_date
            if trial_end.tzinfo is None:
                trial_end = trial_end.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > trial_end:
                raise HTTPException(status_code=403, detail="Trial period expired. Please upgrade to continue.")
    
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    date_applied_dt = now
    if job_data.date_applied:
        try:
            date_applied_dt = datetime.fromisoformat(job_data.date_applied.replace('Z', '+00:00'))
        except:
            date_applied_dt = now
    
    job = JobApplication(
        job_id=job_id,
        user_id=current_user.user_id,
        company_name=job_data.company_name,
        position=job_data.position,
        location=job_data.location,
        salary_range=job_data.salary_range,
        work_mode=job_data.work_mode,
        job_url=job_data.job_url,
        recruiter_email=job_data.recruiter_email,
        resume_file=job_data.resume_file,
        date_applied=date_applied_dt,
        follow_up_days=job_data.follow_up_days,
        status=job_data.status,
        stages=[{"status": job_data.status, "timestamp": now.isoformat()}],
        custom_stages=job_data.custom_stages,
        reminders=[],
        created_at=now,
        updated_at=now
    )
    
    await db.job_applications.insert_one(job.model_dump())
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"applications_count": 1}}
    )
    
    return job

@api_router.get("/jobs/{job_id}", response_model=JobApplication)
async def get_job(job_id: str, current_user: User = Depends(get_current_user)):
    job = await db.job_applications.find_one(
        {"job_id": job_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    
    return JobApplication(**job)

@api_router.put("/jobs/{job_id}", response_model=JobApplication)
async def update_job(job_id: str, job_data: JobApplicationUpdate, current_user: User = Depends(get_current_user)):
    job = await db.job_applications.find_one(
        {"job_id": job_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    
    update_data = {k: v for k, v in job_data.model_dump().items() if v is not None}
    
    if "status" in update_data and update_data["status"] != job["status"]:
        stages = job.get("stages", [])
        stages.append({"status": update_data["status"], "timestamp": datetime.now(timezone.utc).isoformat()})
        update_data["stages"] = stages
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.job_applications.update_one(
        {"job_id": job_id, "user_id": current_user.user_id},
        {"$set": update_data}
    )
    
    updated_job = await db.job_applications.find_one(
        {"job_id": job_id},
        {"_id": 0}
    )
    
    return JobApplication(**updated_job)

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: User = Depends(get_current_user)):
    result = await db.job_applications.delete_one(
        {"job_id": job_id, "user_id": current_user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job application not found")
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"applications_count": -1}}
    )
    
    return {"message": "Job application deleted"}

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    stats = {
        "total": len(jobs),
        "applied": 0,
        "recruiter_screening": 0,
        "phone_screen": 0,
        "coding_round_1": 0,
        "coding_round_2": 0,
        "system_design": 0,
        "behavioural": 0,
        "hiring_manager": 0,
        "final_round": 0,
        "offer": 0,
        "rejected": 0,
        "by_location": {},
        "by_work_mode": {
            "remote": 0,
            "onsite": 0,
            "hybrid": 0
        }
    }
    
    # State abbreviation mapping
    state_abbr = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    }
    
    ten_days_ago = datetime.now(timezone.utc) - timedelta(days=10)
    recent_count = 0
    
    for job in jobs:
        status = job.get("status", "applied")
        if status in stats:
            stats[status] += 1
        
        # Location aggregation with state abbreviation
        location = job.get("location", {})
        state = location.get("state", "Unknown")
        city = location.get("city", "Unknown")
        # Convert state to abbreviation
        state_short = state_abbr.get(state, state[:2].upper() if len(state) >= 2 else state)
        loc_key = f"{city}, {state_short}"
        
        if loc_key not in stats["by_location"]:
            stats["by_location"][loc_key] = 0
        stats["by_location"][loc_key] += 1
        
        # Work mode aggregation
        work_mode = job.get("work_mode", "").lower()
        if work_mode in stats["by_work_mode"]:
            stats["by_work_mode"][work_mode] += 1
        
        created_at = job.get("created_at")
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            if created_at >= ten_days_ago:
                recent_count += 1
    
    stats["last_10_days"] = recent_count
    
    return stats

@api_router.get("/dashboard/ai-insights")
async def get_ai_insights(current_user: User = Depends(get_current_user)):
    """
    Generate strategic AI-powered insights focused on:
    - Follow-up recommendations
    - Aging analysis and urgency
    - Progression rates across statuses
    - Priority job focus
    - Actionable next steps
    """
    # Get all jobs for detailed analysis
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    insights = []
    now = datetime.now(timezone.utc)
    
    # Data structures for analysis
    follow_ups_needed = []
    priority_jobs = []
    aging_analysis = {'critical': [], 'warning': [], 'healthy': []}
    stage_counts = {}
    stage_progression = {'advanced': 0, 'stalled': 0}
    
    # Initialize stage counts
    all_stages = ['applied', 'recruiter_screening', 'phone_screen', 'coding_round_1', 
                  'coding_round_2', 'system_design', 'behavioural', 'hiring_manager', 
                  'final_round', 'offer', 'rejected']
    for stage in all_stages:
        stage_counts[stage] = 0
    
    for job in jobs:
        status = job.get("status", "applied")
        if status in stage_counts:
            stage_counts[status] += 1
        
        company = job.get("company_name", "Unknown")
        position = job.get("position", "")
        is_priority = job.get("is_priority", False)
        
        # Get date applied
        date_applied = job.get("date_applied") or job.get("created_at")
        if date_applied:
            if isinstance(date_applied, str):
                date_applied = datetime.fromisoformat(date_applied.replace('Z', '+00:00'))
            if date_applied.tzinfo is None:
                date_applied = date_applied.replace(tzinfo=timezone.utc)
            
            days_old = (now - date_applied).days
            # Calculate business days (exclude weekends)
            biz_days = sum(1 for i in range(days_old) if (date_applied + timedelta(days=i)).weekday() < 5)
        else:
            days_old = 0
            biz_days = 0
        
        # Priority jobs tracking
        if is_priority:
            priority_jobs.append({
                "company": company,
                "position": position,
                "status": status,
                "days_old": days_old,
                "biz_days": biz_days
            })
        
        # Aging analysis (excluding offers and rejections)
        if status not in ['offer', 'rejected']:
            if biz_days >= 20 and status in ['applied', 'recruiter_screening']:
                aging_analysis['critical'].append({
                    "company": company, "days": biz_days, "status": status
                })
            elif biz_days >= 10 and status in ['applied', 'recruiter_screening', 'phone_screen']:
                aging_analysis['warning'].append({
                    "company": company, "days": biz_days, "status": status
                })
        
        # Follow-up analysis
        follow_up_days = job.get("follow_up_days")
        if follow_up_days and status not in ['offer', 'rejected']:
            if days_old >= follow_up_days:
                overdue_by = days_old - follow_up_days
                follow_ups_needed.append({
                    "company": company,
                    "position": position,
                    "overdue_days": overdue_by,
                    "is_priority": is_priority
                })
        
        # Track progression
        early_stages = ['applied', 'recruiter_screening']
        mid_stages = ['phone_screen', 'coding_round_1', 'coding_round_2']
        advanced_stages_list = ['system_design', 'behavioural', 'hiring_manager', 'final_round', 'offer']
        
        if status in advanced_stages_list:
            stage_progression['advanced'] += 1
        elif status in early_stages and biz_days >= 15:
            stage_progression['stalled'] += 1
    
    total = len(jobs)
    active_jobs = total - stage_counts['offer'] - stage_counts['rejected']
    
    # STRATEGIC INSIGHT 1: Follow-up Strategy
    if follow_ups_needed:
        # Sort by priority first, then by overdue days
        follow_ups_needed.sort(key=lambda x: (-x['is_priority'], -x['overdue_days']))
        priority_followups = [f for f in follow_ups_needed if f['is_priority']]
        
        if priority_followups:
            top = priority_followups[0]
            insights.append(f"🎯 Priority follow-up: {top['company']} is {top['overdue_days']}d overdue. Sending a brief update inquiry could re-engage the recruiter.")
        
        if len(follow_ups_needed) > len(priority_followups):
            regular = len(follow_ups_needed) - len(priority_followups)
            insights.append(f"📧 {regular} other application{'s need' if regular > 1 else ' needs'} follow-up. Consider batch-sending check-ins on Monday mornings for best response rates.")
    
    # STRATEGIC INSIGHT 2: Aging & Urgency Analysis
    critical_count = len(aging_analysis['critical'])
    warning_count = len(aging_analysis['warning'])
    
    if critical_count > 0:
        oldest = max(aging_analysis['critical'], key=lambda x: x['days'])
        insights.append(f"⚠️ {oldest['company']} has been at '{oldest['status'].replace('_', ' ')}' for {oldest['days']} business days. Applications beyond 20 biz days in early stages have <15% progression rate—consider a strategic follow-up or moving focus elsewhere.")
    
    if warning_count > 2:
        insights.append(f"⏰ {warning_count} applications are aging (10+ biz days) in early stages. Industry data shows response rates drop 40% after 2 weeks—prioritize follow-ups on your top picks.")
    
    # STRATEGIC INSIGHT 3: Pipeline Health & Progression Rates
    if total >= 3:
        # Calculate progression rate
        progressed = total - stage_counts['applied'] - stage_counts['rejected']
        progression_rate = (progressed / total) * 100 if total > 0 else 0
        
        advanced = stage_progression['advanced']
        if advanced > 0 and active_jobs > 0:
            advanced_rate = (advanced / active_jobs) * 100
            if advanced_rate >= 30:
                insights.append(f"📈 Strong pipeline: {advanced_rate:.0f}% of active applications have reached advanced stages. Your materials are resonating well with hiring teams.")
            elif advanced_rate >= 15:
                insights.append(f"📊 Pipeline progress: {advanced} of {active_jobs} active applications in advanced stages ({advanced_rate:.0f}%). Consider optimizing your interview preparation for higher conversion.")
        
        # Stall detection
        if stage_progression['stalled'] >= 3:
            insights.append(f"🔄 {stage_progression['stalled']} applications appear stalled (15+ biz days in early stages). This may indicate: resume-role mismatch, competitive candidate pool, or slow company processes.")
    
    # STRATEGIC INSIGHT 4: Priority Jobs Summary
    if priority_jobs:
        priority_count = len(priority_jobs)
        priority_advanced = sum(1 for p in priority_jobs if p['status'] in ['phone_screen', 'coding_round_1', 'coding_round_2', 'system_design', 'behavioural', 'hiring_manager', 'final_round'])
        
        if priority_advanced > 0:
            insights.append(f"⭐ {priority_advanced} of {priority_count} priority jobs are advancing through interviews. Focus your prep time on these high-value opportunities.")
        elif priority_count > 0:
            stalled_priorities = [p for p in priority_jobs if p['biz_days'] >= 10 and p['status'] in ['applied', 'recruiter_screening']]
            if stalled_priorities:
                insights.append(f"⭐ {len(stalled_priorities)} priority job{'s have' if len(stalled_priorities) > 1 else ' has'} been waiting 10+ days. Consider reaching out directly to hiring managers via LinkedIn.")
    
    # STRATEGIC INSIGHT 5: Offers & Final Rounds
    if stage_counts['offer'] > 0:
        insights.append(f"🎉 You have {stage_counts['offer']} offer{'s' if stage_counts['offer'] > 1 else ''}! If negotiating, remember: 73% of employers expect candidates to negotiate base salary.")
    
    if stage_counts['final_round'] > 0:
        insights.append(f"🌟 {stage_counts['final_round']} in final rounds. Tip: Prepare 3-5 thoughtful questions about team dynamics and success metrics—interviewers notice engaged candidates.")
    
    if stage_counts['hiring_manager'] > 0:
        insights.append(f"💼 {stage_counts['hiring_manager']} at hiring manager stage. Research recent company news and prepare to discuss how you'd contribute to current initiatives.")
    
    # STRATEGIC INSIGHT 6: Rejection Analysis
    if stage_counts['rejected'] > 0 and total >= 5:
        rejection_rate = (stage_counts['rejected'] / total) * 100
        if rejection_rate > 60:
            insights.append(f"💡 High rejection rate ({rejection_rate:.0f}%). Consider: narrowing role focus, tailoring resume keywords to job descriptions, or seeking referrals for better visibility.")
    
    # Default insight
    if not insights:
        insights.append("🚀 Add job applications with follow-up reminders to receive strategic insights on your job search!")
    
    return {"insights": insights}

@api_router.get("/positions", response_model=List[CustomPosition])
async def get_positions(current_user: User = Depends(get_current_user)):
    positions = await db.custom_positions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    return [CustomPosition(**pos) for pos in positions]

@api_router.post("/positions", response_model=CustomPosition)
async def create_position(position_data: CustomPositionCreate, current_user: User = Depends(get_current_user)):
    position = CustomPosition(
        position_id=f"pos_{uuid.uuid4().hex[:12]}",
        user_id=current_user.user_id,
        position_name=position_data.position_name,
        created_at=datetime.now(timezone.utc)
    )
    
    await db.custom_positions.insert_one(position.model_dump())
    
    return position

@api_router.post("/reminders")
async def create_reminder(reminder_data: ReminderCreate, current_user: User = Depends(get_current_user)):
    job = await db.job_applications.find_one(
        {"job_id": reminder_data.job_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    
    reminder = {
        "reminder_id": f"rem_{uuid.uuid4().hex[:12]}",
        "date": reminder_data.reminder_date,
        "message": reminder_data.message,
        "completed": False
    }
    
    await db.job_applications.update_one(
        {"job_id": reminder_data.job_id},
        {"$push": {"reminders": reminder}}
    )
    
    return reminder

@api_router.put("/preferences")
async def update_preferences(preferences: UserPreferences, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"preferences": preferences.model_dump()}}
    )
    
    return {"message": "Preferences updated"}

@api_router.post("/payment/verify")
async def verify_payment(payment: PaymentVerification, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"payment_status": "paid"}}
    )
    
    return {"message": "Payment verified", "status": "paid"}

@api_router.get("/export/csv")
async def export_csv(current_user: User = Depends(get_current_user)):
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Company", "Position", "City", "State", "Work Mode",
        "Min Salary", "Max Salary", "Status", "Date Applied", "Created Date", "Updated Date"
    ])
    
    for job in jobs:
        writer.writerow([
            job.get("company_name", ""),
            job.get("position", ""),
            job.get("location", {}).get("city", ""),
            job.get("location", {}).get("state", ""),
            job.get("work_mode", ""),
            job.get("salary_range", {}).get("min", ""),
            job.get("salary_range", {}).get("max", ""),
            job.get("status", ""),
            job.get("date_applied", ""),
            job.get("created_at", ""),
            job.get("updated_at", "")
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=job_applications.csv"}
    )

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
