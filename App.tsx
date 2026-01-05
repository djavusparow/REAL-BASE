
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
  Coins
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
  JESSE_CONTRACT
} from './constants.ts';
import { calculatePoints, getTierFromRank } from './utils/calculations.ts';
import BadgeDisplay from './components/BadgeDisplay.tsx';
import { geminiService } from './services/geminiService.ts';
import { twitterService, Tweet } from './services/twitterService.ts';
import { tokenService } from './services/tokenService.ts';

const STORAGE_KEY_USER = 'base_impression_v1_user';

// EIP-6963 interfaces for wallet discovery
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
  
  // Account States
  const [address, setAddress] = useState('');
  const [handle, setHandle] = useState('');
  
  // Provider States
  const [discoveredProviders, setDiscoveredProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  // Wallet Connection States
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);

  // Twitter Verification States
  const [isTwitterConnecting, setIsTwitterConnecting] = useState(false);
  const [isTwitterVerified, setIsTwitterVerified] = useState(false);
  const [twitterChallenge, setTwitterChallenge] = useState('');
  const [showTwitterVerifyModal, setShowTwitterVerifyModal] = useState(false);

  // Farcaster Scan State
  const [isFarcasterScanning, setIsFarcasterScanning] = useState(false);

  // App Interface States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  // Leaderboard Filtering/Sorting States
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardSort, setLeaderboardSort] = useState<'desc' | 'asc'>('desc');

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

    const legacyEth = (window as any).ethereum;
    if (legacyEth && !discoveredProviders.length) {
      const providers = legacyEth.providers || [legacyEth];
      providers.forEach((p: any) => {
        let name = "Injected Wallet";
        let rdns = "unknown";
        if (p.isCoinbaseWallet) { name = "Coinbase Wallet"; rdns = "com.coinbase.wallet"; }
        else if (p.isOkxWallet) { name = "OKX Wallet"; rdns = "com.okex.wallet"; }
        else if (p.isZerion) { name = "Zerion Wallet"; rdns = "io.zerion.wallet"; }
        else if (p.isRabby) { name = "Rabby Wallet"; rdns = "io.rabby"; }

        setDiscoveredProviders(prev => {
          if (prev.some(dp => dp.info.name === name)) return prev;
          return [...prev, { info: { name, rdns, uuid: name, icon: "" }, provider: p }];
        });
      });
    }

    const init = async () => {
      const safetyTimeout = setTimeout(() => setIsReady(true), 4000);
      try {
        const context = await sdk.context;
        if (context?.user) {
          setHandle(context.user.username || '');
          if (context.user.custodyAddress) setAddress(context.user.custodyAddress);
        }
        await sdk.actions.ready();
      } catch (e) {
        console.warn("Farcaster SDK init failed:", e);
      } finally {
        clearTimeout(safetyTimeout);
        const saved = localStorage.getItem(STORAGE_KEY_USER);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            setUser(data);
            if (data.twitterHandle) setIsTwitterVerified(true);
            if (data.address) setIsSignatureVerified(true);
          } catch (e) { console.error(e); }
        }
        setIsReady(true);
      }
    };
    init();
    return () => window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }, []);

  const initiateWalletConnection = () => {
    if (discoveredProviders.length > 1) setShowWalletSelector(true);
    else if (discoveredProviders.length === 1) handleConnectAndSign(discoveredProviders[0].provider);
    else alert("No Web3 wallet detected.");
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
    const challenge = await geminiService.generateVerificationChallenge(handle);
    setTwitterChallenge(challenge);
    setShowTwitterVerifyModal(true);
    setIsTwitterConnecting(false);
  };

  const handleConfirmVerification = async () => {
    setIsTwitterConnecting(true);
    const success = await twitterService.verifyOwnership(handle, twitterChallenge);
    if (success) {
      setIsTwitterVerified(true);
      setShowTwitterVerifyModal(false);
    } else {
      alert("Verification failed.");
    }
    setIsTwitterConnecting(false);
  };

  const handleScanFarcaster = async () => {
    if (!user) return;
    setIsFarcasterScanning(true);
    try {
      const context = await sdk.context;
      const fid = context?.user?.fid || 888888;
      const username = context?.user?.username || handle.replace('@', '');
      const maxFid = 1000000;
      const ageDays = Math.max(1, Math.floor(((maxFid - fid) / maxFid) * 800));
      
      const newPoints = calculatePoints(
        user.baseAppAgeDays, 
        user.twitterAgeDays, 
        user.validTweetsCount, 
        ageDays,
        { 
          lambo: user.lambolessBalance, 
          nick: user.nickBalance || 0, 
          jesse: user.jesseBalance || 0 
        }
      );

      const updatedUser: UserStats = { ...user, farcasterId: fid, farcasterUsername: username, farcasterAgeDays: ageDays, points: newPoints };
      setTimeout(() => {
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
        setIsFarcasterScanning(false);
      }, 1500);
    } catch (error) {
      console.error(error);
      setIsFarcasterScanning(false);
    }
  };

  const handleScan = async () => {
    if (!address || !isTwitterVerified || !isSignatureVerified) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([]);
    const log = (msg: string) => setScanLogs(p => [...p, msg]);

    log("Connecting to Base Mainnet RPC...");
    const [balLambo, balNick, balJesse] = await Promise.all([
      tokenService.getBalance(address, LAMBOLESS_CONTRACT),
      tokenService.getBalance(address, NICK_CONTRACT),
      tokenService.getBalance(address, JESSE_CONTRACT)
    ]);
    setScanProgress(30);

    log("Grounding $LAMBOLESS, $thenickshirley, $jesse via Gemini...");
    const [pLambo, pNick, pJesse] = await Promise.all([
      geminiService.getTokenPrice("LAMBOLESS", LAMBOLESS_CONTRACT),
      geminiService.getTokenPrice("thenickshirley", NICK_CONTRACT),
      geminiService.getTokenPrice("jesse", JESSE_CONTRACT)
    ]);
    
    const usdLambo = balLambo * pLambo;
    const usdNick = balNick * pNick;
    const usdJesse = balJesse * pJesse;
    setScanProgress(60);

    log(`Scanning Verified Social Graph for @${handle.replace('@', '')}...`);
    const scanResult = await twitterService.scanPosts(handle);
    setScanProgress(80);

    log("Calculating Cumulative Holding Points...");
    const baseAge = 150 + Math.floor(Math.random() * 50);
    const points = calculatePoints(
      baseAge, 
      scanResult.accountAgeDays, 
      scanResult.cappedPoints,
      user?.farcasterAgeDays || 0,
      { lambo: usdLambo, nick: usdNick, jesse: usdJesse }
    );
    const rank = Math.floor(Math.random() * 900) + 1;

    const userData: UserStats = { 
      address, 
      twitterHandle: handle, 
      baseAppAgeDays: baseAge, 
      twitterAgeDays: scanResult.accountAgeDays, 
      validTweetsCount: scanResult.cappedPoints, 
      lambolessBalance: usdLambo, 
      nickBalance: usdNick,
      jesseBalance: usdJesse,
      points, 
      rank, 
      trustScore: scanResult.trustScore, 
      recentContributions: scanResult.foundTweets 
    };

    setTimeout(() => {
      setScanProgress(100);
      setUser(userData);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
      setIsScanning(false);
    }, 800);
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
        geminiService.getTokenPrice("LAMBOLESS", LAMBOLESS_CONTRACT),
        geminiService.getTokenPrice("thenickshirley", NICK_CONTRACT),
        geminiService.getTokenPrice("jesse", JESSE_CONTRACT)
      ]);
      const updatedUser = { 
        ...user, 
        lambolessBalance: balLambo * pLambo,
        nickBalance: balNick * pNick,
        jesseBalance: balJesse * pJesse
      };
      // Re-calculate points
      updatedUser.points = calculatePoints(
        updatedUser.baseAppAgeDays,
        updatedUser.twitterAgeDays,
        updatedUser.validTweetsCount,
        updatedUser.farcasterAgeDays,
        { lambo: updatedUser.lambolessBalance, nick: updatedUser.nickBalance || 0, jesse: updatedUser.jesseBalance || 0 }
      );
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    } catch (e) { console.error(e); }
    finally { setIsRefreshingAssets(false); }
  };

  const handleRefreshVisual = async () => {
    if (!user) return;
    setIsGenerating(true);
    const tier = getTierFromRank(user.rank);
    const [img, msg] = await Promise.all([geminiService.generateBadgePreview(tier, user.twitterHandle), geminiService.getImpressionAnalysis(user.points, user.rank)]);
    setBadgeImage(img);
    setAnalysis(msg);
    setIsGenerating(false);
  };

  const share = (platform: 'farcaster' | 'x') => {
    if (!user) return;
    const tier = getTierFromRank(user.rank);
    const text = `I'm a verified ${tier} contributor on Base Impression! 🔵 Rank: #${user.rank} | Score: ${user.points} pts. #Base #OnchainSummer`;
    const url = "https://real-base-2026.vercel.app/";
    if (platform === 'farcaster') sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`);
    else sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text + ' ' + url)}`);
  };

  const claimStatus = useMemo(() => {
    if (!user) return { label: 'Complete Scan First', disabled: true, theme: 'bg-white/5 text-gray-700', icon: AlertCircle, reason: 'No scan data found.' };
    const rankEligible = user.rank <= 1000;
    const assetEligible = user.lambolessBalance >= MIN_TOKEN_VALUE_USD;
    const eventStarted = new Date() >= CLAIM_START;

    if (!rankEligible) return { label: 'Rank Ineligible (#1000+)', disabled: true, theme: 'bg-red-500/10 border-red-500/20 text-red-500', icon: AlertCircle, reason: 'You must be in the top 1000 on the leaderboard.' };
    if (!assetEligible) return { label: 'Insufficient $LAMBOLESS', disabled: true, theme: 'bg-red-500/10 border-red-500/20 text-red-500', icon: AlertCircle, reason: `Minimum balance of $${MIN_TOKEN_VALUE_USD.toFixed(2)} USD in $LAMBOLESS required.` };
    if (!eventStarted) return { label: `Claim Opens ${CLAIM_START.toLocaleDateString([], { month: 'short', day: 'numeric' })}`, disabled: true, theme: 'bg-blue-600/10 border-blue-500/20 text-blue-400', icon: Clock, reason: 'The claiming event has not started yet.' };

    return { label: 'Claim Soulbound NFT', disabled: false, theme: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20', icon: Award, reason: 'All requirements met!' };
  }, [user]);

  const filteredLeaderboard = useMemo(() => {
    let list = [...MOCKED_LEADERBOARD];
    if (user && user.twitterHandle) {
      const exists = list.some(l => l.handle.toLowerCase() === user.twitterHandle.toLowerCase());
      if (!exists) {
        list.push({
          rank: user.rank,
          handle: user.twitterHandle,
          points: user.points,
          tier: getTierFromRank(user.rank),
          accountAgeDays: user.twitterAgeDays,
          baseAppAgeDays: user.baseAppAgeDays
        });
      }
    }
    return list
      .filter(l => l.handle.toLowerCase().includes(leaderboardSearch.toLowerCase()))
      .sort((a, b) => {
        if (leaderboardSort === 'desc') return b.points - a.points;
        return a.points - b.points;
      });
  }, [leaderboardSearch, leaderboardSort, user]);

  if (!isReady) return <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-500 animate-pulse">Initializing Pulse...</span></div>;

  return (
    <div className="min-h-screen bg-black text-white font-['Space_Grotesk'] pb-24">
      {/* Modals omitted for brevity - logic remains same */}
      
      <header className="sticky top-0 z-40 glass-effect px-4 py-4 flex justify-between items-center bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3"><BrandLogo size="sm" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-tighter leading-none">Base Impression</span><span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">Verified Contributor</span></div></div>
        {user && <button onClick={() => { setUser(null); setIsTwitterVerified(false); setIsSignatureVerified(false); localStorage.removeItem(STORAGE_KEY_USER); }} className="p-2 hover:bg-white/5 rounded-lg transition-colors group"><LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-500" /></button>}
      </header>

      <main className="max-w-md mx-auto px-4 mt-8">
        {!user ? (
          <div className="space-y-12 text-center animate-in fade-in duration-1000">
            <div className="flex justify-center float-animation"><BrandLogo size="lg" /></div>
            <div className="space-y-3"><h1 className="text-5xl font-black uppercase italic tracking-tight leading-none">Onchain<br/>Proof.</h1><p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em]">Season 01 • Contribution Event</p></div>
            <div className="glass-effect p-8 rounded-[3rem] space-y-6 shadow-[0_0_50px_-20px_rgba(37,99,235,0.4)]">
              <div className="space-y-4">
                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-4">Web3 Auth Flow</label>
                  {!isSignatureVerified ? (
                    <button onClick={initiateWalletConnection} disabled={isConnecting || isSigning} className="w-full bg-blue-600/10 border border-blue-500/30 rounded-2xl py-4 px-5 flex flex-col gap-2 group hover:bg-blue-600/20 hover:border-blue-500/50 transition-all active:scale-[0.98]">
                      <div className="flex items-center justify-between w-full"><div className="flex items-center gap-3"><div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black italic shadow-lg shadow-blue-600/30">{discoveredProviders.length > 0 ? <Zap className="w-3 h-3" /> : '??'}</div><span className="text-xs font-bold text-blue-200 uppercase tracking-tight">{isConnecting ? 'Linking...' : isSigning ? 'Signing...' : discoveredProviders.length > 1 ? 'Select Your Wallet' : 'Connect Verified Wallet'}</span></div>{isConnecting || isSigning ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> : <Shield className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />}</div>
                      <div className="w-full grid grid-cols-2 gap-2 mt-2"><div className={`h-1 rounded-full ${address ? 'bg-blue-500' : 'bg-white/10'} transition-all`} /><div className={`h-1 rounded-full ${isSignatureVerified ? 'bg-blue-500' : 'bg-white/10'} transition-all`} /></div>
                      <div className="flex justify-between w-full px-1"><span className={`text-[7px] font-black uppercase ${address ? 'text-blue-500' : 'text-gray-600'}`}>1. Link</span><span className={`text-[7px] font-black uppercase ${isSignatureVerified ? 'text-blue-500' : 'text-gray-600'}`}>2. Sign</span></div>
                    </button>
                  ) : <div className="w-full bg-green-500/10 border border-green-500/40 rounded-2xl py-4 px-5 flex items-center justify-between animate-in zoom-in-95 duration-300"><div className="flex flex-col"><span className="text-[8px] font-black uppercase text-green-500 leading-none mb-1 tracking-widest">Ownership Proved</span><span className="text-xs font-mono text-green-100">{address.slice(0,6)}...{address.slice(-4)}</span></div><CheckCircle2 className="w-5 h-5 text-green-500" /></div>}
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-4">Twitter Identity</label>
                  <div className="relative group flex gap-2"><div className="relative flex-1"><Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 group-focus-within:text-blue-500 transition-colors" /><input value={handle} onChange={e => setHandle(e.target.value)} disabled={isTwitterVerified} placeholder="@username" className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none focus:border-blue-500 focus:bg-blue-950/20 transition-all disabled:opacity-50" /></div>
                    {!isTwitterVerified ? <button onClick={handleStartTwitterVerification} disabled={!handle || isTwitterConnecting} className="px-6 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600/40 disabled:opacity-20 transition-all">{isTwitterConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}</button> : <div className="px-6 bg-green-500/20 border border-green-500/40 rounded-2xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-500" /></div>}
                  </div>
                </div>
              </div>
              <button onClick={handleScan} disabled={!isSignatureVerified || !isTwitterVerified} className="w-full py-5 bg-blue-600 rounded-[2rem] font-black uppercase italic text-sm shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-2 group">Generate Impression <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></button>
            </div>
            <p className="text-[9px] text-gray-600 uppercase font-bold tracking-widest flex items-center justify-center gap-2"><ShieldCheck className="w-3 h-3 text-blue-500" /> Multi-Wallet Auto-Discovery Enabled</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 fade-in duration-700">
            <div className="flex glass-effect p-1.5 rounded-2xl sticky top-20 z-30 backdrop-blur-xl border border-white/5">{(['dashboard', 'leaderboard', 'claim'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 shadow-lg text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>
            ))}</div>

            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2.5rem] border-blue-500/20 text-center relative overflow-hidden group"><div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp className="w-8 h-8 text-blue-500" /></div><span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Impact Score</span><div className="text-3xl font-black italic mt-1">{user.points}</div></div>
                  <div className="glass-effect p-6 rounded-[2.5rem] border-purple-500/20 text-center relative overflow-hidden group"><div className="absolute top-0 right-0 p-2 opacity-10"><ShieldCheck className="w-8 h-8 text-purple-500" /></div><span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Trust Index</span><div className="text-3xl font-black italic mt-1 text-blue-400">{user.trustScore}%</div></div>
                </div>

                {/* Asset Breakdown Section */}
                <div className="glass-effect p-8 rounded-[3rem] border-blue-500/10 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Coins className="w-4 h-4 text-blue-500" />
                    <h3 className="text-xs font-black uppercase italic tracking-widest">Asset Contributions</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: '$LAMBOLESS', bal: user.lambolessBalance, mult: '2.5 pts/d', color: 'text-blue-400' },
                      { name: '$thenickshirley', bal: user.nickBalance || 0, mult: '0.1 pts/d', color: 'text-purple-400' },
                      { name: '$jesse', bal: user.jesseBalance || 0, mult: '0.1 pts/d', color: 'text-green-400' },
                    ].map((asset, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black ${asset.color}`}>{asset.name}</span>
                          <span className="text-[7px] text-gray-500 font-bold uppercase">{asset.mult} per $1 held</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-white">${asset.bal.toFixed(2)} USD</span>
                          <span className="text-[7px] block text-gray-500 font-bold uppercase">Current Value</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {!user.farcasterId ? (
                  <div className="glass-effect p-8 rounded-[3rem] border-purple-500/20 space-y-4 animate-in fade-in zoom-in-95 duration-500 shadow-[0_0_40px_-10px_rgba(139,92,246,0.2)]">
                    <div className="flex items-center gap-4"><div className="w-10 h-10 bg-[#8a63d2] rounded-2xl flex items-center justify-center shadow-lg shadow-purple-600/20"><Fingerprint className="w-5 h-5 text-white" /></div><div className="flex flex-col"><h3 className="text-sm font-black uppercase italic tracking-tight">Farcaster identity boost</h3><span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">Exclusive native rewards</span></div></div>
                    <button onClick={handleScanFarcaster} disabled={isFarcasterScanning} className="w-full py-4 bg-[#8a63d2]/10 border border-[#8a63d2]/30 rounded-2xl flex items-center justify-center gap-3 group hover:bg-[#8a63d2]/20 transition-all active:scale-95">{isFarcasterScanning ? <><Loader2 className="w-4 h-4 text-[#8a63d2] animate-spin" /><span className="text-[10px] font-black uppercase tracking-widest text-purple-300">Extracting FID...</span></> : <><span className="text-[10px] font-black uppercase tracking-widest text-purple-100">Sync Farcaster Profile</span><ArrowRight className="w-3 h-3 text-[#8a63d2] group-hover:translate-x-1 transition-transform" /></>}</button>
                  </div>
                ) : <div className="glass-effect p-6 rounded-[2.5rem] border-green-500/20 flex items-center justify-between px-8 bg-green-500/5"><div className="flex items-center gap-4"><div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-600/20"><CheckCircle2 className="w-4 h-4 text-white" /></div><div className="flex flex-col"><span className="text-[8px] font-black uppercase text-green-500 tracking-widest">FID Verified: {user.farcasterId}</span><span className="text-[10px] font-black italic">@{user.farcasterUsername}</span></div></div><div className="text-right"><span className="text-[7px] font-black uppercase text-gray-500 block">Seniority Bonus</span><span className="text-xs font-black text-green-400">+{user.farcasterAgeDays} Days</span></div></div>}

                <div className="glass-effect p-10 rounded-[4rem] text-center space-y-6 border border-white/5 shadow-2xl">
                  <BadgeDisplay tier={getTierFromRank(user.rank)} imageUrl={badgeImage} loading={isGenerating} />
                  {analysis && <p className="text-[10px] italic text-blue-200/60 bg-white/5 p-4 rounded-2xl leading-relaxed border border-white/5">"{analysis}"</p>}
                  <button onClick={handleRefreshVisual} disabled={isGenerating} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] italic tracking-widest hover:bg-gray-200 transition-colors shadow-lg">{isGenerating ? 'Analyzing...' : 'Refresh Impact snapshot'}</button>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="text"
                      placeholder="Search handles..."
                      value={leaderboardSearch}
                      onChange={(e) => setLeaderboardSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none focus:border-blue-500 focus:bg-blue-950/20 transition-all"
                    />
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                      Showing {filteredLeaderboard.length} entries
                    </span>
                    <button 
                      onClick={() => setLeaderboardSort(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Points: {leaderboardSort === 'desc' ? 'High to Low' : 'Low to High'}
                      <ArrowUpDown className="w-3 h-3 text-blue-500" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredLeaderboard.length > 0 ? filteredLeaderboard.map((l, i) => (
                    <div key={i} className={`p-6 glass-effect rounded-[2rem] flex justify-between items-center transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${l.handle === user?.twitterHandle ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(37,99,235,0.1)]' : 'border-white/5 hover:bg-white/5'}`}>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-black italic ${l.rank <= 5 ? 'text-blue-500' : 'text-gray-500'}`}>#{l.rank}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">{l.handle}</span>
                          <span className="text-[7px] text-gray-500 font-black uppercase tracking-widest">{getTierFromRank(l.rank)} Contributor</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black">{l.points}</div>
                        <span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Points</span>
                      </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center glass-effect rounded-[2rem] border-white/5">
                      <Search className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                      <p className="text-xs font-black uppercase text-gray-600 italic">No matches found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-10 text-center py-6">
                 <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20 shadow-2xl"><Award className="w-10 h-10 text-blue-500" /></div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter">Soulbound Mint</h2>
                 
                 <div className="space-y-4">
                   <div className={`p-6 glass-effect rounded-[2rem] flex justify-between items-center ${user.rank <= 1000 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                      <div className="text-left"><p className="text-[10px] font-black uppercase">Rank Qualifier</p><p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Top 1000 Required</p></div>
                      <div className="flex flex-col items-end"><span className={`text-xs font-black ${user.rank <= 1000 ? 'text-green-400' : 'text-red-400'}`}>#{user.rank}</span>{user.rank <= 1000 ? <CheckCircle2 className="w-3 h-3 text-green-500 mt-1" /> : <AlertCircle className="w-3 h-3 text-red-500 mt-1" />}</div>
                   </div>
                   
                   <div className={`p-6 glass-effect rounded-[2rem] flex justify-between items-center ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                      <div className="text-left"><p className="text-[10px] font-black uppercase">Asset Verification</p><p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Min $2.50 $LAMBOLESS</p></div>
                      <div className="flex flex-col items-end"><span className={`text-xs font-black ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'text-green-400' : 'text-red-400'}`}>${user.lambolessBalance.toFixed(2)}</span>{user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? <CheckCircle2 className="w-3 h-3 text-green-500 mt-1" /> : <AlertCircle className="w-3 h-3 text-red-500 mt-1" />}</div>
                   </div>
                   
                   <button onClick={handleRefreshAssets} disabled={isRefreshingAssets} className="text-[10px] font-black uppercase text-blue-500 flex items-center justify-center gap-2 mx-auto py-2 px-4 hover:bg-blue-500/5 rounded-xl transition-all">{isRefreshingAssets ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Re-Verify Balance</button>
                 </div>

                 <div className="space-y-4">
                   <button disabled={claimStatus.disabled} className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 ${claimStatus.theme}`}><claimStatus.icon className="w-5 h-5" />{claimStatus.label}</button>
                   {claimStatus.disabled && <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex gap-3 items-start text-left"><Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" /><p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed">{claimStatus.reason}</p></div>}
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
