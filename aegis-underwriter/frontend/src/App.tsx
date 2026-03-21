import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { QuickRepayButton } from './QuickRepayButton';
import './index.css';

interface Message {
  id: number;
  type: 'user' | 'system' | 'error' | 'success' | 'warning';
  content: string;
  timestamp: string;
  repaymentDetails?: {
    amount: number;
    borrowerAddress: string;
    contractAddress: string;
    usdtAddress?: string;
    ledgerAddress?: string;
  };
}

/**
 * Generates a Polygonscan URL for a transaction hash
 */
function generatePolygonscanUrl(txHash: string): string {
  // Polygon Amoy testnet uses OKLink explorer
  return `https://www.oklink.com/amoy/tx/${txHash}`;
}

/**
 * Formats transaction hash for display (shortened with ellipsis)
 */
function formatTxHash(txHash: string): string {
  return `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
}

/**
 * Parses message content and renders transaction hashes as clickable links
 * Format: [TX:0x...] will become a clickable link
 */
function renderMessageContent(content: string) {
  const parts = content.split(/(\[TX:[a-fA-F0-9x]+\])/);

  return parts.map((part, idx) => {
    const txMatch = part.match(/\[TX:(0x[a-fA-F0-9]{64})\]/);
    if (txMatch) {
      const fullHash = txMatch[1];
      const displayHash = formatTxHash(fullHash);
      return (
        <a
          key={idx}
          href={generatePolygonscanUrl(fullHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-link"
          title={`View on Polygonscan: ${fullHash}`}
        >
          {displayHash}
        </a>
      );
    }
    return part;
  });
}

const COMMANDS = [
  { name: 'credit <wallet>', desc: 'Check on-chain credit score' },
  { name: 'loan <amount> <wallet>', desc: 'Apply for a loan (1-500 USDT)' },
  { name: 'treasury', desc: 'View treasury status' },
  { name: 'help', desc: 'Show all commands' },
];

const CREDIT_TIERS = [
  { tier: 'EXCELLENT', range: '0-20', limit: '500 USDT', rate: '2-5%', color: 'var(--green)' },
  { tier: 'GOOD', range: '21-40', limit: '400 USDT', rate: '5-10%', color: 'var(--cyan)' },
  { tier: 'FAIR', range: '41-60', limit: '250 USDT', rate: '10-18%', color: 'var(--yellow)' },
  { tier: 'POOR', range: '61-80', limit: '50 USDT', rate: '18-25%', color: 'var(--red)' },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ loans: 0, volume: '0', treasury: '---' });
  const [copied, setCopied] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Wagmi hooks for wallet connection
  const { address: userAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const handleWalletClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      // Connect using the first available connector (injected MetaMask)
      const injectedConnector = connectors[0];
      if (injectedConnector) {
        connect({ connector: injectedConnector });
      }
    }
  };

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userAddress) {
      navigator.clipboard.writeText(userAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const fetchTreasury = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/treasury');
        setStats(prev => ({ ...prev, treasury: res.data.usdtBalance }));
      } catch {
        setStats(prev => ({ ...prev, treasury: 'Offline' }));
      }
    };
    fetchTreasury();
  }, []);

  const getTimestamp = () => {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  };

  const addMessage = (type: Message['type'], content: string, repaymentDetails?: Message['repaymentDetails']) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type,
      content,
      timestamp: getTimestamp(),
      repaymentDetails
    }]);
  };

  const processCommand = async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();

    if (trimmed === 'clear' || trimmed === 'cls') {
      setMessages([]);
      return;
    }

    if (trimmed === 'help' || trimmed === '?') {
      addMessage('system', `COMMAND REFERENCE

credit <wallet>        - Check on-chain credit score
loan <amount> <wallet> - Apply for USDT loan (max 500)
repay <wallet>         - Get repayment instructions
verify repay <wallet>  - Confirm loan repayment
treasury               - Display treasury balance
status                 - System status check
clear                  - Clear messages
help                   - Show this help

CREDIT TIERS:
  EXCELLENT (0-20)  - Up to 500 USDT @ 2-5%
  GOOD (21-40)      - Up to 400 USDT @ 5-10%
  FAIR (41-60)      - Up to 250 USDT @ 10-18%
  POOR (61-80)      - Up to 50 USDT @ 18-25%
  REJECT (81-100)   - Application denied`);
      return;
    }

    if (trimmed === 'status') {
      addMessage('system', `SYSTEM STATUS

Agent: ONLINE
Network: Polygon Amoy (80002)
Oracle: Connected
Treasury: Active
Timestamp: ${new Date().toISOString()}`);
      return;
    }

    if (trimmed === 'treasury' || trimmed === 'balance') {
      setIsProcessing(true);
      try {
        const res = await axios.get('http://localhost:3001/api/treasury');
        setStats(prev => ({ ...prev, treasury: res.data.usdtBalance }));
        addMessage('success', `TREASURY STATUS

USDT Balance: ${res.data.usdtBalance}
Native Balance: ${res.data.nativeBalance || '---'}
Status: ONLINE
Network: Polygon Amoy (80002)`);
      } catch {
        addMessage('warning', `TREASURY STATUS

Status: OFFLINE (Backend not running)
Run: npm run server`);
      }
      setIsProcessing(false);
      return;
    }

    if (trimmed.startsWith('credit') || trimmed.startsWith('check')) {
      const walletMatch = cmd.match(/0x[a-fA-F0-9]{40}/);
      if (!walletMatch) {
        addMessage('error', 'Invalid syntax. Usage: credit <wallet_address>');
        return;
      }
      setIsProcessing(true);
      try {
        const res = await axios.post('http://localhost:3001/api/chat', {
          message: `check credit ${walletMatch[0]}`,
          walletAddress: userAddress
        });
        addMessage('success', res.data.reply);
      } catch {
        addMessage('error', 'Failed to connect to backend. Run: npm run server');
      }
      setIsProcessing(false);
      return;
    }

    if (trimmed.startsWith('loan') || trimmed.startsWith('apply') || trimmed.startsWith('borrow')) {
      const walletMatch = cmd.match(/0x[a-fA-F0-9]{40}/);
      const amountMatch = cmd.match(/(\d+)/);
      if (!walletMatch) {
        addMessage('error', 'No wallet address found. Usage: loan <amount> <wallet>');
        return;
      }
      const amount = amountMatch ? parseInt(amountMatch[1]) : 100;
      if (amount <= 0 || amount > 500) {
        addMessage('error', 'Invalid amount. Range: 1-500 USDT');
        return;
      }
      setIsProcessing(true);
      try {
        const res = await axios.post('http://localhost:3001/api/chat', {
          message: `apply for loan ${amount} USDT wallet ${walletMatch[0]}`,
          walletAddress: userAddress
        });
        const msgType = res.data.type === 'success' ? 'success' :
                       res.data.type === 'error' ? 'error' : 'warning';
        addMessage(msgType, res.data.reply);
        setStats(prev => ({ ...prev, loans: prev.loans + 1 }));
      } catch {
        addMessage('error', 'Backend offline. Start server: npm run server');
      }
      setIsProcessing(false);
      return;
    }

    if (trimmed.startsWith('repay')) {
      const walletMatch = cmd.match(/0x[a-fA-F0-9]{40}/);
      if (!walletMatch) {
        addMessage('error', 'No wallet address found. Usage: repay 0xYourWallet');
        return;
      }
      setIsProcessing(true);
      try {
        const res = await axios.post('http://localhost:3001/api/chat', {
          message: `repay ${walletMatch[0]}`,
          walletAddress: userAddress
        });
        const msgType = res.data.type === 'success' ? 'success' :
                       res.data.type === 'error' ? 'error' : 'warning';
        addMessage(msgType, res.data.reply, res.data.repaymentDetails);
      } catch {
        addMessage('error', 'Backend offline. Start server: npm run server');
      }
      setIsProcessing(false);
      return;
    }

    if (trimmed.startsWith('verify')) {
      const walletMatch = cmd.match(/0x[a-fA-F0-9]{40}/);
      if (!walletMatch) {
        addMessage('error', 'No wallet address found. Usage: verify repay 0xYourWallet');
        return;
      }
      setIsProcessing(true);
      try {
        const res = await axios.post('http://localhost:3001/api/chat', {
          message: `verify repay ${walletMatch[0]}`,
          walletAddress: userAddress
        });
        const msgType = res.data.type === 'success' ? 'success' :
                       res.data.type === 'error' ? 'error' : 'warning';
        addMessage(msgType, res.data.reply);
      } catch {
        addMessage('error', 'Backend offline. Start server: npm run server');
      }
      setIsProcessing(false);
      return;
    }

    if (cmd.match(/0x[a-fA-F0-9]{40}/)) {
      setIsProcessing(true);
      try {
        const res = await axios.post('http://localhost:3001/api/chat', {
          message: cmd,
          walletAddress: userAddress
        });
        addMessage('system', res.data.reply);
      } catch {
        addMessage('error', 'Backend connection failed');
      }
      setIsProcessing(false);
      return;
    }

    addMessage('error', `Unknown command: '${cmd.split(/\s+/)[0]}'. Type 'help' for available commands.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const cmd = input.trim();
    addMessage('user', cmd);
    setInput('');
    await processCommand(cmd);
  };

  const getMessageClass = (type: Message['type']) => {
    switch (type) {
      case 'user': return 'message message-user';
      case 'error': return 'message message-error';
      case 'success': return 'message message-success';
      case 'warning': return 'message message-warning';
      default: return 'message message-system';
    }
  };

  const getContentClass = (type: Message['type']) => {
    switch (type) {
      case 'user': return 'message-content user-text';
      case 'error': return 'message-content error-text';
      case 'success': return 'message-content success-text';
      case 'warning': return 'message-content warning-text';
      default: return 'message-content system-text';
    }
  };

  const getLabel = (type: Message['type']) => {
    switch (type) {
      case 'user': return 'You';
      case 'error': return 'Error';
      case 'success': return 'Success';
      case 'warning': return 'Warning';
      default: return 'Aegis';
    }
  };

  return (
    <div className="app-wrapper">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-header">
            <div className="logo-box">
              <span className="logo-icon">A</span>
            </div>
            <div className="logo-text">
              <div className="logo-title">AEGIS</div>
              <div className="logo-subtitle">UNDERWRITER</div>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-title">NETWORK</div>
          <div className="info-card">
            <div className="info-row">
              <span className="info-label">Chain</span>
              <span className="info-value">Polygon Amoy</span>
            </div>
            <div className="info-row">
              <span className="info-label">Chain ID</span>
              <span className="info-value">80002</span>
            </div>
            <div className="info-row">
              <span className="info-label">Status</span>
              <span className="info-value status-online">
                <span className="status-dot"></span>
                Online
              </span>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-title">TREASURY</div>
          <div className="stat-card">
            <div className="stat-value">{stats.treasury}</div>
            <div className="stat-label">USDT Balance</div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-title">SESSION STATS</div>
          <div className="stats-grid">
            <div className="mini-stat">
              <div className="mini-value">{stats.loans}</div>
              <div className="mini-label">Loans</div>
            </div>
            <div className="mini-stat">
              <div className="mini-value">{messages.length}</div>
              <div className="mini-label">Messages</div>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="footer-text">Tether Hackathon</div>
          <div className="footer-text">Galactica 2026</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <h1 className="header-title">Autonomous AI Lending Agent</h1>
            <span className="header-badge">v1.0.0</span>
          </div>
          <div className="header-right">
            <div className="wallet-section">
              <button onClick={handleWalletClick} className="wallet-button">
                {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Connect Wallet'}
              </button>
              {isConnected && (
                <button
                  onClick={copyToClipboard}
                  className="wallet-copy-button"
                  title="Copy full wallet address"
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              )}
            </div>
            <div className="header-stat">
              <span className="header-stat-label">Protocol</span>
              <span className="header-stat-value">Undercollateralized</span>
            </div>
            <div className="header-stat">
              <span className="header-stat-label">Max Loan</span>
              <span className="header-stat-value">500 USDT</span>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="messages-area">
          <div className="messages-container" ref={messagesRef}>
            {messages.length === 0 && (
              <>
                {/* Welcome Banner */}
                <div className="welcome-banner">
                  <div className="welcome-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div className="welcome-text">
                    <div className="welcome-title">Welcome to Aegis Underwriter</div>
                    <div className="welcome-desc">
                      AI-powered undercollateralized lending protocol. Check your on-chain credit score and apply for instant USDT loans.
                    </div>
                  </div>
                </div>

                {/* Commands Grid */}
                <div className="section-header">AVAILABLE COMMANDS</div>
                <div className="commands-grid">
                  {COMMANDS.map((cmd, idx) => (
                    <div key={idx} className="command-card">
                      <div className="command-icon">{'>'}</div>
                      <div className="command-info">
                        <div className="command-name">{cmd.name}</div>
                        <div className="command-desc">{cmd.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Credit Tiers */}
                <div className="section-header">CREDIT TIERS</div>
                <div className="tiers-grid">
                  {CREDIT_TIERS.map((tier, idx) => (
                    <div key={idx} className="tier-card" style={{ borderLeftColor: tier.color }}>
                      <div className="tier-header">
                        <span className="tier-name" style={{ color: tier.color }}>{tier.tier}</span>
                        <span className="tier-range">Risk {tier.range}</span>
                      </div>
                      <div className="tier-details">
                        <div className="tier-detail">
                          <span className="detail-label">Limit</span>
                          <span className="detail-value">{tier.limit}</span>
                        </div>
                        <div className="tier-detail">
                          <span className="detail-label">Rate</span>
                          <span className="detail-value">{tier.rate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Start */}
                <div className="quickstart-box">
                  <div className="quickstart-title">Quick Start</div>
                  <div className="quickstart-steps">
                    <div className="step">
                      <span className="step-num">1</span>
                      <span className="step-text">Check your credit score with <code>credit 0xYourWallet</code></span>
                    </div>
                    <div className="step">
                      <span className="step-num">2</span>
                      <span className="step-text">Apply for a loan with <code>loan 100 0xYourWallet</code></span>
                    </div>
                    <div className="step">
                      <span className="step-num">3</span>
                      <span className="step-text">Receive USDT directly to your wallet</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={getMessageClass(msg.type)}>
                <div className="message-header">
                  <span className="message-label">{getLabel(msg.type)}</span>
                  <span className="message-time">{msg.timestamp}</span>
                </div>
                <div className={getContentClass(msg.type)}>{renderMessageContent(msg.content)}</div>
                {msg.repaymentDetails && (
                  <QuickRepayButton
                    repaymentDetails={msg.repaymentDetails}
                    onSuccess={(approveTx, repayTx) => {
                      addMessage('system', `💬 Now verify with: verify repay ${msg.repaymentDetails!.borrowerAddress}`);
                    }}
                    onError={(error) => {
                      addMessage('error', `Quick Repay failed: ${error}`);
                    }}
                  />
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="processing">
                <span className="processing-dot"></span>
                <span className="processing-dot"></span>
                <span className="processing-dot"></span>
                <span>Processing request...</span>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="input-area">
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isProcessing || !isConnected}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="chat-input"
              placeholder={!isConnected ? "Connect wallet to start..." : isProcessing ? "Processing..." : "Enter command (e.g., credit 0x...)"}
            />
          </div>
          <button type="submit" disabled={isProcessing || !input.trim() || !isConnected} className="send-button">
            EXECUTE
          </button>
        </form>
      </main>

      {/* Right Sidebar */}
      <aside className="sidebar-right">
        <div className="sidebar-section">
          <div className="section-title">HOW IT WORKS</div>
          <div className="info-list">
            <div className="info-item">
              <div className="info-num">01</div>
              <div className="info-text">On-chain credit analysis using wallet history</div>
            </div>
            <div className="info-item">
              <div className="info-num">02</div>
              <div className="info-text">AI-powered risk assessment and loan terms</div>
            </div>
            <div className="info-item">
              <div className="info-num">03</div>
              <div className="info-text">Instant USDT disbursement via Tether WDK</div>
            </div>
            <div className="info-item">
              <div className="info-num">04</div>
              <div className="info-text">Automated repayment monitoring</div>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-title">RISK FACTORS</div>
          <div className="factor-list">
            <div className="factor-item">
              <span className="factor-label">Wallet Age</span>
              <div className="factor-bar"><div className="factor-fill" style={{ width: '30%' }}></div></div>
            </div>
            <div className="factor-item">
              <span className="factor-label">TX Count</span>
              <div className="factor-bar"><div className="factor-fill" style={{ width: '25%' }}></div></div>
            </div>
            <div className="factor-item">
              <span className="factor-label">Balance</span>
              <div className="factor-bar"><div className="factor-fill" style={{ width: '25%' }}></div></div>
            </div>
            <div className="factor-item">
              <span className="factor-label">Activity</span>
              <div className="factor-bar"><div className="factor-fill" style={{ width: '20%' }}></div></div>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-title">SMART CONTRACTS</div>
          <div className="contract-list">
            <div className="contract-item">
              <span className="contract-label">AegisLedger</span>
              <span className="contract-status deployed">Deployed</span>
            </div>
            <div className="contract-item">
              <span className="contract-label">MockUSDT</span>
              <span className="contract-status deployed">Deployed</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
