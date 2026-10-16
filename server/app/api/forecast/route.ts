import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { rateLimit } from '../../../lib/rate-limit';
import { getUserTotalBalance } from '../../../lib/balance';

interface OutlierDetail {
  id: string;
  category: string;
  amount: number;
  date: Date;
  reason: string;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!rateLimit(`forecast-${user.id}`, 60)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const currentDay = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysPassed = Math.max(1, currentDay);
    const daysRemaining = Math.max(0, daysInMonth - daysPassed);

    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    // Previous 3 completed calendar months
    const startOfThreeMonthsAgo = new Date(Date.UTC(year, month - 3, 1, 0, 0, 0, 0));
    const endOfLastMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const [balanceData, thisMonthTransactions, last3MonthsTransactions, budgets] = await Promise.all([
      getUserTotalBalance(user.id),
      prisma.transaction.findMany({
        where: {
          account: { userId: user.id },
          type: 'EXPENSE',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: {
          account: { userId: user.id },
          type: 'EXPENSE',
          date: { gte: startOfThreeMonthsAgo, lte: endOfLastMonth },
        },
      }),
      prisma.budget.findMany({
        where: { userId: user.id, month: month + 1, year },
        include: { category: true },
      }),
    ]);

    const spentSoFar = thisMonthTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

    // -------------------------------------------------------------
    // Outlier Detection (Single large one-off transactions)
    // -------------------------------------------------------------
    // Calculate typical transaction amounts across categories
    const allAmounts = thisMonthTransactions.map(t => Number(t.amount)).sort((a, b) => a - b);
    const medianAmount = allAmounts.length > 0 
      ? allAmounts[Math.floor(allAmounts.length / 2)] 
      : 0;

    // Group transactions by category to determine category averages
    const categoryTxMap: Record<string, number[]> = {};
    thisMonthTransactions.forEach(t => {
      const cat = t.category?.name || 'General';
      if (!categoryTxMap[cat]) categoryTxMap[cat] = [];
      categoryTxMap[cat].push(Number(t.amount));
    });

    const categoryAvgMap: Record<string, number> = {};
    Object.entries(categoryTxMap).forEach(([cat, amounts]) => {
      // Category baseline: average of non-maximum amounts if multiple, else amount itself
      if (amounts.length > 1) {
        const sorted = [...amounts].sort((a, b) => a - b);
        const lowerSlice = sorted.slice(0, sorted.length - 1);
        categoryAvgMap[cat] = lowerSlice.reduce((s, a) => s + a, 0) / lowerSlice.length;
      } else {
        categoryAvgMap[cat] = amounts[0];
      }
    });

    const outliers: OutlierDetail[] = [];
    let outlierTotal = 0;
    const categoryOutlierTotals: Record<string, number> = {};

    thisMonthTransactions.forEach(t => {
      const amt = Number(t.amount);
      const cat = t.category?.name || 'General';
      const catAvg = categoryAvgMap[cat] || medianAmount;

      // An expense is classified as an outlier if:
      // 1. It is > 3x the category's usual non-outlier amount, OR
      // 2. It is > 3x the overall median transaction AND accounts for > 30% of total monthly expenses
      const isCategoryOutlier = categoryTxMap[cat].length > 1 && amt > catAvg * 3;
      const isGlobalOutlier = (categoryTxMap[cat].length === 1 || amt > medianAmount * 3) && 
                              spentSoFar > 0 && 
                              amt > medianAmount * 3 && 
                              (amt / spentSoFar) > 0.30;

      if (isCategoryOutlier || isGlobalOutlier) {
        outliers.push({
          id: t.id,
          category: cat,
          amount: amt,
          date: t.date,
          reason: `Large one-off expense (${amt > catAvg * 3 ? '> 3x category average' : '> 3x typical expense'})`,
        });
        outlierTotal += amt;
        categoryOutlierTotals[t.categoryId] = (categoryOutlierTotals[t.categoryId] || 0) + amt;
      }
    });

    // Regular daily spending rate (excluding one-time outliers)
    const regularSpentSoFar = Math.max(0, spentSoFar - outlierTotal);
    const dailyRateNormalized = Math.round(regularSpentSoFar / daysPassed);
    
    // Unadjusted daily spending rate (if spending pace continues unadjusted)
    const dailyRateRunRate = Math.round(spentSoFar / daysPassed);

    const last3MonthsTotal = last3MonthsTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const last3MonthsAvg = Math.round(last3MonthsTotal / 3);

    // 1. Unadjusted Projection ("If spending continues")
    let projectedRunRateTotal = spentSoFar + dailyRateRunRate * daysRemaining;

    // 2. Normalized Projection ("Excluding large one-time expenses")
    // Projects future days using the normalized daily rate, keeping past one-offs already incurred
    let projectedNormalizedTotal = spentSoFar + dailyRateNormalized * daysRemaining;

    // If historical data exists, blend regular future run-rate with historical average
    if (last3MonthsAvg > 0) {
      const weightCurrent = daysPassed / daysInMonth;
      const weightHist = 1 - weightCurrent;
      const futureFromHist = last3MonthsAvg * (daysRemaining / daysInMonth);
      const futureFromNormalized = dailyRateNormalized * daysRemaining;
      const blendedFuture = Math.round(futureFromNormalized * weightCurrent + futureFromHist * weightHist);
      projectedNormalizedTotal = spentSoFar + blendedFuture;
    }

    // Daily cumulative mapping
    const dailyExpenses: Record<number, number> = {};
    thisMonthTransactions.forEach(t => {
      const day = new Date(t.date).getUTCDate();
      dailyExpenses[day] = (dailyExpenses[day] || 0) + Number(t.amount);
    });

    // Build dual-line chart series
    let runningActual = 0;
    const chartData: Array<{
      day: number;
      actual: number | null;
      projectedRunRate: number | null;
      projectedNormalized: number | null;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= daysPassed) {
        runningActual += dailyExpenses[d] || 0;
        chartData.push({
          day: d,
          actual: runningActual,
          projectedRunRate: d === daysPassed ? runningActual : null,
          projectedNormalized: d === daysPassed ? runningActual : null,
        });
      } else {
        const fraction = daysRemaining > 0 ? (d - daysPassed) / daysRemaining : 1;
        const projRunRate = Math.round(spentSoFar + fraction * (projectedRunRateTotal - spentSoFar));
        const projNormalized = Math.round(spentSoFar + fraction * (projectedNormalizedTotal - spentSoFar));

        chartData.push({
          day: d,
          actual: null,
          projectedRunRate: projRunRate,
          projectedNormalized: projNormalized,
        });
      }
    }

