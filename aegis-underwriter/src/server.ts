import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { getCreditData, formatCreditSummary } from "./credit";
import { negotiateLoan, quickDecision, formatLoanDecision, LoanRequest } from "./llm";
import { initTreasury, getTreasuryInfo, disburseFunds, getRepaymentDetails, verifyLoanRepayment, collectRepayment } from "./treasury";

dotenv.config();

const app = express();
const PORT = 3001;

// Hardcoded contract addresses (fallback + production addresses)
const USDT_ADDRESS = process.env.MOCK_USDT_ADDRESS || "0x1f284415bA39067cFC39545c3bcfae1730BEB326";
const LEDGER_ADDRESS = process.env.LEDGER_CONTRACT_ADDRESS || "0x9274Dc7Bc8fd3B49f0cc3CaE1340fFf65D5f5655";

// Validate addresses are loaded
if (!USDT_ADDRESS || !LEDGER_ADDRESS) {
  console.error("❌ CRITICAL: Contract addresses not loaded!");
  console.error(`USDT: ${USDT_ADDRESS}`);
  console.error(`LEDGER: ${LEDGER_ADDRESS}`);
  process.exit(1);
}

// Log contract addresses on startup
console.log(`\n💰 Contract Addresses Loaded:`);
console.log(`   USDT: ${USDT_ADDRESS}`);
console.log(`   Ledger: ${LEDGER_ADDRESS}\n`);

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
 * Now accepts { message: string, walletAddress?: string }
 */
