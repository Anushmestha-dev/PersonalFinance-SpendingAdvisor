import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  try {
    // 1. Total Balance logic
    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      include: { transactions: true }
    });

    let totalBalance = 0;
    accounts.forEach(a => {
      const income = a.transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
      const expense = a.transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
      
      let computed = 0;
      if (a.type === 'LOAN' || a.type === 'CREDIT') {
        computed = Number(a.balance) + expense - income;
        totalBalance -= computed; // debt reduces net worth
      } else {
        computed = Number(a.balance) + income - expense;
        totalBalance += computed;
      }
    });

    // 2. This month income/expense
    const thisMonthTransactions = await prisma.transaction.findMany({
      where: {
        account: { userId: user.id },
        date: { gte: startOfMonth, lte: endOfMonth }
      },
      include: { category: true }
    });

    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    const categorySpending: Record<string, number> = {};

    thisMonthTransactions.forEach(t => {
      const amt = Number(t.amount);
      if (t.type === 'INCOME') {
        thisMonthIncome += amt;
      } else {
        thisMonthExpense += amt;
        const catName = t.category?.name || 'Uncategorized';
        categorySpending[catName] = (categorySpending[catName] || 0) + amt;
      }
    });

    // Format pie chart data
    const categoryPie = Object.keys(categorySpending).map(name => ({
      name,
      value: categorySpending[name]
    })).sort((a, b) => b.value - a.value);

    // 3. Last 6 months chart
    const sixMonthsTransactions = await prisma.transaction.findMany({
      where: {
        account: { userId: user.id },
        date: { gte: sixMonthsAgo }
      }
    });

    const monthlyData: Record<string, { income: number; expense: number }> = {};
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyData[monthStr] = { income: 0, expense: 0 };
    }

    sixMonthsTransactions.forEach(t => {
      const monthStr = new Date(t.date).toLocaleString('default', { month: 'short', year: 'numeric' });
      if (monthlyData[monthStr]) {
        if (t.type === 'INCOME') monthlyData[monthStr].income += Number(t.amount);
        else monthlyData[monthStr].expense += Number(t.amount);
      }
    });

    const last6Months = Object.keys(monthlyData).map(month => ({
      month,
      income: monthlyData[month].income,
      expense: monthlyData[month].expense
    }));

    // 4. Recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: { account: { userId: user.id } },
      orderBy: { date: 'desc' },
      take: 5,
      include: { category: true, account: true }
    });

    return NextResponse.json({
      totalBalance,
      thisMonthIncome,
      thisMonthExpense,
      netSavings: thisMonthIncome - thisMonthExpense,
      categoryPie,
      last6Months,
      recentTransactions
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
