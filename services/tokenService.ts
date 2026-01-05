import { ethers } from 'ethers';

const MINIMAL_ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const BASE_RPC_URL = "https://mainnet.base.org";
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens/";

export class TokenService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }

  async getBalance(walletAddress: string, tokenContractAddress: string): Promise<number> {
    try {
      if (!walletAddress || !tokenContractAddress) return 0;

      // Normalisasi alamat untuk menghindari case-sensitivity issues
      const normalizedWallet = ethers.getAddress(walletAddress);
      const normalizedToken = ethers.getAddress(tokenContractAddress);
      
      const contract = new ethers.Contract(normalizedToken, MINIMAL_ERC20_ABI, this.provider);
      
      // Menggunakan timeout atau penanganan error spesifik untuk decimals
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(normalizedWallet).catch((err) => {
          console.warn(`[TokenService] Balance fetch failed for ${tokenContractAddress}:`, err.message);
          return BigInt(0);
        }),
        contract.decimals().catch((err) => {
          console.warn(`[TokenService] Decimals fetch failed for ${tokenContractAddress}, defaulting to 18:`, err.message);
          return 18;
        })
      ]);
      
      const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
      console.log(`[TokenService] Found Balance for ${tokenContractAddress}: ${formattedBalance}`);
      return formattedBalance;
    } catch (error) {
      console.error(`[TokenService] Critical Balance Error for ${tokenContractAddress}:`, error);
      return 0;
    }
  }

  /**
   * Mengambil harga real-time dari DexScreener dengan filter likuiditas terbaik.
   */
  async getTokenPrice(contractAddress: string): Promise<number> {
    try {
      const normalizedAddress = contractAddress.toLowerCase();
      const response = await fetch(`${DEXSCREENER_API}${normalizedAddress}`);
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
      
      // Fallback jika tidak ada data harga (umum untuk token baru)
      return 0.0001; 
    } catch (error) {
      console.error(`[TokenService] Price Fetch Error for ${contractAddress}:`, error);
      return 0.0001;
    }
  }
}

export const tokenService = new TokenService();