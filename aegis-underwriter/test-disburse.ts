import { initTreasury, disburseFunds, getTreasuryInfo } from "./src/treasury";

async function test() {
  console.log("Testing disbursement...");
  
  try {
    await initTreasury();
    const treasuryBefore = await getTreasuryInfo();
    console.log(`Treasury before: ${treasuryBefore.usdtBalanceFormatted} USDT`);
    
    // Mock a counter_offer decision
    const decision = {
      status: "counter_offer" as const,
      amount: 50,
      interest_rate: 22,
      duration_days: 7,
      message: "Test loan"
    };
    
    const result = await disburseFunds("0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21", decision);
    console.log("Disbursement result:", result);
    
    const treasuryAfter = await getTreasuryInfo();
    console.log(`Treasury after: ${treasuryAfter.usdtBalanceFormatted} USDT`);
    
  } catch (err) {
    console.error("Error:", err);
  }
}

test().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
