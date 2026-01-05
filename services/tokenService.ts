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
      // Normalize addresses
      const normalizedWallet = ethers.getAddress(walletAddress);
      const normalizedToken = ethers.getAddress(tokenContractAddress);
      
      const contract = new ethers.Contract(normalizedToken, MINIMAL_ERC20_ABI, this.provider);
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(normalizedWallet),
        contract.decimals()
      ]);
      
      return parseFloat(ethers.formatUnits(balance, decimals));
    } catch (error) {
      console.error(`Token Balance Fetch Error for ${tokenContractAddress}:`, error);
      return 0;
    }
  }

  /**
   * Fetches real-time price from DexScreener for a specific token on Base.
   */
  async getTokenPrice(contractAddress: string): Promise<number> {
    try {
      const normalizedAddress = contractAddress.toLowerCase();
      const response = await fetch(`${DEXSCREENER_API}${normalizedAddress}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Find the best pair on Base network
        const basePairs = data.pairs.filter((p: any) => p.chainId === 'base');
        
        if (basePairs.length > 0) {
          // Sort by liquidity to get the most accurate price
          const bestPair = basePairs.sort((a: any, b: any) => 
            (parseFloat(b.liquidity?.usd || "0")) - (parseFloat(a.liquidity?.usd || "0"))
          )[0];
          
          if (bestPair && bestPair.priceUsd) {
            const price = parseFloat(bestPair.priceUsd);
            console.log(`Price for ${contractAddress}: $${price}`);
            return price;
          }
        }
      }
      
      console.warn(`No active Base pairs found for ${contractAddress}. Using safety fallback.`);
      return 0.0001; 
    } catch (error) {
      console.error(`DexScreener Price Fetch Error for ${contractAddress}:`, error);
      return 0.0001;
    }
  }
}

export const tokenService = new TokenService();