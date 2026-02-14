# CareerFlow iOS Build Checklist

## 🚨 CRITICAL: Before Building for TestFlight/Production

### 1. Set Production Backend URL
The most important step - update the backend URL in `app.json`:

```json
// In app.json -> expo -> extra
"extra": {
  "appName": "CareerFlow",
  "EXPO_PUBLIC_BACKEND_URL": "https://YOUR-PRODUCTION-BACKEND-URL.com"
}
```

**⚠️ WARNING**: The current URL (`https://apptracker-19.preview.emergentagent.com`) is a development URL and will NOT work in production. You MUST replace it with your actual production backend URL.

### 2. Verify Backend is Running
Before building, ensure your production backend is:
- [ ] Deployed and accessible
- [ ] Database connected
- [ ] All API endpoints responding
- [ ] CORS configured for your production domain

Test the backend health check:
```bash
curl https://YOUR-PRODUCTION-BACKEND-URL.com/api/health
```

### 3. App Store Connect Configuration
In `eas.json`, update:
- [ ] `ascAppId` - Your App Store Connect App ID
- [ ] `appleTeamId` - Your Apple Developer Team ID

### 4. iOS Permissions (Already Configured ✅)
The following permissions are configured in `app.json`:
- ✅ Calendar access (`NSCalendarsUsageDescription`)
- ✅ Photo library (`NSPhotoLibraryUsageDescription`)
- ✅ Camera (`NSCameraUsageDescription`)
- ✅ Face ID (`NSFaceIDUsageDescription`)
- ✅ Non-exempt encryption declaration (`ITSAppUsesNonExemptEncryption`: false)

### 5. Build the App
```bash
# For production build
eas build --platform ios --profile production

# For TestFlight (internal testing)
eas build --platform ios --profile preview
```

### 6. Submit to App Store Connect
```bash
eas submit --platform ios --profile production
```

---

## Common Crash Causes (Prevented ✅)

### Issue 1: Hardcoded Development URLs
**Status**: FIXED ✅
- Removed all hardcoded `preview.emergentagent.com` URLs
- URLs now read from `app.json` configuration
- Error boundary added to prevent crashes

### Issue 2: Missing iOS Permissions
**Status**: FIXED ✅
- Added all required iOS permissions in `infoPlist`

### Issue 3: App Crashes on Launch
**Status**: FIXED ✅
- Added Error Boundary component
- Added proper splash screen handling
- Added graceful error handling for API failures

### Issue 4: Biometric Authentication Failures
**Status**: FIXED ✅
- Proper Face ID permission description added
- Graceful fallback when biometrics unavailable

---

## Architecture Changes Made

### Error Boundary
Added in `_layout.tsx` - catches JavaScript errors and displays a friendly message instead of crashing.

### API Configuration
Created `utils/api.ts` - centralized API URL management that:
- Reads from `app.json` configuration
- Falls back gracefully in development
- Logs configuration in development mode

### Splash Screen
Properly handled splash screen lifecycle to prevent white screen flashes.

---

## Testing Checklist

Before submitting to TestFlight:
- [ ] Backend URL is set to production
- [ ] All API endpoints are responding
- [ ] Login with Apple works
- [ ] Login with Google works (if enabled)
- [ ] Face ID/Touch ID works
- [ ] Job creation works
- [ ] Job listing works
- [ ] Calendar integration works
- [ ] CSV import works
- [ ] Theme switching works
- [ ] Logout works

---

## Contact
If the app crashes on TestFlight, check:
1. Backend URL configuration in `app.json`
2. Backend server is running and accessible
3. EAS Build logs for any build-time errors
4. Expo error logs in the app
