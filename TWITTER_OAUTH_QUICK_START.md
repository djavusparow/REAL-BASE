# Quick Start: Twitter OAuth Integration

## 5 Menit Setup

### 1. Update `.env` file

```env
TWITTER_CONSUMER_KEY=qeDDjx2mu3KgemuN0e4orMDf2
TWITTER_CONSUMER_SECRET=<paste_your_secret_here>
TWITTER_CALLBACK_URL=https://unafraid-defection-bobble.ngrok-free.dev/auth/twitter/callback
OAUTH_TOKEN_SECRET=<generate_random_secret>
```

**Generate random secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Update Twitter Developer Console

Di https://developer.twitter.com/en/portal/dashboard

**Authentication Settings:**
- Callback URL: `https://unafraid-defection-bobble.ngrok-free.dev/auth/twitter/callback`
- Website URL: `https://unafraid-defection-bobble.ngrok-free.dev`

### 3. Jalankan ngrok

```bash
ngrok http 5173
```

Copy URL yang ditampilkan (contoh: `https://abc-123.ngrok-free.dev`)

### 4. Jalankan aplikasi

```bash
npm run dev:all
```

Atau secara terpisah:
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:server
```

### 5. Test

Buka browser: `https://unafraid-defection-bobble.ngrok-free.dev`

Klik "Link Twitter Account" dan follow prompt.

## Apa yang telah diimplementasikan?

✅ **Backend OAuth Server** - Express server dengan Twitter OAuth 2.0 flow
✅ **PKCE Security** - Code verifier & challenge untuk security
✅ **Frontend Service** - `twitterOAuthService` untuk OAuth communication
✅ **Callback Handler** - Proses redirect dari Twitter
✅ **Token Management** - Store & revoke access tokens
✅ **Error Handling** - User-friendly error messages

## File Structure

```
/
├── server.ts                          # Backend OAuth server
├── services/
│   ├── twitterOAuthService.ts        # OAuth client service
│   └── twitterService.ts             # Original mock service
├── pages/
│   └── TwitterOAuthCallback.tsx       # Callback page component
├── App.tsx                           # Main app with OAuth integration
├── .env                              # Environment variables
├── TWITTER_OAUTH_SETUP.md            # Detailed setup guide
└── TWITTER_OAUTH_QUICK_START.md      # This file
```

## What's Next?

Setelah Twitter OAuth working, Anda bisa:

1. **Integrate Real Twitter API**
   - Gunakan access token untuk fetch actual tweets
   - Scan untuk @base mentions
   - Calculate real baseposting points

2. **Store User Sessions**
   - Database untuk store user sessions
   - Persistent login across page refreshes

3. **Production Deployment**
   - Move to production domain
   - Setup secure token storage (HTTP-only cookies)
   - Add database for state management

## Common Issues

| Issue | Solution |
|-------|----------|
| "Not a valid URL format" | Use ngrok HTTPS URL, not localhost |
| Backend not connecting | Check port 3001 is free, run `npm run dev:server` |
| ngrok URL changed | Update `.env` and Twitter Developer Console |
| Access token expired | Restart the dev servers |

## Debug Tips

```javascript
// Check if OAuth token is stored
console.log(sessionStorage.getItem('twitter_access_token'))

// Check OAuth server is running
fetch('http://localhost:3001/health')

// Check window URL params
console.log(new URLSearchParams(window.location.search))
```

## Next Steps

1. Read `TWITTER_OAUTH_SETUP.md` untuk detailed setup guide
2. Check `services/twitterOAuthService.ts` untuk understand the flow
3. Modify `scanPosts()` untuk gunakan real Twitter API

---

Happy coding! 🚀
