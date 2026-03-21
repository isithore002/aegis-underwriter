import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Quick script to build transaction history on Polygon Amoy
 * Usage: npx ts-node src/buildHistory.ts [number_of_txs]
 */

async function main() {
  const numTxs = parseInt(process.argv[2]) || 10;
  const privateKey = process.env.AGENT_PRIVATE_KEY;

  if (!privateKey || privateKey === "0x_your_private_key_here") {
    console.error("❌ Set AGENT_PRIVATE_KEY in .env first");
    process.exit(1);
  }

  const rpcUrl = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("\n🔧 Transaction History Builder");
  console.log(`   Wallet: ${wallet.address}`);
  console.log(`   Target: ${numTxs} transactions\n`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} MATIC`);

  if (balance < ethers.parseEther("0.01")) {
    console.error("❌ Insufficient balance. Get MATIC from faucet first.");
    process.exit(1);
  }

  const burnAddress = "0x000000000000000000000000000000000000dEaD";
  const amountPerTx = ethers.parseEther("0.0001"); // Very small amounts

  console.log(`\n🚀 Sending ${numTxs} transactions...`);

  for (let i = 0; i < numTxs; i++) {
    try {
      const tx = await wallet.sendTransaction({
        to: burnAddress,
        value: amountPerTx,
      });

      console.log(`   [${i + 1}/${numTxs}] ${tx.hash}`);
      await tx.wait(1); // Wait for 1 confirmation
    } catch (error) {
      console.error(`   ❌ Transaction ${i + 1} failed:`, error);
      break;
    }
  }

  console.log("\n✅ Transaction history built!");
  console.log("   Wait 30 seconds for RPC to update, then test your credit:\n");
  console.log(`   npx ts-node src/testCredit.ts ${wallet.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
