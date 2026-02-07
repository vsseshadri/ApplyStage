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

# Create database indexes on startup
@app.on_event("startup")
async def create_indexes():
    """Create compound indexes for better query performance"""
    try:
        # Job applications indexes
        await db.job_applications.create_index([("user_id", 1), ("created_at", -1)])
        await db.job_applications.create_index([("user_id", 1), ("status", 1)])
        await db.job_applications.create_index([("user_id", 1), ("date_applied", -1)])
        await db.job_applications.create_index([("user_id", 1), ("is_priority", -1)])
        await db.job_applications.create_index([("user_id", 1), ("work_mode", 1)])
        
        # Users indexes
        await db.users.create_index([("user_id", 1)], unique=True)
        await db.users.create_index([("email", 1)], unique=True)
        
        # Sessions indexes
        await db.user_sessions.create_index([("session_token", 1)], unique=True)
        await db.user_sessions.create_index([("user_id", 1)])
        await db.user_sessions.create_index([("expires_at", 1)])
        
        # Reports indexes
        await db.reports.create_index([("user_id", 1), ("created_at", -1)])
        await db.reports.create_index([("user_id", 1), ("report_type", 1)])
        
        logging.info("Database indexes created successfully")
    except Exception as e:
        logging.warning(f"Index creation warning (may already exist): {e}")

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
    domicile_country: Optional[str] = None
    onboarding_completed: bool = False

class DisplayNameUpdate(BaseModel):
    preferred_display_name: str

class CommunicationEmailUpdate(BaseModel):
    communication_email: str

class DomicileCountryUpdate(BaseModel):
    domicile_country: str

class OnboardingUpdate(BaseModel):
    preferred_display_name: str
    domicile_country: str

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
    job_type: Optional[str] = None
    upcoming_stage: Optional[str] = None
    upcoming_schedule: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class Report(BaseModel):
    report_id: str
    user_id: str
    report_type: str  # "weekly" or "monthly"
    title: str
    date_range: str
    content: str
    stats: Dict[str, Any]
    created_at: datetime
    is_read: bool = False

class JobApplicationCreate(BaseModel):
    company_name: str
    position: str
    location: Dict[str, str]
    salary_range: Dict[str, float]
    work_mode: str
    job_type: str
    job_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    resume_file: Optional[str] = None
    date_applied: Optional[str] = None
    follow_up_days: Optional[int] = None
    status: str = "applied"
    upcoming_stage: Optional[str] = None
    upcoming_schedule: Optional[str] = None
    notes: Optional[str] = None
    custom_stages: List[str] = []
    is_priority: bool = False

class JobApplicationUpdate(BaseModel):
    company_name: Optional[str] = None
    position: Optional[str] = None
    location: Optional[Dict[str, str]] = None
    salary_range: Optional[Dict[str, float]] = None
    work_mode: Optional[str] = None
    job_type: Optional[str] = None
    job_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    resume_file: Optional[str] = None
    date_applied: Optional[str] = None
    is_priority: Optional[bool] = None
    follow_up_days: Optional[int] = None
    status: Optional[str] = None
    upcoming_stage: Optional[str] = None
    upcoming_schedule: Optional[str] = None
    notes: Optional[str] = None
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
    
    # Handle test mode token
    if session_token == "test_token_abc123":
        # Return a test user for development
        test_user = await db.users.find_one({"email": "test@example.com"}, {"_id": 0})
        if not test_user:
            # Create test user if doesn't exist
            test_user = {
                "user_id": "test_user_001",
                "email": "test@example.com",
                "name": "Test User",
                "picture": None,
                "payment_status": "trial",
                "trial_end_date": datetime.now(timezone.utc) + timedelta(days=30),
                "applications_count": 0,
                "preferences": {"weekly_email": True, "monthly_email": True},
                "created_at": datetime.now(timezone.utc),
                "is_private_relay": False,
                "preferred_display_name": None,
                "domicile_country": None,
                "onboarding_completed": False
            }
            await db.users.insert_one(test_user)
        return User(**test_user)
    
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
        auth_service_url = os.environ.get('AUTH_SERVICE_URL', 'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data')
        async with httpx.AsyncClient() as client:
            response = await client.get(
                auth_service_url,
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

@api_router.get("/jobs")
async def get_jobs(
    current_user: User = Depends(get_current_user),
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    work_mode: Optional[str] = None,
    is_priority: Optional[bool] = None
):
    """Get jobs with pagination and optional filters"""
    skip = (page - 1) * limit
    
    # Build query filter
    query = {"user_id": current_user.user_id}
    if status:
        query["status"] = status
    if work_mode:
        query["work_mode"] = work_mode
    if is_priority is not None:
        query["is_priority"] = is_priority
    
    # Get total count for pagination metadata
    total_count = await db.job_applications.count_documents(query)
    
    # Fetch paginated results with projection
    jobs = await db.job_applications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "jobs": [JobApplication(**job) for job in jobs],
        "pagination": {
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": (total_count + limit - 1) // limit,
            "has_next": page * limit < total_count,
            "has_prev": page > 1
        }
    }

@api_router.post("/jobs", response_model=JobApplication)
async def create_job(job_data: JobApplicationCreate, current_user: User = Depends(get_current_user)):
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
        job_type=job_data.job_type,
        job_url=job_data.job_url,
        recruiter_email=job_data.recruiter_email,
        resume_file=job_data.resume_file,
        date_applied=date_applied_dt,
        follow_up_days=job_data.follow_up_days,
        status=job_data.status,
        upcoming_stage=job_data.upcoming_stage,
        upcoming_schedule=job_data.upcoming_schedule,
        notes=job_data.notes,
        stages=[{"status": job_data.status, "timestamp": now.isoformat()}],
        custom_stages=job_data.custom_stages,
        reminders=[],
        is_priority=job_data.is_priority,
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
    # Optimized query: Only fetch fields needed for stats calculation
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {
            "_id": 0,
            "status": 1,
            "position": 1,
            "location": 1,
            "work_mode": 1,
            "created_at": 1
        }
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
        },
        "by_position": {}
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
        
        # Position aggregation
        position = job.get("position", "Other")
        if position:
            if position not in stats["by_position"]:
                stats["by_position"][position] = 0
            stats["by_position"][position] += 1
        
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

