import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { TransactionSchema } from '../../../schemas/finance';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  
  // Pagination
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const skip = (page - 1) * limit;

  // Filters
  const type = searchParams.get('type');
  const categoryId = searchParams.get('categoryId');
  const accountId = searchParams.get('accountId');
  const search = searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const minAmount = searchParams.get('minAmount');
  const maxAmount = searchParams.get('maxAmount');

  // Build where clause
  const where: any = {
    account: { userId: user.id } // Ensures the user owns the transaction's account
  };

  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (accountId) where.accountId = accountId;
  if (search) {
    where.description = { contains: search, mode: 'insensitive' };
  }
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  if (minAmount || maxAmount) {
    where.amount = {};
    if (minAmount) where.amount.gte = parseFloat(minAmount);
    if (maxAmount) where.amount.lte = parseFloat(maxAmount);
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: { category: true, account: true }
    }),
    prisma.transaction.count({ where })
  ]);

  return NextResponse.json({
    data: transactions,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = TransactionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const data = parsed.data;

    // Verify account belongs to user
    const account = await prisma.account.findUnique({ where: { id: data.accountId } });
    if (!account || account.userId !== user.id) {
      return NextResponse.json({ error: 'Account not found or access denied' }, { status: 403 });
    }

    // Verify category belongs to user (or is default)
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || (category.userId !== null && category.userId !== user.id)) {
      return NextResponse.json({ error: 'Category not found or access denied' }, { status: 403 });
    }
    if (category.type !== data.type) {
      return NextResponse.json({ error: 'Category type must match transaction type' }, { status: 400 });
    }

    const transaction = await prisma.transaction.create({
      data: parsed.data
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
