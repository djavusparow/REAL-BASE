import { ethers } from 'ethers';

const MINIMAL_ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Menggunakan beberapa public RPC Base sebagai redundansi
const RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base-mainnet.public.blastapi.io"
];

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens/";

export class TokenService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URLS[0]);
  }

  /**
   * Mengambil saldo token dengan penanganan error yang lebih kuat.
   */
  async getBalance(walletAddress: string, tokenContractAddress: string): Promise<number> {
    try {
      if (!walletAddress || !tokenContractAddress) return 0;

      // Normalisasi alamat menggunakan checksum (ethers v6)
      const normalizedWallet = ethers.getAddress(walletAddress);
      const normalizedToken = ethers.getAddress(tokenContractAddress);
      
      const contract = new ethers.Contract(normalizedToken, MINIMAL_ERC20_ABI, this.provider);
      
      // Mengambil balance dan decimals secara paralel dengan catch individual
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(normalizedWallet).catch((err) => {
          console.error(`[TokenService] Balance fetch failed for ${tokenContractAddress}:`, err);
          return BigInt(0);
        }),
        contract.decimals().catch((err) => {
          console.warn(`[TokenService] Decimals fetch failed for ${tokenContractAddress}, defaulting to 18:`, err.message);
          return 18;
        })
      ]);
      
      const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
      
      if (formattedBalance > 0) {
        console.log(`[TokenService] Success! Balance for ${tokenContractAddress}: ${formattedBalance}`);
      }

      return formattedBalance;
    } catch (error) {
      console.error(`[TokenService] Critical Error reading ${tokenContractAddress}:`, error);
      
      // Percobaan ulang dengan provider alternatif jika yang pertama gagal total
      try {
        const altProvider = new ethers.JsonRpcProvider(RPC_URLS[1]);
        const altContract = new ethers.Contract(ethers.getAddress(tokenContractAddress), MINIMAL_ERC20_ABI, altProvider);
        const balance = await altContract.balanceOf(ethers.getAddress(walletAddress));
        return parseFloat(ethers.formatUnits(balance, 18));
      } catch (retryError) {
        return 0;
      }
    }
  }

  /**
   * Mengambil harga real-time dari DexScreener.
   */
  async getTokenPrice(contractAddress: string): Promise<number> {
    try {
      const normalizedAddress = contractAddress.toLowerCase();
      const response = await fetch(`${DEXSCREENER_API}${normalizedAddress}`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) throw new Error("DexScreener API Unavailable");
      
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Cari pair dengan likuiditas USD tertinggi di jaringan Base
        const basePairs = data.pairs.filter((p: any) => p.chainId === 'base');
        
        if (basePairs.length > 0) {
          const bestPair = basePairs.sort((a: any, b: any) => 
            (parseFloat(b.liquidity?.usd || "0")) - (parseFloat(a.liquidity?.usd || "0"))
          )[0];
          
          if (bestPair && bestPair.priceUsd) {
            return parseFloat(bestPair.priceUsd);
          }
        }
      }
      
      return 0.0001; 
    } catch (error) {
      console.error(`[TokenService] Price Fetch Error for ${contractAddress}:`, error);
      return 0.0001;
    }
  }
}

export const tokenService = new TokenService();