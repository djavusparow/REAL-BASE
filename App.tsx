
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
  ShoppingCart
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
import { calculateDetailedPoints, getTierFromRank } from './utils/calculations.ts';
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
  const [isSyncingFarcaster, setIsSyncingFarcaster] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

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
          const { total, breakdown } = calculateDetailedPoints(
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
          if (total !== prev.points) return { ...prev, points: total, pointsBreakdown: breakdown };
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
      } catch (e) { console.error("Failed to load user data:", e); }
    }
  };

  const connectWallet = async () => {
    const fcAddr = getFarcasterAddress(farcasterContextUser);
    const hasDetectedWallets = discoveredProviders.length > 0;
    if (!hasDetectedWallets && !fcAddr) {
      alert("No wallets detected.");
      return;
    }
    const totalOptions = (fcAddr ? 1 : 0) + discoveredProviders.length;
    if (totalOptions === 1) {
      if (fcAddr) handleFarcasterAutoLogin();
      else handleConnectAndSign(discoveredProviders[0].provider);
    } else {
      setShowWalletSelector(true);
    }
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

  const handleSyncFarcaster = async () => {
    if (!user) return;
    setIsSyncingFarcaster(true);
    try {
      const context = await sdk.context;
      if (context?.user) {
        const fid = context.user.fid;
        const username = context.user.username;
        const ageDays = Math.max(1, Math.floor(((1000000 - fid) / 1000000) * 1200));
        const createdAt = new Date(Date.now() - (ageDays * 24 * 60 * 60 * 1000)).toLocaleDateString();

        setUser(prev => {
          if (!prev) return null;
          const { total, breakdown } = calculateDetailedPoints(
            prev.baseAppAgeDays || 0,
            prev.twitterAgeDays || 0,
            prev.validTweetsCount || 0,
            ageDays,
            { lambo: prev.lambolessBalance || 0, nick: prev.nickBalance || 0, jesse: prev.jesseBalance || 0 }
          );
          return {
            ...prev,
            farcasterId: fid,
            farcasterUsername: username,
            farcasterAgeDays: ageDays,
            farcasterCreatedAt: createdAt,
            points: total,
            pointsBreakdown: breakdown
          };
        });
      }
    } catch (e) { console.error(e); } finally { setIsSyncingFarcaster(false); }
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
      log("Analyzing footprint...");
      setScanProgress(10);
      await sleep(400);

      log("Checking token balances on Base...");
      const [amtLambo, amtNick, amtJesse] = await Promise.all([
        tokenService.getBalance(currentAddress, LAMBOLESS_CONTRACT),
        tokenService.getBalance(currentAddress, NICK_CONTRACT),
        tokenService.getBalance(currentAddress, JESSE_CONTRACT)
      ]);
      setScanProgress(50);
      
      log("Syncing market values...");
      const [pLambo, pNick, pJesse] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT),
        tokenService.getTokenPrice(NICK_CONTRACT),
        tokenService.getTokenPrice(JESSE_CONTRACT)
      ]);
      
      const usdLambo = amtLambo * pLambo;
      const usdNick = amtNick * pNick;
      const usdJesse = amtJesse * pJesse;
      setScanProgress(75);

      log("Gathering social impact data...");
      const scanResult = await twitterService.scanPosts(currentHandle);
      
      const baseAge = 150 + Math.floor(Math.random() * 50);
      const fidAge = farcasterContextUser ? Math.max(1, Math.floor(((1000000 - (farcasterContextUser.fid || 1)) / 1000000) * 800)) : 0;
      
      const { total, breakdown } = calculateDetailedPoints(
        baseAge, 
        scanResult.accountAgeDays, 
        scanResult.cappedPoints, 
        fidAge, 
        { lambo: usdLambo, nick: usdNick, jesse: usdJesse }
      );
      
      const rank = total > 1000 ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 950) + 25;
      
      setUser({ 
        address: currentAddress, 
        twitterHandle: currentHandle, 
        baseAppAgeDays: baseAge, 
        twitterAgeDays: scanResult.accountAgeDays, 
        validTweetsCount: scanResult.cappedPoints, 
        lambolessBalance: usdLambo, 
        nickBalance: usdNick, 
        jesseBalance: usdJesse,
        lambolessAmount: amtLambo,
        nickAmount: amtNick,
        jesseAmount: amtJesse,
        points: total, 
        pointsBreakdown: breakdown,
        rank, 
        trustScore: scanResult.trustScore, 
        recentContributions: scanResult.foundTweets,
        farcasterId: farcasterContextUser?.fid,
        farcasterUsername: farcasterContextUser?.username,
        farcasterAgeDays: fidAge,
        farcasterCreatedAt: farcasterContextUser?.fid ? new Date(Date.now() - (fidAge * 24 * 60 * 60 * 1000)).toLocaleDateString() : undefined
      });

      setScanProgress(100);
      await sleep(500);
    } catch (error) { console.error(error); alert("Scan failed."); } finally { setIsScanning(false); }
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
      const { total, breakdown } = calculateDetailedPoints(
        user.baseAppAgeDays, 
        user.twitterAgeDays, 
        user.validTweetsCount, 
        user.farcasterAgeDays, 
        { lambo: amtLambo * pLambo, nick: amtNick * pNick, jesse: amtJesse * pJesse }
      );
      setUser({ 
        ...user, 
        lambolessBalance: amtLambo * pLambo, 
        nickBalance: amtNick * pNick, 
        jesseBalance: amtJesse * pJesse,
        lambolessAmount: amtLambo,
        nickAmount: amtNick,
        jesseAmount: amtJesse,
        points: total,
        pointsBreakdown: breakdown
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
    // Direct user to Uniswap on Base for the specified token
    const uniswapUrl = `https://app.uniswap.org/explore/tokens/base/${tokenAddress}`;
    sdk.actions.openUrl(uniswapUrl);
  };

  const filteredLeaderboard = useMemo(() => {
    let list = [...MOCKED_LEADERBOARD];
    if (user && user.points > 0) {
      const hStr = user.twitterHandle || `@${user.farcasterUsername}`;
      const idx = list.findIndex(l => l.handle === hStr);
      if (idx !== -1) list[idx] = { ...list[idx], points: user.points, rank: user.rank };
      else list.push({ rank: user.rank, handle: hStr, points: user.points, tier: getTierFromRank(user.rank), accountAgeDays: user.twitterAgeDays, baseAppAgeDays: user.baseAppAgeDays });
    }
    return list.sort((a, b) => b.points - a.points);
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
        <div className="flex items-center gap-3"><BrandLogo size="sm" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-tighter leading-none">Base Impression</span><span className="text-[8px] font-bold text-blue-500 uppercase mt-0.5">Live Profile</span></div></div>
        {user && <button onClick={() => { setUser(null); localStorage.removeItem(STORAGE_KEY_USER); }} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><LogOut className="w-4 h-4 text-gray-500" /></button>}
      </header>

      <main className="max-w-md mx-auto px-4 mt-8">
        {!user ? (
          <div className="space-y-12 text-center">
            <div className="flex justify-center float-animation"><BrandLogo size="lg" /></div>
            <div className="space-y-3"><h1 className="text-5xl font-black uppercase italic tracking-tight leading-none">Onchain<br/>Impact.</h1><p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em]">Season 01 • Activity Proof</p></div>
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
                      <input value={handle} onChange={e => setHandle(e.target.value)} disabled={isTwitterVerified} placeholder="@username" className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none" />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleScan} disabled={isScanning} className="w-full py-5 bg-blue-600 rounded-[2rem] font-black uppercase italic text-sm shadow-xl shadow-blue-500/20">
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Run Impression Audit'}
              </button>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2.5rem] border-blue-500/20 text-center"><span className="text-[9px] font-black uppercase text-gray-500">Impact Score</span><div className="text-3xl font-black italic mt-1">{user.points.toFixed(2)}</div></div>
                  <div className="glass-effect p-6 rounded-[2.5rem] border-purple-500/20 text-center"><span className="text-[9px] font-black uppercase text-gray-500">Social Points</span><div className="text-3xl font-black italic mt-1 text-blue-400">{user.pointsBreakdown?.social.toFixed(2)}</div></div>
                </div>

                {/* Holding Rewards Section with Contract Addresses and Buy Button */}
                <div className="glass-effect p-8 rounded-[3rem] border-blue-500/10 space-y-5">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3"><Coins className="w-5 h-5 text-blue-500" /><h3 className="text-xs font-black uppercase italic">Holding Rewards (Since Jan 5)</h3></div>
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

                <div className="glass-effect p-10 rounded-[4rem] text-center space-y-6">
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
               <div className="space-y-4">
                 {filteredLeaderboard.slice(0, 50).map((l, i) => (
                   <div key={i} className="p-6 glass-effect rounded-[2.5rem] flex justify-between items-center border border-white/5">
                     <div className="flex items-center gap-4">
                       <span className="text-xs font-black italic text-gray-500">#{i + 1}</span>
                       <div className="flex flex-col"><span className="text-xs font-bold">{l.handle}</span><span className="text-[7px] font-black uppercase text-blue-400">{TIERS[l.tier].name}</span></div>
                     </div>
                     <span className="text-xs font-black text-blue-500">{l.points.toFixed(2)} pts</span>
                   </div>
                 ))}
               </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-10 text-center py-6">
                 <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20"><Award className="w-10 h-10 text-blue-500" /></div>
                 <h2 className="text-3xl font-black uppercase italic">Impact Portal</h2>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-8">Portal opens Jan 16th. Points are accumulating hourly.</p>
                 <div className="space-y-4 px-4">
                   <div className={`p-6 glass-effect rounded-[2rem] flex justify-between items-center ${user.rank <= 1000 ? 'border-green-500/30' : 'border-red-500/20'}`}>
                      <div className="text-left"><p className="text-[10px] font-black uppercase">Impact Rank</p><p className="text-[8px] text-gray-500 font-bold uppercase">Min #1000</p></div>
                      <span className={`text-xs font-black ${user.rank <= 1000 ? 'text-green-400' : 'text-red-400'}`}>#{user.rank}</span>
                   </div>
                 </div>
                 <button disabled={true} className="w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm bg-gray-800 text-gray-500"><Lock className="w-5 h-5 inline mr-2" /> Awaiting Snapshot</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
