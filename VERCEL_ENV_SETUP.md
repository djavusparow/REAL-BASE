# Vercel Environment Variables Setup for Twitter OAuth

## Critical: Environment Variables MUST be set in Vercel

Your Twitter OAuth will NOT work if environment variables are not properly configured in Vercel.

### Step 1: Get Your Credentials

Get these values from https://developer.twitter.com/en/portal/dashboard:

1. **API Key (Client ID)**: `qeDDjx2mu3KgemuN0e4orMDf2`
2. **API Secret (Client Secret)**: Your actual consumer secret (keep secret!)
3. **Callback URL**: Your Vercel deployment URL with `/api/auth/twitter/callback`

### Step 2: Set Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project: `real-base-2026`
3. Go to **Settings** → **Environment Variables**
4. Add these 3 variables:

```
TWITTER_CONSUMER_KEY=qeDDjx2mu3KgemuN0e4orMDf2
```

```
TWITTER_CONSUMER_SECRET=your_actual_secret_from_twitter
```

```
TWITTER_CALLBACK_URL=https://your-vercel-project-url.vercel.app/api/auth/twitter/callback
```

### Step 3: Update Twitter Developer Console

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Find your app
3. Go to **Settings** → **Authentication Settings**
4. Set **Callback URLs** to:
   ```
   https://your-vercel-project-url.vercel.app/api/auth/twitter/callback
   ```

### Step 4: Redeploy

After setting environment variables, trigger a redeploy:
- Push new code to GitHub
- OR manually redeploy from Vercel dashboard

### Step 5: Debug

1. Open your app in browser
2. Press F12 to open Developer Console
3. Click "Connect Twitter" button
4. Check console logs - you should see:
   ```
   [OAuth] Starting authentication flow...
   [OAuth] Environment: PRODUCTION
   [OAuth] Using direct Twitter OAuth flow
   [OAuth] ========== DEBUG INFO ==========
   [OAuth] Client ID: ✓ SET
   [OAuth] Callback URL: https://your-vercel-url/api/auth/twitter/callback
   [OAuth] Redirecting to Twitter...
   ```

5. Should redirect to https://twitter.com/i/oauth2/authorize?...

### Troubleshooting

**Error: "Client ID: ✗ MISSING"**
- Environment variables not set in Vercel
- Check Settings → Environment Variables in Vercel

**Error: "Failed to initiate Twitter login"**
- Callback URL doesn't match Twitter Console
- Check both Vercel app and Twitter Developer Console settings

**Error: "You weren't able to give access to the App"**
- Callback URL mismatch between Twitter Console and your app
- Verify exact URL match

### Verification Checklist

- [ ] API Key and Secret obtained from Twitter Developer Console
- [ ] Environment variables set in Vercel (all 3)
- [ ] Callback URL updated in Twitter Developer Console
- [ ] Callback URL matches between Vercel and Twitter Console exactly
- [ ] App redeployed after environment changes
- [ ] Console logs show `Client ID: ✓ SET` and correct callback URL

Once all steps are complete, Twitter OAuth should work properly!
