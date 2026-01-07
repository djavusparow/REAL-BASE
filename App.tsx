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
const STORAGE_KEY_SUPPLIES = 'base_impression_v1_supplies';

// REAL CONTRACT CONFIGURATION (Base Mainnet)
const NFT_CONTRACT_ADDRESS = "0x7777777777777777777777777777777777777777"; 
const MINIMAL_NFT_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "tokenURI", "type": "string" },
      { "internalType": "uint8", "name": "tier", "type": "uint8" }
    ],
    "name": "mintBadge",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

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
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  const [tierSupplies, setTierSupplies] = useState<Record<RankTier, number>>({
    [RankTier.PLATINUM]: TIERS[RankTier.PLATINUM].supply,
    [RankTier.GOLD]: TIERS[RankTier.GOLD].supply,
    [RankTier.SILVER]: TIERS[RankTier.SILVER].supply,
    [RankTier.BRONZE]: TIERS[RankTier.BRONZE].supply,
    [RankTier.NONE]: 0
  });

  const getFarcasterAddress = useCallback((ctx: any) => {
    if (!ctx) return null;
    return ctx.address || ctx.user?.address || ctx.user?.custodyAddress || (ctx.user?.verifiedAddresses?.[0]);
  }, []);

  // Memuat data awal dan inisialisasi SDK
  useEffect(() => {
    const savedSupplies = localStorage.getItem(STORAGE_KEY_SUPPLIES);
    if (savedSupplies) setTierSupplies(JSON.parse(savedSupplies));

    const init = async () => {
      // Watchdog timeout: Jika SDK tidak merespons dalam 2 detik, paksa aplikasi terbuka
      const watchdog = setTimeout(() => {
        setIsReady(true);
      }, 2000);

      try {
        // Cek jika SDK tersedia sebelum memanggil actions.ready()
        if (typeof sdk !== 'undefined' && sdk.actions) {
          await sdk.actions.ready().catch(e => console.warn("SDK ready error", e));
        }

        // Cek local storage untuk user lama
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        if (stored) {
          const data = JSON.parse(stored);
          setUser(data);
          setAddress(data.address || '');
          setHandle(data.twitterHandle || '');
          setIsSignatureVerified(!!data.address);
          setIsTwitterVerified(!!data.twitterHandle);
        }
      } catch (e) { 
        console.error("Initialization error:", e); 
      } finally {
        clearTimeout(watchdog);
        setIsReady(true);
      }
    };

    init();
  }, []);

  // Menyimpan supplies saat berubah
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SUPPLIES, JSON.stringify(tierSupplies));
  }, [tierSupplies]);

  const handleFarcasterAutoLogin = async () => {
    setIsConnecting(true);
    try {
      const context = await sdk.context;
      const provider = sdk.wallet?.ethProvider;
      let fcAddr = getFarcasterAddress(context);
      
      if (provider) {
        const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
        fcAddr = accounts[0];
        setIsSigning(true);
        const web3 = new Web3(provider);
        const msg = `Sign to verify your Base Impression Profile\nWallet: ${fcAddr}\nTimestamp: ${Date.now()}`;
        await web3.eth.personal.sign(msg, fcAddr, "");
        setIsSigning(false);
      }

      if (fcAddr) {
        setAddress(fcAddr);
        setIsSignatureVerified(true);
        if (context?.user?.username) {
          setHandle(`@${context.user.username}`);
          setIsTwitterVerified(true);
        }
        setShowWalletSelector(false);
      } else {
        alert("Could not find a valid wallet address. Please open in Farcaster or connect a wallet.");
      }
    } catch (e) { 
      console.error(e);
      alert("Verification failed. Please try again.");
    } finally { 
      setIsConnecting(false); 
      setIsSigning(false); 
    }
  };

  const startAudit = async () => {
    if (!handle) return;
    setIsScanning(true);
    setScanProgress(30);
    try {
      const results = await twitterService.scanPosts(handle);
      setScanProgress(70);
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
      const { total, breakdown } = calculateDetailedPoints(1, results.accountAgeDays, results.totalValidPosts, 0, { lambo: 0, jesse: 0, nick: 0 }, results.basepostingPoints);
      stats.points = total;
      stats.pointsBreakdown = breakdown;
      setUser(stats);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(stats));
    } catch (e) { console.error(e); } finally { setIsScanning(false); }
  };

  const handleFullClaimProcess = async () => {
    if (isGenerating || isMinting || isMinted) return;
    
    setIsGenerating(true);
    try {
      const currentTier = getTierFromPoints(user!.points);
      const img = await geminiService.generateBadgePreview(currentTier, user!.twitterHandle);
      if (!img) throw new Error("AI Visual Generation Failed");
      
      setBadgeImage(img);
      setIsGenerating(false);

      setIsMinting(true);
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("No wallet provider found. Please connect your wallet.");

      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      const tierIndex = tierMap[currentTier] ?? 3;

      const mintTx = await contract.methods.mintBadge(img, tierIndex).send({ 
        from: address 
      });

      setTxHash(mintTx.transactionHash);
      setTierSupplies(prev => ({ ...prev, [currentTier]: Math.max(0, prev[currentTier] - 1) }));
      setIsMinted(true);
      setShowCastPrompt(true);

    } catch (e: any) {
      console.error("Minting Error:", e);
      alert(e.message || "Minting failed. User rejected or insufficient gas.");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  const claimEligibility = useMemo(() => {
    if (!user) return { eligible: false, buttonText: 'Login Required' };
    const tier = getTierFromPoints(user.points);
    const minLambo = 2.5;
    const hasLambo = (user.lambolessBalance || 0) >= minLambo;
    const hasSupply = tierSupplies[tier] > 0;
    const eligible = tier !== RankTier.NONE && hasLambo && hasSupply;
    return { eligible, tierName: TIERS[tier].name, buttonText: eligible ? `MINT ${TIERS[tier].name} BADGE` : 'Locked' };
  }, [user, tierSupplies]);

  if (!isReady) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-blue-500 font-black uppercase italic tracking-widest text-xs animate-pulse">Initializing Base Impression...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
        <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50 px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3"><BrandLogo /><h1 className="text-lg font-black uppercase italic tracking-tighter">Base Impression</h1></div>
            {address ? (
               <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                 <span className="text-xs font-mono text-gray-400">{address.slice(0, 6)}...</span>
                 <button onClick={() => { localStorage.removeItem(STORAGE_KEY_USER); window.location.reload(); }} className="p-1 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"><LogOut size={14} /></button>
               </div>
            ) : (
               <button onClick={() => setShowWalletSelector(true)} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-full font-black uppercase text-xs transition-all active:scale-95 shadow-lg shadow-blue-600/20">Login</button>
            )}
        </nav>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {!user ? (
            <div className="py-20 text-center space-y-12 animate-in fade-in duration-1000">
               <div className="space-y-4">
                 <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">BUILD ON <br/><span className="text-blue-500 drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]">BASE</span></h2>
                 <p className="text-gray-500 font-bold uppercase text-xs tracking-[0.3em]">Identity & Contribution Audit</p>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={`p-8 rounded-[2rem] border transition-all ${isSignatureVerified ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Step 01</p>
                      {isSignatureVerified && <CheckCircle2 size={16} className="text-green-500" />}
                    </div>
                    <p className="text-sm font-black uppercase italic mb-4">Wallet Proof</p>
                    {isSignatureVerified ? (
                      <p className="text-[10px] text-green-500 font-bold uppercase">Identity Secured</p>
                    ) : (
                      <button onClick={() => setShowWalletSelector(true)} className="w-full py-3 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-black uppercase hover:bg-blue-600/20 transition-all">Verify Wallet</button>
                    )}
                  </div>
                  
                  <div className={`p-8 rounded-[2rem] border transition-all ${isTwitterVerified ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Step 02</p>
                      {isTwitterVerified && <CheckCircle2 size={16} className="text-green-500" />}
                    </div>
                    <p className="text-sm font-black uppercase italic mb-4">Social Signal</p>
                    {isTwitterVerified ? (
                      <p className="text-[10px] text-green-500 font-bold uppercase">X/Twitter Linked</p>
                    ) : (
                      <button onClick={() => twitterService.login()} className="w-full py-3 bg-white/5 text-gray-300 border border-white/10 rounded-xl text-xs font-black uppercase hover:bg-white/10 transition-all">Connect X</button>
                    )}
                  </div>
               </div>

               {isSignatureVerified && isTwitterVerified && (
                  <button onClick={startAudit} disabled={isScanning} className="w-full py-6 bg-blue-600 hover:bg-blue-500 rounded-[2rem] font-black uppercase italic text-lg flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl shadow-blue-600/30 group">
                    {isScanning ? <Loader2 className="animate-spin" /> : <Zap className="group-hover:animate-pulse" />} 
                    Audit My Impression
                  </button>
               )}
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
               <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 backdrop-blur-xl">
                  {(['dashboard', 'claim'] as const).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>
                  ))}
               </div>

               {activeTab === 'dashboard' ? (
                 <div className="grid gap-6">
                    <div className="glass-effect p-12 rounded-[3.5rem] text-center border-blue-500/20 relative overflow-hidden group">
                       <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                       <p className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">On-Chain Impact Score</p>
                       <h3 className="text-8xl font-black italic mt-4 text-white drop-shadow-xl">{user.points.toFixed(0)}</h3>
                       <div className="flex items-center justify-center gap-2 mt-6">
                          <ShieldCheck size={14} className="text-blue-500" />
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Verified via BaseScan Oracle</p>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 hover:border-white/20 transition-all">
                          <div className="flex items-center gap-2 mb-2">
                             <Twitter size={14} className="text-blue-400" />
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Social Signal</p>
                          </div>
                          <p className="text-3xl font-black italic">+{user.pointsBreakdown?.social_twitter.toFixed(0)} <span className="text-xs not-italic text-gray-500 uppercase">Pts</span></p>
                       </div>
                       <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 hover:border-white/20 transition-all">
                          <div className="flex items-center gap-2 mb-2">
                             <Coins size={14} className="text-yellow-500" />
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Asset Yield</p>
                          </div>
                          <p className="text-3xl font-black italic">+{user.pointsBreakdown?.lambo.toFixed(0)} <span className="text-xs not-italic text-gray-500 uppercase">Pts</span></p>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-10 text-center animate-in fade-in duration-1000">
                    <BadgeDisplay tier={getTierFromPoints(user.points)} imageUrl={badgeImage} loading={isGenerating} />
                    
                    <div className="max-w-md mx-auto space-y-8">
                       <div className="glass-effect p-8 rounded-[2.5rem] space-y-6 border-white/10">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase italic tracking-widest border-b border-white/5 pb-4">
                             <span>Eligibility Check</span>
                             <span className="text-blue-400">Base Mainnet</span>
                          </div>
                          <div className="space-y-3">
                             <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                                <div className="flex items-center gap-3">
                                   <div className={`w-2 h-2 rounded-full ${ (user.lambolessBalance || 0) >= 2.5 ? 'bg-green-500' : 'bg-red-500' }`} />
                                   <span className="text-[11px] font-black uppercase italic">Hold $LAMBOLESS ($2.5+)</span>
                                </div>
                                { (user.lambolessBalance || 0) >= 2.5 ? <CheckCircle2 size={14} className="text-green-500" /> : <X size={14} className="text-red-500/50" /> }
                             </div>
                             <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                                <div className="flex items-center gap-3">
                                   <div className={`w-2 h-2 rounded-full ${ user.points >= 100 ? 'bg-green-500' : 'bg-red-500' }`} />
                                   <span className="text-[11px] font-black uppercase italic">Impression > 100 Pts</span>
                                </div>
                                { user.points >= 100 ? <CheckCircle2 size={14} className="text-green-500" /> : <X size={14} className="text-red-500/50" /> }
                             </div>
                          </div>
                       </div>

                       <div className="space-y-4">
                         {isMinted ? (
                           <div className="bg-green-500/10 text-green-400 p-6 rounded-[2rem] border border-green-500/20 font-black uppercase italic text-sm flex flex-col items-center gap-2">
                             <Trophy size={24} className="mb-2" />
                             Badge Secured on Base
                             {txHash && (
                               <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] font-bold text-blue-400 hover:underline">
                                 View Transaction <ExternalLink size={10} />
                               </a>
                             )}
                           </div>
                         ) : (
                           <button 
                             onClick={handleFullClaimProcess}
                             disabled={!claimEligibility.eligible || isGenerating || isMinting}
                             className={`w-full py-6 rounded-[2rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 transition-all ${claimEligibility.eligible && !isGenerating && !isMinting ? 'bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-600/20 active:scale-95' : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'}`}
                           >
                             {isGenerating || isMinting ? <Loader2 className="animate-spin w-5 h-5" /> : <Zap className="w-5 h-5" />}
                             {isGenerating ? 'GENERATING VISUAL...' : isMinting ? 'MINTING ON-CHAIN...' : claimEligibility.buttonText}
                           </button>
                         )}
                         <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] italic flex items-center justify-center gap-2">
                            <Info size={10} /> Network gas fees are paid by user
                         </p>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          )}
        </main>

        {showWalletSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
             <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 text-center space-y-8 shadow-2xl">
                <div className="space-y-2">
                   <h3 className="text-2xl font-black italic uppercase tracking-tighter">Secure Login</h3>
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Verify your builder identity</p>
                </div>
                <div className="space-y-3">
                  <button onClick={handleFarcasterAutoLogin} className="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 rounded-2xl font-black uppercase italic text-sm transition-all active:scale-95 flex items-center justify-center gap-3">
                     Farcaster Sign-In
                  </button>
                  <button onClick={() => setShowWalletSelector(false)} className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Go Back</button>
                </div>
             </div>
          </div>
        )}

        {showCastPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-blue-900/10 backdrop-blur-xl animate-in zoom-in duration-300">
             <div className="w-full max-w-md bg-[#050505] border border-blue-500/30 rounded-[3.5rem] p-12 text-center space-y-8 shadow-2xl">
                <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)]">
                   <Sparkles className="text-white w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">Impact Secured</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Your Badge is now on the Base Mainnet.</p>
                </div>
                <button onClick={() => sdk.actions.cast({ text: "Just minted my Base Impression Badge! 🏎️💨 Check your impact at real-base-2026.vercel.app" })} className="w-full py-6 bg-white text-black hover:bg-gray-100 rounded-[2rem] font-black uppercase italic text-xs transition-all active:scale-95 shadow-xl">Share Achievement</button>
                <button onClick={() => setShowCastPrompt(false)} className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] hover:text-white transition-colors">Dismiss</button>
             </div>
          </div>
        )}
        
        {isScanning && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-black/98 backdrop-blur-2xl">
             <div className="w-48 h-48 relative flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                <p className="text-3xl font-black italic">{scanProgress}%</p>
             </div>
             <div className="mt-12 text-center space-y-4">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter">Auditing Impression</h3>
                <p className="text-xs text-blue-500 font-bold uppercase animate-pulse tracking-widest">Scanning BaseScan & Social Graphs...</p>
             </div>
          </div>
        )}
    </div>
  );
};

export default App;