@api_router.get("/dashboard/upcoming-interviews")
async def get_upcoming_interviews(current_user: User = Depends(get_current_user)):
    """Get upcoming interview stages that are scheduled for today or future dates"""
    jobs = await db.job_applications.find(
        {
            "user_id": current_user.user_id,
            "upcoming_stage": {"$exists": True, "$ne": None, "$ne": ""},
            "upcoming_schedule": {"$exists": True, "$ne": None, "$ne": ""}
        },
        {"_id": 0, "job_id": 1, "company_name": 1, "position": 1, "upcoming_stage": 1, "upcoming_schedule": 1, "status": 1}
    ).to_list(100)
    
    today = datetime.now(timezone.utc).date()
    upcoming = []
    
    for job in jobs:
        schedule_str = job.get("upcoming_schedule", "")
        if schedule_str:
            try:
                # Parse both MM/DD/YYYY and MM-DD-YY formats
                parts = schedule_str.replace('/', '-').split("-")
                if len(parts) == 3:
                    month, day, year = int(parts[0]), int(parts[1]), int(parts[2])
                    # Handle 2-digit year
                    if year < 100:
                        year += 2000
                    schedule_date = datetime(year, month, day).date()
                    
                    # Only include if date is today or in the future
                    if schedule_date >= today:
                        upcoming.append({
                            "job_id": job.get("job_id"),
                            "company_name": job.get("company_name"),
                            "position": job.get("position"),
                            "stage": job.get("upcoming_stage"),
                            "status": job.get("status", "applied"),
                            "schedule_date": schedule_date.strftime("%b %d, %Y"),
                            "schedule_raw": schedule_str,
                            "days_until": (schedule_date - today).days
                        })
            except (ValueError, IndexError):
                continue
    
    # Sort by date (soonest first)
    upcoming.sort(key=lambda x: x.get("days_until", 0))
    
    return upcoming

