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
    name: Optional[str] = None
    picture: Optional[str] = None
    payment_status: str = "trial"
    trial_end_date: Optional[datetime] = None
    applications_count: int = 0
    preferences: Dict[str, Any] = {"weekly_email": True, "monthly_email": True}
    created_at: datetime
    is_private_relay: bool = False
    preferred_display_name: Optional[str] = None
    communication_email: Optional[str] = None

class DisplayNameUpdate(BaseModel):
    preferred_display_name: str

class CommunicationEmailUpdate(BaseModel):
    communication_email: str

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
    updated_at: Optional[datetime] = None

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
        name = None
        if auth_data.fullName:
            given_name = auth_data.fullName.get("givenName", "") or ""
            family_name = auth_data.fullName.get("familyName", "") or ""
            full_name = f"{given_name} {family_name}".strip()
            if full_name:
                name = full_name
        
        # Get email (may be None if user chose to hide it)
        email = auth_data.email or f"{user_id}@privaterelay.appleid.com"
        
        # Check if this is a private relay email
        is_private_relay = "@privaterelay.appleid.com" in email
        
        # If no name provided and not private relay, try to extract from email
        if not name and not is_private_relay:
            email_prefix = email.split('@')[0]
            # Clean up email prefix to make it more readable
            if email_prefix and not email_prefix.startswith('apple_'):
                # Convert underscores/dots to spaces and capitalize
                name = email_prefix.replace('_', ' ').replace('.', ' ').title()
        
        # For private relay emails without a name, leave name as None (will be handled by frontend)
        if not name:
            name = None
        
        # Check if user exists
        existing_user = await db.users.find_one({"user_id": user_id})
        is_new_user = existing_user is None
        
        if not existing_user:
            # Create new user with 7-day trial
            trial_end = datetime.now(timezone.utc) + timedelta(days=7)
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,  # May be None for private relay users
                "picture": None,
                "payment_status": "trial",
                "trial_end_date": trial_end,
                "applications_count": 0,
                "preferences": {"weekly_email": True, "monthly_email": True},
                "created_at": datetime.now(timezone.utc),
                "is_private_relay": is_private_relay
            }
            await db.users.insert_one(new_user)
        else:
            # Update name/email if provided (Apple only sends on first sign-in)
            # or if the existing name is a generic placeholder
            update_data = {}
            if auth_data.email:
                update_data["email"] = email
            
            # Update name if: new name provided AND existing name is empty/None
            existing_name = existing_user.get("name")
            if name and (not existing_name or existing_name in ["Apple User", "User"]):
                update_data["name"] = name
            
            # Update private relay flag
            update_data["is_private_relay"] = is_private_relay
                
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
        
        return {"session_token": session_token, "user_id": user_id, "is_new_user": is_new_user}
        
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
        except ValueError:
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
    Generate strategic AI-powered insights split into:
    - Strategic Insights (trends, patterns, recommendations)
    - Follow-up Reminders (urgent actions with aging stats)
    """
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    strategic_insights = []
    follow_up_reminders = []
    now = datetime.now(timezone.utc)
    
    # Data structures
    follow_ups_needed = []
    priority_jobs = []
    no_movement_jobs = []  # Jobs with no status change for extended periods
    stage_counts = {}
    stage_progression = {'advanced': 0, 'stalled': 0}
    
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
        is_priority = job.get("is_priority", False)
        
        # Get date applied
        date_applied = job.get("date_applied") or job.get("created_at")
        if date_applied:
            if isinstance(date_applied, str):
                date_applied = datetime.fromisoformat(date_applied.replace('Z', '+00:00'))
            if date_applied.tzinfo is None:
                date_applied = date_applied.replace(tzinfo=timezone.utc)
            days_old = (now - date_applied).days
            biz_days = sum(1 for i in range(days_old) if (date_applied + timedelta(days=i)).weekday() < 5)
        else:
            days_old = 0
            biz_days = 0
        
        # Track priority jobs
        if is_priority:
            priority_jobs.append({
                "company": company, "status": status, "biz_days": biz_days
            })
        
        # Track "No status change" - jobs stuck in same status for 10+ biz days
        if status not in ['offer', 'rejected'] and biz_days >= 10:
            no_movement_jobs.append({
                "company": company, "status": status, "biz_days": biz_days, "is_priority": is_priority
            })
        
        # Follow-up tracking
        follow_up_days = job.get("follow_up_days")
        if follow_up_days and status not in ['offer', 'rejected']:
            if days_old >= int(follow_up_days):
                overdue_by = days_old - int(follow_up_days)
                follow_ups_needed.append({
                    "company": company, "status": status, 
                    "overdue_days": overdue_by, "biz_days": biz_days,
                    "is_priority": is_priority
                })
        
        # Progression tracking
        early_stages = ['applied', 'recruiter_screening']
        advanced_stages_list = ['system_design', 'behavioural', 'hiring_manager', 'final_round', 'offer']
        
        if status in advanced_stages_list:
            stage_progression['advanced'] += 1
        elif status in early_stages and biz_days >= 15:
            stage_progression['stalled'] += 1
    
    total = len(jobs)
    active_jobs = total - stage_counts['offer'] - stage_counts['rejected']
    
    # === STRATEGIC INSIGHTS ===
    
    # 1. "No status change" insights
    if no_movement_jobs:
        no_movement_jobs.sort(key=lambda x: (-x['is_priority'], -x['biz_days']))
        top_stalled = no_movement_jobs[:3]
        for job in top_stalled:
            status_label = job['status'].replace('_', ' ').title()
            if job['is_priority']:
                strategic_insights.append(f"⭐ {job['company']}: No status change for {job['biz_days']} days at '{status_label}' (Priority)")
            else:
                strategic_insights.append(f"📋 {job['company']}: No movement for {job['biz_days']} days at '{status_label}'")
        
        # Summary if many stalled
        if len(no_movement_jobs) > 3:
            remaining = len(no_movement_jobs) - 3
            strategic_insights.append(f"📊 {remaining} other applications also showing no recent activity")
    
    # 2. Pipeline health and progression rates
    if total >= 3 and active_jobs > 0:
        advanced = stage_progression['advanced']
        if advanced > 0:
            advanced_rate = (advanced / active_jobs) * 100
            if advanced_rate >= 30:
                strategic_insights.append(f"📈 Strong momentum: {advanced_rate:.0f}% of active applications in advanced stages")
            elif advanced_rate >= 15:
                strategic_insights.append(f"📊 Steady progress: {advanced} applications advancing through interview stages")
        
        if stage_progression['stalled'] >= 2:
            strategic_insights.append(f"⚠️ {stage_progression['stalled']} applications stalled 15+ days in early stages—consider targeted follow-ups")
    
    # 3. Offers and final rounds
    if stage_counts['offer'] > 0:
        strategic_insights.append(f"🎉 {stage_counts['offer']} offer{'s' if stage_counts['offer'] > 1 else ''} received! Consider negotiation—73% of employers expect it")
    
    if stage_counts['final_round'] > 0:
        strategic_insights.append(f"🌟 {stage_counts['final_round']} in final rounds—prepare team fit and compensation discussions")
    
    if stage_counts['hiring_manager'] > 0:
        strategic_insights.append(f"💼 {stage_counts['hiring_manager']} at hiring manager stage—research recent company initiatives")
    
    # 4. Priority jobs summary
    if priority_jobs:
        priority_advanced = sum(1 for p in priority_jobs if p['status'] in ['phone_screen', 'coding_round_1', 'coding_round_2', 'system_design', 'behavioural', 'hiring_manager', 'final_round'])
        if priority_advanced > 0:
            strategic_insights.append(f"⭐ {priority_advanced} of {len(priority_jobs)} priority jobs actively advancing")
    
    # 5. Rejection analysis
    if stage_counts['rejected'] > 0 and total >= 5:
        rejection_rate = (stage_counts['rejected'] / total) * 100
        if rejection_rate > 50:
            strategic_insights.append(f"💡 {rejection_rate:.0f}% rejection rate—consider refining resume keywords or seeking referrals")
    
    # === FOLLOW-UP REMINDERS ===
    
    if follow_ups_needed:
        # Sort: priority first, then by overdue days
        follow_ups_needed.sort(key=lambda x: (-x['is_priority'], -x['overdue_days']))
        
        # Show top 4 follow-ups with aging info
        for fu in follow_ups_needed[:4]:
            status_label = fu['status'].replace('_', ' ').title()
            priority_marker = "⭐ " if fu['is_priority'] else ""
            follow_up_reminders.append(
                f"{priority_marker}{fu['company']} • {fu['overdue_days']}d overdue • {fu['biz_days']} days at {status_label}"
            )
        
        # Summary if more follow-ups
        if len(follow_ups_needed) > 4:
            remaining = len(follow_ups_needed) - 4
            follow_up_reminders.append(f"+ {remaining} more application{'s' if remaining > 1 else ''} need{'s' if remaining == 1 else ''} follow-up")
    
    # Default messages
    if not strategic_insights:
        strategic_insights.append("🚀 Add applications with follow-up dates to receive strategic insights!")
    
    if not follow_up_reminders:
        follow_up_reminders.append("✅ No follow-ups due—you're on track!")
    
    return {
        "insights": strategic_insights,
        "follow_ups": follow_up_reminders
    }

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

@api_router.put("/user/display-name")
async def update_display_name(data: DisplayNameUpdate, current_user: User = Depends(get_current_user)):
    """Update the user's preferred display name"""
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"preferred_display_name": data.preferred_display_name}}
    )
    
    return {"message": "Display name updated", "preferred_display_name": data.preferred_display_name}

