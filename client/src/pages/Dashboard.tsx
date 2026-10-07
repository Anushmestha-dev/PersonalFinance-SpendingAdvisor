import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { Link } from 'react-router-dom';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ec4899', '#f43f5e', '#8b5cf6'];

export const Dashboard = () => {
  const [data, setData] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi('/api/dashboard'),
      fetchApi('/api/budgets/summary'),
      fetchApi('/api/goals')
    ])
      .then(([dashRes, budgRes, goalsRes]) => {
        setData(dashRes);
        setBudgets(budgRes.summary);
        setGoals(goalsRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load dashboard</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">Total Balance</h3>
          <p className={`text-2xl font-bold ${data.totalBalance < 0 ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
            ${data.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">Income This Month</h3>
          <p className="text-2xl font-bold text-green-600">
            +${data.thisMonthIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">Expenses This Month</h3>
          <p className="text-2xl font-bold text-red-600">
            -${data.thisMonthExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">Net Savings</h3>
          <p className={`text-2xl font-bold ${data.netSavings >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
            ${data.netSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-[400px]">
          <h3 className="font-semibold mb-6">Income vs Expense (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.last6Months} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickMargin={10} />
              <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
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
                <Pie data={data.categoryPie} innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value">
                  {data.categoryPie.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
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
                  <tr key={t.id} className="border-b last:border-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="p-4">
                      <div className="font-medium text-sm">{t.description || t.category?.name || 'Transaction'}</div>
                      <div className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()} • {t.account?.name}</div>
                    </td>
                    <td className={`p-4 text-right font-medium ${t.type === 'INCOME' ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                      {t.type === 'INCOME' ? '+' : '-'}${Number(t.amount).toFixed(2)}
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
                        <span className="text-gray-500">${b.spent.toFixed(0)} / ${b.budgeted.toFixed(0)}</span>
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