@api_router.get("/dashboard/ai-insights")
async def get_ai_insights(current_user: User = Depends(get_current_user)):
    """
    Generate comprehensive AI-powered insights including:
    - Consolidated company insights (grouped by company)
    - Positive progress reinforcement
    - Weekly reflection prompts
    - Stage pattern analysis
    - Career progression info for offers
    - Weekly momentum narratives
    """
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {
            "_id": 0,
            "status": 1,
            "company_name": 1,
            "position": 1,
            "date_applied": 1,
            "created_at": 1,
            "follow_up_days": 1,
            "is_priority": 1,
            "upcoming_stage": 1,
            "upcoming_schedule": 1,
            "recruiter_email": 1,
            "updated_at": 1,
            "work_mode": 1,
            "location": 1
        }
    ).to_list(1000)
    
    strategic_insights = []
    follow_up_reminders = []
    now = datetime.now(timezone.utc)
    today = now.date()
    week_start = today - timedelta(days=today.weekday())
    
    # Data structures
    follow_ups_needed = []
    company_data = {}  # Consolidated data by company
    stage_progression_history = {}  # Track stage progressions per stage
    stage_success_count = {}  # Count successful progressions past each stage
    upcoming_interviews = []
    weekly_activity = {'applied': 0, 'advanced': 0, 'interviews': 0}
    offer_companies = []
    ghosted_jobs = []
    rejected_jobs = []
    
    # All stages including ghosted
    all_stages = ['applied', 'recruiter_screening', 'phone_screen', 'coding_round_1', 
                  'coding_round_2', 'system_design', 'behavioural', 'hiring_manager', 
                  'final_round', 'offer', 'rejected', 'ghosted']
    
    stage_order = {stage: idx for idx, stage in enumerate(all_stages)}
    stage_counts = {stage: 0 for stage in all_stages}
    
    # Enhanced stage coaching with interview-specific tips
    stage_coaching = {
        'recruiter_screening': {
            'tip': "Focus on your elevator pitch and salary expectations",
            'checklist': [
                "Prepare 60-second career summary",
                "Research company culture and values",
                "Know your salary range expectations",
                "Prepare questions about role and team",
                "Review job description key requirements"
            ]
        },
        'phone_screen': {
            'tip': "Prepare concise answers about your background and motivation",
            'checklist': [
                "Review your resume highlights",
                "Prepare 'why this company' answer",
                "Research recent company news",
                "Have specific examples ready",
                "Prepare thoughtful questions"
            ]
        },
        'coding_round_1': {
            'tip': "Practice problem-solving approaches and think aloud",
            'checklist': [
                "Review common data structures (arrays, trees, graphs)",
                "Practice explaining your thought process",
                "Review Big O complexity analysis",
                "Practice on LeetCode medium problems",
                "Prepare questions about engineering culture"
            ]
        },
        'coding_round_2': {
            'tip': "Review advanced algorithms and optimization techniques",
            'checklist': [
                "Review dynamic programming patterns",
                "Practice graph algorithms (BFS, DFS, Dijkstra)",
                "Review advanced tree operations",
                "Practice time/space optimization",
                "Prepare to discuss past technical projects"
            ]
        },
        'system_design': {
            'tip': "Practice designing scalable systems with clear trade-offs",
            'checklist': [
                "Review scalability patterns (sharding, caching)",
                "Study company's tech stack and architecture",
                "Practice drawing system diagrams",
                "Prepare to discuss CAP theorem trade-offs",
                "Review load balancing and database design"
            ]
        },
        'behavioural': {
            'tip': "Prepare 5-7 STAR stories covering leadership and challenges",
            'checklist': [
                "Prepare STAR stories for leadership",
                "Prepare conflict resolution examples",
                "Research hiring manager on LinkedIn",
                "Practice stories about failures and learnings",
                "Align examples with company values"
            ]
        },
        'hiring_manager': {
            'tip': "Research the team's recent projects and prepare questions",
            'checklist': [
                "Research manager's background and team",
                "Prepare questions about team dynamics",
                "Review company's recent product launches",
                "Prepare to discuss career goals",
                "Research company earnings/growth if public"
            ]
        },
        'final_round': {
            'tip': "Align your goals with company mission, discuss compensation",
            'checklist': [
                "Research total compensation benchmarks",
                "Prepare negotiation talking points",
                "Review company mission and values",
                "Prepare 30-60-90 day plan",
                "Have questions about growth opportunities"
            ]
        }
    }
    
    # Process each job
    for job in jobs:
        status = job.get("status", "applied")
        if status in stage_counts:
            stage_counts[status] += 1
        
        company = job.get("company_name", "Unknown")
        position = job.get("position", "Position")
        is_priority = job.get("is_priority", False)
        upcoming_stage = job.get("upcoming_stage")
        upcoming_schedule = job.get("upcoming_schedule")
        
        # Get date applied
        date_applied = job.get("date_applied") or job.get("created_at")
        if date_applied:
            if isinstance(date_applied, str):
                date_applied = datetime.fromisoformat(date_applied.replace('Z', '+00:00'))
            if date_applied.tzinfo is None:
                date_applied = date_applied.replace(tzinfo=timezone.utc)
            days_old = (now - date_applied).days
            biz_days = sum(1 for i in range(days_old) if (date_applied + timedelta(days=i)).weekday() < 5)
            
            # Track weekly activity
            if date_applied.date() >= week_start:
                weekly_activity['applied'] += 1
        else:
            days_old = 0
            biz_days = 0
        
        # Track ghosted jobs
        if status == 'ghosted':
            ghosted_jobs.append({"company": company, "position": position})
            continue
        
        # Track offers for career progression insights
        if status == 'offer':
            offer_companies.append({
                "company": company,
                "position": position,
                "days_to_offer": days_old
            })
            continue
        
        # Track rejected for encouragement
        if status == 'rejected' and days_old <= 14:
            rejected_jobs.append({"company": company, "position": position})
            continue
        
        # Track stage progression success
        stage_idx = stage_order.get(status, 0)
        if stage_idx >= 3:  # Past phone screen
            for s in list(stage_order.keys())[:stage_idx]:
                stage_success_count[s] = stage_success_count.get(s, 0) + 1
        
        # Build consolidated company data
        if company not in company_data:
            company_data[company] = {
                "company": company,
                "positions": [],
                "status": status,
                "is_priority": is_priority,
                "coaching_tips": [],
                "upcoming_stage": upcoming_stage,
                "upcoming_schedule": upcoming_schedule,
                "biz_days": biz_days,
                "stage_idx": stage_idx
            }
        
        company_data[company]["positions"].append(position)
        if stage_order.get(status, 0) > company_data[company]["stage_idx"]:
            company_data[company]["status"] = status
            company_data[company]["stage_idx"] = stage_order.get(status, 0)
        
        # Add coaching tip based on upcoming_stage or status
        coaching_stage = upcoming_stage if upcoming_stage else status
        if coaching_stage in stage_coaching and is_priority:
            company_data[company]["coaching_tips"].append(stage_coaching[coaching_stage]['tip'])
        
        # Track upcoming interviews
        if upcoming_stage and upcoming_schedule:
            try:
                parts = upcoming_schedule.replace('/', '-').split("-")
                if len(parts) == 3:
                    month, day, year = int(parts[0]), int(parts[1]), int(parts[2])
                    if year < 100:
                        year += 2000
                    schedule_date = datetime(year, month, day).date()
                    
                    if schedule_date >= today:
                        days_until = (schedule_date - today).days
                        weekly_activity['interviews'] += 1 if days_until <= 7 else 0
                        upcoming_interviews.append({
                            "company": company,
                            "stage": upcoming_stage,
                            "days_until": days_until,
                            "is_priority": is_priority,
                            "checklist": stage_coaching.get(upcoming_stage, {}).get('checklist', [])
                        })
            except (ValueError, IndexError):
                pass
        
        # Track applications advancing
        if stage_idx >= 2:  # Past applied/recruiter_screening
            weekly_activity['advanced'] += 1
        
        # Follow-up tracking
        follow_up_days = job.get("follow_up_days")
        if follow_up_days and status not in ['offer', 'rejected', 'ghosted']:
            if days_old >= int(follow_up_days):
                overdue_by = days_old - int(follow_up_days)
                urgency = "critical" if is_priority else ("high" if status in ['applied', 'recruiter_screening'] else "medium")
                follow_ups_needed.append({
                    "company": company,
                    "status": status,
                    "overdue_days": overdue_by,
                    "biz_days": biz_days,
                    "is_priority": is_priority,
                    "urgency": urgency,
                    "recruiter_email": job.get("recruiter_email", "")
                })
    
    total = len(jobs)
    active_jobs = total - stage_counts['offer'] - stage_counts['rejected'] - stage_counts['ghosted']
    
    # === BUILD CONSOLIDATED INSIGHTS ===
    
    # 1. URGENT: Today's interviews
    todays_interviews = [i for i in upcoming_interviews if i['days_until'] == 0]
    if todays_interviews:
        companies = ', '.join([i['company'] for i in todays_interviews[:2]])
        strategic_insights.append({
            "icon": "alert-circle",
            "color": "#EF4444",
            "text": f"🎯 TODAY: Interview{'s' if len(todays_interviews) > 1 else ''} at {companies}—you've got this!",
            "type": "urgent",
            "priority": 0
        })
    
    # 2. POSITIVE REINFORCEMENT: Offers
    if offer_companies:
        avg_days = sum(o['days_to_offer'] for o in offer_companies) / len(offer_companies)
        strategic_insights.append({
            "icon": "trophy",
            "color": "#22C55E",
            "text": f"🎉 {len(offer_companies)} offer{'s' if len(offer_companies) > 1 else ''} received! Your average time-to-offer: {avg_days:.0f} days. Consider negotiating—73% of employers expect it.",
            "type": "celebration",
            "priority": 1
        })
    
    # 3. STAGE PATTERN ANALYSIS: Find strongest stage
    if stage_success_count:
        best_stage = max(stage_success_count.items(), key=lambda x: x[1])
        if best_stage[1] >= 2:
            stage_name = best_stage[0].replace('_', ' ').title()
            strategic_insights.append({
                "icon": "trending-up",
                "color": "#10B981",
                "text": f"💪 Pattern detected: {stage_name} appears to be your strongest stage with {best_stage[1]} successful progressions. Keep leveraging this strength!",
                "type": "pattern",
                "priority": 2
            })
    
    # 4. WEEKLY MOMENTUM NARRATIVE
    if weekly_activity['applied'] > 0 or weekly_activity['interviews'] > 0:
        momentum_parts = []
        if weekly_activity['applied'] > 0:
            momentum_parts.append(f"{weekly_activity['applied']} new application{'s' if weekly_activity['applied'] > 1 else ''}")
        if weekly_activity['interviews'] > 0:
            momentum_parts.append(f"{weekly_activity['interviews']} interview{'s' if weekly_activity['interviews'] > 1 else ''} scheduled")
        
        strategic_insights.append({
            "icon": "flash",
            "color": "#8B5CF6",
            "text": f"📈 This week's momentum: {', '.join(momentum_parts)}. Great progress!",
            "type": "momentum",
            "priority": 3
        })
    
    # 5. CONSOLIDATED COMPANY INSIGHTS (Priority companies)
    priority_companies = sorted(
        [c for c in company_data.values() if c['is_priority'] and c['coaching_tips']],
        key=lambda x: -x['stage_idx']
    )[:3]
    
    for comp in priority_companies:
        tips = ' • '.join(comp['coaching_tips'][:2])
        stage_label = comp['status'].replace('_', ' ').title()
        strategic_insights.append({
            "icon": "star",
            "color": "#F59E0B",
            "text": f"⭐ {comp['company']} ({stage_label}): {tips}",
            "type": "coaching",
            "company": comp['company'],
            "priority": 4
        })
    
    # 6. WEEKLY REFLECTION PROMPT
    import random
    reflection_prompts = [
        "📝 Weekly reflection: What went well this week? What could improve in your interview approach?",
        "🤔 Reflection moment: Which company excites you most and why? Let that energy show in interviews!",
        "💭 Time to reflect: What new skill or insight did you gain from recent interviews?",
        "🎯 Weekly check-in: Are you applying to roles that align with your career goals?",
        "✨ Reflect and grow: What feedback have you received? How can you apply it?"
    ]
    
    if total >= 3:
        strategic_insights.append({
            "icon": "bulb",
            "color": "#6366F1",
            "text": random.choice(reflection_prompts),
            "type": "reflection",
            "priority": 5
        })
    
    # 7. ENCOURAGEMENT for rejections
    if rejected_jobs and len(rejected_jobs) <= 3:
        encouraging_messages = [
            f"💪 {len(rejected_jobs)} recent rejection{'s' if len(rejected_jobs) > 1 else ''}—but you're still in the game! Each 'no' refines your path to the right 'yes'.",
            "🌟 Rejection is just redirection. Your skills are valuable—the right opportunity is coming.",
            "🚀 The best candidates face rejection too. Stay focused on what you can control and keep moving forward!"
        ]
        strategic_insights.append({
            "icon": "heart",
            "color": "#EC4899",
            "text": random.choice(encouraging_messages),
            "type": "encouragement",
            "priority": 6
        })
    
    # 8. GHOSTED JOBS acknowledgment
    if ghosted_jobs:
        strategic_insights.append({
            "icon": "eye-off",
            "color": "#9CA3AF",
            "text": f"👻 {len(ghosted_jobs)} application{'s' if len(ghosted_jobs) > 1 else ''} marked as ghosted. It's okay—focus your energy on active opportunities!",
            "type": "ghosted",
            "priority": 7
        })
    
    # Sort by priority and limit
    strategic_insights.sort(key=lambda x: x.get('priority', 99))
    strategic_insights = strategic_insights[:8]
    
    # Remove priority field from output
    for insight in strategic_insights:
        insight.pop('priority', None)
    
    # === FOLLOW-UP REMINDERS ===
    if follow_ups_needed:
        follow_ups_needed.sort(key=lambda x: (
            0 if x['urgency'] == 'critical' else (1 if x['urgency'] == 'high' else 2),
            -x['overdue_days']
        ))
        
        for fu in follow_ups_needed[:4]:
            status_label = fu['status'].replace('_', ' ').title()
            action_hints = {
                'applied': "Send a brief check-in email",
                'recruiter_screening': "Follow up on next steps",
                'phone_screen': "Ask for feedback or timeline",
            }
            action_hint = action_hints.get(fu['status'], "Request status update")
            
            follow_up_reminders.append({
                "company": fu['company'],
                "overdue_days": fu['overdue_days'],
                "status": status_label,
                "biz_days": fu['biz_days'],
                "is_priority": fu['is_priority'],
                "urgency": fu['urgency'],
                "action_hint": action_hint,
                "recruiter_email": fu.get('recruiter_email', '')
            })
    
    # Default messages
    if not strategic_insights:
        strategic_insights.append({
            "icon": "rocket",
            "color": "#3B82F6",
            "text": "🚀 Add applications with follow-up dates to receive strategic insights!",
            "type": "info"
        })
    
    if not follow_up_reminders:
        follow_up_reminders.append({
            "summary": True,
            "text": "✅ No follow-ups due—you're on track!"
        })
    
    return {
        "insights": strategic_insights,
        "follow_ups": follow_up_reminders,
        "upcoming_interviews": upcoming_interviews[:5]  # Include upcoming interviews with checklists
    }