@api_router.put("/user/communication-email")
async def update_communication_email(data: CommunicationEmailUpdate, current_user: User = Depends(get_current_user)):
    """Update the user's communication email for weekly/monthly summaries"""
    import re
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_regex, data.communication_email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"communication_email": data.communication_email}}
    )
    
    return {"message": "Communication email updated", "communication_email": data.communication_email}

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

@api_router.get("/email-summary/weekly")
async def get_weekly_email_summary(current_user: User = Depends(get_current_user)):
    """Generate weekly email summary data for the user to send via email client"""
    from datetime import datetime, timedelta
    
    # Calculate the date range for the week (last 7 days)
    today = datetime.now(timezone.utc)
    week_start = today - timedelta(days=7)
    
    # Format dates for subject line
    from_date = week_start.strftime("%b-%d-%Y")
    to_date = today.strftime("%b-%d-%Y")
    
    # Get jobs applied in the last week
    jobs = await db.job_applications.find({"user_id": current_user.user_id}).to_list(1000)
    
    # Filter jobs applied in the last week
    weekly_jobs = []
    for job in jobs:
        date_applied = job.get("date_applied")
        if date_applied:
            if isinstance(date_applied, str):
                date_applied = datetime.fromisoformat(date_applied.replace("Z", "+00:00"))
            elif isinstance(date_applied, datetime):
                if date_applied.tzinfo is None:
                    date_applied = date_applied.replace(tzinfo=timezone.utc)
            
            if week_start <= date_applied <= today:
                weekly_jobs.append(job)
    
    # Get all jobs for overall stats
    all_jobs = jobs
    
    # Calculate weekly stats
    weekly_applications = len(jobs)
    status_counts = {}
    for job in jobs:
        status = job.get("status", "applied")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Get follow-up reminders (jobs applied > 7 days ago without response)
    follow_ups = [j for j in all_jobs if j.get("status") == "applied" and 
                  j.get("date_applied") and 
                  (today - datetime.fromisoformat(j["date_applied"].replace("Z", "+00:00"))).days > 7]
    
    # Build email content
    user_name = current_user.preferred_display_name or current_user.name or "Job Seeker"
    subject = f"Weekly Summary for the week {from_date} - {to_date}"
    
    # Professional email body
    body = f"""Hi {user_name},

Hope you're having a great week! Here's your weekly job search summary.

📊 WEEKLY METRICS ({from_date} - {to_date})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Applications Submitted: {weekly_applications}
• Interviews Scheduled: {status_counts.get('interviewing', 0)}
• Final Rounds: {status_counts.get('final_round', 0)}
• Offers Received: {status_counts.get('offer', 0)}
• Rejections: {status_counts.get('rejected', 0)}

📋 APPLICATIONS THIS WEEK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    for job in jobs[:10]:  # Limit to 10 for email readability
        body += f"• {job.get('company_name', 'N/A')} - {job.get('position', 'N/A')} ({job.get('status', 'applied').replace('_', ' ').title()})\n"
    
    if len(jobs) > 10:
        body += f"...and {len(jobs) - 10} more\n"
    
    body += f"""
