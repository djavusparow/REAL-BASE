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
  LogOut,
  Trophy,
  Award,
  Lock,
  RefreshCw,
  Cpu,
  Flame,
  Ban,
  Sparkles,
  Send,
  UserCheck,
  Search,
  AlertCircle,
  TrendingUp,
  Coins,
  ExternalLink,
  Copy,
  Layers,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  History,
  Calendar,
  UserPlus,
  Hash,
  Image as ImageIcon,
  AlertTriangle,
  Gift,
  MessageSquare
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier } from './types.ts';
import { 
  TIERS, 
  LAMBOLESS_CONTRACT,
  NICK_CONTRACT,
  JESSE_CONTRACT,
  HOURLY_WINDOW_START,
  HOURLY_WINDOW_END
} from './constants.ts';
import { calculateDetailedPoints, getTierFromPoints, calculateFidPoints } from './utils/calculations.ts';
import BadgeDisplay from './components/BadgeDisplay.tsx';
import { geminiService } from './services/geminiService.ts';
import { twitterService } from './services/twitterService.ts';
import { tokenService } from './services/tokenService.ts';

const STORAGE_KEY_USER = 'base_impression_v1_user';
const STORAGE_KEY_AUDIT_COUNT = 'base_impression_v1_count';
const STORAGE_KEY_SUPPLIES = 'base_impression_v1_supplies';

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
  const [farcasterContext, setFarcasterContext] = useState<any>(null);
  
  const [address, setAddress] = useState('');
  const [handle, setHandle] = useState('');
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [showCastPrompt, setShowCastPrompt] = useState(false);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);
  const [isTwitterVerified, setIsTwitterVerified] = useState(false);
  const [isSyncingFID, setIsSyncingFID] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [showScanDetails, setShowScanDetails] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  // Real-time supply state
  const [tierSupplies, setTierSupplies] = useState<Record<RankTier, number>>({
    [RankTier.PLATINUM]: TIERS[RankTier.PLATINUM].supply,
    [RankTier.GOLD]: TIERS[RankTier.GOLD].supply,
    [RankTier.SILVER]: TIERS[RankTier.SILVER].supply,
    [RankTier.BRONZE]: TIERS[RankTier.BRONZE].supply,
    [RankTier.NONE]: 0
  });

  const [communityAuditCount, setCommunityAuditCount] = useState(1);

  const getFarcasterAddress = useCallback((ctx: any) => {
    if (!ctx) return null;
    if (ctx.address) return ctx.address;
    if (ctx.user?.address) return ctx.user.address;
    if (ctx.user?.custodyAddress) return ctx.user.custodyAddress;
    if (ctx.user?.verifiedAddresses && ctx.user.verifiedAddresses.length > 0) {
      return ctx.user.verifiedAddresses[0];
    }
    return null;
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
        return data;
      } catch (e) { 
        console.error("Failed to parse user data from storage", e); 
      }
    }
    return null;
  }, []);

  // Initialize and persist supplies
  useEffect(() => {
    const savedSupplies = localStorage.getItem(STORAGE_KEY_SUPPLIES);
    if (savedSupplies) {
      try {
        setTierSupplies(JSON.parse(savedSupplies));
      } catch (e) {
        console.error("Failed to load supplies", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SUPPLIES, JSON.stringify(tierSupplies));
  }, [tierSupplies]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
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

    const savedCount = localStorage.getItem(STORAGE_KEY_AUDIT_COUNT);
    if (savedCount) {
      setCommunityAuditCount(parseInt(savedCount));
    }

    const init = async () => {
      const watchdog = setTimeout(() => {
        setIsReady(true);
      }, 4000);

      try {
        await sdk.actions.ready().catch(e => console.warn("SDK actions ready failed", e));
        const context = await sdk.context.catch(e => {
            console.warn("SDK context fetch failed", e);
            return null;
        });

        if (context) {
          setFarcasterContext(context);
        }

        const storedUser = loadUserDataFromStorage();
        if (context && storedUser) {
           const fcAddr = getFarcasterAddress(context);
           if (fcAddr && fcAddr.toLowerCase() === storedUser.address.toLowerCase()) {
             setAddress(fcAddr);
             setIsSignatureVerified(true);
           }
        }
      } catch (e) { 
        console.error("Initialization error:", e); 
      } finally {
        clearTimeout(watchdog);
        setIsReady(true);
      }
    };

    init();
  }, [getFarcasterAddress, loadUserDataFromStorage]);

  const handleFarcasterAutoLogin = async () => {
    if (isConnecting || isSigning) return;
    setIsConnecting(true);
    try {
      const context = await sdk.context;
      let fcAddr = getFarcasterAddress(context);
      const provider = sdk.wallet?.ethProvider;
      if (!fcAddr && provider) {
        const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
        if (accounts && accounts.length > 0) fcAddr = accounts[0];
      }
      if (!fcAddr) {
        alert("Farcaster identity not found.");
        setIsConnecting(false);
        return;
      }
      if (provider) {
        setIsSigning(true);
        const web3 = new Web3(provider);
        const challengeMessage = `Base Impression Proof\nWallet: ${fcAddr}\nTime: ${Date.now()}\nVerify identity.`;
        await web3.eth.personal.sign(challengeMessage, fcAddr, "");
        setIsSigning(false);
      }
      setAddress(fcAddr);
      setIsSignatureVerified(true);
      if (context?.user?.username && !handle) {
        setHandle(`@${context.user.username}`);
        setIsTwitterVerified(true);
      }
      setShowWalletSelector(false);
    } catch (e: any) {
      console.error("Login Error:", e);
    } finally {
      setIsConnecting(false);
      setIsSigning(false);
    }
  };

  const syncFarcasterProfile = async () => {
    if (!user) return;
    setIsSyncingFID(true);
    try {
      const context = await sdk.context;
      if (context?.user?.fid) {
        const { total, breakdown } = calculateDetailedPoints(
          user.baseAppAgeDays,
          user.twitterAgeDays,
          user.validTweetsCount,
          context.user.fid,
          { lambo: user.lambolessBalance || 0, jesse: user.jesseBalance || 0, nick: user.nickBalance || 0 },
          user.basepostingPoints
        );
        setUser({ ...user, farcasterId: context.user.fid, farcasterUsername: context.user.username, points: total, pointsBreakdown: breakdown });
      }
    } catch (e) { console.error(e); } finally { setIsSyncingFID(false); }
  };

  const startAudit = async () => {
    if (!handle) return;
    setIsScanning(true);
    setScanProgress(10);
    try {
      const results = await twitterService.scanPosts(handle);
      setScanProgress(80);
      const stats: UserStats = {
        address,
        twitterHandle: handle,
        baseAppAgeDays: 1,
        twitterAgeDays: results.accountAgeDays,
        validTweetsCount: results.totalValidPosts,
        basepostingPoints: results.basepostingPoints,
        lambolessBalance: 0,
        points: 0,
        rank: 0,
        trustScore: results.trustScore,
        recentContributions: results.foundTweets,
        twitterDailyBreakdown: results.dailyBreakdown
      } as any;
      const { total, breakdown } = calculateDetailedPoints(stats.baseAppAgeDays, stats.twitterAgeDays, stats.validTweetsCount, 0, { lambo: 0, jesse: 0, nick: 0 }, stats.basepostingPoints);
      stats.points = total;
      stats.pointsBreakdown = breakdown;
      setUser(stats);
      setScanProgress(100);
      setCommunityAuditCount(prev => prev + 1);
    } catch (error) { console.error(error); } finally { setTimeout(() => setIsScanning(false), 1000); }
  };

  const refreshAssets = async () => {
    if (!user || !address) return;
    setIsRefreshingAssets(true);
    try {
      const [lamboBal, nickBal, jesseBal] = await Promise.all([
        tokenService.getBalance(address, LAMBOLESS_CONTRACT),
        tokenService.getBalance(address, NICK_CONTRACT),
        tokenService.getBalance(address, JESSE_CONTRACT)
      ]);
      const [lP, nP, jP] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT),
        tokenService.getTokenPrice(NICK_CONTRACT),
        tokenService.getTokenPrice(JESSE_CONTRACT)
      ]);
      const tokenUSDValues = { lambo: lamboBal * lP, nick: nickBal * nP, jesse: jesseBal * jP };
      const { total, breakdown } = calculateDetailedPoints(user.baseAppAgeDays, user.twitterAgeDays, user.validTweetsCount, user.farcasterId || 0, tokenUSDValues, user.basepostingPoints);
      setUser({ ...user, lambolessBalance: tokenUSDValues.lambo, nickBalance: tokenUSDValues.nick, jesseBalance: tokenUSDValues.jesse, lambolessAmount: lamboBal, nickAmount: nickBal, jesseAmount: jesseBal, points: total, pointsBreakdown: breakdown });
    } catch (e) { console.error(e); } finally { setIsRefreshingAssets(false); }
  };

  const handleLogout = () => {
    setUser(null);
    setAddress('');
    setHandle('');
    setIsSignatureVerified(false);
    setIsTwitterVerified(false);
    setBadgeImage(null);
    setIsMinted(false);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const claimEligibility = useMemo(() => {
    if (!user) return { eligible: false, reasons: [], buttonText: 'Login Required' };
    
    const tier = getTierFromPoints(user.points);
    const reasons: string[] = [];
    const minPoints = TIERS[RankTier.BRONZE].minPoints;
    const minLambo = 2.5;
    
    const pointsShort = Math.max(0, minPoints - user.points);
    const lamboShort = Math.max(0, minLambo - (user.lambolessBalance || 0));

    if (tier === RankTier.NONE) {
      reasons.push(`Need ${pointsShort.toFixed(0)} more Base Points`);
    }
    if ((user.lambolessBalance || 0) < minLambo) {
      reasons.push(`Hold $${lamboShort.toFixed(2)} more in $LAMBOLESS`);
    }

    const currentSupply = tierSupplies[tier];
    const hasSupply = currentSupply > 0;
    if (!hasSupply && tier !== RankTier.NONE) {
      reasons.push(`${TIERS[tier].name} Supply Exhausted`);
    }

    const eligible = tier !== RankTier.NONE && (user.lambolessBalance || 0) >= minLambo && hasSupply;
    
    let buttonText = 'Claim Locked';
    if (eligible) {
      buttonText = `GENERATE & CLAIM ${TIERS[tier].name} BADGE`;
    } else if (reasons.length > 0) {
      buttonText = reasons[0]; 
    }

    return { 
      eligible, 
      tierName: TIERS[tier].name, 
      reasons, 
      buttonText,
      pointsShort,
      lamboShort,
      currentTier: tier
    };
  }, [user, tierSupplies]);

  const handleFullClaimProcess = async () => {
    if (!claimEligibility.eligible || isGenerating || isMinting || isMinted) return;
    
    // Step 1: Generate Visual
    setIsGenerating(true);
    try {
      const currentTier = getTierFromPoints(user!.points);
      const img = await geminiService.generateBadgePreview(currentTier, user!.twitterHandle);
      if (!img) {
        alert("Failed to generate visual. Please try again.");
        setIsGenerating(false);
        return;
      }
      setBadgeImage(img);
      setIsGenerating(false);

      // Step 2: Immediate Minting Logic
      setIsMinting(true);
      // Simulated Gas Approval
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulated On-chain Minting
      await new Promise(resolve => setTimeout(resolve, 3000)); 
      
      // Update Supply Count Real-time
      setTierSupplies(prev => ({
        ...prev,
        [claimEligibility.currentTier]: Math.max(0, prev[claimEligibility.currentTier] - 1)
      }));
      
      setIsMinted(true);
      
      // Mandatory Cast Prompt Trigger
      setTimeout(() => {
        setShowCastPrompt(true);
      }, 1000);

    } catch (e) {
      console.error("Full claim process error", e);
      alert("Transaction failed. Please ensure you have enough gas.");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  const handleCastAchievement = async () => {
    try {
      const castText = 'Check, Track and CLAIM your BASE IMPRESSION with zero fee';
      await sdk.actions.cast({ text: castText });
      setShowCastPrompt(false);
    } catch (e) {
      console.error("Cast action failed", e);
      setShowCastPrompt(false);
    }
  };

  if (!isReady) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <h2 className="text-blue-500 font-black uppercase italic tracking-widest text-sm">Base Impression</h2>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
        <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <h1 className="text-lg font-black tracking-tighter uppercase italic">Base Impression</h1>
            </div>
            <div className="flex items-center gap-4">
               {address ? (
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-xs font-mono text-gray-300">{address.slice(0, 6)}...</span>
                    <button onClick={handleLogout} className="p-1 hover:text-red-400"><LogOut size={14} /></button>
                  </div>
               ) : (
                  <button onClick={() => setShowWalletSelector(true)} className="bg-blue-600 hover:bg-blue-500 text-xs font-black uppercase px-6 py-2 rounded-full transition-all">Login</button>
               )}
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!user ? (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-12">
               <h2 className="text-5xl font-black tracking-tight leading-tight">ARE YOU <span className="text-blue-500">BUILDING</span> ON BASE?</h2>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className={`p-6 rounded-2xl border ${isSignatureVerified ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                    <span className="font-bold uppercase text-xs mb-4 block">Step 1: Wallet</span>
                    {isSignatureVerified ? <div className="text-green-400 text-sm font-bold flex items-center gap-2"><CheckCircle2 size={16} /> Verified</div> : <button onClick={() => setShowWalletSelector(true)} className="w-full py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-black uppercase">Sign Proof</button>}
                  </div>
                  <div className={`p-6 rounded-2xl border ${isTwitterVerified ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                    <span className="font-bold uppercase text-xs mb-4 block">Step 2: Socials</span>
                    {isTwitterVerified ? <div className="text-green-400 text-sm font-bold flex items-center gap-2"><CheckCircle2 size={16} /> Linked</div> : <button onClick={() => twitterService.login()} className="w-full py-2 bg-white/10 rounded-xl text-sm font-bold">Link Twitter</button>}
                  </div>
               </div>
               {isSignatureVerified && isTwitterVerified && (
                  <button onClick={startAudit} disabled={isScanning} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-lg font-black uppercase flex items-center justify-center gap-3">
                    {isScanning ? <Loader2 className="animate-spin" /> : <Zap />} Start Audit
                  </button>
               )}
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="flex glass-effect p-1.5 rounded-2xl sticky top-20 z-30 backdrop-blur-xl border border-white/5 mb-8">
                  {(['dashboard', 'claim'] as const).map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>{t}</button>))}
               </div>
               {activeTab === 'dashboard' ? (
                 <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-effect p-8 rounded-[3rem] border-blue-500/20 text-center relative flex flex-col items-center justify-center overflow-hidden">
                          <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">MY BASE IMPRESSION</span>
                          <div className="text-6xl font-black italic mt-2 text-blue-500 drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]">{user.points.toFixed(2)}</div>
                          <div className="mt-6 w-48 mx-auto h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600" style={{ width: `${Math.min((user.points / 1000) * 100, 100)}%` }} />
                          </div>
                          <button onClick={() => setShowScanDetails(!showScanDetails)} className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            {showScanDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showScanDetails ? 'Hide Scan Details' : 'View Scan Details'}
                          </button>
                      </div>
                      <div className="glass-effect p-8 rounded-[3rem] border-white/10 text-center flex flex-col items-center justify-center gap-6">
                         <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">IDENTITY SCANNERS</span>
                         <div className="grid grid-cols-1 w-full gap-3 text-left">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <Twitter className="text-blue-400" size={18} />
                                  <div><p className="text-[10px] font-black uppercase text-gray-500">Twitter Identity</p><p className="text-xs font-bold">{user.twitterHandle}</p></div>
                               </div>
                               <p className="text-[10px] font-black text-blue-400">+{user.pointsBreakdown?.social_twitter.toFixed(2)} PTS</p>
                            </div>
                            <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <Hash className="text-blue-500" size={18} />
                                  <div><p className="text-[10px] font-black uppercase text-gray-500">#Baseposting</p><p className="text-xs font-bold text-gray-300">Verified Mentions</p></div>
                               </div>
                               <div className="text-right">
                                  <p className="text-[10px] font-black text-blue-500">+{user.basepostingPoints} PTS</p>
                                  <p className="text-[8px] font-bold text-gray-600 uppercase">Capped at 5/Day</p>
                               </div>
                            </div>
                            <button onClick={syncFarcasterProfile} disabled={isSyncingFID} className={`w-full py-3 border rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase italic transition-all ${user.farcasterId ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-blue-600/20 border-blue-500/30 text-blue-400'}`}>
                               {isSyncingFID ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                               {user.farcasterId ? `FID: ${user.farcasterId}` : 'Sync Farcaster ID'}
                            </button>
                         </div>
                      </div>
                    </div>

                    <div className="glass-effect p-8 rounded-[3rem] border-white/10 space-y-6">
                       <div className="flex items-center justify-between">
                          <h4 className="font-black text-lg uppercase tracking-tighter italic">Contribution Breakdown</h4>
                          <button onClick={refreshAssets} disabled={isRefreshingAssets} className="p-2 hover:bg-white/5 rounded-full"><RefreshCw className={`w-4 h-4 ${isRefreshingAssets ? 'animate-spin' : ''}`} /></button>
                       </div>
                       <div className="space-y-6">
                          {[
                            { label: 'BASEPOSTING', pts: user.basepostingPoints || 0, color: 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]', fullLabel: 'Capped 5/Day' },
                            { label: 'SOCIAL IMPACT', pts: user.pointsBreakdown?.social_twitter || 0, color: 'bg-blue-400' },
                            { label: 'FARCASTER SYNERGY', pts: user.pointsBreakdown?.social_fc || 0, color: 'bg-purple-500' },
                            { label: '$LAMBOLESS YIELD', pts: user.pointsBreakdown?.lambo || 0, color: 'bg-yellow-500' },
                            { label: 'ONCHAIN SENIORITY', pts: user.pointsBreakdown?.seniority || 0, color: 'bg-indigo-500' }
                          ].map((item, i) => (
                            <div key={i} className="space-y-3">
                              <div className="flex justify-between items-center text-[11px] font-black uppercase italic tracking-widest">
                                <div className="flex items-center gap-2">
                                   <span className="text-gray-400">{item.label}</span>
                                   {item.fullLabel && <span className="text-[8px] text-gray-600 not-italic font-bold">{item.fullLabel}</span>}
                                </div>
                                <span className="text-blue-400">+{item.pts.toFixed(2)} PTS</span>
                              </div>
                              <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${Math.min((item.pts / Math.max(user.points, 1)) * 100, 100)}%` }} />
                              </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-10 py-6 pb-12 max-w-4xl mx-auto">
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center gap-3">
                         <Award className="w-12 h-12 text-blue-500" />
                         <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-2">
                            <Gift size={12} /> FREE CLAIM
                         </span>
                      </div>
                      <h2 className="text-4xl font-black uppercase italic tracking-tighter">Impact Rewards</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
                       <div className="space-y-8">
                         <BadgeDisplay tier={getTierFromPoints(user.points)} imageUrl={badgeImage} loading={isGenerating} />
                         <div className="p-8 rounded-[3rem] text-center border bg-black/40 border-white/10">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Current Rank</span>
                            <h3 className={`text-4xl font-black uppercase italic tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-r ${TIERS[getTierFromPoints(user.points)].color}`}>
                              {TIERS[getTierFromPoints(user.points)].name}
                            </h3>
                         </div>
                       </div>
                       <div className="glass-effect p-8 rounded-[2.5rem] border-white/10 space-y-8">
                          <div className="flex items-center justify-between">
                             <h4 className="font-black text-lg uppercase italic">Claim Checklist</h4>
                             <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/5 px-3 py-1 rounded-full border border-blue-500/10">
                                Gas Fee Only
                             </span>
                          </div>
                          <div className="space-y-10">
                             {/* Live Supply Tracking */}
                             {getTierFromPoints(user.points) !== RankTier.NONE && (
                               <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase italic tracking-widest">Live Supply: {TIERS[getTierFromPoints(user.points)].name}</span>
                                    <span className="text-[10px] font-mono text-blue-400">{tierSupplies[getTierFromPoints(user.points)]} / {TIERS[getTierFromPoints(user.points)].supply}</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full bg-gradient-to-r ${TIERS[getTierFromPoints(user.points)].color} rounded-full transition-all duration-700`} style={{ width: `${(tierSupplies[getTierFromPoints(user.points)] / TIERS[getTierFromPoints(user.points)].supply) * 100}%` }} />
                                  </div>
                               </div>
                             )}

                             {/* Requirement 1: Base Points */}
                             <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase tracking-widest">Base Points</span>
                                    {claimEligibility.pointsShort > 0 && (
                                      <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter flex items-center gap-1">
                                        <AlertTriangle size={10} /> {claimEligibility.pointsShort.toFixed(0)} more needed
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-gray-400">{user.points.toFixed(0)} / {TIERS[RankTier.BRONZE].minPoints}</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                  <div className={`h-full ${user.points >= TIERS[RankTier.BRONZE].minPoints ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500/50'}`} style={{ width: `${Math.min((user.points / TIERS[RankTier.BRONZE].minPoints) * 100, 100)}%` }} />
                                </div>
                             </div>

                             {/* Requirement 2: Lamboless Holdings */}
                             <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase tracking-widest">$LAMBOLESS Value</span>
                                    {claimEligibility.lamboShort > 0 && (
                                      <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter flex items-center gap-1">
                                        <AlertTriangle size={10} /> ${claimEligibility.lamboShort.toFixed(2)} more needed
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-gray-400">${(user.lambolessBalance || 0).toFixed(2)} / $2.50</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                  <div className={`h-full ${(user.lambolessBalance || 0) >= 2.5 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500/50'}`} style={{ width: `${Math.min(((user.lambolessBalance || 0) / 2.5) * 100, 100)}%` }} />
                                </div>
                             </div>

                             <div className="pt-4 space-y-4 text-center">
                               <div className="space-y-2">
                                  {isMinted ? (
                                    <div className="w-full py-6 rounded-[2.5rem] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-black uppercase italic text-sm flex items-center justify-center gap-3">
                                      <CheckCircle2 className="w-5 h-5" /> Badge Secured
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={handleFullClaimProcess}
                                      disabled={!claimEligibility.eligible || isGenerating || isMinting} 
                                      className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm flex flex-col items-center justify-center transition-all border shadow-2xl ${claimEligibility.eligible && !isGenerating && !isMinting ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30 active:scale-95' : 'bg-white/5 text-gray-600 opacity-50'}`}
                                    >
                                      <div className="flex items-center gap-3">
                                         {isGenerating || isMinting ? (
                                           <Loader2 className="w-4 h-4 animate-spin" />
                                         ) : claimEligibility.eligible ? (
                                           <Zap className="w-4 h-4" />
                                         ) : (
                                           <Lock className="w-4 h-4" />
                                         )}
                                         {isGenerating ? 'GENERATING VISUAL...' : isMinting ? 'MINTING NFT...' : claimEligibility.buttonText}
                                      </div>
                                      {claimEligibility.eligible && !isGenerating && !isMinting && (
                                         <span className="text-[8px] opacity-80 mt-1 tracking-widest">ONE-CLICK CLAIM</span>
                                      )}
                                    </button>
                                  )}
                                  <p className="text-[9px] font-bold text-gray-500 uppercase italic tracking-wider flex items-center justify-center gap-1.5">
                                     <Info size={10} /> FREE CLAIM — GAS FEE ONLY
                                  </p>
                               </div>
                               
                               {!claimEligibility.eligible && claimEligibility.reasons.length > 0 && (
                                 <p className="text-[9px] text-center font-bold text-gray-500 uppercase italic px-4 mt-2">
                                   * Complete the requirements above to unlock your free claim.
                                 </p>
                               )}
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          )}
        </main>

        {showWalletSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 space-y-8">
                <div className="flex items-center justify-between"><h3 className="text-2xl font-black uppercase tracking-tighter italic">Connect</h3><button onClick={() => setShowWalletSelector(false)} className="p-2 text-gray-500"><X size={20} /></button></div>
                <button onClick={handleFarcasterAutoLogin} className="w-full p-6 rounded-[1.5rem] bg-gradient-to-br from-purple-600/20 to-indigo-800/20 border border-purple-500/40 flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500 flex items-center justify-center text-white font-black text-2xl">F</div>
                  <p className="font-black text-lg uppercase italic">Farcaster Identity</p>
                </button>
             </div>
          </div>
        )}

        {showCastPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-blue-900/40 backdrop-blur-xl">
             <div className="w-full max-w-md glass-effect border-blue-400/30 rounded-[3rem] p-10 text-center space-y-8 animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                   <Share2 className="text-white w-10 h-10" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">Share Success</h3>
                  <p className="text-sm text-gray-300 font-medium">To finalize your claim and notify the ecosystem, broadcast your impression to Farcaster.</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl italic text-xs text-blue-400 font-bold">
                  "Check, Track and CLAIM your BASE IMPRESSION with zero fee"
                </div>
                <button 
                  onClick={handleCastAchievement}
                  className="w-full py-6 bg-white text-black rounded-[2rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform"
                >
                  <MessageSquare className="w-5 h-5" /> Cast Achievement
                </button>
                <button 
                  onClick={() => setShowCastPrompt(false)}
                  className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                >
                  I'll do it later
                </button>
             </div>
          </div>
        )}
        
        {isScanning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-lg">
             <div className="w-full max-w-lg space-y-8 text-center">
                <div className="relative w-40 h-40 mx-auto border-4 border-blue-500/10 rounded-full flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                  <span className="text-3xl font-black italic">{scanProgress}%</span>
                </div>
                <h3 className="text-4xl font-black uppercase tracking-tighter italic">Auditing Impression</h3>
             </div>
          </div>
        )}
    </div>
  );
};

export default App;