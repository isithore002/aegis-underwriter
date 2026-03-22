# 🛡️ Aegis Underwriter - Autonomous AI Lending Protocol

An autonomous AI-powered lending agent on Polygon Amoy testnet that provides undercollateralized loans based on on-chain credit scoring and behavioral analysis.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Network](https://img.shields.io/badge/network-Polygon%20Amoy-purple.svg)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-orange.svg)

---

## 🌟 Features

### 🤖 AI-Powered Lending Decisions
- **Google Gemini Integration**: Advanced AI evaluates creditworthiness and makes lending decisions
- **Dynamic Risk Assessment**: Real-time on-chain analysis for every applicant
- **Smart Counter-Offers**: AI negotiates loan terms based on wallet history

### 🔍 Anti-Sybil Quality Metrics
- **DeFi Interaction Analysis**: Detects genuine protocol engagement
- **Counterparty Diversity Score**: Identifies fake wallets through interaction patterns
- **Bot Detection**: Filters out automated/scripted wallet behavior
- **Quality-Adjusted Risk Scoring**: Combines quantity and quality of transactions

### 💰 Autonomous Loan Management
- **Undercollateralized Loans**: No collateral required - pure trust-based lending
- **On-Chain Credit Scoring**: 0-100 risk score derived from blockchain history
- **Tiered Interest Rates**: 2-25% based on creditworthiness
- **Automated Disbursement**: Instant USDT transfer upon approval
- **Smart Repayment System**: One-click repayment with Wagmi integration

### 🎯 Credit Tiers

| Tier | Risk Score | Max Loan | Interest Rate | Typical Duration |
|------|-----------|----------|---------------|------------------|
| **EXCELLENT** | 0-20 | 500 USDT | 2-5% | 30-90 days |
| **GOOD** | 21-40 | 400 USDT | 5-10% | 14-60 days |
| **FAIR** | 41-60 | 250 USDT | 10-18% | 7-30 days |
| **POOR** | 61-80 | 50 USDT | 18-25% | 7-14 days |
| **REJECT** | 81-100 | 0 USDT | ❌ Denied | N/A |

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │  React + Vite + Wagmi
│   (Port 5173)   │  User wallet connection
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend API   │  Express + TypeScript
│   (Port 3001)   │  Chat endpoint + Treasury
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────────┐
│ Gemini  │ │ Credit Oracle│
│   AI    │ │ (OKLink API) │
└─────────┘ └──────────────┘
         │
         ▼
┌─────────────────┐
│ Smart Contracts │  Polygon Amoy Testnet
│                 │
│ • MockUSDT      │  0x1f284415bA39067cFC39545c3bcfae1730BEB326
│ • AegisLedger   │  0x9274Dc7Bc8fd3B49f0cc3CaE1340fFf65D5f5655
└─────────────────┘
```

---

## 📦 Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Blockchain**: Ethers.js v6
- **AI**: Google Gemini 1.5 Flash
- **On-Chain Data**: OKLink Blockchain Explorer API

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Wallet Integration**: Wagmi + Viem
- **Styling**: CSS3 with custom properties

### Smart Contracts
- **Language**: Solidity 0.8.20
- **Framework**: Hardhat
- **Network**: Polygon Amoy Testnet (Chain ID: 80002)
- **Token Standard**: ERC-20 (MockUSDT)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MetaMask wallet
- Polygon Amoy testnet MATIC (get from [faucet](https://faucet.polygon.technology/))
- Google Gemini API key ([Get free key](https://ai.google.dev/))

### 1. Clone Repository

```bash
git clone https://github.com/isithore002/aegis-underwriter.git
cd aegis-underwriter/aegis-underwriter
```

### 2. Install Dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 3. Configure Environment

Create `.env` file in the root directory:

```env
# Blockchain Configuration
AGENT_PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc-amoy.polygon.technology

# Smart Contract Addresses
MOCK_USDT_ADDRESS=0x1f284415bA39067cFC39545c3bcfae1730BEB326
LEDGER_CONTRACT_ADDRESS=0x9274Dc7Bc8fd3B49f0cc3CaE1340fFf65D5f5655

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Oracle Configuration
OKLINK_API_KEY=your_oklink_api_key_here

# Loan Settings
MAX_LOAN_AMOUNT=500
```

### 4. Build and Run

**Backend:**
```bash
npm run build
npm run server
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Access the app:** http://localhost:5173

---

## 📖 Usage Guide

### Applying for a Loan

1. **Connect Wallet**: Click "Connect Wallet" and approve MetaMask
2. **Check Credit**: Type `check credit 0xYourWallet`
3. **Apply**: Type `apply for loan 250 USDT wallet 0xYourWallet`
4. **Review Decision**: AI evaluates and responds with approval/counter-offer/denial
5. **Receive Funds**: If approved, USDT is instantly transferred to your wallet

### Repaying a Loan

**Option A: One-Click Quick Repay** (Recommended)

1. Type `repay 0xYourWallet`
2. Click the **[Quick Repay]** button
3. Confirm two MetaMask transactions:
   - Approve USDT spending
   - Execute repayLoan()
4. Type `verify repay 0xYourWallet` to confirm

**Option B: Manual Repayment**

1. Type `repay 0xYourWallet` to get contract details
2. Manually approve USDT on contract: `0x9274Dc7Bc8fd3B49f0cc3CaE1340fFf65D5f5655`
3. Call `repayLoan()` function
4. Type `verify repay 0xYourWallet`

### Available Commands

| Command | Description |
|---------|-------------|
| `check credit 0x...` | Analyze on-chain credit score |
| `apply for loan [amount] USDT wallet 0x...` | Submit loan application |
| `repay 0x...` | Get repayment instructions + Quick Repay button |
| `verify repay 0x...` | Confirm loan repayment |
| `treasury` | View treasury balance and status |
| `help` | Show all commands |
| `clear` | Clear chat history |

---

## 🔗 Smart Contracts

### MockUSDT (ERC-20)
**Address**: `0x1f284415bA39067cFC39545c3bcfae1730BEB326`

Standard ERC-20 token for testing. Mint test USDT from the contract.

**Key Functions:**
- `mint(address to, uint256 amount)` - Mint test USDT
- `transfer(address to, uint256 amount)` - Transfer USDT
- `approve(address spender, uint256 amount)` - Approve spending

### AegisLedger
**Address**: `0x9274Dc7Bc8fd3B49f0cc3CaE1340fFf65D5f5655`

Manages loan records and repayment tracking.

**Key Functions:**
- `issueLoan(address borrower, uint256 amount, uint256 interestRateBp, uint256 durationDays)`
- `repayLoan()` - Borrower repays their active loan
- `getLoan(address borrower)` - Get loan details
- `isInDefault(address borrower)` - Check default status

---

## 🧮 Credit Scoring Algorithm

### Risk Score Calculation

```typescript
Base Score: 50

Adjustments:
- Transaction Count: -20 to +30 points
- Wallet Age: -10 to +20 points
- Current Balance: -5 to +10 points
- Quality Metrics: -15 to +15 points

Quality Metrics:
- DeFi Interactions (30%)
- Counterparty Diversity (40%)
- Bot-like Behavior Detection (30%)

Final Score: 0-100 (lower = better creditworthiness)
```

### Quality Scoring Factors

1. **DeFi Interaction Score**
   - Counts interactions with known DeFi protocols
   - Weights: Uniswap, Aave, Compound, SushiSwap, etc.

2. **Counterparty Diversity**
   - Unique addresses interacted with
   - Higher diversity = genuine user behavior

3. **Bot Detection**
   - Extremely regular transaction intervals
   - Very low gas price variance
   - Flags: Bot-like patterns penalized

---

## 🔐 Security Features

✅ **No Private Key Storage**: Agent wallet managed via environment variables
✅ **Active Loan Validation**: Prevents double-lending to same borrower
✅ **Maximum Loan Caps**: Hard-coded 500 USDT limit
✅ **Interest Rate Bounds**: 2-25% enforced on-chain
✅ **Gas Estimation**: Prevents out-of-gas failures
✅ **Transaction Receipts**: All blockchain operations verified

---

## 📡 API Endpoints

### `POST /api/chat`

Main chat endpoint for all commands.

**Request:**
```json
{
  "message": "apply for loan 250 USDT wallet 0x...",
  "walletAddress": "0x..." // Connected wallet
}
```

**Response:**
```json
{
  "reply": "📋 LOAN APPLICATION RESULT...",
  "type": "success" | "error" | "warning",
  "txHash": "0x...",
  "loanRecordHash": "0x...",
  "treasuryBalance": "1009825.0 USDT"
}
```

### `GET /api/treasury`

Get current treasury status.

**Response:**
```json
{
  "usdtBalance": "1009850.0 USDT",
  "nativeBalance": "0.5 MATIC",
  "address": "0x...",
  "chainId": 80002
}
```

### `GET /api/health`

Health check endpoint.

---

## 🎨 Frontend Features

### Real-Time Treasury Tracking
- Sidebar shows live treasury balance
- Updates automatically after disbursements/repayments
- Cached balance prevents RPC lag

### Transaction Links
- All transaction hashes are clickable
- Links directly to Polygonscan for verification
- Format: `[TX:0x...]` → Clickable link

### Quick Repay Button
- Automated two-step repayment process
- Real-time progress indicators
- Automatic network switching to Polygon Amoy
- Error handling with retry mechanism

### Wallet Connection
- Wagmi integration for seamless MetaMask connection
- Network detection and switching
- Persistent connection state

---

## 🧪 Testing

### Run Tests

```bash
npx hardhat test
```

### Deploy to Testnet

```bash
npx hardhat run scripts/deploy.ts --network polygonAmoy
```

### Verify Contracts

```bash
npx hardhat verify --network polygonAmoy DEPLOYED_ADDRESS
```

---

## 🐛 Troubleshooting

### "LLM Brain Failed" Error

**Cause**: Gemini API key not configured or invalid
**Fix**: Add valid `GEMINI_API_KEY` to `.env` file

**Fallback**: System automatically uses rule-based decision engine if AI fails

### Treasury Balance Not Updating

**Cause**: RPC provider caching
**Fix**: Server now uses in-memory cached balance to avoid RPC lag

### Transaction Links Not Working

**Cause**: Wrong explorer URL
**Fix**: All links now use official Polygonscan (`https://amoy.polygonscan.com`)

### Repayment Not Confirmed

**Cause**: User didn't confirm MetaMask transactions
**Fix**: Approve both USDT spending AND repayLoan() function call

---

## 📊 Project Structure

```
aegis-underwriter/
├── contracts/              # Solidity smart contracts
│   ├── AegisLedger.sol    # Loan ledger contract
│   └── MockUSDT.sol       # Test USDT token
├── scripts/               # Deployment scripts
├── src/                   # Backend source
│   ├── server.ts          # Express API server
│   ├── treasury.ts        # Wallet & disbursement logic
│   ├── credit.ts          # Credit scoring oracle
│   ├── llm.ts             # Gemini AI integration
│   └── utils.ts           # Helper functions
├── frontend/              # React frontend
│   └── src/
│       ├── App.tsx        # Main app component
│       ├── QuickRepayButton.tsx
│       └── contractInteraction.ts
├── test/                  # Contract tests
├── typechain-types/       # Generated TypeScript types
├── hardhat.config.ts      # Hardhat configuration
├── package.json
└── .env                   # Environment variables
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License.

---

## 🔗 Links

- **GitHub**: https://github.com/isithore002/aegis-underwriter
- **Polygonscan (Amoy)**: https://amoy.polygonscan.com/
- **Google Gemini**: https://ai.google.dev/
- **Polygon Faucet**: https://faucet.polygon.technology/

---

## 👨‍💻 Authors

**Aegis Development Team**

Built with ❤️ using Google Gemini AI, Ethers.js, and React

---

## 🙏 Acknowledgments

- Google Gemini for AI-powered lending decisions
- Polygon for testnet infrastructure
- Ethers.js for blockchain interaction
- Wagmi for wallet connectivity
- OKLink for blockchain data APIs

---

## 📈 Future Roadmap

- [ ] Multi-chain support (Ethereum, Base, Arbitrum)
- [ ] Credit score NFT certificates
- [ ] Automated default liquidation
- [ ] Staking rewards for treasury providers
- [ ] Mobile app (React Native)
- [ ] Advanced ML credit models
- [ ] DAO governance for loan policies

---

**⚠️ Disclaimer**: This is a testnet demo project. Do not use on mainnet without thorough security audits.
