import { getCreditData, CreditData, formatCreditSummary } from "./credit";
import { negotiateLoan, quickDecision, LoanDecision, LoanRequest, formatLoanDecision, isLoanDecisionSafe } from "./llm";
import { initTreasury, disburseFunds, getTreasuryInfo, hasActiveLoan, formatTreasuryInfo, DisbursementResult, formatDisbursementResult } from "./treasury";

// ===========================================
// TYPE DEFINITIONS
// ===========================================

/**
 * Result of a complete loan application process
 */
export interface LoanApplicationResult {
  creditData: CreditData;
  loanDecision: LoanDecision;
  disbursement?: DisbursementResult;
  applicationId: string;
  timestamp: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  useLLM: boolean; // If false, use deterministic fallback
  autoDisburse: boolean; // If true, disburse approved loans automatically
  verbose: boolean; // Detailed logging
}

// ===========================================
// AGENT ORCHESTRATION
// ===========================================

/**
 * Main agent function: Processes a complete loan application
 *
 * This orchestrates the entire flow:
 * 1. Fetch credit data (Credit Oracle)
 * 2. Negotiate loan terms (LLM Brain or fallback)
 * 3. Disburse funds if approved (Treasury/WDK)
 * 4. Record loan on-chain (AegisLedger)
 *
 * @param borrowerAddress The applicant's wallet address
 * @param loanRequest The loan request details
 * @param config Agent configuration options
 * @returns Complete application result
 */
