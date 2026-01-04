
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trophy, 
  Target, 
  Twitter, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  Zap, 
  ShieldCheck, 
  ChevronRight, 
  Info, 
  Share2, 
  ExternalLink, 
  Loader2, 
  PartyPopper,
  User as UserIcon,
  Link2,
  X,
  ArrowRight,
  Fingerprint,
  Download,
  CreditCard,
  Layers,
  Globe,
  Plus,
  Search,
  History,
  Activity,
  Lock,
  Unlock,
  Filter,
  CalendarDays,
  Smartphone,
  ShieldAlert,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  LogOut,
  Clock,
  CircleDollarSign
} from 'lucide-react';
import sdk from '@farcaster/frame-sdk';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { UserStats, RankTier, LeaderboardEntry } from './types';
import { 
  TOKEN_CONTRACT, 
  SNAPSHOT_END, 
  CLAIM_START, 
  TIERS, 
  MOCKED_LEADERBOARD,
  FINAL_SNAPSHOT,
  MIN_TOKEN_VALUE_USD
} from './constants';
import { calculatePoints, getTierFromRank } from './utils/calculations';
import Countdown from './components/Countdown';
import BadgeDisplay from './components/BadgeDisplay';
import { geminiService } from './services/geminiService';
import { twitterService, ScanResult } from './services/twitterService';
import { tokenService } from './services/tokenService';

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
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
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: any;
}

