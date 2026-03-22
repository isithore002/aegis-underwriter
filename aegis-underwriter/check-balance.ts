import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc-amoy.polygon.technology');
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);

  const usdtAbi = ['function balanceOf(address) view returns (uint256)'];
  const usdt = new ethers.Contract('0x1f284415bA39067cFC39545c3bcfae1730BEB326', usdtAbi, provider);

  const balance = await usdt.balanceOf(wallet.address);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Treasury Address:', wallet.address);
  console.log('USDT Balance:', ethers.formatUnits(balance, 6), 'USDT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

checkBalance().catch(console.error);
