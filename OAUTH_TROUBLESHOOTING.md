# Twitter OAuth Troubleshooting Guide

Panduan lengkap untuk mengatasi masalah setup Twitter OAuth.

## Common Issues & Solutions

### 1. "Not a valid URL format" di Twitter Developer Console

**Problem:** Twitter Developer Console menolak callback URL dengan pesan "Not a valid URL format"

**Root Cause:** Twitter hanya menerima URL dengan domain publik (HTTPS), bukan localhost

**Solutions:**

✅ **Option 1: Gunakan ngrok (Recommended)**
```bash
# Install ngrok
brew install ngrok  # macOS
# atau download dari https://ngrok.com/download

# Run ngrok
ngrok http 5173

# Copy URL dan update di .env dan Twitter Console
# Contoh: https://abc-123.ngrok-free.dev
```

✅ **Option 2: Gunakan LocalTunnel**
```bash
npm install -g localtunnel

lt --port 5173
# Copy URL dan gunakan seperti ngrok
```

✅ **Option 3: Deploy ke Staging**
- Deploy aplikasi ke Vercel atau hosting lain
- Gunakan production URL untuk Twitter Console
- Test OAuth dengan production URL

### 2. "Invalid state parameter" Error

**Problem:** Setelah authorize di Twitter, muncul error "Invalid state parameter"

**Root Causes:**
- State cache sudah expired (> beberapa menit)
- Browser membuat request baru ke callback URL
- Backend server tidak running

**Solutions:**

✅ **Restart OAuth Flow**
```
1. Refresh halaman atau buka tab baru
2. Klik "Link Twitter Account" lagi
3. Complete flow dari awal
```

✅ **Check Backend Server Running**
```bash
# Terminal 1: Check if backend is running
curl http://localhost:3001/health

# If not running, start it:
npm run dev:server
```

✅ **Clear Cache & Cookies**
```javascript
// Di browser console
sessionStorage.clear()
localStorage.clear()
```

✅ **Increase State Timeout** (Production)
```typescript
// Di server.ts, ubah cleanup timeout
const STATE_EXPIRY_MS = 15 * 60 * 1000; // 15 menit

// Add cleanup timer
setTimeout(() => {
  oauthStates.delete(state);
}, STATE_EXPIRY_MS);
```

### 3. "Access token endpoint error" / "Failed to exchange code"

**Problem:** Backend error saat exchange authorization code untuk access token

**Root Causes:**
- Consumer Secret salah atau tidak setup
- Callback URL tidak match dengan Twitter Console
- Twitter API rate limit tercapai
- Network connectivity issue

**Solutions:**

✅ **Verify Credentials**
```bash
# Check .env file
cat .env | grep TWITTER

# Ensure tidak ada whitespace atau typo
TWITTER_CONSUMER_KEY=exact_key_from_twitter
TWITTER_CONSUMER_SECRET=exact_secret_from_twitter
```

✅ **Verify Callback URL Match**
```
.env:
TWITTER_CALLBACK_URL=https://abc-123.ngrok-free.dev/auth/twitter/callback

Twitter Developer Console:
Callback URL = https://abc-123.ngrok-free.dev/auth/twitter/callback

MUST match exactly!
```

✅ **Check Network Requests**
```javascript
// Di browser DevTools:
1. Open Network tab
2. Click "Link Twitter Account"
3. Look for POST request ke `/auth/twitter/request`
4. Check response status & body
5. If error, check server terminal untuk details
```

✅ **Check Server Logs**
```bash
# Terminal dengan dev:server running
# Look untuk error messages seperti:
# "OAuth callback error: invalid_request"
# "OAuth callback error: invalid_grant"
```

### 4. "Backend server tidak connecting" / Port 3001 already in use

**Problem:** Backend server gagal start atau frontend tidak bisa connect ke backend

**Root Causes:**
- Port 3001 sudah digunakan process lain
- Environment variable PORT sudah set
- Backend server crash atau tidak running

**Solutions:**

✅ **Find Process Using Port 3001**
```bash
# macOS/Linux
lsof -i :3001

# Windows
netstat -ano | findstr :3001

# Kill process if needed
kill -9 <PID>
```

✅ **Use Different Port**
```bash
# Option 1: Kill existing process and start fresh
kill $(lsof -t -i :3001)
npm run dev:server

# Option 2: Use different port
OAUTH_SERVER_PORT=3002 npm run dev:server
```

✅ **Check Node/npm Installation**
```bash
node --version  # Should be v16+
npm --version   # Should be v8+
```

