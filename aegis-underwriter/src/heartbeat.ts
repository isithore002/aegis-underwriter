import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { AegisLedger } from "../typechain-types";

dotenv.config();

// ===========================================
// CONFIGURATION
// ===========================================

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const LEDGER_CONTRACT_ADDRESS = process.env.LEDGER_CONTRACT_ADDRESS;
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || "300000"); // 5 minutes

// ===========================================
// STATE & TRACKING
// ===========================================

let ledgerContract: AegisLedger | null = null;
let isRunning = false;
let checkCount = 0;

// Track already-notified defaults to avoid spam
const notifiedDefaults = new Set<string>();

// ===========================================
// HEARTBEAT INITIALIZATION
// ===========================================

/**
 * Initializes the heartbeat monitoring system
 */
async function initHeartbeat(): Promise<void> {
  if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY === "0x_your_private_key_here") {
    throw new Error("AGENT_PRIVATE_KEY not configured");
  }

  if (!LEDGER_CONTRACT_ADDRESS || LEDGER_CONTRACT_ADDRESS === "0x_deployed_ledger_address") {
    throw new Error("LEDGER_CONTRACT_ADDRESS not configured. Deploy AegisLedger first.");
  }

  // Initialize provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);

  // Load contract
  const ledgerArtifact = await import("../artifacts/contracts/AegisLedger.sol/AegisLedger.json");
  ledgerContract = new ethers.Contract(
    LEDGER_CONTRACT_ADDRESS,
    ledgerArtifact.abi,
    wallet
  ) as unknown as AegisLedger;

  console.log("💓 HEARTBEAT: Monitoring system initialized");
  console.log(`   Contract: ${LEDGER_CONTRACT_ADDRESS}`);
  console.log(`   Interval: ${HEARTBEAT_INTERVAL_MS / 1000}s`);
  console.log(`   Agent: ${wallet.address}`);
}

// ===========================================
// DEFAULT CHECKING LOGIC
// ===========================================

/**
 * Checks for defaulted loans and takes action
 */
async function checkForDefaults(): Promise<void> {
  if (!ledgerContract) {
    console.error("❌ Ledger contract not initialized");
    return;
  }

  checkCount++;
  const timestamp = new Date().toISOString();

  try {
    // Fetch all defaulters from the contract
    const [defaulters, amounts] = await ledgerContract.getDefaulters();

    if (defaulters.length === 0) {
      console.log(`[${timestamp}] 💚 Check #${checkCount}: No defaults detected`);
      return;
    }

    // Process each defaulter
    console.log(`\n[${timestamp}] 🚨 DEFAULT ALERT: ${defaulters.length} loan(s) in default\n`);

    for (let i = 0; i < defaulters.length; i++) {
      const defaulter = defaulters[i];
      const amount = amounts[i];

      // Check if we've already notified about this default
      if (notifiedDefaults.has(defaulter)) {
        continue;
      }

      // Get loan details
      const loan = await ledgerContract.getLoan(defaulter);
      const dueDate = new Date(Number(loan.dueDate) * 1000);
      const daysOverdue = Math.floor(
        (Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Print stark warning
      console.log("╔═══════════════════════════════════════════════════════════╗");
      console.log("║                    ⚠️  DEFAULT DETECTED ⚠️                 ║");
      console.log("╚═══════════════════════════════════════════════════════════╝");
      console.log(`Defaulter: ${defaulter}`);
      console.log(`Amount Owed: ${ethers.formatUnits(amount, 6)} USDT`);
      console.log(`Due Date: ${dueDate.toISOString()}`);
      console.log(`Days Overdue: ${daysOverdue}`);
      console.log(`Principal: ${ethers.formatUnits(loan.amount, 6)} USDT`);
      console.log(`Interest Rate: ${Number(loan.interestRate) / 100}%`);
      console.log("\n🚫 CONSEQUENCES:");
      console.log("   • Credit score permanently damaged");
      console.log("   • Future loan applications will be rejected");
      console.log("   • Wallet flagged in Aegis system");
      console.log("═══════════════════════════════════════════════════════════\n");

      // Mark as notified
      notifiedDefaults.add(defaulter);

      // Optionally call markDefault on-chain (emits event for indexers)
      try {
        const tx = await ledgerContract.markDefault(defaulter);
        await tx.wait();
        console.log(`📝 Default marked on-chain: ${tx.hash}\n`);
      } catch (error) {
        console.log(`⚠️  Could not mark default on-chain (may already be marked)\n`);
      }
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ Error checking for defaults:`, error);
  }
}

// ===========================================
// HEARTBEAT CONTROL
// ===========================================

/**
 * Starts the heartbeat monitoring loop
 */
export async function startHeartbeat(): Promise<void> {
  if (isRunning) {
    console.log("⚠️  Heartbeat already running");
    return;
  }

  await initHeartbeat();

  isRunning = true;
  console.log("\n💓 HEARTBEAT: Monitoring started");
  console.log("   Press Ctrl+C to stop\n");

  // Initial check
  await checkForDefaults();

  // Set up interval
  setInterval(async () => {
    if (isRunning) {
      await checkForDefaults();
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stops the heartbeat monitoring loop
 */
export function stopHeartbeat(): void {
  isRunning = false;
  console.log("\n💓 HEARTBEAT: Monitoring stopped");
}

/**
 * Gets heartbeat status
 */
export function getHeartbeatStatus(): {
  running: boolean;
  checkCount: number;
  notifiedDefaultCount: number;
} {
  return {
    running: isRunning,
    checkCount,
    notifiedDefaultCount: notifiedDefaults.size,
  };
}

// ===========================================
// STANDALONE EXECUTION
// ===========================================

/**
 * Run this file directly to start the heartbeat daemon
 * Usage: npx ts-node src/heartbeat.ts
 */
if (require.main === module) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║        AEGIS HEARTBEAT - DEFAULT MONITORING DAEMON         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  startHeartbeat()
    .then(() => {
      // Keep process alive
      console.log("💓 Heartbeat daemon running...\n");
    })
    .catch((error) => {
      console.error("\n❌ Heartbeat initialization failed:");
      console.error(error);
      process.exit(1);
    });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Shutting down heartbeat...");
    stopHeartbeat();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    stopHeartbeat();
    process.exit(0);
  });
}
