import OpenAI from "openai";
import * as dotenv from "dotenv";
import { CreditData } from "./credit";

dotenv.config();

// ===========================================
// TYPE DEFINITIONS
// ===========================================

/**
 * Loan decision output from the LLM
 */
export interface LoanDecision {
  status: "approved" | "denied" | "counter_offer";
  amount: number;
  interest_rate: number;
  duration_days: number;
  message: string;
}

/**
 * Input parameters for loan negotiation
 */
export interface LoanRequest {
  requestedAmount: number;
  requestedDuration?: number; // Optional, LLM can suggest
  userMessage?: string; // Optional context from user
}

// ===========================================
// CONFIGURATION
// ===========================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_LOAN_AMOUNT = parseInt(process.env.MAX_LOAN_AMOUNT || "500");
const MODEL = "gpt-4o"; // Latest GPT-4 Optimized

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not found in environment variables");
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// ===========================================
// SYSTEM PROMPT
// ===========================================

const AEGIS_SYSTEM_PROMPT = `You are Aegis, an autonomous DeFi loan officer operating on the blockchain.

## YOUR ROLE
You are a ruthless but fair AI agent managing an undercollateralized lending protocol. You evaluate borrowers based SOLELY on their on-chain credit history. You do not require collateral, but you demand accountability.

## EVALUATION CRITERIA

**Risk Score System:**
- 0-20: EXCELLENT - Offer best terms, highest amounts
- 21-40: GOOD - Favorable terms, moderate amounts
- 41-60: FAIR - Standard terms, conservative amounts
- 61-80: POOR - High interest, very low amounts, short duration
- 81-100: REJECT - Deny loan outright

**Key Factors:**
1. **Transaction Count**: More transactions = established user = lower risk
2. **Wallet Balance**: Higher balance = liquidity signal = lower risk
3. **Wallet Age**: Older wallet = reputation = lower risk

## LOAN PARAMETERS
- Maximum loan: ${MAX_LOAN_AMOUNT} USDT
- Interest rates: 2-25% (lower for better credit)
- Duration: 7-90 days (varies by risk)

## YOUR PERSONALITY
- Be direct and professional
- Use subtle intimidation for high-risk borrowers ("You have no transaction history. This is concerning.")
- Show confidence for excellent borrowers ("Your wallet speaks for itself. Approved.")
- Be willing to negotiate via counter-offers
- NEVER approve loans above ${MAX_LOAN_AMOUNT} USDT
- NEVER approve loans for REJECT tier (risk > 80)

## OUTPUT FORMAT (STRICT)
You MUST output ONLY valid JSON in this exact format:

\`\`\`json
{
  "status": "approved" | "denied" | "counter_offer",
  "amount": <number in USDT>,
  "interest_rate": <percentage as decimal, e.g., 5.5 for 5.5%>,
  "duration_days": <number of days>,
  "message": "<your message to the borrower (2-3 sentences max)>"
}
\`\`\`

## DECISION LOGIC EXAMPLES

**EXCELLENT (Risk 0-20):**
- Status: approved
- Amount: Up to requested (max 500)
- Interest: 2-5%
- Duration: 30-90 days
- Message: Confident approval

**GOOD (Risk 21-40):**
- Status: approved or counter_offer
- Amount: 70-100% of requested (max 400)
- Interest: 5-10%
- Duration: 14-60 days
- Message: Positive but cautious

**FAIR (Risk 41-60):**
- Status: counter_offer
- Amount: 30-70% of requested (max 250)
- Interest: 10-18%
- Duration: 7-30 days
- Message: Require more proof, offer conservative terms

**POOR (Risk 61-80):**
- Status: counter_offer (very small) or denied
- Amount: 10-50 USDT max
- Interest: 18-25%
- Duration: 7-14 days
- Message: Harsh but fair ("Build your reputation first")

**REJECT (Risk 81-100):**
- Status: denied
- Amount: 0
- Interest: 0
- Duration: 0
- Message: Clear refusal with reasoning

Do NOT output any text outside the JSON structure. No markdown formatting, no explanations, ONLY the JSON object.`;

// ===========================================
// MAIN LLM BRAIN FUNCTION
// ===========================================

/**
 * The LLM Brain: Negotiates loan terms based on credit data
 *
 * @param loanRequest The user's loan request details
 * @param creditData The credit data from the Credit Oracle
 * @returns LoanDecision with status, terms, and message
 * @throws Error if OpenAI API fails or JSON parsing fails
 */
