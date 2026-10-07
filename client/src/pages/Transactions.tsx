import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

export const Transactions = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [meta, setMeta] = useState({ totalPages: 1, page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  
  // Dependencies for form & filters
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Filters State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [type, setType] = useState('EXPENSE');

  const loadDependencies = async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        fetchApi('/api/accounts'),
        fetchApi('/api/categories')
      ]);
      setAccounts(accRes);
      setCategories(catRes);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: page.toString(), limit: '10' });
      if (search) query.append('search', search);
      if (filterType) query.append('type', filterType);
      if (filterAccount) query.append('accountId', filterAccount);
      if (filterCategory) query.append('categoryId', filterCategory);
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);

      const txnRes = await fetchApi(`/api/transactions?${query.toString()}`);
      setTransactions(txnRes.data);
      setMeta({ totalPages: txnRes.meta.totalPages, page: txnRes.meta.page, total: txnRes.meta.total });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterType, filterAccount, filterCategory, startDate, endDate]);

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const openAddModal = () => {
    setEditingId(null);
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    if (accounts.length > 0) setAccountId(accounts[0].id);
    if (categories.length > 0) setCategoryId(categories[0].id);
    setIsModalOpen(true);
  };

  const openEditModal = (t: any) => {
    setEditingId(t.id);
    setAccountId(t.accountId);
    setCategoryId(t.categoryId);
    setAmount(t.amount);
    setDate(t.date.split('T')[0]);
    setDescription(t.description || '');
    setType(t.type);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { accountId, categoryId, amount: parseFloat(amount), date, description, type };
      if (editingId) {
        await fetchApi(`/api/transactions/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Transaction updated');
      } else {
        await fetchApi('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Transaction added');
      }
      setIsModalOpen(false);
      loadTransactions();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await fetchApi(`/api/transactions/${id}`, { method: 'DELETE' });
      toast.success('Transaction deleted');
      loadTransactions();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <button onClick={openAddModal} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Transaction</button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <input type="text" placeholder="Search..." value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} className="px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
        <select value={filterType} onChange={e => {setFilterType(e.target.value); setPage(1);}} className="px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent">
          <option value="">All Types</option>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </select>
        <select value={filterAccount} onChange={e => {setFilterAccount(e.target.value); setPage(1);}} className="px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent">
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterCategory} onChange={e => {setFilterCategory(e.target.value); setPage(1);}} className="px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setPage(1);}} title="Start Date" className="px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
        <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setPage(1);}} title="End Date" className="px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <th className="p-4 font-medium text-sm">Date</th>
                  <th className="p-4 font-medium text-sm">Description</th>
                  <th className="p-4 font-medium text-sm">Account</th>
                  <th className="p-4 font-medium text-sm">Category</th>
                  <th className="p-4 font-medium text-sm">Amount</th>
                  <th className="p-4 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="p-4 text-sm whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="p-4 text-sm">{t.description || '-'}</td>
                    <td className="p-4 text-sm">{t.account?.name || '-'}</td>
                    <td className="p-4 text-sm">{t.category?.name || '-'}</td>
                    <td className={`p-4 text-sm font-medium whitespace-nowrap ${t.type === 'INCOME' ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                      {t.type === 'INCOME' ? '+' : '-'}${Number(t.amount).toFixed(2)}
                    </td>
                    <td className="p-4 text-sm space-x-3 whitespace-nowrap">
                      <button onClick={() => openEditModal(t)} className="text-blue-500 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Pagination Controls */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Prev</button>
          <span>Page {page} of {meta.totalPages}</span>
          <button disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Next</button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Transaction" : "Add Transaction"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent">
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Account</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} required className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent">
                {categories.filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input type="number" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Transaction</button>
        </form>
      </Modal>
    </div>
  );
};
