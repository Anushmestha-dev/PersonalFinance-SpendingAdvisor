import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { rateLimit } from '../../../lib/rate-limit';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!rateLimit(`alerts-${user.id}`, 60)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Fetch user's budgets and expenses for the current month
    const [budgets, transactions] = await Promise.all([
      prisma.budget.findMany({
        where: { userId: user.id, month, year },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: {
          account: { userId: user.id },
          type: 'EXPENSE',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
    ]);

    // Aggregate category expenses
    const categoryTotals: Record<string, number> = {};
    transactions.forEach(t => {
      const catId = t.categoryId;
      categoryTotals[catId] = (categoryTotals[catId] || 0) + Number(t.amount);
    });

    const alerts: Array<{
      id: string;
      category: string;
      budgeted: number;
      spent: number;
      percent: number;
      type: 'WARNING' | 'OVER_BUDGET';
      severity: 'warning' | 'danger';
      message: string;
    }> = [];

    budgets.forEach(b => {
      const budgeted = Number(b.amount);
      const spent = categoryTotals[b.categoryId] || 0;
      const percent = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
      const categoryName = b.category?.name || 'General';

      if (percent > 100) {
        alerts.push({
          id: b.id,
          category: categoryName,
          budgeted,
          spent,
          percent,
          type: 'OVER_BUDGET',
          severity: 'danger',
          message: `${categoryName} has exceeded its budget (${percent}% used: ₹${spent.toLocaleString('en-IN')} of ₹${budgeted.toLocaleString('en-IN')})`,
        });
      } else if (percent >= 80) {
        alerts.push({
          id: b.id,
          category: categoryName,
          budgeted,
          spent,
          percent,
          type: 'WARNING',
          severity: 'warning',
          message: `${categoryName} is near its budget (${percent}% used: ₹${spent.toLocaleString('en-IN')} of ₹${budgeted.toLocaleString('en-IN')})`,
        });
      }
    });

    // Sort by severity (OVER_BUDGET first) then percent descending
    alerts.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'OVER_BUDGET' ? -1 : 1;
      return b.percent - a.percent;
    });

    return NextResponse.json({
      alerts,
      count: alerts.length,
    });
  } catch (error: any) {
    console.error('Alerts error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch alerts' }, { status: 500 });
  }
}
