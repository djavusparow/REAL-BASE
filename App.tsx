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
  Sparkles,
  User
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier } from './types';
import { TIERS } from './constants';
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

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<UserStats | null>(null);
  const [address, setAddress] = useState('');
  const [handle, setHandle] = useState('');
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

  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        if (stored) {
          const data = JSON.parse(stored);
          setUser(data);
          setAddress(data.address);
          setHandle(data.twitterHandle);
          setIsSignatureVerified(true);
          setIsTwitterVerified(true);
        } else if (context?.user) {
          const fcAddr = context.user.verifiedAddresses?.ethAddresses?.[0] || context.user.custodyAddress;
          if (fcAddr) setAddress(fcAddr);
          if (context.user.username) {
             setHandle(`@${context.user.username}`);
             setIsSignatureVerified(!!fcAddr);
          }
        }
      } catch (e) { 
        console.error("Init error:", e); 
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  const handleManualVerification = () => {
    if (!address) {
      handleFarcasterAutoLogin();
      return;
    }
    setIsSignatureVerified(true);
  };

  // FIX: Mengganti redirect Twitter yang error dengan Input Manual
  const handleTwitterFallback = () => {
    const val = prompt("Enter your X (Twitter) Handle (e.g. @yourname):", handle);
    if (val) {
      const sanitized = val.startsWith('@') ? val : `@${val}`;
      setHandle(sanitized);
      setIsTwitterVerified(true);
    }
  };

  const handleFarcasterAutoLogin = async () => {
    setIsConnecting(true);
    try {
      const provider = sdk.wallet?.ethProvider;
      if (provider) {
        const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
        const fcAddr = accounts[0];
        setIsSigning(true);
        const web3 = new Web3(provider);
        const msg = `Base Impression: Verify Wallet\nAddress: ${fcAddr}\nTime: ${Date.now()}`;
        await web3.eth.personal.sign(msg, fcAddr, "");
        setAddress(fcAddr);
        setIsSignatureVerified(true);
      } else {
        const addr = prompt("Please enter your Base Wallet Address:");
        if (addr && addr.startsWith('0x')) {
          setAddress(addr);
          setIsSignatureVerified(true);
        }
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
    setScanProgress(10);
    try {
      setScanProgress(30);
      const results = await twitterService.scanPosts(handle);
      setScanProgress(70);
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
        pointsBreakdown: breakdown
      } as any;
      setScanProgress(100);
      setUser(stats);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(stats));
    } catch (e) { 
        console.error(e); 
        alert("Audit failed. Please check your handle and try again.");
    } finally { 
        setIsScanning(false); 
    }
  };

  const handleFullClaimProcess = async () => {
    if (isGenerating || isMinting || isMinted) return;
    setIsGenerating(true);
    try {
      const currentTier = getTierFromPoints(user!.points);
      const finalImage = await geminiService.generateBadgePreview(currentTier, user!.twitterHandle);
      if (!finalImage) throw new Error("AI Visual Generation failed.");
      setBadgeImage(finalImage);
      setIsGenerating(false);
      setIsMinting(true);
      
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Wallet not connected.");
      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      const tierIndex = tierMap[currentTier] ?? 3;

      const mintTx = await contract.methods.mintBadge(finalImage, tierIndex).send({ from: address });
      setTxHash(mintTx.transactionHash);
      setIsMinted(true);
      setShowCastPrompt(true);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Action failed. Check your Base ETH balance.");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  if (!isReady) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-blue-500 font-black uppercase italic tracking-widest text-[10px]">SYNCING IDENTITY...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-600/30 pb-20">
        <nav className="border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-50 px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Zap size={20} fill="white" />
              </div>
              <h1 className="text-xl font-black uppercase italic tracking-tighter">BASE IMPRESSION</h1>
            </div>
            {address && (
               <div className="flex items-center gap-3 bg-white/5 pl-4 pr-2 py-1.5 rounded-full border border-white/10">
                 <span className="text-[10px] font-mono text-blue-400">{address.slice(0, 6)}...{address.slice(-4)}</span>
                 <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"><LogOut size={16} /></button>
               </div>
            )}
        </nav>

        <main className="max-w-xl mx-auto px-6 py-10">
          {!user ? (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="text-center space-y-4">
                 <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-[0.9] text-white">YOUR IMPACT <br/><span className="text-blue-600">ONCHAIN.</span></h2>
                 <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.4em]">Audit. Verify. Mint.</p>
               </div>
               
               <div className="grid gap-4">
                  <div className={`p-8 rounded-[2.5rem] border flex items-center justify-between transition-all ${isSignatureVerified ? 'bg-blue-600/10 border-blue-600/40' : 'bg-white/5 border-white/10'}`}>
                    <div>
                      <p className="text-[10px] font-black uppercase mb-1 tracking-widest text-gray-400">01. Identity</p>
                      <h4 className="font-bold text-sm">{address ? `${address.slice(0,12)}...` : 'Not Connected'}</h4>
                    </div>
                    {isSignatureVerified ? <CheckCircle2 className="text-blue-500" /> : <button onClick={handleManualVerification} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase">Verify</button>}
                  </div>

                  <div className={`p-8 rounded-[2.5rem] border flex items-center justify-between transition-all ${isTwitterVerified ? 'bg-blue-600/10 border-blue-600/40' : 'bg-white/5 border-white/10'}`}>
                    <div>
                      <p className="text-[10px] font-black uppercase mb-1 tracking-widest text-gray-400">02. Social Graph</p>
                      <h4 className="font-bold text-sm">{handle || 'Enter Handle'}</h4>
                    </div>
                    {isTwitterVerified ? (
                      <div className="flex items-center gap-2">
                         <button onClick={handleTwitterFallback} className="p-2 text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
                         <CheckCircle2 className="text-blue-500" />
                      </div>
                    ) : (
                      <button onClick={handleTwitterFallback} className="px-6 py-2 bg-white/10 text-white border border-white/10 rounded-xl text-xs font-black uppercase">Link X</button>
                    )}
                  </div>
               </div>

               {isSignatureVerified && isTwitterVerified ? (
                  <button onClick={startAudit} disabled={isScanning} className="w-full py-7 bg-blue-600 rounded-[2.5rem] font-black uppercase italic text-xl flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-blue-600/30">
                    {isScanning ? <Loader2 className="animate-spin" /> : <Zap fill="white" />} 
                    START AUDIT
                  </button>
               ) : (
                  <p className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest">Connect Identity & Social to Unlock Audit</p>
               )}
            </div>
          ) : (
            <div className="space-y-8 animate-in zoom-in-95 duration-500">
               <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl shadow-inner">
                  {(['dashboard', 'claim'] as const).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>
                  ))}
               </div>

               {activeTab === 'dashboard' ? (
                 <div className="grid gap-6">
                    <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-12 rounded-[3.5rem] text-center border border-blue-500/20 relative overflow-hidden">
                       <p className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">Audited Impact Score</p>
                       <h3 className="text-9xl font-black italic mt-4 tracking-tighter">{user.points.toFixed(0)}</h3>
                       <div className="flex items-center justify-center gap-2 mt-8 py-2 px-4 bg-blue-600/10 rounded-full w-fit mx-auto text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-500/20">
                          <ShieldCheck size={14} /> Verified Rank: {getTierFromPoints(user.points)}
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10">
                          <Twitter size={14} className="text-blue-400 mb-3" />
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">X Impact</p>
                          <p className="text-3xl font-black italic">+{user.pointsBreakdown?.social_twitter.toFixed(0)}</p>
                       </div>
                       <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10">
                          <Coins size={14} className="text-yellow-500 mb-3" />
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Asset Score</p>
                          <p className="text-3xl font-black italic">+{user.pointsBreakdown?.lambo.toFixed(0)}</p>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-12 text-center">
                    <BadgeDisplay tier={getTierFromPoints(user.points)} imageUrl={badgeImage} loading={isGenerating} />
                    
                    <div className="max-w-sm mx-auto space-y-6">
                       {isMinted ? (
                         <div className="bg-green-500/10 text-green-400 p-8 rounded-[2.5rem] border border-green-500/20 flex flex-col items-center gap-3">
                           <Trophy size={32} />
                           <span className="font-black uppercase italic text-sm tracking-widest">Impact Secured</span>
                           {txHash && <a href={`https://basescan.org/tx/${txHash}`} target="_blank" className="text-blue-400 underline text-[10px] font-mono">View on BaseScan</a>}
                         </div>
                       ) : (
                         <button 
                           onClick={handleFullClaimProcess}
                           disabled={isGenerating || isMinting || getTierFromPoints(user.points) === RankTier.NONE}
                           className={`w-full py-7 rounded-[2.5rem] font-black uppercase italic text-lg flex items-center justify-center gap-3 transition-all ${!isGenerating && !isMinting ? 'bg-blue-600 hover:bg-blue-500 shadow-xl' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                         >
                           {isGenerating || isMinting ? <Loader2 className="animate-spin" /> : <Zap fill="white" />}
                           {isGenerating ? 'FORGING...' : isMinting ? 'MINTING...' : `MINT ${getTierFromPoints(user.points)} BADGE`}
                         </button>
                       )}
                       <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic flex items-center justify-center gap-2">
                          <Info size={12} /> Network gas fees apply on Base
                       </p>
                    </div>
                 </div>
               )}
            </div>
          )}
        </main>

        {showCastPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-300">
             <div className="w-full max-w-md bg-[#0a0a0a] border border-blue-500/30 rounded-[3.5rem] p-12 text-center space-y-8">
                <Sparkles className="text-blue-500 w-16 h-16 mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-4xl font-black uppercase italic tracking-tighter">SUCCESS</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Badge Secured on Base Mainnet.</p>
                </div>
                <button onClick={() => sdk.actions.cast({ text: `Just minted my Base Impression Badge with ${user?.points.toFixed(0)} points! 🏎️💨 Audit your impact at real-base-2026.vercel.app` })} className="w-full py-6 bg-white text-black rounded-[2rem] font-black uppercase italic text-xs shadow-xl active:scale-95 transition-transform">Share Achievement</button>
                <button onClick={() => setShowCastPrompt(false)} className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em]">Dismiss</button>
             </div>
          </div>
        )}
        
        {isScanning && (
          <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center p-6 bg-black backdrop-blur-2xl">
             <div className="w-64 h-64 relative flex items-center justify-center">
                <div className="absolute inset-0 border-8 border-blue-600/10 rounded-full" />
                <div className="absolute inset-0 border-8 border-blue-600 rounded-full border-t-transparent animate-spin" />
                <p className="text-5xl font-black italic tracking-tighter">{scanProgress}%</p>
             </div>
             <div className="mt-16 text-center space-y-6">
                <h3 className="text-4xl font-black uppercase italic tracking-tighter">AUDITING IMPACT</h3>
                <div className="flex items-center gap-3 text-blue-500 animate-pulse">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  <p className="text-xs font-bold uppercase tracking-[0.3em]">Analyzing Social & On-Chain Graphs</p>
                </div>
             </div>
          </div>
        )}
    </div>
  );
};

export default App;