# Job Journey - Login & Testing Guide

## How to Login

### Web Preview (Current Method)
1. Go to: **https://jobjourney-4.preview.emergentagent.com**
2. Click **"Continue with Google"** button
3. You'll be redirected to Emergent Auth (https://auth.emergentagent.com)
4. Sign in with your Google account
5. After successful authentication, you'll be redirected back to the app
6. The app will automatically exchange the session and log you in

### What Happens Behind the Scenes
1. App shows login screen
2. Clicking Google button opens: `https://auth.emergentagent.com/?redirect=https://jobjourney-4.preview.emergentagent.com/`
3. After Google OAuth, Emergent auth redirects back with session_id in URL hash
4. App extracts session_id from URL (e.g., `#session_id=abc123`)
5. App calls backend `/api/auth/session` with session_id
6. Backend exchanges session_id for session_token with Emergent servers  
7. Backend creates user record in MongoDB if new user
8. Backend returns user data + session_token to frontend
9. Frontend stores session_token in localStorage (web) or SecureStore (mobile)
10. App now shows authenticated tabs (Dashboard, My Jobs, Analytics, Settings)

## Fixed Issues (Just Now)
- ✅ SecureStore not working on web → Added storage adapter for web (localStorage) vs native (SecureStore)
- ✅ Updated AuthContext.tsx to use storage adapter
- ✅ Updated jobStore.ts to use storage adapter  
- ✅ Updated settings.tsx to use storage adapter

## Testing After Login

### 1. Dashboard Tab
- Should show summary cards (Total Applications, Avg Days Aging, etc.)
- Charts will be empty initially (no data yet)

### 2. Add Your First Job
- Click "+" FAB button on "My Jobs" tab
- Fill in job details:
  - Company (required)
  - Position (required)
  - Location (required)
  - Work Type: Onsite/Remote/Hybrid
  - Salary range (optional)
  - Select interview stages from templates OR add custom stages
- Click "Add Job"
- AI will categorize the job (currently using fallback due to budget limit)

### 3. View Job Details
- Click on any job card in "My Jobs" tab
- See job details, stage history, AI insights
- Update stage using "Update Stage" button
- Delete job using menu (⋮)

### 4. Analytics
- View AI-powered insights (once you have multiple jobs)
- See application patterns and recommendations

### 5. Settings
- Change theme (Light/Dark/Auto)
- Toggle notification preferences
- Export jobs as CSV
- Logout

## Troubleshooting

### "Session check error"
- This was the SecureStore issue on web - now fixed
- Clear your browser cache and localStorage
- Try again

### Login button does nothing
- Check browser console for errors
- Make sure popup blockers are disabled

### Redirected but not logged in
- The session_id might not be in the URL
- Check browser console for "Session exchange error"
- Backend should show POST /api/auth/session in logs

### Can't add jobs / "Not authenticated" error
- Session token not stored properly
- Check browser localStorage: `localStorage.getItem('session_token')`
- Try logging out and back in

## Backend Logs
To see what's happening on the backend:
```bash
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/backend.err.log
```

## Frontend Logs
Web browser console will show all React/Expo logs

## Note on AI Features
**Emergent LLM Key budget exceeded:** AI categorization and pattern analysis will use keyword-based fallback until budget is topped up. The app handles this gracefully - all features still work!

## Mobile Testing (Optional)
### Using Expo Go App:
1. Install Expo Go on iOS/Android
2. Scan QR code from: `https://jobjourney-4.preview.emergentagent.com`
3. App opens in Expo Go
4. Login flow same as web

Note: Mobile testing recommended but web preview works perfectly for now!
