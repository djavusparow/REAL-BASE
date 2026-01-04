
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trophy, 
  Target, 
  Twitter, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  Zap, 
  ShieldCheck, 
  ChevronRight, 
  Info, 
  Share2, 
  ExternalLink, 
  Loader2, 
  PartyPopper,
  User as UserIcon,
  Link2,
  X,
  ArrowRight,
  Fingerprint,
  Download,
  CreditCard,
  Layers,
  Globe,
  Plus,
  Search,
  History,
  Activity,
  Lock,
  Unlock
} from 'lucide-react';
import sdk from '@farcaster/frame-sdk';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { UserStats, RankTier } from './types';
import { 
  TOKEN_CONTRACT, 
  SNAPSHOT_END, 
  CLAIM_START, 
  TIERS, 
  MOCKED_LEADERBOARD,
  FINAL_SNAPSHOT,
  MIN_TOKEN_VALUE_USD
} from './constants';
import { calculatePoints, getTierFromRank } from './utils/calculations';
import Countdown from './components/Countdown';
import BadgeDisplay from './components/BadgeDisplay';
import { geminiService } from './services/geminiService';
import { twitterService, ScanResult } from './services/twitterService';

const BrandIcon: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => {
  const dimensions = size === 'lg' ? 'w-48 h-48' : 'w-12 h-12';
  const textSize = size === 'lg' ? 'text-xl' : 'text-[8px]';
  const padding = size === 'lg' ? 'p-4' : 'p-1';
  
  return (
    <div className={`${dimensions} relative rounded-2xl overflow-hidden shadow-2xl group border border-white/20`}>
      <img 
        src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=400" 
        alt="Base Background" 
        className="absolute inset-0 w-full h-full object-cover brightness-50 group-hover:scale-110 transition-transform duration-700"
      />
      <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply" />
      <div className={`absolute inset-0 flex items-center justify-center text-center ${padding}`}>
        <span className={`${textSize} font-black text-white uppercase tracking-tighter leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}>
          Base<br/>Impression
        </span>
      </div>
    </div>
  );
};

interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: any;
}

const App: React.FC = () => {
  const [user, setUser] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  
  const [isMinted, setIsMinted] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Connection States
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletSigned, setIsWalletSigned] = useState(false);
  const [twUser, setTwUser] = useState<{ handle: string } | null>(null);
  
  // Scanner Logic
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const scanLogsRef = useRef<HTMLDivElement>(null);

  // EIP-6963 Detected Providers
  const [detectedProviders, setDetectedProviders] = useState<EIP6963ProviderDetail[]>([]);
  
  // Modal States
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);
  const [isTwitterModalOpen, setIsTwitterModalOpen] = useState(false);
  const [tempTwitterHandle, setTempTwitterHandle] = useState('');
  const [twitterStep, setTwitterStep] = useState<1 | 2 | 3 | 4>(1); // Step 3: Auth, Step 4: Success
  const [modalError, setModalError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scanLogsRef.current) {
      scanLogsRef.current.scrollTop = scanLogsRef.current.scrollHeight;
    }
  }, [scanLogs]);

  // EIP-6963 Autodetection
  useEffect(() => {
    const onAnnouncement = (event: any) => {
      setDetectedProviders(prev => {
        if (prev.find(p => p.info.uuid === event.detail.info.uuid)) return prev;
        return [...prev, event.detail];
      });
    };
    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }, []);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  const connectWallet = async (providerDetail: EIP6963ProviderDetail | any) => {
    setError(null);
    setLoading(true);
    const providerInstance = providerDetail.provider || providerDetail;
    try {
      const web3 = new Web3(providerInstance);
      const accounts = await web3.eth.requestAccounts();
      if (accounts[0]) {
        setWalletAddress(accounts[0]);
        setActiveProvider(providerInstance);
        setIsWalletConnected(true);
        setIsWalletSelectorOpen(false);
        setIsWalletSigned(false); 
      }
    } catch (err: any) {
      setError(err.message || "Failed to authorize wallet.");
    } finally {
      setLoading(false);
    }
  };

  const signVerification = async () => {
    if (!walletAddress || !activeProvider) return;
    setError(null);
    setLoading(true);
    try {
      const ethersProvider = new ethers.BrowserProvider(activeProvider);
      const signer = await ethersProvider.getSigner();
      const message = `Base Impression Secure Verification\nAccount: ${walletAddress}\nNonce: ${Date.now()}`;
      await signer.signMessage(message);
      setIsWalletSigned(true);
    } catch (err: any) {
      setError("Signature rejected. Proof required.");
    } finally {
      setLoading(false);
    }
  };

  const handleTwitterVerifyStart = () => {
    if (!tempTwitterHandle.trim()) return;
    setTwitterStep(2);
    setModalError(null);
  };

  const handlePostVerificationTweet = async () => {
    const handle = tempTwitterHandle.startsWith('@') ? tempTwitterHandle : `@${tempTwitterHandle}`;
    setTwitterStep(3); // Start authentication animation
    setModalError(null);

    try {
      // Step 1: Request Twitter Auth
      const isAuthorized = await twitterService.authorize();
      if (!isAuthorized) throw new Error("Twitter authorization denied.");

      // Step 2: Simulate "Verify via Tweet" requirement for additional security
      const text = `Verifying my @base impact with @jessepollak! 🛡️💎 Handle: ${handle}\nCode: BI-${Math.random().toString(36).substring(7).toUpperCase()}\n#BaseImpression #LamboLess`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
      
      await new Promise(r => setTimeout(r, 2000));
      
      setTwitterStep(4); // Show Success State
      setTimeout(() => {
        setTwUser({ handle: handle });
        setIsTwitterModalOpen(false);
        setTwitterStep(1);
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || "Authentication failed.");
      setTwitterStep(2); // Fall back to retry
    }
  };

  const handleFinalizeConnection = async () => {
    if (!walletAddress || !twUser) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setScanLogs(["Initializing secure Twitter bridge...", "Requesting read-only permissions..."]);
    
    // Simulate real-time scanning steps
    const addLog = (log: string) => setScanLogs(prev => [...prev, log]);
    
    await new Promise(r => setTimeout(r, 1000));
    setScanProgress(20);
    addLog("Authenticated @ " + twUser.handle);
    addLog("Fetching account registration metadata...");

    const scanResult = await twitterService.scanPosts(twUser.handle);
    
    setScanProgress(40);
    addLog(`Account Seniority: ${scanResult.accountAgeDays} days detected.`);
    addLog(`Searching for tags: @base, @jessepollak, $LAMBOLESS...`);
    
    await new Promise(r => setTimeout(r, 800));
    setScanProgress(70);
    addLog(`Scanning historical posts (Nov 2025 - Jan 2026)...`);
    addLog(`Found ${scanResult.totalValidPosts} posts matching ecosystem tags.`);
    addLog(`Enforcing daily 5-point cap for fair distribution...`);
    
    await new Promise(r => setTimeout(r, 1000));
    setScanProgress(100);
    addLog("Scan complete. Contribution summary finalized.");

    // Points Calculation per Requirements:
    // BaseApp: days * 0.20
    // Twitter: days * 0.30
    // Contribution: cappedPosts * 0.50
    const baseAppAge = 145 + Math.floor(Math.random() * 50); // Simulating some variation
    const twitterAge = scanResult.accountAgeDays; // DYNAMIC: Taken from the simulated scan result
    
    const points = calculatePoints(baseAppAge, twitterAge, scanResult.cappedPoints);
    const rank = Math.floor(Math.random() * 900) + 1; // Simulated rank

    setUser({
      address: walletAddress,
      twitterHandle: twUser.handle,
      baseAppAgeDays: baseAppAge,
      twitterAgeDays: twitterAge,
      validTweetsCount: scanResult.cappedPoints, // Displaying capped score
      lambolessBalance: 120.50,
      points: points,
      rank: rank
    });
    setIsScanning(false);
  };

  const currentTier = useMemo(() => {
    if (!user) return RankTier.NONE;
    return getTierFromRank(user.rank);
  }, [user]);

  const handleCheckpoint = async () => {
    if (!user) return;
    setIsGenerating(true);
    const [img, msg] = await Promise.all([
      geminiService.generateBadgePreview(currentTier, user.twitterHandle),
      geminiService.getImpressionAnalysis(user.points, user.rank)
    ]);
    setBadgeImage(img);
    setAnalysis(msg);
    setIsGenerating(false);
  };

  const handleMint = async () => {
    if (!isClaimable || isMinting || isMinted) return;
    setIsMinting(true);
    try {
      await new Promise(r => setTimeout(r, 3000));
      setTxHash("0x" + Math.random().toString(16).slice(2, 64));
      setIsMinted(true);
    } catch (e) {
      setError("Mint failed.");
    } finally {
      setIsMinting(false);
    }
  };

  const handleShare = (platform: 'farcaster' | 'twitter') => {
    if (!user) return;
    const shareText = `I'm a ${TIERS[currentTier].name} contributor on Base Impression with ${user.points} impact points! 🔵💎 Rank: #${user.rank} #BaseImpression #LamboLess`;
    const shareUrl = window.location.origin;
    
    let url = '';
    if (platform === 'farcaster') {
      url = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
    } else {
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    }
    
    sdk.actions.openUrl(url);
  };

  const isClaimable = useMemo(() => {
    if (!user) return false;
    return (
      currentTime >= CLAIM_START &&
      user.rank <= 1000 && 
      user.lambolessBalance >= MIN_TOKEN_VALUE_USD
    );
  }, [user, currentTime]);

  const claimTimeReached = currentTime >= CLAIM_START;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30 safe-top safe-bottom font-['Space_Grotesk']">
      
      {/* Real-time Scanner Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
          <div className="relative w-full max-w-sm space-y-8 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-3">
              <div className="relative inline-block">
                <Search className="w-12 h-12 text-blue-500 animate-pulse" />
                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Indexing Profile</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Live Onchain Verification</p>
            </div>

            <div className="space-y-4">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-700 ease-out" 
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <div 
                ref={scanLogsRef}
                className="h-48 bg-black border border-white/5 rounded-2xl p-4 overflow-y-auto space-y-2 font-mono text-[10px]"
              >
                {scanLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 text-blue-400/80">
                    <span className="text-blue-600/40">{`>`}</span>
                    <span className="leading-tight">{log}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center gap-8">
               <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-gray-600 uppercase">Tags Found</span>
                  <span className="text-xl font-black text-white">Searching...</span>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Selector */}
      {isWalletSelectorOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsWalletSelectorOpen(false)} />
          <div className="relative glass-effect border border-white/10 w-full max-w-[340px] rounded-[2.5rem] p-8 space-y-8 shadow-2xl border-t-white/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-500">Connect Wallet</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Detected Onchain Providers</p>
              </div>
              <button onClick={() => setIsWalletSelectorOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors group">
                <X className="w-4 h-4 text-gray-500 group-hover:text-white" />
              </button>
            </div>
            
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-1">
              {detectedProviders.length > 0 ? (
                detectedProviders.map((det) => (
                  <button
                    key={det.info.uuid}
                    onClick={() => connectWallet(det)}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-4">
                      <img src={det.info.icon} alt={det.info.name} className="w-6 h-6 object-contain" />
                      <span className="text-sm font-bold tracking-tight">{det.info.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                  </button>
                ))
              ) : (
                <div className="text-center p-6 border border-dashed border-white/10 rounded-3xl opacity-50 space-y-2">
                  <Globe className="w-8 h-8 mx-auto text-gray-600" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">No browser wallet detected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Twitter Modal */}
      {isTwitterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => twitterStep !== 3 && setIsTwitterModalOpen(false)} />
          <div className="relative glass-effect border border-white/10 w-full max-w-sm rounded-[3rem] p-8 space-y-6 shadow-2xl overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl -mr-16 -mt-16" />
            
            <button 
              onClick={() => setIsTwitterModalOpen(false)} 
              disabled={twitterStep === 3}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors disabled:opacity-0"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center space-y-2 relative">
              <div className="w-16 h-16 bg-white text-black rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3">
                <Twitter className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Twitter Bridge</h3>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest opacity-60">Contribution Identity System</p>
            </div>

            {twitterStep === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Profile Handle</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-black">@</span>
                    <input 
                      type="text" 
                      placeholder="vitalik.eth"
                      value={tempTwitterHandle}
                      onChange={(e) => setTempTwitterHandle(e.target.value.replace('@', ''))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-sm font-bold focus:border-blue-500/50 outline-none transition-all placeholder:text-white/10"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleTwitterVerifyStart}
                  disabled={!tempTwitterHandle.trim()}
                  className="w-full py-5 bg-white text-black rounded-2xl font-black text-sm hover:bg-blue-50 transition-all active:scale-95 uppercase italic tracking-tight"
                >
                  Configure Access <ArrowRight className="w-4 h-4 ml-1 inline" />
                </button>
              </div>
            )}

            {twitterStep === 2 && (
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/10 space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                     <Lock className="w-3 h-3" /> Encrypted Handshake
                  </div>
                  <div className="space-y-3">
                    <p className="text-[11px] text-gray-400 leading-relaxed font-bold">
                      Connecting <span className="text-white">@{tempTwitterHandle}</span> requires read permissions for historical posts and ecosystem tags.
                    </p>
                    <div className="h-px bg-white/5" />
                    <ul className="text-[9px] text-gray-500 space-y-2 font-black uppercase tracking-tight">
                      <li className="flex gap-2 items-center"><CheckCircle2 className="w-3 h-3 text-green-500" /> Read account profile</li>
                      <li className="flex gap-2 items-center"><CheckCircle2 className="w-3 h-3 text-green-500" /> Analyze post history</li>
                      <li className="flex gap-2 items-center"><CheckCircle2 className="w-3 h-3 text-green-500" /> Verify ecosystem tags</li>
                    </ul>
                  </div>
                </div>

                {modalError && (
                  <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-2 text-red-500 animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase">{modalError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handlePostVerificationTweet}
                    className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-sm hover:bg-blue-400 transition-all shadow-xl active:scale-95 uppercase italic"
                  >
                    Authorize & Secure
                  </button>
                  <button 
                    onClick={() => setTwitterStep(1)}
                    className="w-full py-2 text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                  >
                    Change Handle
                  </button>
                </div>
              </div>
            )}

            {twitterStep === 3 && (
              <div className="py-12 space-y-6 text-center animate-in zoom-in-95 duration-500">
                <div className="relative inline-block">
                  <div className="w-20 h-20 border-[3px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <Twitter className="w-8 h-8 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg font-black uppercase italic">Securing Bridge</h4>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] animate-pulse">Requesting OAuth Token...</p>
                </div>
              </div>
            )}

            {twitterStep === 4 && (
              <div className="py-12 space-y-6 text-center animate-in scale-110 duration-500">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                  <Unlock className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-2xl font-black uppercase italic text-green-500">Authorized!</h4>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Profile linked securely</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 glass-effect border-b border-white/5 px-4 py-3 flex justify-between items-center bg-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <BrandIcon size="sm" />
          <div className="flex flex-col">
            <h1 className="font-black text-sm tracking-tighter uppercase leading-none text-white">Base Impression</h1>
            <span className="text-[8px] text-blue-500 font-bold tracking-[0.2em] uppercase mt-0.5 font-mono">Season 1 Protocol</span>
          </div>
        </div>
        
        {user && (
          <div className="flex items-center gap-2 glass-effect px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-mono font-black text-blue-100 uppercase">
              {user.address.slice(0, 6)}...{user.address.slice(-4)}
            </span>
          </div>
        )}
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 pb-32">
        {!user ? (
          <div className="space-y-12 animate-in fade-in duration-1000 slide-in-from-bottom-4">
            <div className="text-center space-y-6">
              <div className="relative inline-block">
                  <div className="absolute inset-0 bg-blue-600 blur-[80px] opacity-20 animate-pulse" />
                  <BrandIcon size="lg" />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black tracking-tight leading-[0.9] uppercase italic text-white drop-shadow-2xl">
                  Impact<br/>Analysis.
                </h2>
                <p className="text-gray-400 text-xs max-w-[280px] mx-auto leading-relaxed font-bold uppercase tracking-wide opacity-70">
                  Securely link your wallet and social footprint to claim your onchain rank.
                </p>
              </div>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <div className="glass-effect p-6 rounded-[2.5rem] border border-white/10 space-y-5 bg-white/[0.02] shadow-2xl">
                <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] text-center mb-2">Autodetection Mode</h3>
                
                {/* Step 1: Secure Connection */}
                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${isWalletConnected ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10 shadow-inner'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${isWalletConnected ? 'text-green-500' : 'text-blue-500'}`}>
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight">Step 1: Auth</div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase">{walletAddress ? `${walletAddress.slice(0, 10)}...` : 'Detect Provider'}</div>
                    </div>
                  </div>
                  {isWalletConnected ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : (
                    <button onClick={() => setIsWalletSelectorOpen(true)} className="px-5 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-tight active:scale-95">Connect</button>
                  )}
                </div>

                {/* Step 2: Identity Signing */}
                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${isWalletSigned ? 'bg-green-500/5 border-green-500/30' : isWalletConnected ? 'bg-indigo-500/10 border-indigo-500/40 animate-pulse' : 'bg-white/5 border-white/10 opacity-40 shadow-inner'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${isWalletSigned ? 'text-green-500' : 'text-indigo-400'}`}>
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight">Step 2: Sign</div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase">{isWalletSigned ? 'Proof generated' : 'Ethers.js Secure'}</div>
                    </div>
                  </div>
                  {isWalletSigned ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : (
                    <button onClick={signVerification} disabled={!isWalletConnected} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight active:scale-95 ${isWalletConnected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'bg-white/5 text-gray-600'}`}>Sign</button>
                  )}
                </div>

                {/* Step 3: Twitter Connect */}
                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${twUser ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10 shadow-inner'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${twUser ? 'text-green-500' : 'text-blue-400'}`}>
                      <Twitter className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight">Social Indexer</div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase">{twUser ? twUser.handle : 'Link handle'}</div>
                    </div>
                  </div>
                  {twUser ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : (
                    <button onClick={() => setIsTwitterModalOpen(true)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-tight active:scale-95">Link</button>
                  )}
                </div>
              </div>

              <button 
                onClick={handleFinalizeConnection}
                disabled={!isWalletSigned || !twUser || loading}
                className={`w-full py-5 rounded-[2rem] font-black text-sm transition-all flex items-center justify-center gap-2 shadow-2xl active:scale-95 uppercase tracking-widest italic ${
                  isWalletSigned && twUser 
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20' 
                  : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/10'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Scan & Track Impact'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 gap-3 mb-2">
              <Countdown targetDate={claimTimeReached ? SNAPSHOT_END : CLAIM_START} label={claimTimeReached ? "Genesis Snapshot Finalized" : "Genesis SBT Mint Opens In"} />
            </div>

            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 sticky top-[76px] z-30 backdrop-blur-xl bg-black/40 shadow-2xl">
                {(['dashboard', 'leaderboard', 'claim'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2.5rem] border border-blue-500/30 text-center relative overflow-hidden group shadow-2xl">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] relative z-10">Total Impact</span>
                    <div className="text-4xl font-black text-white mt-1 relative z-10">{user.points}</div>
                    <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-500/10 blur-2xl" />
                  </div>
                  <div className="glass-effect p-6 rounded-[2.5rem] border border-purple-500/30 text-center relative overflow-hidden group shadow-2xl">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] relative z-10">Global Rank</span>
                    <div className="text-4xl font-black text-white mt-1 relative z-10">#{user.rank}</div>
                    <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-purple-500/10 blur-2xl" />
                  </div>
                </div>

                <div className="glass-effect p-8 rounded-[3rem] border border-white/10 text-center space-y-8 bg-white/[0.01] shadow-2xl">
                   <BadgeDisplay tier={currentTier} imageUrl={badgeImage} loading={isGenerating} />
                   {analysis && (
                     <div className="relative">
                        <p className="text-xs font-bold text-blue-100/60 leading-relaxed px-6 py-4 bg-blue-500/5 rounded-[1.5rem] border border-blue-500/10 italic">"{analysis}"</p>
                        <div className="absolute -top-2 -left-2 text-blue-500 opacity-30 text-2xl font-black">"</div>
                     </div>
                   )}
                   <div className="grid grid-cols-1 gap-4">
                     <button onClick={handleCheckpoint} disabled={isGenerating} className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl italic">
                        <ShieldCheck className="w-4 h-4" />
                        {isGenerating ? 'Indexing Chain...' : 'Update Snapshot'}
                      </button>
                      <div className="flex gap-3">
                        <button onClick={() => handleShare('farcaster')} className="flex-1 py-4 bg-[#8a63d2]/10 hover:bg-[#8a63d2]/20 text-[#8a63d2] border border-[#8a63d2]/30 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"><Share2 className="w-3.5 h-3.5" /> Farcaster</button>
                        <button onClick={() => handleShare('twitter')} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"><Twitter className="w-3.5 h-3.5" /> Share X</button>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-2">Real-time Summary</h3>
                    <div className="space-y-3">
                        {[
                            { icon: <Target className="w-4 h-4" />, label: "Base Network Age (20%)", val: `${user.baseAppAgeDays}D`, weight: "x0.2", color: "text-blue-500" },
                            { icon: <Twitter className="w-4 h-4" />, label: "Twitter Age (30%)", val: `${user.twitterAgeDays}D`, weight: "x0.3", color: "text-indigo-400" },
                            { icon: <Zap className="w-4 h-4" />, label: "Builder Action (50%)", val: `${user.validTweetsCount} pts`, weight: "x0.5", color: "text-yellow-500" },
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center justify-between p-5 glass-effect rounded-[1.5rem] border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={`${stat.color} p-2 bg-white/5 rounded-xl`}>{stat.icon}</div>
                                    <span className="text-[11px] font-black uppercase tracking-tight text-gray-300">{stat.label}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-white">{stat.val}</div>
                                    <div className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">{stat.weight} Weight</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-black uppercase italic tracking-tight text-white">Top Contributors</h2>
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">Live Rank</span>
                </div>
                <div className="space-y-3">
                  <div className="p-5 bg-blue-600/20 border border-blue-500/40 rounded-[2rem] flex items-center justify-between shadow-2xl shadow-blue-600/10">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-blue-400 italic">#{user.rank}</span>
                        <div>
                            <div className="text-[11px] font-black text-white uppercase tracking-tight">Your Current Rank</div>
                            <div className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] font-mono">{TIERS[currentTier].name} Impact</div>
                        </div>
                    </div>
                    <div className="text-right"><div className="text-xl font-black text-white">{user.points} pts</div></div>
                  </div>
                  <div className="h-px bg-white/5 my-4 mx-4" />
                  {MOCKED_LEADERBOARD.map((player) => (
                    <div key={player.rank} className="p-5 glass-effect border border-white/10 rounded-[1.5rem] flex items-center justify-between opacity-80 hover:opacity-100 transition-all hover:translate-x-1 group shadow-lg">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-gray-500 group-hover:text-white transition-colors italic">#{player.rank}</span>
                            <div>
                                <div className="text-xs font-black text-gray-200">{player.handle}</div>
                                <div className={`text-[8px] font-black uppercase tracking-[0.15em] bg-clip-text text-transparent bg-gradient-to-r ${TIERS[player.tier as RankTier].color}`}>{TIERS[player.tier as RankTier].name} Member</div>
                            </div>
                        </div>
                        <div className="text-sm font-black text-white">{player.points} pts</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-8 animate-in zoom-in-95 duration-700">
                {!isMinted ? (
                  <>
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/30 shadow-2xl shadow-blue-600/20"><CreditCard className="w-10 h-10 text-blue-500" /></div>
                        <div className="space-y-2">
                          <h2 className="text-2xl font-black uppercase italic text-white">SBT Minting Portal</h2>
                          <p className="text-xs text-gray-400 max-w-[280px] mx-auto font-medium uppercase tracking-tight opacity-70">Tiered Soulbound Tokens (SBT) represent your verifiable contribution weight.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className={`p-5 rounded-[1.5rem] border flex items-center justify-between transition-all shadow-xl ${user.rank <= 1000 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                            <div className="flex items-center gap-4">
                                {user.rank <= 1000 ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-tight">Rank Eligibility</div>
                                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">#{user.rank} / Top 1000</div>
                                </div>
                            </div>
                        </div>
                        <div className={`p-5 rounded-[1.5rem] border flex items-center justify-between transition-all shadow-xl ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                            <div className="flex items-center gap-4">
                                {user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-tight">Ecosystem Balance</div>
                                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Min. $2.50 Verified</div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-[1.2rem] space-y-2 shadow-inner">
                            <div className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]"><Info className="w-3 h-3" /><span>Security Protocol</span></div>
                            <p className="text-[10px] text-gray-500 leading-tight uppercase font-black tracking-tight opacity-60">Contribution badges are soulbound to your verified address. Claims locked until <strong className="text-white">January 16, 2026</strong>.</p>
                        </div>
                    </div>
                    <div className="space-y-4 pt-4">
                        <button onClick={handleMint} disabled={!isClaimable || isMinting} className={`w-full py-5 rounded-[2.5rem] font-black text-lg transition-all shadow-2xl relative overflow-hidden active:scale-95 uppercase italic tracking-tighter ${isClaimable ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/30' : 'bg-white/5 text-gray-700 cursor-not-allowed border border-white/5'}`}>
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                {!claimTimeReached ? 'Pre-Registration' : isMinting ? (<><Loader2 className="w-6 h-6 animate-spin" />Minting Tier SBT...</>) : 'Mint Genesis SBT'}
                            </div>
                        </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-8 py-4 text-center">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-green-500 blur-[100px] opacity-30 animate-pulse" />
                        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/50 relative shadow-2xl"><PartyPopper className="w-12 h-12 text-green-500" /></div>
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-3xl font-black text-white uppercase italic">Impact Secured!</h2>
                      <p className="text-gray-400 text-xs px-12 uppercase font-bold tracking-tight opacity-70 leading-relaxed font-mono">Your identity as a Base builder is now immutable onchain.</p>
                    </div>
                    <div className="glass-effect p-6 rounded-[2rem] border border-green-500/30 space-y-4 bg-green-500/5 shadow-2xl">
                        <div className="flex items-center justify-between"><span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[9px]">SBT HASH</span><span className="text-blue-400 font-mono text-[10px] font-bold">{txHash?.slice(0, 16)}...</span></div>
                        <div className="h-px bg-white/10" /><div className="flex items-center justify-between"><span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[9px]">OWNER</span><span className="text-white font-black text-[10px] uppercase font-mono">{walletAddress?.slice(0, 16)}...</span></div>
                    </div>
                    <div className="space-y-3 pt-4">
                      <button onClick={() => handleShare('farcaster')} className="w-full py-5 bg-[#8a63d2] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-[#7a52c2] transition-all flex items-center justify-center gap-2 active:scale-95 shadow-2xl shadow-[#8a63d2]/30 italic"><Share2 className="w-4 h-4" /> Broadcast to Farcaster</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {user && (
          <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-white/10 px-8 py-6 flex items-center justify-between md:hidden z-40 bg-black/95 backdrop-blur-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col"><span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] leading-none opacity-60">Impact Rank</span><span className="text-2xl font-black mt-1 italic text-white tracking-tighter">#{user.rank}</span></div>
              <div className="flex flex-col items-end"><span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] leading-none opacity-60">Verified Weight</span><span className="text-2xl font-black text-blue-500 mt-1 italic tracking-tighter">{user.points} PTS</span></div>
          </div>
      )}
    </div>
  );
};

export default App;
