# Twitter OAuth Production Fix - Action Items

## The Problem

You're seeing this error in console F12:
```
GET http://localhost:3001/auth/twitter/request net::ERR_CONNECTION_REFUSED
```

This happens because the app is trying to connect to a backend server at `localhost:3001` that doesn't exist in production.

## The Solution

We've already fixed the code! Now you just need to configure environment variables in Vercel.

### What Changed in the Code

1. **OAuth Service** - Now properly detects production environment and uses direct OAuth flow
2. **API Route** - `/api/auth/twitter/callback` handles the OAuth token exchange
3. **Environment Detection** - Skips localhost:3001 call when not running locally

### What You Need to Do

#### Step 1: Update Callback URL in Twitter Developer Console

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Find your app settings
3. Go to **Authentication settings**
4. Update **Callback URLs** field to your ACTUAL Vercel deployment URL:
   ```
   https://your-real-base-project.vercel.app/api/auth/twitter/callback
   ```
   
   (Replace `your-real-base-project` with your actual Vercel project name)

#### Step 2: Set Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your `real-base-2026` project
3. Click **Settings**
4. Click **Environment Variables** (left sidebar)
5. Add these 3 variables (click "Add" for each):

**Variable 1:**
- Name: `TWITTER_CONSUMER_KEY`
- Value: `qeDDjx2mu3KgemuN0e4orMDf2`
- Environments: Production, Preview, Development

**Variable 2:**
- Name: `TWITTER_CONSUMER_SECRET`
- Value: `[your actual secret from Twitter Console]`
- Environments: Production, Preview, Development

**Variable 3:**
- Name: `TWITTER_CALLBACK_URL`
- Value: `https://your-real-base-project.vercel.app/api/auth/twitter/callback`
- Environments: Production, Preview, Development

#### Step 3: Redeploy

After setting environment variables:
- Push code changes to GitHub (Vercel will auto-deploy)
- OR manually trigger redeploy from Vercel dashboard

#### Step 4: Test

1. Open your deployed app in browser
2. Open Console (F12)
3. Click "Connect Twitter"
4. Check console - should see:
   ```
   [OAuth] Starting authentication flow...
   [OAuth] Environment: PRODUCTION
   [OAuth] Using direct Twitter OAuth flow
   [OAuth] Client ID: ✓ SET
   [OAuth] Callback URL: https://your-real-base-project.vercel.app/api/auth/twitter/callback
   ```

5. Should redirect to Twitter authorization page
6. After approval, redirects back to your app

### Common Issues & Fixes

**Issue: Still seeing localhost:3001 error**
- Solution: Verify environment variables are set in Vercel (Settings → Environment Variables)
- Also verify you redeployed after setting variables

**Issue: "Client ID: ✗ MISSING"**
- Solution: VITE_ prefixed environment variables must be exposed in Vite config
- The app already handles this, just make sure base env vars are set

**Issue: "You weren't able to give access to the App" from Twitter**
- Solution: Callback URL doesn't match
- Check Callback URL is identical in:
  1. Twitter Developer Console
  2. Vercel Environment Variable (TWITTER_CALLBACK_URL)
  3. Console logs (shows actual URL being used)

**Issue: API route not found (404)**
- Solution: Vercel needs to recognize `/api/` as serverless functions
- This is automatic - just make sure you redeployed

### How It Works Now

1. User clicks "Connect Twitter" button
2. App generates PKCE code challenge
3. Redirects to Twitter authorization: `https://twitter.com/i/oauth2/authorize?...`
4. User approves app access
5. Twitter redirects to: `https://your-app.vercel.app/api/auth/twitter/callback?code=...&state=...`
6. Vercel API route exchanges `code` for `access_token`
7. API route redirects back with user data: `https://your-app.vercel.app?oauth_user=...`
8. App processes user data and completes login

### Verification Checklist

Before testing, verify all of these are done:

- [ ] Vercel environment variables set (TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_CALLBACK_URL)
- [ ] Twitter Console callback URL updated to match Vercel URL
- [ ] App redeployed after environment changes
- [ ] Vercel URL in callback matches exactly (no trailing slashes, correct domain)
- [ ] Twitter app still has Consumer Key and Secret (didn't regenerate)

Once all checked, Twitter OAuth will work!

### Get Your URLs

Find your actual Vercel deployment URL:
- Go to https://vercel.com/dashboard
- Click your project
- Copy URL from project card (e.g., `https://real-base-2026-5m3h.vercel.app`)
- Use this in both Twitter Console and environment variables

---

**Questions?** Check the console logs - they provide detailed debug information about what's happening at each step!
