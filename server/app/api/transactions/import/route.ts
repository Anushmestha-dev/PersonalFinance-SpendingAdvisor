import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { clearUserInsightsCache } from '../../../../lib/insights-cache';
import { rateLimit } from '../../../../lib/rate-limit';
import { z } from 'zod';

const ImportTransactionItemSchema = z.object({
  date: z.string().refine((str) => !isNaN(new Date(str).getTime()), "Invalid date"),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional().default("Imported Transaction"),
  type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
  categoryId: z.string().uuid().optional(),
});

const ImportRequestSchema = z.object({
  accountId: z.string().uuid("Invalid Account ID"),
  defaultCategoryId: z.string().uuid().optional(),
  transactions: z.array(ImportTransactionItemSchema).min(1, "No transactions provided"),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!rateLimit(`import-${user.id}`, 20)) {
      return NextResponse.json({ error: 'Too many import requests. Please wait a moment.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = ImportRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid import data', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { accountId, defaultCategoryId, transactions } = parseResult.data;

    // Verify account belongs to user
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== user.id) {
      return NextResponse.json({ error: 'Account not found or access denied' }, { status: 403 });
    }

    // Resolve default category fallback if not provided
    const userCategories = await prisma.category.findMany({
      where: {
        OR: [{ userId: user.id }, { userId: null }],
      },
    });

    const defaultExpenseCat = userCategories.find(c => c.type === 'EXPENSE');
    const defaultIncomeCat = userCategories.find(c => c.type === 'INCOME');

    if (!defaultExpenseCat && !defaultIncomeCat) {
      return NextResponse.json({ error: 'No categories available in the system' }, { status: 400 });
    }

    // Fetch existing transactions for this account to detect duplicates
    const existingTransactions = await prisma.transaction.findMany({
      where: { accountId },
      select: {
        date: true,
        amount: true,
        description: true,
        type: true,
      },
    });

    // Helper signature generator for duplicate detection: date (YYYY-MM-DD) + amount + description + type
    const createSignature = (dateStr: string | Date, amount: number, desc: string, type: string) => {
      const d = new Date(dateStr).toISOString().split('T')[0];
      const cleanDesc = (desc || '').trim().toLowerCase();
      return `${d}|${Number(amount).toFixed(2)}|${cleanDesc}|${type}`;
    };

    const existingSignatures = new Set(
      existingTransactions.map(t =>
        createSignature(t.date, Number(t.amount), t.description || '', t.type)
      )
    );

    const seenInBatch = new Set<string>();
    const toCreate: Array<{
      accountId: string;
      categoryId: string;
      amount: number;
      date: Date;
      description: string;
      type: 'INCOME' | 'EXPENSE';
    }> = [];

    let skippedDuplicates = 0;

    for (const item of transactions) {
      const parsedDate = new Date(item.date);
      const desc = item.description.trim() || 'Imported Transaction';
      const sig = createSignature(parsedDate, item.amount, desc, item.type);

      // Check if already in DB or duplicate within the same uploaded CSV
      if (existingSignatures.has(sig) || seenInBatch.has(sig)) {
        skippedDuplicates++;
        continue;
      }

      seenInBatch.add(sig);

      // Determine category
      let chosenCatId = item.categoryId;
      if (!chosenCatId && defaultCategoryId) {
        chosenCatId = defaultCategoryId;
      }
      if (!chosenCatId) {
        chosenCatId = item.type === 'INCOME' ? defaultIncomeCat?.id : defaultExpenseCat?.id;
      }

      if (!chosenCatId) {
        chosenCatId = userCategories[0]?.id;
      }

      toCreate.push({
        accountId,
        categoryId: chosenCatId,
        amount: item.amount,
        date: parsedDate,
        description: desc,
        type: item.type,
      });
    }

    // Batch insert non-duplicate transactions
    if (toCreate.length > 0) {
      await prisma.transaction.createMany({
        data: toCreate,
      });
      clearUserInsightsCache(user.id);
    }

    return NextResponse.json({
      success: true,
      imported: toCreate.length,
      skippedDuplicates,
      total: transactions.length,
    });
  } catch (error: any) {
    console.error('Import transactions error:', error);
    return NextResponse.json({ error: error.message || 'Failed to import transactions' }, { status: 500 });
  }
}
