"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║           AEGIS UNDERWRITER - CONTRACT DEPLOYMENT          ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");
    // Get deployer account
    const [deployer] = await hardhat_1.ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    const balance = await hardhat_1.ethers.provider.getBalance(deployerAddress);
    console.log(`📍 Network: ${hardhat_1.network.name}`);
    console.log(`👤 Deployer: ${deployerAddress}`);
    console.log(`💰 Balance: ${hardhat_1.ethers.formatEther(balance)} ETH/MATIC\n`);
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
    const AegisLedger = await hardhat_1.ethers.getContractFactory("AegisLedger");
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
    const deploymentInfo = {
        network: hardhat_1.network.name,
        chainId: Number((await hardhat_1.ethers.provider.getNetwork()).chainId),
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
    const deploymentFile = path.join(deploymentsDir, `${hardhat_1.network.name}-${Date.now()}.json`);
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
    console.log(`   npx hardhat verify --network ${hardhat_1.network.name} ${ledgerAddress} "${agentAddress}" "${usdtAddress}"`);
    console.log("");
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=deploy.js.map