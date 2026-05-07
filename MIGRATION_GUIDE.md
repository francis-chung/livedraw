# Supabase Google OAuth Migration Guide

## Overview
Your Livedraw application has been successfully migrated from manual Google OAuth to Supabase Google OAuth. This simplifies authentication, improves security, and reduces server-side complexity.

## What Changed

### Server-side Changes (`server/`)
1. **Removed dependencies**:
   - `google-auth-library` - No longer needed for token verification
   - `jsonwebtoken` - Supabase handles session management
   - `express-jwt` - Not used anymore

2. **Updated authentication flow**:
   - Removed manual Google token verification
   - Now uses Supabase's `verifySupabaseToken()` to verify access tokens
   - Simplified socket authentication to use only access tokens

3. **Updated `supabase/supabaseClient.js`**:
   - Now exports both `createSupabaseClient()` and `verifySupabaseToken()`
   - Client accepts optional `accessToken` parameter for authenticated requests

4. **Socket events**:
   - Changed from `authenticate` with `{ profile, token }` to `authenticate` with `{ accessToken }`
   - Removed `verifySession` with JWT tokens - Supabase handles session persistence
   - All socket handlers now use `user.id` instead of `user.sub`

### Client-side Changes (`client/`)
1. **Removed dependencies**:
   - Removed Google Identity Services script from `index.html`

2. **Added dependencies**:
   - Added `@supabase/supabase-js` to `package.json`

3. **Updated authentication flow**:
   - Removed localStorage-based session management
   - Now uses Supabase's built-in session management
   - Uses `supabase.auth.signInWithOAuth()` for Google authentication
   - Automatically handles OAuth redirect and session persistence

4. **Updated components**:
   - `Welcome.jsx`: Now uses Supabase OAuth button instead of Google Sign-In widget
   - `App.jsx`: 
     - Checks for existing Supabase session on mount
     - Sets up auth state listener for automatic session updates
     - Sends access token to socket instead of manual token
     - Removed localStorage dependency

## Setup Instructions

### 1. Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Supabase

#### Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Create a new project
4. Wait for the project to be provisioned

#### Enable Google OAuth Provider
1. In your Supabase project, go to **Authentication** → **Providers**
2. Click on **Google**
3. Enable the provider
4. Add your Google OAuth credentials (you'll need a Google Cloud project)

#### Create Database Tables
Run these SQL commands in the Supabase SQL editor:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create canvases table
CREATE TABLE canvases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, name)
);

-- Create canvas_data table
CREATE TABLE canvas_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  objects JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own canvases" ON canvases
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own canvases" ON canvases
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own canvases" ON canvases
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own canvases" ON canvases
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Users can view canvas data for their canvases" ON canvas_data
  FOR SELECT USING (
    canvas_id IN (
      SELECT id FROM canvases WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update canvas data for their canvases" ON canvas_data
  FOR UPDATE USING (
    canvas_id IN (
      SELECT id FROM canvases WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete canvas data for their canvases" ON canvas_data
  FOR DELETE USING (
    canvas_id IN (
      SELECT id FROM canvases WHERE owner_id = auth.uid()
    )
  );
```

### 3. Get Supabase Credentials
1. In your Supabase project, go to **Settings** → **API**
2. Copy your:
   - **Project URL** - Use this for `SUPABASE_URL`
   - **Anon/Public key** - Use this for `SUPABASE_ANON_KEY`

### 4. Configure Environment Variables

#### Server `.env` (server/.env)
```
PORT=3001
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here
```

#### Client `.env` (client/.env)
```
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 5. Run the Application

```bash
# In the root directory
npm run dev  # or use your dev script

# Alternatively, run separately:
# Terminal 1: Start server
cd server
npm start

# Terminal 2: Start client (in a new terminal from client/)
cd client
npm run dev
```

## Testing the Migration

1. **Test Google Sign-In**:
   - Click "Sign in with Google" button
   - Complete the OAuth flow
   - Verify you're redirected back to the app
   - Verify the welcome screen is gone

2. **Test Canvas Operations**:
   - Create a new canvas
   - Draw something
   - Save the canvas
   - Verify it appears in the gallery
   - Load a saved canvas and verify data persists

3. **Test Session Persistence**:
   - Sign in and create a canvas
   - Refresh the page
   - Verify you're still signed in
   - Verify your canvases are still visible

4. **Test Sign Out**:
   - Click the user menu and sign out
   - Verify you're redirected to the welcome screen
   - Try signing in again with a different Google account

## Troubleshooting

### "Supabase configuration is missing" error
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `client/.env`
- The client app must be restarted after changing `.env` files

### "Invalid access token" errors
- Verify your Supabase credentials are correct
- Ensure Google OAuth provider is enabled in Supabase
- Check that your Google OAuth credentials are properly configured

### Canvas data not persisting
- Ensure all database tables and RLS policies are created
- Check Supabase logs for database errors
- Verify the authenticated user ID matches the owner_id in canvases table

### Socket authentication errors
- Ensure server `.env` has correct Supabase credentials
- Check that the access token is being sent from the client
- Verify `verifySupabaseToken()` is properly verifying tokens

## Key Differences from Previous Implementation

| Aspect | Before | After |
|--------|--------|-------|
| Auth Library | google-auth-library | @supabase/supabase-js |
| Token Type | ID Token | Access Token |
| Session Storage | localStorage + JWT | Supabase Session |
| Verification | Manual with OAuth2Client | Supabase Auth API |
| OAuth Flow | Manual handling | Supabase managed |
| Server Dependencies | JWT, OAuth2Client | None (simplified) |

## Security Improvements

1. **Token Handling**: Access tokens are managed by Supabase instead of manually
2. **Session Management**: Supabase automatically handles session refresh and expiration
3. **RLS Policies**: Database access is protected with row-level security policies
4. **Reduced Complexity**: Less authentication code to maintain means fewer security risks

## Next Steps

1. Set up monitoring/logging for authentication errors
2. Configure email verification if desired in Supabase settings
3. Test with multiple Google accounts
4. Set up automated backups for your Supabase database
5. Consider implementing additional security measures like 2FA

## Support

For issues with Supabase:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)

For issues with your application:
- Check browser console for errors
- Check server logs for socket/auth errors
- Review Supabase project logs in the dashboard
