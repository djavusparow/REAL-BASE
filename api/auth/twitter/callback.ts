import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// Twitter OAuth endpoints
const TWITTER_OAUTH_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWITTER_USER_URL = 'https://api.twitter.com/2/users/me?user.fields=created_at,username';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    return res.status(200).end();
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const clientId = process.env.TWITTER_CONSUMER_KEY;
    const clientSecret = process.env.TWITTER_CONSUMER_SECRET;
    const redirectUri = process.env.TWITTER_CALLBACK_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/twitter/callback`;

    if (!clientId || !clientSecret) {
      console.error('Missing Twitter API credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('[OAuth Callback] Exchanging code for token...');
    console.log('[OAuth Callback] Redirect URI:', redirectUri);

    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      TWITTER_OAUTH_TOKEN_URL,
      {
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: req.body?.codeVerifier || 'challenge', // Simplified for PKCE
      },
      {
        auth: {
          username: clientId,
          password: clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenResponse.data;
    console.log('[OAuth Callback] Got access token');

    // Get user info
    const userResponse = await axios.get(TWITTER_USER_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const user = userResponse.data.data;
    console.log('[OAuth Callback] Got user:', user.username);

    // Return HTML page that redirects to the app with user data
    const appUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const redirectUrl = `${appUrl}/?oauth_user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      username: user.username,
      created_at: user.created_at,
      access_token,
    }))}`;

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting...</title>
          <script>
            window.location.href = '${redirectUrl}';
          </script>
        </head>
        <body>
          <p>Redirecting...</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('[OAuth Callback] Error:', error.response?.data || error.message);
    
    const appUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const errorUrl = `${appUrl}/?oauth_error=${encodeURIComponent(error.response?.data?.error || error.message)}`;

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <script>
            window.location.href = '${errorUrl}';
          </script>
        </head>
        <body>
          <p>Error: ${error.response?.data?.error || error.message}</p>
        </body>
      </html>
    `);
  }
}
