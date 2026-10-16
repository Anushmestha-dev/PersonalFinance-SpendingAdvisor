import { computeAccountBalance, calculateTotalBalance } from '../lib/balance';

export async function runUnitTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n========================================');
  console.log('🧪 RUNNING UNIT TESTS');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // 1. Balance Calculation Tests
  // ----------------------------------------------------
  console.log('--- 1. Account Balance Function Tests ---');

  // Depository Asset account
  const depositoryAccount = {
    id: 'acc-1',
    type: 'DEPOSITORY',
    balance: 5000,
    transactions: [
      { type: 'INCOME', amount: 2000 },
      { type: 'EXPENSE', amount: 1000 },
    ],
  };
  const depResult = computeAccountBalance(depositoryAccount);
  assert(
    depResult.currentBalance === 6000 && !depResult.isDebt,
    'Depository account: opening 5000 + income 2000 - expense 1000 = 6000 (asset)',
    `Expected 6000, got ${depResult.currentBalance}`
  );

  // Credit Card Liability account
  const creditAccount = {
    id: 'acc-2',
    type: 'CREDIT',
    balance: 0,
    transactions: [
      { type: 'EXPENSE', amount: 4500 },
      { type: 'INCOME', amount: 1500 }, // payment to credit card
    ],
  };
  const credResult = computeAccountBalance(creditAccount);
  assert(
    credResult.currentBalance === 3000 && credResult.isDebt,
    'Credit card account: opening 0 + expense 4500 - income 1500 = 3000 (debt)',
    `Expected 3000 debt, got ${credResult.currentBalance}`
  );

  // Loan Liability account
  const loanAccount = {
    id: 'acc-3',
    type: 'LOAN',
    balance: 100000,
    transactions: [
      { type: 'INCOME', amount: 25000 }, // EMI / principal payment
    ],
  };
  const loanResult = computeAccountBalance(loanAccount);
  assert(
    loanResult.currentBalance === 75000 && loanResult.isDebt,
    'Loan account: opening 100000 - payments 25000 = 75000 (debt)',
    `Expected 75000 debt, got ${loanResult.currentBalance}`
  );

  // Investment Asset account
  const investmentAccount = {
    id: 'acc-4',
    type: 'INVESTMENT',
    balance: 50000,
    transactions: [
      { type: 'INCOME', amount: 5000 },
    ],
  };
  const invResult = computeAccountBalance(investmentAccount);
  assert(
    invResult.currentBalance === 55000 && !invResult.isDebt,
    'Investment account: opening 50000 + income 5000 = 55000 (asset)',
    `Expected 55000, got ${invResult.currentBalance}`
  );

  // Shared Total Balance Function
  // Total = Assets (6000 + 55000 = 61000) - Debts (3000 + 75000 = 78000) = -17000
  const totalNet = calculateTotalBalance([
    depositoryAccount,
    creditAccount,
    loanAccount,
    investmentAccount,
  ]);
  assert(
    totalNet === -17000,
    'Shared calculateTotalBalance subtracts debt accounts from assets: 61,000 - 78,000 = -17,000',
    `Expected -17000, got ${totalNet}`
  );

  // ----------------------------------------------------
  // 2. Budget Alert Logic Tests
  // ----------------------------------------------------
  console.log('\n--- 2. Budget Alert Logic Tests ---');

  function evaluateBudgetAlert(budgeted: number, spent: number): {
    status: 'NORMAL' | 'WARNING' | 'OVER_BUDGET';
    percent: number;
    remaining: number;
  } {
    const percent = budgeted > 0 ? (spent / budgeted) * 100 : 0;
    const remaining = budgeted - spent;
    let status: 'NORMAL' | 'WARNING' | 'OVER_BUDGET' = 'NORMAL';
    if (percent >= 100) {
      status = 'OVER_BUDGET';
    } else if (percent >= 80) {
      status = 'WARNING';
    }
    return { status, percent, remaining };
  }

  // Normal spending (< 80%)
  const b1 = evaluateBudgetAlert(10000, 5000);
  assert(b1.status === 'NORMAL' && b1.percent === 50 && b1.remaining === 5000, 'Spent 50%: Normal status with 5000 remaining');

  // Approaching budget (80% boundary)
  const b2 = evaluateBudgetAlert(10000, 8000);
  assert(b2.status === 'WARNING' && b2.percent === 80 && b2.remaining === 2000, 'Spent 80%: Warning alert triggered');

  // Approaching budget (95%)
  const b3 = evaluateBudgetAlert(10000, 9500);
  assert(b3.status === 'WARNING' && b3.percent === 95, 'Spent 95%: Warning alert triggered');

  // Exactly at 100% budget
  const b4 = evaluateBudgetAlert(10000, 10000);
  assert(b4.status === 'OVER_BUDGET' && b4.percent === 100 && b4.remaining === 0, 'Spent 100%: Over budget alert triggered');

  // Over 100% budget
  const b5 = evaluateBudgetAlert(10000, 12500);
  assert(b5.status === 'OVER_BUDGET' && b5.percent === 125 && b5.remaining === -2500, 'Spent 125%: Over budget alert with negative remaining (-2500)');

  // ----------------------------------------------------
  // 3. Forecast Outlier and Projection Tests
  // ----------------------------------------------------
  console.log('\n--- 3. Forecast Outlier & Projection Tests ---');

  function calculateForecast(
    transactions: Array<{ amount: number; category: string }>,
    currentDay: number,
    daysInMonth: number
  ) {
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Group by category to find category baseline
    const categoryMap: Record<string, number[]> = {};
    transactions.forEach(t => {
      if (!categoryMap[t.category]) categoryMap[t.category] = [];
      categoryMap[t.category].push(t.amount);
    });

    const categoryAvg: Record<string, number> = {};
    Object.entries(categoryMap).forEach(([cat, amounts]) => {
      if (amounts.length > 1) {
        const sorted = [...amounts].sort((a, b) => a - b);
        const lower = sorted.slice(0, sorted.length - 1);
        categoryAvg[cat] = lower.reduce((s, a) => s + a, 0) / lower.length;
      } else {
        categoryAvg[cat] = amounts[0];
      }
    });

    const outliers: Array<{ amount: number; category: string }> = [];
    transactions.forEach(t => {
      const avg = categoryAvg[t.category];
      if (categoryMap[t.category].length > 1 && t.amount > avg * 3) {
        outliers.push(t);
      } else if (categoryMap[t.category].length === 1 && totalSpent > 0 && t.amount / totalSpent > 0.3) {
        outliers.push(t);
      }
    });

    const outlierTotal = outliers.reduce((sum, o) => sum + o.amount, 0);
    const normalizedSpent = totalSpent - outlierTotal;

    const daysRemaining = Math.max(0, daysInMonth - currentDay);
    const regularDailyRate = currentDay > 0 ? normalizedSpent / currentDay : 0;
    const allDailyRate = currentDay > 0 ? totalSpent / currentDay : 0;

    const normalizedProjectedTotal = Math.round(totalSpent + regularDailyRate * daysRemaining);
    const unadjustedProjectedTotal = Math.round(totalSpent + allDailyRate * daysRemaining);

    return {
      totalSpent,
      outlierCount: outliers.length,
      outlierTotal,
      normalizedSpent,
      regularDailyRate: Math.round(regularDailyRate),
      allDailyRate: Math.round(allDailyRate),
      normalizedProjectedTotal,
      unadjustedProjectedTotal,
    };
  }

  // Scenario: Day 15 of 30. User had normal expenses of 15,000 (1,000/day) and one large one-off purchase of 2,00,000.
  const sampleTxns = [
    { amount: 5000, category: 'Food' },
    { amount: 5000, category: 'Food' },
    { amount: 5000, category: 'Healthcare' },
    { amount: 200000, category: 'Electronics' }, // One-off TV purchase
  ];

  const forecastResult = calculateForecast(sampleTxns, 15, 30);

  assert(forecastResult.outlierCount === 1, 'Forecast correctly flags the 2,00,000 one-off purchase as an outlier');
  assert(forecastResult.outlierTotal === 200000, 'Forecast correctly attributes outlier total as 2,00,000');
  assert(forecastResult.normalizedSpent === 15000, 'Forecast normalizes base spending to 15,000');
  assert(forecastResult.regularDailyRate === 1000, 'Forecast regular daily rate is 1,000/day (15,000 / 15 days)');
  assert(
    forecastResult.normalizedProjectedTotal === 230000,
    'Normalized projection adds ongoing regular pace to actual spent: 2,15,000 + (1,000 * 15) = 2,30,000',
    `Got ${forecastResult.normalizedProjectedTotal}`
  );
  assert(
    forecastResult.unadjustedProjectedTotal === 430000,
    'Unadjusted projection erroneously projects the one-off TV every day (4,30,000)',
    `Got ${forecastResult.unadjustedProjectedTotal}`
  );

  return { passed, failed };
}

if (process.argv[1]?.endsWith('unit.test.ts')) {
  runUnitTests().then(({ passed, failed }) => {
    console.log(`\nUnit Tests Result: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
