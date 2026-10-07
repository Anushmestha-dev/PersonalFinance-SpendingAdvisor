import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

export const Budgets = () => {
  const [summary, setSummary] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, catRes] = await Promise.all([
        fetchApi('/api/budgets/summary'),
        fetchApi('/api/categories')
      ]);
      setSummary(sumRes.summary);
      setCategories(catRes.filter((c: any) => c.type === 'EXPENSE'));
      if (catRes.length > 0) setCategoryId(catRes.find((c: any) => c.type === 'EXPENSE')?.id || '');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          amount: parseFloat(amount),
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        })
      });
      toast.success('Budget saved successfully');
      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading budgets...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Monthly Budgets</h1>
        <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Set Budget</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {summary.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-lg shadow">No budgets set for this month.</div>
        ) : (
          summary.map(b => {
            const percentage = Math.min((b.spent / b.budgeted) * 100, 100);
            const colorClass = percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-orange-500' : 'bg-green-500';

            return (
              <div key={b.category.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">{b.category.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">${b.spent.toFixed(0)} / ${b.budgeted.toFixed(0)}</span>
                    <button onClick={async () => {
                      if (!confirm('Delete this budget?')) return;
                      try {
                        await fetchApi(`/api/budgets/${b.id}`, { method: 'DELETE' });
                        toast.success('Budget deleted');
                        loadData();
                      } catch (e: any) { toast.error(e.message); }
                    }} className="text-red-500 hover:text-red-700 text-sm ml-2">X</button>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full ${colorClass} transition-all`} style={{ width: `${percentage}%` }}></div>
                </div>
                <div className="text-xs text-right text-gray-500">
                  {b.remaining >= 0 ? `$${b.remaining.toFixed(0)} remaining` : `$${Math.abs(b.remaining).toFixed(0)} over budget`}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Set Category Budget">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monthly Amount</label>
            <input type="number" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Budget</button>
        </form>
      </Modal>
    </div>
  );
};