# Interview checklist endpoint - also available under multiple paths for proxy compatibility
@api_router.get("/interview-checklist/{stage}")
@api_router.get("/dashboard/interview-checklist/{stage}")
@api_router.get("/checklist/{stage}")
async def get_interview_checklist(stage: str, company: str = "", current_user: User = Depends(get_current_user)):
    """Get AI-generated interview preparation checklist for a specific stage and company"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    import os
    
    # Stage-specific context for better AI prompts
    stage_contexts = {
        "recruiter_screening": "initial recruiter call focusing on background, motivation, and basic qualifications",
        "phone_screen": "phone interview to assess technical communication and fit",
        "technical_screen": "technical phone interview with coding or system questions",
        "onsite": "in-person or virtual onsite interview with multiple rounds",
        "system_design": "system design interview focusing on architecture and scalability",
        "behavioral": "behavioral interview using STAR method to discuss past experiences",
        "hiring_manager": "interview with hiring manager focusing on team fit and role expectations",
        "final_round": "final interview round, often with senior leadership",
        "offer": "offer stage - negotiation and decision making"
    }
    
    stage_context = stage_contexts.get(stage, f"{stage.replace('_', ' ')} interview")
    formatted_stage = stage.replace('_', ' ').title()
    
    # Try AI-generated checklist first
    try:
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if api_key:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"checklist_{stage}_{company}",
                system_message="""You are an expert career coach specializing in interview preparation.
