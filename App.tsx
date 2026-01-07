import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Twitter, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Info, 
  Loader2, 
  X,
  LogOut,
  Trophy,
  Coins,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier } from './types';
import { 
  TIERS, 
} from './constants';
import { calculateDetailedPoints, getTierFromPoints } from './utils/calculations';
import BadgeDisplay from './components/BadgeDisplay';
import { geminiService } from './services/geminiService';
import { twitterService } from './services/twitterService';

const STORAGE_KEY_USER = 'base_impression_v1_user';
const STORAGE_KEY_SUPPLIES = 'base_impression_v1_supplies';

const NFT_CONTRACT_ADDRESS = "0x4afc5DF90f6F2541C93f9b29Ec0A95b46ad61a6B"; 

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

// Placeholder image URL if AI fails
const PLACEHOLDER_BADGE = "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=400";

const BrandLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => {
  const dimensions = size === 'lg' ? 'w-40 h-40' : 'w-10 h-10';
  const radius = size === 'lg' ? 'rounded-[2.5rem]' : 'rounded-xl';
  return (
    <div className={`${dimensions} ${radius} relative overflow-hidden border border-white/20 blue-glow`}>
      <img src={PLACEHOLDER_BADGE} className="absolute inset-0 w-full h-full object-cover brightness-75" alt="Base" />
      <div className="absolute inset-0 bg-blue-600/30 mix-blend-overlay" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${size === 'lg' ? 'text-lg' : 'text-[7px]'} font-black text-white uppercase italic leading-none text-center`}>Base<br/>Impression</span>
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

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

  useEffect(() => {
    const savedSupplies = localStorage.getItem(STORAGE_KEY_SUPPLIES);
    if (savedSupplies) setTierSupplies(JSON.parse(savedSupplies));

    const init = async () => {
      const watchdog = setTimeout(() => setIsReady(true), 2500);
      try {
        if (typeof sdk !== 'undefined' && sdk.actions) {
          await sdk.actions.ready();
        }
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
        console.error("Init error:", e); 
      } finally {
        clearTimeout(watchdog);
        setIsReady(true);
      }
    };
    init();
  }, []);

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
        const msg = `Base Impression: Verify Wallet\nAddress: ${fcAddr}\nTime: ${Date.now()}`;
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
      }
    } catch (e) { 
      console.error(e);
    } finally { 
      setIsConnecting(false); 
      setIsSigning(false); 
    }
  };

  const startAudit = async () => {
    if (!handle) return;
    setIsScanning(true);
    setScanProgress(20);
    try {
      const results = await twitterService.scanPosts(handle);
      setScanProgress(80);
      const { total, breakdown } = calculateDetailedPoints(1, results.accountAgeDays, results.totalValidPosts, 0, { lambo: 0, jesse: 0, nick: 0 }, results.basepostingPoints);
      const stats: UserStats = {
        address,
        twitterHandle: handle,
        baseAppAgeDays: 1,
        twitterAgeDays: results.accountAgeDays,
        validTweetsCount: results.totalValidPosts,
        basepostingPoints: results.basepostingPoints,
        lambolessBalance: 0,
        points: total,
        rank: 0,
        trustScore: results.trustScore,
        recentContributions: results.foundTweets,
        twitterDailyBreakdown: results.dailyBreakdown,
        pointsBreakdown: breakdown
      } as any;
      setUser(stats);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(stats));
    } catch (e) { console.error(e); } finally { setIsScanning(false); }
  };

  const handleFullClaimProcess = async () => {
    if (isGenerating || isMinting || isMinted) return;
    
    setIsGenerating(true);
    let finalImage = PLACEHOLDER_BADGE;
    
    try {
      const currentTier = getTierFromPoints(user!.points);
      const generatedImg = await geminiService.generateBadgePreview(currentTier, user!.twitterHandle);
      
      if (generatedImg) {
        finalImage = generatedImg;
        setBadgeImage(generatedImg);
      } else {
        console.warn("AI Generation failed, using placeholder");
        setBadgeImage(PLACEHOLDER_BADGE);
      }
    } catch (e) {
      console.error("Visual generation logic failed:", e);
      setBadgeImage(PLACEHOLDER_BADGE);
    } finally {
      setIsGenerating(false);
    }

    // Continue to minting even if AI fails (use placeholder)
    setIsMinting(true);
    try {
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Wallet provider not found.");

      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      
      const currentTier = getTierFromPoints(user!.points);
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      const tierIndex = tierMap[currentTier] ?? 3;

      const mintTx = await contract.methods.mintBadge(finalImage, tierIndex).send({ 
        from: address,
      });

      setTxHash(mintTx.transactionHash);
      setTierSupplies(prev => ({ ...prev, [currentTier]: Math.max(0, prev[currentTier] - 1) }));
      setIsMinted(true);
      setShowCastPrompt(true);

    } catch (e: any) {
      console.error("Minting Detailed Error:", e);
      const errMsg = e.message?.toLowerCase() || "";
      if (errMsg.includes("user denied") || errMsg.includes("rejected")) {
        alert("Transaction Cancelled.");
      } else if (errMsg.includes("insufficient funds")) {
        alert("Insufficient ETH for gas on Base.");
      } else {
        alert(`Minting Failed: ${e.message || "Unknown error"}. Check your Base ETH balance.`);
      }
    } finally {
      setIsMinting(false);
    }
  };

  const claimEligibility = useMemo(() => {
    if (!user) return { eligible: false, buttonText: 'Login Required' };
    const tier = getTierFromPoints(user.points);
    const hasSupply = tierSupplies[tier] > 0;
    const eligible = tier !== RankTier.NONE && hasSupply;
    return { eligible, tierName: TIERS[tier].name, buttonText: eligible ? `MINT ${TIERS[tier].name} BADGE` : 'Locked' };
  }, [user, tierSupplies]);

  if (!isReady) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-blue-600 font-black uppercase italic tracking-widest text-[10px] animate-pulse">Initializing Base Impression...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-600/30">
        <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50 px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3"><BrandLogo /><h1 className="text-lg font-black uppercase italic tracking-tighter">Base Impression</h1></div>
            {address ? (
               <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                 <span className="text-[10px] font-mono text-gray-400">{address.slice(0, 6)}...</span>
                 <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-1 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"><LogOut size={14} /></button>
               </div>
            ) : (
               <button onClick={() => setShowWalletSelector(true)} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-full font-black uppercase text-xs transition-all active:scale-95 shadow-lg shadow-blue-600/20">Login</button>
            )}
        </nav>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {!user ? (
            <div className="py-20 text-center space-y-12 animate-in fade-in duration-1000">
               <div className="space-y-4">
                 <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">BUILD ON <br/><span className="text-blue-500">BASE</span></h2>
                 <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.4em]">Mainnet Impact Audit</p>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={`p-8 rounded-[2rem] border ${isSignatureVerified ? 'bg-green-500/5 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10'}`}>
                    <p className="text-[10px] font-black uppercase mb-4 tracking-widest">01. Wallet Identity</p>
                    {isSignatureVerified ? <CheckCircle2 className="mx-auto" /> : <button onClick={() => setShowWalletSelector(true)} className="w-full py-3 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-black uppercase">Verify</button>}
                  </div>
                  <div className={`p-8 rounded-[2rem] border ${isTwitterVerified ? 'bg-green-500/5 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10'}`}>
                    <p className="text-[10px] font-black uppercase mb-4 tracking-widest">02. X Graph</p>
                    {isTwitterVerified ? <CheckCircle2 className="mx-auto" /> : <button onClick={() => twitterService.login()} className="w-full py-3 bg-white/5 text-gray-400 border border-white/10 rounded-xl text-xs font-black uppercase">Link X</button>}
                  </div>
               </div>

               {isSignatureVerified && isTwitterVerified && (
                  <button onClick={startAudit} disabled={isScanning} className="w-full py-6 bg-blue-600 rounded-[2rem] font-black uppercase italic text-lg flex items-center justify-center gap-4 transition-all shadow-2xl shadow-blue-600/30">
                    {isScanning ? <Loader2 className="animate-spin" /> : <Zap />} 
                    Scan My Impression
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
                    <div className="glass-effect p-12 rounded-[3.5rem] text-center border-blue-500/20 relative group overflow-hidden">
                       <p className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">Audited Impact Score</p>
                       <h3 className="text-8xl font-black italic mt-4">{user.points.toFixed(0)}</h3>
                       <div className="flex items-center justify-center gap-2 mt-6 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                          <ShieldCheck size={14} className="text-blue-500" />
                          On-Chain & Social Verification Active
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 transition-all">
                          <div className="flex items-center gap-2 mb-2">
                             <Twitter size={14} className="text-blue-400" />
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">X Signal</p>
                          </div>
                          <p className="text-3xl font-black italic">+{user.pointsBreakdown?.social_twitter.toFixed(0)}</p>
                       </div>
                       <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 transition-all">
                          <div className="flex items-center gap-2 mb-2">
                             <Coins size={14} className="text-yellow-500" />
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Asset Score</p>
                          </div>
                          <p className="text-3xl font-black italic">+{user.pointsBreakdown?.lambo.toFixed(0)}</p>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-10 text-center">
                    <BadgeDisplay tier={getTierFromPoints(user.points)} imageUrl={badgeImage} loading={isGenerating} />
                    
                    <div className="max-w-md mx-auto space-y-8">
                       <div className="space-y-4">
                         {isMinted ? (
                           <div className="bg-green-500/10 text-green-400 p-6 rounded-[2rem] border border-green-500/20 font-black uppercase italic text-xs flex flex-col items-center gap-2">
                             <Trophy size={20} /> Impact Secured on Base
                             {txHash && <a href={`https://basescan.org/tx/${txHash}`} target="_blank" className="text-blue-400 underline text-[9px]">Verify Transaction</a>}
                           </div>
                         ) : (
                           <button 
                             onClick={handleFullClaimProcess}
                             disabled={!claimEligibility.eligible || isGenerating || isMinting}
                             className={`w-full py-6 rounded-[2rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 transition-all ${claimEligibility.eligible && !isGenerating && !isMinting ? 'bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-600/20 active:scale-95' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                           >
                             {isGenerating || isMinting ? <Loader2 className="animate-spin w-5 h-5" /> : <Zap className="w-5 h-5" />}
                             {isGenerating ? 'GENERATING VISUAL...' : isMinting ? 'CONFIRM IN WALLET...' : claimEligibility.buttonText}
                           </button>
                         )}
                         <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-center gap-2 italic">
                            <Info size={10} /> User pays 100% network gas fees
                         </p>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          )}
        </main>

        {showWalletSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
             <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 text-center space-y-8 shadow-2xl">
                <div className="space-y-2">
                   <h3 className="text-2xl font-black italic uppercase">Verify Profile</h3>
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sign with your Farcaster/Base identity</p>
                </div>
                <button onClick={handleFarcasterAutoLogin} className="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl font-black uppercase italic text-xs active:scale-95 transition-all">Farcaster Sign-In</button>
                <button onClick={() => setShowWalletSelector(false)} className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Go Back</button>
             </div>
          </div>
        )}

        {showCastPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-blue-900/10 backdrop-blur-xl animate-in zoom-in duration-300">
             <div className="w-full max-w-md bg-[#050505] border border-blue-500/30 rounded-[3.5rem] p-12 text-center space-y-8">
                <Sparkles className="text-blue-500 w-12 h-12 mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">Impact Secured</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase">Badge is live on Base Mainnet.</p>
                </div>
                <button onClick={() => sdk.actions.cast({ text: "Just minted my Base Impression Badge! 🏎️💨 Check your impact at real-base-2026.vercel.app" })} className="w-full py-6 bg-white text-black rounded-[2rem] font-black uppercase italic text-xs transition-all active:scale-95 shadow-xl">Share Achievement</button>
                <button onClick={() => setShowCastPrompt(false)} className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Dismiss</button>
             </div>
          </div>
        )}
        
        {isScanning && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-black/98 backdrop-blur-2xl">
             <div className="w-48 h-48 relative flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-blue-600/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
                <p className="text-3xl font-black italic">{scanProgress}%</p>
             </div>
             <div className="mt-12 text-center space-y-4">
                <h3 className="text-3xl font-black uppercase italic">Auditing Impact</h3>
                <p className="text-xs text-blue-600 font-bold uppercase animate-pulse tracking-widest">Scanning BaseScan & Social Graphs...</p>
             </div>
          </div>
        )}
    </div>
  );
};

export default App;