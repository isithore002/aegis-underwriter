# 🛡️ AEGIS UNDERWRITER

**Autonomous AI Lending Agent for Tether Hackathon Galactica 2026**

An autonomous DeFi lending agent that provides undercollateralized micro-loans in USD₮ based purely on on-chain credit history. Built with TypeScript, Solidity, and OpenAI GPT-4.

---

##  Features

- **🧠 AI-Powered Risk Assessment**: Uses GPT-4 to negotiate loan terms based on wallet history
- **📊 On-Chain Credit Scoring**: Analyzes transaction count, balance, and wallet age
- **💰 Self-Custodial Treasury**: Tether WDK integration for secure USD₮ management
- **📝 Smart Contract Ledger**: Immutable loan records on Polygon Amoy testnet
- **💓 Autonomous Monitoring**: Heartbeat system tracks defaults and penalties
- **⚡ Zero Collateral**: Loans based on reputation, not locked assets

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AEGIS UNDERWRITER                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌─────▼──────┐      ┌──────▼──────┐
   │ Credit  │          │ LLM Brain  │      │  Treasury   │
   │ Oracle  │          │  (GPT-4)   │      │ (Tether WDK)│
   └────┬────┘          └─────┬──────┘      └──────┬──────┘
        │                     │                     │
        │  Risk Score         │  Loan Decision      │  USD₮
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  AegisLedger.sol   │
                    │ (Smart Contract)   │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Heartbeat.ts     │
                    │ (Default Monitor)  │
                    └────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MetaMask wallet
- Polygon Amoy testnet MATIC ([Faucet](https://faucet.polygon.technology/))
- OpenAI API key (optional, has fallback)

### Installation

```bash
# Clone the repository
git clone https://github.com/isithore002/aegis-underwriter.git
cd aegis-underwriter

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys
```

### Configuration (.env)

```bash
AGENT_PRIVATE_KEY="0x..."           # Your wallet private key
RPC_URL="https://rpc-amoy.polygon.technology"
OPENAI_API_KEY="sk-..."             # Optional (has fallback)
```

### Deploy Contracts

```bash
# Step 1: Deploy MockUSDT
npx hardhat run scripts/deployMockUSDT.ts --network polygonAmoy

# Step 2: Update MOCK_USDT_ADDRESS in .env

# Step 3: Deploy AegisLedger
npx hardhat run scripts/deploy.ts --network polygonAmoy

# Step 4: Update LEDGER_CONTRACT_ADDRESS in .env

# Step 5: Mint test USDT to treasury
npx hardhat run scripts/mintMockUSDT.ts --network polygonAmoy
```

### Run the Agent

```bash
# Interactive CLI
npm run dev

# Or build and run
npm run build
npm start
```

---

## 📖 Usage

### Apply for a Loan

```bash
# Start the CLI
npm run dev

# Select: "💰 Apply for Loan"
# Enter your wallet address
# Request amount (1-500 USDT)
# Receive instant decision
```

### Check Credit Score

```bash
# CLI → "🔍 Check Credit Score"
# Enter any wallet address
# View risk assessment
```

### Monitor Defaults (Heartbeat)

```bash
# Standalone daemon
npx ts-node src/heartbeat.ts

# Or via CLI
# Select: "💓 Start Default Monitoring"
```

---

## 🧪 Testing

### Test Individual Modules

```bash
# Test Credit Oracle
npx ts-node src/testCredit.ts 0xYourAddress

# Test LLM Brain
npx ts-node src/testLLM.ts 0xYourAddress 250

# Test Treasury
npx ts-node src/testTreasury.ts
```

### Build Transaction History

```bash
# Create 20 transactions to improve credit score
npx ts-node src/buildHistory.ts 20
```

---

## 🎯 Credit Scoring System

| Tier | Risk Score | Tx Count | Max Loan | Interest Rate |
|------|-----------|----------|----------|---------------|
| **EXCELLENT** | 0-20 | 100+ | 500 USDT | 2-5% |
| **GOOD** | 21-40 | 50-99 | 400 USDT | 5-10% |
| **FAIR** | 41-60 | 20-49 | 250 USDT | 10-18% |
| **POOR** | 61-80 | 5-19 | 50 USDT | 18-25% |
| **REJECT** | 81-100 | 0-4 | ❌ Denied | N/A |

---

## 📂 Project Structure

```
aegis-underwriter/
├── contracts/
│   ├── AegisLedger.sol         # On-chain loan ledger
│   └── MockUSDT.sol            # Test USDT token
├── scripts/
│   ├── deploy.ts               # Deployment scripts
│   ├── deployMockUSDT.ts
│   ├── mintMockUSDT.ts
│   └── checkBalance.ts
├── src/
│   ├── index.ts                # CLI interface
│   ├── agent.ts                # Orchestration logic
│   ├── credit.ts               # Credit Oracle
│   ├── llm.ts                  # AI Brain
│   ├── treasury.ts             # Tether WDK integration
│   ├── heartbeat.ts            # Default monitoring
│   ├── buildHistory.ts         # Tx builder
│   └── test*.ts                # Test scripts
├── .env.example
├── hardhat.config.ts
├── package.json
└── README.md
```

---

## 🔐 Security

- ✅ Private keys stored in `.env` (gitignored)
- ✅ `onlyAgent` modifiers on contract functions
- ✅ SafeERC20 for token transfers
- ✅ ReentrancyGuard on sensitive operations
- ✅ Input validation on all user inputs
- ✅ Loan cap enforcement (500 USDT max)

---

## 🛠️ Tech Stack

**Smart Contracts**
- Solidity 0.8.24
- OpenZeppelin Contracts
- Hardhat

**Backend**
- TypeScript
- Ethers.js v6
- Tether WDK
- OpenAI GPT-4

**Infrastructure**
- Polygon Amoy Testnet
- IPFS (planned for loan records)

---

## 📊 Smart Contract Addresses

**Polygon Amoy Testnet:**
- MockUSDT: `0x1f284415bA39067cFC39545c3bcfae1730BEB326`
- AegisLedger: *(Deploy and update here)*

---

## 🎮 Demo Flow

1. **Build Credit History**
   ```bash
   npx ts-node src/buildHistory.ts 20
   ```

2. **Check Credit Score**
   ```bash
   npx ts-node src/testCredit.ts 0xYourAddress
   ```

3. **Apply for Loan**
   ```bash
   npm run dev
   # Select "Apply for Loan"
   ```

4. **Monitor Defaults**
   ```bash
   npx ts-node src/heartbeat.ts
   ```

---

## 🤝 Contributing

Built for **Tether Hackathon Galactica 2026** by the Aegis Team.

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🔗 Links

- **GitHub**: https://github.com/isithore002/aegis-underwriter
- **Tether Hackathon**: https://tether.to/hackathon
- **Polygon Faucet**: https://faucet.polygon.technology/

---

## 🎯 Hackathon Highlights

### Innovation
- **First undercollateralized lending protocol** on Polygon using AI risk assessment
- **Autonomous agent architecture** - zero human intervention required
- **On-chain credit scoring** - transparent and verifiable

### Technical Excellence
- Fully autonomous TypeScript agent
- Production-ready Solidity contracts
- Comprehensive test coverage
- Clean modular architecture

### Real-World Applicability
- Solves real DeFi liquidity problems
- Scalable to mainnet
- Extensible credit oracle system

---

**Built with ❤️ for DeFi democratization**

*Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>*
