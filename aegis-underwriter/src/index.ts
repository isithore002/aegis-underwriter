import inquirer from "inquirer";
import { processLoanApplication, initializeAgent, validateLoanRequest, AgentConfig, LoanApplicationResult } from "./agent";
import { LoanRequest } from "./llm";
import { startHeartbeat } from "./heartbeat";

// ===========================================
// CLI BANNER
// ===========================================

function printBanner(): void {
  console.clear();
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                                                              ║");
  console.log("║              █████╗ ███████╗ ██████╗ ██╗███████╗            ║");
  console.log("║             ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝            ║");
  console.log("║             ███████║█████╗  ██║  ███╗██║███████╗            ║");
  console.log("║             ██╔══██║██╔══╝  ██║   ██║██║╚════██║            ║");
  console.log("║             ██║  ██║███████╗╚██████╔╝██║███████║            ║");
  console.log("║             ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝            ║");
  console.log("║                                                              ║");
  console.log("║              AUTONOMOUS AI LENDING AGENT                     ║");
  console.log("║              Tether Hackathon Galactica 2026                 ║");
  console.log("║                                                              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n");
}

// ===========================================
// MAIN MENU
// ===========================================

async function mainMenu(): Promise<void> {
  const choices = [
    { name: "💰 Apply for Loan", value: "apply" },
    { name: "🔍 Check Credit Score", value: "credit" },
    { name: "💼 View Treasury Status", value: "treasury" },
    { name: "💓 Start Default Monitoring (Heartbeat)", value: "heartbeat" },
    { name: "⚙️  Settings", value: "settings" },
    { name: "❌ Exit", value: "exit" },
  ];

  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices,
    },
  ]);

  switch (answer.action) {
    case "apply":
      await loanApplicationFlow();
      break;
    case "credit":
      await checkCreditFlow();
      break;
    case "treasury":
      await viewTreasuryFlow();
      break;
    case "heartbeat":
      await startHeartbeatFlow();
      break;
    case "settings":
      await settingsFlow();
      break;
    case "exit":
      console.log("\n👋 Thank you for using Aegis Underwriter!\n");
      process.exit(0);
  }

  // Return to main menu
  await mainMenu();
}

// ===========================================
// LOAN APPLICATION FLOW
// ===========================================

async function loanApplicationFlow(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    LOAN APPLICATION                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "walletAddress",
      message: "Enter your wallet address (EVM):",
      validate: (input: string) => {
        if (!input || input.length !== 42 || !input.startsWith("0x")) {
          return "Please enter a valid EVM wallet address (0x...)";
        }
        return true;
      },
    },
    {
      type: "number",
      name: "amount",
      message: "How much USDT do you need?",
      default: 100,
      validate: (input: number) => {
        if (input <= 0) return "Amount must be positive";
        if (input > 500) return "Maximum loan is 500 USDT";
        return true;
      },
    },
    {
      type: "number",
      name: "duration",
      message: "Loan duration (days)?",
      default: 30,
      validate: (input: number) => {
        if (input <= 0) return "Duration must be positive";
        if (input > 365) return "Maximum duration is 365 days";
        return true;
      },
    },
    {
      type: "input",
      name: "message",
      message: "Why do you need this loan? (optional):",
      default: "",
    },
  ]);

  const loanRequest: LoanRequest = {
    requestedAmount: answers.amount,
    requestedDuration: answers.duration,
    userMessage: answers.message || undefined,
  };

  // Validate request
  const validation = validateLoanRequest(loanRequest);
  if (!validation.valid) {
    console.log(`\n❌ Invalid loan request: ${validation.error}\n`);
    return;
  }

  // Get agent config from global settings
  const config: AgentConfig = {
    useLLM: globalSettings.useLLM,
    autoDisburse: globalSettings.autoDisburse,
    verbose: true,
  };

  // Process application
  try {
    const result = await processLoanApplication(
      answers.walletAddress,
      loanRequest,
      config
    );

    // If not auto-disbursed, ask for manual approval
    if (
      !config.autoDisburse &&
      result.loanDecision.status !== "denied" &&
      result.loanDecision.amount > 0
    ) {
      await manualDisbursementFlow(answers.walletAddress, result);
    }
  } catch (error) {
    console.error("\n❌ Application failed:");
    console.error(error);
  }

  await pressEnterToContinue();
}

// ===========================================
// MANUAL DISBURSEMENT APPROVAL
// ===========================================