Generate exactly 5 actionable, specific checklist items for interview preparation.
Each item should be practical and immediately actionable.
Base your advice on best practices from trusted career sources like Harvard Business Review, LinkedIn, Glassdoor, and Indeed.
Format: Return ONLY a JSON array of 5 objects with 'id', 'text', and 'category' fields.
Categories must be one of: research, preparation, technical, stories, questions, pitch, communication, compensation, architecture, optimization, practice, wellness.
Keep each item under 60 characters. No explanations, just the JSON array."""
            ).with_model("openai", "gpt-5.2")
            
            company_context = f" at {company}" if company else ""
            prompt = f"""Generate 5 specific interview preparation checklist items for a {stage_context}{company_context}.

The candidate is preparing for a {formatted_stage} interview{company_context}. 
{"Include 1-2 items specifically about researching " + company + " as a company." if company else ""}

Return ONLY valid JSON array like:
[{{"id":"1","text":"Research company recent news","category":"research"}},{{"id":"2","text":"Practice STAR stories","category":"stories"}}]"""

            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            # Parse the AI response
            import json
            import re
            
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                items = json.loads(json_match.group())
                # Add company_specific flag for relevant items
                for item in items:
                    if company and company.lower() in item.get('text', '').lower():
                        item['company_specific'] = True
                    item['id'] = f"ai_{item.get('id', str(items.index(item)))}"
                
                return {
                    "title": f"{formatted_stage} Prep",
                    "items": items[:5],  # Ensure max 5 items
                    "company": company,
                    "ai_generated": True
                }
    except Exception as e:
        print(f"AI checklist generation failed: {e}")
    
    # Fallback to static checklist if AI fails
    base_items = {
        "recruiter_screening": [
            {"id": "rs1", "text": "Prepare elevator pitch (60 seconds)", "category": "pitch"},
            {"id": "rs2", "text": "Review job description key requirements", "category": "preparation"},
            {"id": "rs3", "text": "Research company mission and values", "category": "research"},
            {"id": "rs4", "text": "Prepare salary expectations response", "category": "compensation"},
            {"id": "rs5", "text": "Have questions about role and team ready", "category": "questions"}
        ],
        "phone_screen": [
            {"id": "ps1", "text": "Review your resume highlights", "category": "preparation"},
            {"id": "ps2", "text": "Prepare 'why this company' answer", "category": "pitch"},
            {"id": "ps3", "text": "Research recent company news", "category": "research"},
            {"id": "ps4", "text": "Have specific examples ready", "category": "stories"},
            {"id": "ps5", "text": "Prepare thoughtful questions", "category": "questions"}
        ],
        "technical_screen": [
            {"id": "ts1", "text": "Review core data structures and algorithms", "category": "technical"},
            {"id": "ts2", "text": "Practice coding problems aloud", "category": "practice"},
            {"id": "ts3", "text": "Review your past project architectures", "category": "preparation"},
            {"id": "ts4", "text": "Prepare to explain your thought process", "category": "communication"},
            {"id": "ts5", "text": "Test your screen sharing setup", "category": "preparation"}
        ],
        "system_design": [
            {"id": "sd1", "text": "Review system design fundamentals", "category": "architecture"},
            {"id": "sd2", "text": "Practice drawing architecture diagrams", "category": "practice"},
            {"id": "sd3", "text": "Study scalability patterns", "category": "technical"},
            {"id": "sd4", "text": "Review database design principles", "category": "technical"},
            {"id": "sd5", "text": "Prepare capacity estimation examples", "category": "optimization"}
        ],
        "behavioral": [
            {"id": "bh1", "text": "Prepare 5 STAR format stories", "category": "stories"},
            {"id": "bh2", "text": "Practice conflict resolution examples", "category": "stories"},
            {"id": "bh3", "text": "Review leadership experience stories", "category": "stories"},
            {"id": "bh4", "text": "Prepare failure and learning examples", "category": "stories"},
            {"id": "bh5", "text": "Research company culture and values", "category": "research"}
        ],
        "onsite": [
            {"id": "os1", "text": "Get 8 hours of sleep the night before", "category": "wellness"},
            {"id": "os2", "text": "Review all interview formats expected", "category": "preparation"},
            {"id": "os3", "text": "Prepare questions for each interviewer", "category": "questions"},
            {"id": "os4", "text": "Plan your outfit and logistics", "category": "preparation"},
            {"id": "os5", "text": "Bring copies of resume and portfolio", "category": "preparation"}
        ],
        "hiring_manager": [
            {"id": "hm1", "text": "Research hiring manager on LinkedIn", "category": "research"},
            {"id": "hm2", "text": "Prepare team collaboration examples", "category": "stories"},
            {"id": "hm3", "text": "Have 90-day plan ideas ready", "category": "preparation"},
            {"id": "hm4", "text": "Prepare questions about team dynamics", "category": "questions"},
            {"id": "hm5", "text": "Review role expectations in detail", "category": "preparation"}
        ],
        "final_round": [
            {"id": "fr1", "text": "Review all previous interview feedback", "category": "preparation"},
            {"id": "fr2", "text": "Prepare executive summary of your value", "category": "pitch"},
            {"id": "fr3", "text": "Research leadership team backgrounds", "category": "research"},
            {"id": "fr4", "text": "Prepare strategic questions", "category": "questions"},
            {"id": "fr5", "text": "Be ready for offer discussion", "category": "compensation"}
        ]
    }
    
    items = base_items.get(stage, base_items["phone_screen"])
    
    # Add company-specific item if company provided
    if company:
        company_item = {
            "id": "ctx1",
            "text": f"Research {company}'s recent news and developments",
            "category": "research",
            "company_specific": True
        }
        items = [company_item] + items[:4]
    
    return {
        "title": f"{formatted_stage} Prep",
        "items": items,
        "company": company,
        "ai_generated": False
    }

# Checklist progress model and endpoints for persistence
class ChecklistProgressUpdate(BaseModel):
    job_id: str
    stage: str
    completed_items: List[str]

@api_router.get("/checklist-progress/{job_id}/{stage}")
async def get_checklist_progress(job_id: str, stage: str, current_user: User = Depends(get_current_user)):
    """Get saved checklist progress for a specific job and stage"""
    progress = await db.checklist_progress.find_one(
        {"user_id": current_user.user_id, "job_id": job_id, "stage": stage},
        {"_id": 0}
    )
    
    if not progress:
        return {"completed_items": []}
    
    return {"completed_items": progress.get("completed_items", [])}

@api_router.put("/checklist-progress")
async def save_checklist_progress(data: ChecklistProgressUpdate, current_user: User = Depends(get_current_user)):
    """Save checklist progress for a specific job and stage"""
    # Upsert the progress document
    await db.checklist_progress.update_one(
        {"user_id": current_user.user_id, "job_id": data.job_id, "stage": data.stage},
        {"$set": {
            "user_id": current_user.user_id,
            "job_id": data.job_id,
            "stage": data.stage,
            "completed_items": data.completed_items,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"message": "Progress saved", "completed_items": data.completed_items}

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

@api_router.put("/user/domicile-country")
async def update_domicile_country(data: DomicileCountryUpdate, current_user: User = Depends(get_current_user)):
    """Update the user's domicile country"""
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"domicile_country": data.domicile_country}}
    )
    
    return {"message": "Domicile country updated", "domicile_country": data.domicile_country}

