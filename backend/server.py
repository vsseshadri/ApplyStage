from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Response, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage
import csv
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Get Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    subscription: Dict[str, Any] = {"type": "free", "expiresAt": None}
    preferences: Dict[str, Any] = {
        "theme": "auto",
        "notifications": True,
        "emailSummary": {"weekly": True, "monthly": True}
    }
    created_at: datetime

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class StageHistory(BaseModel):
    stage: str
    start_date: datetime
    end_date: Optional[datetime] = None
    outcome: str = "pending"  # pending, passed, failed
    notes: Optional[str] = None

class AIInsights(BaseModel):
    job_family: str
    confidence: float
    suggested_stages: List[str]
    analysis: Optional[str] = None

class Job(BaseModel):
    job_id: str = Field(default_factory=lambda: f"job_{uuid.uuid4().hex[:12]}")
    user_id: str
    company: str
    position: str
    job_family: str
    location: str
    salary_range: Optional[Dict[str, Any]] = None
    work_type: str  # onsite, remote, hybrid
    applied_date: datetime
    current_stage: str
    custom_stages: List[str] = []
    stage_history: List[StageHistory] = []
    total_business_days_aging: int = 0
    stage_business_days_aging: int = 0
    url: Optional[str] = None
    notes: Optional[str] = None
    ai_insights: Optional[AIInsights] = None
    created_at: datetime
    updated_at: datetime

class JobCreate(BaseModel):
    company: str
    position: str
    location: str
    salary_range: Optional[Dict[str, Any]] = None
    work_type: str
    applied_date: datetime
    current_stage: str
    custom_stages: List[str] = []
    url: Optional[str] = None
    notes: Optional[str] = None

class JobUpdate(BaseModel):
    company: Optional[str] = None
    position: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[Dict[str, Any]] = None
    work_type: Optional[str] = None
    current_stage: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None

class StageUpdate(BaseModel):
    stage: str
    outcome: Optional[str] = "pending"
    notes: Optional[str] = None

class InterviewStageTemplate(BaseModel):
    template_id: str = Field(default_factory=lambda: f"template_{uuid.uuid4().hex[:12]}")
    job_family: str
    stages: List[str]
    is_default: bool = False
    user_id: Optional[str] = None
    created_at: datetime

class TemplateCreate(BaseModel):
    job_family: str
    stages: List[str]

class SubscriptionVerify(BaseModel):
    receipt: str
    platform: str  # ios or android

# ==================== AUTH HELPERS ====================

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    """Get current user from session token (Authorization header or cookie)"""
    if not authorization:
        return None
    
    # Extract token from "Bearer <token>" format
    session_token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        return None
    
    # Check expiration with timezone awareness
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at <= datetime.now(timezone.utc):
        # Session expired, delete it
        await db.user_sessions.delete_one({"session_token": session_token})
        return None
    
    # Get user
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if user_doc:
        return User(**user_doc)
    return None

def require_auth(user: Optional[User] = Depends(get_current_user)) -> User:
    """Dependency to require authentication"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ==================== DEFAULT TEMPLATES ====================

DEFAULT_TEMPLATES = {
    "Software Engineer": ["Applied", "Recruiter Screening", "Phone Screen", "Coding Round", "System Design Round", "Behavioral Round", "Hiring Manager", "Final Onsite Interview"],
    "Accountant": ["Applied", "Initial Screening", "Phone Interview", "Technical Assessment", "Manager Interview", "Partner Interview", "Final Interview"],
    "Hardware Engineer": ["Applied", "Recruiter Screening", "Technical Phone Screen", "Circuit Design Round", "Lab Test", "Design Review", "Manager Interview", "Final Onsite"],
    "Administrative Assistant": ["Applied", "Phone Screening", "Typing Test", "In-Person Interview", "Manager Meeting", "Final Interview"],
    "Data Scientist": ["Applied", "Recruiter Call", "Technical Screen", "Take-Home Assignment", "Technical Interview", "Behavioral Round", "Final Interview"],
    "Product Manager": ["Applied", "Recruiter Screen", "Phone Interview", "Case Study", "Product Sense Interview", "Cross-Functional Interview", "Executive Interview"],
}

async def initialize_default_templates():
    """Initialize default templates if they don't exist"""
    for job_family, stages in DEFAULT_TEMPLATES.items():
        existing = await db.interview_stage_templates.find_one({"job_family": job_family, "is_default": True})
        if not existing:
            template = InterviewStageTemplate(
                job_family=job_family,
                stages=stages,
                is_default=True,
                user_id=None,
                created_at=datetime.now(timezone.utc)
            )
            await db.interview_stage_templates.insert_one(template.model_dump())

