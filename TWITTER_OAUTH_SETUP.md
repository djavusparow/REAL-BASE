# Twitter OAuth Integration Setup Guide

Panduan lengkap untuk setup Twitter OAuth di aplikasi Real Base 2026.

## Prerequisites

1. **ngrok** - Untuk membuat public URL dari localhost
   - Download: https://ngrok.com/download
   - Jalankan: `ngrok http 5173`

2. **Twitter Developer Account** - Dengan API credentials
   - Consumer Key (API Key)
   - Consumer Secret (API Secret)

## Step 1: Konfigurasi Twitter Developer Console

### 1. Buka Twitter Developer Portal
```
https://developer.twitter.com/en/portal/dashboard
```

### 2. Setup Authentication Settings
Di aplikasi Twitter Anda:
1. Buka "App Settings"
2. Cari "Authentication Settings"
3. Enable "OAuth 2.0"
4. Setup berikut:

**Callback URLs:**
```
https://your-ngrok-url.ngrok-free.dev/auth/twitter/callback
```

**Website URL:**
```
https://your-ngrok-url.ngrok-free.dev
```

**Terms of Service URL:**
```
https://your-ngrok-url.ngrok-free.dev
```

**Privacy Policy URL:**
```
https://your-ngrok-url.ngrok-free.dev
```

### 3. Salin Credentials
Dari "Keys and Tokens" tab, ambil:
- API Key (Consumer Key)
- API Secret (Consumer Secret)

## Step 2: Konfigurasi Environment Variables

### Update `.env` file:

```env
# Twitter OAuth Credentials
TWITTER_CONSUMER_KEY=your_api_key_here
TWITTER_CONSUMER_SECRET=your_api_secret_here
TWITTER_CALLBACK_URL=https://your-ngrok-url.ngrok-free.dev/auth/twitter/callback
OAUTH_TOKEN_SECRET=your_random_secret_key_here
```

**Cara generate `OAUTH_TOKEN_SECRET`:**
```bash
# Di terminal, jalankan:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Setup ngrok

### Terminal 1 - Jalankan ngrok:
```bash
ngrok http 5173
```

Anda akan melihat output seperti:
```
Forwarding    https://abc-123.ngrok-free.dev -> http://localhost:5173
```

Simpan URL ini untuk Step 1.

## Step 4: Jalankan Aplikasi

### Terminal 2 - Jalankan dev server + backend:
```bash
npm run dev:all
```

Atau jalankan secara terpisah:

**Terminal 2:**
```bash
npm run dev
# Frontend akan berjalan di http://localhost:5173
```

**Terminal 3:**
```bash
npm run dev:server
# Backend OAuth server akan berjalan di http://localhost:3001
```

## Step 5: Test Twitter Login Flow

### 1. Buka aplikasi di browser:
```
https://your-ngrok-url.ngrok-free.dev
```

### 2. Klik "Link Twitter Account"
- Anda akan diarahkan ke Twitter authorization page
- Login dengan akun Twitter Anda
- Approve akses untuk aplikasi

### 3. Redirect & Success
- Anda akan diredirect kembali ke aplikasi
- Lihat loading screen untuk "Completing Twitter Authentication"
- Setelah selesai, akan redirect ke dashboard

## Architecture Overview

### Backend OAuth Server (`server.ts`)

**Endpoints:**

1. **GET /auth/twitter/request**
   - Generate authorization URL dengan PKCE
   - Return: `{ authUrl, state }`

2. **GET /auth/twitter/callback**
   - Handle OAuth callback dari Twitter
   - Exchange authorization code untuk access token
   - Return: User info + session token

3. **POST /auth/twitter/validate**
   - Validasi session token
   - Payload: `{ token, userId }`

4. **POST /auth/twitter/revoke**
   - Revoke access token saat logout
   - Payload: `{ accessToken }`

### Frontend Service (`services/twitterOAuthService.ts`)

**Main Methods:**

1. `authenticate()` - Inisiasi OAuth flow
2. `handleCallbackResponse(params)` - Process callback response
3. `scanPosts(handle)` - Scan Twitter posts (mock implementation)
4. `logout()` - Revoke token dan logout

### App Flow

```
User clicks "Link Twitter" 
  ↓
twitterOAuthService.authenticate()
  ↓
Get Authorization URL from server
  ↓
Redirect to Twitter
  ↓
User authorizes app
  ↓
Twitter redirects to callback URL
  ↓
Server exchanges code for token
  ↓
Server redirects to /auth/twitter/success
  ↓
App processes callback
  ↓
Redirect to dashboard
```

## Troubleshooting

### "Not a valid URL format" error
- Pastikan Anda menggunakan HTTPS URL dari ngrok
- Contoh yang benar: `https://abc-123.ngrok-free.dev`
- Contoh yang salah: `http://localhost:5173`

### "Invalid state parameter" error
- State cache mungkin sudah expired (lebih dari beberapa menit)
- Coba ulangi login process

### "Access token expired" error
- Backend OAuth server mungkin tidak running
- Jalankan: `npm run dev:server`
- Atau cek apakah port 3001 sudah digunakan

### ngrok URL berubah
- Setiap kali ngrok di-restart, URL berubah
- Update callback URL di Twitter Developer Console
- Update `TWITTER_CALLBACK_URL` di `.env`

## Production Deployment

Untuk production, beberapa perubahan diperlukan:

1. **Database untuk state management**
   - Ganti `oauthStates` Map dengan database
   - Tambah TTL untuk keamanan

2. **Token storage**
   - Gunakan secure HTTP-only cookies
   - Jangan simpan di sessionStorage

3. **Callback URL**
   - Update ke production domain
   - Gunakan HTTPS

4. **Error handling**
   - Log errors ke monitoring service
   - Jangan expose sensitive info ke frontend

5. **Rate limiting**
   - Tambah rate limiting pada OAuth endpoints

## References

- Twitter OAuth 2.0 Documentation: https://developer.twitter.com/en/docs/authentication/oauth-2-0
- PKCE Flow: https://datatracker.ietf.org/doc/html/rfc7636
- ngrok Documentation: https://ngrok.com/docs

## Support

Jika mengalami masalah:
1. Check console log di browser (F12 → Console)
2. Check terminal output dari backend server
3. Verify credentials di .env file
4. Ensure ngrok URL matches di Twitter Developer Console