⏰ FOLLOW-UP REMINDERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have {len(follow_ups)} application(s) that may need follow-up.
"""
    
    for reminder in follow_ups[:5]:
        days_ago = (today - datetime.fromisoformat(reminder["date_applied"].replace("Z", "+00:00"))).days
        body += f"• {reminder.get('company_name', 'N/A')} - {reminder.get('position', 'N/A')} ({days_ago} days ago)\n"
    
    body += f"""
💡 KEY INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total Active Applications: {len([j for j in all_jobs if j.get('status') not in ['rejected', 'withdrawn']])}
• Response Rate: {round((len([j for j in all_jobs if j.get('status') != 'applied']) / len(all_jobs) * 100) if all_jobs else 0, 1)}%
• Keep up the momentum!

Best of luck with your job search!

Best regards,
JobTracker Team

---
This summary was generated automatically based on your JobTracker data.
"""
    
    return {
        "subject": subject,
        "body": body,
        "to_email": current_user.communication_email or current_user.email,
        "from_date": from_date,
        "to_date": to_date,
        "stats": {
            "weekly_applications": weekly_applications,
            "status_counts": status_counts,
            "follow_ups_count": len(follow_ups)
        }
    }

@api_router.get("/email-summary/monthly")
async def get_monthly_email_summary(current_user: User = Depends(get_current_user)):
    """Generate monthly email summary data for the user to send via email client"""
    from datetime import datetime
    import calendar
    
    today = datetime.now(timezone.utc)
    
    # Get first and last day of current month
    first_day = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_day_num = calendar.monthrange(today.year, today.month)[1]
    last_day = today.replace(day=last_day_num, hour=23, minute=59, second=59)
    
    # Format for subject
    month_year = today.strftime("%b-%Y")
    
    # Get all jobs
    all_jobs = await db.job_applications.find({"user_id": current_user.user_id}).to_list(1000)
    
    # Get jobs applied this month
    monthly_jobs = []
    for j in all_jobs:
        date_applied = j.get("date_applied")
        if date_applied:
            if isinstance(date_applied, str):
                date_applied = datetime.fromisoformat(date_applied.replace("Z", "+00:00"))
            elif isinstance(date_applied, datetime):
                if date_applied.tzinfo is None:
                    date_applied = date_applied.replace(tzinfo=timezone.utc)
            
            if date_applied >= first_day:
                monthly_jobs.append(j)
    
    # Calculate comprehensive stats
    total_applications = len(all_jobs)
    monthly_applications = len(monthly_jobs)
    
    # Status breakdown
    status_counts = {}
    for job in all_jobs:
        status = job.get("status", "applied")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Work mode breakdown
    work_mode_counts = {}
    for job in all_jobs:
        mode = job.get("work_mode", "unknown")
        work_mode_counts[mode] = work_mode_counts.get(mode, 0) + 1
    
    # Salary stats
    salaries = [j.get("salary_range", {}) for j in all_jobs if j.get("salary_range")]
    avg_min_salary = sum(s.get("min", 0) for s in salaries) / len(salaries) if salaries else 0
    avg_max_salary = sum(s.get("max", 0) for s in salaries) / len(salaries) if salaries else 0
    
    # Top companies applied to
    company_counts = {}
    for job in all_jobs:
        company = job.get("company_name", "Unknown")
        company_counts[company] = company_counts.get(company, 0) + 1
    top_companies = sorted(company_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Follow-ups
    follow_ups = [j for j in all_jobs if j.get("status") == "applied" and 
                  j.get("date_applied") and 
                  (today - datetime.fromisoformat(j["date_applied"].replace("Z", "+00:00"))).days > 7]
    
    user_name = current_user.preferred_display_name or current_user.name or "Job Seeker"
    subject = f"Monthly Summary for {month_year}"
    
    # Professional email body with visual elements (using ASCII art for email compatibility)
    body = f"""Hi {user_name},