# ==================== BUSINESS DAYS CALCULATION ====================

def calculate_business_days(start_date: datetime, end_date: datetime = None) -> int:
    """Calculate business days between two dates (excluding weekends)"""
    if end_date is None:
        end_date = datetime.now(timezone.utc)
    
    # Ensure both dates are timezone-aware
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)
    
    business_days = 0
    current = start_date.date()
    end = end_date.date()
    
    while current <= end:
        if current.weekday() < 5:  # Monday = 0, Sunday = 6
            business_days += 1
        current += timedelta(days=1)
    
    return business_days

# ==================== AI CATEGORIZATION ====================

async def categorize_job_with_ai(position: str, company: str, notes: str = "") -> AIInsights:
    """Use AI to categorize job and suggest interview stages"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"categorize_{uuid.uuid4().hex[:8]}",
            system_message="You are an expert job categorization system. Categorize jobs into one of these families: Software Engineer, Hardware Engineer, Accountant, Administrative Assistant, Data Scientist, Product Manager, or Other. Respond in JSON format only."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Analyze this job posting and categorize it:
Position: {position}
Company: {company}
Notes: {notes}

Respond with JSON only:
{{
    "job_family": "exact category name",
    "confidence": 0.95,
    "reasoning": "brief explanation"
}}"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        import json
        result = json.loads(response.strip())
        
        # Get suggested stages from templates
        template = await db.interview_stage_templates.find_one(
            {"job_family": result["job_family"], "is_default": True},
            {"_id": 0}
        )
        suggested_stages = template["stages"] if template else DEFAULT_TEMPLATES.get(result["job_family"], ["Applied", "Screening", "Interview", "Final Round"])
        
        return AIInsights(
            job_family=result["job_family"],
            confidence=result.get("confidence", 0.8),
            suggested_stages=suggested_stages,
            analysis=result.get("reasoning", "")
        )
    except Exception as e:
        logger.error(f"AI categorization error: {str(e)}")
        # Fallback to simple keyword matching
        position_lower = position.lower()
        if any(word in position_lower for word in ["software", "developer", "engineer", "programmer"]):
            job_family = "Software Engineer"
        elif "hardware" in position_lower:
            job_family = "Hardware Engineer"
        elif "account" in position_lower:
            job_family = "Accountant"
        elif "admin" in position_lower or "assistant" in position_lower:
            job_family = "Administrative Assistant"
        elif "data" in position_lower or "scientist" in position_lower:
            job_family = "Data Scientist"
        elif "product" in position_lower or "manager" in position_lower:
            job_family = "Product Manager"
        else:
            job_family = "Other"
        
        return AIInsights(
            job_family=job_family,
            confidence=0.6,
            suggested_stages=DEFAULT_TEMPLATES.get(job_family, ["Applied", "Screening", "Interview", "Final Round"]),
            analysis="Fallback categorization based on keywords"
        )

async def analyze_application_patterns(user_id: str) -> Dict[str, Any]:
    """Analyze user's application patterns with AI"""
    try:
        # Get all user's jobs
        jobs = await db.jobs.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
        
        if not jobs:
            return {"message": "No jobs found", "insights": []}
        
        # Prepare data summary
        total_apps = len(jobs)
        stage_distribution = {}
        job_family_distribution = {}
        
        for job in jobs:
            stage = job.get("current_stage", "Unknown")
            stage_distribution[stage] = stage_distribution.get(stage, 0) + 1
            
            family = job.get("job_family", "Other")
            job_family_distribution[family] = job_family_distribution.get(family, 0) + 1
        
        # Use AI to analyze patterns
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"pattern_{uuid.uuid4().hex[:8]}",
            system_message="You are a career analytics expert. Analyze job application patterns and provide actionable insights."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Analyze these job application patterns and provide insights:
