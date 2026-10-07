import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { TransactionSchema } from '../../../../schemas/finance';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  
  const transaction = await prisma.transaction.findUnique({ 
    where: { id },
    include: { account: true, category: true }
  });
  
  if (!transaction || transaction.account.userId !== user.id) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  return NextResponse.json(transaction);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  
  const existing = await prisma.transaction.findUnique({ 
    where: { id },
    include: { account: true }
  });
  if (!existing || existing.account.userId !== user.id) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = TransactionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const data = parsed.data;

    // Verify new account belongs to user if changed
    if (data.accountId !== existing.accountId) {
      const account = await prisma.account.findUnique({ where: { id: data.accountId } });
      if (!account || account.userId !== user.id) return NextResponse.json({ error: 'Account not found' }, { status: 403 });
    }

    if (data.categoryId !== existing.categoryId || data.type !== existing.type) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category || category.type !== data.type) return NextResponse.json({ error: 'Category type must match transaction type' }, { status: 400 });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.transaction.findUnique({ 
    where: { id },
    include: { account: true }
  });
  if (!existing || existing.account.userId !== user.id) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
