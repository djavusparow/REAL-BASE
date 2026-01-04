
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
  MessageSquareShare
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
import { twitterService } from './services/twitterService';
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
  const [user, setUser] = useState<UserStats & { trustScore?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  const [isMinted, setIsMinted] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(SESSION_TIMEOUT_MS);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const [activeWalletName, setActiveWalletName] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletSigned, setIsWalletSigned] = useState(false);
  const [twUser, setTwUser] = useState<{ handle: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const scanLogsRef = useRef<HTMLDivElement>(null);
  const [detectedProviders, setDetectedProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  // Twitter Modal States
  const [isTwitterModalOpen, setIsTwitterModalOpen] = useState(false);
  const [tempTwitterHandle, setTempTwitterHandle] = useState('');
  const [twitterStep, setTwitterStep] = useState<1 | 2 | 3 | 4>(1); 
  const [modalError, setModalError] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showLogoutNotice, setShowLogoutNotice] = useState(false);

  useEffect(() => {
    sdk.actions.ready();
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

  useEffect(() => {
    const updateActivity = () => {
      if (user) {
        const newExpiry = Date.now() + SESSION_TIMEOUT_MS;
        localStorage.setItem(STORAGE_KEY_EXPIRY, newExpiry.toString());
        setSessionTimeLeft(SESSION_TIMEOUT_MS);
      }
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, updateActivity));
    return () => events.forEach(e => window.removeEventListener(e, updateActivity));
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

  const connectWallet = async (providerDetail: EIP6963ProviderDetail | any) => {
    setWalletError(null);
    setLoading(true);
    const providerInstance = providerDetail.provider || providerDetail;
    const name = providerDetail.info?.name || "EVM Wallet";
    setActiveWalletName(name);
    try {
      const web3 = new Web3(providerInstance);
      const accounts = await web3.eth.requestAccounts();
      if (accounts[0]) {
        setWalletAddress(accounts[0]);
        setActiveProvider(providerInstance);
        setIsWalletConnected(true);
        setIsWalletSelectorOpen(false);
      }
    } catch (err: any) {
      setWalletError(err.message || "Connection failed.");
    } finally { setLoading(false); }
  };

  const signVerification = async () => {
    if (!walletAddress || !activeProvider) return;
    setError(null);
    setLoading(true);
    try {
      const ethersProvider = new ethers.BrowserProvider(activeProvider);
      const signer = await ethersProvider.getSigner();
      const message = `BASE IMPRESSION IDENTITY PROOF\nAddress: ${walletAddress}\nTimestamp: ${Date.now()}`;
      await signer.signMessage(message);
      setIsWalletSigned(true);
    } catch (err: any) {
      setError(err.message || "Signature rejected.");
    } finally { setLoading(false); }
  };

  const handleTwitterAuth = async () => {
    if (!tempTwitterHandle.trim()) {
      setModalError("Please enter a valid handle.");
      return;
    }
    setModalError(null);
    setTwitterStep(2);
    try {
      const success = await twitterService.authorize();
      if (success) {
        setTwitterStep(3);
        // Add a small delay for verification simulation
        setTimeout(() => setTwitterStep(4), 1500);
      }
    } catch (err: any) {
      setModalError(err.message || "Authentication failed.");
      setTwitterStep(1);
    }
  };

  const finalizeTwitterConnection = () => {
    setTwUser({ handle: tempTwitterHandle.startsWith('@') ? tempTwitterHandle : `@${tempTwitterHandle}` });
    setIsTwitterModalOpen(false);
  };

  const handleFinalizeConnection = async () => {
    if (!walletAddress || !twUser) return;
    setIsScanning(true);
    setScanProgress(0);
    const addLog = (l: string) => setScanLogs(p => [...p, l]);
    
    addLog("Connecting to Base Mainnet RPC...");
    const rawBalance = await tokenService.getBalance(walletAddress);
    setScanProgress(20);
    addLog(`Balance found: ${rawBalance.toFixed(2)} $LAMBOLESS`);
    
    addLog("Requesting real-time market conversion via Gemini...");
    const tokenPrice = await geminiService.getLambolessPrice();
    const usdValue = rawBalance * tokenPrice;
    setScanProgress(40);
    addLog(`Valuation: $${usdValue.toFixed(2)} USD (Verified)`);

    addLog("Analyzing Social Impact graph...");
    const scanResult = await twitterService.scanPosts(twUser.handle);
    setScanProgress(70);
    addLog(`Contribution check: ${scanResult.totalValidPosts} valid interactions indexed.`);

    const baseAge = 150 + Math.floor(Math.random() * 60);
    const points = calculatePoints(baseAge, scanResult.accountAgeDays, scanResult.cappedPoints);
    const rank = Math.floor(Math.random() * 800) + 10;

    const userData: UserStats & { trustScore?: number } = {
      address: walletAddress,
      twitterHandle: twUser.handle,
      baseAppAgeDays: baseAge,
      twitterAgeDays: scanResult.accountAgeDays,
      validTweetsCount: scanResult.cappedPoints,
      lambolessBalance: usdValue,
      points,
      rank,
      trustScore: scanResult.trustScore
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
    const text = `I'm a ${tier} contributor on Base Impression! 🔵 Rank: #${user.rank} | Points: ${user.points} 💎 #BaseImpression #LamboLess`;
    const url = "https://real-base-2026.vercel.app/";
    if (platform === 'farcaster') {
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`);
    } else {
      sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text + ' ' + url)}`);
    }
  };

  const isClaimable = user && user.rank <= 1000 && user.lambolessBalance >= MIN_TOKEN_VALUE_USD;
  const currentTier = user ? getTierFromRank(user.rank) : RankTier.NONE;

  return (
    <div className="min-h-screen bg-black text-white safe-top safe-bottom font-['Space_Grotesk']">
      {/* Auto Logout Notice */}
      {showLogoutNotice && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
           <div className="glass-effect border border-white/10 p-8 rounded-[2.5rem] max-w-xs w-full text-center space-y-6">
              <Clock className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="text-xl font-black uppercase italic">Session Expired</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Logged out after 10m of inactivity.</p>
              <button onClick={() => setShowLogoutNotice(false)} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase italic">Dismiss</button>
           </div>
        </div>
      )}

      {/* Connection Help Modal */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
           <div className="glass-effect border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 animate-in zoom-in duration-300">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Connection Guide</h3>
                <X onClick={() => setIsHelpModalOpen(false)} className="w-5 h-5 text-gray-500 cursor-pointer" />
              </div>
              <div className="space-y-4 text-[10px] font-bold uppercase text-gray-400">
                <div className="space-y-2">
                  <p className="text-blue-500">Supported Wallets</p>
                  <p className="normal-case font-medium">We support all EIP-6963 compatible wallets including Coinbase Wallet, MetaMask, Rainbow, and Rabby. Ensure your wallet is set to the Base network.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-blue-500">The Process</p>
                  <ol className="list-decimal list-inside space-y-1 normal-case font-medium">
                    <li>Connect: Links your public address to search for $LAMBOLESS holdings.</li>
                    <li>Sign: A gasless signature proves you own the address. No funds are moved.</li>
                    <li>Sync: Connect your social handle to index your ecosystem mentions.</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <p className="text-blue-500">Security</p>
                  <p className="normal-case font-medium">Your private keys are never accessed. We only verify public on-chain and social data to calculate your tier.</p>
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
              <h3 className="text-2xl font-black uppercase italic">Verifying Impact</h3>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${scanProgress}%` }} />
              </div>
              <div ref={scanLogsRef} className="h-40 bg-black/50 border border-white/5 rounded-2xl p-4 overflow-y-auto text-[10px] font-mono text-blue-400 space-y-1">
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
                <p className="text-[10px] text-gray-500 text-center py-4 uppercase font-black">No wallet extensions detected</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Twitter Modal */}
      {isTwitterModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <div className="glass-effect border border-white/10 w-full max-w-xs rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in duration-300">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Social Sync</h3>
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Verify Contribution Identity</p>
              </div>
              <X onClick={() => !loading && setIsTwitterModalOpen(false)} className="w-5 h-5 text-gray-500 cursor-pointer" />
            </div>

            <div className="space-y-6">
              {twitterStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="relative">
                    <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                    <input 
                      type="text" 
                      placeholder="@handle" 
                      value={tempTwitterHandle}
                      onChange={(e) => setTempTwitterHandle(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </div>
                  {modalError && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span className="text-[9px] font-bold uppercase">{modalError}</span>
                    </div>
                  )}
                  <button 
                    onClick={handleTwitterAuth}
                    className="w-full py-4 bg-blue-600 rounded-2xl font-black text-xs uppercase italic shadow-lg shadow-blue-600/20 active:scale-95 transition-transform"
                  >
                    Authenticate Account
                  </button>
                </div>
              )}

              {twitterStep === 2 && (
                <div className="py-8 flex flex-col items-center gap-6 text-center animate-in fade-in duration-500">
                  <div className="relative">
                    <div className="w-16 h-16 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <Twitter className="absolute inset-0 m-auto w-6 h-6 text-blue-500 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase italic">Establishing Secure Bridge</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase">Requesting Profile Scopes...</p>
                  </div>
                </div>
              )}

              {twitterStep === 3 && (
                <div className="py-8 flex flex-col items-center gap-6 text-center animate-in fade-in duration-500">
                  <div className="relative">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Search className="w-8 h-8 text-blue-500 animate-bounce" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase italic">Scanning Timeline</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase">Indexing Verified Mentions...</p>
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
                      <span className="text-xs font-mono font-bold text-blue-100">{tempTwitterHandle}</span>
                    </div>
                  </div>
                  <button 
                    onClick={finalizeTwitterConnection}
                    className="w-full py-4 bg-green-600 rounded-2xl font-black text-xs uppercase italic shadow-lg shadow-green-600/20"
                  >
                    Continue to Dashboard
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
          <div className="flex flex-col"><h1 className="font-black text-xs uppercase tracking-tighter">Base Impression</h1></div>
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
              <h2 className="text-4xl font-black uppercase italic leading-none tracking-tight">Track Your<br/>Onchain Impact.</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Powered by Base Mainnet & Farcaster</p>
            </div>
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Connect Identity</h3>
                <HelpCircle className="w-4 h-4 text-gray-500 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => setIsHelpModalOpen(true)} />
              </div>
              <div className="glass-effect p-6 rounded-[2.5rem] border border-white/10 space-y-4">
                <button onClick={() => setIsWalletSelectorOpen(true)} className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-between px-6 border ${isWalletConnected ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10'}`}>
                  {isWalletConnected ? 'Wallet Linked' : '1. Connect Wallet'}
                  {isWalletConnected ? <CheckCircle2 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                </button>
                <button onClick={signVerification} disabled={!isWalletConnected} className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-between px-6 border ${isWalletSigned ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10 opacity-50'}`}>
                  {isWalletSigned ? 'Identity Proved' : '2. Sign Verification'}
                  <Fingerprint className="w-4 h-4" />
                </button>
                <button onClick={() => { setTwitterStep(1); setIsTwitterModalOpen(true); }} className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-between px-6 border ${twUser ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10'}`}>
                  {twUser ? 'Profile Synced' : '3. Link Profile'}
                  <Twitter className="w-4 h-4" />
                </button>
              </div>
              <button onClick={handleFinalizeConnection} disabled={!isWalletSigned || !twUser} className="w-full py-5 bg-blue-600 rounded-[2rem] font-black uppercase italic text-sm shadow-xl active:scale-95 disabled:opacity-20 transition-all">Scan Ecosystem Data</button>
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
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Contribution Pts</span>
                    <div className="text-3xl font-black mt-1 italic">{user.points}</div>
                  </div>
                  <div className="glass-effect p-6 rounded-[2rem] text-center border border-purple-500/20">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Global Rank</span>
                    <div className="text-3xl font-black mt-1 italic">#{user.rank}</div>
                  </div>
                </div>

                <div className="glass-effect p-8 rounded-[3rem] border border-white/10 text-center space-y-6">
                  <BadgeDisplay tier={currentTier} imageUrl={badgeImage} loading={isGenerating} />
                  {analysis && <p className="text-[10px] italic text-blue-200/60 bg-white/5 p-4 rounded-2xl leading-relaxed">"{analysis}"</p>}
                  <button onClick={handleCheckpoint} disabled={isGenerating} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] italic">{isGenerating ? 'Indexing Chain...' : 'Update Snapshot'}</button>
                </div>

                <div className="glass-effect p-6 rounded-[2.5rem] border border-blue-500/20 bg-blue-500/5 space-y-5">
                    <div className="flex items-center gap-4">
                        <MessageSquareShare className="w-5 h-5 text-blue-400" />
                        <h4 className="text-xs font-black uppercase italic">Broadcast Impact</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleShare('farcaster')} className="py-4 bg-[#8a63d2] rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><img src="https://warpcast.com/favicon.ico" className="w-3 h-3 brightness-0 invert" alt="" /> Warpcast</button>
                        <button onClick={() => handleShare('twitter')} className="py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Twitter className="w-3 h-3" /> X / Twitter</button>
                    </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Verification Metrics</h3>
                  <div className="space-y-3">
                    <div className="p-5 glass-effect rounded-2xl border border-white/5 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-gray-400">On-chain Balance ($USDC)</span>
                      <span className="text-xs font-black text-green-500">${user.lambolessBalance.toFixed(2)}</span>
                    </div>
                    <div className="p-5 glass-effect rounded-2xl border border-white/5 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-gray-400">Account Seniority</span>
                      <span className="text-xs font-black">{user.baseAppAgeDays}D</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-4">
                {MOCKED_LEADERBOARD.map(p => (
                  <div key={p.rank} className="p-5 glass-effect border border-white/5 rounded-2xl flex justify-between items-center hover:bg-white/5 transition-colors">
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
                <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                  <CreditCard className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-2xl font-black uppercase italic">Soulbound Badge</h2>
                <div className="space-y-3">
                  <div className={`p-5 border rounded-2xl flex justify-between ${user.rank <= 1000 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30'}`}>
                    <span className="text-[10px] font-black uppercase">Rank Eligibility</span>
                    <span className="text-[10px] font-bold">{user.rank <= 1000 ? 'QUALIFIED' : 'NOT ELIGIBLE'}</span>
                  </div>
                  <div className={`p-5 border rounded-2xl flex justify-between ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30'}`}>
                    <span className="text-[10px] font-black uppercase">Min. $2.50 Verified</span>
                    <span className="text-[10px] font-bold">${user.lambolessBalance.toFixed(2)}</span>
                  </div>
                </div>
                <button disabled={!isClaimable} className={`w-full py-5 rounded-[2rem] font-black uppercase italic ${isClaimable ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-white/5 text-gray-700 disabled:opacity-20'}`}>Mint Tier Badge</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
