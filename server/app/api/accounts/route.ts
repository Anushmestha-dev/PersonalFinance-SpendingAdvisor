import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { AccountSchema } from '../../../schemas/finance';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { transactions: true }
  });

  const computedAccounts = accounts.map(a => {
    const income = a.transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = a.transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
    
    let currentBalance = 0;
    if (a.type === 'LOAN' || a.type === 'CREDIT') {
      // For debt accounts, expenses increase debt, income (payments) decreases it
      currentBalance = Number(a.balance) + expense - income;
    } else {
      currentBalance = Number(a.balance) + income - expense;
    }
    
    // Omit the raw transactions array to save bandwidth if there are many
    const { transactions, ...accountData } = a;
    
    return {
      ...accountData,
      balance: currentBalance, 
      openingBalance: Number(a.balance)
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

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