Here's your comprehensive monthly job search report for {month_year}. Let's review your progress!

╔══════════════════════════════════════════════════════════════════╗
║                    📊 MONTHLY OVERVIEW                           ║
╠══════════════════════════════════════════════════════════════════╣
║  Total Applications (All Time): {total_applications:<30}║
║  Applications This Month:       {monthly_applications:<30}║
║  Active Applications:           {status_counts.get('applied', 0) + status_counts.get('interviewing', 0) + status_counts.get('final_round', 0):<30}║
╚══════════════════════════════════════════════════════════════════╝

📈 APPLICATION STATUS BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    status_labels = {
        'applied': '📝 Applied',
        'interviewing': '🎯 Interviewing', 
        'final_round': '🏆 Final Round',
        'offer': '✅ Offers',
        'rejected': '❌ Rejected',
        'withdrawn': '🚫 Withdrawn'
    }
    
    for status, label in status_labels.items():
        count = status_counts.get(status, 0)
        bar = "█" * min(count, 20)
        body += f"{label:<20} {bar} {count}\n"
    
    body += f"""
🏢 WORK MODE DISTRIBUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    mode_labels = {'remote': '🏠 Remote', 'hybrid': '🔄 Hybrid', 'onsite': '🏢 On-site'}
    for mode, label in mode_labels.items():
        count = work_mode_counts.get(mode, 0)
        percentage = round(count / total_applications * 100, 1) if total_applications else 0
        bar = "▓" * int(percentage / 5)
        body += f"{label:<15} {bar} {count} ({percentage}%)\n"
    
    body += f"""
