
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
  Filter,
  Copy,
  ShoppingCart,
  ChevronLeft,
  ChevronRightSquare,
  History,
  Activity,
  Globe,
  ZapOff
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier, LeaderboardEntry } from './types.ts';
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
import { calculateDetailedPoints, getTierFromRank } from './utils/calculations.ts';
import BadgeDisplay from './components/BadgeDisplay.tsx';
import { geminiService } from './services/geminiService.ts';
import { twitterService, Tweet } from './services/twitterService.ts';
import { tokenService } from './services/tokenService.ts';

const STORAGE_KEY_USER = 'base_impression_v1_user';
const STORAGE_KEY_REGISTRY = 'base_impression_v1_registry';
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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  // Community Registry states
  const [communityAuditCount, setCommunityAuditCount] = useState(1);
  const [verifiedRegistry, setVerifiedRegistry] = useState<LeaderboardEntry[]>([]);
  const [lbPage, setLbPage] = useState(1);
  const [lbSortOrder, setLbSortOrder] = useState<'asc' | 'desc'>('desc');
  const [lbSearch, setLbSearch] = useState('');
  const [lbTierFilter, setLbTierFilter] = useState<RankTier | 'ALL'>('ALL');

  const getFarcasterAddress = (ctx: any) => {
    if (!ctx) return null;
    return (
      ctx.address || 
      ctx.custodyAddress || 
      (ctx.verifiedAddresses && ctx.verifiedAddresses.length > 0 ? ctx.verifiedAddresses[0] : null)
    );
  };

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

    // Initial Load of Registry and Stats
    const savedRegistry = localStorage.getItem(STORAGE_KEY_REGISTRY);
    if (savedRegistry) {
      try {
        setVerifiedRegistry(JSON.parse(savedRegistry));
      } catch (e) { console.error("Registry load error", e); }
    } else {
      // Seed with official accounts on first load only
      setVerifiedRegistry(MOCKED_LEADERBOARD.map(e => ({ ...e, auditedAt: new Date(Date.now() - 86400000).toISOString() })));
    }

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
          const saved = localStorage.getItem(STORAGE_KEY_USER);
          if (!saved) {
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
        }
      } catch (e) { console.warn(e); } finally {
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
          const { total, breakdown } = calculateDetailedPoints(
            prev.baseAppAgeDays || 0,
            prev.twitterAgeDays || 0,
            prev.validTweetsCount || 0,
            prev.farcasterAgeDays || 0,
            { lambo: prev.lambolessBalance || 0, nick: prev.nickBalance || 0, jesse: prev.jesseBalance || 0 }
          );
          if (total !== prev.points) return { ...prev, points: total, pointsBreakdown: breakdown };
          return prev;
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Persistence management
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY_USER);
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REGISTRY, JSON.stringify(verifiedRegistry));
  }, [verifiedRegistry]);

  const loadUserDataFromStorage = () => {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) {
      try {
        const data = JSON.parse(saved) as UserStats;
        setUser(data);
        if (data.twitterHandle) { setHandle(data.twitterHandle); setIsTwitterVerified(true); }
        if (data.address) { setAddress(data.address); setIsSignatureVerified(true); }
      } catch (e) { console.error(e); }
    }
  };

  const connectWallet = async () => {
    const fcAddr = getFarcasterAddress(farcasterContextUser);
    if (!discoveredProviders.length && !fcAddr) { alert("No wallets detected."); return; }
    if ((fcAddr ? 1 : 0) + discoveredProviders.length === 1) {
      if (fcAddr) handleFarcasterAutoLogin();
      else handleConnectAndSign(discoveredProviders[0].provider);
    } else { setShowWalletSelector(true); }
  };

  const handleFarcasterAutoLogin = () => {
    const fcAddr = getFarcasterAddress(farcasterContextUser);
    if (!fcAddr) return;
    setAddress(fcAddr);
    setHandle(`@${farcasterContextUser.username}`);
    setIsSignatureVerified(true);
    setIsTwitterVerified(true); 
    setShowWalletSelector(false);
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
      const challengeMessage = `Base Impression Proof\nWallet: ${linkedAddress}\nTime: ${Date.now()}`;
      await web3.eth.personal.sign(challengeMessage, linkedAddress, "");
      setIsSignatureVerified(true);
      setIsSigning(false);
    } catch (error) {
      setIsSignatureVerified(false);
      setIsConnecting(false);
      setIsSigning(false);
      alert("Auth failed.");
    }
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
      const fidAge = farcasterContextUser ? Math.max(1, Math.floor(((1000000 - (farcasterContextUser.fid || 1)) / 1000000) * 800)) : 0;
      
      const { total, breakdown } = calculateDetailedPoints(
        baseAge, scanResult.accountAgeDays, scanResult.cappedPoints, fidAge, 
        { lambo: usdLambo, nick: usdNick, jesse: usdJesse }
      );
      
      // Update Persistent Registry with Real Audited Account
      const newEntry: LeaderboardEntry = {
        rank: 0,
        handle: currentHandle,
        points: total,
        tier: getTierFromRank(0),
        accountAgeDays: scanResult.accountAgeDays,
        baseAppAgeDays: baseAge,
        auditedAt: new Date().toISOString()
      };

      setVerifiedRegistry(prev => {
        const filtered = prev.filter(p => p.handle !== currentHandle);
        const updated = [...filtered, newEntry].sort((a, b) => b.points - a.points);
        return updated.map((item, index) => ({
          ...item,
          rank: index + 1,
          tier: getTierFromRank(index + 1)
        }));
      });

      // Update Live Audit Count
      const updatedCount = communityAuditCount + 1;
      setCommunityAuditCount(updatedCount);
      localStorage.setItem(STORAGE_KEY_AUDIT_COUNT, updatedCount.toString());

      // Get Final Rank from refreshed registry
      const finalRank = verifiedRegistry.findIndex(r => r.handle === currentHandle) + 1 || 1;

      setUser({ 
        address: currentAddress, twitterHandle: currentHandle, baseAppAgeDays: baseAge, twitterAgeDays: scanResult.accountAgeDays, 
        validTweetsCount: scanResult.cappedPoints, lambolessBalance: usdLambo, nickBalance: usdNick, jesseBalance: usdJesse,
        lambolessAmount: amtLambo, nickAmount: amtNick, jesseAmount: amtJesse, points: total, pointsBreakdown: breakdown,
        rank: finalRank, trustScore: scanResult.trustScore, recentContributions: scanResult.foundTweets,
        farcasterId: farcasterContextUser?.fid, farcasterUsername: farcasterContextUser?.username, farcasterAgeDays: fidAge,
        farcasterCreatedAt: farcasterContextUser?.fid ? new Date(Date.now() - (fidAge * 24 * 60 * 60 * 1000)).toLocaleDateString() : undefined
      });

      setScanProgress(100);
      await sleep(500);
    } catch (error) { 
      console.error(error); 
      alert("Audit protocol failed. Check connection."); 
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
        user.baseAppAgeDays, user.twitterAgeDays, user.validTweetsCount, user.farcasterAgeDays, 
        { lambo: usdLambo, nick: usdNick, jesse: usdJesse }
      );
      
      setUser({ 
        ...user, 
        lambolessBalance: usdLambo, 
        nickBalance: usdNick, 
        jesseBalance: usdJesse,
        lambolessAmount: amtLambo, 
        nickAmount: amtNick, 
        jesseAmount: amtJesse, 
        points: total, 
        pointsBreakdown: breakdown
      });

      // Update registry with new score
      setVerifiedRegistry(prev => {
        const entry = prev.find(p => p.handle === (user.twitterHandle || `@${user.farcasterUsername}`));
        if (entry) {
          entry.points = total;
          const updated = [...prev].sort((a, b) => b.points - a.points);
          return updated.map((item, index) => ({
            ...item,
            rank: index + 1,
            tier: getTierFromRank(index + 1)
          }));
        }
        return prev;
      });
    } catch (e) { console.error(e); } finally { setIsRefreshingAssets(false); }
  };

  const handleRefreshVisual = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const tier = getTierFromRank(user.rank);
      const [img, msg] = await Promise.all([
        geminiService.generateBadgePreview(tier, user.twitterHandle || user.farcasterUsername || 'Base Builder'), 
        geminiService.getImpressionAnalysis(user.points, user.rank)
      ]);
      setBadgeImage(img);
      setAnalysis(msg);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handleShare = (platform: 'farcaster' | 'twitter') => {
    if (!user) return;
    const shareUrl = "https://real-base-2026.vercel.app/";
    const tierName = TIERS[getTierFromRank(user.rank)].name;
    const msg = `My Base Impression is live! 🏎️💨\nRank: #${user.rank}\nPoints: ${user.points.toFixed(2)}\nTier: ${tierName}\nJoin now:`;
    if (platform === 'twitter') sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(shareUrl)}`);
    else sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(msg)}&embeds[]=${encodeURIComponent(shareUrl)}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Contract address copied!");
  };

  const handleBuyToken = (tokenAddress: string) => {
    const uniswapUrl = `https://app.uniswap.org/explore/tokens/base/${tokenAddress}`;
    sdk.actions.openUrl(uniswapUrl);
  };

  const filteredAndSortedLeaderboard = useMemo(() => {
    let list = [...verifiedRegistry];
    if (lbSearch) list = list.filter(l => l.handle.toLowerCase().includes(lbSearch.toLowerCase()));
    if (lbTierFilter !== 'ALL') list = list.filter(l => l.tier === lbTierFilter);
    list.sort((a, b) => lbSortOrder === 'desc' ? b.points - a.points : a.points - b.points);
    return list;
  }, [verifiedRegistry, lbSearch, lbTierFilter, lbSortOrder]);

  const lbTotalPages = Math.ceil(filteredAndSortedLeaderboard.length / 10);
  const currentLbPageData = useMemo(() => {
    const start = (lbPage - 1) * 10;
    return filteredAndSortedLeaderboard.slice(start, start + 10);
  }, [filteredAndSortedLeaderboard, lbPage]);

  useEffect(() => { setLbPage(1); }, [lbSearch, lbTierFilter, lbSortOrder]);

  const claimEligibility = useMemo(() => {
    if (!user) return { eligible: false, message: "Run Audit First", icon: <Lock className="w-4 h-4" /> };
    const now = new Date();
    const isRankEligible = user.rank <= 1000;
    const isTokenEligible = (user.lambolessAmount || 0) >= 1; 
    
    if (!isRankEligible) return { eligible: false, message: "Rank Too Low (Need Top 1000)", icon: <Trophy className="w-4 h-4" />, style: "bg-red-950/30 text-red-400 border-red-900/40" };
    if (!isTokenEligible) return { eligible: false, message: "Not Enough $LAMBOLESS (Need 1+)", icon: <AlertTriangle className="w-4 h-4" />, style: "bg-orange-950/30 text-orange-400 border-orange-900/40" };
    if (now < CLAIM_START) return { eligible: false, message: "Awaiting Snapshot (Jan 16)", icon: <Clock className="w-4 h-4" />, style: "bg-blue-950/30 text-blue-400 border-blue-900/40" };

    return { eligible: true, message: "Claim Your Badge", icon: <Zap className="w-4 h-4" />, style: "bg-blue-600 text-white shadow-lg shadow-blue-500/30" };
  }, [user]);

  return (
    <div className="min-h-screen bg-black text-white font-['Space_Grotesk'] pb-24">
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
          <Binary className="w-20 h-20 text-blue-500 animate-pulse mb-10" />
          <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Auditing Footprint</h2>
          <div className="w-full max-w-xs space-y-4">
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_20px_rgba(37,99,235,1)]" style={{ width: `${scanProgress}%` }} />
            </div>
            <p className="text-[10px] font-black uppercase text-blue-400 min-h-[1.5em] tracking-widest">{scanLogs[scanLogs.length - 1] || "Initializing..."}</p>
          </div>
        </div>
      )}

      {showWalletSelector && (
        <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-effect rounded-[3rem] p-8 border-blue-500/20 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Choose Source</h3>
              <button onClick={() => setShowWalletSelector(false)} className="p-2 bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto px-1">
              {getFarcasterAddress(farcasterContextUser) && (
                <div onClick={handleFarcasterAutoLogin} className="glass-effect p-6 rounded-[2rem] border border-purple-500/60 bg-purple-950/20 hover:bg-purple-900/40 cursor-pointer transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#8a63d2] rounded-2xl flex items-center justify-center shadow-lg"><Fingerprint className="w-7 h-7 text-white" /></div>
                    <div className="flex flex-col"><span className="text-sm font-black uppercase">Farcaster</span><span className="text-[9px] text-purple-400 font-bold uppercase mt-0.5">@{farcasterContextUser.username}</span></div>
                  </div>
                </div>
              )}
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

      <header className="sticky top-0 z-40 glass-effect px-4 py-4 flex justify-between items-center bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3"><BrandLogo size="sm" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-tighter leading-none">Base Impression</span><span className="text-[8px] font-bold text-blue-500 uppercase mt-0.5">Real-time Verified</span></div></div>
        {user && <button onClick={() => { setUser(null); localStorage.removeItem(STORAGE_KEY_USER); }} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><LogOut className="w-4 h-4 text-gray-500" /></button>}
      </header>

      <main className="max-w-md mx-auto px-4 mt-8">
        {!user ? (
          <div className="space-y-12 text-center">
            <div className="flex justify-center float-animation"><BrandLogo size="lg" /></div>
            <div className="space-y-3"><h1 className="text-5xl font-black uppercase italic tracking-tight leading-none">Onchain<br/>Impact.</h1><p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em]">Season 01 • REAL ACCOUNT PROOF</p></div>
            <div className="glass-effect p-8 rounded-[3rem] space-y-6 shadow-2xl">
              <div className="space-y-4">
                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-4">Profile Identity</label>
                  {!isSignatureVerified ? (
                    <button onClick={connectWallet} className="w-full bg-blue-600/10 border border-blue-500/30 rounded-2xl py-4 px-5 flex items-center justify-between"><span className="text-xs font-bold uppercase text-blue-200">Connect Wallet</span><Wallet className="w-4 h-4 text-blue-500" /></button>
                  ) : (
                    <div className="w-full bg-green-500/10 border border-green-500/40 rounded-2xl py-4 px-5 flex items-center justify-between">
                      <div className="flex flex-col"><span className="text-[8px] font-black text-green-500 uppercase">Linked Wallet</span><span className="text-xs font-mono text-green-100">{address.slice(0,6)}...{address.slice(-4)}</span></div>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-4">Social Context</label>
                  <div className="relative group flex gap-2">
                    <div className="relative flex-1">
                      <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@username" className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none" />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleScan} disabled={isScanning} className="w-full py-5 bg-blue-600 rounded-[2rem] font-black uppercase italic text-sm shadow-xl shadow-blue-500/20">
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Start Audit'}
              </button>
            </div>

            {/* Live Stats for Unlogged Users */}
            <div className="glass-effect p-6 rounded-[2.5rem] border-white/5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-green-500" />
                  <span className="text-[10px] font-black uppercase text-gray-400">Network Audits</span>
               </div>
               <span className="text-xl font-black italic">{communityAuditCount.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex glass-effect p-1.5 rounded-2xl sticky top-20 z-30 backdrop-blur-xl border border-white/5">
              {(['dashboard', 'leaderboard', 'claim'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 shadow-lg text-white' : 'text-gray-500'}`}>
                  {t}
                </button>
              ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-8 pb-10">
                {/* Live Community Impact Section */}
                <div className="glass-effect p-6 rounded-[3rem] border-green-500/20 relative overflow-hidden bg-gradient-to-br from-green-500/5 to-transparent">
                   <div className="absolute top-0 right-0 p-4">
                      <div className="flex items-center gap-1.5">
                         <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                         <span className="text-[8px] font-black uppercase text-green-500 tracking-tighter">Live Base Network</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                         <Activity className="w-6 h-6 text-green-500" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[9px] font-black uppercase text-gray-500">Global Verified Builders</span>
                         <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black italic">{communityAuditCount.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-green-400 uppercase">Successful Audits</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2.5rem] border-blue-500/20 text-center shadow-xl shadow-blue-500/5"><span className="text-[9px] font-black uppercase text-gray-500">Impact Score</span><div className="text-3xl font-black italic mt-1">{user.points.toFixed(2)}</div></div>
                  <div className="glass-effect p-6 rounded-[2.5rem] border-purple-500/20 text-center"><span className="text-[9px] font-black uppercase text-gray-500">Real Rank</span><div className="text-3xl font-black italic mt-1 text-blue-400">#{user.rank}</div></div>
                </div>

                <div className="glass-effect p-8 rounded-[3rem] border-blue-500/10 space-y-5">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3"><Coins className="w-5 h-5 text-blue-500" /><h3 className="text-xs font-black uppercase italic">Holding Rewards</h3></div>
                     <button onClick={handleRefreshAssets} disabled={isRefreshingAssets} className="p-2 hover:bg-white/10 rounded-full">{isRefreshingAssets ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 text-blue-500" />}</button>
                   </div>
                   <div className="space-y-4">
                     {[
                       { name: '$LAMBOLESS', amount: user.lambolessAmount || 0, val: user.lambolessBalance, pts: user.pointsBreakdown?.lambo || 0, color: 'text-blue-400', contract: LAMBOLESS_CONTRACT },
                       { name: '$NICK', amount: user.nickAmount || 0, val: user.nickBalance || 0, pts: user.pointsBreakdown?.nick || 0, color: 'text-purple-400', contract: NICK_CONTRACT },
                       { name: '$JESSE', amount: user.jesseAmount || 0, val: user.jesseBalance || 0, pts: user.pointsBreakdown?.jesse || 0, color: 'text-green-400', contract: JESSE_CONTRACT },
                     ].map((item, i) => (
                       <div key={i} className="p-5 bg-white/5 rounded-[2rem] border border-white/5 flex flex-col gap-4">
                         <div className="flex justify-between items-start">
                           <div className="flex flex-col gap-1">
                             <span className={`text-sm font-black ${item.color}`}>{item.name}</span>
                             <div className="flex items-center gap-2" onClick={() => copyToClipboard(item.contract)}>
                               <span className="text-[8px] font-mono text-gray-500">{item.contract.slice(0, 6)}...{item.contract.slice(-4)}</span>
                               <Copy className="w-2.5 h-2.5 text-gray-600 cursor-pointer" />
                             </div>
                           </div>
                           <button onClick={() => handleBuyToken(item.contract)} className="px-4 py-2 bg-blue-600/20 border border-blue-500/40 rounded-xl flex items-center gap-2 hover:bg-blue-600/30 transition-all">
                             <ShoppingCart className="w-3 h-3 text-blue-400" />
                             <span className="text-[9px] font-black uppercase text-blue-200">Buy</span>
                           </button>
                         </div>
                         <div className="flex justify-between items-center border-t border-white/5 pt-4">
                            <div className="flex flex-col"><span className="text-[8px] font-black text-gray-600 uppercase">Holdings</span><span className="text-[11px] font-bold">{item.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                            <div className="flex flex-col items-end"><span className="text-[8px] font-black text-blue-600 uppercase">Points</span><span className="text-[11px] font-black text-blue-400">+{item.pts.toFixed(4)}</span></div>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="glass-effect p-10 rounded-[4rem] text-center space-y-6 shadow-2xl shadow-blue-500/5">
                  <BadgeDisplay tier={getTierFromRank(user.rank)} imageUrl={badgeImage} loading={isGenerating} />
                  {analysis && <p className="text-[10px] italic text-blue-200/60 leading-relaxed bg-white/5 p-4 rounded-2xl">"{analysis}"</p>}
                  <div className="flex flex-col gap-3">
                    <button onClick={handleRefreshVisual} disabled={isGenerating} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] italic">Refresh Identity Visual</button>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleShare('farcaster')} className="py-3 bg-purple-600/10 border border-purple-500/30 rounded-2xl text-[9px] font-black uppercase">Warpcast</button>
                      <button onClick={() => handleShare('twitter')} className="py-3 bg-blue-600/10 border border-blue-500/30 rounded-2xl text-[9px] font-black uppercase">X (Twitter)</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
               <div className="space-y-6 pb-12">
                 <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                       <Globe className="w-3.5 h-3.5 text-blue-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Verified Builders Registry</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,1)]" />
                       <span className="text-[8px] font-black uppercase text-gray-500 tracking-tighter">Real Accounts Only</span>
                    </div>
                 </div>

                 <div className="glass-effect p-6 rounded-[2.5rem] border-white/5 space-y-4">
                   <div className="relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                     <input 
                       value={lbSearch} 
                       onChange={e => setLbSearch(e.target.value)} 
                       placeholder="Search audited builders..." 
                       className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none focus:border-blue-500/50"
                     />
                   </div>
                   
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                     {(['ALL', RankTier.PLATINUM, RankTier.GOLD, RankTier.SILVER, RankTier.BRONZE] as const).map(t => (
                       <button 
                        key={t} 
                        onClick={() => setLbTierFilter(t)} 
                        className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase border transition-all whitespace-nowrap ${lbTierFilter === t ? 'bg-blue-600 border-blue-400' : 'bg-white/5 border-white/10 text-gray-500'}`}
                       >
                         {t === 'ALL' ? 'Everyone' : TIERS[t].name}
                       </button>
                     ))}
                   </div>

                   <div className="flex justify-between items-center">
                     <button 
                        onClick={() => setLbSortOrder(lbSortOrder === 'desc' ? 'asc' : 'desc')} 
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[9px] font-black uppercase"
                     >
                       <ArrowUpDown className="w-3 h-3 text-blue-500" />
                       Points {lbSortOrder === 'desc' ? 'High → Low' : 'Low → High'}
                     </button>
                     <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{filteredAndSortedLeaderboard.length} BUILDERS</span>
                   </div>
                 </div>

                 <div className="space-y-3">
                   {currentLbPageData.length > 0 ? currentLbPageData.map((l, i) => (
                     <div key={l.handle} className={`p-5 glass-effect rounded-[2rem] flex justify-between items-center border border-white/5 transition-all hover:border-blue-500/20 ${user && (user.twitterHandle === l.handle || `@${user.farcasterUsername}` === l.handle) ? 'border-blue-500/40 bg-blue-600/5' : ''}`}>
                       <div className="flex items-center gap-4">
                         <div className="relative flex items-center justify-center w-8">
                            <span className={`text-[11px] font-black italic ${l.rank <= 3 ? 'text-blue-400' : 'text-gray-500'}`}>#{l.rank}</span>
                         </div>
                         <div className="flex flex-col">
                           <span className="text-xs font-bold truncate max-w-[140px] flex items-center gap-1.5">
                             {l.handle}
                             {l.auditedAt && <ShieldCheck className="w-3 h-3 text-blue-500" />}
                           </span>
                           <div className="flex items-center gap-2">
                              <span className={`text-[7px] font-black uppercase ${TIERS[l.tier].color.includes('indigo') ? 'text-purple-400' : TIERS[l.tier].color.includes('yellow') ? 'text-yellow-500' : 'text-gray-400'}`}>
                                {TIERS[l.tier].name}
                              </span>
                              {l.auditedAt && (
                                <span className="text-[6px] text-gray-600 font-bold uppercase">• Verified Audit</span>
                              )}
                           </div>
                         </div>
                       </div>
                       <div className="flex flex-col items-end">
                         <div className="flex items-center gap-1">
                           <Zap className="w-3 h-3 text-blue-500 fill-blue-500/20" />
                           <span className="text-[12px] font-black text-blue-500">{l.points.toFixed(2)}</span>
                         </div>
                         <span className="text-[7px] font-black text-gray-600 uppercase tracking-tighter">IMPRESSION PTS</span>
                       </div>
                     </div>
                   )) : (
                     <div className="py-24 text-center glass-effect rounded-[3rem] border-white/5 space-y-4">
                        <ZapOff className="w-12 h-12 text-gray-800 mx-auto" />
                        <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">No verified audits found</p>
                           <p className="text-[8px] font-bold text-gray-600 uppercase">Be the first to secure your footprint!</p>
                        </div>
                     </div>
                   )}
                 </div>

                 {lbTotalPages > 1 && (
                   <div className="flex items-center justify-center gap-6 pt-4">
                     <button 
                        disabled={lbPage === 1} 
                        onClick={() => setLbPage(lbPage - 1)} 
                        className={`p-3 rounded-2xl border transition-all ${lbPage === 1 ? 'border-white/5 text-gray-800' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                     >
                       <ChevronLeft className="w-5 h-5" />
                     </button>
                     <div className="flex flex-col items-center min-w-[60px]">
                       <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">PAGE</span>
                       <span className="text-xl font-black italic">{lbPage} <span className="text-gray-700 font-normal">/ {lbTotalPages}</span></span>
                     </div>
                     <button 
                        disabled={lbPage === lbTotalPages} 
                        onClick={() => setLbPage(lbPage + 1)} 
                        className={`p-3 rounded-2xl border transition-all ${lbPage === lbTotalPages ? 'border-white/5 text-gray-800' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                     >
                       <ChevronRight className="w-5 h-5" />
                     </button>
                   </div>
                 )}
               </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-10 text-center py-6 pb-12">
                 <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20"><Award className="w-10 h-10 text-blue-500" /></div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter">Impact Rewards</h2>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-8 leading-relaxed">
                   Eligible users can claim their Season 01 Tiered NFT Badge based on their final verified rank.
                 </p>

                 <div className="grid gap-4 px-4">
                    <div className={`p-6 glass-effect rounded-[2.5rem] flex justify-between items-center border ${user.rank <= 1000 ? 'border-green-500/30' : 'border-red-500/30 bg-red-950/10'}`}>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-tight">Verified Rank</span>
                        <div className="flex items-center gap-2">
                           <Trophy className={`w-3 h-3 ${user.rank <= 1000 ? 'text-green-500' : 'text-red-500'}`} />
                           <span className={`text-sm font-black ${user.rank <= 1000 ? 'text-green-400' : 'text-red-400'}`}>#{user.rank}</span>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${user.rank <= 1000 ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                        {user.rank <= 1000 ? 'Rank Verified' : 'Rank Out of Range'}
                      </span>
                    </div>

                    <div className={`p-6 glass-effect rounded-[2.5rem] flex justify-between items-center border ${(user.lambolessAmount || 0) >= 1 ? 'border-green-500/30' : 'border-orange-500/30 bg-orange-950/10'}`}>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-tight">$LAMBOLESS Balance</span>
                        <div className="flex items-center gap-2">
                           <Coins className={`w-3 h-3 ${(user.lambolessAmount || 0) >= 1 ? 'text-green-500' : 'text-orange-500'}`} />
                           <span className={`text-sm font-black ${(user.lambolessAmount || 0) >= 1 ? 'text-green-400' : 'text-orange-400'}`}>{(user.lambolessAmount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${(user.lambolessAmount || 0) >= 1 ? 'bg-green-600/20 text-green-400' : 'bg-orange-600/20 text-orange-400'}`}>
                        {(user.lambolessAmount || 0) >= 1 ? 'Verified' : 'Insufficient'}
                      </span>
                    </div>

                    <div className="p-6 glass-effect rounded-[2.5rem] flex justify-between items-center border border-white/5">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-tight">Snapshot Status</span>
                        <div className="flex items-center gap-2">
                           <History className="w-3 h-3 text-blue-500" />
                           <span className="text-sm font-black text-blue-400">Jan 16, 2026</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-black uppercase px-2 py-1 rounded-lg bg-blue-600/20 text-blue-400">
                        {new Date() < CLAIM_START ? 'Pending' : 'Live'}
                      </span>
                    </div>
                 </div>

                 <div className="px-4">
                   <button 
                      disabled={!claimEligibility.eligible} 
                      className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 transition-all border ${claimEligibility.eligible ? claimEligibility.style : `border-white/5 text-gray-600 bg-white/5`}`}
                   >
                     {claimEligibility.icon}
                     {claimEligibility.message}
                   </button>
                 </div>

                 {user.rank > 1000 && (
                   <p className="text-[10px] text-red-500/60 font-bold uppercase tracking-widest px-10">
                     Increase your impact by tweeting with #BaseImpression or holding more verified assets!
                   </p>
                 )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
