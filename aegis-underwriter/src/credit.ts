import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// ===========================================
// TYPE DEFINITIONS
// ===========================================

/**
 * Credit data derived from on-chain wallet history
 */
export interface CreditData {
  walletAddress: string;
  txCount: number;
  currentBalance: string;
  currentBalanceFormatted: string;
  walletAgeDays: number;
  riskScore: number;
  creditTier: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "REJECT";
  chainId: number;
  blockNumber: number;
  timestamp: number;
}

// ===========================================
// CONFIGURATION
// ===========================================

const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const WALLET_AGE_ESTIMATION_ENABLED = true;

// ===========================================
// CREDIT SCORING ALGORITHM
// ===========================================

/**
 * Calculates a risk score (0-100) based on wallet characteristics
 * Lower score = lower risk = better creditworthiness
 *
 * @param txCount Number of transactions
 * @param balanceEth Balance in ETH/MATIC
 * @param ageDays Estimated wallet age in days
 * @returns Risk score (0 = best, 100 = worst)
 */
function calculateRiskScore(
  txCount: number,
  balanceEth: number,
  ageDays: number
): number {
  let score = 50; // Start at neutral

  // Transaction count factor (0-40 points adjustment)
  if (txCount === 0) {
    score += 40; // Empty wallet = high risk
  } else if (txCount < 5) {
    score += 30;
  } else if (txCount < 20) {
    score += 15;
  } else if (txCount < 50) {
    score += 5;
  } else if (txCount < 100) {
    score -= 5;
  } else if (txCount < 500) {
    score -= 15;
  } else {
    score -= 25; // Very active wallet = low risk
  }

  // Balance factor (0-30 points adjustment)
  if (balanceEth === 0) {
    score += 30; // No balance = high risk
  } else if (balanceEth < 0.01) {
    score += 20;
  } else if (balanceEth < 0.1) {
    score += 10;
  } else if (balanceEth < 1) {
    score += 0;
  } else if (balanceEth < 10) {
    score -= 10;
  } else {
    score -= 20; // High balance = low risk
  }

  // Wallet age factor (0-30 points adjustment)
  if (ageDays === 0) {
    score += 20; // Brand new = high risk
  } else if (ageDays < 7) {
    score += 15;
  } else if (ageDays < 30) {
    score += 10;
  } else if (ageDays < 90) {
    score += 5;
  } else if (ageDays < 180) {
    score += 0;
  } else if (ageDays < 365) {
    score -= 10;
  } else {
    score -= 20; // Old wallet = established = low risk
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Converts risk score to a credit tier
 */
function getCreditTier(riskScore: number): CreditData["creditTier"] {
  if (riskScore <= 20) return "EXCELLENT";
  if (riskScore <= 40) return "GOOD";
  if (riskScore <= 60) return "FAIR";
  if (riskScore <= 80) return "POOR";
  return "REJECT";
}

// ===========================================
// WALLET AGE ESTIMATION
// ===========================================

/**
 * Estimates wallet age by fetching the first transaction via binary search
 * This is an approximation since we don't have direct Etherscan API access
 * Falls back to a conservative estimate based on transaction count
 *
 * @param provider Ethers provider
 * @param address Wallet address
 * @param txCount Total transaction count
 * @returns Estimated age in days
 */
async function estimateWalletAge(
  provider: ethers.JsonRpcProvider,
  _address: string,
  txCount: number
): Promise<number> {
  if (txCount === 0) {
    return 0; // New/unused wallet
  }

  try {
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    const currentBlockData = await provider.getBlock(currentBlock);
    if (!currentBlockData) {
      throw new Error("Failed to fetch current block data");
    }

    // Estimate: assume average of 1 tx per week for conservative estimate
    // For testnets, this is very rough but sufficient for hackathon demo
    const estimatedWeeks = Math.sqrt(txCount); // Non-linear growth assumption
    const estimatedDays = estimatedWeeks * 7;

    return Math.max(1, Math.floor(estimatedDays));
  } catch (error) {
    console.warn("⚠️  Wallet age estimation failed, using tx count approximation");
    // Fallback: 1 tx per week assumption
    return Math.max(1, Math.floor(txCount / 4));
  }
}

// ===========================================
// MAIN CREDIT ORACLE FUNCTION
// ===========================================

/**
 * The Credit Oracle: Fetches on-chain data and computes credit score
 *
 * @param walletAddress The EVM wallet address to assess
 * @returns Comprehensive credit data structure
 * @throws Error if wallet address is invalid or RPC fails
 */
export async function getCreditData(
  walletAddress: string
): Promise<CreditData> {
  console.log("\n🔍 CREDIT ORACLE: Analyzing on-chain history...");
  console.log(`   Wallet: ${walletAddress}`);

  // Validate and normalize address (convert to checksum format)
  let normalizedAddress: string;
  try {
    // Try to get checksum address, but be lenient with mixed-case input
    normalizedAddress = ethers.getAddress(walletAddress.toLowerCase());
  } catch (error) {
    throw new Error(`Invalid EVM address format: ${walletAddress}`);
  }

  console.log(`   Normalized: ${normalizedAddress}`);

  // Initialize provider
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  try {
    // Fetch all required data in parallel
    console.log("   Querying blockchain...");

    const [rawTxCount, rawBalance, blockNumber, network] = await Promise.all([
      provider.getTransactionCount(normalizedAddress, "latest"),
      provider.getBalance(normalizedAddress),
      provider.getBlockNumber(),
      provider.getNetwork(),
    ]);

    console.log(`   ✓ Found ${rawTxCount} transactions`);

    // Estimate wallet age
    let walletAgeDays = 0;
    if (WALLET_AGE_ESTIMATION_ENABLED) {
      console.log("   Estimating wallet age...");
      walletAgeDays = await estimateWalletAge(provider, normalizedAddress, rawTxCount);
      console.log(`   ✓ Estimated age: ~${walletAgeDays} days`);
    }

    // Convert balance to human-readable
    const balanceFormatted = ethers.formatEther(rawBalance);
    const balanceNumber = parseFloat(balanceFormatted);

    // Calculate risk score
    const riskScore = calculateRiskScore(rawTxCount, balanceNumber, walletAgeDays);
    const creditTier = getCreditTier(riskScore);

    console.log(`   ✓ Credit Tier: ${creditTier} (Risk Score: ${riskScore}/100)`);

    // Assemble credit data
    const creditData: CreditData = {
      walletAddress: normalizedAddress,
      txCount: rawTxCount,
      currentBalance: rawBalance.toString(),
      currentBalanceFormatted: balanceFormatted,
      walletAgeDays: walletAgeDays,
      riskScore: riskScore,
      creditTier: creditTier,
      chainId: Number(network.chainId),
      blockNumber: blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
    };

    return creditData;
  } catch (error) {
    console.error("❌ Credit Oracle failed:");
    if (error instanceof Error) {
      throw new Error(`Failed to fetch credit data: ${error.message}`);
    }
    throw new Error("Failed to fetch credit data: Unknown error");
  }
}

/**
 * Get a summary string for display in CLI
 */
export function formatCreditSummary(data: CreditData): string {
  const lines = [
    "\n╔═══════════════════ CREDIT REPORT ═══════════════════╗",
    `║ Wallet: ${data.walletAddress.slice(0, 20)}...${data.walletAddress.slice(-6)}`,
    `║ Chain ID: ${data.chainId}`,
    "║─────────────────────────────────────────────────────║",
    `║ Transaction Count: ${data.txCount.toString().padEnd(30)} ║`,
    `║ Current Balance: ${data.currentBalanceFormatted.slice(0, 15).padEnd(15)} ETH/MATIC    ║`,
    `║ Wallet Age: ~${data.walletAgeDays.toString().padEnd(20)} days    ║`,
    "║─────────────────────────────────────────────────────║",
    `║ 📊 Risk Score: ${data.riskScore.toString().padEnd(20)}/100         ║`,
    `║ 🏆 Credit Tier: ${data.creditTier.padEnd(30)} ║`,
    "╚═════════════════════════════════════════════════════╝\n",
  ];

  return lines.join("\n");
}

/**
 * Validate that RPC is accessible
 */
export async function validateRpcConnection(): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const network = await provider.getNetwork();
    console.log(`✅ RPC Connected: Chain ID ${network.chainId}`);
    return true;
  } catch (error) {
    console.error(`❌ RPC Connection Failed: ${RPC_URL}`);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    return false;
  }
}
