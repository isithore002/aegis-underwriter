/**
 * Utility functions for Aegis Underwriter
 */

/**
 * Generates a Polygonscan URL for a transaction hash
 * @param txHash Transaction hash
 * @param network Network name (default: 'amoy' for Polygon Amoy testnet)
 * @returns Full URL to transaction on block explorer
 */
export function generatePolygonscanUrl(txHash: string, network: 'mainnet' | 'amoy' = 'amoy'): string {
  if (!txHash || !txHash.startsWith('0x')) {
    return '#';
  }

  if (network === 'amoy') {
    // Polygon Amoy testnet
    return `https://www.oklink.com/amoy/tx/${txHash}`;
  } else {
    // Polygon mainnet
    return `https://polygonscan.com/tx/${txHash}`;
  }
}

/**
 * Formats a transaction hash for display (shortened with ellipsis)
 * @param txHash Full transaction hash
 * @param chars Number of characters to show (default: 8 from start and 6 from end)
 * @returns Shortened transaction hash
 */
export function formatTxHash(txHash: string, chars: number = 8): string {
  if (!txHash || txHash.length < 20) {
    return txHash;
  }
  return `${txHash.slice(0, chars)}...${txHash.slice(-6)}`;
}

/**
 * Extracts all transaction hashes from text
 * @param text Text content to search
 * @returns Array of transaction hashes found
 */
export function extractTxHashes(text: string): string[] {
  const hashPattern = /0x[a-fA-F0-9]{64}/g;
  return text.match(hashPattern) || [];
}