Total Applications: {total_apps}
Stage Distribution: {stage_distribution}
Job Family Distribution: {job_family_distribution}

Provide 3-5 key insights in JSON format:
{{
    "insights": [
        {{"category": "success_rate", "message": "insight text", "severity": "positive/neutral/warning"}},
        ...
    ],
    "recommendations": ["recommendation 1", "recommendation 2", ...]
}}"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        import json
        result = json.loads(response.strip())
        
        return {
            "total_applications": total_apps,
            "stage_distribution": stage_distribution,
            "job_family_distribution": job_family_distribution,
            **result
        }
    except Exception as e:
        logger.error(f"Pattern analysis error: {str(e)}")
        return {
            "error": "Failed to analyze patterns",
            "message": str(e)
        }

# ==================== AUTH ENDPOINTS ====================

@api_router.get("/auth/google")
async def google_auth_redirect():
    """Redirect to Emergent Google Auth"""
    redirect_url = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'http://localhost:3000')
    auth_url = f"https://auth.emergentagent.com/?redirect={redirect_url}"
    return {"auth_url": auth_url}

@api_router.post("/auth/session")
async def create_session(session_id: str = Header(..., alias="X-Session-ID")):
    """Exchange session_id for session_token"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            response.raise_for_status()
            user_data = response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
        
        if not existing_user:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user = User(
                user_id=user_id,
                email=user_data["email"],
                name=user_data["name"],
                picture=user_data.get("picture"),
                created_at=datetime.now(timezone.utc)
            )
            await db.users.insert_one(user.model_dump())
        else:
            user_id = existing_user["user_id"]
            user = User(**existing_user)
        
        # Create session
        session_token = user_data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        session = UserSession(
            user_id=user_id,
            session_token=session_token,
            expires_at=expires_at,
            created_at=datetime.now(timezone.utc)
        )
        await db.user_sessions.insert_one(session.model_dump())
        
        return {
            "user": user.model_dump(),
            "session_token": session_token
        }
    except Exception as e:
        logger.error(f"Session creation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(require_auth)):
    """Get current user"""
    return current_user

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Logout and delete session"""
    if authorization:
        session_token = authorization.replace("Bearer ", "")
        await db.user_sessions.delete_one({"session_token": session_token})
    return {"message": "Logged out successfully"}

# ==================== JOB ENDPOINTS ====================

@api_router.get("/jobs")
async def get_jobs(
    current_user: User = Depends(require_auth),
    stage: Optional[str] = None,
    job_family: Optional[str] = None,
    work_type: Optional[str] = None
):
    """Get all jobs for current user with optional filters"""
    query = {"user_id": current_user.user_id}
    
    if stage:
        query["current_stage"] = stage
    if job_family:
        query["job_family"] = job_family
    if work_type:
        query["work_type"] = work_type
    
    jobs = await db.jobs.find(query, {"_id": 0}).sort("applied_date", -1).to_list(1000)
    
    # Update aging for each job
    for job in jobs:
        job["total_business_days_aging"] = calculate_business_days(job["applied_date"])
        if job["stage_history"]:
            last_stage = job["stage_history"][-1]
            job["stage_business_days_aging"] = calculate_business_days(last_stage["start_date"])
    
    return jobs