✅ **Reinstall Dependencies**
```bash
rm -rf node_modules pnpm-lock.yaml
npm install
npm run dev:server
```

### 5. "ngrok URL changed" / Session invalidated after ngrok restart

**Problem:** Setelah restart ngrok, URL berubah dan OAuth tidak berfungsi

**Root Cause:** ngrok memberikan URL baru setiap restart (dengan free plan)

**Solutions:**

✅ **Update Configurations**
```bash
# 1. Run ngrok, copy new URL
ngrok http 5173
# New URL: https://new-abc-123.ngrok-free.dev

# 2. Update .env
TWITTER_CALLBACK_URL=https://new-abc-123.ngrok-free.dev/auth/twitter/callback

# 3. Update Twitter Developer Console
# Go to Settings → Authentication Settings
# Update Callback URLs dengan URL baru

# 4. Restart all dev servers
npm run dev:all
```

✅ **Use ngrok Static URL** (Paid Feature)
```bash
# Upgrade ke paid ngrok account untuk static URL
# atau gunakan custom domain
ngrok http --domain=your-custom-domain.ngrok.io 5173
```

✅ **Use Alternative Tunneling**
```bash
# Try Cloudflare Tunnel (free, mais stable)
npm install -g @cloudflare/wrangler
wrangler tunnel --url http://localhost:5173
```

### 6. "Callback URL mismatch" Error

**Problem:** Error "The redirect_uri provided is not registered" pada Twitter OAuth

**Root Causes:**
- Exact URL mismatch (missing slash, trailing slash, http vs https)
- Typo dalam URL
- Whitespace di environment variable

**Solutions:**

✅ **Double-Check URL Format**
```
CORRECT:   https://abc-123.ngrok-free.dev/auth/twitter/callback
WRONG:     https://abc-123.ngrok-free.dev/auth/twitter/callback/  (trailing slash)
WRONG:     http://abc-123.ngrok-free.dev/auth/twitter/callback    (http instead of https)
WRONG:     https://abc-123.ngrok-free.dev/auth/twitter/callback?  (query string)
```

✅ **Remove Whitespace**
```bash
# ❌ WRONG - Extra spaces
TWITTER_CALLBACK_URL = https://abc-123.ngrok-free.dev/auth/twitter/callback

# ✅ CORRECT
TWITTER_CALLBACK_URL=https://abc-123.ngrok-free.dev/auth/twitter/callback
```

✅ **Verify in Twitter Console**
```
1. Go to https://developer.twitter.com/en/portal/dashboard
2. Click app name
3. Go to Settings → Authentication Settings
4. Check Callback URLs section
5. Ensure exact match with .env
```

### 7. "CORS" or "Network Error" Attempting to Reach Backend

**Problem:** Frontend tidak bisa connect ke backend server (CORS error atau network error)

**Root Causes:**
- Backend server tidak running
- CORS tidak dikonfigurasi dengan benar
- Port 3001 tidak accessible
- Firewall/security issue

**Solutions:**

✅ **Check Backend Running**
```bash
# Terminal 1
curl http://localhost:3001/health

# If 200 OK, backend is running
# If connection refused, backend not running
# Start with: npm run dev:server
```

✅ **Check CORS Configuration**
```typescript
// server.ts - verify CORS setup
app.use(cors({
  origin: ['http://localhost:5173', 'https://unafraid-defection-bobble.ngrok-free.dev'],
  credentials: true
}));
```

✅ **Update CORS for ngrok URL**
```typescript
// If using ngrok, add to cors origin:
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://your-ngrok-url.ngrok-free.dev'
  ],
  credentials: true
}));
```

✅ **Check Browser Network Tab**
```javascript
// DevTools → Network tab
1. Click "Link Twitter Account"
2. Look for request to http://localhost:3001/auth/twitter/request
3. Check response status & body
4. If CORS error, check server console
```

### 8. "sessionStorage is undefined" or Browser Console Errors

**Problem:** JavaScript errors dalam browser console tentang sessionStorage atau OAuth variables

**Root Causes:**
- Incompatible browser atau extension blocking
- React Strict Mode double-rendering
- Server-side rendering context

**Solutions:**

✅ **Check Browser Compatibility**
```javascript
// Di browser console
typeof sessionStorage  // Should be "object" not "undefined"

// If undefined, try different browser
```

✅ **Handle React Strict Mode**
```typescript
// In development, React Strict Mode renders twice
// Add check di twitterOAuthService.ts:
if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
  sessionStorage.setItem('twitter_access_token', accessToken);
}
```

