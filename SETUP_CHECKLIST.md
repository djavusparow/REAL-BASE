# Twitter OAuth Setup Checklist

Panduan step-by-step untuk setup Twitter OAuth. Ikuti checklist ini untuk memastikan semuanya berjalan sempurna!

## Pre-Setup Requirements

Sebelum memulai, pastikan Anda memiliki:

- [ ] Node.js v16+ (check dengan `node --version`)
- [ ] npm/pnpm installed (check dengan `npm --version`)
- [ ] Twitter Developer Account (https://developer.twitter.com)
- [ ] ngrok installed (https://ngrok.com/download)

## Step 1: Persiapan Twitter Developer Account

### 1.1 Create/Access Developer Account
- [ ] Go to https://developer.twitter.com/en/portal/dashboard
- [ ] Login dengan Twitter account Anda
- [ ] Complete verification jika diperlukan

### 1.2 Create an Application
- [ ] Click "Create an App"
- [ ] Choose app name: "Real Base 2026" (atau nama pilihan Anda)
- [ ] Choose use case: "Making an app"
- [ ] Fill in app description
- [ ] Accept terms
- [ ] Wait untuk app creation selesai

### 1.3 Get API Credentials
- [ ] Di app page, klik "Keys and tokens" tab
- [ ] Copy **API Key** (juga disebut Consumer Key)
  - Simpan di file text sementara: `API_Key_here`
- [ ] Copy **API Secret Key** (juga disebut Consumer Secret)
  - Simpan di file text sementara: `API_Secret_here`

### 1.4 Setup Authentication Settings
- [ ] Di app settings, buka "Authentication settings"
- [ ] Enable **OAuth 2.0**
- [ ] Klik "Save"

## Step 2: Setup ngrok untuk Public URL

### 2.1 Install ngrok
- [ ] Download dari https://ngrok.com/download
- [ ] Extract / install ke system PATH
- [ ] Verify installation: `ngrok --version`

### 2.2 Generate Public URL
- [ ] Buka terminal baru
- [ ] Run: `ngrok http 5173`
- [ ] Tunggu sampai ngrok connected
- [ ] Copy forwarding URL dari output (contoh: `https://abc-123.ngrok-free.dev`)
- [ ] **PENTING:** Simpan URL ini untuk langkah berikutnya

**Console output akan terlihat seperti:**
```
ngrok                                       (Ctrl+C to quit)

Session Status                online
Account                       your-account
Version                       x.x.x
Region                        us (US)
Latency                       52ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc-123.ngrok-free.dev -> http://localhost:5173

Connections                   ttl     opn     rt1     rt5     p50     p95
                              0       0       0.00    0.00    0.00    0.00
```

- [ ] URL tersedia dan menunjukkan status "online"

## Step 3: Konfigurasi Twitter Developer Console

### 3.1 Setup Callback URL
- [ ] Kembali ke Twitter Developer Console
- [ ] Di app settings, scroll ke "Callback URLs"
- [ ] Paste ngrok URL dengan `/auth/twitter/callback`
  - Contoh: `https://abc-123.ngrok-free.dev/auth/twitter/callback`
- [ ] Click "Save"

### 3.2 Setup Additional URLs
- [ ] Di "Website URL" field: `https://abc-123.ngrok-free.dev`
- [ ] Di "Terms of Service URL": `https://abc-123.ngrok-free.dev`
- [ ] Di "Privacy Policy URL": `https://abc-123.ngrok-free.dev`
- [ ] Click "Save"

### 3.3 Verify Settings
- [ ] Kembali ke "Keys and tokens"
- [ ] Verify API Key dan Secret masih terlihat
- [ ] Note down credentials untuk langkah berikutnya

## Step 4: Update Environment Variables

### 4.1 Generate OAuth Secret
- [ ] Open terminal
- [ ] Run command:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Copy hasil output (contoh: `a1b2c3d4e5f6...`)

### 4.2 Update .env File
- [ ] Open `/vercel/share/v0-project/.env` file
- [ ] Update dengan nilai actual:

```env
TWITTER_CONSUMER_KEY=your_api_key_from_twitter
TWITTER_CONSUMER_SECRET=your_api_secret_from_twitter
TWITTER_CALLBACK_URL=https://your-ngrok-url.ngrok-free.dev/auth/twitter/callback
OAUTH_TOKEN_SECRET=generated_secret_from_above
```

- [ ] Replace dengan nilai actual Anda
- [ ] Pastikan tidak ada whitespace sebelum/sesudah nilai
- [ ] Save file

### 4.3 Verify .env Setup
- [ ] Open `.env` file
- [ ] Pastikan setiap line ada value yang benar
- [ ] Check untuk typo atau whitespace

## Step 5: Install Dependencies & Run Servers

### 5.1 Install Dependencies
- [ ] Open terminal di project directory
- [ ] Jalankan: `npm install` (atau `pnpm install`)
- [ ] Wait untuk dependencies terinstall
- [ ] Verify success (tidak ada error messages)

### 5.2 Start Development Servers
- [ ] **Terminal 1** (keep ngrok running):
  ```bash
  ngrok http 5173
  ```
  - [ ] Verifikasi status online

- [ ] **Terminal 2** (Frontend):
  ```bash
  npm run dev
  ```
  - [ ] Tunggu sampai "VITE v6.x.x ready in Xxx ms"
  - [ ] Should show: "Local: http://localhost:5173"

- [ ] **Terminal 3** (Backend OAuth Server):
  ```bash
  npm run dev:server
  ```
  - [ ] Tunggu sampai "Twitter OAuth Server running at http://localhost:3001"

### 5.3 Verify All Running
- [ ] ngrok: showing "online" status
- [ ] Frontend: accessible at http://localhost:5173
- [ ] Backend: running on http://localhost:3001
- [ ] Check health endpoint: `curl http://localhost:3001/health`

## Step 6: Test Twitter OAuth Flow

### 6.1 Open Application
- [ ] Open browser
- [ ] Go to: `https://your-ngrok-url.ngrok-free.dev`
  - (Use HTTPS ngrok URL, not localhost!)
- [ ] Should see Base Impression login page
- [ ] **IMPORTANT:** Use ngrok URL, NOT localhost

### 6.2 Test OAuth
- [ ] If already logged in via Farcaster, skip to next step
- [ ] If not logged in, click "Connect Farcaster" (or complete Farcaster login)
- [ ] After Farcaster login, click "Link Twitter Account"
- [ ] Should be redirected to Twitter authorization page

### 6.3 Authorize App
- [ ] On Twitter page, login jika belum login
- [ ] Click "Authorize app"
- [ ] Should be redirected kembali ke aplikasi
- [ ] See "Completing Twitter Authentication" loading message
- [ ] After ~2 seconds, redirected ke dashboard

### 6.4 Verify Success
- [ ] You're on the dashboard page
- [ ] See your Twitter handle displayed
- [ ] See "Twitter Linked" indicator
- [ ] See your Farcaster ID dan account info
- [ ] Click "Re-Calculate Points" and verify it works

## Step 7: Troubleshooting (If Needed)

### If You See Errors:

**Error: "Not a valid URL format"**
- [ ] Make sure using HTTPS in Twitter Console
- [ ] Make sure callback URL matches exactly (no typo)
- [ ] No trailing slashes

**Error: "Invalid state parameter"**
- [ ] Refresh page dan try again
- [ ] Check backend server still running
- [ ] Check console logs in browser (F12)

**Error: "Access token endpoint error"**
- [ ] Verify .env credentials are correct
- [ ] Check spelling of API Key dan Secret
- [ ] Clear browser cache (Ctrl+Shift+R)

**Backend not connecting**
- [ ] Check port 3001 is not in use: `lsof -i :3001`
- [ ] Restart backend server: `npm run dev:server`
- [ ] Check for error messages in terminal

**See more troubleshooting in:**
- [ ] `OAUTH_TROUBLESHOOTING.md` - Detailed troubleshooting guide
- [ ] `TWITTER_OAUTH_QUICK_START.md` - Quick reference

## Step 8: Next Steps

### For Development:
- [ ] Explore codebase structure
- [ ] Read `OAUTH_IMPLEMENTATION_SUMMARY.md` untuk understand architecture
- [ ] Test with different Twitter accounts
- [ ] Add error handling if needed

### For Production:
- [ ] Deploy to production server
- [ ] Update callback URL di Twitter Console ke production domain
- [ ] Setup HTTPS certificates
- [ ] Implement secure token storage
- [ ] Add database for session management
- [ ] Read deployment section di `TWITTER_OAUTH_SETUP.md`

## Quick Reference Commands

```bash
# Start everything
npm run dev:all

# Or start individually:
npm run dev              # Frontend
npm run dev:server       # Backend OAuth Server
ngrok http 5173         # ngrok (in separate terminal)

# Health check
curl http://localhost:3001/health

# Generate random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# View logs (backend)
npm run dev:server 2>&1 | grep -i error

# Clear cache
rm -rf node_modules pnpm-lock.yaml
npm install
```

## File References

| File | Purpose |
|------|---------|
| `.env` | Environment variables untuk credentials |
| `server.ts` | Backend OAuth server |
| `services/twitterOAuthService.ts` | Frontend OAuth service |
| `App.tsx` | Main app dengan OAuth integration |
| `TWITTER_OAUTH_SETUP.md` | Detailed setup guide |
| `TWITTER_OAUTH_QUICK_START.md` | Quick start reference |
| `OAUTH_IMPLEMENTATION_SUMMARY.md` | Architecture overview |
| `OAUTH_TROUBLESHOOTING.md` | Common issues & solutions |

## Success Indicators

✅ **All Setup Complete When:**
- [ ] ngrok URL accessible dan showing "online"
- [ ] Frontend running at http://localhost:5173
- [ ] Backend running at http://localhost:3001
- [ ] Dapat authorize dengan Twitter account
- [ ] Redirected ke dashboard setelah authorization
- [ ] Twitter handle displayed di application
- [ ] Dapat click "Re-Calculate Points" without error

## Support Resources

1. **Quick Setup:** `TWITTER_OAUTH_QUICK_START.md`
2. **Detailed Guide:** `TWITTER_OAUTH_SETUP.md`
3. **Troubleshooting:** `OAUTH_TROUBLESHOOTING.md`
4. **Architecture:** `OAUTH_IMPLEMENTATION_SUMMARY.md`
5. **Browser Console:** F12 → Console tab untuk error messages
6. **Server Logs:** Terminal dengan `npm run dev:server` output

---

**Estimated Setup Time:** 15-20 minutes
**Difficulty Level:** Intermediate
**Last Updated:** 2026-07-10

Good luck! 🚀
