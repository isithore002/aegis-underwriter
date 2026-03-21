import {
  initTreasury,
  getTreasuryInfo,
  formatTreasuryInfo,
  hasSufficientBalance,
} from "./treasury";

/**
 * Test script for Treasury/WDK initialization
 * Usage: npx ts-node src/testTreasury.ts
 *
 * Prerequisites:
 * 1. Deploy MockUSDT: npx hardhat run scripts/deployMockUSDT.ts --network polygonAmoy
 * 2. Deploy AegisLedger: npx hardhat run scripts/deploy.ts --network polygonAmoy
 * 3. Update .env with deployed contract addresses
 * 4. Mint some MockUSDT to the treasury wallet
 */

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           TREASURY/WDK - INITIALIZATION TEST               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Check environment variables
  console.log("\n1️⃣ Checking environment configuration...");

  const required = [
    "AGENT_PRIVATE_KEY",
    "MOCK_USDT_ADDRESS",
    "LEDGER_CONTRACT_ADDRESS",
  ];

  const missing: string[] = [];

  for (const key of required) {
    const value = process.env[key];
    if (!value || value.includes("_your_") || value.includes("_deployed_")) {
      missing.push(key);
      console.log(`   ❌ ${key}: Not configured`);
    } else {
      console.log(`   ✓ ${key}: ${value.slice(0, 20)}...`);
    }
  }

  if (missing.length > 0) {
    console.error("\n❌ Missing required environment variables:");
    console.error("   Please configure these in .env:\n");

    if (missing.includes("MOCK_USDT_ADDRESS")) {
      console.error("   1. Deploy MockUSDT:");
      console.error("      npx hardhat run scripts/deployMockUSDT.ts --network polygonAmoy\n");
    }

    if (missing.includes("LEDGER_CONTRACT_ADDRESS")) {
      console.error("   2. Deploy AegisLedger:");
      console.error("      npx hardhat run scripts/deploy.ts --network polygonAmoy\n");
    }

    if (missing.includes("AGENT_PRIVATE_KEY")) {
      console.error("   3. Set your private key in .env");
      console.error("      AGENT_PRIVATE_KEY=\"0x...\"\n");
    }

    process.exit(1);
  }

  // Initialize treasury
  console.log("\n2️⃣ Initializing treasury wallet...");

  try {
    await initTreasury();
    console.log("   ✅ Treasury initialized successfully");
  } catch (error) {
    console.error("\n❌ Treasury initialization failed:");
    console.error(error);
    process.exit(1);
  }

  // Get treasury info
  console.log("\n3️⃣ Fetching treasury balances...");

  try {
    const info = await getTreasuryInfo();
    console.log(formatTreasuryInfo(info));
  } catch (error) {
    console.error("❌ Failed to fetch treasury info:");
    console.error(error);
    process.exit(1);
  }

  // Check if ready to disburse loans
  console.log("\n4️⃣ Checking loan disbursement readiness...");

  try {
    const canDisburse100 = await hasSufficientBalance(100);
    const canDisburse500 = await hasSufficientBalance(500);

    console.log(`   Can disburse 100 USDT: ${canDisburse100 ? "✅ Yes" : "❌ No"}`);
    console.log(`   Can disburse 500 USDT: ${canDisburse500 ? "✅ Yes" : "❌ No"}`);

    if (!canDisburse100) {
      console.log("\n   ⚠️  Treasury has insufficient USDT balance.");
      console.log("   To mint MockUSDT to your treasury, run:");
      console.log(`   npx hardhat run scripts/mintMockUSDT.ts --network polygonAmoy`);
    }
  } catch (error) {
    console.error("❌ Balance check failed:");
    console.error(error);
  }

  console.log("\n✅ Treasury test completed successfully\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });
