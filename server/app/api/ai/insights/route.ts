import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { getGeminiApiKey, generateGeminiContent } from '../../../../lib/gemini';
import { rateLimit } from '../../../../lib/rate-limit';
import { getCachedInsights, setCachedInsights } from '../../../../lib/insights-cache';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Gemini API Key configuration
    const keyResult = getGeminiApiKey();
    if ('error' in keyResult) {
      return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
    }

    // Rate limit per user (15 requests per minute)
    if (!rateLimit(`ai-insights-${user.id}`, 15)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before refreshing insights.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const now = new Date();
    const targetYear = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : now.getFullYear();
    const targetMonth = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : (now.getMonth() + 1);

    // Check cache by user + year + month
    if (!forceRefresh) {
      const cached = getCachedInsights(user.id, targetYear, targetMonth);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }

    // Date boundaries for current target month (in UTC to avoid timezone drift)
    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    // Date boundaries for previous month
    const prevMonthYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevMonthMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const startOfPrevMonth = new Date(Date.UTC(prevMonthYear, prevMonthMonth - 1, 1, 0, 0, 0, 0));
    const endOfPrevMonth = new Date(Date.UTC(prevMonthYear, prevMonthMonth, 0, 23, 59, 59, 999));

    // Fetch transactions and budgets
    const [thisMonthTransactions, lastMonthTransactions, budgets] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          account: { userId: user.id },
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: {
          account: { userId: user.id },
          date: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
        include: { category: true },
      }),
      prisma.budget.findMany({
        where: {
          userId: user.id,
          month: targetMonth,
          year: targetYear,
        },
        include: { category: true },
      }),
    ]);

    // Calculate this month metrics
    const thisMonthIncome = thisMonthTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const thisMonthExpenses = thisMonthTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const netSavings = thisMonthIncome - thisMonthExpenses;

    // Calculate category spending totals
    const categoryTotalsMap: Record<string, number> = {};
    thisMonthTransactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const catName = t.category?.name || 'Uncategorized';
        categoryTotalsMap[catName] = (categoryTotalsMap[catName] || 0) + Number(t.amount);
      });

    const totalsPerCategory = Object.entries(categoryTotalsMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate budget vs actual
    const budgetVsActual = budgets.map(b => {
      const categoryName = b.category?.name || 'General';
      const budgeted = Number(b.amount);
      const spent = categoryTotalsMap[categoryName] || 0;
      const remaining = budgeted - spent;
      const percentUsed = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
      return {
        category: categoryName,
        budgeted,
        spent,
        remaining,
        percentUsed,
      };
    });

    // Calculate last month metrics
    const lastMonthIncome = lastMonthTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const lastMonthExpenses = lastMonthTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const incomeVsExpenses = {
      income: thisMonthIncome,
      expenses: thisMonthExpenses,
      netSavings,
    };

    const lastMonthComparison = {
      lastMonthIncome,
      lastMonthExpenses,
      incomeChange: thisMonthIncome - lastMonthIncome,
      expenseChange: thisMonthExpenses - lastMonthExpenses,
    };

    // Strictly sanitized payload containing ONLY totals per category, budget vs actual, income vs expenses, last month comparison.
    // Strictly NO names, emails, account names, goal names, or transaction descriptions.
    const sanitizedData = {
      totalsPerCategory,
      budgetVsActual,
      incomeVsExpenses,
      lastMonthComparison,
    };

    const prompt = `You are a financial advisor for FinSense.
Analyze the user's monthly financial metrics below:
${JSON.stringify(sanitizedData, null, 2)}

Requirements:
1. Always format every currency figure with the Indian Rupee symbol '₹' and standard comma notation (e.g. ₹2,34,700, ₹2,30,000, ₹2,300). Never use $, USD, or INR.
2. "summary": Provide 2 to 3 concise sentences summarizing this month's cash flow, total expenses (₹${thisMonthExpenses.toLocaleString('en-IN')}), income (₹${thisMonthIncome.toLocaleString('en-IN')}), and overall financial position.
3. "tips": Provide 3 to 5 specific, actionable tips highlighting REAL findings from the data:
   - Identify which category takes most of the spending (mention the exact ₹ amount and percentage of total expenses).
   - Detail budget utilization (mention specific category budgets, how much is spent vs remaining, or note categories lacking a budget).
   - Note income vs expense balance (e.g., deficit or surplus, savings rate).
   - Compare to last month's spending patterns if previous month data exists.

Respond STRICTLY with a valid JSON object matching this schema:
{
  "summary": "...",
  "tips": [
    "Tip 1...",
    "Tip 2...",
    "Tip 3...",
    "Tip 4..."
  ]
}
Do not wrap in markdown \`\`\`json blocks.`;

    let summary = '';
    let tips: string[] = [];

    try {
      const responseText = await generateGeminiContent(prompt);
      const cleanJson = responseText.replace(/^```json/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.summary && Array.isArray(parsed.tips) && parsed.tips.length >= 3) {
        summary = parsed.summary;
        tips = parsed.tips.slice(0, 5);
      } else {
        throw new Error('Invalid JSON structure from Gemini response');
      }
    } catch (e: any) {
      console.warn('Gemini generation fallback used:', e.message);

      // Intelligent rule-based fallback citing exact figures and ₹ symbol
      if (thisMonthIncome === 0 && thisMonthExpenses === 0) {
        summary = 'Welcome to FinSense! You haven\'t logged any transactions yet for this month.';
        tips = [
          'Add your accounts and log income to establish a monthly cash flow baseline.',
          'Set category budgets for essential expenses like Food, Utilities, and Rent.',
          'Log your daily expenses to monitor discretionary spending in real time.',
          'Review your financial goals to start putting surplus income to work.',
        ];
      } else {
        const topCat = totalsPerCategory[0];
        const topCatPercent = thisMonthExpenses > 0 && topCat ? Math.round((topCat.amount / thisMonthExpenses) * 100) : 0;
        const formattedExp = `₹${thisMonthExpenses.toLocaleString('en-IN')}`;
        const formattedInc = `₹${thisMonthIncome.toLocaleString('en-IN')}`;

        if (thisMonthExpenses > thisMonthIncome) {
          summary = `For this month, total expenses stand at ${formattedExp} against an income of ${formattedInc}, creating a net deficit of ₹${Math.abs(netSavings).toLocaleString('en-IN')}.`;
        } else {
          const savingsRate = thisMonthIncome > 0 ? Math.round((netSavings / thisMonthIncome) * 100) : 0;
          summary = `For this month, total expenses stand at ${formattedExp} with an income of ${formattedInc}, delivering a positive net savings of ₹${netSavings.toLocaleString('en-IN')} (${savingsRate}% savings rate).`;
        }

        tips = [];

        // Tip 1: Top spending category
        if (topCat) {
          tips.push(`Your highest spending category is ${topCat.category} at ₹${topCat.amount.toLocaleString('en-IN')}, accounting for ${topCatPercent}% of your total monthly expenditure.`);
        }

        // Tip 2: Budget utilization
        if (budgetVsActual.length > 0) {
          const budgetDetails = budgetVsActual
            .map(b => `${b.category} (${b.percentUsed}% used, ₹${b.spent.toLocaleString('en-IN')} of ₹${b.budgeted.toLocaleString('en-IN')})`)
            .join('; ');
          tips.push(`Budget utilization: ${budgetDetails}.`);
        } else {
          tips.push('You have not set any category budgets for this month. Set budgets for high-outlay categories to control spending.');
        }

        // Tip 3: Deficit / Surplus analysis
        if (thisMonthExpenses > thisMonthIncome) {
          tips.push(`Outflows exceed inflows by ₹${Math.abs(netSavings).toLocaleString('en-IN')}. Prioritize curtailing non-essential discretionary expenses to restore positive cash flow.`);
        } else {
          tips.push(`You have a healthy surplus of ₹${netSavings.toLocaleString('en-IN')}. Consider allocating part of this towards high-yield savings or investment goals.`);
        }

        // Tip 4: Unbudgeted spending or comparison
        const unbudgetedCategories = totalsPerCategory.filter(
          c => !budgetVsActual.some(b => b.category.toLowerCase() === c.category.toLowerCase())
        );
        if (unbudgetedCategories.length > 0) {
          const highestUnbudgeted = unbudgetedCategories[0];
          tips.push(`Noticeable unbudgeted spending in ${highestUnbudgeted.category} (₹${highestUnbudgeted.amount.toLocaleString('en-IN')}). Consider creating a budget limit for this category.`);
        } else if (lastMonthComparison.lastMonthExpenses > 0) {
          const diff = lastMonthComparison.expenseChange;
          tips.push(`Your expenses are ${diff >= 0 ? 'up' : 'down'} by ₹${Math.abs(diff).toLocaleString('en-IN')} compared to last month.`);
        } else {
          tips.push('Maintain regular transaction logging throughout the month to keep category breakdowns accurate.');
        }
      }
    }

    const result = { summary, tips };
    setCachedInsights(user.id, targetYear, targetMonth, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Insights error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch AI insights' }, { status: 500 });
  }
}