    // Category projections and budget overrun prediction
    const categoryExpenses: Record<string, number> = {};
    thisMonthTransactions.forEach(t => {
      const catId = t.categoryId;
      categoryExpenses[catId] = (categoryExpenses[catId] || 0) + Number(t.amount);
    });

    const categoryForecasts = budgets.map(b => {
      const catSpent = categoryExpenses[b.categoryId] || 0;
      const catOutlier = categoryOutlierTotals[b.categoryId] || 0;
      const catRegularSpent = Math.max(0, catSpent - catOutlier);

      // Category run-rate based on regular habit
      const catDailyRate = catRegularSpent / daysPassed;
      const catProjected = Math.round(catSpent + catDailyRate * daysRemaining);
      const budgeted = Number(b.amount);
      const likelyToExceed = catProjected > budgeted;
      const projectedOverrun = likelyToExceed ? catProjected - budgeted : 0;

      return {
        categoryId: b.categoryId,
        category: b.category?.name || 'General',
        budgeted,
        spentSoFar: catSpent,
        projectedTotal: catProjected,
        hasOutlier: catOutlier > 0,
        outlierAmount: catOutlier,
        likelyToExceed,
        projectedOverrun,
        currentPercentUsed: budgeted > 0 ? Math.round((catSpent / budgeted) * 100) : 0,
        projectedPercentUsed: budgeted > 0 ? Math.round((catProjected / budgeted) * 100) : 0,
      };
    });

    return NextResponse.json({
      totalBalance: balanceData.totalBalance,
      assetBalance: balanceData.assetBalance,
      debtBalance: balanceData.debtBalance,
      spentSoFar,
      regularSpentSoFar,
      outlierTotal,
      outliers,
      projectedTotal: projectedNormalizedTotal, // Default headline projection is normalized
      projectedRunRateTotal,
      projectedNormalizedTotal,
      dailyRate: dailyRateNormalized, // Default headline daily rate is normalized
      dailyRateRunRate,
      dailyRateNormalized,
      last3MonthsAvg,
      daysPassed,
      daysInMonth,
      daysRemaining,
      chartData,
      categoryForecasts,
    });
  } catch (error: any) {
    console.error('Forecast error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate spending forecast' }, { status: 500 });
  }
}
