import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';
import { formatINR, formatSignedINR } from '../lib/currency';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  Legend, 
  Sector 
} from 'recharts';
import { Link } from 'react-router-dom';
import { Sparkles, RefreshCw, AlertCircle, Lightbulb, TrendingUp, AlertTriangle, CheckCircle2, Info, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton, Skeleton } from '../components/ui/Skeleton';
import { generateMonthlyPDFReport } from '../lib/pdf-report';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ec4899', '#f43f5e', '#8b5cf6'];

export const Dashboard = () => {
  const [data, setData] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // AI Insights State
  const [insights, setInsights] = useState<{ summary: string; tips: string[] } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Spending Forecast State
  const [forecast, setForecast] = useState<any>(null);

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 3}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: 'drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.45))',
          cursor: 'pointer',
        }}
      />
    );
  };

  const renderInactiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.35}
        style={{
          cursor: 'pointer',
        }}
      />
    );
  };

  const loadInsights = useCallback(async (refresh = false) => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await fetchApi(`/api/ai/insights${refresh ? '?refresh=true' : ''}`);
      setInsights(res);
    } catch (err: any) {
      setInsightsError(err.message || 'Failed to load AI insights');
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchApi('/api/dashboard'),
      fetchApi('/api/budgets/summary'),
      fetchApi('/api/goals'),
      fetchApi('/api/forecast').catch(() => null),
    ])
      .then(([dashRes, budgRes, goalsRes, forecastRes]) => {
        setData(dashRes);
        setBudgets(budgRes.summary);
        setGoals(goalsRes);
        if (forecastRes) setForecast(forecastRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    loadInsights();
  }, [loadInsights]);

  const handleDownloadReport = () => {
    if (!data) return;
    setExporting(true);
    try {
      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long' });
      const year = now.getFullYear();

      generateMonthlyPDFReport({
        userName: data.user?.name,
        monthName,
        year,
        totalBalance: data.totalBalance,
        income: data.thisMonthIncome,
        expense: data.thisMonthExpense,
        netSavings: data.netSavings,
        categorySpending: data.categoryPie || [],
        budgets: budgets || [],
        insights: insights,
      });
      toast.success('Monthly report downloaded successfully!');
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error('Failed to generate PDF report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-red-500">Failed to load dashboard</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Real-time overview of your personal financial health</p>
        </div>

        <button
          onClick={handleDownloadReport}
          disabled={exporting}
          className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
          title="Download Monthly PDF Report"
        >
          <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
          <span>{exporting ? 'Generating PDF...' : 'Download Monthly Report'}</span>
        </button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">Total Balance</h3>
          <p className={`text-2xl font-bold ${data.totalBalance < 0 ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
            {formatINR(data.totalBalance)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">Income This Month</h3>
          <p className="text-2xl font-bold text-green-600">
            +{formatINR(data.thisMonthIncome)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">Expenses This Month</h3>
          <p className="text-2xl font-bold text-red-600">
            -{formatINR(data.thisMonthExpense)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">Net Savings</h3>
          <p className={`text-2xl font-bold ${data.netSavings >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
            {formatINR(data.netSavings)}
          </p>
        </div>
      </div>

      {/* AI Insights Card */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-blue-100 dark:border-blue-900/40 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">AI Insights</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Smart financial analysis powered by Gemini</p>
            </div>
          </div>
          <button
            onClick={() => loadInsights(true)}
            disabled={insightsLoading}
            className="flex items-center space-x-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-md border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition disabled:opacity-50"
            title="Refresh Insights"
          >
            <RefreshCw className={`w-4 h-4 ${insightsLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {insightsLoading && !insights ? (
          <div className="py-8 text-center space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Analyzing your financial patterns with Gemini AI...</p>
          </div>
        ) : insightsError ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Could not generate AI insights</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">{insightsError}</p>
              <button
                onClick={() => loadInsights(true)}
                className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300 hover:underline"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : insights ? (
          <div className="space-y-4">
            <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-lg p-4">
              <p className="text-sm text-blue-950 dark:text-blue-100 leading-relaxed font-medium">
                {insights.summary}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Actionable Recommendations
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {insights.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    className="flex items-start space-x-2.5 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200"
                  >
                    <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="leading-snug">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {/* Mandatory Disclaimer */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center sm:text-left">
            This is not professional financial advice.
          </p>
        </div>
      </div>

      {/* Monthly Spending Forecast Card */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-100 dark:border-gray-700/60">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Monthly Spending Forecast</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Run-rate projection based on spending velocity and historical patterns</p>
            </div>
          </div>
        </div>

        {forecast ? (
          <div className="space-y-6">
            {/* Outlier Alert Banner */}
            {forecast.outliers && forecast.outliers.length > 0 && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start space-x-3 text-xs">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Large One-off Expense Detected ({forecast.outliers.length})
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    {forecast.outliers.map((o: any) => `${o.category} (${formatINR(o.amount)})`).join(', ')}. 
                    To avoid distorting your daily habit, the <strong className="font-semibold">"Excluding large one-time expenses"</strong> projection excludes this spike from your recurring daily burn rate ({formatINR(forecast.dailyRateNormalized)}/day normalized vs {formatINR(forecast.dailyRateRunRate)}/day unadjusted).
                  </p>
                </div>
              </div>
            )}

            {/* Forecast Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Spent So Far</span>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatINR(forecast.spentSoFar)}
                </p>
                <span className="text-[11px] text-gray-400">Day 1 to {forecast.daysPassed}</span>
              </div>
              <div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  Excl. One-Time Expenses
                </span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatINR(forecast.projectedNormalizedTotal || forecast.projectedTotal)}
                </p>
                <span className="text-[11px] text-gray-400">Normalized month-end</span>
              </div>
              <div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  If Spending Continues
                </span>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {formatINR(forecast.projectedRunRateTotal || forecast.projectedTotal)}
                </p>
                <span className="text-[11px] text-gray-400">Unadjusted run-rate</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Regular Daily Pace</span>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatINR(forecast.dailyRateNormalized || forecast.dailyRate)}/day
                </p>
                <span className="text-[11px] text-gray-400">{forecast.daysRemaining} days remaining</span>
              </div>
            </div>

            {/* Line Chart: Actual vs Projected Spending (Dual Trajectory) */}
            <div className="h-[300px] w-full">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cumulative Spending Trajectory
                </h4>
                <span className="text-[11px] text-gray-400">
                  Showing normalized vs unadjusted run-rate
                </span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecast.chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.25} vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    stroke="#9ca3af" 
                    fontSize={11} 
                    tickFormatter={(d) => `Day ${d}`} 
                    interval={4} 
                  />
                  <YAxis 
                    stroke="#9ca3af" 
                    fontSize={11} 
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} 
                  />
                  <Tooltip 
                    formatter={(value: any, name: any) => {
                      let label = 'Actual Spending';
                      if (name === 'projectedNormalized') label = 'Excluding Large One-Time Expenses';
                      if (name === 'projectedRunRate') label = 'If Spending Continues';
                      return [value !== null ? formatINR(value) : 'N/A', label];
                    }}
                    labelFormatter={(label) => `Day ${label} of Month`}
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '8px' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }} 
                    formatter={(val) => {
                      if (val === 'actual') return 'Actual Spent So Far';
                      if (val === 'projectedNormalized') return 'Excluding Large One-Time Expenses';
                      if (val === 'projectedRunRate') return 'If Spending Continues (Run-rate)';
                      return val;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    name="actual"
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={{ r: 2 }} 
                    activeDot={{ r: 5 }} 
                    connectNulls={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="projectedNormalized" 
                    name="projectedNormalized"
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    strokeDasharray="5 5" 
                    dot={{ r: 2 }} 
                    activeDot={{ r: 5 }} 
                    connectNulls={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="projectedRunRate" 
                    name="projectedRunRate"
                    stroke="#f59e0b" 
                    strokeWidth={2} 
                    strokeDasharray="2 2" 
                    dot={{ r: 2 }} 
                    activeDot={{ r: 5 }} 
                    connectNulls={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Category Budget Overrun Warnings */}
            {forecast.categoryForecasts && forecast.categoryForecasts.length > 0 && (
              <div className="pt-2 border-t dark:border-gray-700/60">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Budget Overrun Warnings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {forecast.categoryForecasts.map((cat: any) => (
                    <div 
                      key={cat.categoryId}
                      className={`p-3 rounded-lg flex items-center justify-between text-xs border ${
                        cat.likelyToExceed
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                          : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40 text-green-800 dark:text-green-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {cat.likelyToExceed ? (
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                        <div>
                          <span className="font-semibold">{cat.category}</span>
                          <span className="text-gray-500 dark:text-gray-400 block text-[11px]">
                            Projected {formatINR(cat.projectedTotal)} vs {formatINR(cat.budgeted)} budget ({cat.projectedPercentUsed}%)
                          </span>
                        </div>
                      </div>
                      {cat.likelyToExceed && (
                        <span className="font-bold text-red-600 dark:text-red-400">
                          +{formatINR(cat.projectedOverrun)} overrun
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-gray-500">
            Loading forecast data...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-[400px]">
          <h3 className="font-semibold mb-6">Income vs Expense (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.last6Months} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickMargin={10} />
              <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `₹${v}`} />
              <Tooltip cursor={{fill: 'transparent'}} formatter={(value: any) => formatINR(value)} contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Spending Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-[400px] flex flex-col">
          <h3 className="font-semibold mb-2">Spending by Category (This Month)</h3>
          {data.categoryPie.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">No expenses this month</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryPie}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  activeShape={renderActiveShape}
                  inactiveShape={renderInactiveShape}
                >
                  {data.categoryPie.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatINR(value)} contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
            <h3 className="font-semibold">Recent Transactions</h3>
            <Link to="/transactions" className="text-sm text-blue-600 hover:underline">View All</Link>
          </div>
          {data.recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No transactions yet.</div>
          ) : (
            <table className="w-full text-left">
              <tbody>
                {data.recentTransactions.map((t: any) => (
                  <tr key={t.id} className="border-b last:border-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-sm">{t.description || t.category?.name || 'Transaction'}</div>
                      <div className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()} • {t.account?.name}</div>
                    </td>
                    <td className={`p-4 text-right font-medium ${t.type === 'INCOME' ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                      {formatSignedINR(t.amount, t.type)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Budget Progress & Goals Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Budget Progress</h3>
              <Link to="/budgets" className="text-sm text-blue-600 hover:underline">Manage</Link>
            </div>
            {budgets.length === 0 ? (
              <div className="text-center text-gray-500 py-4">No budgets set.</div>
            ) : (
              <div className="space-y-4">
                {budgets.slice(0, 3).map((b: any) => {
                  const percentage = Math.min((b.spent / b.budgeted) * 100, 100);
                  const colorClass = percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-orange-500' : 'bg-green-500';
                  return (
                    <div key={b.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{b.category.name}</span>
                        <span className="text-gray-500">{formatINR(b.spent, 0)} / {formatINR(b.budgeted, 0)}</span>
                      </div>
                      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full ${colorClass} transition-all`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Goals Summary</h3>
              <Link to="/goals" className="text-sm text-blue-600 hover:underline">Manage</Link>
            </div>
            {goals.length === 0 ? (
              <div className="text-center text-gray-500 py-4">No active goals.</div>
            ) : (
              <div className="space-y-4">
                {goals.slice(0, 3).map((g: any) => {
                  const percentage = Math.min((Number(g.savedAmount) / Number(g.targetAmount)) * 100, 100);
                  return (
                    <div key={g.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{g.name}</span>
                        <span className="text-blue-600 font-medium">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
