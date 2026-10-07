import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const budgets = await prisma.budget.findMany({
    where: { userId: user.id, month, year },
    include: { category: true }
  });

  const transactions = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      account: { userId: user.id },
      type: 'EXPENSE',
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    _sum: { amount: true }
  });

  const spentByCategory = transactions.reduce((acc, curr) => {
    acc[curr.categoryId] = Number(curr._sum.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const summary = budgets.map(budget => {
    const spent = spentByCategory[budget.categoryId] || 0;
    return {
      id: budget.id,
      category: budget.category,
      budgeted: Number(budget.amount),
      spent,
      remaining: Number(budget.amount) - spent
    };
  });

  return NextResponse.json({ month, year, summary });
}