💰 SALARY INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Average Min Salary: ${avg_min_salary:,.0f}
• Average Max Salary: ${avg_max_salary:,.0f}
• Salary Range: ${avg_min_salary:,.0f} - ${avg_max_salary:,.0f}

🏆 TOP COMPANIES APPLIED TO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    for i, (company, count) in enumerate(top_companies, 1):
        body += f"{i}. {company} ({count} application{'s' if count > 1 else ''})\n"
    
    body += f"""
⏰ FOLLOW-UP REMINDERS ({len(follow_ups)} pending)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    for reminder in follow_ups[:5]:
        days_ago = (today - datetime.fromisoformat(reminder["date_applied"].replace("Z", "+00:00"))).days
        body += f"• {reminder.get('company_name', 'N/A')} - {reminder.get('position', 'N/A')} ({days_ago} days)\n"
    
    if len(follow_ups) > 5:
        body += f"...and {len(follow_ups) - 5} more applications need follow-up\n"
    
    # Calculate response rate and add insights
    responded = len([j for j in all_jobs if j.get('status') != 'applied'])
    response_rate = round(responded / total_applications * 100, 1) if total_applications else 0
    
    body += f"""
💡 KEY INSIGHTS & RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Response Rate: {response_rate}%
• Interview Conversion: {round(status_counts.get('interviewing', 0) / total_applications * 100, 1) if total_applications else 0}%
• Offer Rate: {round(status_counts.get('offer', 0) / total_applications * 100, 1) if total_applications else 0}%

"""
    
    if response_rate < 20:
        body += "💡 Consider optimizing your resume and cover letters to improve response rates.\n"
    if status_counts.get('interviewing', 0) > 0 and status_counts.get('offer', 0) == 0:
        body += "💡 Practice interview skills to convert more interviews to offers.\n"
    if len(follow_ups) > 5:
        body += "💡 Many applications are awaiting response - consider sending follow-up emails.\n"
    
    body += f"""
Keep up the great work! Every application brings you closer to your goal.

Best regards,
JobTracker Team

---
This monthly summary was generated automatically based on your JobTracker data.
For questions or feedback, please contact support.
"""
    
    return {
        "subject": subject,
        "body": body,
        "to_email": current_user.communication_email or current_user.email,
        "month_year": month_year,
        "stats": {
            "total_applications": total_applications,
            "monthly_applications": monthly_applications,
            "status_counts": status_counts,
            "work_mode_counts": work_mode_counts,
            "avg_salary_range": {"min": avg_min_salary, "max": avg_max_salary},
            "response_rate": response_rate,
            "follow_ups_count": len(follow_ups)
        }
    }

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