export async function negotiateLoan(
  loanRequest: LoanRequest,
  creditData: CreditData
): Promise<LoanDecision> {
  console.log("\n🧠 LLM BRAIN: Evaluating loan application...");

  // Build the user prompt
  const userPrompt = buildUserPrompt(loanRequest, creditData);

  try {
    console.log("   Consulting OpenAI GPT-4...");

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: AEGIS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("   ✓ LLM response received");

    // Parse and validate JSON
    const decision = parseLoanDecision(rawContent);

    console.log(`   ✓ Decision: ${decision.status.toUpperCase()}`);
    console.log(`   ✓ Amount: ${decision.amount} USDT @ ${decision.interest_rate}% for ${decision.duration_days} days`);

    return decision;
  } catch (error) {
    console.error("❌ LLM Brain failed:");
    if (error instanceof Error) {
      throw new Error(`Failed to negotiate loan: ${error.message}`);
    }
    throw new Error("Failed to negotiate loan: Unknown error");
  }
}

/**
 * Builds the user prompt with credit data and loan request
 */
function buildUserPrompt(
  loanRequest: LoanRequest,
  creditData: CreditData
): string {
  const lines = [
    "## BORROWER CREDIT PROFILE",
    "",
    `**Wallet Address:** ${creditData.walletAddress}`,
    `**Chain:** ${getChainName(creditData.chainId)} (ID: ${creditData.chainId})`,
    `**Transaction Count:** ${creditData.txCount}`,
    `**Current Balance:** ${creditData.currentBalanceFormatted} (native token)`,
    `**Wallet Age:** ${creditData.walletAgeDays} days`,
    `**Risk Score:** ${creditData.riskScore}/100`,
    `**Credit Tier:** ${creditData.creditTier}`,
    "",
    "## LOAN REQUEST",
    "",
    `**Requested Amount:** ${loanRequest.requestedAmount} USDT`,
  ];

  if (loanRequest.requestedDuration) {
    lines.push(`**Requested Duration:** ${loanRequest.requestedDuration} days`);
  }

  if (loanRequest.userMessage) {
    lines.push(`**User Message:** "${loanRequest.userMessage}"`);
  }

  lines.push("");
  lines.push("## YOUR TASK");
  lines.push(
    "Evaluate this borrower and make a lending decision. Output ONLY the JSON decision object."
  );

  return lines.join("\n");
}

/**
 * Parses and validates the LLM's JSON response
 */
