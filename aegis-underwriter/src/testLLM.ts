import { getCreditData } from "./credit";
import { negotiateLoan, formatLoanDecision, quickDecision, LoanRequest } from "./llm";

/**
 * Test script for LLM Brain
 * Usage: npx ts-node src/testLLM.ts [wallet_address] [requested_amount]
 */

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              LLM BRAIN - STANDALONE TEST                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Parse arguments
  const testWallet = process.argv[2] || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // Vitalik
  const requestedAmount = parseInt(process.argv[3]) || 300;

  console.log(`\n📍 Test Configuration:`);
  console.log(`   Wallet: ${testWallet}`);
  console.log(`   Requested: ${requestedAmount} USDT`);

  // Step 1: Get credit data
  console.log("\n1️⃣ Fetching credit data...");
  let creditData;
  try {
    creditData = await getCreditData(testWallet);
    console.log(`   ✓ Risk Score: ${creditData.riskScore}/100`);
    console.log(`   ✓ Credit Tier: ${creditData.creditTier}`);
  } catch (error) {
    console.error("❌ Failed to fetch credit data:", error);
    process.exit(1);
  }

  // Step 2: Create loan request
  const loanRequest: LoanRequest = {
    requestedAmount: requestedAmount,
    requestedDuration: 30,
    userMessage: "I need liquidity for yield farming opportunities.",
  };

  // Step 3: Test with OpenAI (if API key is set)
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-...") {
    console.log("\n2️⃣ Testing LLM negotiation (OpenAI GPT-4)...");
    try {
      const decision = await negotiateLoan(loanRequest, creditData);
      console.log("\n3️⃣ LLM Decision:");
      console.log(formatLoanDecision(decision));

      console.log("4️⃣ Raw JSON:");
      console.log(JSON.stringify(decision, null, 2));
    } catch (error) {
      console.error("\n❌ LLM negotiation failed:");
      console.error(error);
      console.log("\n⚠️  Falling back to quick decision...");
    }
  } else {
    console.log("\n⚠️  OPENAI_API_KEY not configured, using fallback...");
  }

  // Step 4: Always show quick decision for comparison
  console.log("\n5️⃣ Deterministic Decision (No LLM):");
  const quickDec = quickDecision(loanRequest, creditData);
  console.log(formatLoanDecision(quickDec));

  console.log("✅ LLM Brain test completed\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
