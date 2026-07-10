# Twitter OAuth Setup untuk Vercel Deployment

## Masalah: "You weren't able to give access to the App"

Error ini biasanya disebabkan oleh:
1. **Callback URL mismatch** - URL di Twitter Console tidak cocok dengan app
2. **Environment variables tidak ter-set** - Credentials tidak ada di Vercel
3. **CORS/Domain issues** - Misconfiguration domain

## Solusi Step-by-Step

### Step 1: Tentukan Deployed URL

Cek URL Vercel deployment Anda:
- Buka https://vercel.com/dashboard
- Cari project "REAL-BASE"
- Copy URL deployment (contoh: `https://real-base-production.vercel.app`)

### Step 2: Update Twitter Developer Console

1. Buka https://developer.twitter.com/en/portal/dashboard
2. Pilih App Anda
3. Pergi ke "Settings" → "Authentication Settings"
4. Update **Callback URLs** dengan:
   ```
   https://your-vercel-url.vercel.app/api/auth/twitter/callback
   ```
   Contoh:
   ```
   https://real-base-production.vercel.app/api/auth/twitter/callback
   ```

5. Update **Website URL** dengan:
   ```
   https://your-vercel-url.vercel.app
   ```

6. Save perubahan

### Step 3: Set Environment Variables di Vercel

1. Buka project di Vercel dashboard
2. Pergi ke "Settings" → "Environment Variables"
3. Tambahkan 3 variables berikut:

```
TWITTER_CONSUMER_KEY = qeDDjx2mu3KgemuN0e4orMDf2
TWITTER_CONSUMER_SECRET = your_secret_here
TWITTER_CALLBACK_URL = https://your-vercel-url.vercel.app/api/auth/twitter/callback
```

**Penting:** 
- Ganti `your-vercel-url` dengan actual Vercel domain Anda
- Ganti `your_secret_here` dengan actual consumer secret dari Twitter

4. Klik "Save"

### Step 4: Redeploy Application

```bash
# Option 1: Push ke GitHub (jika connected)
git push origin main

# Option 2: Redeploy dari Vercel dashboard
# Di Vercel dashboard, klik "Redeploy"
```

### Step 5: Test OAuth Flow

1. Buka aplikasi di https://your-vercel-url.vercel.app
2. Klik "Connect Twitter"
3. Cek browser console (F12) untuk debug logs
4. Seharusnya redirect ke Twitter authorization page
5. Authorize akun Anda
6. Seharusnya redirect kembali ke app dengan user data

## Debug: Cek Console Logs

Saat Anda klik "Connect Twitter", buka browser console (F12) dan lihat logs:

```
[OAuth] ========== DEBUG INFO ==========
[OAuth] Client ID: ✓ SET
[OAuth] Callback URL: https://your-vercel-url.vercel.app/api/auth/twitter/callback
[OAuth] Scope: tweet.read users.read
[OAuth] App Origin: https://your-vercel-url.vercel.app
[OAuth] Redirecting to Twitter...
[OAuth] ===================================
```

Jika ada yang ✗ MISSING, berarti environment variable tidak ter-set.

## Troubleshooting

### Error: "Client ID: ✗ MISSING"
- **Cause**: `VITE_TWITTER_CONSUMER_KEY` tidak ter-set
- **Fix**: Set di environment variables Vercel sebagai `TWITTER_CONSUMER_KEY`
- **Note**: Vite akan otomatis expose sebagai `VITE_TWITTER_CONSUMER_KEY`

### Error: "Callback URL mismatch"
- **Cause**: Callback URL di app tidak match dengan Twitter Console
- **Fix**: 
  1. Verifikasi URL di Twitter Console sama dengan environment variable
  2. Pastikan tidak ada typo (contoh: `.vercel.app` bukan `.vercel.app/`)

### Error: "You weren't able to give access"
- **Cause 1**: Callback URL tidak match
- **Cause 2**: Credentials invalid/expired
- **Cause 3**: API route `/api/auth/twitter/callback` tidak working
- **Fix**: 
  1. Check console logs untuk callback URL
  2. Regenerate API keys dari Twitter Console
  3. Pastikan Vercel build berhasil tanpa error

### API Route Error
Cek Vercel deployment logs:
1. Buka Vercel dashboard
2. Project → "Deployments"
3. Klik deployment terbaru
4. Lihat tab "Functions" untuk error

## Environment Variables Reference

| Variable | Value | Source |
|----------|-------|--------|
| `TWITTER_CONSUMER_KEY` | API Key dari Twitter | Twitter Developer Console |
| `TWITTER_CONSUMER_SECRET` | API Secret dari Twitter | Twitter Developer Console |
| `TWITTER_CALLBACK_URL` | `https://your-domain.vercel.app/api/auth/twitter/callback` | Your Vercel URL |
| `VITE_TWITTER_CONSUMER_KEY` | Same as `TWITTER_CONSUMER_KEY` | Vite auto-expose |
| `VITE_TWITTER_CALLBACK_URL` | Same as `TWITTER_CALLBACK_URL` | Vite auto-expose |

## Vercel Build Environment

Vercel akan otomatis:
1. Expose `TWITTER_CONSUMER_KEY` sebagai `VITE_TWITTER_CONSUMER_KEY` untuk frontend
2. Keep `TWITTER_CONSUMER_SECRET` di server-side saja (API route)
3. Build aplikasi dengan environment variables

## Testing Locally

Untuk test di localhost:

1. Update `.env.development.local`:
```
VITE_TWITTER_CONSUMER_KEY=qeDDjx2mu3KgemuN0e4orMDf2
VITE_TWITTER_CALLBACK_URL=https://your-ngrok-url/api/auth/twitter/callback
TWITTER_CONSUMER_KEY=qeDDjx2mu3KgemuN0e4orMDf2
TWITTER_CONSUMER_SECRET=your_secret_here
TWITTER_CALLBACK_URL=https://your-ngrok-url/api/auth/twitter/callback
```

2. Run dengan ngrok:
```bash
ngrok http 5173
```

3. Update Twitter Console callback URL ke ngrok URL

4. Start dev server:
```bash
npm run dev
```

## Checklist Sebelum Test

- [ ] Twitter Developer Application dibuat
- [ ] API Key dan Secret sudah dikopi
- [ ] Callback URL di Twitter Console update dengan Vercel URL
- [ ] Website URL di Twitter Console update
- [ ] 3 environment variables di Vercel sudah di-set
- [ ] Aplikasi sudah di-redeploy (atau auto-deployed)
- [ ] Console logs menunjukkan "✓ SET" untuk credentials
- [ ] Dapat redirect ke Twitter authorization page

## Support

Jika masih error setelah semua step:

1. **Check Vercel Logs**: Lihat Deployments → Functions logs
2. **Check Twitter API Status**: https://developer.twitter.com/en/status
3. **Verify Credentials**: Copy-paste ulang dari Twitter Console
4. **Try Fresh**: Logout browser cache, try incognito mode
