# Job Journey - Job Application Tracking Mobile App

## Overview
Job Journey is a comprehensive mobile application for tracking job applications with AI-powered features, rich analytics, and seamless authentication. Built with Expo (React Native), FastAPI, and MongoDB.

## Features

### Core Features
- **Dashboard**: Rich visualizations with charts showing application statistics
  - Total applications count
  - Average aging in business days
  - Stage distribution (bar chart)
  - Job family distribution (pie chart)
  - Work type breakdown
  - Recent applications (last 7 days)

- **My Jobs**: Complete job application management
  - List view (phone) / Grid view (tablet) with adaptive layout
  - Search functionality
  - Color-coded status badges with monospace font
  - Business day aging calculations
  - Salary range display
  - Quick access to job details

- **Analytics**: AI-powered insights and patterns
  - Weekly application trends
  - AI-generated insights and recommendations
  - Stage distribution analysis
  - Job family distribution
  - Success rate metrics

- **Settings**: User preferences and management
  - Light/Dark/Auto theme modes
  - Push notification preferences
  - Email summary settings (weekly/monthly)
  - CSV export functionality
  - Subscription management
  - Logout

### Advanced Features
- **AI Job Categorization**: Automatically categorizes jobs into families (Software Engineer, Accountant, Hardware Engineer, etc.) using GPT-5.2
- **AI Pattern Analysis**: Provides intelligent insights and recommendations based on application history
- **Dynamic Interview Stages**: Stage templates adapt to job family (6 default templates + custom stages)
- **Business Day Aging**: Excludes weekends from aging calculations
- **Adaptive UI**: Responsive design for phones and tablets
- **Authentication**: Emergent Google OAuth with secure session management
- **Theme System**: Light, Dark, and Auto modes with system detection

## Tech Stack

### Frontend
- **Expo** (React Native)
- **Expo Router** (File-based routing)
- **React Native Paper** (UI components with Material Design)
- **Zustand** (State management)
- **React Native Gifted Charts** (Data visualization)
- **@shopify/flash-list** (Optimized list rendering)
- **Expo Secure Store** (Secure token storage)
- **date-fns** (Date formatting)

### Backend
- **FastAPI** (Python web framework)
- **MongoDB** (Database with Motor async driver)
- **Emergent Integrations** (LLM integration library)
- **httpx** (Async HTTP client)

### AI & Integration
- **OpenAI GPT-5.2** (Job categorization and pattern analysis)
- **Emergent Auth** (Google OAuth integration)
- **Emergent LLM Key** (Universal key for AI features)

## Project Structure

```
/app
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── .env                    # Environment variables
│   └── requirements.txt        # Python dependencies
│
├── frontend/
│   ├── app/
│   │   ├── (tabs)/            # Tab navigation screens
│   │   │   ├── dashboard.tsx  # Dashboard with charts
│   │   │   ├── jobs.tsx       # Job list
│   │   │   ├── analytics.tsx  # Analytics & AI insights
│   │   │   └── settings.tsx   # Settings & preferences
│   │   ├── add-job.tsx        # Add job form
│   │   ├── job-details.tsx    # Job details & stage management
│   │   ├── login.tsx          # Authentication screen
│   │   └── _layout.tsx        # Root layout with auth
│   ├── contexts/
│   │   └── AuthContext.tsx    # Authentication context
│   ├── stores/
│   │   ├── jobStore.ts        # Job state management
│   │   └── themeStore.ts      # Theme management
│   └── utils/
│       └── colors.ts          # Color constants
```

## API Endpoints

### Authentication
- `POST /api/auth/session` - Exchange session_id for session_token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout and invalidate session

### Jobs
- `GET /api/jobs` - List all jobs (with filters)
- `POST /api/jobs` - Create job with AI categorization
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job
- `POST /api/jobs/:id/stage` - Update job stage
- `GET /api/jobs/export/csv` - Export jobs as CSV

### Dashboard & Analytics
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/analytics` - Get analytics data
- `GET /api/analytics/patterns` - AI-powered pattern analysis

### Templates
- `GET /api/templates` - Get all templates
- `POST /api/templates` - Create custom template

## Default Interview Stage Templates

1. **Software Engineer**: Applied → Recruiter Screening → Phone Screen → Coding Round → System Design Round → Behavioral Round → Hiring Manager → Final Onsite Interview

2. **Accountant**: Applied → Initial Screening → Phone Interview → Technical Assessment → Manager Interview → Partner Interview → Final Interview

3. **Hardware Engineer**: Applied → Recruiter Screening → Technical Phone Screen → Circuit Design Round → Lab Test → Design Review → Manager Interview → Final Onsite

4. **Administrative Assistant**: Applied → Phone Screening → Typing Test → In-Person Interview → Manager Meeting → Final Interview

5. **Data Scientist**: Applied → Recruiter Call → Technical Screen → Take-Home Assignment → Technical Interview → Behavioral Round → Final Interview

6. **Product Manager**: Applied → Recruiter Screen → Phone Interview → Case Study → Product Sense Interview → Cross-Functional Interview → Executive Interview

## Key Features Implemented

✅ Tab-based navigation (Dashboard, My Jobs, Analytics, Settings)
✅ Emergent Google OAuth authentication
✅ AI-powered job categorization (GPT-5.2)
✅ AI-powered pattern analysis with insights
✅ Dynamic interview stage templates (6 job families)
✅ Custom interview rounds
✅ Business day aging calculation (excludes weekends)
✅ Rich dashboard with bar charts and pie charts
✅ Adaptive layout (phone list view, tablet grid view)
✅ Color-coded status badges with monospace font
✅ Search functionality
✅ Light/Dark/Auto theme modes
✅ CSV export
✅ Stage history tracking
✅ Salary range display

## Testing Results

**Backend Testing**: ✅ 17/17 tests PASSED (100% success rate)
- All API endpoints functional
- AI categorization working with GPT-5.2
- Business day calculations accurate
- Authentication flow working correctly
- Error handling proper

## Future Enhancements

- Implement actual SendGrid email integration for summaries
- Complete in-app purchase flow with Apple/Google Store Kit
- Add push notification implementation
- Calendar integration for interview reminders
- Document upload (resume, cover letter)

## Notes

- SendGrid integration is currently mocked
- In-app purchases are placeholder implementations
- The app uses Emergent LLM Key for AI features
- Business day aging excludes weekends only (not holidays)
- All AI features have fallback mechanisms for budget limits
