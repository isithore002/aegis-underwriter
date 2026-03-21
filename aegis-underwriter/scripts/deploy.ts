import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deployment script for AegisLedger contract
 * Deploys to Polygon Amoy or Base Sepolia testnet
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network polygonAmoy
 *   npx hardhat run scripts/deploy.ts --network baseSepolia
 */

interface DeploymentInfo {
  network: string;
  chainId: number;
  deployer: string;
  agent: string;
  usdtAddress: string;
  ledgerAddress: string;
  deploymentTimestamp: number;
  transactionHash: string;
}

async function main(): Promise<void> {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           AEGIS UNDERWRITER - CONTRACT DEPLOYMENT          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH/MATIC\n`);

  // Validate environment
  const usdtAddress = process.env.MOCK_USDT_ADDRESS;
  if (!usdtAddress) {
    throw new Error("MOCK_USDT_ADDRESS not set in environment variables");
  }

  // The agent address is the same as deployer (treasury wallet)
  const agentAddress = deployerAddress;

  console.log("📋 Deployment Parameters:");
  console.log(`   Agent (Treasury): ${agentAddress}`);
  console.log(`   USDT Token: ${usdtAddress}`);
  console.log("");

  // Deploy AegisLedger
  console.log("🚀 Deploying AegisLedger contract...");

  const AegisLedger = await ethers.getContractFactory("AegisLedger");
  const aegisLedger = await AegisLedger.deploy(agentAddress, usdtAddress);

  await aegisLedger.waitForDeployment();
  const ledgerAddress = await aegisLedger.getAddress();
  const deploymentTx = aegisLedger.deploymentTransaction();

  console.log(`✅ AegisLedger deployed to: ${ledgerAddress}`);
  console.log(`📝 Transaction hash: ${deploymentTx?.hash}`);

  // Wait for confirmations
  console.log("\n⏳ Waiting for block confirmations...");
  if (deploymentTx) {
    await deploymentTx.wait(3);
    console.log("✅ Confirmed (3 blocks)");
  }

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const deployedAgent = await aegisLedger.agent();
  const deployedUsdt = await aegisLedger.usdtToken();

  if (deployedAgent.toLowerCase() !== agentAddress.toLowerCase()) {
    throw new Error("Agent address mismatch!");
  }
  if (deployedUsdt.toLowerCase() !== usdtAddress.toLowerCase()) {
    throw new Error("USDT address mismatch!");
  }
  console.log("✅ Contract state verified");

  // Save deployment info
  const deploymentInfo: DeploymentInfo = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployerAddress,
    agent: agentAddress,
    usdtAddress: usdtAddress,
    ledgerAddress: ledgerAddress,
    deploymentTimestamp: Math.floor(Date.now() / 1000),
    transactionHash: deploymentTx?.hash || "",
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `${network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📁 Deployment info saved to: ${deploymentFile}`);

  // Print summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                   DEPLOYMENT COMPLETE                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("\n📋 Add this to your .env file:");
  console.log(`   LEDGER_CONTRACT_ADDRESS="${ledgerAddress}"`);

  // Verification command
  console.log("\n🔑 To verify on block explorer, run:");
  console.log(`   npx hardhat verify --network ${network.name} ${ledgerAddress} "${agentAddress}" "${usdtAddress}"`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
