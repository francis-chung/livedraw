# Supabase Migration - Post-Implementation Checklist

## Pre-Testing Setup

- [ ] Installed dependencies: `npm install` in both server/ and client/
- [ ] Created Supabase project at supabase.com
- [ ] Enabled Google OAuth provider in Supabase settings
- [ ] Created all required database tables (users, canvases, canvas_data)
- [ ] Applied RLS policies to all tables
- [ ] Obtained Supabase URL and Anon Key from project settings
- [ ] Updated server/.env with SUPABASE_URL and SUPABASE_ANON_KEY
- [ ] Updated client/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

## Code Verification

### Server-side Verification
- [ ] server/server.js imports removed:
  - ✓ No `oauth2-client` import
  - ✓ No `jsonwebtoken` import
  - ✓ No `express-jwt` import
  - ✓ Uses `createSupabaseClient` and `verifySupabaseToken` from supabaseClient.js

- [ ] server/server.js socket handlers:
  - ✓ `authenticate` event uses `accessToken` parameter
  - ✓ All socket handlers use `user.id` (not `user.sub`)
  - ✓ No JWT verification or creation code
  - ✓ Uses `verifySupabaseToken()` for verification

- [ ] server/supabase/supabaseClient.js:
  - ✓ Exports `createSupabaseClient()` and `verifySupabaseToken()`
  - ✓ `verifySupabaseToken()` uses `supabase.auth.getUser()`
  - ✓ Returns user object with `id`, `email`, `name`, `picture`

### Client-side Verification
- [ ] client/src/Welcome.jsx:
  - ✓ Imports `createClient` from `@supabase/supabase-js`
  - ✓ No Google Identity Services usage
  - ✓ Has `handleGoogleSignIn()` using `signInWithOAuth()`
  - ✓ No longer accepts `onSignIn` prop

- [ ] client/src/App.jsx:
  - ✓ Imports `createClient` from `@supabase/supabase-js`
  - ✓ Initializes Supabase client with URL and key
  - ✓ Checks for existing session on mount with `getSession()`
  - ✓ Sets up `onAuthStateChange()` listener
  - ✓ No `localStorage.getItem('livedrawUser')` calls
  - ✓ No `window.google.accounts.id` usage
  - ✓ Socket auth uses `accessToken` only

- [ ] client/index.html:
  - ✓ No Google Identity Services script tag
  - ✓ Only has React root and main.jsx script

- [ ] client/package.json:
  - ✓ Has `@supabase/supabase-js` dependency
  - ✓ No `google-auth-library` dependency

- [ ] Removed files:
  - ✓ No errors referencing old Google OAuth code

## Runtime Testing

### Sign-In Flow
- [ ] Click "Sign in with Google" button
- [ ] Redirected to Google OAuth consent screen
- [ ] Select Google account
- [ ] Redirected back to application
- [ ] User object displays in UI
- [ ] Socket connection established and authenticated

### Canvas Operations
- [ ] Create new canvas
- [ ] Draw on canvas
- [ ] Canvas data updates in real-time (check socket events)
- [ ] Save canvas (verify success message)
- [ ] Canvas appears in gallery with correct name

### Data Persistence
- [ ] Sign in and create a canvas
- [ ] Save the canvas with specific drawing
- [ ] Refresh page (F5)
- [ ] Verify still logged in without Google sign-in again
- [ ] Click on saved canvas in gallery
- [ ] Verify drawing is still there (data persisted)

### Session Management
- [ ] Sign in with Google Account A
- [ ] Create and save a canvas
- [ ] Sign out from user menu
- [ ] Verify redirected to Welcome screen
- [ ] Sign in with Google Account B
- [ ] Verify cannot see Account A's canvases
- [ ] Sign out

### Error Handling
- [ ] Try to access protected endpoints without auth (should fail gracefully)
- [ ] Check console for authentication errors
- [ ] Check server logs for authentication issues
- [ ] Verify error messages are user-friendly

### Multiple Instances
- [ ] Open two browser windows/tabs
- [ ] Sign in with same account in both
- [ ] Create canvas in Window A
- [ ] Refresh Window B
- [ ] Verify new canvas appears in Window B

## Browser Console Check

- [ ] No errors in console
- [ ] No warnings about missing environment variables
- [ ] No warnings about deprecated APIs
- [ ] Socket connections successful
- [ ] No authentication errors

## Server Logs Check

- [ ] Server starts without errors
- [ ] Socket connections logged as "user connected"
- [ ] Authentication logged as successful
- [ ] No "verifyGoogleToken" references
- [ ] No JWT verification errors
- [ ] Canvas operations logged correctly

## Database Verification

In Supabase Dashboard:
- [ ] Users table has entries for signed-in users
- [ ] Canvases table has entries with correct owner_id
- [ ] Canvas_data table has entries with correct objects JSON
- [ ] RLS policies allow data access only to owner

SQL query to verify:
```sql
-- Check users were created
SELECT COUNT(*) FROM users;

-- Check canvases were created
SELECT id, name, owner_id FROM canvases LIMIT 5;

-- Check canvas data
SELECT canvas_id, objects FROM canvas_data LIMIT 5;
```

## Environment Variables Check

### Server (.env)
- [ ] `SUPABASE_URL` - Set to project URL
- [ ] `SUPABASE_ANON_KEY` - Set to anon key
- [ ] No `GOOGLE_CLIENT_ID`
- [ ] No `SESSION_SECRET`

### Client (.env)
- [ ] `VITE_SUPABASE_URL` - Set to project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Set to anon key
- [ ] No `VITE_GOOGLE_CLIENT_ID`

## Performance Checks

- [ ] Sign-in completes within reasonable time (< 5 seconds)
- [ ] Canvas operations respond quickly
- [ ] No memory leaks (check DevTools)
- [ ] No excessive API calls to Supabase
- [ ] Socket messages transmit efficiently

## Security Checks

- [ ] Access tokens are never logged or exposed
- [ ] RLS policies prevent cross-user data access
- [ ] Cannot modify another user's canvases
- [ ] Cannot view another user's canvases
- [ ] Session expires appropriately

## Cleanup Tasks

- [ ] Delete old node_modules and reinstall: `npm install`
- [ ] Delete package-lock.json and let npm regenerate it
- [ ] Clear browser cache/cookies and test fresh session
- [ ] Remove old database if migrating from different backend
- [ ] Document any custom setup steps in project README

## Documentation Updates

- [ ] Update README.md with new setup instructions
- [ ] Document Supabase configuration steps
- [ ] Update deployment documentation
- [ ] Add troubleshooting section for common issues
- [ ] Update API documentation if exists

## Final Verification

- [ ] All above checklist items checked
- [ ] No critical errors or warnings
- [ ] Application works as expected
- [ ] Data persists correctly
- [ ] Security is maintained
- [ ] Ready for production/deployment

---

**Migration Date**: _______________
**Verified By**: _______________
**Issues Found**: _______________
**Resolution**: _______________