function parseLoanDecision(rawJson: string): LoanDecision {
  try {
    const parsed = JSON.parse(rawJson);

    // Validate required fields
    if (!parsed.status || !["approved", "denied", "counter_offer"].includes(parsed.status)) {
      throw new Error("Invalid or missing 'status' field");
    }

    if (typeof parsed.amount !== "number" || parsed.amount < 0) {
      throw new Error("Invalid 'amount' field");
    }

    if (typeof parsed.interest_rate !== "number" || parsed.interest_rate < 0) {
      throw new Error("Invalid 'interest_rate' field");
    }

    if (typeof parsed.duration_days !== "number" || parsed.duration_days < 0) {
      throw new Error("Invalid 'duration_days' field");
    }

    if (typeof parsed.message !== "string" || parsed.message.length === 0) {
      throw new Error("Invalid or missing 'message' field");
    }

    // Enforce max loan cap
    if (parsed.amount > MAX_LOAN_AMOUNT) {
      console.warn(`⚠️  LLM tried to approve ${parsed.amount} USDT. Capping at ${MAX_LOAN_AMOUNT}.`);
      parsed.amount = MAX_LOAN_AMOUNT;
    }

    return {
      status: parsed.status,
      amount: parsed.amount,
      interest_rate: parsed.interest_rate,
      duration_days: parsed.duration_days,
      message: parsed.message,
    };
  } catch (error) {
    console.error("❌ Failed to parse LLM JSON:", rawJson);
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

/**
 * Formats the loan decision for display
 */
export function formatLoanDecision(decision: LoanDecision): string {
  const statusEmoji = {
    approved: "✅",
    denied: "❌",
    counter_offer: "🔄",
  };

  const emoji = statusEmoji[decision.status] || "📋";

  const lines = [
    "",
    "╔═══════════════════ AEGIS DECISION ═══════════════════╗",
    `║ ${emoji} Status: ${decision.status.toUpperCase().padEnd(42)} ║`,
    "║─────────────────────────────────────────────────────║",
  ];

  if (decision.status !== "denied") {
    lines.push(`║ 💰 Loan Amount: ${decision.amount.toString().padEnd(35)} USDT ║`);
    lines.push(`║ 📈 Interest Rate: ${decision.interest_rate.toFixed(2).padEnd(33)}% ║`);
    lines.push(`║ ⏱️  Duration: ${decision.duration_days.toString().padEnd(39)} days ║`);
    lines.push("║─────────────────────────────────────────────────────────║");

    const totalRepayment = decision.amount * (1 + decision.interest_rate / 100);
    lines.push(`║ 💵 Total Repayment: ${totalRepayment.toFixed(2).padEnd(30)} USDT ║`);
    lines.push("║─────────────────────────────────────────────────────────║");
  }

  // Word-wrap the message
  const messageLines = wrapText(decision.message, 53);
  lines.push("║ 💬 Message:                                         ║");
  messageLines.forEach((line) => {
    lines.push(`║    ${line.padEnd(52)} ║`);
  });

  lines.push("╚═════════════════════════════════════════════════════╝");
  lines.push("");

  return lines.join("\n");
}

/**
 * Helper to wrap text for display
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxWidth) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);

  return lines;
}

/**
 * Helper to get chain name from chain ID
 */
function getChainName(chainId: number): string {
  const chains: Record<number, string> = {
    1: "Ethereum Mainnet",
    5: "Goerli",
    80002: "Polygon Amoy",
    84532: "Base Sepolia",
    137: "Polygon",
    8453: "Base",
  };
  return chains[chainId] || `Unknown Chain ${chainId}`;
}

// ===========================================
// VALIDATION & SAFETY CHECKS
// ===========================================

/**
 * Validates that a loan decision is safe to execute
 */
export function isLoanDecisionSafe(decision: LoanDecision): {
  safe: boolean;
  reason?: string;
} {
  // Check max loan cap
  if (decision.amount > MAX_LOAN_AMOUNT) {
    return {
      safe: false,
      reason: `Amount ${decision.amount} exceeds maximum ${MAX_LOAN_AMOUNT} USDT`,
    };
  }

  // Denied loans should have 0 values
  if (decision.status === "denied" && decision.amount > 0) {
    return {
      safe: false,
      reason: "Denied loan cannot have non-zero amount",
    };
  }

  // Approved/counter_offer must have valid terms
  if (decision.status !== "denied") {
    if (decision.amount <= 0) {
      return { safe: false, reason: "Loan amount must be positive" };
    }
    if (decision.interest_rate < 0 || decision.interest_rate > 100) {
      return { safe: false, reason: "Interest rate must be between 0-100%" };
    }
    if (decision.duration_days <= 0 || decision.duration_days > 365) {
      return { safe: false, reason: "Duration must be between 1-365 days" };
    }
  }

  return { safe: true };
}

// ===========================================
// QUICK DECISION (WITHOUT LLM) - FALLBACK
// ===========================================

/**
 * Generates a deterministic loan decision without calling LLM
 * Used as fallback if OpenAI API is unavailable
 */
export function quickDecision(
  loanRequest: LoanRequest,
  creditData: CreditData
): LoanDecision {
  const { riskScore } = creditData;

  // REJECT tier
  if (riskScore > 80) {
    return {
      status: "denied",
      amount: 0,
      interest_rate: 0,
      duration_days: 0,
      message: `Your wallet shows ${creditData.txCount} transactions. Build on-chain history and reapply.`,
    };
  }

  // POOR tier
  if (riskScore > 60) {
    return {
      status: "counter_offer",
      amount: Math.min(50, loanRequest.requestedAmount),
      interest_rate: 22,
      duration_days: 7,
      message: "Your credit is weak. Accepting a micro-loan of 50 USDT at 22% for 7 days. Prove yourself.",
    };
  }

  // FAIR tier
  if (riskScore > 40) {
    const offerAmount = Math.min(
      Math.floor(loanRequest.requestedAmount * 0.5),
      200
    );
    return {
      status: "counter_offer",
      amount: offerAmount,
      interest_rate: 12,
      duration_days: 14,
      message: `Your wallet is moderately active. Counter-offer: ${offerAmount} USDT at 12% for 14 days.`,
    };
  }

  // GOOD tier
  if (riskScore > 20) {
    const offerAmount = Math.min(
      Math.floor(loanRequest.requestedAmount * 0.8),
      400
    );
    return {
      status: "approved",
      amount: offerAmount,
      interest_rate: 6,
      duration_days: 30,
      message: `Strong wallet history. Approved for ${offerAmount} USDT at 6% for 30 days.`,
    };
  }

  // EXCELLENT tier
  const offerAmount = Math.min(loanRequest.requestedAmount, MAX_LOAN_AMOUNT);
  return {
    status: "approved",
    amount: offerAmount,
    interest_rate: 3,
    duration_days: 60,
    message: "Exceptional wallet. Full approval at premium terms. Welcome to Aegis.",
  };
}