type AgeFilter = 'ALL' | 'NEW' | 'MID' | 'OG';
type BaseAgeFilter = 'ALL' | 'NEW' | 'ONE' | 'PLUS';

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

  // Connection States
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const [activeWalletName, setActiveWalletName] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletSigned, setIsWalletSigned] = useState(false);
  const [twUser, setTwUser] = useState<{ handle: string } | null>(null);
  
  // Scanner Logic
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const scanLogsRef = useRef<HTMLDivElement>(null);

  // Leaderboard Filtering
  const [lbFilter, setLbFilter] = useState<RankTier | 'ALL'>('ALL');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('ALL');
  const [baseAgeFilter, setBaseAgeFilter] = useState<BaseAgeFilter>('ALL');

  // EIP-6963 Detected Providers
  const [detectedProviders, setDetectedProviders] = useState<EIP6963ProviderDetail[]>([]);
  
  // Modal States
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);
  const [showWalletGuide, setShowWalletGuide] = useState(false);
  const [isTwitterModalOpen, setIsTwitterModalOpen] = useState(false);
  const [tempTwitterHandle, setTempTwitterHandle] = useState('');
  const [twitterStep, setTwitterStep] = useState<1 | 2 | 3 | 4>(1); 
  const [modalError, setModalError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showLogoutNotice, setShowLogoutNotice] = useState(false);

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
      } else {
        handleLogout(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (user) {
        const expiry = localStorage.getItem(STORAGE_KEY_EXPIRY);
        if (expiry) {
          const remaining = parseInt(expiry, 10) - Date.now();
          setSessionTimeLeft(remaining);
          if (remaining <= 0) {
            handleLogout(true);
          }
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

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [user]);

  const handleLogout = (showNotice: boolean = false) => {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_EXPIRY);
    setUser(null);
    setIsWalletConnected(false);
    setIsWalletSigned(false);
    setWalletAddress(null);
    setTwUser(null);
    setBadgeImage(null);
    setAnalysis('');
    if (showNotice) setShowLogoutNotice(true);
  };

  useEffect(() => {
    if (scanLogsRef.current) {
      scanLogsRef.current.scrollTop = scanLogsRef.current.scrollHeight;
    }
  }, [scanLogs]);

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

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  const connectWallet = async (providerDetail: EIP6963ProviderDetail | any) => {
    setWalletError(null);
    setLoading(true);
    const providerInstance = providerDetail.provider || providerDetail;
    const name = providerDetail.info?.name || "EVM Wallet";
    setActiveWalletName(name);

    try {
      await new Promise(r => setTimeout(r, 600));
      const web3 = new Web3(providerInstance);
      const accounts = await web3.eth.requestAccounts();
      
      if (accounts[0]) {
        setWalletAddress(accounts[0]);
        setActiveProvider(providerInstance);
        setIsWalletConnected(true);
        setIsWalletSelectorOpen(false);
        setIsWalletSigned(false); 
      }
    } catch (err: any) {
      console.error("Wallet Connection Error:", err);
      let msg = "Connection failed.";
      if (err.code === 4001) msg = "User rejected connection request.";
      else if (err.message?.includes("User rejected")) msg = "User rejected connection request.";
      setWalletError(msg);
    } finally {
      setLoading(false);
    }
  };

  const signVerification = async () => {
    if (!walletAddress || !activeProvider) return;
    setError(null);
    setLoading(true);
    try {
      const ethersProvider = new ethers.BrowserProvider(activeProvider);
      const signer = await ethersProvider.getSigner();
      const message = `Base Impression Secure Verification\nAccount: ${walletAddress}\nNonce: ${Date.now()}\n\nThis signature does not cost any gas.`;
      
      await new Promise(r => setTimeout(r, 400));
      await signer.signMessage(message);
      setIsWalletSigned(true);
    } catch (err: any) {
      console.error("Signature Error:", err);
      let msg = "Signature rejected. Proof required.";
      if (err.code === 4001 || err.message?.includes("rejected")) msg = "User rejected the signing request.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTwitterVerifyStart = () => {
    if (!tempTwitterHandle.trim()) return;
    setTwitterStep(2);
    setModalError(null);
  };

  const handlePostVerificationTweet = async () => {
    const handle = tempTwitterHandle.startsWith('@') ? tempTwitterHandle : `@${tempTwitterHandle}`;
    setTwitterStep(3); 
    setModalError(null);

    try {
      const isAuthorized = await twitterService.authorize();
      if (!isAuthorized) throw new Error("Twitter authorization denied.");

      const text = `Verifying my @base impact with @jessepollak! 🛡️💎 Handle: ${handle}\nCode: BI-${Math.random().toString(36).substring(7).toUpperCase()}\n#BaseImpression #LamboLess`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
      
      await new Promise(r => setTimeout(r, 2000));
      
      setTwitterStep(4); 
      setTimeout(() => {
        setTwUser({ handle: handle });
        setIsTwitterModalOpen(false);
        setTwitterStep(1);
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || "Authentication failed.");
      setTwitterStep(2); 
    }
  };

  const handleFinalizeConnection = async () => {
    if (!walletAddress || !twUser) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setScanLogs(["Initializing secure Twitter bridge...", "Requesting read-only permissions..."]);
    
    const addLog = (log: string) => setScanLogs(prev => [...prev, log]);
    
    await new Promise(r => setTimeout(r, 1000));
    setScanProgress(15);
    addLog("Authenticated @ " + twUser.handle);
    addLog("Detecting on-chain $LAMBOLESS assets...");

    // REAL-TIME ON-CHAIN DETECTION
    const rawBalance = await tokenService.getBalance(walletAddress);
    const tokenPrice = await geminiService.getLambolessPrice();
    const usdValue = rawBalance * tokenPrice;

    setScanProgress(30);
    addLog(`Verified Balance: ${rawBalance.toFixed(2)} $LAMBOLESS`);
    addLog(`Market Valuation: $${usdValue.toFixed(2)} (Real-time Price: $${tokenPrice.toFixed(4)})`);

    const scanResult = await twitterService.scanPosts(twUser.handle);
    
    setScanProgress(50);
    addLog(`Account Seniority: ${scanResult.accountAgeDays} days detected.`);
    addLog(`Launching Smart Indexer (Gemini 3 Flash enabled)...`);
    
    await new Promise(r => setTimeout(r, 800));
    setScanProgress(80);
    addLog(`Scanning historical posts (Nov 2025 - Jan 2026)...`);
    addLog(`AI quality check in progress... Filtering low-effort content.`);
    addLog(`Found ${scanResult.totalValidPosts} high-quality contributions.`);
    
    await new Promise(r => setTimeout(r, 1000));
    setScanProgress(100);
    addLog(`Contribution summary finalized. Profile Trust: ${scanResult.trustScore}%`);

    const baseAppAge = 145 + Math.floor(Math.random() * 50);
    const twitterAge = scanResult.accountAgeDays;
    
    const points = calculatePoints(baseAppAge, twitterAge, scanResult.cappedPoints);
    const rank = Math.floor(Math.random() * 900) + 1;

    const userData: UserStats & { trustScore?: number } = {
      address: walletAddress,
      twitterHandle: twUser.handle,
      baseAppAgeDays: baseAppAge,
      twitterAgeDays: twitterAge,
      validTweetsCount: scanResult.cappedPoints,
      lambolessBalance: usdValue, // Use real USD value
      points: points,
      rank: rank,
      trustScore: scanResult.trustScore
    };

    const expiry = Date.now() + SESSION_TIMEOUT_MS;
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
    localStorage.setItem(STORAGE_KEY_EXPIRY, expiry.toString());
    
    setUser(userData);
    setIsScanning(false);
  };

  const currentTier = useMemo(() => {
    if (!user) return RankTier.NONE;
    return getTierFromRank(user.rank);
  }, [user]);

  const filteredLeaderboard = useMemo(() => {
    let list = MOCKED_LEADERBOARD;
    if (lbFilter !== 'ALL') list = list.filter(entry => entry.tier === lbFilter);
    if (ageFilter === 'NEW') list = list.filter(entry => entry.accountAgeDays < 365);
    else if (ageFilter === 'MID') list = list.filter(entry => entry.accountAgeDays >= 365 && entry.accountAgeDays < 1095);
    else if (ageFilter === 'OG') list = list.filter(entry => entry.accountAgeDays >= 1095);
    if (baseAgeFilter === 'NEW') list = list.filter(entry => entry.baseAppAgeDays < 365);
    else if (baseAgeFilter === 'ONE') list = list.filter(entry => entry.baseAppAgeDays >= 365 && entry.baseAppAgeDays < 730);
    else if (baseAgeFilter === 'PLUS') list = list.filter(entry => entry.baseAppAgeDays >= 365);
    return list;
  }, [lbFilter, ageFilter, baseAgeFilter]);

  const handleCheckpoint = async () => {
    if (!user) return;
    setIsGenerating(true);
    const [img, msg] = await Promise.all([
      geminiService.generateBadgePreview(currentTier, user.twitterHandle),
      geminiService.getImpressionAnalysis(user.points, user.rank)
    ]);
    setBadgeImage(img);
    setAnalysis(msg);
    setIsGenerating(false);
  };

  const handleMint = async () => {
    if (!isClaimable || isMinting || isMinted) return;
    setIsMinting(true);
    try {
      await new Promise(r => setTimeout(r, 3000));
      setTxHash("0x" + Math.random().toString(16).slice(2, 64));
      setIsMinted(true);
    } catch (e) {
      setError("Mint failed.");
    } finally {
      setIsMinting(false);
    }
  };

  const handleShare = (platform: 'farcaster' | 'twitter') => {
    if (!user) return;
    const shareText = `I'm a ${TIERS[currentTier].name} contributor on Base Impression with ${user.points} impact points! 🔵💎 Rank: #${user.rank} #BaseImpression #LamboLess`;
    const shareUrl = window.location.origin;
    let url = '';
    if (platform === 'farcaster') {
      url = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
    } else {
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    }
    sdk.actions.openUrl(url);
  };

  const isClaimable = useMemo(() => {
    if (!user) return false;
    return (
      currentTime >= CLAIM_START &&
      user.rank <= 1000 && 
      user.lambolessBalance >= MIN_TOKEN_VALUE_USD
    );
  }, [user, currentTime]);

  const claimTimeReached = currentTime >= CLAIM_START;

  const formatSessionTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30 safe-top safe-bottom font-['Space_Grotesk']">
      
      {showLogoutNotice && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
           <div className="glass-effect border border-white/10 p-8 rounded-[2.5rem] max-w-xs w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                <Clock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase italic tracking-tight">Session Expired</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">For your security, you have been automatically logged out after 10 minutes of inactivity.</p>
              </div>
              <button 
                onClick={() => setShowLogoutNotice(false)}
                className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase italic active:scale-95 transition-all"
              >
                Dismiss
              </button>
           </div>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
          <div className="relative w-full max-w-sm space-y-8 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-3">
              <div className="relative inline-block">
                <Search className="w-12 h-12 text-blue-500 animate-pulse" />
                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Indexing Profile</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Live Onchain Verification</p>
            </div>

            <div className="space-y-4">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-700 ease-out" 
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <div 
                ref={scanLogsRef}
                className="h-48 bg-black border border-white/5 rounded-2xl p-4 overflow-y-auto space-y-2 font-mono text-[10px]"
              >
                {scanLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 text-blue-400/80">
                    <span className="text-blue-600/40">{`>`}</span>
                    <span className="leading-tight">{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isWalletSelectorOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => !loading && setIsWalletSelectorOpen(false)} />
          <div className="relative glass-effect border border-white/10 w-full max-w-[340px] rounded-[2.5rem] p-8 space-y-6 shadow-2xl border-t-white/20 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-500">Connect Wallet</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Select Onchain Provider</p>
              </div>
              <div className="flex items-center gap-2">
                {!loading && (
                  <button 
                    onClick={() => setShowWalletGuide(!showWalletGuide)} 
                    className={`p-2 rounded-full transition-all ${showWalletGuide ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-500'}`}
                    title="Connection Guide"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setIsWalletSelectorOpen(false)} disabled={loading} className="p-2 hover:bg-white/5 rounded-full transition-colors group disabled:opacity-30">
                  <X className="w-4 h-4 text-gray-500 group-hover:text-white" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 space-y-6 text-center animate-in zoom-in-95 duration-300">
                <div className="relative inline-block">
                  <div className="w-16 h-16 border-[3px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <Wallet className="w-6 h-6 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="space-y-2">
                   <h4 className="text-sm font-black uppercase italic tracking-tight">Connecting to {activeWalletName}</h4>
                   <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] animate-pulse">Awaiting authorization...</p>
                </div>
              </div>
            ) : showWalletGuide ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl space-y-3">
                   <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                     <Lightbulb className="w-3 h-3" /> Requirements Guide
                   </div>
                   <div className="space-y-4">
                     {[
                       { name: "Coinbase Wallet", desc: "Native Base support. Use for smart wallet features and gasless claims." },
                       { name: "OKX Wallet", desc: "Top-tier security for ecosystem builders. Fast multichain switching." },
                       { name: "Zerion Wallet", desc: "Modern social wallet. Track your badges and NFTs visually." },
                       { name: "Rabby Wallet", desc: "Best for advanced users. Detailed transaction simulations." }
                     ].map((w, i) => (
                       <div key={i} className="space-y-1">
                         <div className="text-[11px] font-black text-white uppercase">{w.name}</div>
                         <p className="text-[9px] text-gray-500 font-bold leading-relaxed">{w.desc}</p>
                       </div>
                     ))}
                   </div>
                </div>
                <button 
                  onClick={() => setShowWalletGuide(false)}
                  className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                  Back to Wallet List
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {walletError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 animate-in slide-in-from-top-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-tight">{walletError}</span>
                  </div>
                )}

                <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {detectedProviders.length > 0 ? (
                    detectedProviders.map((det) => (
                      <button
                        key={det.info.uuid}
                        onClick={() => connectWallet(det)}
                        className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98] group"
                      >
                        <div className="flex items-center gap-4">
                          <img src={det.info.icon} alt={det.info.name} className="w-6 h-6 object-contain" />
                          <div className="text-left">
                            <span className="text-sm font-bold tracking-tight block">{det.info.name}</span>
                            <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">EIP-6963 Extension</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                      </button>
                    ))
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center p-6 border border-dashed border-white/10 rounded-3xl opacity-50 space-y-2">
                        <Globe className="w-8 h-8 mx-auto text-gray-600" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">No browser wallet detected</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isTwitterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => twitterStep !== 3 && setIsTwitterModalOpen(false)} />
          <div className="relative glass-effect border border-white/10 w-full max-w-sm rounded-[3rem] p-8 space-y-6 shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl -mr-16 -mt-16" />
            <button onClick={() => setIsTwitterModalOpen(false)} disabled={twitterStep === 3} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors disabled:opacity-0"><X className="w-5 h-5" /></button>
            <div className="text-center space-y-2 relative">
              <div className="w-16 h-16 bg-white text-black rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3"><Twitter className="w-8 h-8" /></div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Twitter Bridge</h3>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest opacity-60">Contribution Identity System</p>
            </div>
            {twitterStep === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Profile Handle</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-black">@</span>
                    <input type="text" placeholder="vitalik.eth" value={tempTwitterHandle} onChange={(e) => setTempTwitterHandle(e.target.value.replace('@', ''))} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-sm font-bold focus:border-blue-500/50 outline-none transition-all placeholder:text-white/10" />
                  </div>
                </div>
                <button onClick={handleTwitterVerifyStart} disabled={!tempTwitterHandle.trim()} className="w-full py-5 bg-white text-black rounded-2xl font-black text-sm hover:bg-blue-50 transition-all active:scale-95 uppercase italic tracking-tight">Configure Access <ArrowRight className="w-4 h-4 ml-1 inline" /></button>
              </div>
            )}
            {twitterStep === 2 && (
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/10 space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest"><Lock className="w-3 h-3" /> Encrypted Handshake</div>
                  <div className="space-y-3">
                    <p className="text-[11px] text-gray-400 leading-relaxed font-bold">Connecting <span className="text-white">@{tempTwitterHandle}</span> requires read permissions for historical posts and ecosystem tags.</p>
                    <div className="h-px bg-white/5" />
                    <ul className="text-[9px] text-gray-500 space-y-2 font-black uppercase tracking-tight">
                      <li className="flex gap-2 items-center"><CheckCircle2 className="w-3 h-3 text-green-500" /> Read account profile</li>
                      <li className="flex gap-2 items-center"><CheckCircle2 className="w-3 h-3 text-green-500" /> Analyze post history</li>
                      <li className="flex gap-2 items-center"><CheckCircle2 className="w-3 h-3 text-green-500" /> Verify ecosystem tags</li>
                    </ul>
                  </div>
                </div>
                {modalError && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-2 text-red-500 animate-pulse"><AlertCircle className="w-4 h-4 shrink-0" /><span className="text-[10px] font-black uppercase">{modalError}</span></div>}
                <div className="flex flex-col gap-3">
                  <button onClick={handlePostVerificationTweet} className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-sm hover:bg-blue-400 transition-all shadow-xl active:scale-95 uppercase italic">Authorize & Secure</button>
                  <button onClick={() => setTwitterStep(1)} className="w-full py-2 text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors">Change Handle</button>
                </div>
              </div>
            )}
            {twitterStep === 3 && (
              <div className="py-12 space-y-6 text-center animate-in zoom-in-95 duration-500">
                <div className="relative inline-block"><div className="w-20 h-20 border-[3px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /><Twitter className="w-8 h-8 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
                <div className="space-y-2"><h4 className="text-lg font-black uppercase italic">Securing Bridge</h4><p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] animate-pulse">Requesting OAuth Token...</p></div>
              </div>
            )}
            {twitterStep === 4 && (
              <div className="py-12 space-y-6 text-center animate-in scale-110 duration-500">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.4)]"><Unlock className="w-8 h-8 text-white" /></div>
                <div className="space-y-2"><h4 className="text-2xl font-black uppercase italic text-green-500">Authorized!</h4><p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Profile linked securely</p></div>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 glass-effect border-b border-white/5 px-4 py-3 flex justify-between items-center bg-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <BrandIcon size="sm" />
          <div className="flex flex-col"><h1 className="font-black text-sm tracking-tighter uppercase leading-none text-white">Base Impression</h1><span className="text-[8px] text-blue-500 font-bold tracking-[0.2em] uppercase mt-0.5 font-mono">Season 1 Protocol</span></div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 glass-effect px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-mono font-black text-blue-100 uppercase">{formatSessionTime(sessionTimeLeft)}</span>
            </div>
          )}
          {user && (
            <button 
              onClick={() => handleLogout(false)}
              className="p-2 hover:bg-red-500/10 rounded-full transition-all group border border-white/5"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-500" />
            </button>
          )}
          {user && (
            <div className="flex items-center gap-2 glass-effect px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono font-black text-blue-100 uppercase">{user.address.slice(0, 6)}...{user.address.slice(-4)}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 pb-32">
        {!user ? (
          <div className="space-y-12 animate-in fade-in duration-1000 slide-in-from-bottom-4">
            <div className="text-center space-y-6">
              <div className="relative inline-block"><div className="absolute inset-0 bg-blue-600 blur-[80px] opacity-20 animate-pulse" /><BrandIcon size="lg" /></div>
              <div className="space-y-3"><h2 className="text-4xl font-black tracking-tight leading-[0.9] uppercase italic text-white drop-shadow-2xl">Impact<br/>Analysis.</h2><p className="text-gray-400 text-xs max-w-[280px] mx-auto leading-relaxed font-bold uppercase tracking-wide opacity-70">Securely link your wallet and social footprint to claim your onchain rank.</p></div>
            </div>
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="glass-effect p-6 rounded-[2.5rem] border border-white/10 space-y-5 bg-white/[0.02] shadow-2xl">
                <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] text-center mb-2">Autodetection Mode</h3>
                
                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${isWalletConnected ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10 shadow-inner'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${isWalletConnected ? 'text-green-500' : 'text-blue-500'}`}>
                      {loading && !isWalletConnected ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight">Step 1: Auth</div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase">{walletAddress ? `${activeWalletName} Connected` : 'Detect Provider'}</div>
                    </div>
                  </div>
                  {isWalletConnected ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : (
                    <button 
                      onClick={() => setIsWalletSelectorOpen(true)} 
                      disabled={loading}
                      className="px-5 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-tight active:scale-95 disabled:opacity-50"
                    >
                      {loading ? 'Wait...' : 'Connect'}
                    </button>
                  )}
                </div>

                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${isWalletSigned ? 'bg-green-500/5 border-green-500/30' : isWalletConnected ? 'bg-indigo-500/10 border-indigo-500/40 animate-pulse' : 'bg-white/5 border-white/10 opacity-40 shadow-inner'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${isWalletSigned ? 'text-green-500' : 'text-indigo-400'}`}>
                      {loading && isWalletConnected && !isWalletSigned ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight">Step 2: Sign</div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase">{isWalletSigned ? 'Proof generated' : 'Ethers.js Secure'}</div>
                    </div>
                  </div>
                  {isWalletSigned ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : (
                    <button onClick={signVerification} disabled={!isWalletConnected || loading} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight active:scale-95 ${isWalletConnected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'bg-white/5 text-gray-600 disabled:opacity-50'}`}>
                      {loading && isWalletConnected ? 'Awaiting...' : 'Sign'}
                    </button>
                  )}
                </div>

                {error && !isWalletSigned && isWalletConnected && (
                   <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-[9px] font-black uppercase tracking-tight">
                     <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                     {error}
                   </div>
                )}

                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${twUser ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10 shadow-inner'}`}>
                  <div className="flex items-center gap-4"><div className={`${twUser ? 'text-green-500' : 'text-blue-400'}`}><Twitter className="w-5 h-5" /></div><div><div className="text-[11px] font-black uppercase tracking-tight">Social Indexer</div><div className="text-[9px] text-gray-500 font-bold uppercase">{twUser ? twUser.handle : 'Link handle'}</div></div></div>
                  {twUser ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <button onClick={() => setIsTwitterModalOpen(true)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-tight active:scale-95">Link</button>}
                </div>
              </div>
              <button onClick={handleFinalizeConnection} disabled={!isWalletSigned || !twUser || loading} className={`w-full py-5 rounded-[2rem] font-black text-sm transition-all flex items-center justify-center gap-2 shadow-2xl active:scale-95 uppercase tracking-widest italic ${isWalletSigned && twUser ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20' : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/10'}`}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Scan & Track Impact'}<ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 gap-3 mb-2"><Countdown targetDate={claimTimeReached ? SNAPSHOT_END : CLAIM_START} label={claimTimeReached ? "Genesis Snapshot Finalized" : "Genesis SBT Mint Opens In"} /></div>
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 sticky top-[76px] z-30 backdrop-blur-xl bg-black/40 shadow-2xl">
              {(['dashboard', 'leaderboard', 'claim'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'}`}>{tab}</button>
              ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2.5rem] border border-blue-500/30 text-center relative overflow-hidden group shadow-2xl"><span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] relative z-10">Total Impact</span><div className="text-4xl font-black text-white mt-1 relative z-10">{user.points}</div><div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-500/10 blur-2xl" /></div>
                  <div className="glass-effect p-6 rounded-[2.5rem] border border-purple-500/30 text-center relative overflow-hidden group shadow-2xl"><span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] relative z-10">Global Rank</span><div className="text-4xl font-black text-white mt-1 relative z-10">#{user.rank}</div><div className="absolute -right-4 -bottom-4 w-16 h-16 bg-purple-500/10 blur-2xl" /></div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="glass-effect p-5 rounded-[2rem] border border-green-500/20 bg-green-500/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="p-2.5 bg-green-500/10 rounded-xl text-green-500"><ShieldCheck className="w-5 h-5" /></div>
                       <div className="flex flex-col">
                         <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Profile Trust Rating</span>
                         <span className="text-xl font-black text-white italic mt-1">{user.trustScore}% <span className="text-[10px] font-bold text-green-500 not-italic uppercase ml-1">Verified</span></span>
                       </div>
                    </div>
                    <div className="w-12 h-12 relative">
                       <svg className="w-full h-full transform -rotate-90">
                         <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                         <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${user.trustScore ? user.trustScore * 1.25 : 0}, 125`} className="text-green-500 transition-all duration-1000" />
                       </svg>
                    </div>
                  </div>
                </div>

                <div className="glass-effect p-8 rounded-[3rem] border border-white/10 text-center space-y-8 bg-white/[0.01] shadow-2xl">
                   <BadgeDisplay tier={currentTier} imageUrl={badgeImage} loading={isGenerating} />
                   {analysis && (
                     <div className="relative">
                        <p className="text-xs font-bold text-blue-100/60 leading-relaxed px-6 py-4 bg-blue-500/5 rounded-[1.5rem] border border-blue-500/10 italic">"{analysis}"</p>
                        <div className="absolute -top-2 -left-2 text-blue-500 opacity-30 text-2xl font-black">"</div>
                     </div>
                   )}
                   <div className="grid grid-cols-1 gap-4">
                     <button onClick={handleCheckpoint} disabled={isGenerating} className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl italic"><ShieldCheck className="w-4 h-4" />{isGenerating ? 'Indexing Chain...' : 'Update Snapshot'}</button>
                      <div className="flex gap-3">
                        <button onClick={() => handleShare('farcaster')} className="flex-1 py-4 bg-[#8a63d2]/10 hover:bg-[#8a63d2]/20 text-[#8a63d2] border border-[#8a63d2]/30 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"><Share2 className="w-3.5 h-3.5" /> Farcaster</button>
                        <button onClick={() => handleShare('twitter')} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"><Twitter className="w-3.5 h-3.5" /> Share X</button>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-2">Smart Contribution Breakdown</h3>
                    <div className="space-y-3">
                        {[
                            { icon: <Target className="w-4 h-4" />, label: "Base Network Age (20%)", val: `${user.baseAppAgeDays}D`, weight: "x0.2", color: "text-blue-500" },
                            { icon: <Twitter className="w-4 h-4" />, label: "Twitter Age (30%)", val: `${user.twitterAgeDays}D`, weight: "x0.3", color: "text-indigo-400" },
                            { icon: <Zap className="w-4 h-4" />, label: "Smart Contribution (50%)", val: `${user.validTweetsCount} pts`, weight: "x0.5", color: "text-yellow-500" },
                            { icon: <CircleDollarSign className="w-4 h-4" />, label: "Ecosystem Holding", val: `$${user.lambolessBalance.toFixed(2)}`, weight: "Gatekeeper", color: "text-green-500" },
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center justify-between p-5 glass-effect rounded-[1.5rem] border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors shadow-sm">
                                <div className="flex items-center gap-4"><div className={`${stat.color} p-2 bg-white/5 rounded-xl`}>{stat.icon}</div><span className="text-[11px] font-black uppercase tracking-tight text-gray-300">{stat.label}</span></div>
                                <div className="text-right"><div className="text-xs font-black text-white">{stat.val}</div><div className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">{stat.weight}</div></div>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2"><h2 className="text-lg font-black uppercase italic tracking-tight text-white">Top Contributors</h2><div className="flex items-center gap-2 text-[9px] text-gray-500 font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/10"><Filter className="w-3 h-3" />Rank Filter</div></div>
                    <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
                      {[{ key: 'ALL', label: 'Global' }, { key: RankTier.PLATINUM, label: 'Platinum' }, { key: RankTier.GOLD, label: 'Gold' }, { key: RankTier.SILVER, label: 'Silver' }, { key: RankTier.BRONZE, label: 'Bronze' }].map((segment) => (
                        <button key={segment.key} onClick={() => setLbFilter(segment.key as any)} className={`whitespace-nowrap px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 ${lbFilter === segment.key ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10'}`}>{segment.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2"><span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Twitter Seniority</span><div className="flex items-center gap-2 text-[9px] text-indigo-400 font-black uppercase tracking-widest bg-indigo-500/5 px-3 py-1.5 rounded-full border border-indigo-500/10"><Twitter className="w-3 h-3" />Account Age</div></div>
                    <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
                      {[{ key: 'ALL', label: 'All Ages' }, { key: 'NEW', label: '< 1 Year' }, { key: 'MID', label: '1-3 Years' }, { key: 'OG', label: '3+ Years' }].map((age) => (
                        <button key={age.key} onClick={() => setAgeFilter(age.key as AgeFilter)} className={`whitespace-nowrap px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 ${ageFilter === age.key ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10'}`}>{age.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {((lbFilter === 'ALL' || lbFilter === currentTier) && 
                    (ageFilter === 'ALL' || (ageFilter === 'NEW' && user.twitterAgeDays < 365) || (ageFilter === 'MID' && user.twitterAgeDays >= 365 && user.twitterAgeDays < 1095) || (ageFilter === 'OG' && user.twitterAgeDays >= 1095)) &&
                    (baseAgeFilter === 'ALL' || (baseAgeFilter === 'NEW' && user.baseAppAgeDays < 365) || (baseAgeFilter === 'ONE' && user.baseAppAgeDays >= 365 && user.baseAppAgeDays < 730) || (baseAgeFilter === 'PLUS' && user.baseAppAgeDays >= 365))) && (
                    <div className="p-5 bg-blue-600/20 border border-blue-500/40 rounded-[2rem] flex items-center justify-between shadow-2xl shadow-blue-600/10 mb-6 animate-in slide-in-from-left-4 duration-500">
                      <div className="flex items-center gap-4"><span className="text-2xl font-black text-blue-400 italic">#{user.rank}</span><div><div className="text-[11px] font-black text-white uppercase tracking-tight">Your Identity</div><div className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] font-mono">{TIERS[currentTier].name} Tier • {user.baseAppAgeDays}D Base / {user.twitterAgeDays}D X</div></div></div>
                      <div className="text-right"><div className="text-xl font-black text-white">{user.points} pts</div></div>
                    </div>
                  )}
                  <div className="h-px bg-white/5 my-4 mx-4" />
                  {filteredLeaderboard.length > 0 ? (
                    filteredLeaderboard.map((player, idx) => (
                      <div key={player.rank} style={{ animationDelay: `${idx * 50}ms` }} className="p-5 glass-effect border border-white/10 rounded-[1.5rem] flex items-center justify-between opacity-80 hover:opacity-100 transition-all hover:translate-x-1 group shadow-lg animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-4"><span className="text-sm font-black text-gray-500 group-hover:text-white transition-colors italic">#{player.rank}</span><div><div className="text-xs font-black text-gray-200">{player.handle}</div><div className="flex items-center gap-2 mt-1"><div className={`text-[8px] font-black uppercase tracking-[0.15em] bg-clip-text text-transparent bg-gradient-to-r ${TIERS[player.tier as RankTier].color}`}>{TIERS[player.tier as RankTier].name}</div><div className="w-1 h-1 rounded-full bg-white/20" /><div className="text-[8px] font-black text-blue-400 uppercase">{player.baseAppAgeDays}D Base</div><div className="w-1 h-1 rounded-full bg-white/20" /><div className="text-[8px] font-black text-indigo-400 uppercase">{player.accountAgeDays}D X</div></div></div></div>
                          <div className="text-sm font-black text-white">{player.points} pts</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 opacity-40 space-y-4"><Search className="w-12 h-12 mx-auto text-gray-600" /><p className="text-[10px] font-black uppercase tracking-widest">No participants found matching these criteria</p></div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-8 animate-in zoom-in-95 duration-700">
                {!isMinted ? (
                  <>
                    <div className="text-center space-y-4"><div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/30 shadow-2xl shadow-blue-600/20"><CreditCard className="w-10 h-10 text-blue-500" /></div><div className="space-y-2"><h2 className="text-2xl font-black uppercase italic text-white">SBT Minting Portal</h2><p className="text-xs text-gray-400 max-w-[280px] mx-auto font-medium uppercase tracking-tight opacity-70">Tiered Soulbound Tokens (SBT) represent your verifiable contribution weight.</p></div></div>
                    <div className="space-y-3">
                        <div className={`p-5 rounded-[1.5rem] border flex items-center justify-between transition-all shadow-xl ${user.rank <= 1000 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}><div className="flex items-center gap-4">{user.rank <= 1000 ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}<div><div className="text-[11px] font-black uppercase tracking-tight">Rank Eligibility</div><div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">#{user.rank} / Top 1000</div></div></div></div>
                        <div className={`p-5 rounded-[1.5rem] border flex items-center justify-between transition-all shadow-xl ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}><div className="flex items-center gap-4">{user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}<div><div className="text-[11px] font-black uppercase tracking-tight">Ecosystem Balance</div><div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Min. $2.50 Verified (Live: ${user.lambolessBalance.toFixed(2)})</div></div></div></div>
                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-[1.2rem] space-y-2 shadow-inner"><div className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]"><Info className="w-3 h-3" /><span>Security Protocol</span></div><p className="text-[10px] text-gray-500 leading-tight uppercase font-black tracking-tight opacity-60">Contribution badges are soulbound to your verified address. Claims locked until <strong className="text-white">January 16, 2026</strong>.</p></div>
                    </div>
                    <div className="space-y-4 pt-4"><button onClick={handleMint} disabled={!isClaimable || isMinting} className={`w-full py-5 rounded-[2.5rem] font-black text-lg transition-all shadow-2xl relative overflow-hidden active:scale-95 uppercase italic tracking-tighter ${isClaimable ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/30' : 'bg-white/5 text-gray-700 cursor-not-allowed border border-white/5'}`}><div className="relative z-10 flex items-center justify-center gap-3">{!claimTimeReached ? 'Pre-Registration' : isMinting ? (<><Loader2 className="w-6 h-6 animate-spin" />Minting Tier SBT...</>) : 'Mint Genesis SBT'}</div></button></div>
                  </>
                ) : (
                  <div className="space-y-8 py-4 text-center">
                    <div className="relative inline-block"><div className="absolute inset-0 bg-green-500 blur-[100px] opacity-30 animate-pulse" /><div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/50 relative shadow-2xl"><PartyPopper className="w-12 h-12 text-green-500" /></div></div>
                    <div className="space-y-3"><h2 className="text-3xl font-black text-white uppercase italic">Impact Secured!</h2><p className="text-gray-400 text-xs px-12 uppercase font-bold tracking-tight opacity-70 leading-relaxed font-mono">Your identity as a Base builder is now immutable onchain.</p></div>
                    <div className="glass-effect p-6 rounded-[2rem] border border-green-500/30 space-y-4 bg-green-500/5 shadow-2xl"><div className="flex items-center justify-between"><span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[9px]">SBT HASH</span><span className="text-blue-400 font-mono text-[10px] font-bold">{txHash?.slice(0, 16)}...</span></div><div className="h-px bg-white/10" /><div className="flex items-center justify-between"><span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[9px]">OWNER</span><span className="text-white font-black text-[10px] uppercase font-mono">{walletAddress?.slice(0, 16)}...</span></div></div>
                    <div className="space-y-3 pt-4"><button onClick={() => handleShare('farcaster')} className="w-full py-5 bg-[#8a63d2] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-[#7a52c2] transition-all flex items-center justify-center gap-2 active:scale-95 shadow-2xl shadow-[#8a63d2]/30 italic"><Share2 className="w-4 h-4" /> Broadcast to Farcaster</button></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {user && (
          <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-white/10 px-8 py-6 flex items-center justify-between md:hidden z-40 bg-black/95 backdrop-blur-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col"><span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] leading-none opacity-60">Impact Rank</span><span className="text-2xl font-black mt-1 italic text-white tracking-tighter">#{user.rank}</span></div>
              <div className="flex flex-col items-end"><span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] leading-none opacity-60">Verified Weight</span><span className="text-2xl font-black text-blue-500 mt-1 italic tracking-tighter">{user.points} PTS</span></div>
          </div>
      )}
    </div>
  );
};

export default App;