async function manualDisbursementFlow(
  borrowerAddress: string,
  result: LoanApplicationResult
): Promise<void> {
  const answer = await inquirer.prompt([
    {
      type: "confirm",
      name: "approve",
      message: `\nDisburse ${result.loanDecision.amount} USDT to borrower?`,
      default: false,
    },
  ]);

  if (answer.approve) {
    console.log("\n💸 Initiating disbursement...");

    const { disburseFunds, formatDisbursementResult } = await import("./treasury");

    try {
      const disbursement = await disburseFunds(borrowerAddress, result.loanDecision);
      console.log(formatDisbursementResult(disbursement));
    } catch (error) {
      console.error("\n❌ Disbursement failed:");
      console.error(error);
    }
  } else {
    console.log("\n⛔ Disbursement cancelled by operator");
  }
}

// ===========================================
// CHECK CREDIT SCORE FLOW
// ===========================================

async function checkCreditFlow(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    CREDIT SCORE CHECK                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const answer = await inquirer.prompt([
    {
      type: "input",
      name: "walletAddress",
      message: "Enter wallet address to check:",
      validate: (input) => {
        if (!input || input.length !== 42 || !input.startsWith("0x")) {
          return "Please enter a valid EVM wallet address";
        }
        return true;
      },
    },
  ]);

  try {
    const { getCreditData, formatCreditSummary } = await import("./credit");
    const creditData = await getCreditData(answer.walletAddress);
    console.log(formatCreditSummary(creditData));
  } catch (error) {
    console.error("\n❌ Credit check failed:");
    console.error(error);
  }

  await pressEnterToContinue();
}

// ===========================================
// TREASURY STATUS FLOW
// ===========================================

async function viewTreasuryFlow(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    TREASURY STATUS                           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  try {
    const { getTreasuryInfo, formatTreasuryInfo } = await import("./treasury");
    const info = await getTreasuryInfo();
    console.log(formatTreasuryInfo(info));
  } catch (error) {
    console.error("\n❌ Failed to fetch treasury status:");
    console.error(error);
    console.log("\n⚠️  Make sure contracts are deployed and .env is configured");
  }

  await pressEnterToContinue();
}

// ===========================================
// HEARTBEAT FLOW
// ===========================================

async function startHeartbeatFlow(): Promise<void> {
  console.log("\n⚠️  Starting heartbeat will begin monitoring for defaults.");
  console.log("   This process will run continuously. Press Ctrl+C to stop.\n");

  const answer = await inquirer.prompt([
    {
      type: "confirm",
      name: "start",
      message: "Start heartbeat monitoring?",
      default: true,
    },
  ]);

  if (answer.start) {
    try {
      await startHeartbeat();
      // Heartbeat runs indefinitely
    } catch (error) {
      console.error("\n❌ Heartbeat failed to start:");
      console.error(error);
      await pressEnterToContinue();
    }
  }
}

// ===========================================
// SETTINGS FLOW
// ===========================================

const globalSettings = {
  useLLM: true,
  autoDisburse: false,
};

async function settingsFlow(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    AGENT SETTINGS                            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const answers = await inquirer.prompt([
    {
      type: "confirm",
      name: "useLLM",
      message: "Use OpenAI LLM for loan decisions?",
      default: globalSettings.useLLM,
    },
    {
      type: "confirm",
      name: "autoDisburse",
      message: "Auto-disburse approved loans (no manual approval)?",
      default: globalSettings.autoDisburse,
    },
  ]);

  globalSettings.useLLM = answers.useLLM;
  globalSettings.autoDisburse = answers.autoDisburse;

  console.log("\n✅ Settings updated:");
  console.log(`   LLM Decisions: ${globalSettings.useLLM ? "Enabled" : "Disabled (fallback)"}`);
  console.log(`   Auto-Disburse: ${globalSettings.autoDisburse ? "Enabled" : "Disabled (manual)"}`);

  await pressEnterToContinue();
}

// ===========================================
// UTILITY
// ===========================================

async function pressEnterToContinue(): Promise<void> {
  await inquirer.prompt([
    {
      type: "input",
      name: "continue",
      message: "\nPress Enter to continue...",
    },
  ]);
}

// ===========================================
// ENTRY POINT
// ===========================================

async function main(): Promise<void> {
  printBanner();

  console.log("🤖 Initializing Aegis Agent...\n");

  try {
    await initializeAgent(false);
    console.log("✅ Agent initialized successfully\n");
  } catch (error) {
    console.log("⚠️  Agent initialization failed (contracts not deployed yet)");
    console.log("   The system will run in simulation mode.\n");
  }

  await mainMenu();
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    console.error("\n❌ Fatal error:");
    console.error(error);
    process.exit(1);
  });
}
