import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { getGeminiApiKey, generateGeminiContent } from '../../../../lib/gemini';
import { rateLimit } from '../../../../lib/rate-limit';
import { ChatRequestSchema } from '../../../../schemas/ai';
import { calculateTotalBalance } from '../../../../lib/balance';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit per user (20 requests per minute)
    if (!rateLimit(`ai-chat-${user.id}`, 20)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before sending another message.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = ChatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { question, history } = parseResult.data;

    // Check Gemini API Key configuration
    const keyResult = getGeminiApiKey();
    if ('error' in keyResult) {
      return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
    }

    // Date boundaries for current month
    const now = new Date();
    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth() + 1;
    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    // Fetch user financial records
    const [accounts, thisMonthTransactions, budgets, goals] = await Promise.all([
      prisma.account.findMany({
        where: { userId: user.id },
        include: { transactions: true },
      }),
      prisma.transaction.findMany({
        where: {
          account: { userId: user.id },
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        include: { category: true },
      }),
      prisma.budget.findMany({
        where: { userId: user.id, month: targetMonth, year: targetYear },
        include: { category: true },
      }),
      prisma.goal.findMany({
        where: { userId: user.id },
      }),
    ]);

    // Compute total net balance using shared balance utility (debt subtracted)
    const totalBalance = calculateTotalBalance(accounts);

    const thisMonthIncome = thisMonthTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const thisMonthExpenses = thisMonthTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netSavings = thisMonthIncome - thisMonthExpenses;

    const categoryTotalsMap: Record<string, number> = {};
    thisMonthTransactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const catName = t.category?.name || 'Uncategorized';
        categoryTotalsMap[catName] = (categoryTotalsMap[catName] || 0) + Number(t.amount);
      });

    // Budget vs actual
    const budgetVsActual = budgets.map(b => {
      const categoryName = b.category?.name || 'General';
      const budgeted = Number(b.amount);
      const spent = categoryTotalsMap[categoryName] || 0;
      return {
        category: categoryName,
        budgeted,
        spent,
        remaining: budgeted - spent,
        percentUsed: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0,
      };
    });

    // Goals progress - strictly NO goal names
    const goalsProgress = goals.map((g, idx) => ({
      goalIndex: idx + 1,
      targetAmount: Number(g.targetAmount),
      savedAmount: Number(g.savedAmount),
      percentAchieved: Number(g.targetAmount) > 0 ? Math.round((Number(g.savedAmount) / Number(g.targetAmount)) * 100) : 0,
    }));

    // Keep the last 5 messages for context
    const recentHistory = (history || []).slice(-5);
    const contextPrompt = recentHistory
      .map(m => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`)
      .join('\n');

    // Sanitized summarized payload - strictly NO user names, emails, account names, goal names, transaction descriptions
    const summarizedMetrics = {
      totalBalance,
      thisMonthIncome,
      thisMonthExpenses,
      netSavings,
      budgetVsActual,
      goalsProgress,
    };

    const prompt = `You are an expert personal financial adviser for FinSense.
The user is asking: "${question}"

User Financial Summary:
- Total Liquid/Account Balance: ₹${totalBalance.toLocaleString('en-IN')}
- This Month's Income: ₹${thisMonthIncome.toLocaleString('en-IN')}
- This Month's Expenses: ₹${thisMonthExpenses.toLocaleString('en-IN')}
- Net Savings This Month: ₹${netSavings.toLocaleString('en-IN')}
- Budgets vs Actual: ${JSON.stringify(budgetVsActual)}
- Active Goals Progress: ${JSON.stringify(goalsProgress)}

${recentHistory.length > 0 ? `Recent Conversation History (last ${recentHistory.length} messages):\n${contextPrompt}\n` : ''}
Instructions:
1. Provide a direct, helpful, and concise answer to the user's question with simple step-by-step reasoning based on their actual numbers.
2. If asking about an affordability purchase (e.g. "Can I afford a 20,000 phone?"), compare the price against their total balance, net monthly cash flow, deficit/surplus, and upcoming budgets/goals to give balanced reasoning.
3. Always format all monetary numbers using the Indian Rupee symbol '₹' and standard comma notation (e.g. ₹20,000, ₹2,34,700). Never use $, USD, or INR.
4. Do NOT reveal, mention, or invent any personal names, email addresses, specific account titles, or individual transaction details.
5. Strictly end your answer with this exact disclaimer as the final sentence on a new line:
This is not professional financial advice.`;

    let answer = '';

    try {
      const responseText = await generateGeminiContent(prompt);
      answer = responseText.trim();
      // Ensure the required disclaimer is present
      if (!answer.includes('This is not professional financial advice.')) {
        answer += '\n\nThis is not professional financial advice.';
      }
    } catch (e: any) {
      console.warn('Gemini chat fallback used:', e.message);

      // Rule-based fallback reasoning using real summarized figures
      const formattedBalance = `₹${totalBalance.toLocaleString('en-IN')}`;
      const formattedExpenses = `₹${thisMonthExpenses.toLocaleString('en-IN')}`;
      const formattedIncome = `₹${thisMonthIncome.toLocaleString('en-IN')}`;

      // Check if question asks about affordability of an amount
      const amountMatch = question.match(/(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
      const itemAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

      if (itemAmount) {
        const canAffordCash = totalBalance >= itemAmount;
        const formattedItem = `₹${itemAmount.toLocaleString('en-IN')}`;
        if (canAffordCash && netSavings >= 0) {
          answer = `Based on your liquid balance of ${formattedBalance}, you technically have sufficient funds to cover the ${formattedItem} purchase. However, with this month's income at ${formattedIncome} and expenses at ${formattedExpenses}, purchasing this now would leave your balance at ₹${(totalBalance - itemAmount).toLocaleString('en-IN')}. If this is non-essential, consider saving for it across future monthly surpluses.\n\nThis is not professional financial advice.`;
        } else if (canAffordCash && netSavings < 0) {
          answer = `While your account balance of ${formattedBalance} could physically cover the ${formattedItem} cost, your cash flow is currently running a deficit of ₹${Math.abs(netSavings).toLocaleString('en-IN')} this month (expenses of ${formattedExpenses} vs income of ${formattedIncome}). Adding another ${formattedItem} expense would further widen your deficit and draw down your reserves.\n\nThis is not professional financial advice.`;
        } else {
          answer = `Your total account balance is currently ${formattedBalance}, which is below the requested ${formattedItem} expense. Furthermore, your current month expenses stand at ${formattedExpenses} against income of ${formattedIncome}. Making this purchase right now is not advisable as it would require debt or overdraft.\n\nThis is not professional financial advice.`;
        }
      } else {
        answer = `Looking at your financial snapshot: your total balance is ${formattedBalance}, with this month's income at ${formattedIncome} and expenses at ${formattedExpenses} (net: ₹${netSavings.toLocaleString('en-IN')}). You have ${budgets.length} active budget(s) and ${goals.length} savings goal(s). To improve your financial standing, focus on balancing outflows against reliable inflows.\n\nThis is not professional financial advice.`;
      }
    }

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error('Chat adviser error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat adviser request' },
      { status: 500 }
    );
  }
}
