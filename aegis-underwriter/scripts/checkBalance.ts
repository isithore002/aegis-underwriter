import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const address = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(address);

  console.log("\n💰 Wallet Balance Check");
  console.log("======================");
  console.log(`Address: ${address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} MATIC`);
  console.log(`Wei:     ${balance.toString()}`);

  const minRequired = ethers.parseEther("0.1");
  if (balance < minRequired) {
    console.log("\n⚠️  Insufficient balance for deployments!");
    console.log(`   Need at least: 0.1 MATIC`);
    console.log(`   Get more from: https://faucet.polygon.technology/`);
  } else {
    console.log("\n✅ Sufficient balance for deployments");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
