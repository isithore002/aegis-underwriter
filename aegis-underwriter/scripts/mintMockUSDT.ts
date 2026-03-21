import { ethers } from "hardhat";

/**
 * Mints MockUSDT tokens to the treasury wallet
 * Usage: npx hardhat run scripts/mintMockUSDT.ts --network polygonAmoy
 */

async function main() {
  console.log("\n🪙 Minting MockUSDT to Treasury...\n");

  const [deployer] = await ethers.getSigners();
  const mockUsdtAddress = process.env.MOCK_USDT_ADDRESS;

  if (!mockUsdtAddress || mockUsdtAddress === "0x_deployed_mock_usdt_address") {
    throw new Error("MOCK_USDT_ADDRESS not set in .env. Deploy MockUSDT first.");
  }

  // Get MockUSDT contract
  const mockUsdt = await ethers.getContractAt("MockUSDT", mockUsdtAddress);

  // Treasury address (same as deployer for now)
  const treasuryAddress = await deployer.getAddress();

  console.log(`📍 MockUSDT Contract: ${mockUsdtAddress}`);
  console.log(`👤 Treasury Address: ${treasuryAddress}`);

  // Check current balance
  const currentBalance = await mockUsdt.balanceOf(treasuryAddress);
  console.log(`💰 Current Balance: ${ethers.formatUnits(currentBalance, 6)} USDT`);

  // Mint amount: 10,000 USDT (enough for testing)
  const mintAmount = ethers.parseUnits("10000", 6);

  console.log(`\n🔨 Minting ${ethers.formatUnits(mintAmount, 6)} USDT...`);

  const tx = await mockUsdt.mint(treasuryAddress, mintAmount);
  console.log(`📝 Transaction: ${tx.hash}`);

  await tx.wait();
  console.log(`✅ Minting confirmed`);

  // Check new balance
  const newBalance = await mockUsdt.balanceOf(treasuryAddress);
  console.log(`\n💵 New Balance: ${ethers.formatUnits(newBalance, 6)} USDT`);

  console.log("\n✅ Treasury is now funded and ready to disburse loans!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
