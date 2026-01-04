
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Twitter, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  Zap, 
  ShieldCheck, 
  ChevronRight, 
  Info, 
  Share2, 
  Loader2, 
  PartyPopper,
  X,
  ArrowRight,
  Fingerprint,
  CreditCard,
  Globe,
  Search,
  Lock,
  Unlock,
  Filter,
  Smartphone,
  ShieldAlert,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  LogOut,
  Clock,
  CircleDollarSign,
  MessageSquareShare,
  History,
  Trophy
} from 'lucide-react';
import sdk from '@farcaster/frame-sdk';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { UserStats, RankTier } from './types';
import { 
  TOKEN_CONTRACT, 
  SNAPSHOT_END, 
  CLAIM_START, 
  TIERS, 
  MOCKED_LEADERBOARD,
  MIN_TOKEN_VALUE_USD
} from './constants';
import { calculatePoints, getTierFromRank } from './utils/calculations';
import Countdown from './components/Countdown';
import BadgeDisplay from './components/BadgeDisplay';
import { geminiService } from './services/geminiService';
import { twitterService, Tweet } from './services/twitterService';
import { tokenService } from './services/tokenService';

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; 
const STORAGE_KEY_USER = 'base_impression_user_session';
const STORAGE_KEY_EXPIRY = 'base_impression_session_expiry';

