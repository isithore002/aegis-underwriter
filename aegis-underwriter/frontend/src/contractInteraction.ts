/**
 * Smart Contract Interaction Module
 * Handles direct calls to AegisLedger and USDT contracts via connected wallet using Wagmi
 */

import { getAccount, switchChain, writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { polygonAmoy } from 'wagmi/chains';
import { BaseError } from 'wagmi';

// Network configuration
const POLYGON_AMOY_CHAIN_ID = 80002;

// Contract ABIs
export const USDT_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const AEGIS_LEDGER_ABI = [
  {
    type: 'function',
    name: 'repayLoan',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * Requests user to switch to Polygon Amoy network
 */
export async function switchToPolygonAmoy(wagmiConfig: any): Promise<boolean> {
  try {
    await switchChain(wagmiConfig, { chainId: polygonAmoy.id });
    return true;
  } catch (error) {
    console.error('Failed to switch network:', error);
    return false;
  }
}

/**
 * Approves USDT spending for the AegisLedger contract
 */
export async function approveUSDT(
  wagmiConfig: any,
  usdtAddress: string,
  ledgerAddress: string,
  amount: number
): Promise<string | null> {
  try {
    const amountWei = BigInt(amount * 1e6); // USDT has 6 decimals

    console.log(`🔐 Approving ${amount} USDT for AegisLedger...`);

    const hash = await writeContract(wagmiConfig, {
      address: usdtAddress as `0x${string}`,
      abi: USDT_ABI,
      functionName: 'approve',
      args: [ledgerAddress as `0x${string}`, amountWei],
    });

    console.log(`📝 Approval TX: ${hash}`);

    const receipt = await waitForTransactionReceipt(wagmiConfig, {
      hash,
    });

    console.log(`✅ Approval confirmed in block ${receipt?.blockNumber}`);
    return hash;
  } catch (error) {
    console.error('Approval failed:', error);
    if (error instanceof BaseError) {
      throw new Error(error.shortMessage || error.message);
    }
    throw error;
  }
}

/**
 * Calls repayLoan() function on AegisLedger contract
 */
export async function repayLoanOnChain(
  wagmiConfig: any,
  ledgerAddress: string
): Promise<string | null> {
  try {
    console.log(`💰 Calling repayLoan()...`);

    const hash = await writeContract(wagmiConfig, {
      address: ledgerAddress as `0x${string}`,
      abi: AEGIS_LEDGER_ABI,
      functionName: 'repayLoan',
    });

    console.log(`📝 Repayment TX: ${hash}`);

    const receipt = await waitForTransactionReceipt(wagmiConfig, {
      hash,
    });

    console.log(`✅ Repayment confirmed in block ${receipt?.blockNumber}`);
    return hash;
  } catch (error) {
    console.error('Repayment failed:', error);
    if (error instanceof BaseError) {
      throw new Error(error.shortMessage || error.message);
    }
    throw error;
  }
}

/**
 * Executes full repayment flow: approve + repay
 */
export async function executeFullRepayment(
  wagmiConfig: any,
  usdtAddress: string,
  ledgerAddress: string,
  amount: number
): Promise<{ approveTxHash: string; repayTxHash: string }> {
  try {
    // Step 1: Check if on correct chain
    const account = getAccount(wagmiConfig);
    if (account.chainId !== POLYGON_AMOY_CHAIN_ID) {
      console.log('🔄 Switching to Polygon Amoy...');
      const switched = await switchToPolygonAmoy(wagmiConfig);
      if (!switched) {
        throw new Error('Failed to switch to Polygon Amoy network');
      }
    }

    // Step 2: Approve USDT
    const approveTxHash = await approveUSDT(wagmiConfig, usdtAddress, ledgerAddress, amount);
    if (!approveTxHash) {
      throw new Error('USDT approval failed');
    }

    // Step 3: Call repayLoan()
    const repayTxHash = await repayLoanOnChain(wagmiConfig, ledgerAddress);
    if (!repayTxHash) {
      throw new Error('Loan repayment failed');
    }

    return {
      approveTxHash,
      repayTxHash,
    };
  } catch (error) {
    console.error('Full repayment failed:', error);
    throw error;
  }
}

