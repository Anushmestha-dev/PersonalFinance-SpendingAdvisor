import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { AccountSchema } from '../../../schemas/finance';
import { clearUserInsightsCache } from '../../../lib/insights-cache';
import { computeAccountBalance } from '../../../lib/balance';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { transactions: true }
  });

  const computedAccounts = accounts.map(a => {
    const { currentBalance, isDebt } = computeAccountBalance(a);
    
    // Omit the raw transactions array to save bandwidth if there are many
    const { transactions, ...accountData } = a;
    
    return {
      ...accountData,
      balance: currentBalance, 
      openingBalance: Number(a.balance),
      isDebt
    };
  });

  return NextResponse.json(computedAccounts);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = AccountSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const account = await prisma.account.create({
      data: {
        ...parsed.data,
        userId: user.id,
      }
    });

    clearUserInsightsCache(user.id);

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
