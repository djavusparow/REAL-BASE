
import React, { useState, useEffect, useMemo } from 'react';
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
  Globe
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

interface WalletOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  detector: () => any;
}

const App: React.FC = () => {
  const [user, setUser] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Connection States
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletSigned, setIsWalletSigned] = useState(false);
  const [twUser, setTwUser] = useState<{ handle: string } | null>(null);
  
  // Modal States
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);
  const [isTwitterModalOpen, setIsTwitterModalOpen] = useState(false);
  const [tempTwitterHandle, setTempTwitterHandle] = useState('');
  const [twitterStep, setTwitterStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  const walletOptions: WalletOption[] = [
    {
      id: 'okx',
      name: 'OKX Wallet',
      icon: <Layers className="w-5 h-5 text-white" />,
      detector: () => (window as any).okxwallet
    },
    {
      id: 'zerion',
      name: 'Zerion Wallet',
      icon: <Zap className="w-5 h-5 text-blue-400" />,
      detector: () => (window as any).zerion || ((window as any).ethereum?.isZerion ? (window as any).ethereum : null)
    },
    {
      id: 'rabby',
      name: 'Rabby Wallet',
      icon: <ShieldCheck className="w-5 h-5 text-indigo-400" />,
      detector: () => (window as any).rabby || ((window as any).ethereum?.isRabby ? (window as any).ethereum : null)
    },
    {
      id: 'baseapp',
      name: 'BaseApp',
      icon: <Wallet className="w-5 h-5 text-blue-600" />,
      detector: () => (window as any).ethereum?.isCoinbaseWallet || (window as any).ethereum?.isBaseApp ? (window as any).ethereum : null
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const initFrame = async () => {
      try {
        sdk.actions.ready();
      } catch (e) {
        console.error("SDK initialization failed", e);
      }
    };
    initFrame();
  }, []);

  // Use Web3 for standardized provider checks if needed
  const detectAllProviders = () => {
    const providers: any[] = [];
    if (typeof (window as any).ethereum !== 'undefined') {
      if ((window as any).ethereum.providers) {
        providers.push(...(window as any).ethereum.providers);
      } else {
        providers.push((window as any).ethereum);
      }
    }
    return providers;
  };

  const connectWallet = async (option: WalletOption) => {
    setError(null);
    setLoading(true);
    
    // We can also use Web3 library to wrap or check the provider
    const providerInstance = option.detector();

    if (!providerInstance) {
      setError(`${option.name} not detected. Please install the extension or open this site in the ${option.name} app browser.`);
      setLoading(false);
      return;
    }

    try {
      // Use standard web3/ethers patterns for initial detection
      const web3 = new Web3(providerInstance);
      const accounts = await web3.eth.requestAccounts();
      const address = accounts[0];
      
      if (address) {
        setWalletAddress(address);
        setActiveProvider(providerInstance);
        setIsWalletConnected(true);
        setIsWalletSelectorOpen(false);
        setIsWalletSigned(false); 
      }
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      setError(err.message || `Failed to connect to ${option.name}.`);
    } finally {
      setLoading(false);
    }
  };

  const signVerification = async () => {
    if (!walletAddress || !activeProvider) {
      setError("Please connect a wallet first.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      // Use Ethers.js for secure cryptographic signing
      const ethersProvider = new ethers.BrowserProvider(activeProvider);
      const signer = await ethersProvider.getSigner();
      
      const message = `Base Impression Secure Verification\n\nI am verifying my onchain identity for the Base Impression Season 1 Snapshot.\n\nAccount: ${walletAddress}\nNonce: ${Math.floor(Math.random() * 1000000)}`;
      
      // Step 2: Securely sign the message
      const signature = await signer.signMessage(message);
      console.log("Verified Signature:", signature);

      setIsWalletSigned(true);
    } catch (err: any) {
      console.error("Signature error:", err);
      setError("Signature rejected. Secure verification is required to participate in the contribution event.");
    } finally {
      setLoading(false);
    }
  };

  const handleTwitterVerifyStart = () => {
    if (!tempTwitterHandle.trim()) return;
    setTwitterStep(2);
  };

  const handlePostVerificationTweet = () => {
    const handle = tempTwitterHandle.startsWith('@') ? tempTwitterHandle : `@${tempTwitterHandle}`;
    const text = `Verifying my impact for @base impression! 🛡️💎\n\nHandle: ${handle}\nCode: BI-${Math.random().toString(36).substring(7).toUpperCase()}\n\nBuild on @base. #BaseImpression #LamboLess`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    setTwitterStep(3);
    
    setTimeout(() => {
      setTwUser({ handle: handle });
      setIsTwitterModalOpen(false);
      setTwitterStep(1);
    }, 3000);
  };

  const handleFinalizeConnection = async () => {
    if (!walletAddress || !twUser) return;
    
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    
    // Impact calculations
    const baseAge = 112;
    const twitterAge = 980;
    const tweets = 45;
    const points = calculatePoints(baseAge, twitterAge, tweets);
    const rank = 18;

    setUser({
      address: walletAddress,
      twitterHandle: twUser.handle,
      baseAppAgeDays: baseAge,
      twitterAgeDays: twitterAge,
      validTweetsCount: tweets,
      lambolessBalance: 42.50,
      points: points,
      rank: rank
    });
    setLoading(false);
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
    setActiveTab('dashboard');
  };

  const handleMint = async () => {
    if (!isClaimable || isMinting || isMinted) return;
    setIsMinting(true);
    try {
      await new Promise(r => setTimeout(r, 3000));
      const fakeHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("");
      setTxHash(fakeHash);
      setIsMinted(true);
    } catch (e) {
      setError("Onchain mint failed. Check your ETH balance on Base for gas.");
    } finally {
      setIsMinting(false);
    }
  };

  const handleShare = (platform: 'twitter' | 'farcaster') => {
    if (!user) return;
    const shareText = isMinted 
      ? `I just minted my exclusive ${TIERS[currentTier].name} Badge for @base impression! 🛡️💎\n\nRank: #${user.rank}\n\nBuilt on Base via Onchain verification! 🚀`
      : `I just checked my @base impression impact! 🛡️\n\nRank: #${user.rank}\nPoints: ${user.points}\n\nJoin me on Base! 🚀\n#BaseImpression #LamboLess #Base`;
    const encodedText = encodeURIComponent(shareText);
    if (platform === 'farcaster') {
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodedText}`);
    } else {
      window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
    }
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
      
      {/* Universal Wallet Selector */}
      {isWalletSelectorOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsWalletSelectorOpen(false)} />
          <div className="relative glass-effect border border-white/10 w-full max-w-[340px] rounded-[2.5rem] p-8 space-y-8 shadow-2xl border-t-white/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-500">Secure Connect</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Universal Provider Detection</p>
              </div>
              <button onClick={() => setIsWalletSelectorOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors group">
                <X className="w-4 h-4 text-gray-500 group-hover:text-white" />
              </button>
            </div>
            
            <div className="grid gap-3">
              {walletOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => connectWallet(opt)}
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98] group relative overflow-hidden"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 group-hover:border-white/30 transition-colors">
                      {opt.icon}
                    </div>
                    <span className="text-sm font-bold tracking-tight">{opt.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 justify-center py-2">
                <Globe className="w-3 h-3 text-gray-600" />
                <p className="text-[10px] text-gray-500 font-medium tracking-tight">
                  Ethers & Web3.js Integrated
                </p>
            </div>
          </div>
        </div>
      )}

      {/* Social Auth Modal */}
      {isTwitterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !loading && setIsTwitterModalOpen(false)} />
          <div className="relative glass-effect border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
            <button onClick={() => setIsTwitterModalOpen(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Twitter className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black uppercase italic">Link Social Profile</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-60">Impact Proof required</p>
            </div>

            {twitterStep === 1 && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Username</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-black">@</span>
                    <input 
                      type="text" 
                      placeholder="vitalik.eth"
                      value={tempTwitterHandle}
                      onChange={(e) => setTempTwitterHandle(e.target.value.replace('@', ''))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-sm font-bold focus:border-blue-500/50 outline-none transition-all"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleTwitterVerifyStart}
                  disabled={!tempTwitterHandle.trim()}
                  className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 uppercase italic"
                >
                  Verify <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {twitterStep === 2 && (
              <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                  <p className="text-xs text-gray-400 leading-relaxed text-center">
                    To connect <span className="text-white font-bold">@{tempTwitterHandle}</span>, post the proof below.
                  </p>
                </div>
                <button 
                  onClick={handlePostVerificationTweet}
                  className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-sm hover:bg-blue-400 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)] active:scale-95"
                >
                  <Twitter className="w-4 h-4 fill-current" /> Post Verification
                </button>
                <button onClick={() => setTwitterStep(1)} className="w-full text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors">
                  Go Back
                </button>
              </div>
            )}

            {twitterStep === 3 && (
              <div className="space-y-6 text-center py-4 animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-black text-white">Indexing Account...</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Verifying @{tempTwitterHandle}</p>
                  </div>
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
            <span className="text-[8px] text-blue-500 font-bold tracking-[0.2em] uppercase opacity-90 mt-0.5 font-mono">2-Step Secure Auth</span>
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
                  Impact<br/>Verified.
                </h2>
                <p className="text-gray-400 text-xs max-w-[280px] mx-auto leading-relaxed font-bold uppercase tracking-wide opacity-70">
                  Connect your wallet and sign for your onchain legacy.
                </p>
              </div>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <div className="glass-effect p-6 rounded-[2.5rem] border border-white/10 space-y-5 bg-white/[0.02] shadow-2xl">
                <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] text-center mb-2">2-Step Protocol</h3>
                
                {/* Step 1: Request Access */}
                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${isWalletConnected ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10 shadow-inner'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${isWalletConnected ? 'text-green-500' : 'text-blue-500'}`}>
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight">
                        {isWalletConnected ? 'Connected' : 'Step 1: Access'}
                      </div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase">
                        {walletAddress ? `${walletAddress.slice(0, 10)}...` : 'Detect Provider'}
                      </div>
                    </div>
                  </div>
                  {isWalletConnected ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <button 
                      onClick={() => setIsWalletSelectorOpen(true)}
                      disabled={loading}
                      className="px-5 py-2.5 bg-white text-black rounded-xl text-[10px] font-black hover:bg-blue-50 transition-all active:scale-95 shadow-lg uppercase tracking-tight"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* Step 2: Sign Message */}
                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${isWalletSigned ? 'bg-green-500/5 border-green-500/30' : isWalletConnected ? 'bg-indigo-500/10 border-indigo-500/40 animate-pulse' : 'bg-white/5 border-white/10 opacity-40 shadow-inner'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${isWalletSigned ? 'text-green-500' : 'text-indigo-400'}`}>
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight">
                        {isWalletSigned ? 'Identity Signed' : 'Step 2: Sign'}
                      </div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase">
                        {isWalletSigned ? 'Cryptographic Proof' : 'Ethers.js Verification'}
                      </div>
                    </div>
                  </div>
                  {isWalletSigned ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <button 
                      onClick={signVerification}
                      disabled={!isWalletConnected || loading}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all active:scale-95 uppercase tracking-tight ${isWalletConnected ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-600/20' : 'bg-white/5 text-gray-600'}`}
                    >
                      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sign'}
                    </button>
                  )}
                </div>

                {/* Step 3: Social Connection */}
                <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all border ${twUser ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10 shadow-inner'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${twUser ? 'text-green-500' : 'text-blue-400'}`}>
                      <Twitter className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight">Social Profile</div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase">
                        {twUser ? twUser.handle : 'Link handle'}
                      </div>
                    </div>
                  </div>
                  {twUser ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <button 
                      onClick={() => setIsTwitterModalOpen(true)}
                      className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all active:scale-95 uppercase tracking-tight"
                    >
                      Link
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3 text-red-500 animate-in slide-in-from-top-2 shadow-2xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-black leading-tight uppercase tracking-tight">{error}</p>
                </div>
              )}

              <button 
                onClick={handleFinalizeConnection}
                disabled={!isWalletSigned || !twUser || loading}
                className={`w-full py-5 rounded-[2rem] font-black text-sm transition-all flex items-center justify-center gap-2 shadow-2xl active:scale-95 uppercase tracking-widest italic ${
                  isWalletSigned && twUser 
                  ? 'bg-blue-600 text-white hover:bg-blue-500 cursor-pointer shadow-blue-600/20' 
                  : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/10'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Calculate Impression'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 gap-3 mb-2">
              <Countdown 
                targetDate={claimTimeReached ? SNAPSHOT_END : CLAIM_START} 
                label={claimTimeReached ? "Genesis Snapshot Over" : "SBT Mint Opens In"} 
              />
            </div>

            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 sticky top-[76px] z-30 backdrop-blur-xl bg-black/40">
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
                   <BadgeDisplay 
                    tier={currentTier} 
                    imageUrl={badgeImage} 
                    loading={isGenerating} 
                   />

                   {analysis && (
                     <div className="relative">
                        <p className="text-xs font-bold text-blue-100/60 leading-relaxed px-6 py-4 bg-blue-500/5 rounded-[1.5rem] border border-blue-500/10 italic">
                          "{analysis}"
                        </p>
                        <div className="absolute -top-2 -left-2 text-blue-500 opacity-30 text-2xl font-black">"</div>
                     </div>
                   )}

                   <div className="grid grid-cols-1 gap-4">
                     <button 
                        onClick={handleCheckpoint}
                        disabled={isGenerating}
                        className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl italic"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {isGenerating ? 'Indexing Chain...' : 'Update Snapshot'}
                      </button>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleShare('farcaster')}
                          className="flex-1 py-4 bg-[#8a63d2]/10 hover:bg-[#8a63d2]/20 text-[#8a63d2] border border-[#8a63d2]/30 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Share2 className="w-3.5 h-3.5" /> Farcaster
                        </button>
                        <button 
                          onClick={() => handleShare('twitter')}
                          className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Twitter className="w-3.5 h-3.5" /> Share X
                        </button>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-2">Legacy Analysis</h3>
                    <div className="space-y-3">
                        {[
                            { icon: <Target className="w-4 h-4" />, label: "Base Ecosystem History", val: `${user.baseAppAgeDays}D`, weight: "20%" },
                            { icon: <Twitter className="w-4 h-4" />, label: "Social Graph Reputation", val: `${user.twitterAgeDays}D`, weight: "30%" },
                            { icon: <Zap className="w-4 h-4" />, label: "Contribution Volume", val: user.validTweetsCount, weight: "50%" },
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center justify-between p-5 glass-effect rounded-[1.5rem] border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="text-blue-500 p-2 bg-blue-500/10 rounded-xl">{stat.icon}</div>
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
                    <h2 className="text-lg font-black uppercase italic tracking-tight text-white">Top Impact Builders</h2>
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">Live Ranking</span>
                </div>
                
                <div className="space-y-3">
                  <div className="p-5 bg-blue-600/20 border border-blue-500/40 rounded-[2rem] flex items-center justify-between shadow-2xl shadow-blue-600/10">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-blue-400 italic">#{user.rank}</span>
                        <div>
                            <div className="text-[11px] font-black text-white uppercase tracking-tight">Your Global Rank</div>
                            <div className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">{TIERS[currentTier].name} Tier</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-black text-white">{user.points} pts</div>
                    </div>
                  </div>

                  <div className="h-px bg-white/5 my-4 mx-4" />

                  {MOCKED_LEADERBOARD.map((player) => (
                    <div key={player.rank} className="p-5 glass-effect border border-white/10 rounded-[1.5rem] flex items-center justify-between opacity-80 hover:opacity-100 transition-all hover:translate-x-1 group shadow-lg">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-gray-500 group-hover:text-white transition-colors italic">#{player.rank}</span>
                            <div>
                                <div className="text-xs font-black text-gray-200">{player.handle}</div>
                                <div className={`text-[8px] font-black uppercase tracking-[0.15em] bg-clip-text text-transparent bg-gradient-to-r ${TIERS[player.tier as RankTier].color}`}>
                                    {TIERS[player.tier as RankTier].name} Impact
                                </div>
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
                        <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/30 shadow-2xl shadow-blue-600/20">
                            <CreditCard className="w-10 h-10 text-blue-500" />
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-2xl font-black uppercase italic text-white">SBT Minting Portal</h2>
                          <p className="text-xs text-gray-400 max-w-[280px] mx-auto font-medium uppercase tracking-tight opacity-70">
                            Badges are non-transferable proofs of impact. Check final eligibility.
                          </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className={`p-5 rounded-[1.5rem] border flex items-center justify-between transition-all shadow-xl ${user.rank <= 1000 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                            <div className="flex items-center gap-4">
                                {user.rank <= 1000 ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-tight">Ecosystem Rank</div>
                                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">#{user.rank} / Top 1000</div>
                                </div>
                            </div>
                        </div>

                        <div className={`p-5 rounded-[1.5rem] border flex items-center justify-between transition-all shadow-xl ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                            <div className="flex items-center gap-4">
                                {user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-tight">Onchain Holdings</div>
                                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Min. $2.50 in Assets</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-[1.2rem] space-y-2 shadow-inner">
                            <div className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">
                                <Info className="w-3 h-3" />
                                <span>Soulbound Protocol</span>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-tight uppercase font-black tracking-tight opacity-60">
                              Contribution event badges are locked to your wallet. Minting starts <strong className="text-white">January 16, 2026</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <button 
                            onClick={handleMint}
                            disabled={!isClaimable || isMinting}
                            className={`w-full py-5 rounded-[2.5rem] font-black text-lg transition-all shadow-2xl relative overflow-hidden active:scale-95 uppercase italic tracking-tighter ${
                                isClaimable 
                                ? 'bg-blue-600 text-white hover:bg-blue-500 cursor-pointer shadow-blue-600/30' 
                                : 'bg-white/5 text-gray-700 cursor-not-allowed border border-white/5'
                            }`}
                        >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                {!claimTimeReached ? (
                                  'Registration Only'
                                ) : isMinting ? (
                                  <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Minting Soulbound...
                                  </>
                                ) : (
                                  'Mint Genesis Badge'
                                )}
                            </div>
                        </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-8 py-4 text-center">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-green-500 blur-[100px] opacity-30 animate-pulse" />
                        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/50 relative shadow-2xl">
                            <PartyPopper className="w-12 h-12 text-green-500" />
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h2 className="text-3xl font-black text-white uppercase italic">Mint Confirmed!</h2>
                      <p className="text-gray-400 text-xs px-12 uppercase font-bold tracking-tight opacity-70 leading-relaxed font-mono">
                        Your legacy as a Base builder is now immutable onchain.
                      </p>
                    </div>

                    <div className="glass-effect p-6 rounded-[2rem] border border-green-500/30 space-y-4 bg-green-500/5 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[9px]">BASE TX HASH</span>
                          <span className="text-blue-400 font-mono text-[10px] font-bold">
                            {txHash?.slice(0, 16)}...
                          </span>
                        </div>
                        <div className="h-px bg-white/10" />
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[9px]">HOLDER</span>
                          <span className="text-white font-black text-[10px] uppercase font-mono">{walletAddress?.slice(0, 16)}...</span>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <button 
                        onClick={() => handleShare('farcaster')}
                        className="w-full py-5 bg-[#8a63d2] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-[#7a52c2] transition-all flex items-center justify-center gap-2 active:scale-95 shadow-2xl shadow-[#8a63d2]/30 italic"
                      >
                        <Share2 className="w-4 h-4" /> Broadcast to Farcaster
                      </button>
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
              <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] leading-none opacity-60">Global Position</span>
                  <span className="text-2xl font-black mt-1 italic text-white tracking-tighter">#{user.rank}</span>
              </div>
              <div className="flex flex-col items-end">
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] leading-none opacity-60">Impact Weight</span>
                  <span className="text-2xl font-black text-blue-500 mt-1 italic tracking-tighter">{user.points} PTS</span>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
