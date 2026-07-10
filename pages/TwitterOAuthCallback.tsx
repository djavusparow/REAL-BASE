import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { twitterOAuthService } from '../services/twitterOAuthService';

interface TwitterOAuthCallbackProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
}

const TwitterOAuthCallback: React.FC<TwitterOAuthCallbackProps> = ({ onSuccess, onError }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get query parameters from URL
        const params = new URLSearchParams(window.location.search);
        
        // Check for error first
        const errorParam = params.get('error');
        if (errorParam) {
          throw new Error(decodeURIComponent(errorParam));
        }

        // Process callback response
        const twitterUser = await twitterOAuthService.handleCallbackResponse(params);
        
        setSuccess(true);
        onSuccess?.(twitterUser);

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to complete Twitter authentication';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [onSuccess, onError]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 space-y-6">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Completing Twitter Authentication</h2>
          <p className="text-gray-400">Please wait while we verify your credentials...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Authentication Failed</h2>
          <p className="text-red-400 max-w-md">{error}</p>
          <a 
            href="/" 
            className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 space-y-6">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Authentication Successful</h2>
          <p className="text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default TwitterOAuthCallback;
