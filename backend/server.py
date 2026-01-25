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
    # Get all jobs for detailed analysis
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    insights = []
    
    # Calculate time-based stats
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    
    week_count = 0
    month_count = 0
    follow_ups_needed = []
    priority_jobs = []
    aging_jobs = []
    
    # Stage counts for progress tracking
    stage_counts = {
        'applied': 0,
        'recruiter_screening': 0,
        'phone_screen': 0,
        'coding_round_1': 0,
        'coding_round_2': 0,
        'system_design': 0,
        'behavioural': 0,
        'hiring_manager': 0,
        'final_round': 0,
        'offer': 0,
        'rejected': 0
    }
    
    for job in jobs:
        # Count stages
        status = job.get("status", "applied")
        if status in stage_counts:
            stage_counts[status] += 1
        
        # Check for priority jobs
        if job.get("is_priority", False):
            priority_jobs.append({
                "company": job.get("company_name", "Unknown"),
                "position": job.get("position", ""),
                "status": status
            })
        
        # Time-based counting
        created_at = job.get("created_at")
        date_applied = job.get("date_applied")
        aging_date = date_applied if date_applied else created_at
        
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            if created_at >= seven_days_ago:
                week_count += 1
            if created_at >= thirty_days_ago:
                month_count += 1
        
        # Check for aging applications (over 14 days old and still in early stages)
        if aging_date:
            if isinstance(aging_date, str):
                aging_date = datetime.fromisoformat(aging_date.replace('Z', '+00:00'))
            if aging_date.tzinfo is None:
                aging_date = aging_date.replace(tzinfo=timezone.utc)
            
            days_old = (now - aging_date).days
            
            # Applications older than 14 days in early stages
            if days_old >= 14 and status in ['applied', 'recruiter_screening', 'phone_screen']:
                aging_jobs.append({
                    "company": job.get("company_name", "Unknown"),
                    "position": job.get("position", ""),
                    "days_old": days_old,
                    "status": status
                })
        
        # Check for follow-ups needed
        follow_up_days = job.get("follow_up_days")
        if follow_up_days and aging_date and status not in ['offer', 'rejected']:
            days_since = (now - aging_date).days
            if days_since >= follow_up_days:
                follow_ups_needed.append(job.get("company_name", "Unknown"))
    
    total = len(jobs)
    
    # Priority jobs insights (highest priority)
    if priority_jobs:
        priority_count = len(priority_jobs)
        insights.append(f"⭐ You have {priority_count} priority job{'s' if priority_count != 1 else ''} marked for focused attention.")
        
        # Mention specific priority jobs
        if priority_count <= 3:
            priority_names = [f"{j['company']} ({j['position']})" for j in priority_jobs[:3]]
            insights.append(f"🎯 Priority: {', '.join(priority_names)}")
    
    # Weekly/Monthly application insights
    if week_count > 0:
        insights.append(f"📊 You applied to {week_count} job{'s' if week_count != 1 else ''} this week.")
    if month_count > 0:
        insights.append(f"📅 {month_count} application{'s' if month_count != 1 else ''} submitted this month.")
    
    # Aging applications - subtle professional suggestions
    if aging_jobs:
        aging_jobs.sort(key=lambda x: x['days_old'], reverse=True)
        oldest_job = aging_jobs[0]
        
        if oldest_job['days_old'] >= 30:
            insights.append(f"⏳ Your application at {oldest_job['company']} has been pending for {oldest_job['days_old']} days. Consider sending a polite follow-up to demonstrate continued interest.")
        elif oldest_job['days_old'] >= 21:
            insights.append(f"📬 {oldest_job['company']} application is {oldest_job['days_old']} days old. A follow-up email might help move the process along.")
        elif oldest_job['days_old'] >= 14:
            insights.append(f"💼 Your {oldest_job['company']} application ({oldest_job['days_old']} days) could benefit from a gentle follow-up check-in.")
        
        # If multiple jobs are aging
        if len(aging_jobs) > 3:
            insights.append(f"📋 {len(aging_jobs)} applications are awaiting response for 14+ days. Consider following up on your top priorities.")
    
    # Follow-up reminders
    if follow_ups_needed:
        if len(follow_ups_needed) <= 3:
            companies = ", ".join(follow_ups_needed)
            insights.append(f"⏰ Follow-up needed: {companies}")
        else:
            insights.append(f"⏰ {len(follow_ups_needed)} applications need follow-up!")
    
    # Interview stage progress insights
    advanced_stages = stage_counts['phone_screen'] + stage_counts['coding_round_1'] + stage_counts['coding_round_2'] + stage_counts['system_design'] + stage_counts['behavioural'] + stage_counts['hiring_manager'] + stage_counts['final_round']
    
    if stage_counts['offer'] > 0:
        insights.append(f"🎉 Congratulations! You have {stage_counts['offer']} offer{'s' if stage_counts['offer'] != 1 else ''}!")
    
    if stage_counts['final_round'] > 0:
        insights.append(f"🌟 {stage_counts['final_round']} application{'s are' if stage_counts['final_round'] != 1 else ' is'} in final round - great progress!")
    
    if stage_counts['hiring_manager'] > 0:
        insights.append(f"💼 {stage_counts['hiring_manager']} at hiring manager stage - you're advancing well!")
    
    if advanced_stages > 0 and stage_counts['offer'] == 0 and stage_counts['final_round'] == 0:
        insights.append(f"📈 {advanced_stages} application{'s have' if advanced_stages != 1 else ' has'} progressed past initial screening.")
    
    if stage_counts['recruiter_screening'] > 0:
        insights.append(f"👀 {stage_counts['recruiter_screening']} application{'s' if stage_counts['recruiter_screening'] != 1 else ''} under recruiter review.")
    
    # Calculate success rate if there's enough data
    if total >= 5:
        progress_rate = ((total - stage_counts['applied'] - stage_counts['rejected']) / total) * 100
        if progress_rate > 50:
            insights.append(f"✨ {progress_rate:.0f}% of your applications are progressing - excellent conversion!")
    
    # Default insight if nothing else
    if not insights:
        insights.append("🚀 Start tracking your applications to get personalized insights!")
    
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