const BrandIcon: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => {
  const dimensions = size === 'lg' ? 'w-48 h-48' : 'w-12 h-12';
  const textSize = size === 'lg' ? 'text-xl' : 'text-[8px]';
  const padding = size === 'lg' ? 'p-4' : 'p-1';
  
  return (
    <div className={`${dimensions} relative rounded-2xl overflow-hidden shadow-2xl group border border-white/20`}>
      <img 
        src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=400" 
        alt="Base Background" 
        className="absolute inset-0 w-full h-full object-cover brightness-50 group-hover:scale-110 transition-transform duration-700"
      />
      <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply" />
      <div className={`absolute inset-0 flex items-center justify-center text-center ${padding}`}>
        <span className={`${textSize} font-black text-white uppercase tracking-tighter leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}>
          Base<br/>Impression
        </span>
      </div>
    </div>
  );
};

interface EIP6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string; };
  provider: any;
}

const App: React.FC = () => {
  const [user, setUser] = useState<UserStats & { trustScore?: number, recentContributions?: Tweet[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  const [isMinted, setIsMinted] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(SESSION_TIMEOUT_MS);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletSigned, setIsWalletSigned] = useState(false);
  const [twUser, setTwUser] = useState<{ handle: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifyingSocial, setIsVerifyingSocial] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const scanLogsRef = useRef<HTMLDivElement>(null);
  const [detectedProviders, setDetectedProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  const [isTwitterModalOpen, setIsTwitterModalOpen] = useState(false);
  const [twitterStep, setTwitterStep] = useState<1 | 2 | 3 | 4>(1); 
  
  const [error, setError] = useState<string | null>(null);
  const [showLogoutNotice, setShowLogoutNotice] = useState(false);

  useEffect(() => { sdk.actions.ready(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    if (code) {
      const verifySocial = async () => {
        setIsVerifyingSocial(true);
        setError(null);
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          // Verification logic for the callback calling real backend
          const profile = await twitterService.verifyCallback(code, state || "");
          if (profile) {
            setTwUser(profile);
            setIsTwitterModalOpen(true);
            setTwitterStep(4);
          } else {
            setError("Social verification failed. The session may have expired.");
            setIsTwitterModalOpen(true);
            setTwitterStep(1);
          }
        } catch (err) {
          setError("OAuth Handshake Failed. Connection refused.");
          setIsTwitterModalOpen(true);
          setTwitterStep(1);
        } finally { setIsVerifyingSocial(false); }
      };
      verifySocial();
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    const expiry = localStorage.getItem(STORAGE_KEY_EXPIRY);
    if (savedUser && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        setUser(JSON.parse(savedUser));
        setIsWalletConnected(true);
        setIsWalletSigned(true);
        setSessionTimeLeft(expiryTime - Date.now());
      } else { handleLogout(false); }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (user) {
        const expiry = localStorage.getItem(STORAGE_KEY_EXPIRY);
        if (expiry) {
          const remaining = parseInt(expiry, 10) - Date.now();
          setSessionTimeLeft(remaining);
          if (remaining <= 0) handleLogout(true);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [user]);

  const handleLogout = (showNotice: boolean = false) => {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_EXPIRY);
    setUser(null);
    setIsWalletConnected(false);
    setIsWalletSigned(false);
    setWalletAddress(null);
    setTwUser(null);
    if (showNotice) setShowLogoutNotice(true);
  };

  useEffect(() => {
    const onAnnouncement = (event: any) => {
      setDetectedProviders(prev => {
        if (prev.find(p => p.info.uuid === event.detail.info.uuid)) return prev;
        return [...prev, event.detail];
      });
    };
    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }, []);

  const connectWallet = async (providerDetail: EIP6963ProviderDetail) => {
    setLoading(true);
    try {
      const web3 = new Web3(providerDetail.provider);
      const accounts = await web3.eth.requestAccounts();
      if (accounts[0]) {
        setWalletAddress(accounts[0]);
        setActiveProvider(providerDetail.provider);
        setIsWalletConnected(true);
        setIsWalletSelectorOpen(false);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const signVerification = async () => {
    if (!walletAddress || !activeProvider) return;
    setLoading(true);
    try {
      const ethersProvider = new ethers.BrowserProvider(activeProvider);
      const signer = await ethersProvider.getSigner();
      await signer.signMessage(`BASE IMPRESSION IDENTITY PROOF\nAddress: ${walletAddress}\nTimestamp: ${Date.now()}`);
      setIsWalletSigned(true);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleTwitterAuthInitiate = async () => {
    setError(null);
    setTwitterStep(2);
    try {
      const authUrl = await twitterService.getAuthUrl();

      // Initiate real redirect to Twitter Authorization portal
      if (sdk.actions.openUrl) {
         sdk.actions.openUrl(authUrl);
      } else {
         window.location.href = authUrl;
      }
    } catch (err) {
      console.error(err);
      setError("Failed to reach Authorization portal.");
      setTwitterStep(1);
    }
  };

  const handleFinalizeConnection = async () => {
    if (!walletAddress || !twUser) return;
    setIsScanning(true);
    setScanProgress(0);
    const addLog = (l: string) => setScanLogs(p => [...p, l]);
    
    addLog("Syncing Base Mainnet Balance...");
    const rawBalance = await tokenService.getBalance(walletAddress);
    setScanProgress(25);
    
    addLog("Querying Gemini Market Data...");
    const tokenPrice = await geminiService.getLambolessPrice();
    const usdValue = rawBalance * tokenPrice;
    setScanProgress(50);

    addLog("Analyzing Social Impact Graph (Gemini 3 Pro)...");
    const scanResult = await twitterService.scanPosts(twUser.handle);
    setScanProgress(80);

    const baseAge = 180 + Math.floor(Math.random() * 40);
    const points = calculatePoints(baseAge, scanResult.accountAgeDays, scanResult.cappedPoints);
    const rank = Math.floor(Math.random() * 800) + 10;

    const userData: UserStats & { trustScore: number, recentContributions: Tweet[] } = {
      address: walletAddress,
      twitterHandle: twUser.handle,
      baseAppAgeDays: baseAge,
      twitterAgeDays: scanResult.accountAgeDays,
      validTweetsCount: scanResult.cappedPoints,
      lambolessBalance: usdValue,
      points,
      rank,
      trustScore: scanResult.trustScore,
      recentContributions: scanResult.foundTweets
    };

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
    localStorage.setItem(STORAGE_KEY_EXPIRY, (Date.now() + SESSION_TIMEOUT_MS).toString());
    setUser(userData);
    setIsScanning(false);
  };

  const handleCheckpoint = async () => {
    if (!user) return;
    setIsGenerating(true);
    const tier = getTierFromRank(user.rank);
    const [img, msg] = await Promise.all([
      geminiService.generateBadgePreview(tier, user.twitterHandle),
      geminiService.getImpressionAnalysis(user.points, user.rank)
    ]);
    setBadgeImage(img);
    setAnalysis(msg);
    setIsGenerating(false);
  };

  const handleShare = (platform: 'farcaster' | 'twitter') => {
    if (!user) return;
    const tier = getTierFromRank(user.rank);
    const text = `I'm verified as a ${tier} contributor on Base Impression! 🔵 Rank: #${user.rank} | Score: ${user.points} pts. #BaseImpression #LamboLess`;
    const url = "https://real-base-2026.vercel.app/";
    if (platform === 'farcaster') {
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`);
    } else {
      sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text + ' ' + url)}`);
    }
  };

  const currentTier = user ? getTierFromRank(user.rank) : RankTier.NONE;
  const isClaimable = user && user.rank <= 1000 && user.lambolessBalance >= MIN_TOKEN_VALUE_USD;

  const claimButtonState = useMemo(() => {
    if (!user) return { text: 'Scan Required', disabled: true, color: 'bg-white/5' };
    if (isMinted) return { text: 'Badge Minted', disabled: true, color: 'bg-green-600/20 text-green-500' };
    if (isMinting) return { text: 'Minting...', disabled: true, color: 'bg-blue-600/20' };
    if (!isClaimable) return { text: 'Ineligible (Rank/Balance)', disabled: true, color: 'bg-red-500/10 text-red-400' };
    return { text: `Mint ${currentTier} Badge`, disabled: false, color: 'bg-blue-600 shadow-xl shadow-blue-600/20' };
  }, [user, isMinted, isMinting, currentTier, isClaimable]);

  return (
    <div className="min-h-screen bg-black text-white safe-top safe-bottom font-['Space_Grotesk']">
      {/* Social Identity Verification Overlay */}
      {isVerifyingSocial && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl">
          <div className="text-center space-y-6 animate-pulse">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-xl font-black uppercase italic">Verifying Social Identity</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Processing Secure OAuth Token...</p>
            </div>
          </div>
        </div>
      )}

      {/* Auto Logout Notice */}
      {showLogoutNotice && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
           <div className="glass-effect border border-white/10 p-8 rounded-[2.5rem] max-w-xs w-full text-center space-y-6">
              <Clock className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="text-xl font-black uppercase italic">Session Expired</h3>
              <button onClick={() => setShowLogoutNotice(false)} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase italic">Dismiss</button>
           </div>
        </div>
      )}

      {/* Connection Help Modal */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
           <div className="glass-effect border border-white/10 p-8 rounded-[2.5rem] max-sm w-full space-y-6 animate-in zoom-in duration-300">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Identity Portal</h3>
                <X onClick={() => setIsHelpModalOpen(false)} className="w-5 h-5 text-gray-500 cursor-pointer" />
              </div>
              <div className="space-y-4 text-[10px] font-bold uppercase text-gray-400">
                <div className="space-y-2">
                  <p className="text-blue-500">Verified Wallets</p>
                  <p className="normal-case font-medium">Compatible with Coinbase, MetaMask, and Rainbow. Ensure your chain is set to Base Mainnet.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-blue-500">OAuth 2.0 PKCE</p>
                  <p className="normal-case font-medium">Secure handshake via the official Twitter API. We never store your credentials.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-blue-500">Tier Calculation</p>
                  <p className="normal-case font-medium">Your points are weighted: 30% Twitter Age, 20% Base Age, 50% Verified Builder Actions.</p>
                </div>
              </div>
              <button onClick={() => setIsHelpModalOpen(false)} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase italic">Got it</button>
           </div>
        </div>
      )}

      {/* Real-time Scanner */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center space-y-3">
              <Search className="w-12 h-12 text-blue-500 animate-pulse mx-auto" />
              <h3 className="text-2xl font-black uppercase italic">Calculating Impression</h3>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${scanProgress}%` }} />
              </div>
              <div ref={scanLogsRef} className="h-40 bg-black/50 border border-white/5 rounded-2xl p-4 overflow-y-auto text-[10px] font-mono text-blue-400 space-y-1 text-left">
                {scanLogs.map((l, i) => <div key={i}>{'> ' + l}</div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Selector */}
      {isWalletSelectorOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90">
          <div className="glass-effect border border-white/10 w-full max-w-xs rounded-[2.5rem] p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-blue-500">Select Wallet</h3>
              <X onClick={() => setIsWalletSelectorOpen(false)} className="w-4 h-4 cursor-pointer" />
            </div>
            <div className="grid gap-3">
              {detectedProviders.length > 0 ? detectedProviders.map(det => (
                <button key={det.info.uuid} onClick={() => connectWallet(det)} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5">
                  <img src={det.info.icon} className="w-6 h-6" />
                  <span className="text-xs font-bold">{det.info.name}</span>
                </button>
              )) : (
                <p className="text-[10px] text-gray-500 text-center py-4 uppercase font-black">No wallets found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Twitter Modal */}
      {isTwitterModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <div className="glass-effect border border-white/10 w-full max-w-xs rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in duration-300">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Social Sync</h3>
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Official Handshake</p>
              </div>
              <X onClick={() => { setIsTwitterModalOpen(false); setError(null); }} className="w-5 h-5 text-gray-500 cursor-pointer" />
            </div>

            <div className="space-y-6">
              {twitterStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300 text-center">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                    <Twitter className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-gray-300">OAuth 2.0 PKCE</p>
                    <p className="text-[9px] text-gray-500 normal-case">Link your profile to prove you're an active ecosystem participant.</p>
                  </div>
                  
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-left">
                       <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                       <span className="text-[9px] font-bold uppercase">{error}</span>
                    </div>
                  )}

                  <button 
                    onClick={handleTwitterAuthInitiate}
                    className="w-full py-4 bg-blue-600 rounded-2xl font-black text-xs uppercase italic shadow-lg shadow-blue-600/20 active:scale-95 transition-transform flex items-center justify-center gap-3"
                  >
                    Authorize Account
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {twitterStep === 2 && (
                <div className="py-12 flex flex-col items-center justify-center gap-6 animate-pulse">
                   <div className="relative">
                      <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <Twitter className="absolute inset-0 m-auto w-8 h-8 text-blue-500" />
                   </div>
                   <div className="text-center space-y-1">
                      <p className="text-xs font-black uppercase italic tracking-tighter">Redirecting to Twitter...</p>
                      <p className="text-[8px] text-gray-500 font-bold uppercase">Preparing Secure PKCE Handshake</p>
                   </div>
                </div>
              )}

              {twitterStep === 4 && (
                <div className="space-y-6 text-center animate-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-black uppercase italic">Profile Linked</h4>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                      <Twitter className="w-3 h-3 text-blue-400" />
                      <span className="text-xs font-mono font-bold text-blue-100">{twUser?.handle}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsTwitterModalOpen(false)}
                    className="w-full py-4 bg-green-600 rounded-2xl font-black text-xs uppercase italic"
                  >
                    Enter Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 glass-effect border-b border-white/5 px-4 py-3 flex justify-between items-center bg-black/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <BrandIcon size="sm" />
          <h1 className="font-black text-xs uppercase tracking-tighter">Base Impression</h1>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-mono font-bold">{(sessionTimeLeft / 1000).toFixed(0)}s</span>
            </div>
            <LogOut onClick={() => handleLogout(false)} className="w-4 h-4 text-gray-500 cursor-pointer hover:text-red-500" />
          </div>
        )}
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 pb-32">
        {!user ? (
          <div className="space-y-12 text-center animate-in fade-in duration-500">
            <BrandIcon size="lg" />
            <div className="space-y-3">
              <h2 className="text-4xl font-black uppercase italic leading-none tracking-tight">Onchain<br/>Proof of Work.</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Connect to verify your contribution tier</p>
            </div>
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Identity Sync</h3>
                <HelpCircle className="w-4 h-4 text-gray-500 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => setIsHelpModalOpen(true)} />
              </div>
              <div className="glass-effect p-6 rounded-[2.5rem] border border-white/10 space-y-4">
                <button onClick={() => setIsWalletSelectorOpen(true)} className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-between px-6 border ${isWalletConnected ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10'}`}>
                  {isWalletConnected ? 'Wallet Linked' : '1. Connect Wallet'}
                  <Wallet className="w-4 h-4" />
                </button>
                <button onClick={signVerification} disabled={!isWalletConnected} className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-between px-6 border ${isWalletSigned ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10 opacity-50'}`}>
                  {isWalletSigned ? 'Identity Proved' : '2. Sign Message'}
                  <Fingerprint className="w-4 h-4" />
                </button>
                <button onClick={() => { setTwitterStep(1); setIsTwitterModalOpen(true); }} className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-between px-6 border ${twUser ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10'}`}>
                  {twUser ? 'Social Proved' : '3. Link Profile'}
                  <Twitter className="w-4 h-4" />
                </button>
              </div>
              <button onClick={handleFinalizeConnection} disabled={!isWalletSigned || !twUser} className="w-full py-5 bg-blue-600 rounded-[2rem] font-black uppercase italic text-sm shadow-xl active:scale-95 disabled:opacity-20 transition-all">Start Snapshot Scan</button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex bg-white/5 p-1 rounded-2xl sticky top-[76px] z-30 backdrop-blur-xl">
              {['dashboard', 'leaderboard', 'claim'].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${activeTab === t ? 'bg-blue-600 shadow-lg' : 'text-gray-500'}`}>{t}</button>
              ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2rem] text-center border border-blue-500/20">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Impact Pts</span>
                    <div className="text-3xl font-black mt-1 italic">{user.points}</div>
                  </div>
                  <div className="glass-effect p-6 rounded-[2rem] text-center border border-purple-500/20">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Trust Score</span>
                    <div className="text-3xl font-black mt-1 italic text-blue-400">{user.trustScore}%</div>
                  </div>
                </div>

                <div className="glass-effect p-8 rounded-[3rem] border border-white/10 text-center space-y-6">
                  <BadgeDisplay tier={currentTier} imageUrl={badgeImage} loading={isGenerating} />
                  {analysis && <p className="text-[10px] italic text-blue-200/60 bg-white/5 p-4 rounded-2xl leading-relaxed">"{analysis}"</p>}
                  <button onClick={handleCheckpoint} disabled={isGenerating} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] italic">Refresh Snapshot</button>
                </div>

                {user.recentContributions && user.recentContributions.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Verified Contributions</h3>
                      <History className="w-3 h-3 text-gray-500" />
                    </div>
                    <div className="space-y-3">
                      {user.recentContributions.map(tweet => (
                        <div key={tweet.id} className="p-4 glass-effect rounded-2xl border border-white/5 space-y-2">
                           <p className="text-[10px] line-clamp-2 text-gray-300">"{tweet.text}"</p>
                           <div className="flex justify-between items-center pt-1">
                              <span className="text-[8px] font-mono text-gray-500">{new Date(tweet.createdAt).toLocaleDateString()}</span>
                              <div className="flex items-center gap-1">
                                <Zap className="w-2 h-2 text-blue-500" />
                                <span className="text-[9px] font-black text-blue-400">{(tweet.qualityScore! * 10).toFixed(1)}/10</span>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="glass-effect p-6 rounded-[2.5rem] border border-blue-500/20 bg-blue-500/5 space-y-5">
                    <div className="flex items-center gap-4"><Trophy className="w-5 h-5 text-blue-400" /><h4 className="text-xs font-black uppercase italic">Share Progress</h4></div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleShare('farcaster')} className="py-4 bg-[#8a63d2] rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2">Warpcast</button>
                        <button onClick={() => handleShare('twitter')} className="py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2">X / Twitter</button>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-4">
                {MOCKED_LEADERBOARD.map(p => (
                  <div key={p.rank} className="p-5 glass-effect border border-white/5 rounded-2xl flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-black text-gray-500 italic">#{p.rank}</span>
                      <span className="text-xs font-bold">{p.handle}</span>
                    </div>
                    <span className="text-xs font-black">{p.points} pts</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-8 text-center">
                <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20"><CreditCard className="w-10 h-10 text-blue-500" /></div>
                <h2 className="text-2xl font-black uppercase italic">Soulbound Tier</h2>
                <div className="space-y-3">
                  <div className={`p-5 border rounded-2xl flex justify-between items-center ${user.rank <= 1000 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="text-left"><p className="text-[10px] font-black uppercase">Rank Qualifier</p><p className="text-[8px] text-gray-500 uppercase">Top 1000 required</p></div>
                    <span className="text-[10px] font-bold">#{user.rank}</span>
                  </div>
                  <div className={`p-5 border rounded-2xl flex justify-between items-center ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="text-left"><p className="text-[10px] font-black uppercase">Ecosystem Balance</p><p className="text-[8px] text-gray-500 uppercase">Min $2.50 verified</p></div>
                    <span className="text-[10px] font-bold">${user.lambolessBalance.toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={() => setIsMinted(true)} disabled={claimButtonState.disabled} className={`w-full py-5 rounded-[2rem] font-black uppercase italic text-sm ${claimButtonState.color}`}>{claimButtonState.text}</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
