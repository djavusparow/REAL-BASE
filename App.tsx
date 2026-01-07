import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Loader2, 
  LogOut,
  Trophy,
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

const BrandLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => {
  const dimensions = size === 'lg' ? 'w-40 h-40' : 'w-10 h-10';
  const radius = size === 'lg' ? 'rounded-[2.5rem]' : 'rounded-xl';
  return (
    <div className={`${dimensions} ${radius} relative overflow-hidden border border-white/20 blue-glow bg-blue-600 flex items-center justify-center`}>
      <span className={`${size === 'lg' ? 'text-lg' : 'text-[7px]'} font-black text-white uppercase italic leading-none text-center px-1`}>Base<br/>Impression</span>
    </div>
  );
};

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<UserStats | null>(null);
  const [address, setAddress] = useState('');
  const [handle, setHandle] = useState('');
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);
  const [isTwitterVerified, setIsTwitterVerified] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);

  const tierSupplies = useMemo(() => ({
    [RankTier.PLATINUM]: TIERS[RankTier.PLATINUM].supply,
    [RankTier.GOLD]: TIERS[RankTier.GOLD].supply,
    [RankTier.SILVER]: TIERS[RankTier.SILVER].supply,
    [RankTier.BRONZE]: TIERS[RankTier.BRONZE].supply,
    [RankTier.NONE]: 0
  }), []);

  useEffect(() => {
    const init = async () => {
      // Set a safety timeout to prevent infinite loading if SDK doesn't respond
      const timeoutId = setTimeout(() => {
        if (!isReady) setIsReady(true);
      }, 2000);

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
        clearTimeout(timeoutId);
        setIsReady(true);
      }
    };
    init();
  }, []);

  const startAudit = async () => {
    if (!handle) return;
    setIsScanning(true);
    try {
      const results = await twitterService.scanPosts(handle);
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
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsScanning(false); 
    }
  };

  const handleFullClaimProcess = async () => {
    if (isGenerating || isMinting || isMinted) return;
    
    setIsGenerating(true);
    const currentTier = getTierFromPoints(user!.points);
    let finalImage = TIERS[currentTier].referenceImageUrl;
    
    try {
      const aiImage = await geminiService.generateBadgePreview(currentTier, user!.twitterHandle);
      if (aiImage) {
        finalImage = aiImage;
      }
      setBadgeImage(finalImage);
    } catch (e) {
      console.warn("AI refinement failed, using static asset:", e);
      setBadgeImage(finalImage);
    } finally {
      setIsGenerating(false);
    }

    setIsMinting(true);
    try {
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Wallet not connected. Please open in a Farcaster compatible client.");

      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      const tierIndex = tierMap[currentTier] ?? 3;

      await contract.methods.mintBadge(finalImage, tierIndex).send({ 
        from: address,
      });

      setIsMinted(true);
    } catch (e: any) {
      alert(`Minting Failed: ${e.message || "Unknown error"}`);
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

  if (!isReady) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
        <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest animate-pulse">Initializing Interface...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
        <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50 px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3"><BrandLogo /><h1 className="text-lg font-black uppercase italic tracking-tighter">Base Impression</h1></div>
            {address ? (
               <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                 <span className="text-[10px] font-mono text-gray-400">{address.slice(0, 6)}...</span>
                 <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-1 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"><LogOut size={14} /></button>
               </div>
            ) : (
               <button onClick={() => setShowWalletSelector(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-black uppercase text-xs transition-all active:scale-95 shadow-lg shadow-blue-600/20">Login</button>
            )}
        </nav>

        <main className="max-w-4xl mx-auto px-4 py-8 pb-20">
          {!user ? (
            <div className="py-20 text-center space-y-12">
               <div className="space-y-4">
                 <h2 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter leading-none animate-in fade-in slide-in-from-top-4 duration-1000">CHECK YOUR <br/><span className="text-blue-500">IMPACT</span></h2>
                 <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.4em]">Scan your Base presence across the ecosystem</p>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                  <div className={`p-8 rounded-[2rem] border transition-all duration-500 ${isSignatureVerified ? 'bg-blue-500/5 border-blue-500/30 text-blue-500' : 'bg-white/5 border-white/10'}`}>
                    <p className="text-[10px] font-black uppercase mb-4 tracking-widest text-gray-500">01. Identity</p>
                    {isSignatureVerified ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 size={32} className="text-blue-500 animate-in zoom-in" />
                        <span className="text-[10px] font-mono opacity-50">{address.slice(0, 8)}...</span>
                      </div>
                    ) : (
                      <button onClick={() => setShowWalletSelector(true)} className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-500 transition-colors">Verify Wallet</button>
                    )}
                  </div>
                  <div className={`p-8 rounded-[2rem] border transition-all duration-500 ${isTwitterVerified ? 'bg-blue-500/5 border-blue-500/30 text-blue-500' : 'bg-white/5 border-white/10'}`}>
                    <p className="text-[10px] font-black uppercase mb-4 tracking-widest text-gray-500">02. Social X</p>
                    {isTwitterVerified ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 size={32} className="text-blue-500 animate-in zoom-in" />
                        <span className="text-[10px] font-mono opacity-50">{handle}</span>
                      </div>
                    ) : (
                      <button onClick={() => twitterService.login()} className="w-full py-3 bg-white/10 text-white border border-white/10 rounded-xl text-xs font-black uppercase hover:bg-white/20 transition-colors">Link X Profile</button>
                    )}
                  </div>
               </div>

               {isSignatureVerified && isTwitterVerified && (
                  <button 
                    onClick={startAudit} 
                    disabled={isScanning} 
                    className="w-full max-w-sm mx-auto py-6 bg-blue-600 hover:bg-blue-500 rounded-[2rem] font-black uppercase italic text-lg flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl shadow-blue-600/40"
                  >
                    {isScanning ? <Loader2 className="animate-spin" /> : <Zap fill="currentColor" />} 
                    {isScanning ? 'Scanning Base...' : 'Audit My Impact'}
                  </button>
               )}
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
               <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 max-w-xs mx-auto">
                  {(['dashboard', 'claim'] as const).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>
                  ))}
               </div>

               {activeTab === 'dashboard' ? (
                 <div className="grid gap-6">
                    <div className="glass-effect p-12 rounded-[3.5rem] text-center border-white/5 relative overflow-hidden">
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[100px] pointer-events-none" />
                       <p className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em] mb-4">Total Audited Score</p>
                       <h3 className="text-8xl font-black italic tracking-tighter">{user.points.toFixed(0)}</h3>
                       <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
                          <div className="text-left">
                            <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Baseposting</p>
                            <p className="text-xl font-bold">{user.basepostingPoints} Pts</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Trust Score</p>
                            <p className="text-xl font-bold text-blue-500">{user.trustScore}%</p>
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-10 text-center animate-in fade-in duration-500">
                    <BadgeDisplay 
                      tier={getTierFromPoints(user.points)} 
                      imageUrl={badgeImage || TIERS[getTierFromPoints(user.points)].referenceImageUrl} 
                      loading={isGenerating} 
                    />
                    
                    <div className="max-w-md mx-auto space-y-6">
                       {isMinted ? (
                         <div className="bg-green-500/10 text-green-400 p-6 rounded-[2rem] border border-green-500/20 font-black uppercase italic text-xs flex items-center justify-center gap-2">
                           <Trophy size={20} /> Badge Secured on Base
                         </div>
                       ) : (
                         <button 
                           onClick={handleFullClaimProcess}
                           disabled={!claimEligibility.eligible || isGenerating || isMinting}
                           className={`w-full py-6 rounded-[2rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 transition-all ${claimEligibility.eligible && !isGenerating && !isMinting ? 'bg-blue-600 hover:bg-blue-500 shadow-2xl active:scale-95' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                         >
                           {isGenerating || isMinting ? <Loader2 className="animate-spin w-5 h-5" /> : <Zap className="w-5 h-5" />}
                           {isGenerating ? 'Polishing Asset...' : isMinting ? 'Minting...' : claimEligibility.buttonText}
                         </button>
                       )}
                       {getTierFromPoints(user.points) === RankTier.NONE && (
                         <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest px-8">Score at least 100 points to unlock Bronze tier badges.</p>
                       )}
                    </div>
                 </div>
               )}
            </div>
          )}
        </main>

        {showWalletSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
             <div className="w-full max-w-xs bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 text-center space-y-8 shadow-2xl">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-600/20">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-2xl font-black italic uppercase">Connect Wallet</h3>
                <div className="space-y-3">
                  <button onClick={() => { setAddress('0xVerified_' + Math.floor(Math.random()*1000)); setIsSignatureVerified(true); setShowWalletSelector(false); }} className="w-full py-4 bg-blue-600 rounded-2xl font-black uppercase italic text-xs hover:bg-blue-500 transition-all">Sign Message</button>
                  <button onClick={() => setShowWalletSelector(false)} className="w-full py-4 bg-white/5 rounded-2xl font-black uppercase italic text-xs text-gray-400 hover:bg-white/10">Cancel</button>
                </div>
             </div>
          </div>
        )}
    </div>
  );
};

export default App;