import React, { useState, useEffect, useMemo } from 'react';
import { 
  Twitter, 
  Wallet, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Info, 
  Share2, 
  Loader2, 
  X,
  ArrowRight,
  Search,
  LogOut,
  Trophy,
  Award,
  Link2,
  Lock,
  ExternalLink,
  Shield,
  Fingerprint,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowUpDown,
  Coins,
  Cpu,
  Binary,
  Send,
  Users,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier } from './types.ts';
import { 
  TIERS, 
  MOCKED_LEADERBOARD,
  MIN_TOKEN_VALUE_USD,
  CLAIM_START,
  LAMBOLESS_CONTRACT,
  NICK_CONTRACT,
  JESSE_CONTRACT,
  HOURLY_WINDOW_START,
  HOURLY_WINDOW_END
} from './constants.ts';
import { calculatePoints, getTierFromRank } from './utils/calculations.ts';
import BadgeDisplay from './components/BadgeDisplay.tsx';
import { geminiService } from './services/geminiService.ts';
import { twitterService, Tweet } from './services/twitterService.ts';
import { tokenService } from './services/tokenService.ts';

const STORAGE_KEY_USER = 'base_impression_v1_user';

interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: any;
}

const BrandLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => {
  const dimensions = size === 'lg' ? 'w-40 h-40' : 'w-10 h-10';
  const radius = size === 'lg' ? 'rounded-[2.5rem]' : 'rounded-xl';
  
  return (
    <div className={`${dimensions} ${radius} relative overflow-hidden border border-white/20 blue-glow`}>
      <img 
        src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=400" 
        className="absolute inset-0 w-full h-full object-cover brightness-75"
        alt="Base"
      />
      <div className="absolute inset-0 bg-blue-600/30 mix-blend-overlay" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${size === 'lg' ? 'text-lg' : 'text-[7px]'} font-black text-white uppercase italic leading-none text-center`}>
          Base<br/>Impression
        </span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<UserStats | null>(null);
  const [farcasterContextUser, setFarcasterContextUser] = useState<any>(null);
  
  const [address, setAddress] = useState('');
  const [handle, setHandle] = useState('');
  const [discoveredProviders, setDiscoveredProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);

  const [isTwitterConnecting, setIsTwitterConnecting] = useState(false);
  const [isTwitterVerified, setIsTwitterVerified] = useState(false);
  const [twitterChallenge, setTwitterChallenge] = useState('');
  const [showTwitterVerifyModal, setShowTwitterVerifyModal] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardSort, setLeaderboardSort] = useState<'desc' | 'asc'>('desc');
  const [leaderboardTierFilter, setLeaderboardTierFilter] = useState<RankTier | 'ALL'>('ALL');

  useEffect(() => {
    const onAnnouncement = (event: any) => {
      setDiscoveredProviders(prev => {
        const detail = event.detail as EIP6963ProviderDetail;
        if (prev.some(p => p.info.uuid === detail.info.uuid)) return prev;
        return [...prev, detail];
      });
    };
    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const init = async () => {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        if (context?.user) {
          console.log("Farcaster Context Detected:", context.user);
          setFarcasterContextUser(context.user);
          
          const saved = localStorage.getItem(STORAGE_KEY_USER);
          if (!saved) {
            setAddress(context.user.custodyAddress || '');
            setHandle(`@${context.user.username}`);
          }
        }
      } catch (e) {
        console.warn("Farcaster SDK init failed:", e);
      } finally {
        loadUserDataFromStorage();
        setIsReady(true);
      }
    };
    init();
    return () => window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const now = new Date();
      if (now >= HOURLY_WINDOW_START && now <= HOURLY_WINDOW_END) {
        setUser(prev => {
          if (!prev) return null;
          const newPoints = calculatePoints(
            prev.baseAppAgeDays || 0,
            prev.twitterAgeDays || 0,
            prev.validTweetsCount || 0,
            prev.farcasterAgeDays || 0,
            { 
              lambo: prev.lambolessBalance || 0, 
              nick: prev.nickBalance || 0, 
              jesse: prev.jesseBalance || 0 
            }
          );
          if (newPoints !== prev.points) {
            return { ...prev, points: newPoints };
          }
          return prev;
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  const loadUserDataFromStorage = () => {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) {
      try {
        const data = JSON.parse(saved) as UserStats;
        setUser(data);
        if (data.twitterHandle) {
          setHandle(data.twitterHandle);
          setIsTwitterVerified(true);
        }
        if (data.address) {
          setAddress(data.address);
          setIsSignatureVerified(true);
        }
      } catch (e) { console.error("Failed to parse saved user data:", e); }
    }
  };

  const handleFarcasterAutoLogin = () => {
    if (!farcasterContextUser) return;
    const custodyAddr = farcasterContextUser.custodyAddress;
    if (!custodyAddr) {
      alert("No custody address found in Farcaster context.");
      return;
    }
    setAddress(custodyAddr);
    setHandle(`@${farcasterContextUser.username}`);
    setIsSignatureVerified(true);
    setIsTwitterVerified(true); 
    setShowWalletSelector(false);
  };

  const initiateWalletConnection = () => {
    setShowWalletSelector(true);
  };

  const handleConnectAndSign = async (provider: any) => {
    setShowWalletSelector(false);
    setIsConnecting(true);
    try {
      const web3 = new Web3(provider);
      const accounts = await web3.eth.requestAccounts();
      if (!accounts.length) throw new Error("No accounts linked");
      const linkedAddress = accounts[0];
      setAddress(linkedAddress);
      setIsConnecting(false);
      setIsSigning(true);
      const challengeMessage = `Base Impression Identity Proof\n\nI am verifying ownership of this wallet for Onchain Summer 2026.\n\nWallet: ${linkedAddress}\nTimestamp: ${Date.now()}`;
      await web3.eth.personal.sign(challengeMessage, linkedAddress, "");
      setIsSignatureVerified(true);
      setIsSigning(false);
    } catch (error) {
      console.error(error);
      setIsSignatureVerified(false);
      setIsConnecting(false);
      setIsSigning(false);
      alert("Authentication failed.");
    }
  };

  const handleStartTwitterVerification = async () => {
    if (!handle) return;
    setIsTwitterConnecting(true);
    try {
      const challenge = await geminiService.generateVerificationChallenge(handle);
      setTwitterChallenge(challenge);
      setShowTwitterVerifyModal(true);
    } catch (e) {
      alert("Failed to generate challenge. Check API config.");
    } finally {
      setIsTwitterConnecting(false);
    }
  };

  const handleConfirmVerification = async (challengeInput: string) => {
    setIsTwitterConnecting(true);
    try {
      const success = await twitterService.verifyOwnership(handle, twitterChallenge);
      if (success) {
        setIsTwitterVerified(true);
        setShowTwitterVerifyModal(false);
      } else { 
        alert("Verification code not found. Please ensure you posted the tweet."); 
      }
    } catch (e) {
      alert("Twitter API connection failed.");
    } finally {
      setIsTwitterConnecting(false);
    }
  };

  const handleScan = async () => {
    // Basic validation before starting
    if (!address) {
      alert("Identity address is missing. Please reconnect.");
      return;
    }
    if (!isTwitterVerified || !isSignatureVerified) {
      alert("Social or Signature identity not fully verified.");
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([]);
    const log = (msg: string) => setScanLogs(p => [...p, msg]);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      log("Initializing audit for " + address.slice(0, 8) + "...");
      setScanProgress(10);
      await sleep(500);

      log("Synchronizing $LAMBOLESS, $thenickshirley, and $JESSE balances...");
      setScanProgress(30);
      const [balLambo, balNick, balJesse] = await Promise.all([
        tokenService.getBalance(address, LAMBOLESS_CONTRACT).catch(() => 0),
        tokenService.getBalance(address, NICK_CONTRACT).catch(() => 0),
        tokenService.getBalance(address, JESSE_CONTRACT).catch(() => 0)
      ]);
      
      log(`Sync Complete: Assets found.`);
      setScanProgress(50);
      await sleep(500);

      log("Fetching market valuations...");
      setScanProgress(65);
      const [pLambo, pNick, pJesse] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT).catch(() => 0.0001),
        tokenService.getTokenPrice(NICK_CONTRACT).catch(() => 0.0001),
        tokenService.getTokenPrice(JESSE_CONTRACT).catch(() => 0.0001)
      ]);
      
      const usdLambo = (balLambo || 0) * pLambo;
      const usdNick = (balNick || 0) * pNick;
      const usdJesse = (balJesse || 0) * pJesse;
      
      log(`Valuation complete: Impact calculated.`);
      setScanProgress(80);
      await sleep(500);

      log("Analyzing social presence...");
      setScanProgress(90);
      const scanResult = await twitterService.scanPosts(handle).catch(err => {
        console.warn("Twitter scan error, using defaults:", err);
        return { accountAgeDays: 30, cappedPoints: 5, trustScore: 50, foundTweets: [] };
      });
      
      setScanProgress(95);
      await sleep(500);

      log("Compiling final report...");
      const baseAge = 150 + Math.floor(Math.random() * 50);
      const fidAge = farcasterContextUser ? Math.max(1, Math.floor(((1000000 - farcasterContextUser.fid) / 1000000) * 800)) : 0;
      
      // Calculate final points with sanitized numbers
      const points = calculatePoints(
        baseAge, 
        scanResult.accountAgeDays || 0, 
        scanResult.cappedPoints || 0, 
        fidAge, 
        { lambo: usdLambo, nick: usdNick, jesse: usdJesse }
      );
      
      const rank = Math.floor(Math.random() * 950) + 1; // Simulated rank
      
      const userData: UserStats = { 
        address, 
        twitterHandle: handle, 
        baseAppAgeDays: baseAge, 
        twitterAgeDays: scanResult.accountAgeDays || 0, 
        validTweetsCount: scanResult.cappedPoints || 0, 
        lambolessBalance: usdLambo, 
        nickBalance: usdNick, 
        jesseBalance: usdJesse,
        points, 
        rank, 
        trustScore: scanResult.trustScore || 50, 
        recentContributions: scanResult.foundTweets || [],
        farcasterId: farcasterContextUser?.fid,
        farcasterUsername: farcasterContextUser?.username,
        farcasterAgeDays: fidAge
      };

      setScanProgress(100);
      await sleep(300);
      
      // CRITICAL: Set user to transition UI
      setUser(userData);
      console.log("Audit Success: User Profile Generated", userData);

    } catch (error) {
      console.error("Critical Audit Failure:", error);
      alert("Audit process failed due to a network error. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleRefreshAssets = async () => {
    if (!user) return;
    setIsRefreshingAssets(true);
    try {
      const [balLambo, balNick, balJesse] = await Promise.all([
        tokenService.getBalance(user.address, LAMBOLESS_CONTRACT),
        tokenService.getBalance(user.address, NICK_CONTRACT),
        tokenService.getBalance(user.address, JESSE_CONTRACT)
      ]);
      const [pLambo, pNick, pJesse] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT),
        tokenService.getTokenPrice(NICK_CONTRACT),
        tokenService.getTokenPrice(JESSE_CONTRACT)
      ]);
      const updatedUser = { 
        ...user, 
        lambolessBalance: (balLambo || 0) * pLambo, 
        nickBalance: (balNick || 0) * pNick, 
        jesseBalance: (balJesse || 0) * pJesse 
      };
      updatedUser.points = calculatePoints(
        updatedUser.baseAppAgeDays || 0, 
        updatedUser.twitterAgeDays || 0, 
        updatedUser.validTweetsCount || 0, 
        updatedUser.farcasterAgeDays || 0, 
        { 
          lambo: updatedUser.lambolessBalance, 
          nick: updatedUser.nickBalance || 0, 
          jesse: updatedUser.jesseBalance || 0 
        }
      );
      setUser(updatedUser);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsRefreshingAssets(false); 
    }
  };

  const handleRefreshVisual = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const tier = getTierFromRank(user.rank);
      const [img, msg] = await Promise.all([
        geminiService.generateBadgePreview(tier, user.twitterHandle), 
        geminiService.getImpressionAnalysis(user.points, user.rank)
      ]);
      setBadgeImage(img);
      setAnalysis(msg);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = (platform: 'farcaster' | 'twitter') => {
    if (!user) return;
    const shareUrl = "https://base.app/app/real-base-2026.vercel.app";
    const tierName = TIERS[getTierFromRank(user.rank)].name;
    
    if (platform === 'twitter') {
      const message = `I just checked my @Base Impression rating! 🏎️💨\n\nPoints: ${user.points.toFixed(2)}\nRank: #${user.rank}\nTier: ${tierName}\n\nCheck your own onchain contribution here:`;
      const tags = "\n\n@base @baseapp @jessepollak #BaseImpression #OnchainSummer";
      sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message + tags)}&url=${encodeURIComponent(shareUrl)}`);
    } else {
      const message = `Check out my Base Impression rating! 🏎️💨\n\nRank: #${user.rank}\nPoints: ${user.points.toFixed(2)}\nTier: ${tierName}\n\nTrack your footprint on Base:`;
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(message)}&embeds[]=${encodeURIComponent(shareUrl)}`);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsTwitterVerified(false);
    setIsSignatureVerified(false);
    setShowLogoutConfirm(false);
    setHandle('');
    setAddress('');
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const claimStatus = useMemo(() => {
    const now = new Date();
    const isClaimOpen = now >= CLAIM_START;
    if (!user) return { disabled: true, label: 'Locked', theme: 'bg-gray-800 text-gray-500', icon: Lock, reason: 'Verify identity.' };
    const isRankEligible = user.rank <= 1000;
    const isAssetEligible = user.lambolessBalance >= MIN_TOKEN_VALUE_USD;
    if (!isClaimOpen) return { disabled: true, label: 'Awaiting Snapshot', theme: 'bg-blue-900/40 text-blue-400', icon: Clock, reason: `Minting opens Jan 16` };
    if (!isRankEligible && !isAssetEligible) return { disabled: true, label: 'Ineligible', theme: 'bg-red-900/20 text-red-400', icon: AlertCircle, reason: 'Thresholds not met.' };
    return { disabled: false, label: 'Mint Soulbound NFT', theme: 'bg-blue-600 shadow-lg text-white', icon: Award, reason: 'You are eligible.' };
  }, [user]);

  const filteredLeaderboard = useMemo(() => {
    let list = [...MOCKED_LEADERBOARD];
    if (user && user.twitterHandle && user.points > 0) {
      const existingIdx = list.findIndex(l => l.handle.toLowerCase() === user.twitterHandle.toLowerCase());
      if (existingIdx !== -1) {
        list[existingIdx] = { ...list[existingIdx], points: user.points, rank: user.rank };
      } else {
        list.push({ rank: user.rank, handle: user.twitterHandle, points: user.points, tier: getTierFromRank(user.rank), accountAgeDays: user.twitterAgeDays, baseAppAgeDays: user.baseAppAgeDays });
      }
    }
    return list
      .filter(l => l.handle.toLowerCase().includes(leaderboardSearch.toLowerCase()))
      .sort((a, b) => b.points - a.points);
  }, [leaderboardSearch, user]);

  return (
    <div className="min-h-screen bg-black text-white font-['Space_Grotesk'] pb-24">
      {/* SCANNING OVERLAY */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
          <div className="relative mb-10">
            <Binary className="w-20 h-20 text-blue-500 animate-pulse" />
            <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Auditing Footprint</h2>
          <div className="w-full max-w-xs space-y-4">
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_20px_rgba(37,99,235,1)]" style={{ width: `${scanProgress}%` }} />
            </div>
            <p className="text-[10px] font-black uppercase text-blue-400 min-h-[1.5em]">{scanLogs[scanLogs.length - 1] || "Initializing..."}</p>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showWalletSelector && (
        <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-effect rounded-[3rem] p-8 border-blue-500/20 space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3"><Cpu className="w-5 h-5 text-blue-500" /><h3 className="text-xl font-black uppercase italic tracking-tighter">Link Source</h3></div>
              <button onClick={() => setShowWalletSelector(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto px-1 py-1">
              {farcasterContextUser && (
                <div onClick={handleFarcasterAutoLogin} className="glass-effect p-6 rounded-[2rem] border border-purple-500/60 bg-purple-950/20 hover:bg-purple-900/40 cursor-pointer group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#8a63d2] rounded-2xl flex items-center justify-center shadow-lg"><Fingerprint className="w-7 h-7 text-white" /></div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase text-purple-100">Farcaster Profile</span>
                      <span className="text-[9px] text-purple-400 font-bold uppercase mt-0.5">@{farcasterContextUser.username}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="h-[1px] bg-white/5 my-2" />
              {discoveredProviders.map((dp) => (
                <div key={dp.info.uuid} className="glass-effect p-5 rounded-[2rem] border border-white/10 hover:border-blue-500/30 cursor-pointer" onClick={() => handleConnectAndSign(dp.provider)}>
                  <div className="flex items-center gap-4">
                    {dp.info.icon ? <img src={dp.info.icon} alt={dp.info.name} className="w-10 h-10 rounded-xl" /> : <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-xs font-black">EX</div>}
                    <div className="flex flex-col"><span className="text-xs font-black uppercase">{dp.info.name}</span><span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">EIP-6963</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTwitterVerifyModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-sm glass-effect p-8 rounded-[3rem] border-blue-500/30 space-y-6">
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Twitter Verification</h2>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"><span className="text-2xl font-mono font-black text-blue-500">{twitterChallenge}</span></div>
            <div className="space-y-3">
              <button onClick={() => sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Verifying my @Base identity: ${twitterChallenge} #BaseImpression`)}`)} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px]">Post Tweet</button>
              <button onClick={() => handleConfirmVerification(twitterChallenge)} disabled={isTwitterConnecting} className="w-full py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px]">{isTwitterConnecting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Posted'}</button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 glass-effect px-4 py-4 flex justify-between items-center bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3"><BrandLogo size="sm" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-tighter leading-none">Base Impression</span><span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">S01 Active</span></div></div>
        {user && <button onClick={() => setShowLogoutConfirm(true)} className="p-2 hover:bg-white/5 rounded-lg"><LogOut className="w-4 h-4 text-gray-500" /></button>}
      </header>

      <main className="max-w-md mx-auto px-4 mt-8">
        {!user ? (
          <div className="space-y-12 text-center animate-in fade-in duration-1000">
            <div className="flex justify-center float-animation"><BrandLogo size="lg" /></div>
            <div className="space-y-3"><h1 className="text-5xl font-black uppercase italic tracking-tight leading-none">Onchain<br/>Proof.</h1><p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em]">Season 01 • Contribution Audit</p></div>
            
            <div className="glass-effect p-8 rounded-[3rem] space-y-6 shadow-2xl">
              <div className="space-y-4">
                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-4">Step 1: Identity</label>
                  {farcasterContextUser && !isSignatureVerified ? (
                    <button onClick={handleFarcasterAutoLogin} className="w-full bg-[#8a63d2] hover:bg-[#7a53c2] text-white rounded-2xl py-5 px-5 flex items-center justify-between transition-all active:scale-[0.98] border border-purple-400/20">
                      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Fingerprint className="w-5 h-5" /></div><div className="flex flex-col text-left"><span className="text-[10px] font-black uppercase">Farcaster Link</span><span className="text-xs font-bold mt-1">@{farcasterContextUser.username}</span></div></div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : !isSignatureVerified ? (
                    <button onClick={initiateWalletConnection} className="w-full bg-blue-600/10 border border-blue-500/30 rounded-2xl py-4 px-5 flex items-center justify-between">
                       <span className="text-xs font-bold uppercase text-blue-200">Connect Wallet</span><Wallet className="w-4 h-4 text-blue-500" />
                    </button>
                  ) : (
                    <div className="w-full bg-green-500/10 border border-green-500/40 rounded-2xl py-4 px-5 flex items-center justify-between">
                      <span className="text-xs font-mono text-green-100">{address.slice(0,6)}...{address.slice(-4)}</span><CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-4">Step 2: Social Presence</label>
                  <div className="relative group flex gap-2">
                    <div className="relative flex-1">
                      <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input value={handle} onChange={e => setHandle(e.target.value)} disabled={isTwitterVerified} placeholder="@username" className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none disabled:opacity-50" />
                    </div>
                    {!isTwitterVerified ? (
                      <button onClick={handleStartTwitterVerification} disabled={!handle || isTwitterConnecting} className="px-6 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-[9px] font-black uppercase">Verify</button>
                    ) : (
                      <div className="px-6 bg-green-500/20 border border-green-500/40 rounded-2xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-500" /></div>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={handleScan} disabled={!isSignatureVerified || !isTwitterVerified} className="w-full py-5 bg-blue-600 rounded-[2rem] font-black uppercase italic text-sm shadow-xl active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2">
                Generate Impression <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-gray-600 uppercase font-black">Verified by Base Onchain Identity</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 fade-in duration-700">
            <div className="flex glass-effect p-1.5 rounded-2xl sticky top-20 z-30 backdrop-blur-xl border border-white/5">
              {(['dashboard', 'leaderboard', 'claim'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 shadow-lg text-white' : 'text-gray-500'}`}>
                  {t}
                </button>
              ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2.5rem] border-blue-500/20 text-center relative overflow-hidden">
                    <span className="text-[9px] font-black uppercase text-gray-500">Impact Score</span>
                    <div className="text-3xl font-black italic mt-1">{user.points.toFixed(2)}</div>
                  </div>
                  <div className="glass-effect p-6 rounded-[2.5rem] border-purple-500/20 text-center">
                    <span className="text-[9px] font-black uppercase text-gray-500">Trust Index</span>
                    <div className="text-3xl font-black italic mt-1 text-blue-400">{user.trustScore}%</div>
                  </div>
                </div>

                <div className="glass-effect p-8 rounded-[3rem] border-white/5 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><Coins className="w-4 h-4 text-blue-500" /><h3 className="text-xs font-black uppercase italic">Asset Contributions</h3></div>
                    <button onClick={() => handleShare('twitter')} className="px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full text-[9px] font-black text-blue-400">Share</button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: '$LAMBOLESS', bal: user.lambolessBalance, color: 'text-blue-400' },
                      { name: '$NICK', bal: user.nickBalance || 0, color: 'text-purple-400' },
                      { name: '$JESSE', bal: user.jesseBalance || 0, color: 'text-green-400' },
                    ].map((asset, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                        <span className={`text-[10px] font-black ${asset.color}`}>{asset.name}</span>
                        <span className="text-[10px] font-black text-white">${asset.bal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-effect p-10 rounded-[4rem] text-center space-y-6 shadow-2xl">
                  <BadgeDisplay tier={getTierFromRank(user.rank)} imageUrl={badgeImage} loading={isGenerating} />
                  {analysis && <p className="text-[10px] italic text-blue-200/60 bg-white/5 p-4 rounded-2xl leading-relaxed">"{analysis}"</p>}
                  <div className="flex flex-col gap-3">
                    <button onClick={handleRefreshVisual} disabled={isGenerating} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] italic">Refresh Snapshot</button>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleShare('farcaster')} className="py-3 bg-[#8a63d2]/10 border border-[#8a63d2]/30 rounded-2xl text-[9px] font-black uppercase text-purple-200">Warpcast</button>
                      <button onClick={() => handleShare('twitter')} className="py-3 bg-blue-600/10 border border-blue-500/30 rounded-2xl text-[9px] font-black uppercase text-blue-200">Post to X</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
               <div className="space-y-6">
                 <div className="glass-effect p-6 rounded-[2rem] flex justify-between items-center bg-blue-600/5">
                   <div className="flex items-center gap-3">
                     <Users className="w-5 h-5 text-blue-500" />
                     <h3 className="text-xs font-black uppercase">Verified Rankings</h3>
                   </div>
                   <span className="text-xl font-black italic">{filteredLeaderboard.length} Members</span>
                 </div>
                 <div className="space-y-3">
                   {filteredLeaderboard.map((l, i) => (
                     <div key={i} className={`p-6 glass-effect rounded-[2.5rem] flex justify-between items-center border border-white/5`}>
                       <div className="flex items-center gap-4">
                         <span className="text-xs font-black italic text-gray-500">#{i + 1}</span>
                         <div className="flex flex-col">
                           <span className="text-xs font-bold">{l.handle}</span>
                           <span className="text-[7px] font-black uppercase text-blue-400">{TIERS[l.tier].name} Impact</span>
                         </div>
                       </div>
                       <span className="text-xs font-black">{l.points.toFixed(2)}</span>
                     </div>
                   ))}
                 </div>
               </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-10 text-center py-6">
                 <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20 shadow-2xl"><Award className="w-10 h-10 text-blue-500" /></div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter">Impact Rewards</h2>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-8">Soulbound minting starts Jan 16th for verified builders.</p>
                 <div className="space-y-4 px-4">
                   <div className={`p-6 glass-effect rounded-[2rem] flex justify-between items-center ${user.rank <= 1000 ? 'border-green-500/30' : 'border-red-500/20'}`}>
                      <div className="text-left"><p className="text-[10px] font-black uppercase">Impact Rank</p><p className="text-[8px] text-gray-500 font-bold uppercase">Threshold #1000</p></div>
                      <div className="flex flex-col items-end"><span className={`text-xs font-black ${user.rank <= 1000 ? 'text-green-400' : 'text-red-400'}`}>#{user.rank}</span>{user.rank <= 1000 ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-red-500" />}</div>
                   </div>
                   <div className={`p-6 glass-effect rounded-[2rem] flex justify-between items-center ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'border-green-500/30' : 'border-red-500/20'}`}>
                      <div className="text-left"><p className="text-[10px] font-black uppercase">$LAMBOLESS Balance</p><p className="text-[8px] text-gray-500 font-bold uppercase">Min $2.50 USD</p></div>
                      <div className="flex flex-col items-end"><span className={`text-xs font-black ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'text-green-400' : 'text-red-400'}`}>${user.lambolessBalance.toFixed(2)}</span>{user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-red-500" />}</div>
                   </div>
                 </div>
                 <div className="space-y-4 px-4">
                   <button onClick={handleRefreshAssets} disabled={isRefreshingAssets} className="text-[10px] font-black uppercase text-blue-500 flex items-center justify-center gap-2 mx-auto py-2 px-4 hover:bg-blue-500/5 rounded-xl transition-all">{isRefreshingAssets ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sync Assets</button>
                   <button disabled={claimStatus.disabled} className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm transition-all active:scale-95 ${claimStatus.theme}`}><claimStatus.icon className="w-5 h-5 mx-auto" /></button>
                   {claimStatus.disabled && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">{claimStatus.reason}</p>}
                 </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;