export async function processLoanApplication(
  borrowerAddress: string,
  loanRequest: LoanRequest,
  config: AgentConfig = { useLLM: true, autoDisburse: false, verbose: true }
): Promise<LoanApplicationResult> {
  const applicationId = generateApplicationId();
  const startTime = Date.now();

  if (config.verbose) {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║              AEGIS UNDERWRITER - LOAN PROCESSING           ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\n📋 Application ID: ${applicationId}`);
    console.log(`👤 Borrower: ${borrowerAddress}`);
    console.log(`💰 Requested: ${loanRequest.requestedAmount} USDT`);
  }

  // STEP 1: Check for existing active loan
  try {
    const hasExistingLoan = await hasActiveLoan(borrowerAddress);
    if (hasExistingLoan) {
      throw new Error("Borrower already has an active loan. Repay existing debt first.");
    }
  } catch (error) {
    if (config.verbose) {
      console.log("\n⚠️  Skipping active loan check (contracts not deployed yet)");
    }
  }

  // STEP 2: Fetch credit data
  if (config.verbose) {
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("STEP 1: CREDIT ASSESSMENT");
    console.log("═══════════════════════════════════════════════════════════");
  }

  const creditData = await getCreditData(borrowerAddress);

  if (config.verbose) {
    console.log(formatCreditSummary(creditData));
  }

  // STEP 3: Negotiate loan terms
  if (config.verbose) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("STEP 2: LOAN NEGOTIATION");
    console.log("═══════════════════════════════════════════════════════════");
  }

  let loanDecision: LoanDecision;

  try {
    if (config.useLLM) {
      // Try LLM negotiation
      loanDecision = await negotiateLoan(loanRequest, creditData);
    } else {
      // Use deterministic fallback
      if (config.verbose) {
        console.log("\n   Using deterministic decision engine...");
      }
      loanDecision = quickDecision(loanRequest, creditData);
    }
  } catch (error) {
    // Fallback to quick decision if LLM fails
    if (config.verbose) {
      console.log("\n⚠️  LLM negotiation failed, using fallback...");
    }
    loanDecision = quickDecision(loanRequest, creditData);
  }

  if (config.verbose) {
    console.log(formatLoanDecision(loanDecision));
  }

  // Validate decision
  const safetyCheck = isLoanDecisionSafe(loanDecision);
  if (!safetyCheck.safe) {
    throw new Error(`Unsafe loan decision: ${safetyCheck.reason}`);
  }

  // STEP 4: Disburse funds (if approved and auto-disburse enabled)
  let disbursement: DisbursementResult | undefined;

  if (config.autoDisburse && loanDecision.status !== "denied") {
    if (config.verbose) {
      console.log("═══════════════════════════════════════════════════════════");
      console.log("STEP 3: FUND DISBURSEMENT");
      console.log("═══════════════════════════════════════════════════════════");
    }

    try {
      disbursement = await disburseFunds(borrowerAddress, loanDecision);

      if (config.verbose) {
        console.log(formatDisbursementResult(disbursement));
      }
    } catch (error) {
      if (config.verbose) {
        console.log("\n⚠️  Disbursement skipped (contracts not deployed yet)");
      }
      disbursement = {
        success: false,
        error: error instanceof Error ? error.message : "Contracts not deployed",
        borrower: borrowerAddress,
        amount: loanDecision.amount,
      };
    }
  } else if (config.verbose && loanDecision.status !== "denied") {
    console.log("\n⚠️  Auto-disbursement disabled. Manual approval required.");
  }

  // Completion summary
  const duration = Date.now() - startTime;

  if (config.verbose) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("APPLICATION COMPLETE");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`⏱️  Processing Time: ${duration}ms`);
    console.log(`📋 Application ID: ${applicationId}`);
    console.log("═══════════════════════════════════════════════════════════\n");
  }

  return {
    creditData,
    loanDecision,
    disbursement,
    applicationId,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Initializes the full agent system
 * Call this before processing any loan applications
 */
export async function initializeAgent(verbose: boolean = true): Promise<void> {
  if (verbose) {
    console.log("\n🤖 AEGIS AGENT: Initializing autonomous lending system...");
  }

  try {
    await initTreasury();
    if (verbose) {
      console.log("   ✅ Treasury initialized");

      const info = await getTreasuryInfo();
      console.log(formatTreasuryInfo(info));
    }
  } catch (error) {
    if (verbose) {
      console.log("   ⚠️  Treasury initialization skipped (deploy contracts first)");
      console.log("   The agent will run in simulation mode until contracts are deployed.");
    }
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Generates a unique application ID
 */
function generateApplicationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `AEGIS-${timestamp}-${random}`.toUpperCase();
}

/**
 * Validates a loan request
 */
export function validateLoanRequest(request: LoanRequest): {
  valid: boolean;
  error?: string;
} {
  const maxLoan = parseInt(process.env.MAX_LOAN_AMOUNT || "500");

  if (request.requestedAmount <= 0) {
    return { valid: false, error: "Loan amount must be positive" };
  }

  if (request.requestedAmount > maxLoan) {
    return { valid: false, error: `Maximum loan is ${maxLoan} USDT` };
  }

  if (request.requestedDuration && request.requestedDuration <= 0) {
    return { valid: false, error: "Duration must be positive" };
  }

  if (request.requestedDuration && request.requestedDuration > 365) {
    return { valid: false, error: "Maximum duration is 365 days" };
  }

  return { valid: true };
}

/**
 * Saves application result to a log file (for audit trail)
 */
export async function saveApplicationLog(result: LoanApplicationResult): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const logDir = path.join(process.cwd(), "logs");

  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    // Directory exists, continue
  }

  const logEntry = {
    applicationId: result.applicationId,
    timestamp: new Date(result.timestamp * 1000).toISOString(),
    borrower: result.creditData.walletAddress,
    creditScore: {
      txCount: result.creditData.txCount,
      balance: result.creditData.currentBalanceFormatted,
      walletAge: result.creditData.walletAgeDays,
      riskScore: result.creditData.riskScore,
      tier: result.creditData.creditTier,
    },
    decision: result.loanDecision,
    disbursed: result.disbursement?.success || false,
    transactionHash: result.disbursement?.transactionHash,
  };

  const logFile = path.join(logDir, `${result.applicationId}.json`);
  await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2));
}
