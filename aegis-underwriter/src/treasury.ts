import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { AegisLedger, IERC20 } from "../typechain-types";
import { LoanDecision } from "./llm";

dotenv.config();

// ===========================================
// TYPE DEFINITIONS
// ===========================================

/**
 * Treasury wallet information
 */
export interface TreasuryInfo {
  address: string;
  usdtBalance: string;
  usdtBalanceFormatted: string;
  nativeBalance: string;
  nativeBalanceFormatted: string;
  chainId: number;
}

/**
 * Disbursement result
 */
export interface DisbursementResult {
  success: boolean;
  transactionHash?: string;
  loanRecordHash?: string;
  error?: string;
  borrower: string;
  amount: number;
  gasUsed?: string;
}

// ===========================================
// CONFIGURATION
// ===========================================

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const MOCK_USDT_ADDRESS = process.env.MOCK_USDT_ADDRESS;
const LEDGER_CONTRACT_ADDRESS = process.env.LEDGER_CONTRACT_ADDRESS;

// Validate critical environment variables
function validateEnvironment(): void {
  if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY === "0x_your_private_key_here") {
    throw new Error("AGENT_PRIVATE_KEY not configured in .env");
  }

  if (!MOCK_USDT_ADDRESS || MOCK_USDT_ADDRESS === "0x_deployed_mock_usdt_address") {
    throw new Error("MOCK_USDT_ADDRESS not configured in .env. Deploy MockUSDT first.");
  }

  if (!LEDGER_CONTRACT_ADDRESS || LEDGER_CONTRACT_ADDRESS === "0x_deployed_ledger_address") {
    throw new Error("LEDGER_CONTRACT_ADDRESS not configured in .env. Deploy AegisLedger first.");
  }
}

// ===========================================
// TREASURY WALLET SINGLETON
// ===========================================

let treasuryWallet: ethers.Wallet | null = null;
let usdtContract: IERC20 | null = null;
let ledgerContract: AegisLedger | null = null;

/**
 * Initializes the treasury wallet using Tether WDK/Ethers.js
 * This creates the agent's self-custodial wallet that holds and disburses USD₮
 *
 * @returns The initialized wallet instance
 */