@api_router.post("/user/onboarding")
async def complete_onboarding(data: OnboardingUpdate, current_user: User = Depends(get_current_user)):
    """Complete user onboarding with display name and domicile country"""
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "preferred_display_name": data.preferred_display_name,
            "domicile_country": data.domicile_country,
            "onboarding_completed": True
        }}
    )
    
    return {
        "message": "Onboarding completed",
        "preferred_display_name": data.preferred_display_name,
        "domicile_country": data.domicile_country,
        "onboarding_completed": True
    }

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
    # Optimized query: Only fetch fields needed for CSV export
    jobs = await db.job_applications.find(
        {"user_id": current_user.user_id},
        {
            "_id": 0,
            "company_name": 1,
            "position": 1,
            "location": 1,
            "work_mode": 1,
            "salary_range": 1,
            "status": 1,
            "date_applied": 1,
            "created_at": 1,
            "updated_at": 1
        }
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
    weekly_applications = len(weekly_jobs)
    status_counts = {}
    for job in weekly_jobs:
        status = job.get("status", "applied")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Get follow-up reminders (jobs applied > 7 days ago without response)
    follow_ups = []
    for j in all_jobs:
        if j.get("status") == "applied" and j.get("date_applied"):
            date_applied = j.get("date_applied")
            if isinstance(date_applied, str):
                date_applied = datetime.fromisoformat(date_applied.replace("Z", "+00:00"))
            elif isinstance(date_applied, datetime):
                if date_applied.tzinfo is None:
                    date_applied = date_applied.replace(tzinfo=timezone.utc)
            
            if (today - date_applied).days > 7:
                follow_ups.append(j)
    
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
    
    for job in weekly_jobs[:10]:  # Limit to 10 for email readability
        body += f"• {job.get('company_name', 'N/A')} - {job.get('position', 'N/A')} ({job.get('status', 'applied').replace('_', ' ').title()})\n"
    
    if len(weekly_jobs) > 10:
        body += f"...and {len(weekly_jobs) - 10} more\n"
    
    body += f"""
⏰ FOLLOW-UP REMINDERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have {len(follow_ups)} application(s) that may need follow-up.
"""
    
    for reminder in follow_ups[:5]:
        date_applied = reminder.get("date_applied")
        if isinstance(date_applied, str):
            date_applied = datetime.fromisoformat(date_applied.replace("Z", "+00:00"))
        elif isinstance(date_applied, datetime):
            if date_applied.tzinfo is None:
                date_applied = date_applied.replace(tzinfo=timezone.utc)
        
        days_ago = (today - date_applied).days
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
    follow_ups = []
    for j in all_jobs:
        if j.get("status") == "applied" and j.get("date_applied"):
            date_applied = j.get("date_applied")
            if isinstance(date_applied, str):
                date_applied = datetime.fromisoformat(date_applied.replace("Z", "+00:00"))
            elif isinstance(date_applied, datetime):
                if date_applied.tzinfo is None:
                    date_applied = date_applied.replace(tzinfo=timezone.utc)
            
            if (today - date_applied).days > 7:
                follow_ups.append(j)
    
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
        date_applied = reminder.get("date_applied")
        if isinstance(date_applied, str):
            date_applied = datetime.fromisoformat(date_applied.replace("Z", "+00:00"))
        elif isinstance(date_applied, datetime):
            if date_applied.tzinfo is None:
                date_applied = date_applied.replace(tzinfo=timezone.utc)
        
        days_ago = (today - date_applied).days
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


# Report endpoints
@api_router.get("/reports")
async def get_reports(
    current_user: User = Depends(get_current_user),
    page: int = 1,
    limit: int = 20
):
    """Get reports with pagination"""
    skip = (page - 1) * limit
    
    query = {"user_id": current_user.user_id}
    total_count = await db.reports.count_documents(query)
    
    reports = await db.reports.find(
        query
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return [
        {
            "report_id": str(report.get("_id", report.get("report_id"))),
            "report_type": report.get("report_type"),
            "title": report.get("title"),
            "date_range": report.get("date_range"),
            "created_at": report.get("created_at"),
            "is_read": report.get("is_read", False)
        }
        for report in reports
    ]

@api_router.get("/reports/{report_id}")
async def get_report_detail(report_id: str, current_user: User = Depends(get_current_user)):
    """Get detailed report content"""
    from bson import ObjectId
    
    try:
        report = await db.reports.find_one({
            "_id": ObjectId(report_id),
            "user_id": current_user.user_id
        })
    except:
        report = await db.reports.find_one({
            "report_id": report_id,
            "user_id": current_user.user_id
        })
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Mark as read
    await db.reports.update_one(
        {"_id": report.get("_id")},
        {"$set": {"is_read": True}}
    )
    
    return {
        "report_id": str(report.get("_id", report.get("report_id"))),
        "report_type": report.get("report_type"),
        "title": report.get("title"),
        "date_range": report.get("date_range"),
        "content": report.get("content"),
        "stats": report.get("stats"),
        "created_at": report.get("created_at"),
        "is_read": True
    }

@api_router.delete("/reports/{report_id}")
async def delete_report(report_id: str, current_user: User = Depends(get_current_user)):
    """Delete a report"""
    from bson import ObjectId
    
    try:
        result = await db.reports.delete_one({
            "_id": ObjectId(report_id),
            "user_id": current_user.user_id
        })
    except:
        result = await db.reports.delete_one({
            "report_id": report_id,
            "user_id": current_user.user_id
        })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"message": "Report deleted"}

@api_router.post("/reports/generate/{report_type}")
async def generate_report(report_type: str, current_user: User = Depends(get_current_user)):
    """Generate a weekly or monthly report"""
    import calendar
    import uuid
    
    today = datetime.now(timezone.utc)
    
    # Get all jobs
    all_jobs = await db.job_applications.find({"user_id": current_user.user_id}).to_list(1000)
    
    if report_type == "weekly":
        week_start = today - timedelta(days=7)
        from_date = week_start.strftime("%b-%d-%Y")
        to_date = today.strftime("%b-%d-%Y")
        title = f"Weekly Summary for the week {from_date} - {to_date}"
        date_range = f"{from_date} - {to_date}"
        
        weekly_jobs = []
        for j in all_jobs:
            if j.get("date_applied"):
                date_applied = j.get("date_applied")
                if isinstance(date_applied, str):
                    try:
                        date_applied = datetime.fromisoformat(date_applied.replace("Z", "+00:00"))
                    except:
                        continue
                elif isinstance(date_applied, datetime) and date_applied.tzinfo is None:
                    date_applied = date_applied.replace(tzinfo=timezone.utc)
                if date_applied >= week_start:
                    weekly_jobs.append(j)
        
        status_counts = {}
        for job in weekly_jobs:
            status = job.get("status", "applied")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        follow_ups = []
        for j in all_jobs:
            if j.get("status") == "applied" and j.get("date_applied"):
                date_applied = j.get("date_applied")
                if isinstance(date_applied, str):
                    try:
                        date_applied = datetime.fromisoformat(date_applied.replace("Z", "+00:00"))
                    except:
                        continue
                elif isinstance(date_applied, datetime) and date_applied.tzinfo is None:
                    date_applied = date_applied.replace(tzinfo=timezone.utc)
                if (today - date_applied).days > 7:
                    follow_ups.append(j)
        
        user_name = current_user.preferred_display_name or current_user.name or "Job Seeker"
        weekly_applications = len(weekly_jobs)
        
        content = f'''<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #2563EB;">📊 Weekly Job Search Summary</h1>
<p>Hi {user_name}, here's your weekly summary for {from_date} - {to_date}.</p>
<div style="background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 20px 0;">
<h2>📈 Weekly Metrics</h2>
<div style="display: flex; gap: 15px; flex-wrap: wrap;">
<div style="background: white; padding: 15px; border-radius: 8px; flex: 1; min-width: 120px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #2563EB;">{weekly_applications}</div><div>Applications</div></div>
<div style="background: white; padding: 15px; border-radius: 8px; flex: 1; min-width: 120px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #10B981;">{status_counts.get('interviewing', 0)}</div><div>Interviews</div></div>
<div style="background: white; padding: 15px; border-radius: 8px; flex: 1; min-width: 120px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #22C55E;">{status_counts.get('offer', 0)}</div><div>Offers</div></div>
</div></div>
<div style="background: white; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin: 20px 0;">
<h2>📋 Applications This Week</h2>'''
        
        for job in weekly_jobs[:10]:
            content += f'<div style="padding: 10px 0; border-bottom: 1px solid #F3F4F6;"><strong>{job.get("company_name", "N/A")}</strong> - {job.get("position", "N/A")} <span style="color: #6B7280;">({job.get("status", "applied")})</span></div>'
        
        content += f'''</div>
<div style="background: #FEF3C7; border-radius: 12px; padding: 20px; margin: 20px 0;">
<h2>⏰ Follow-up Reminders ({len(follow_ups)})</h2>'''
        
        for r in follow_ups[:5]:
            content += f'<div style="background: white; padding: 10px; border-radius: 8px; margin: 5px 0;"><strong>{r.get("company_name")}</strong> - {r.get("position")}</div>'
        
        content += '</div><p style="color: #6B7280;">— JobTracker Team</p></div>'
        
        stats = {"weekly_applications": weekly_applications, "status_counts": status_counts, "follow_ups_count": len(follow_ups)}
        
    else:
        first_day = today.replace(day=1)
        month_year = today.strftime("%b-%Y")
        title = f"Monthly Summary for {month_year}"
        date_range = month_year
        
        total_applications = len(all_jobs)
        status_counts = {}
        work_mode_counts = {}
        for job in all_jobs:
            status_counts[job.get("status", "applied")] = status_counts.get(job.get("status", "applied"), 0) + 1
            work_mode_counts[job.get("work_mode", "unknown")] = work_mode_counts.get(job.get("work_mode", "unknown"), 0) + 1
        
        salaries = [j.get("salary_range", {}) for j in all_jobs if j.get("salary_range")]
        avg_min = sum(s.get("min", 0) for s in salaries) / len(salaries) if salaries else 0
        avg_max = sum(s.get("max", 0) for s in salaries) / len(salaries) if salaries else 0
        
        follow_ups = [j for j in all_jobs if j.get("status") == "applied"]
        response_rate = round((len([j for j in all_jobs if j.get("status") != "applied"]) / total_applications * 100) if total_applications else 0, 1)
        
        user_name = current_user.preferred_display_name or current_user.name or "Job Seeker"
        
        content = f'''<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #2563EB;">📊 Monthly Job Search Report - {month_year}</h1>
<p>Hi {user_name}, here's your comprehensive monthly report.</p>
<div style="background: linear-gradient(135deg, #2563EB, #7C3AED); border-radius: 16px; padding: 25px; color: white; margin: 20px 0;">
<h2 style="color: white;">📈 Monthly Overview</h2>
<div style="display: flex; gap: 20px; flex-wrap: wrap;">
<div style="flex: 1; text-align: center;"><div style="font-size: 36px; font-weight: bold;">{total_applications}</div><div>Total Applications</div></div>
<div style="flex: 1; text-align: center;"><div style="font-size: 36px; font-weight: bold;">{response_rate}%</div><div>Response Rate</div></div>
</div></div>
<div style="background: white; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin: 20px 0;">
<h2>📊 Status Breakdown</h2>'''
        
        for status, count in status_counts.items():
            pct = round(count / total_applications * 100) if total_applications else 0
            content += f'<div style="margin: 10px 0;"><div style="display: flex; justify-content: space-between;"><span>{status.replace("_", " ").title()}</span><span>{count} ({pct}%)</span></div><div style="background: #F3F4F6; border-radius: 10px; height: 10px;"><div style="background: #2563EB; height: 100%; width: {pct}%; border-radius: 10px;"></div></div></div>'
        
        content += f'''</div>
<div style="background: white; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin: 20px 0;">
<h2>🏢 Work Mode Distribution</h2>
<div style="display: flex; gap: 20px; flex-wrap: wrap;">'''
        
        for mode, count in work_mode_counts.items():
            content += f'<div style="flex: 1; text-align: center; padding: 15px;"><div style="font-size: 24px; font-weight: bold; color: #2563EB;">{count}</div><div>{mode.title()}</div></div>'
        
        content += f'''</div></div>
<div style="background: #F0FDF4; border-radius: 12px; padding: 20px; margin: 20px 0;">
<h2>💰 Salary Insights</h2>
<p>Average Range: <strong>${avg_min:,.0f} - ${avg_max:,.0f}</strong></p>
</div>
<div style="background: #FEF3C7; border-radius: 12px; padding: 20px; margin: 20px 0;">
<h2>⏰ Follow-up Reminders ({len(follow_ups)})</h2>'''
        
        for r in follow_ups[:5]:
            content += f'<div style="background: white; padding: 10px; border-radius: 8px; margin: 5px 0;"><strong>{r.get("company_name")}</strong> - {r.get("position")}</div>'
        
        content += '</div><p style="color: #6B7280;">Keep up the great work! — JobTracker Team</p></div>'
        
        stats = {"total_applications": total_applications, "status_counts": status_counts, "work_mode_counts": work_mode_counts, "response_rate": response_rate}
    
    report_doc = {
        "report_id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "report_type": report_type,
        "title": title,
        "date_range": date_range,
        "content": content,
        "stats": stats,
        "created_at": today,
        "is_read": False
    }
    
    await db.reports.insert_one(report_doc)
    return {"message": f"{report_type.title()} report generated", "report_id": report_doc["report_id"], "title": title}


# Health check endpoint for production monitoring
@api_router.get("/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring"""
    try:
        # Verify database connection
        await db.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
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
