import { getCreditData, formatCreditSummary, validateRpcConnection } from "./credit";

/**
 * Test script for Credit Oracle
 * Usage: npx ts-node src/testCredit.ts [wallet_address]
 */

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║          CREDIT ORACLE - STANDALONE TEST                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Test wallet addresses (Polygon Amoy testnet)
  const testWallets = [
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", // Vitalik.eth (active wallet)
    "0x0000000000000000000000000000000000000000", // Burn address (no activity)
  ];

  const walletToTest = process.argv[2] || testWallets[0];

  console.log("\n1️⃣ Validating RPC connection...");
  const isConnected = await validateRpcConnection();

  if (!isConnected) {
    console.error("\n❌ RPC connection failed. Check your RPC_URL in .env");
    process.exit(1);
  }

  console.log("\n2️⃣ Fetching credit data...");
  try {
    const creditData = await getCreditData(walletToTest);

    console.log("\n3️⃣ Credit Report:");
    console.log(formatCreditSummary(creditData));

    console.log("\n4️⃣ Raw JSON Output:");
    console.log(JSON.stringify(creditData, null, 2));

    console.log("\n✅ Credit Oracle test completed successfully");
  } catch (error) {
    console.error("\n❌ Credit Oracle test failed:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