@api_router.post("/jobs")
async def create_job(job_data: JobCreate, current_user: User = Depends(require_auth)):
    """Create a new job application"""
    # AI categorization
    ai_insights = await categorize_job_with_ai(
        position=job_data.position,
        company=job_data.company,
        notes=job_data.notes or ""
    )
    
    # Create job
    job = Job(
        user_id=current_user.user_id,
        company=job_data.company,
        position=job_data.position,
        job_family=ai_insights.job_family,
        location=job_data.location,
        salary_range=job_data.salary_range,
        work_type=job_data.work_type,
        applied_date=job_data.applied_date,
        current_stage=job_data.current_stage,
        custom_stages=job_data.custom_stages,
        stage_history=[StageHistory(
            stage=job_data.current_stage,
            start_date=job_data.applied_date,
            outcome="pending"
        )],
        url=job_data.url,
        notes=job_data.notes,
        ai_insights=ai_insights,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    
    await db.jobs.insert_one(job.model_dump())
    return job

@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str, current_user: User = Depends(require_auth)):
    """Get job details"""
    job = await db.jobs.find_one({"job_id": job_id, "user_id": current_user.user_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Update aging
    job["total_business_days_aging"] = calculate_business_days(job["applied_date"])
    if job["stage_history"]:
        last_stage = job["stage_history"][-1]
        job["stage_business_days_aging"] = calculate_business_days(last_stage["start_date"])
    
    return job

@api_router.put("/jobs/{job_id}")
async def update_job(job_id: str, job_data: JobUpdate, current_user: User = Depends(require_auth)):
    """Update job details"""
    job = await db.jobs.find_one({"job_id": job_id, "user_id": current_user.user_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    update_data = {k: v for k, v in job_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.jobs.update_one({"job_id": job_id}, {"$set": update_data})
    
    updated_job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    return updated_job

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: User = Depends(require_auth)):
    """Delete job"""
    result = await db.jobs.delete_one({"job_id": job_id, "user_id": current_user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully"}

@api_router.post("/jobs/{job_id}/stage")
async def update_job_stage(job_id: str, stage_data: StageUpdate, current_user: User = Depends(require_auth)):
    """Update job stage"""
    job = await db.jobs.find_one({"job_id": job_id, "user_id": current_user.user_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Close current stage
    stage_history = job.get("stage_history", [])
    if stage_history:
        stage_history[-1]["end_date"] = datetime.now(timezone.utc)
        stage_history[-1]["outcome"] = stage_data.outcome
    
    # Add new stage
    new_stage = StageHistory(
        stage=stage_data.stage,
        start_date=datetime.now(timezone.utc),
        outcome="pending",
        notes=stage_data.notes
    )
    stage_history.append(new_stage.model_dump())
    
    await db.jobs.update_one(
        {"job_id": job_id},
        {"$set": {
            "current_stage": stage_data.stage,
            "stage_history": stage_history,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Stage updated successfully"}

@api_router.get("/jobs/export/csv")
async def export_jobs_csv(current_user: User = Depends(require_auth)):
    """Export jobs as CSV"""
    jobs = await db.jobs.find({"user_id": current_user.user_id}, {"_id": 0}).to_list(1000)
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Company", "Position", "Job Family", "Location", "Work Type",
        "Applied Date", "Current Stage", "Total Business Days",
        "Stage Business Days", "URL", "Notes"
    ])
    
    # Data
    for job in jobs:
        total_aging = calculate_business_days(job["applied_date"])
        stage_aging = 0
        if job.get("stage_history"):
            last_stage = job["stage_history"][-1]
            stage_aging = calculate_business_days(last_stage["start_date"])
        
        writer.writerow([
            job["company"],
            job["position"],
            job["job_family"],
            job["location"],
            job["work_type"],
            job["applied_date"].strftime("%Y-%m-%d"),
            job["current_stage"],
            total_aging,
            stage_aging,
            job.get("url", ""),
            job.get("notes", "")
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=jobs.csv"}
    )

# ==================== DASHBOARD ENDPOINTS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(require_auth)):
    """Get dashboard statistics"""
    jobs = await db.jobs.find({"user_id": current_user.user_id}, {"_id": 0}).to_list(1000)
    
    total_applications = len(jobs)
    
    # By stage
    by_stage = {}
    for job in jobs:
        stage = job.get("current_stage", "Unknown")
        by_stage[stage] = by_stage.get(stage, 0) + 1
    
    # By job family
    by_job_family = {}
    for job in jobs:
        family = job.get("job_family", "Other")
        by_job_family[family] = by_job_family.get(family, 0) + 1
    
    # By work type
    by_work_type = {}
    for job in jobs:
        work_type = job.get("work_type", "Unknown")
        by_work_type[work_type] = by_work_type.get(work_type, 0) + 1
    
    # Average aging
    total_aging = sum(calculate_business_days(job["applied_date"]) for job in jobs)
    avg_aging = total_aging / total_applications if total_applications > 0 else 0
    
    # Recent applications (last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_apps = [job for job in jobs if job["applied_date"] >= seven_days_ago]
    
    return {
        "total_applications": total_applications,
        "by_stage": by_stage,
        "by_job_family": by_job_family,
        "by_work_type": by_work_type,
        "average_aging_days": round(avg_aging, 1),
        "recent_applications": len(recent_apps),
        "recent_jobs": recent_apps[:5]
    }

# ==================== ANALYTICS ENDPOINTS ====================

@api_router.get("/analytics")
async def get_analytics(current_user: User = Depends(require_auth)):
    """Get analytics data"""
    jobs = await db.jobs.find({"user_id": current_user.user_id}, {"_id": 0}).to_list(1000)
    
    # Time-based trends
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    weekly_data = {}
    for i in range(4):
        week_start = now - timedelta(weeks=i+1)
        week_end = now - timedelta(weeks=i)
        week_jobs = [j for j in jobs if week_start <= j["applied_date"] <= week_end]
        weekly_data[f"Week {i+1}"] = len(week_jobs)
    
    return {
        "total_applications": len(jobs),
        "weekly_trends": weekly_data,
        "success_rate": 0.15,  # Placeholder - would calculate from outcomes
        "avg_response_time": 5,  # Placeholder - would calculate from stage history
    }

@api_router.get("/analytics/patterns")
async def get_application_patterns(current_user: User = Depends(require_auth)):
    """Get AI-powered pattern analysis"""
    patterns = await analyze_application_patterns(current_user.user_id)
    return patterns

# ==================== TEMPLATE ENDPOINTS ====================

@api_router.get("/templates")
async def get_templates(current_user: User = Depends(require_auth)):
    """Get all templates (default + user custom)"""
    # Get default templates
    default_templates = await db.interview_stage_templates.find(
        {"is_default": True},
        {"_id": 0}
    ).to_list(100)
    
    # Get user custom templates
    custom_templates = await db.interview_stage_templates.find(
        {"user_id": current_user.user_id, "is_default": False},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "default": default_templates,
        "custom": custom_templates
    }

@api_router.post("/templates")
async def create_template(template_data: TemplateCreate, current_user: User = Depends(require_auth)):
    """Create custom template"""
    template = InterviewStageTemplate(
        job_family=template_data.job_family,
        stages=template_data.stages,
        is_default=False,
        user_id=current_user.user_id,
        created_at=datetime.now(timezone.utc)
    )
    
    await db.interview_stage_templates.insert_one(template.model_dump())
    return template

# ==================== SUBSCRIPTION ENDPOINTS ====================

@api_router.post("/subscription/verify")
async def verify_subscription(sub_data: SubscriptionVerify, current_user: User = Depends(require_auth)):
    """Verify in-app purchase (placeholder)"""
    # In production, this would verify receipt with Apple/Google
    # For now, just return success
    return {
        "verified": True,
        "subscription_type": "premium",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    }

@api_router.get("/subscription/status")
async def get_subscription_status(current_user: User = Depends(require_auth)):
    """Get subscription status"""
    return current_user.subscription

# ==================== AI ENDPOINTS ====================

@api_router.post("/ai/categorize")
async def categorize_job(position: str, company: str, notes: str = "", current_user: User = Depends(require_auth)):
    """Categorize job with AI"""
    insights = await categorize_job_with_ai(position, company, notes)
    return insights

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup_event():
    """Initialize default templates on startup"""
    await initialize_default_templates()
    logger.info("Default templates initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
