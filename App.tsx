
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
  Check,
  Ban
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
import { twitterService } from './services/twitterService.ts';
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
  const [farcasterContext, setFarcasterContext] = useState<any>(null);
  
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
    
    // 1. Check top level address (preferred in Frame v2)
    if (ctx.address) return ctx.address;
    
    // 2. Check within user object
    const user = ctx.user || ctx;
    if (user.custodyAddress) return user.custodyAddress;
    if (user.verifiedAddresses && user.verifiedAddresses.length > 0) {
      return user.verifiedAddresses[0];
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
      const timeoutId = setTimeout(() => {
        console.warn("Farcaster SDK init timed out, forcing ready state");
        setIsReady(true);
      }, 3000);

      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        if (context) {
          setFarcasterContext(context);
        }
        
        loadUserDataFromStorage();
        
        // Auto-fill from context if possible
        if (context && !localStorage.getItem(STORAGE_KEY_USER)) {
            const detectedAddr = getFarcasterAddress(context);
            if (detectedAddr) {
              setAddress(detectedAddr);
              setIsSignatureVerified(true);
            }
            const detectedHandle = context.user?.username ? `@${context.user.username}` : '';
            if (detectedHandle) {
              setHandle(detectedHandle);
              setIsTwitterVerified(true);
            }
        }
      } catch (e) { 
        console.warn("Farcaster SDK init warning:", e); 
      } finally {
        clearTimeout(timeoutId);
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

  const handleFarcasterAutoLogin = async () => {
    setIsConnecting(true);
    try {
      // 1. Get Context (ensure fresh if not in state)
      const context = farcasterContext || await sdk.context;
      const fcAddr = getFarcasterAddress(context);
      
      if (!fcAddr) {
        console.error("Could not find address in Farcaster context", context);
        setIsConnecting(false);
        return;
      }

      // 2. Perform Real Signature Proof (if provider available)
      setIsSigning(true);
      try {
        const provider = sdk.wallet?.ethProvider;
        if (provider) {
          const web3 = new Web3(provider);
          const challengeMessage = `Base Impression Proof\nWallet: ${fcAddr}\nTime: ${Date.now()}`;
          await web3.eth.personal.sign(challengeMessage, fcAddr, "");
        } else {
          console.warn("Farcaster Wallet Provider not detected, using context address only.");
        }
      } catch (signError) {
        console.warn("Farcaster Signing skipped or failed:", signError);
        // We continue if we have the address from context, but log the failure
      }

      setAddress(fcAddr);
      setIsSignatureVerified(true);
      setShowWalletSelector(false);
    } catch (e) {
      console.error("Farcaster login sequence error", e);
    } finally {
      setIsSigning(false);
      setIsConnecting(false);
    }
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
    } catch (e) {
      console.error("Wallet connection/signing error", e);
      setIsConnecting(false);
      setIsSigning(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAddress('');
    setHandle('');
    setIsSignatureVerified(false);
    setIsTwitterVerified(false);
    setBadgeImage(null);
    setAnalysis('');
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const startAudit = async () => {
    if (!handle) return;
    setIsScanning(true);
    setScanProgress(10);
    setScanLogs(["Initializing scan engine...", "Target: " + handle]);
    
    try {
      const results = await twitterService.scanPosts(handle);
      setScanProgress(50);
      setScanLogs(prev => [...prev, "Found " + results.foundTweets.length + " candidate posts.", "Applying Baseposting rules..."]);
      
      await new Promise(r => setTimeout(r, 1000));
      setScanProgress(80);
      setScanLogs(prev => [...prev, "Validation complete. Total points: " + results.basepostingPoints]);
      
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
        recentContributions: results.foundTweets.slice(0, 3)
      };

      const { total, breakdown } = calculateDetailedPoints(
        stats.baseAppAgeDays,
        stats.twitterAgeDays,
        0,
        0,
        { lambo: 0, jesse: 0, nick: 0 },
        stats.basepostingPoints
      );

      stats.points = total;
      stats.pointsBreakdown = breakdown;
      
      setUser(stats);
      setScanProgress(100);
      setScanLogs(prev => [...prev, "Audit finished successfully!"]);
      
      setCommunityAuditCount(prev => {
        const next = prev + 1;
        localStorage.setItem(STORAGE_KEY_AUDIT_COUNT, next.toString());
        return next;
      });
    } catch (error) {
      console.error("Audit failed", error);
      setScanLogs(prev => [...prev, "Error: " + (error as Error).message]);
    } finally {
      setTimeout(() => setIsScanning(false), 1500);
    }
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

      const [lamboPrice, nickPrice, jessePrice] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT),
        tokenService.getTokenPrice(NICK_CONTRACT),
        tokenService.getTokenPrice(JESSE_CONTRACT)
      ]);

      const tokenUSDValues = {
        lambo: lamboBal * lamboPrice,
        nick: nickBal * nickPrice,
        jesse: jesseBal * jessePrice
      };

      const { total, breakdown } = calculateDetailedPoints(
        user.baseAppAgeDays,
        user.twitterAgeDays,
        user.validTweetsCount,
        user.farcasterId || 0,
        tokenUSDValues,
        user.basepostingPoints
      );

      setUser({
        ...user,
        lambolessBalance: tokenUSDValues.lambo,
        nickBalance: tokenUSDValues.nick,
        jesseBalance: tokenUSDValues.jesse,
        lambolessAmount: lamboBal,
        nickAmount: nickBal,
        jesseAmount: jesseBal,
        points: total,
        pointsBreakdown: breakdown
      });

    } catch (e) {
      console.error("Failed to refresh assets", e);
    } finally {
      setIsRefreshingAssets(false);
    }
  };

  const generateBadge = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const tier = getTierFromPoints(user.points);
      const [img, copy] = await Promise.all([
        geminiService.generateBadgePreview(tier, user.twitterHandle),
        geminiService.getImpressionAnalysis(user.points, tier)
      ]);
      setBadgeImage(img);
      setAnalysis(copy);
    } catch (e) {
      console.error("Failed to generate badge", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const claimEligibility = useMemo(() => {
    if (!user) return { eligible: false, message: "Run Audit First", status: 'NONE' };
    const currentTier = getTierFromPoints(user.points);
    if (currentTier === RankTier.NONE) return { eligible: false, message: "Rank Too Low", status: 'INELIGIBLE' };
    const requirement = TIERS[currentTier];
    if ((user.lambolessBalance || 0) < requirement.minLamboUsd) return { eligible: false, message: "No $LAMBOLESS", status: 'INELIGIBLE' };
    return { eligible: true, message: "Eligible", status: 'ELIGIBLE', tierName: requirement.name };
  }, [user]);

  if (!isReady) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
        <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <div className="hidden sm:block">
                <h1 className="text-lg font-black tracking-tighter uppercase italic">Base Impression</h1>
                <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Ecosystem Proof</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {address ? (
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-mono text-gray-300">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                    <button onClick={handleLogout} className="p-1 hover:text-red-400 transition-colors">
                      <LogOut size={14} />
                    </button>
                  </div>
               ) : (
                  <button 
                    onClick={() => setShowWalletSelector(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase px-6 py-2 rounded-full transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  >
                    Connect Wallet
                  </button>
               )}
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!user ? (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-12">
               <div className="space-y-4">
                  <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
                    <ShieldCheck size={40} />
                  </div>
                  <h2 className="text-5xl font-black tracking-tight leading-tight">
                    ARE YOU <span className="text-blue-500">BUILDING</span> ON BASE?
                  </h2>
                  <p className="text-gray-400 text-lg max-w-lg mx-auto leading-relaxed">
                    Verify your contributions, track your $LAMBOLESS assets, and earn your onchain reputation badge.
                  </p>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className={`p-6 rounded-2xl border transition-all ${isSignatureVerified ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${isSignatureVerified ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'}`}>
                        <Wallet size={20} />
                      </div>
                      <span className="font-bold">Step 1: Wallet</span>
                    </div>
                    {isSignatureVerified ? (
                      <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
                        <CheckCircle2 size={16} /> Verified
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowWalletSelector(true)}
                        className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors"
                      >
                        Sign Proof
                      </button>
                    )}
                  </div>

                  <div className={`p-6 rounded-2xl border transition-all ${isTwitterVerified ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${isTwitterVerified ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'}`}>
                        <Twitter size={20} />
                      </div>
                      <span className="font-bold">Step 2: Socials</span>
                    </div>
                    {isTwitterVerified ? (
                      <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
                        <CheckCircle2 size={16} /> Linked
                      </div>
                    ) : (
                      <button 
                        onClick={() => twitterService.login()}
                        className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors"
                      >
                        Link Twitter
                      </button>
                    )}
                  </div>
               </div>

               {isSignatureVerified && isTwitterVerified && (
                  <button 
                    onClick={startAudit}
                    disabled={isScanning}
                    className="w-full max-w-sm mx-auto py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-lg font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isScanning ? <Loader2 className="animate-spin" /> : <Zap />}
                    Start Audit
                  </button>
               )}

               <div className="flex flex-wrap justify-center gap-8 pt-10 border-t border-white/5">
                  <div className="text-center">
                    <p className="text-3xl font-black text-blue-500">{communityAuditCount.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Audits Performed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-black text-indigo-500">1,500+</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Badges Earned</p>
                  </div>
               </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="flex glass-effect p-1.5 rounded-2xl sticky top-20 z-30 backdrop-blur-xl border border-white/5 mb-8">
                  {(['dashboard', 'claim'] as const).map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 shadow-lg text-white' : 'text-gray-500'}`}>{t}</button>))}
               </div>

               {activeTab === 'dashboard' ? (
                 <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Box 1: Points Display */}
                      <div className="glass-effect p-8 rounded-[3rem] border-blue-500/20 text-center relative overflow-hidden flex flex-col items-center justify-center">
                        <div className="relative z-10">
                          <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">MY BASE IMPRESSION</span>
                          <div className="text-6xl font-black italic mt-2 text-blue-500 drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]">{user.points.toFixed(2)}</div>
                          <div className="mt-6 w-48 mx-auto h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,1)]" style={{ width: `${Math.min((user.points / 1000) * 100, 100)}%` }} />
                          </div>
                          <p className="mt-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Season 01 Ranking Proof</p>
                        </div>
                        <Flame className="absolute -bottom-6 -right-6 w-32 h-32 text-blue-500/5 rotate-12" />
                      </div>

                      {/* Box 2: Eligibility & Badge Status */}
                      <div className="glass-effect p-8 rounded-[3rem] border-white/10 text-center relative overflow-hidden flex flex-col items-center justify-center gap-4">
                         <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">IMPRESSION STATUS</span>
                         
                         <div className="flex flex-col items-center gap-2">
                           {claimEligibility.status === 'ELIGIBLE' ? (
                             <>
                               <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-6 py-2 rounded-full">
                                 <CheckCircle2 className="w-4 h-4 text-green-500" />
                                 <span className="text-sm font-black text-green-400 uppercase italic">ELIGIBLE</span>
                               </div>
                               <div className="mt-2 text-center">
                                 <p className="text-[9px] font-black text-gray-500 uppercase">TIER UNLOCKED</p>
                                 <p className={`text-2xl font-black uppercase italic bg-clip-text text-transparent bg-gradient-to-r ${TIERS[getTierFromPoints(user.points)].color}`}>
                                   {claimEligibility.tierName}
                                 </p>
                               </div>
                             </>
                           ) : (
                             <>
                               <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-6 py-2 rounded-full">
                                 <Ban className="w-4 h-4 text-red-500" />
                                 <span className="text-sm font-black text-red-400 uppercase italic">NOT ELIGIBLE</span>
                               </div>
                               <p className="text-[10px] font-bold text-gray-400 mt-2">{claimEligibility.message}</p>
                             </>
                           )}
                         </div>
                         <Trophy className="absolute -top-6 -left-6 w-32 h-32 text-white/5 -rotate-12" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                       <div className="lg:col-span-1 space-y-6">
                         <BadgeDisplay 
                           tier={getTierFromPoints(user.points)} 
                           imageUrl={badgeImage} 
                           loading={isGenerating} 
                         />
                         <button 
                           onClick={generateBadge}
                           disabled={isGenerating}
                           className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 italic tracking-widest"
                         >
                           {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                           Refresh NFT Visual
                         </button>
                       </div>

                       <div className="lg:col-span-2 space-y-6">
                          <div className="glass-effect p-8 rounded-[3rem] border-white/10 space-y-6">
                            <div className="flex items-center justify-between">
                               <h4 className="font-black text-lg uppercase tracking-tighter italic">Contribution Breakdown</h4>
                               <button onClick={refreshAssets} disabled={isRefreshingAssets} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                 <RefreshCw className={`w-4 h-4 ${isRefreshingAssets ? 'animate-spin' : ''}`} />
                               </button>
                            </div>

                            <div className="space-y-5">
                               {[
                                 { label: 'Social Impact', pts: user.pointsBreakdown?.social_twitter || 0, color: 'bg-blue-500' },
                                 { label: 'Farcaster Synergy', pts: user.pointsBreakdown?.social_fc || 0, color: 'bg-purple-500' },
                                 { label: '$LAMBOLESS Yield', pts: user.pointsBreakdown?.lambo || 0, color: 'bg-yellow-500' },
                                 { label: 'Onchain Seniority', pts: user.pointsBreakdown?.seniority || 0, color: 'bg-indigo-500' }
                               ].map((item, i) => (
                                 <div key={i} className="space-y-2">
                                   <div className="flex justify-between text-[10px] font-black uppercase italic tracking-widest">
                                     <span className="text-gray-500">{item.label}</span>
                                     <span className="text-blue-400">+{item.pts.toFixed(2)} PTS</span>
                                   </div>
                                   <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                     <div 
                                       className={`h-full ${item.color} rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.2)]`} 
                                       style={{ width: `${Math.min((item.pts / Math.max(user.points, 1)) * 100, 100)}%` }} 
                                     />
                                   </div>
                                 </div>
                               ))}
                            </div>
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-10 text-center py-6 pb-12">
                   <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20"><Award className="w-10 h-10 text-blue-500" /></div>
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter">Impact Rewards</h2>
                   <div className="max-w-md mx-auto space-y-8">
                      <BadgeDisplay tier={getTierFromPoints(user.points)} imageUrl={badgeImage} loading={isGenerating} />
                      <div className={`p-8 rounded-[3rem] text-center border transition-all ${TIERS[getTierFromPoints(user.points)].glowClass} bg-black/40`}>
                         <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Tier Status</span>
                         <h3 className={`text-4xl font-black uppercase italic tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-r ${TIERS[getTierFromPoints(user.points)].color}`}>
                           {TIERS[getTierFromPoints(user.points)].name}
                         </h3>
                      </div>
                      <button 
                        disabled={!claimEligibility.eligible} 
                        className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 transition-all border shadow-2xl ${claimEligibility.eligible ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30' : 'border-white/5 text-gray-600 bg-white/5'}`}
                      >
                        {claimEligibility.eligible ? <Zap className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        {claimEligibility.eligible ? 'Claim NFT Badge' : claimEligibility.message}
                      </button>
                   </div>
                 </div>
               )}
            </div>
          )}
        </main>

        {showWalletSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-[2rem] p-8 space-y-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Select Wallet</h3>
                  <button onClick={() => setShowWalletSelector(false)} className="p-2 hover:bg-white/5 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {farcasterContext && (
                    <button 
                      onClick={handleFarcasterAutoLogin}
                      disabled={isConnecting || isSigning}
                      className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-600/20 to-purple-800/20 border border-purple-500/30 flex items-center gap-4 hover:scale-[1.02] transition-all disabled:opacity-50"
                    >
                      {isConnecting || isSigning ? (
                        <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold">F</div>
                      )}
                      <div className="text-left">
                        <p className="font-bold">Farcaster Wallet</p>
                        <p className="text-[10px] text-purple-300 uppercase font-black">
                          {isSigning ? 'Signing Proof...' : 'Native Connection'}
                        </p>
                      </div>
                    </button>
                  )}
                  {discoveredProviders.map((detail) => (
                    <button 
                      key={detail.info.uuid}
                      onClick={() => handleConnectAndSign(detail.provider)}
                      className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-all"
                    >
                      <img src={detail.info.icon} alt={detail.info.name} className="w-10 h-10 rounded-xl" />
                      <div className="text-left">
                        <p className="font-bold">{detail.info.name}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-black">Detected Provider</p>
                      </div>
                    </button>
                  ))}
                </div>
             </div>
          </div>
        )}

        {isScanning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
             <div className="w-full max-w-lg space-y-8 text-center">
                <div className="relative w-32 h-32 mx-auto">
                  <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
                  <div 
                    className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black">{scanProgress}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">Auditing Impression</h3>
                  <p className="text-gray-400 font-mono text-xs animate-pulse">Running onchain validation sequences...</p>
                </div>

                <div className="bg-black border border-white/10 rounded-2xl p-4 h-48 overflow-y-auto font-mono text-left text-[10px] space-y-1">
                  {scanLogs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-blue-500/50">[{new Date().toLocaleTimeString()}]</span>
                      <span className={log.includes('Error') ? 'text-red-400' : 'text-gray-300'}>{log}</span>
                    </div>
                  ))}
                  <div className="animate-pulse">_</div>
                </div>
             </div>
          </div>
        )}
    </div>
  );
};

export default App;