export async function initTreasury(): Promise<ethers.Wallet> {
  console.log("\n💼 TREASURY: Initializing self-custodial wallet...");

  // Validate environment
  validateEnvironment();

  // Create provider
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Initialize wallet (Tether WDK uses standard ethers Wallet for EVM chains)
  treasuryWallet = new ethers.Wallet(AGENT_PRIVATE_KEY!, provider);

  console.log(`   ✓ Agent Address: ${treasuryWallet.address}`);

  // Initialize USDT contract (standard ERC20 interface)
  const erc20Abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  ];

  usdtContract = new ethers.Contract(
    MOCK_USDT_ADDRESS!,
    erc20Abi,
    treasuryWallet
  ) as unknown as IERC20;

  // Initialize Ledger contract (import ABI from compiled artifacts)
  const ledgerArtifact = await import("../artifacts/contracts/AegisLedger.sol/AegisLedger.json");

  ledgerContract = new ethers.Contract(
    LEDGER_CONTRACT_ADDRESS!,
    ledgerArtifact.abi,
    treasuryWallet
  ) as unknown as AegisLedger;

  // Verify setup
  const network = await provider.getNetwork();
  console.log(`   ✓ Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`   ✓ USDT Contract: ${MOCK_USDT_ADDRESS}`);
  console.log(`   ✓ Ledger Contract: ${LEDGER_CONTRACT_ADDRESS}`);

  return treasuryWallet;
}

/**
 * Gets the treasury wallet (must call initTreasury first)
 */
export function getTreasuryWallet(): ethers.Wallet {
  if (!treasuryWallet) {
    throw new Error("Treasury not initialized. Call initTreasury() first.");
  }
  return treasuryWallet;
}

// ===========================================
// TREASURY INFO & BALANCE CHECKS
// ===========================================

/**
 * Gets current treasury balances
 */
export async function getTreasuryInfo(): Promise<TreasuryInfo> {
  if (!treasuryWallet || !usdtContract) {
    throw new Error("Treasury not initialized");
  }

  const provider = treasuryWallet.provider;
  if (!provider) {
    throw new Error("No provider available");
  }

  const [usdtBalance, nativeBalance, network] = await Promise.all([
    usdtContract.balanceOf(treasuryWallet.address),
    provider.getBalance(treasuryWallet.address),
    provider.getNetwork(),
  ]);

  // USDT typically has 6 decimals
  const usdtFormatted = ethers.formatUnits(usdtBalance, 6);
  const nativeFormatted = ethers.formatEther(nativeBalance);

  return {
    address: treasuryWallet.address,
    usdtBalance: usdtBalance.toString(),
    usdtBalanceFormatted: usdtFormatted,
    nativeBalance: nativeBalance.toString(),
    nativeBalanceFormatted: nativeFormatted,
    chainId: Number(network.chainId),
  };
}

/**
 * Checks if treasury has sufficient USDT to disburse a loan
 */
export async function hasSufficientBalance(amountUsdt: number): Promise<boolean> {
  if (!usdtContract || !treasuryWallet) {
    throw new Error("Treasury not initialized");
  }

  const balance = await usdtContract.balanceOf(treasuryWallet.address);
  const requiredBalance = ethers.parseUnits(amountUsdt.toString(), 6);

  return balance >= requiredBalance;
}

// ===========================================
// LOAN DISBURSEMENT
// ===========================================

/**
 * Disburses funds to a borrower and records the loan on-chain
 *
 * This function performs TWO transactions:
 * 1. ERC20 USDT transfer to the borrower
 * 2. Call issueLoan() on AegisLedger to record the debt
 *
 * @param borrowerAddress The borrower's wallet address
 * @param loanDecision The approved loan terms from LLM
 * @returns DisbursementResult with transaction hashes
 */
export async function disburseFunds(
  borrowerAddress: string,
  loanDecision: LoanDecision
): Promise<DisbursementResult> {
  console.log("\n💸 TREASURY: Initiating fund disbursement...");
  console.log(`   Borrower: ${borrowerAddress}`);
  console.log(`   Amount: ${loanDecision.amount} USDT`);
  console.log(`   Terms: ${loanDecision.interest_rate}% for ${loanDecision.duration_days} days`);

  // Validate
  if (!treasuryWallet || !usdtContract || !ledgerContract) {
    throw new Error("Treasury not initialized. Call initTreasury() first.");
  }

  if (loanDecision.status === "denied" || loanDecision.amount === 0) {
    return {
      success: false,
      error: "Cannot disburse denied loan",
      borrower: borrowerAddress,
      amount: 0,
    };
  }

  // Normalize borrower address
  const normalizedBorrower = ethers.getAddress(borrowerAddress.toLowerCase());

  // Convert amount to USDT units (6 decimals)
  const amountInUnits = ethers.parseUnits(loanDecision.amount.toString(), 6);

  // Check sufficient balance
  const hasBalance = await hasSufficientBalance(loanDecision.amount);
  if (!hasBalance) {
    const info = await getTreasuryInfo();
    return {
      success: false,
      error: `Insufficient treasury balance. Has: ${info.usdtBalanceFormatted} USDT, Needs: ${loanDecision.amount} USDT`,
      borrower: normalizedBorrower,
      amount: loanDecision.amount,
    };
  }

  try {
    // Check if borrower already has an active loan BEFORE disbursing
    const existingLoan = await ledgerContract.getLoan(normalizedBorrower);
    if (existingLoan.isActive) {
      return {
        success: false,
        error: `Borrower already has an active loan. Must repay existing loan before applying for another.`,
        borrower: normalizedBorrower,
        amount: loanDecision.amount,
      };
    }

    // TRANSACTION 1: Transfer USDT to borrower
    console.log("\n   [1/2] Transferring USDT to borrower...");
    console.log(`   Transfer Details: ${amountInUnits.toString()} units (${loanDecision.amount} USDT) from treasury to ${normalizedBorrower}`);

    const transferTx = await usdtContract.transfer(normalizedBorrower, amountInUnits);
    console.log(`   ✓ Transfer TX initiated: ${transferTx.hash}`);

    const transferReceipt = await transferTx.wait();
    if (!transferReceipt) {
      throw new Error("Transfer receipt is null - transaction may have failed");
    }

    console.log(`   ✓ Transfer confirmed in block ${transferReceipt.blockNumber}`);
    console.log(`   ✓ Status: ${transferReceipt.status === 1 ? "SUCCESS" : "FAILED"}`);
    console.log(`   ✓ Gas Used: ${transferReceipt.gasUsed.toString()}`);

    // Verify balance after transfer
    const balanceAfter = await usdtContract.balanceOf(treasuryWallet.address);
    console.log(`   ✓ Treasury balance after transfer: ${ethers.formatUnits(balanceAfter, 6)} USDT`);

    // TRANSACTION 2: Record loan on AegisLedger
    console.log("\n   [2/2] Recording loan on AegisLedger...");

    // Convert interest rate to basis points (5.5% → 550 bp)
    const interestRateBp = Math.floor(loanDecision.interest_rate * 100);

    const loanTx = await ledgerContract.issueLoan(
      normalizedBorrower,
      amountInUnits,
      interestRateBp,
      loanDecision.duration_days
    );

    console.log(`   ✓ Loan Record TX: ${loanTx.hash}`);

    const loanReceipt = await loanTx.wait();
    if (!loanReceipt) {
      throw new Error("Loan receipt is null - transaction may have failed");
    }

    console.log(`   ✓ Loan recorded in block ${loanReceipt.blockNumber}`);
    console.log(`   ✓ Status: ${loanReceipt.status === 1 ? "SUCCESS" : "FAILED"}`);

    // Calculate gas used
    const totalGasUsed = (transferReceipt?.gasUsed || 0n) + (loanReceipt?.gasUsed || 0n);

    console.log("\n   ✅ Disbursement complete!");

    return {
      success: true,
      transactionHash: transferTx.hash,
      loanRecordHash: loanTx.hash,
      borrower: normalizedBorrower,
      amount: loanDecision.amount,
      gasUsed: totalGasUsed.toString(),
    };
  } catch (error) {
    console.error("   ❌ Disbursement failed:");
    console.error(error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      borrower: normalizedBorrower,
      amount: loanDecision.amount,
    };
  }
}

/**
 * Gets repayment instructions for a borrower
 * Returns details needed for borrower to repay their loan via frontend
 *
 * @param borrowerAddress The borrower's wallet address
 * @returns Repayment details or error
 */
export async function getRepaymentDetails(borrowerAddress: string): Promise<{
  success: boolean;
  borrower: string;
  amount?: number;
  interestRate?: number;
  dueDate?: Date;
  contractAddress?: string;
  error?: string;
}> {
  console.log("\n💰 TREASURY: Fetching repayment details...");
  console.log(`   Borrower: ${borrowerAddress}`);

  // Validate
  if (!ledgerContract) {
    throw new Error("Treasury not initialized. Call initTreasury() first.");
  }

  try {
    // Get loan details
    const normalizedBorrower = ethers.getAddress(borrowerAddress.toLowerCase());
    const loanDetails = await getLoanDetails(normalizedBorrower);

    if (!loanDetails) {
      return {
        success: false,
        borrower: normalizedBorrower,
        error: "No active loan found for this address",
      };
    }

    console.log(`   Repayment Amount: ${loanDetails.totalRepayment} USDT`);
    console.log(`   Interest Rate: ${loanDetails.interestRate}%`);
    console.log(`   Due Date: ${loanDetails.dueDate}`);

    return {
      success: true,
      borrower: normalizedBorrower,
      amount: parseFloat(loanDetails.totalRepayment),
      interestRate: loanDetails.interestRate,
      dueDate: loanDetails.dueDate,
      contractAddress: LEDGER_CONTRACT_ADDRESS,
    };
  } catch (error) {
    console.error("   ❌ Failed to fetch details:");
    console.error(error);

    return {
      success: false,
      borrower: ethers.getAddress(borrowerAddress.toLowerCase()),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verifies if a loan has been repaid
 * Called after borrower initiates repayment via their wallet
 *
 * @param borrowerAddress The borrower's wallet address
 * @returns Result with loan status
 */
export async function verifyLoanRepayment(borrowerAddress: string): Promise<{
  success: boolean;
  borrower: string;
  isRepaid?: boolean;
  isActive?: boolean;
  error?: string;
}> {
  console.log("\n💰 TREASURY: Verifying loan repayment...");
  console.log(`   Borrower: ${borrowerAddress}`);

  // Validate
  if (!ledgerContract) {
    throw new Error("Treasury not initialized. Call initTreasury() first.");
  }

  try {
    const normalizedBorrower = ethers.getAddress(borrowerAddress.toLowerCase());
    const loan = await ledgerContract.getLoan(normalizedBorrower);

    console.log(`   📋 Loan Status for ${normalizedBorrower}:`);
    console.log(`      • isActive: ${loan.isActive}`);
    console.log(`      • isRepaid: ${loan.isRepaid}`);
    console.log(`      • Principal: ${ethers.formatUnits(loan.amount, 6)} USDT`);
    console.log(`      • Total Due: ${ethers.formatUnits(loan.totalRepayment, 6)} USDT`);
    console.log(`      • Interest Rate: ${Number(loan.interestRate) / 100}%`);
    console.log(`      • Due Date: ${new Date(Number(loan.dueDate) * 1000).toISOString()}`);

    return {
      success: true,
      borrower: normalizedBorrower,
      isRepaid: loan.isRepaid,
      isActive: loan.isActive,
    };
  } catch (error) {
    console.error("   ❌ Failed to verify:");
    console.error(error);

    return {
      success: false,
      borrower: ethers.getAddress(borrowerAddress.toLowerCase()),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Collects/claims repayment from the ledger contract after borrower has repaid
 * This transfers the repaid amount back to the treasury's USDT balance
 */
export async function collectRepayment(borrowerAddress: string): Promise<{
  success: boolean;
  amount?: number;
  error?: string;
}> {
  console.log("\n💰 TREASURY: Collecting repayment...");
  console.log(`   Borrower: ${borrowerAddress}`);

  if (!ledgerContract) {
    throw new Error("Treasury not initialized");
  }

  try {
    const normalizedBorrower = ethers.getAddress(borrowerAddress.toLowerCase());
    const loan = await ledgerContract.getLoan(normalizedBorrower);

    // Check if loan is repaid
    if (!loan.isRepaid) {
      return {
        success: false,
        error: "Loan has not been repaid yet",
      };
    }

    // Get the repayment amount (principal + interest)
    const repaymentAmountBigInt = loan.totalRepayment;
    const repaymentAmount = parseFloat(ethers.formatUnits(repaymentAmountBigInt, 6));

    console.log(`   Repayment Amount: ${repaymentAmount} USDT`);
    console.log(`   Treasury on-chain balance has been updated by borrower`);

    // The funds have already been transferred on-chain by the borrower
    // when they called repayLoan(). We just acknowledge and track it here.
    return {
      success: true,
      amount: Math.round(repaymentAmount),
    };
  } catch (error) {
    console.error("   ❌ Failed to collect repayment:");
    console.error(error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Checks if a borrower has an active loan
 */
export async function hasActiveLoan(borrowerAddress: string): Promise<boolean> {
  if (!ledgerContract) {
    throw new Error("Treasury not initialized");
  }

  const normalized = ethers.getAddress(borrowerAddress.toLowerCase());
  const loan = await ledgerContract.getLoan(normalized);

  return loan.isActive;
}

/**
 * Gets loan details for a borrower
 */
export async function getLoanDetails(borrowerAddress: string) {
  if (!ledgerContract) {
    throw new Error("Treasury not initialized");
  }

  const normalized = ethers.getAddress(borrowerAddress.toLowerCase());
  const loan = await ledgerContract.getLoan(normalized);

  if (!loan.isActive) {
    return null;
  }

  return {
    amount: ethers.formatUnits(loan.amount, 6),
    interestRate: Number(loan.interestRate) / 100,
    dueDate: new Date(Number(loan.dueDate) * 1000),
    totalRepayment: ethers.formatUnits(loan.totalRepayment, 6),
    isRepaid: loan.isRepaid,
  };
}

/**
 * Checks if a borrower is in default
 */
export async function isInDefault(borrowerAddress: string): Promise<boolean> {
  if (!ledgerContract) {
    throw new Error("Treasury not initialized");
  }

  const normalized = ethers.getAddress(borrowerAddress.toLowerCase());
  return await ledgerContract.isInDefault(normalized);
}

/**
 * Gets all defaulters from the ledger
 */
export async function getDefaulters(): Promise<{
  addresses: string[];
  amounts: string[];
}> {
  if (!ledgerContract) {
    throw new Error("Treasury not initialized");
  }

  const [defaulters, amounts] = await ledgerContract.getDefaulters();

  return {
    addresses: defaulters,
    amounts: amounts.map((amt) => ethers.formatUnits(amt, 6)),
  };
}

/**
 * Formats disbursement result for display
 */
export function formatDisbursementResult(result: DisbursementResult): string {
  const lines = [
    "",
    "╔═══════════════════ DISBURSEMENT RESULT ═══════════════════╗",
  ];

  if (result.success) {
    lines.push("║ ✅ Status: SUCCESS                                         ║");
    lines.push("║───────────────────────────────────────────────────────────║");
    lines.push(`║ 👤 Borrower: ${result.borrower.slice(0, 20)}...${result.borrower.slice(-6)}     ║`);
    lines.push(`║ 💰 Amount: ${result.amount.toString().padEnd(46)} USDT ║`);
    lines.push("║───────────────────────────────────────────────────────────║");
    lines.push(`║ 📝 Transfer TX: ${result.transactionHash?.slice(0, 30)}...    ║`);
    lines.push(`║ 📝 Ledger TX: ${result.loanRecordHash?.slice(0, 32)}...    ║`);
    lines.push(`║ ⛽ Gas Used: ${result.gasUsed?.slice(0, 20).padEnd(20)}                       ║`);
  } else {
    lines.push("║ ❌ Status: FAILED                                          ║");
    lines.push("║───────────────────────────────────────────────────────────║");
    lines.push(`║ Error: ${(result.error || "Unknown").slice(0, 52).padEnd(52)} ║`);
  }

  lines.push("╚═══════════════════════════════════════════════════════════╝");
  lines.push("");

  return lines.join("\n");
}

/**
 * Formats treasury info for display
 */
export function formatTreasuryInfo(info: TreasuryInfo): string {
  return `
╔═══════════════════ TREASURY STATUS ═══════════════════╗
║ Agent Address: ${info.address.slice(0, 20)}...${info.address.slice(-6)}   ║
║ Chain ID: ${info.chainId.toString().padEnd(46)} ║
║─────────────────────────────────────────────────────║
║ 💵 USDT Balance: ${info.usdtBalanceFormatted.slice(0, 20).padEnd(20)} USDT            ║
║ ⛽ Native Balance: ${info.nativeBalanceFormatted.slice(0, 18).padEnd(18)} MATIC/ETH       ║
╚═════════════════════════════════════════════════════╝
`;
}
