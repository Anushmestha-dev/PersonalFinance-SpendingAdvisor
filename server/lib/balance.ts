import { prisma } from './prisma';

export interface AccountWithTransactions {
  id: string;
  name?: string;
  type: string;
  balance: number | string | any;
  transactions?: Array<{
    type: string;
    amount: number | string | any;
  }>;
}

/**
 * Calculates the current balance for an individual account.
 * - Debt accounts (LOAN, CREDIT): expenses increase debt, income (payments) decreases debt.
 * - Asset accounts (DEPOSITORY, INVESTMENT): opening balance + income - expenses.
 */
export function computeAccountBalance(account: AccountWithTransactions): {
  currentBalance: number;
  isDebt: boolean;
} {
  const isDebt = account.type === 'LOAN' || account.type === 'CREDIT';
  const transactions = account.transactions || [];
  const income = transactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expense = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  let currentBalance = 0;
  if (isDebt) {
    currentBalance = Number(account.balance) + expense - income;
  } else {
    currentBalance = Number(account.balance) + income - expense;
  }

  return { currentBalance, isDebt };
}

/**
 * Calculates total net balance across all accounts.
 * Loan and credit card accounts strictly count as debt (subtract from total).
 */
export function calculateTotalBalance(accounts: AccountWithTransactions[]): number {
  return accounts.reduce((total, a) => {
    const { currentBalance, isDebt } = computeAccountBalance(a);
    return isDebt ? total - currentBalance : total + currentBalance;
  }, 0);
}

/**
 * Query DB and compute total net balance for a user.
 * Guarantees identical balance calculations across dashboard, accounts, chat, and forecast.
 */
export async function getUserTotalBalance(userId: string): Promise<{
  totalBalance: number;
  assetBalance: number;
  debtBalance: number;
  accounts: Array<{
    id: string;
    name?: string;
    type: string;
    balance: number;
    isDebt: boolean;
  }>;
}> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    include: { transactions: true },
  });

  let totalBalance = 0;
  let assetBalance = 0;
  let debtBalance = 0;

  const computedAccounts = accounts.map(a => {
    const { currentBalance, isDebt } = computeAccountBalance(a);
    if (isDebt) {
      debtBalance += currentBalance;
      totalBalance -= currentBalance;
    } else {
      assetBalance += currentBalance;
      totalBalance += currentBalance;
    }
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      balance: currentBalance,
      isDebt,
    };
  });

  return {
    totalBalance,
    assetBalance,
    debtBalance,
    accounts: computedAccounts,
  };
}
