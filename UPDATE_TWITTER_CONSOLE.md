# Update Twitter Developer Console - CRITICAL STEPS

Your Vercel deployment URL has been identified as:
```
https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app
```

## Step 1: Login to Twitter Developer Console

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Select your application
3. Navigate to "Settings"

## Step 2: Update Callback URLs

1. Find "Authentication Settings" section
2. Locate "Callback URLs" field
3. **REPLACE** the ngrok URL with this Vercel URL:
   ```
   https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app/api/auth/twitter/callback
   ```

4. Also update these fields if they have ngrok URLs:
   - **Website URL**: `https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app`
   - **Terms of Service URL**: (keep as is or update)
   - **Privacy Policy URL**: (keep as is or update)

5. Click "Save" button

## Step 3: Update Vercel Environment Variables

Make sure these 3 variables are set in Vercel Settings → Environment Variables:

```
TWITTER_CONSUMER_KEY=qeDDjx2mu3KgemuN0e4orMDf2
TWITTER_CONSUMER_SECRET=<your_actual_secret>
TWITTER_CALLBACK_URL=https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app/api/auth/twitter/callback
```

## Step 4: Redeploy

Push a change or manually trigger redeploy in Vercel dashboard:
- Go to Deployments
- Click the latest deployment
- Click "Redeploy"

## Step 5: Test

1. Open your app in browser: https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app
2. Click "Connect Twitter" button
3. Should redirect to Twitter authorization page
4. After authorizing, should come back to your app

## Troubleshooting

If still getting 400 Bad Request error:

1. **Verify Callback URL**: Make sure it EXACTLY matches what you set in Twitter Console
   - No trailing slashes
   - Exact case sensitivity
   - Full URL including `https://`

2. **Check Environment Variables**: 
   - Go to Vercel dashboard → Settings → Environment Variables
   - Verify all 3 variables are present and correct
   - Click "Redeploy" after making changes

3. **Clear Browser Cache**:
   - Press F12 → Right-click refresh button → "Empty cache and hard refresh"
   - Or use Ctrl+Shift+Delete to clear cache

4. **Wait for Deployment**:
   - Changes can take 30-60 seconds to propagate
   - Check deployment status in Vercel

## Common Issues

### 400 Bad Request Error
- Usually means callback URL doesn't match exactly
- Double-check spacing, protocols, domains

### MIME type error
- This is from Twitter's assets loading, usually not a blocker
- Keep trying, might be temporary Twitter issue

### State mismatch error
- Means callback request is malformed
- Verify all credentials are correct in both Twitter Console and Vercel

---

**After completing these steps, your Twitter OAuth should work!**

If still having issues, send a screenshot of:
1. Twitter Console → Settings → Authentication Settings (show Callback URL)
2. Vercel Dashboard → Settings → Environment Variables (hide secret key value)
3. Browser Console → Error message
