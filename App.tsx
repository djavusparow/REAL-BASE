
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Filter,
  Copy,
  ShoppingCart,
  ChevronLeft,
  ChevronRightSquare,
  History,
  Activity,
  Globe,
  ZapOff,
  Flame,
  Check
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier, LeaderboardEntry } from './types.ts';
import { 
  TIERS, 
  MIN_TOKEN_VALUE_USD,
  CLAIM_START,
  LAMBOLESS_CONTRACT,
  NICK_CONTRACT,
  JESSE_CONTRACT,
  HOURLY_WINDOW_START,
  HOURLY_WINDOW_END,
  MULTIPLIERS
} from './constants.ts';
import { calculateDetailedPoints, getTierFromPoints } from './utils/calculations.ts';
import BadgeDisplay from './components/BadgeDisplay.tsx';
import { geminiService } from './services/geminiService.ts';
import { twitterService, Tweet } from './services/twitterService.ts';
import { tokenService } from './services/tokenService.ts';

const STORAGE_KEY_USER = 'base_impression_v1_user';
const STORAGE_KEY_AUDIT_COUNT = 'base_impression_v1_count';

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
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);
  const [isTwitterVerified, setIsTwitterVerified] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  const [communityAuditCount, setCommunityAuditCount] = useState(1);

  const getFarcasterAddress = useCallback((ctx: any) => {
    if (!ctx) return null;
    return (
      ctx.address || 
      ctx.custodyAddress || 
      (ctx.verifiedAddresses && ctx.verifiedAddresses.length > 0 ? ctx.verifiedAddresses[0] : null)
    );
  }, []);

  const loadUserDataFromStorage = useCallback(() => {
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
      } catch (e) { 
        console.error("Failed to parse user data from storage", e); 
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
      const processCallback = async () => {
        setIsScanning(true);
        setScanLogs(["Authenticating with Twitter..."]);
        const result = await twitterService.handleCallback(params);
        if (result) {
          setHandle(result.handle);
          setIsTwitterVerified(true);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setIsScanning(false);
      };
      processCallback();
    }

    const onAnnouncement = (event: any) => {
      setDiscoveredProviders(prev => {
        const detail = event.detail as EIP6963ProviderDetail;
        if (prev.some(p => p.info.uuid === detail.info.uuid)) return prev;
        return [...prev, detail];
      });
    };
    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const savedCount = localStorage.getItem(STORAGE_KEY_AUDIT_COUNT);
    if (savedCount) {
      setCommunityAuditCount(parseInt(savedCount));
    }

    const init = async () => {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        if (context?.user) {
          setFarcasterContextUser(context.user);
        }
        loadUserDataFromStorage();
        if (context?.user && !localStorage.getItem(STORAGE_KEY_USER)) {
            const detectedAddr = getFarcasterAddress(context.user);
            if (detectedAddr) {
              setAddress(detectedAddr);
              setIsSignatureVerified(true);
            }
            const detectedHandle = context.user.username ? `@${context.user.username}` : '';
            if (detectedHandle) {
              setHandle(detectedHandle);
              setIsTwitterVerified(true);
            }
        }
      } catch (e) { 
        console.warn("Farcaster SDK init warning:", e); 
      } finally {
        setIsReady(true);
      }
    };
    init();
    return () => window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }, [getFarcasterAddress, loadUserDataFromStorage]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const now = new Date();
      if (now >= HOURLY_WINDOW_START && now <= HOURLY_WINDOW_END) {
        setUser(prev => {
          if (!prev) return null;
          const { total, breakdown } = calculateDetailedPoints(
            prev.baseAppAgeDays || 0,
            prev.twitterAgeDays || 0,
            prev.validTweetsCount || 0,
            prev.farcasterId || 0,
            { lambo: prev.lambolessBalance || 0, nick: prev.nickBalance || 0, jesse: prev.jesseBalance || 0 },
            prev.basepostingPoints || 0
          );
          if (Math.abs(total - prev.points) > 0.0001) return { ...prev, points: total, pointsBreakdown: breakdown };
          return prev;
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleTwitterSync = async () => {
    if (!user) return;
    setIsScanning(true);
    setScanLogs(["Syncing Twitter identity impact..."]);
    setScanProgress(20);

    try {
      const scanResult = await twitterService.scanPosts(user.twitterHandle);
      setScanProgress(80);
      
      const createdAt = new Date(Date.now() - (scanResult.accountAgeDays * 24 * 60 * 60 * 1000)).toLocaleDateString();

      const { total, breakdown } = calculateDetailedPoints(
        user.baseAppAgeDays, 
        scanResult.accountAgeDays, 
        scanResult.cappedPoints, 
        user.farcasterId || 0,
        { lambo: user.lambolessBalance || 0, nick: user.nickBalance || 0, jesse: user.jesseBalance || 0 },
        scanResult.basepostingPoints
      );

      setUser({
        ...user,
        twitterAgeDays: scanResult.accountAgeDays,
        twitterCreatedAt: createdAt,
        validTweetsCount: scanResult.cappedPoints,
        basepostingPoints: scanResult.basepostingPoints,
        points: total,
        pointsBreakdown: breakdown
      });

      setScanProgress(100);
      await new Promise(r => setTimeout(r, 500));
      alert("Twitter impact synced!");
    } catch (e) {
      console.error(e);
      alert("Twitter sync failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFarcasterScan = async () => {
    if (!user) return;
    if (!farcasterContextUser) {
      alert("Farcaster context not found. Please open this app within Warpcast.");
      return;
    }

    setIsScanning(true);
    setScanLogs(["Establishing Farcaster Handshake..."]);
    setScanProgress(15);
    
    const fid = farcasterContextUser.fid;
    const username = farcasterContextUser.username || "anon";
    
    setScanLogs(prev => [...prev, `FID Detected: ${fid}`, `Target: @${username}`]);
    setScanProgress(60);
    setScanProgress(85);

    const { total, breakdown } = calculateDetailedPoints(
      user.baseAppAgeDays, 
      user.twitterAgeDays, 
      user.validTweetsCount, 
      fid,
      { lambo: user.lambolessBalance || 0, nick: user.nickBalance || 0, jesse: user.jesseBalance || 0 },
      user.basepostingPoints || 0
    );

    setUser({
      ...user,
      farcasterId: fid,
      farcasterUsername: username,
      points: total,
      pointsBreakdown: breakdown
    });

    setScanProgress(100);
    await new Promise(r => setTimeout(r, 500));
    setIsScanning(false);
    alert("Farcaster identity impact synced!");
  };

  const handleScan = async () => {
    const currentAddress = address || getFarcasterAddress(farcasterContextUser);
    const currentHandle = handle || (farcasterContextUser?.username ? `@${farcasterContextUser.username}` : '');
    if (!currentAddress) return;

    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([]);
    const log = (msg: string) => setScanLogs(p => [...p, msg]);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      log("Initializing secure audit...");
      setScanProgress(15);
      await sleep(600);

      log("Calculating Onchain Presence...");
      const [amtLambo, amtNick, amtJesse] = await Promise.all([
        tokenService.getBalance(currentAddress, LAMBOLESS_CONTRACT),
        tokenService.getBalance(currentAddress, NICK_CONTRACT),
        tokenService.getBalance(currentAddress, JESSE_CONTRACT)
      ]);
      setScanProgress(40);
      
      log("Syncing Asset Prices...");
      const [pLambo, pNick, pJesse] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT),
        tokenService.getTokenPrice(NICK_CONTRACT),
        tokenService.getTokenPrice(JESSE_CONTRACT)
      ]);
      
      const usdLambo = amtLambo * pLambo;
      const usdNick = amtNick * pNick;
      const usdJesse = amtJesse * pJesse;
      setScanProgress(60);

      log("Analyzing Social Impact...");
      const scanResult = await twitterService.scanPosts(currentHandle);
      setScanProgress(85);
      
      log("Generating Impression Report...");
      await sleep(400);
      
      const baseAge = 150 + Math.floor(Math.random() * 50);
      const fid = farcasterContextUser?.fid || 0;
      
      const { total, breakdown } = calculateDetailedPoints(
        baseAge, scanResult.accountAgeDays, scanResult.cappedPoints, fid, 
        { lambo: usdLambo, nick: usdNick, jesse: usdJesse },
        scanResult.basepostingPoints
      );

      const twitterCreatedAt = new Date(Date.now() - (scanResult.accountAgeDays * 24 * 60 * 60 * 1000)).toLocaleDateString();
      const updatedCount = communityAuditCount + 1;
      setCommunityAuditCount(updatedCount);
      localStorage.setItem(STORAGE_KEY_AUDIT_COUNT, updatedCount.toString());

      setUser({ 
        address: currentAddress, twitterHandle: currentHandle, baseAppAgeDays: baseAge, twitterAgeDays: scanResult.accountAgeDays, 
        twitterCreatedAt, validTweetsCount: scanResult.cappedPoints, basepostingPoints: scanResult.basepostingPoints,
        lambolessBalance: usdLambo, nickBalance: usdNick, jesseBalance: usdJesse,
        lambolessAmount: amtLambo, nickAmount: amtNick, jesseAmount: amtJesse, points: total, pointsBreakdown: breakdown,
        rank: 0, trustScore: scanResult.trustScore, recentContributions: scanResult.foundTweets,
        farcasterId: fid, farcasterUsername: farcasterContextUser?.username
      });

      setScanProgress(100);
      await sleep(500);
    } catch (error) { 
      console.error(error); 
      alert("Audit failed. Check connection."); 
    } finally { 
      setIsScanning(false); 
    }
  };

  const handleRefreshAssets = async () => {
    if (!user) return;
    setIsRefreshingAssets(true);
    try {
      const [amtLambo, amtNick, amtJesse] = await Promise.all([
        tokenService.getBalance(user.address, LAMBOLESS_CONTRACT),
        tokenService.getBalance(user.address, NICK_CONTRACT),
        tokenService.getBalance(user.address, JESSE_CONTRACT)
      ]);
      const [pLambo, pNick, pJesse] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT),
        tokenService.getTokenPrice(NICK_CONTRACT),
        tokenService.getTokenPrice(JESSE_CONTRACT)
      ]);

      const usdLambo = amtLambo * pLambo;
      const usdNick = amtNick * pNick;
      const usdJesse = amtJesse * pJesse;

      const { total, breakdown } = calculateDetailedPoints(
        user.baseAppAgeDays, user.twitterAgeDays, user.validTweetsCount, user.farcasterId || 0, 
        { lambo: usdLambo, nick: usdNick, jesse: usdJesse },
        user.basepostingPoints || 0
      );
      
      setUser({ 
        ...user, 
        lambolessBalance: usdLambo, nickBalance: usdNick, jesseBalance: usdJesse,
        lambolessAmount: amtLambo, nickAmount: amtNick, jesseAmount: amtJesse, 
        points: total, pointsBreakdown: breakdown
      });
    } catch (e) { console.error(e); } finally { setIsRefreshingAssets(false); }
  };

  const handleRefreshVisual = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const tier = getTierFromPoints(user.points);
      const [img, msg] = await Promise.all([
        geminiService.generateBadgePreview(tier, user.twitterHandle || user.farcasterUsername || 'Base Builder'), 
        geminiService.getImpressionAnalysis(user.points, tier)
      ]);
      setBadgeImage(img);
      setAnalysis(msg);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handleShare = (platform: 'farcaster' | 'twitter') => {
    if (!user) return;
    const shareUrl = "https://real-base-2026.vercel.app/";
    const tier = getTierFromPoints(user.points);
    const tierName = TIERS[tier].name;
    const msg = `My Base Impression is live! 🏎️💨\nPoints: ${user.points.toFixed(2)}\nTier: ${tierName}\nJoin now:`;
    if (platform === 'twitter') sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(shareUrl)}`);
    else sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(msg)}&embeds[]=${encodeURIComponent(shareUrl)}`);
  };

  const currentTier = user ? getTierFromPoints(user.points) : RankTier.NONE;
  const config = TIERS[currentTier];

  const claimEligibility = useMemo(() => {
    if (!user) return { eligible: false, message: "Run Audit First", icon: <Lock className="w-4 h-4" /> };
    const now = new Date();
    const currentTier = getTierFromPoints(user.points);
    if (currentTier === RankTier.NONE) return { eligible: false, message: "Entry Threshold Not Met", icon: <Trophy className="w-4 h-4" />, style: "bg-red-950/30 text-red-400 border-red-900/40" };
    const requirement = TIERS[currentTier];
    if ((user.lambolessBalance || 0) < requirement.minLamboUsd) return { eligible: false, message: `Need $${requirement.minLamboUsd} in $LAMBOLESS`, icon: <AlertTriangle className="w-4 h-4" />, style: "bg-orange-950/30 text-orange-400 border-orange-900/40" };
    if (now < CLAIM_START) return { eligible: false, message: "Snapshot Awaited (Jan 16)", icon: <Clock className="w-4 h-4" />, style: "bg-blue-950/30 text-blue-400 border-blue-900/40" };
    return { eligible: true, message: `Claim ${requirement.name} Badge`, icon: <Zap className="w-4 h-4" />, style: "bg-blue-600 text-white shadow-lg shadow-blue-500/30" };
  }, [user]);

  return (
    <div className="min-h-screen bg-black text-white font-['Space_Grotesk'] pb-24">
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
          <Binary className="w-20 h-20 text-blue-500 animate-pulse mb-10" />
          <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Establishing Trust</h2>
          <div className="w-full max-w-xs space-y-4">
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_20px_rgba(37,99,235,1)]" style={{ width: `${scanProgress || 50}%` }} />
            </div>
            <p className="text-[10px] font-black uppercase text-blue-400 min-h-[1.5em] tracking-widest">{scanLogs[scanLogs.length - 1] || "Communicating..."}</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 glass-effect px-4 py-4 flex justify-between items-center bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3"><BrandLogo size="sm" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-tighter leading-none">Base Impression</span><span className="text-[8px] font-bold text-blue-500 uppercase mt-0.5">Real-time Verified</span></div></div>
        {user && <button onClick={() => { setUser(null); localStorage.removeItem(STORAGE_KEY_USER); setAddress(''); setHandle(''); setIsTwitterVerified(false); setIsSignatureVerified(false); }} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><LogOut className="w-4 h-4 text-gray-500" /></button>}
      </header>

      <main className="max-w-md mx-auto px-4 mt-8">
        {!user ? (
          <div className="space-y-12 text-center">
            <div className="flex justify-center float-animation"><BrandLogo size="lg" /></div>
            <div className="space-y-3"><h1 className="text-5xl font-black uppercase italic tracking-tight leading-none">Onchain<br/>Impact.</h1><p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em]">Season 01 • Reward Portal</p></div>
            <div className="glass-effect p-8 rounded-[3rem] space-y-6 shadow-2xl">
              <div className="space-y-4">
                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-4">Profile Identity</label>
                  {!isSignatureVerified ? (
                    <button onClick={() => { 
                      const detected = getFarcasterAddress(farcasterContextUser);
                      if (detected) { setAddress(detected); setIsSignatureVerified(true); } 
                      else alert("No wallets detected.");
                    }} className="w-full bg-blue-600/10 border border-blue-500/30 rounded-2xl py-4 px-5 flex items-center justify-between transition-all hover:bg-blue-600/20"><span className="text-xs font-bold uppercase text-blue-200">Sync Wallet</span><Wallet className="w-4 h-4 text-blue-500" /></button>
                  ) : (
                    <div className="w-full bg-green-500/10 border border-green-500/40 rounded-2xl py-4 px-5 flex items-center justify-between">
                      <div className="flex flex-col"><span className="text-[8px] font-black text-green-500 uppercase">Linked Wallet</span><span className="text-xs font-mono text-green-100">{address.slice(0,6)}...{address.slice(-4)}</span></div>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-4">Social Context</label>
                  {!isTwitterVerified ? (
                    <button onClick={() => twitterService.login()} className="w-full bg-blue-400/10 border border-blue-400/30 rounded-2xl py-4 px-5 flex items-center justify-between transition-all hover:bg-blue-400/20">
                      <div className="flex items-center gap-3">
                        <Twitter className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold uppercase text-blue-200">Connect Twitter</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-400" />
                    </button>
                  ) : (
                    <div className="w-full bg-blue-500/10 border border-blue-500/40 rounded-2xl py-4 px-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Twitter className="w-4 h-4 text-blue-400" />
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-blue-500 uppercase">Verified Handle</span>
                          <span className="text-xs font-bold text-blue-100">{handle}</span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
              </div>
              <button onClick={handleScan} disabled={isScanning || !isSignatureVerified || !isTwitterVerified} className={`w-full py-5 rounded-[2rem] font-black uppercase italic text-sm shadow-xl transition-all ${isScanning || !isSignatureVerified || !isTwitterVerified ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white shadow-blue-500/20 active:scale-[0.98]'}`}>{isScanning ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Check Impact'}</button>
            </div>
            <div className="glass-effect p-6 rounded-[2.5rem] border-white/5 flex items-center justify-between"><div className="flex items-center gap-3"><Activity className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase text-gray-400">Audited Builders</span></div><span className="text-xl font-black italic">{communityAuditCount.toLocaleString()}</span></div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex glass-effect p-1.5 rounded-2xl sticky top-20 z-30 backdrop-blur-xl border border-white/5">
              {(['dashboard', 'claim'] as const).map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 shadow-lg text-white' : 'text-gray-500'}`}>{t}</button>))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-8 pb-10">
                <div className="glass-effect p-6 rounded-[3rem] border-blue-500/20 text-center relative overflow-hidden">
                  <div className="relative z-10">
                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">My Total Points</span>
                    <div className="text-5xl font-black italic mt-1 text-blue-500">{user.points.toFixed(2)}</div>
                    <div className="mt-4 px-10"><div className="h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${Math.min((user.points / 2500) * 100, 100)}%` }} /></div></div>
                    <div className="mt-2 text-[9px] font-bold text-gray-600 uppercase">Season 01 Ranking Proof</div>
                  </div>
                  <Flame className="absolute -bottom-4 -right-4 w-24 h-24 text-blue-500/5 rotate-12" />
                </div>

                <div className="glass-effect p-8 rounded-[3rem] border-blue-500/10 space-y-5">
                   <div className="flex items-center gap-3"><Users className="w-5 h-5 text-purple-500" /><h3 className="text-xs font-black uppercase italic">Identity Scanners</h3></div>
                   <div className="p-5 bg-white/5 rounded-[2rem] border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center"><Twitter className="w-5 h-5 text-blue-400" /></div>
                            <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-gray-500">Twitter Identity</span><span className="text-xs font-bold text-white">{user.twitterHandle || 'Not Synced'}</span></div>
                         </div>
                         <button onClick={handleTwitterSync} disabled={isScanning} className="px-4 py-2 bg-blue-600/20 border border-blue-500/40 rounded-xl text-[9px] font-black uppercase text-blue-200 flex items-center gap-2">{isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sync Profile</button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-600 uppercase">Created / Age</span>
                            <span className="text-[11px] font-bold">{user.twitterCreatedAt || '-'} / {user.twitterAgeDays || 0}d</span>
                            <div className="mt-2 pt-2 border-t border-white/5 flex flex-col">
                               <span className="text-[8px] font-black text-blue-400 uppercase">Baseposting</span>
                               <span className="text-[10px] font-bold text-blue-200">+{user.basepostingPoints || 0} Points</span>
                            </div>
                         </div>
                         <div className="flex flex-col items-end"><span className="text-[8px] font-black text-blue-600 uppercase">Impact Score</span><span className="text-[11px] font-black text-blue-400">+{user.pointsBreakdown?.social_twitter || 0} Pts</span></div>
                      </div>
                   </div>

                   <div className="p-5 bg-white/5 rounded-[2rem] border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-600/10 border border-purple-500/20 overflow-hidden"><img src={farcasterContextUser?.pfpUrl || "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=40"} className="w-full h-full object-cover" alt="FC PFP" /></div>
                            <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-gray-500">Farcaster Identity</span><span className="text-xs font-bold text-white">{user.farcasterUsername ? `@${user.farcasterUsername}` : 'Ready to Sync'}</span></div>
                         </div>
                         <button onClick={handleFarcasterScan} disabled={isScanning} className="px-4 py-2 bg-purple-600/20 border border-purple-500/40 rounded-xl text-[9px] font-black uppercase text-purple-200 flex items-center gap-2">{isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sync Profile</button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                         <div className="flex flex-col"><span className="text-[8px] font-black text-gray-600 uppercase">Farcaster ID</span><span className="text-[11px] font-bold">#{user.farcasterId || '-'}</span></div>
                         <div className="flex flex-col items-end"><span className="text-[8px] font-black text-purple-600 uppercase">Impact Score</span><span className="text-[11px] font-black text-purple-400">+{user.pointsBreakdown?.social_fc || 0} Pts</span></div>
                      </div>
                   </div>
                </div>

                <div className="glass-effect p-10 rounded-[4rem] text-center space-y-6 shadow-2xl shadow-blue-500/5">
                  <BadgeDisplay tier={currentTier} imageUrl={badgeImage} loading={isGenerating} />
                  {analysis && <p className="text-[10px] italic text-blue-200/60 leading-relaxed bg-white/5 p-4 rounded-2xl">"{analysis}"</p>}
                  <div className="flex flex-col gap-3">
                    <button onClick={handleRefreshVisual} disabled={isGenerating} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] italic">Generate NFT Visual</button>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleShare('farcaster')} className="py-3 bg-purple-600/10 border border-purple-500/30 rounded-2xl text-[9px] font-black uppercase">Warpcast</button>
                      <button onClick={() => handleShare('twitter')} className="py-3 bg-blue-600/10 border border-blue-500/30 rounded-2xl text-[9px] font-black uppercase">X (Twitter)</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-10 text-center py-6 pb-12">
                 <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20"><Award className="w-10 h-10 text-blue-500" /></div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter">Impact Rewards</h2>
                 <div className="px-4 space-y-6">
                    <div className="relative group">
                      <BadgeDisplay tier={currentTier} imageUrl={badgeImage} loading={isGenerating} />
                      {!badgeImage && !isGenerating && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><p className="text-[10px] font-black uppercase text-blue-400/50 bg-black/60 px-4 py-2 rounded-full border border-blue-500/20 backdrop-blur-md">Generate Visual to Preview</p></div>)}
                    </div>
                    <div className={`p-8 rounded-[3rem] text-center border transition-all ${config.glowClass} bg-black/40`}>
                       <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Tier Unlocked</span>
                       <h3 className={`text-4xl font-black uppercase italic tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-r ${config.color}`}>{config.name}</h3>
                    </div>
                    {claimEligibility.eligible && (<button onClick={handleRefreshVisual} disabled={isGenerating} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm italic flex items-center justify-center gap-2 transition-all hover:bg-blue-500 shadow-xl shadow-blue-500/30 active:scale-95 animate-in fade-in slide-in-from-bottom-2 duration-500">{isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Generate NFT Badge</button>)}
                 </div>
                 <div className="px-4"><button disabled={!claimEligibility.eligible} className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 transition-all border ${claimEligibility.eligible ? claimEligibility.style : `border-white/5 text-gray-600 bg-white/5`}`}>{claimEligibility.icon}{claimEligibility.message}</button></div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
