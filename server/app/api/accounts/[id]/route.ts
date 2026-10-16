import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { AccountSchema } from '../../../../schemas/finance';
import { clearUserInsightsCache } from '../../../../lib/insights-cache';
import { computeAccountBalance } from '../../../../lib/balance';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  
  const account = await prisma.account.findUnique({ 
    where: { id },
    include: { transactions: true }
  });
  
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const { currentBalance, isDebt } = computeAccountBalance(account);
  const { transactions, ...accountData } = account;

  return NextResponse.json({ 
    ...accountData, 
    balance: currentBalance, 
    openingBalance: Number(account.balance),
    isDebt 
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = AccountSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const updated = await prisma.account.update({
      where: { id },
      data: parsed.data,
    });
    clearUserInsightsCache(user.id);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  await prisma.account.delete({ where: { id } });
  clearUserInsightsCache(user.id);
  return NextResponse.json({ success: true });
}
