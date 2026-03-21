import { ethers, network } from "hardhat";

/**
 * Deploy MockUSDT for testing on testnets
 * Usage: npx hardhat run scripts/deployMockUSDT.ts --network polygonAmoy
 */

async function main(): Promise<void> {
  console.log("\n🪙 Deploying MockUSDT...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`📍 Network: ${network.name}`);
  console.log(`👤 Deployer: ${await deployer.getAddress()}`);

  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUsdt = await MockUSDT.deploy();
  await mockUsdt.waitForDeployment();

  const address = await mockUsdt.getAddress();
  console.log(`\n✅ MockUSDT deployed to: ${address}`);
  console.log(`\n📋 Add to .env: MOCK_USDT_ADDRESS="${address}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
