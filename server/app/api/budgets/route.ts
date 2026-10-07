import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { BudgetSchema } from '../../../schemas/finance';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  const where: any = { userId: user.id };
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);

  const budgets = await prisma.budget.findMany({
    where,
    include: { category: true }
  });

  return NextResponse.json(budgets);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = BudgetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const { categoryId, month, year, amount } = parsed.data;

    // Verify category exists and belongs to user (or is default)
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || (category.userId !== null && category.userId !== user.id)) {
      return NextResponse.json({ error: 'Category not found or access denied' }, { status: 403 });
    }

    const budget = await prisma.budget.upsert({
      where: {
        userId_categoryId_month_year: {
          userId: user.id,
          categoryId,
          month,
          year
        }
      },
      update: { amount },
      create: {
        userId: user.id,
        categoryId,
        amount,
        month,
        year
      }
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