app.post("/api/chat", async (req, res) => {
  const { message, walletAddress } = req.body;

  console.log(`[CHAT] Message: ${message}`);
  if (walletAddress) {
    console.log(`[WALLET] Connected: ${walletAddress}`);
  }

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
      console.log(`\n🔍 [LOAN ENDPOINT] Processing loan request...`);
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

      console.log(`[LOAN] Full decision object:`, JSON.stringify(decision));
      console.log(`[LOAN] Decision Status: "${decision.status}" (Type: ${typeof decision.status})`);
      console.log(`[LOAN] Is counter_offer: ${decision.status === "counter_offer"}`);
      console.log(`[LOAN] Is approved: ${decision.status === "approved"}`);
      console.log(`[LOAN] Should disburse: ${decision.status !== "denied"}`);

      // If loan is NOT denied, actually disburse the funds
      if (decision.status !== "denied") {
        try {
          console.log(`\n💸 [DISBURSEMENT] Processing loan for ${addressMatch[0]}...`);
          console.log(`   Loan Amount: ${decision.amount} USDT @ ${decision.interest_rate}% interest`);

          // Get treasury balance BEFORE disbursement
          await initTreasury();
          const treasuryBefore = await getTreasuryInfo();
          console.log(`   Treasury Balance BEFORE: ${treasuryBefore.usdtBalanceFormatted} USDT`);

          // Disburse funds
          const disbursementResult = await disburseFunds(addressMatch[0], decision);

          if (disbursementResult.success) {
            // Get updated treasury balance AFTER disbursement
            const treasuryAfter = await getTreasuryInfo();
            console.log(`   Treasury Balance AFTER: ${treasuryAfter.usdtBalanceFormatted} USDT`);
            console.log(`   Difference: ${treasuryBefore.usdtBalanceFormatted} → ${treasuryAfter.usdtBalanceFormatted}`);

            return res.json({
              reply: `📋 LOAN APPLICATION RESULT\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\nRequested: ${requestedAmount} USDT\nCredit Tier: ${creditData.creditTier}\nRisk Score: ${creditData.riskScore}/100\n\n${statusEmoji} DECISION: ${decision.status.toUpperCase()}\n${decisionText}\n\n💬 "${decision.message}"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💸 FUNDS DISBURSED SUCCESSFULLY!\n\n• Amount Sent: ${decision.amount} USDT\n• TX Hash: [TX:${disbursementResult.transactionHash}]\n• Ledger TX: [TX:${disbursementResult.loanRecordHash}]\n• Treasury Balance: ${treasuryAfter.usdtBalanceFormatted} USDT`,
              type: "success",
              txHash: disbursementResult.transactionHash,
              loanRecordHash: disbursementResult.loanRecordHash,
            });
          } else {
            return res.json({
              reply: `📋 LOAN APPLICATION RESULT\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\nRequested: ${requestedAmount} USDT\nCredit Tier: ${creditData.creditTier}\nRisk Score: ${creditData.riskScore}/100\n\n${statusEmoji} DECISION: ${decision.status.toUpperCase()}\n${decisionText}\n\n💬 "${decision.message}"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ DISBURSEMENT FAILED!\n\nError: ${disbursementResult.error}\n\nPlease try again or contact support.`,
              type: "error",
            });
          }
        } catch (disbursementError) {
          console.error("Disbursement error:", disbursementError);
          return res.json({
            reply: `📋 LOAN APPLICATION RESULT\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\nRequested: ${requestedAmount} USDT\nCredit Tier: ${creditData.creditTier}\nRisk Score: ${creditData.riskScore}/100\n\n${statusEmoji} DECISION: ${decision.status.toUpperCase()}\n${decisionText}\n\n💬 "${decision.message}"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ DISBURSEMENT PENDING\n\nLoan approved but disbursement system offline.\nError: ${disbursementError instanceof Error ? disbursementError.message : "Unknown error"}`,
            type: "warning",
          });
        }
      }

      // Denied loans - no disbursement needed
      return res.json({
        reply: `📋 LOAN APPLICATION RESULT\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\nRequested: ${requestedAmount} USDT\nCredit Tier: ${creditData.creditTier}\nRisk Score: ${creditData.riskScore}/100\n\n❌ DECISION: DENIED\n${decisionText}\n\n💬 "${decision.message}"`,
        type: "error",
      });
    }

    // Verify repayment command (check BEFORE repay to avoid matching "repay" in "verify repay")
    if (lowerMsg.includes("verify repay") || lowerMsg.includes("verify loan")) {
      console.log(`\n✅ [VERIFY REPAYMENT] Checking loan status...`);
      const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);

      if (!addressMatch) {
        return res.json({
          reply: "❌ No wallet address found.\n\nUsage: verify repay 0xYourWallet",
          type: "warning",
        });
      }

      try {
        await initTreasury();
        const verification = await verifyLoanRepayment(addressMatch[0]);

        if (!verification.success) {
          return res.json({
            reply: `❌ VERIFICATION ERROR\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\nError: ${verification.error}`,
            type: "error",
          });
        }

        if (verification.isRepaid) {
          // Collect the repayment and refresh treasury balance
          const repaymentCollection = await collectRepayment(addressMatch[0]);

          // Get treasury balance BEFORE waiting
          const treasuryBefore = await getTreasuryInfo();
          console.log(`\n💰 [VERIFY] Treasury balance BEFORE delay: ${treasuryBefore.usdtBalanceFormatted} USDT`);

          // Give the blockchain a moment to finalize the transaction
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Get fresh treasury balance after repayment
          const treasuryAfter = await getTreasuryInfo();
          console.log(`💰 [VERIFY] Treasury balance AFTER delay: ${treasuryAfter.usdtBalanceFormatted} USDT`);
          console.log(`💰 [VERIFY] Difference: ${treasuryBefore.usdtBalanceFormatted} → ${treasuryAfter.usdtBalanceFormatted}`);

          if (repaymentCollection.success) {
            console.log(`💰 [VERIFY] Repayment collected: ${repaymentCollection.amount} USDT`);
            return res.json({
              reply: `📋 LOAN REPAYMENT SUCCESSFUL\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ REPAYMENT CONFIRMED!\n\n• Loan Status: ✅ REPAID\n• Repayment Amount Received: ${repaymentCollection.amount} USDT\n• Updated Treasury Balance: ${treasuryAfter.usdtBalanceFormatted} USDT\n• Active: ${verification.isActive ? "Yes" : "No"}\n\n🎉 Your loan has been successfully repaid!\n\n💡 Tip: Check your wallet transaction history for the repayment TX hash to verify on Polygonscan.`,
              type: "success",
            });
          } else {
            console.log(`⚠️ [VERIFY] Repayment collection issue: ${repaymentCollection.error}`);
            return res.json({
              reply: `📋 LOAN REPAYMENT STATUS\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ REPAYMENT CONFIRMED ON-CHAIN!\n\n• Loan Status: ✅ REPAID\n• Updated Treasury Balance: ${treasuryAfter.usdtBalanceFormatted} USDT\n• Active: ${verification.isActive ? "Yes" : "No"}\n\n🎉 Your loan has been successfully repaid!\n\n💡 Tip: Check your wallet transaction history for the repayment TX hash to verify on Polygonscan.`,
              type: "success",
            });
          }
        } else if (verification.isActive) {
          return res.json({
            reply: `⏳ LOAN STILL ACTIVE\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\nStatus: Loan is still active and not yet repaid.\n\nMake sure you:\n1. Approved USDT on the AegisLedger contract\n2. Called the repayLoan() function from your wallet\n3. Transaction was successfully mined\n\nWait a moment and try verifying again.`,
            type: "warning",
          });
        } else {
          return res.json({
            reply: `❓ UNKNOWN LOAN STATUS\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\nNo active loan found for this address.`,
            type: "warning",
          });
        }
      } catch (error) {
        console.error("Verification error:", error);
        return res.json({
          reply: `⚠️ VERIFICATION ERROR\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\nError: ${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again.`,
          type: "error",
        });
      }
    }

    // Repay loan command
    if (lowerMsg.includes("repay") || lowerMsg.includes("repayment")) {
      console.log(`\n💰 [REPAY ENDPOINT] Processing loan repayment...`);
      const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);

      if (!addressMatch) {
        return res.json({
          reply: "❌ No wallet address found.\n\nUsage: repay 0xYourWallet\n\nThis will show your repayment details. You'll then need to approve USDT and call repayLoan() from your connected wallet.",
          type: "warning",
        });
      }

      try {
        console.log(`\n💰 [REPAYMENT] Fetching repayment details for ${addressMatch[0]}...`);

        // Initialize treasury to fetch details
        await initTreasury();
        const repaymentInfo = await getRepaymentDetails(addressMatch[0]);

        if (!repaymentInfo.success) {
          return res.json({
            reply: `❌ REPAYMENT ERROR\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\nError: ${repaymentInfo.error}\n\nTroubleshooting:\n• Make sure you have an active loan\n• Check your wallet address is correct`,
            type: "error",
          });
        }

        return res.json({
          reply: `📋 LOAN REPAYMENT INSTRUCTIONS\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 REPAYMENT DETAILS\n\n• Principal: 50 USDT\n• Interest Rate: ${repaymentInfo.interestRate}% (${(repaymentInfo.interestRate || 0) / 100}%)\n• Amount Due: ${repaymentInfo.amount} USDT\n• Due Date: ${repaymentInfo.dueDate?.toLocaleDateString()}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚀 QUICK REPAY\n\nClick the [Quick Repay] button below to execute repayment automatically:\n1. Switch to Polygon Amoy network\n2. Approve USDT spending\n3. Call repayLoan()\n4. Confirm completion\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📝 OR MANUAL REPAYMENT\n\nIf you prefer to execute manually:\n1. Connect your wallet to Polygon Amoy\n2. Approve ${repaymentInfo.amount} USDT transfer to AegisLedger\n   Contract: ${repaymentInfo.contractAddress}\n3. Call repayLoan() function on the contract\n4. Come back and say "verify repay 0xYourWallet"\n\n🔗 Contract Address: ${repaymentInfo.contractAddress}`,
          type: "info",
          repaymentDetails: {
            amount: repaymentInfo.amount,
            borrowerAddress: addressMatch[0],
            contractAddress: repaymentInfo.contractAddress,
            usdtAddress: USDT_ADDRESS,
            ledgerAddress: LEDGER_ADDRESS,
          },
        });
      } catch (error) {
        console.error("Repayment error:", error);
        return res.json({
          reply: `⚠️ REPAYMENT ERROR\n\nBorrower: ${addressMatch[0].slice(0, 10)}...${addressMatch[0].slice(-6)}\n\nError: ${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again or contact support.`,
          type: "error",
        });
      }
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
        reply: `🛡️ AEGIS COMMAND REFERENCE\n\n📊 CHECK CREDIT\n"check credit 0xYourWallet"\nAnalyzes on-chain history and returns risk score.\n\n💰 APPLY FOR LOAN\n"apply for loan 250 USDT wallet 0xYourWallet"\nSubmits a loan application for AI evaluation.\n\n💵 LOAN REPAYMENT (3-STEP PROCESS)\n\nSTEP 1: Get Details\n"repay 0xYourWallet"\nShows amount due, interest, and contract address.\n\nSTEP 2: Execute Repayment (From Your Wallet)\n1. Switch wallet to Polygon Amoy (Chain ID: 80002)\n2. Approve USDT spending on AegisLedger contract\n3. Call repayLoan() function on the contract\n4. Wait for transaction confirmation\n\nSTEP 3: Verify Completion\n"verify repay 0xYourWallet"\nConfirms your loan has been repaid on-chain.\nShows updated treasury status.\n\n💼 TREASURY STATUS\n"treasury status"\nShows current treasury balance and status.\n\n📖 CREDIT TIERS\n• EXCELLENT (0-20): Up to 500 USDT @ 2-5%\n• GOOD (21-40): Up to 400 USDT @ 5-10%\n• FAIR (41-60): Up to 250 USDT @ 10-18%\n• POOR (61-80): Up to 50 USDT @ 18-25%\n• REJECT (81-100): ❌ Denied\n\n🔗 Transaction hashes in responses are clickable links to OKLink Polygonscan.`,
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
