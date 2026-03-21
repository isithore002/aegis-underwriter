import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { getCreditData, formatCreditSummary } from "./credit";
import { negotiateLoan, quickDecision, formatLoanDecision, LoanRequest } from "./llm";

dotenv.config();

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ===========================================
// TREASURY MOCK (Until contracts are deployed)
// ===========================================

let treasuryBalance = "10,000.00 USDT";

// ===========================================
// API ROUTES
// ===========================================

/**
 * Health check endpoint
 */
app.get("/api/health", (_req, res) => {
  res.json({ status: "online", timestamp: Date.now() });
});

/**
 * Get treasury status
 */
app.get("/api/treasury", async (_req, res) => {
  try {
    // Try to get real treasury info if contracts are deployed
    const { initTreasury, getTreasuryInfo } = await import("./treasury");
    await initTreasury();
    const info = await getTreasuryInfo();
    res.json({
      usdtBalance: `${info.usdtBalanceFormatted} USDT`,
      nativeBalance: info.nativeBalanceFormatted,
      address: info.address,
      chainId: info.chainId,
    });
  } catch {
    // Fallback to mock data
    res.json({
      usdtBalance: treasuryBalance,
      nativeBalance: "---",
      address: process.env.AGENT_PRIVATE_KEY ? "Connected" : "Not configured",
      chainId: 80002,
    });
  }
});