✅ **Disable Browser Extensions**
```
Temporarily disable extensions yang mungkin block cookies/storage
Banyak security extensions block sessionStorage
```

### 9. "Infinite Redirect Loop"

**Problem:** Page terus-terusan redirect atau loading

**Root Causes:**
- OAuth state validation bug
- Callback URL misconfiguration
- Browser redirect issue

**Solutions:**

✅ **Clear Cache dan Hard Refresh**
```bash
# Browser DevTools
1. Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Open Network tab
3. Disable cache
4. Try again
```

✅ **Check Backend Logs**
```bash
# Terminal with dev:server
# Look untuk redirect loop patterns
# Should see: GET /auth/twitter/request
# Then: POST to Twitter
# Then: GET /auth/twitter/callback
```

✅ **Add Debug Logging**
```typescript
// Di twitterOAuthService.ts
async authenticate() {
  console.log('[v0] Starting OAuth flow...');
  const { authUrl } = await this.getAuthorizationUrl();
  console.log('[v0] Auth URL:', authUrl);
  window.location.href = authUrl;
}
```

### 10. "Token Validation Failed" or Session Expired

**Problem:** Setelah login berhasil, muncul error "Token validation failed"

**Root Causes:**
- OAUTH_TOKEN_SECRET tidak match antara server dan request
- Session sudah expired
- Database state tidak tersimpan (production)

**Solutions:**

✅ **Regenerate OAUTH_TOKEN_SECRET**
```bash
# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env
OAUTH_TOKEN_SECRET=new_generated_secret

# Restart servers
npm run dev:all
```

✅ **Increase Session Timeout**
```typescript
// Di server.ts
const STATE_EXPIRY_MS = 30 * 60 * 1000; // 30 menit instead of default

setTimeout(() => {
  oauthStates.delete(state);
}, STATE_EXPIRY_MS);
```

✅ **Add Better Error Logging**
```typescript
// Di /auth/twitter/validate endpoint
console.log('[v0] Token validation:', { token, userId });
console.log('[v0] Expected token pattern:', expectedToken.substring(0, 20) + '...');
```

## Debug Checklist

Gunakan checklist ini untuk troubleshooting sistematis:

- [ ] ngrok running dengan benar? (`ngrok http 5173`)
- [ ] .env file punya credentials yang benar?
- [ ] Backend server running? (`npm run dev:server`)
- [ ] Frontend server running? (`npm run dev`)
- [ ] Callback URL match di .env dan Twitter Console?
- [ ] Browser cache cleared? (`Ctrl+Shift+R`)
- [ ] Port 3001 tidak digunakan process lain? (`lsof -i :3001`)
- [ ] ngrok URL updated di .env dan Twitter Console?
- [ ] CORS dikonfigurasi dengan benar?
- [ ] Network request success di DevTools?

## Advanced Debugging

### Enable Verbose Logging
```typescript
// Add di server.ts
import debug from 'debug';
const log = debug('oauth:*');

log('OAuth request initialized with state:', state);
```

### Monitor Network Traffic
```bash
# Menggunakan Charles Proxy atau Burp Suite
# Atau gunakan curl untuk simulate requests
curl -v https://twitter.com/i/oauth2/authorize?...
```

### Test Backend Manually
```bash
# Test authorization URL generation
curl http://localhost:3001/auth/twitter/request

# Test token validation
curl -X POST http://localhost:3001/auth/twitter/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "test_token", "userId": "12345"}'
```

## Getting Help

Jika masih ada masalah:

1. **Check Documentation**
   - `TWITTER_OAUTH_QUICK_START.md` - Setup cepat
   - `TWITTER_OAUTH_SETUP.md` - Detail lengkap
   - `OAUTH_IMPLEMENTATION_SUMMARY.md` - Architecture overview

2. **Check Browser Console**
   - F12 → Console
   - Look untuk error messages dengan `[v0]` prefix

3. **Check Server Logs**
   - Terminal dengan `npm run dev:server`
   - Look untuk error patterns

4. **Enable Debug Mode**
   ```bash
   DEBUG=oauth:* npm run dev:server
   ```

5. **Contact Support**
   - Siapkan: Error message, console logs, server logs
   - Siapkan: .env file (tanpa secrets)
   - Siapkan: Steps to reproduce

---

**Last Updated:** 2026-07-10
**Version:** 1.0
**Status:** Comprehensive troubleshooting guide
