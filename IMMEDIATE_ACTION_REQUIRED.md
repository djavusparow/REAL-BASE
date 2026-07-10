# IMMEDIATE ACTION REQUIRED - Twitter OAuth Fix

## Your Setup:

- **Vercel App URL**: https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app
- **OAuth Callback URL**: https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app/api/auth/twitter/callback
- **Consumer Key**: qeDDjx2mu3KgemuN0e4orMDf2

## The Problem:

Your app is still using the old **ngrok callback URL** which was registered with Twitter:
```
https://unafraid-defection-bobble.ngrok-free.dev/auth/twitter/callback
```

But your app is now deployed on Vercel with a NEW URL. Twitter is rejecting the OAuth request because the callback URL doesn't match what was registered.

## Solution in 3 Steps:

### STEP 1: Update Twitter Developer Console (2 minutes)

1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Click your app
3. Go to Settings → Authentication Settings
4. Find "Callback URLs" field
5. Replace ngrok URL with your Vercel URL:
   ```
   https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app/api/auth/twitter/callback
   ```
6. Also update "Website URL" to:
   ```
   https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app
   ```
7. Click "Save"

### STEP 2: Verify Vercel Environment Variables (1 minute)

1. Go to: https://vercel.com/dashboard
2. Open your project
3. Click Settings → Environment Variables
4. Verify these 3 are set (they should be):
   - `TWITTER_CONSUMER_KEY` = qeDDjx2mu3KgemuN0e4orMDf2
   - `TWITTER_CONSUMER_SECRET` = [your secret]
   - `TWITTER_CALLBACK_URL` = https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app/api/auth/twitter/callback

### STEP 3: Redeploy (1 minute)

1. Go to Vercel Deployments
2. Click the latest deployment
3. Click "Redeploy" button
4. Wait for deployment to complete (green checkmark)

## Total Time: ~5 minutes

---

## Then Test:

1. Open: https://real-base-2026-41yg9cddp-moneyzks-projects.vercel.app
2. Click "Connect Twitter" button
3. Should redirect to Twitter authorization page
4. Grant permission
5. Should redirect back and show success

---

## If Still Not Working:

Send screenshot showing:
- [ ] Twitter Console Callback URL (exact value)
- [ ] Vercel Environment Variables (with secret masked)
- [ ] Browser console F12 error message
