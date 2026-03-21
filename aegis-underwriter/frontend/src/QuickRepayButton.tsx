import { useState } from 'react';
import { useConfig } from 'wagmi';
import { executeFullRepayment } from './contractInteraction';

interface QuickRepayButtonProps {
  repaymentDetails: {
    amount: number;
    borrowerAddress: string;
    contractAddress: string;
    usdtAddress?: string;
    ledgerAddress?: string;
  };
  onSuccess?: (approveTxHash: string, repayTxHash: string) => void;
  onError?: (error: string) => void;
}

/**
 * QuickRepayButton - One-click loan repayment via Wagmi
 * Handles: network switching + USDT approval + repayLoan execution
 */
export function QuickRepayButton({ repaymentDetails, onSuccess, onError }: QuickRepayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'switching' | 'approving' | 'repaying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [transactionHashes, setTransactionHashes] = useState<{ approve?: string; repay?: string }>({});
  const wagmiConfig = useConfig();

  const handleQuickRepay = async () => {
    try {
      setIsLoading(true);
      setStep('idle');
      setErrorMessage('');

      // Validate required addresses
      if (!repaymentDetails.usdtAddress || !repaymentDetails.ledgerAddress) {
        throw new Error(`Missing contract addresses:\nUSDAT: ${repaymentDetails.usdtAddress ? '✓' : '✗'}\nLedger: ${repaymentDetails.ledgerAddress ? '✓' : '✗'}\n\nPlease ensure .env is configured correctly.`);
      }

      // Check wallet is connected
      if (!wagmiConfig) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      // Step 1: Switch network
      setStep('switching');
      console.log('🔄 Switching to Polygon Amoy...');

      // Step 2: Approve & Repay
      setStep('approving');
      console.log('🔐 Approving USDT...');

      const result = await executeFullRepayment(
        wagmiConfig,
        repaymentDetails.usdtAddress,
        repaymentDetails.ledgerAddress,
        repaymentDetails.amount
      );

      setTransactionHashes({
        approve: result.approveTxHash,
        repay: result.repayTxHash,
      });

      setStep('success');
      console.log('✅ Repayment successful!');
      console.log('Approve TX:', result.approveTxHash);
      console.log('Repay TX:', result.repayTxHash);

      if (onSuccess) {
        onSuccess(result.approveTxHash, result.repayTxHash);
      }
    } catch (error) {
      console.error('Repayment failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(errorMsg);
      setStep('error');

      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    switch (step) {
      case 'switching':
        return '🔄 Switching Network...';
      case 'approving':
        return '🔐 Approving USDT...';
      case 'repaying':
        return '💰 Calling repayLoan()...';
      case 'success':
        return '✅ Repayment Successful!';
      case 'error':
        return '❌ Repayment Failed';
      default:
        return '🚀 Quick Repay';
    }
  };

  if (step === 'success') {
    return (
      <div className="quick-repay-container">
        <div className="quick-repay-success">
          <div className="repay-status">✅ Repayment Executed Successfully!</div>
          <div className="repay-txs">
            <div className="repay-tx-row">
              <span className="repay-label">Approval TX:</span>
              <a
                href={`https://amoy.polygonscan.com/tx/${transactionHashes.approve}`}
                target="_blank"
                rel="noopener noreferrer"
                className="repay-tx-link"
              >
                {transactionHashes.approve?.slice(0, 10)}...{transactionHashes.approve?.slice(-6)}
              </a>
            </div>
            <div className="repay-tx-row">
              <span className="repay-label">Repay TX:</span>
              <a
                href={`https://amoy.polygonscan.com/tx/${transactionHashes.repay}`}
                target="_blank"
                rel="noopener noreferrer"
                className="repay-tx-link"
              >
                {transactionHashes.repay?.slice(0, 10)}...{transactionHashes.repay?.slice(-6)}
              </a>
            </div>
          </div>
          <div className="repay-note">💡 Now type: verify repay {repaymentDetails.borrowerAddress}</div>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="quick-repay-container">
        <div className="quick-repay-error">
          <div className="repay-status">❌ Repayment Failed</div>
          <div className="repay-error-msg">{errorMessage}</div>
          <button
            onClick={handleQuickRepay}
            disabled={isLoading}
            className="quick-repay-button quick-repay-retry"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quick-repay-container">
      <button
        onClick={handleQuickRepay}
        disabled={isLoading}
        className={`quick-repay-button ${isLoading ? 'loading' : ''}`}
      >
        {getButtonText()}
      </button>
      {isLoading && (
        <div className="repay-progress">
          <span className="repay-spinner"></span>
          {step === 'approving' && <span> Approve USDT on your wallet...</span>}
          {step === 'repaying' && <span> Confirm repayment...</span>}
          {step === 'switching' && <span> Switch network...</span>}
        </div>
      )}
    </div>
  );
}
