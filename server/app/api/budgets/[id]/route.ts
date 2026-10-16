import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { clearUserInsightsCache } from '../../../../lib/insights-cache';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.budget.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  return NextResponse.json(existing);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  await prisma.budget.delete({ where: { id } });
  clearUserInsightsCache(user.id);
  return NextResponse.json({ success: true });
}
