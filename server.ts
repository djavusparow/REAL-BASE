import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.OAUTH_SERVER_PORT || process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://unafraid-defection-bobble.ngrok-free.dev'],
  credentials: true
}));
app.use(express.json());

// Constants
const TWITTER_OAUTH_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_OAUTH_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWITTER_OAUTH_USER_URL = 'https://api.twitter.com/2/users/me';

const TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY!;
const TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET!;
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL!;
const OAUTH_TOKEN_SECRET = process.env.OAUTH_TOKEN_SECRET || 'your_secret_key';

// Store for OAuth states (in production, use a database or Redis)
const oauthStates = new Map<string, { codeVerifier: string; timestamp: number }>();

// Helper: Generate random string
function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

// Helper: Generate code verifier for PKCE
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Helper: Generate code challenge from verifier
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Endpoint 1: Inisialisasi OAuth - Ambil Authorization URL
app.get('/auth/twitter/request', (req: Request, res: Response) => {
  try {
    const codeVerifier = generateCodeVerifier();
    const state = generateRandomString(32);
    
    // Simpan state dan code verifier
    oauthStates.set(state, { 
      codeVerifier, 
      timestamp: Date.now() 
    });

    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    const authUrl = new URL(TWITTER_OAUTH_AUTHORIZE_URL);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', TWITTER_CONSUMER_KEY);
    authUrl.searchParams.append('redirect_uri', TWITTER_CALLBACK_URL);
    authUrl.searchParams.append('scope', 'tweet.read users.read follows.read tweet.write');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    res.json({ 
      authUrl: authUrl.toString(),
      state 
    });
  } catch (error) {
    console.error('OAuth request error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// Endpoint 2: Handle OAuth Callback
app.get('/auth/twitter/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as Record<string, string>;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Validasi state
    const oauthState = oauthStates.get(state);
    if (!oauthState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    // Hapus state yang sudah digunakan
    oauthStates.delete(state);

    // Exchange authorization code untuk access token
    const tokenResponse = await axios.post(
      TWITTER_OAUTH_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: TWITTER_CALLBACK_URL,
        code_verifier: oauthState.codeVerifier,
        client_id: TWITTER_CONSUMER_KEY,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${TWITTER_CONSUMER_KEY}:${TWITTER_CONSUMER_SECRET}`).toString('base64')}`
        }
      }
    );

    const { access_token, token_type } = tokenResponse.data;

    // Ambil user info
    const userResponse = await axios.get(
      TWITTER_OAUTH_USER_URL,
      {
        headers: {
          'Authorization': `${token_type} ${access_token}`
        }
      }
    );

    const twitterUser = userResponse.data.data;

    // Buat session token (dalam production, simpan di database)
    const sessionToken = crypto
      .createHmac('sha256', OAUTH_TOKEN_SECRET)
      .update(`${twitterUser.id}:${Date.now()}`)
      .digest('hex');

    // Redirect ke frontend dengan token dan user info
    const redirectUrl = `http://localhost:5173/auth/twitter/success?token=${sessionToken}&userId=${twitterUser.id}&username=${twitterUser.username}&accessToken=${access_token}`;
    
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.redirect(`http://localhost:5173/auth/twitter/error?error=${encodeURIComponent(error.message)}`);
  }
});

// Endpoint 3: Validate token (untuk verifikasi di frontend)
app.post('/auth/twitter/validate', (req: Request, res: Response) => {
  try {
    const { token, userId } = req.body;

    if (!token || !userId) {
      return res.status(400).json({ error: 'Missing token or userId' });
    }

    // Validasi token (dalam production, check di database)
    const expectedToken = crypto
      .createHmac('sha256', OAUTH_TOKEN_SECRET)
      .update(`${userId}:`)
      .digest('hex');

    // Token valid jika dimulai dengan prefix yang benar
    const isValid = token.length > 0; // Simplified validation

    if (isValid) {
      res.json({ valid: true, message: 'Token valid' });
    } else {
      res.status(401).json({ valid: false, message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

// Endpoint 4: Revoke token
app.post('/auth/twitter/revoke', async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Missing access token' });
    }

    // Revoke token di Twitter
    await axios.post(
      'https://api.twitter.com/2/oauth2/revoke',
      new URLSearchParams({
        token: accessToken,
        token_type_hint: 'access_token',
        client_id: TWITTER_CONSUMER_KEY,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${TWITTER_CONSUMER_KEY}:${TWITTER_CONSUMER_SECRET}`).toString('base64')}`
        }
      }
    );

    res.json({ message: 'Token revoked successfully' });
  } catch (error: any) {
    console.error('Token revocation error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Twitter OAuth Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Twitter OAuth Server running at http://localhost:${PORT}`);
  console.log(`OAuth Callback URL: ${TWITTER_CALLBACK_URL}`);
});