/**
 * Main chat endpoint - processes natural language commands
 */
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "No message provided", type: "error" });
  }

  const lowerMsg = message.toLowerCase();

  try {
    // Check credit command
    if (lowerMsg.includes("check credit") || lowerMsg.includes("credit score")) {
      const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
      if (!addressMatch) {
        return res.json({
          reply: "❌ No wallet address found.\n\nUsage: check credit 0xYourWalletAddress",
          type: "warning",
        });
      }

      const creditData = await getCreditData(addressMatch[0]);
      const summary = formatCreditSummary(creditData);

      return res.json({
        reply: `📊 CREDIT REPORT\n${summary}\nRaw Data:\n• TX Count: ${creditData.txCount}\n• Balance: ${creditData.currentBalanceFormatted}\n• Wallet Age: ~${creditData.walletAgeDays} days\n• Risk Score: ${creditData.riskScore}/100\n• Tier: ${creditData.creditTier}`,
        type: creditData.riskScore <= 60 ? "success" : "warning",
      });
    }

    // Apply for loan command
    if (lowerMsg.includes("apply") || lowerMsg.includes("loan") || lowerMsg.includes("borrow")) {
      const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
      const amountMatch = message.match(/(\d+)\s*(?:usdt|usd|\$)/i) || message.match(/(\d+)/);

      if (!addressMatch) {
        return res.json({
          reply: "❌ No wallet address found.\n\nUsage: apply for loan 250 USDT wallet 0xYourAddress",
          type: "warning",
        });
      }

      const requestedAmount = amountMatch ? parseInt(amountMatch[1]) : 100;

      if (requestedAmount <= 0 || requestedAmount > 500) {
        return res.json({
          reply: `❌ Invalid amount: ${requestedAmount}\n\nLoan range: 1-500 USDT`,
          type: "error",
        });
      }

      // Get credit data first
      const creditData = await getCreditData(addressMatch[0]);

      // Build loan request
      const loanRequest: LoanRequest = {
        requestedAmount,
        requestedDuration: 30,
        userMessage: message,
      };

      // Try LLM negotiation, fallback to quick decision
      let decision;
      try {
        decision = await negotiateLoan(loanRequest, creditData);
      } catch {
        decision = quickDecision(loanRequest, creditData);
      }

      const decisionText = formatLoanDecision(decision);

      const statusEmoji = decision.status === "approved" ? "✅" : decision.status === "denied" ? "❌" : "🔄";

      return res.json({
        reply: `📋 LOAN APPLICATION RESULT\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\nRequested: ${requestedAmount} USDT\nCredit Tier: ${creditData.creditTier}\nRisk Score: ${creditData.riskScore}/100\n\n${statusEmoji} DECISION: ${decision.status.toUpperCase()}\n${decisionText}\n\n💬 "${decision.message}"`,
        type: decision.status === "approved" ? "success" : decision.status === "denied" ? "error" : "warning",
      });
    }

    // Treasury status command
    if (lowerMsg.includes("treasury") || lowerMsg.includes("balance") || lowerMsg.includes("status")) {
      try {
        const { initTreasury, getTreasuryInfo } = await import("./treasury");
        await initTreasury();
        const info = await getTreasuryInfo();

        return res.json({
          reply: `💼 TREASURY STATUS\n\n• Address: ${info.address.slice(0, 16)}...${info.address.slice(-6)}\n• USDT Balance: ${info.usdtBalanceFormatted} USDT\n• Native Balance: ${info.nativeBalanceFormatted} MATIC\n• Chain ID: ${info.chainId}\n• Status: 🟢 ONLINE`,
          type: "success",
        });
      } catch {
        return res.json({
          reply: `💼 TREASURY STATUS\n\n• Status: 🟡 SIMULATION MODE\n• USDT Balance: ${treasuryBalance} (mock)\n• Chain: Polygon Amoy (80002)\n\n⚠️ Deploy contracts to enable real transactions:\nnpx hardhat run scripts/deploy.ts --network polygonAmoy`,
          type: "warning",
        });
      }
    }

    // Help command
    if (lowerMsg.includes("help") || lowerMsg === "?") {
      return res.json({
        reply: `🛡️ AEGIS COMMAND REFERENCE\n\n📊 CHECK CREDIT\n"check credit 0xYourWallet"\nAnalyzes on-chain history and returns risk score.\n\n💰 APPLY FOR LOAN\n"apply for loan 250 USDT wallet 0xYourWallet"\nSubmits a loan application for AI evaluation.\n\n💼 TREASURY STATUS\n"treasury status"\nShows current treasury balance and status.\n\n📖 CREDIT TIERS\n• EXCELLENT (0-20): Up to 500 USDT @ 2-5%\n• GOOD (21-40): Up to 400 USDT @ 5-10%\n• FAIR (41-60): Up to 250 USDT @ 10-18%\n• POOR (61-80): Up to 50 USDT @ 18-25%\n• REJECT (81-100): ❌ Denied`,
        type: "info",
      });
    }

    // Default: try to interpret as wallet address
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      const creditData = await getCreditData(addressMatch[0]);
      return res.json({
        reply: `📊 Auto-detected wallet address. Running credit check...\n\n• Address: ${addressMatch[0].slice(0, 16)}...\n• TX Count: ${creditData.txCount}\n• Balance: ${creditData.currentBalanceFormatted}\n• Risk Score: ${creditData.riskScore}/100\n• Credit Tier: ${creditData.creditTier}\n\nTo apply for a loan, say:\n"apply for loan [amount] USDT wallet ${addressMatch[0]}"`,
        type: creditData.riskScore <= 60 ? "success" : "warning",
      });
    }

    // Unknown command
    return res.json({
      reply: `❓ Command not recognized: "${message}"\n\nTry one of these:\n• "check credit 0xYourWallet"\n• "apply for loan 250 USDT wallet 0xYourWallet"\n• "treasury status"\n• "help"`,
      type: "info",
    });
  } catch (error) {
    console.error("API Error:", error);
    return res.json({
      reply: `❌ Error processing request:\n${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again or check your wallet address.`,
      type: "error",
    });
  }
});

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           AEGIS UNDERWRITER - API SERVER                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 API Endpoints:`);
  console.log(`   GET  /api/health   - Health check`);
  console.log(`   GET  /api/treasury - Treasury status`);
  console.log(`   POST /api/chat     - Chat endpoint`);
  console.log(`\n💡 Start the frontend: cd frontend && npm run dev`);
  console.log(`🌐 Frontend will be at: http://localhost:5173\n`);
});
