import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

export const Accounts = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('DEPOSITORY');
  const [balance, setBalance] = useState('');

  const loadAccounts = () => {
    setLoading(true);
    fetchApi('/api/accounts')
      .then(setAccounts)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name, type, balance: parseFloat(balance) })
      });
      toast.success('Account created successfully');
      setIsModalOpen(false);
      setName('');
      setBalance('');
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Account</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div>Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-lg shadow">No accounts yet.</div>
        ) : (
          accounts.map(a => (
            <div key={a.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-2">
              <div className="flex justify-between">
                <h3 className="font-semibold text-lg">{a.name}</h3>
                <span className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">{a.type}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${Number(a.balance).toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Account">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Account Name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Account Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent">
              <option value="DEPOSITORY">Checking / Savings</option>
              <option value="CREDIT">Credit Card</option>
              <option value="INVESTMENT">Investment</option>
              <option value="LOAN">Loan</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Starting Balance</label>
            <input type="number" step="0.01" required value={balance} onChange={e => setBalance(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Account</button>
        </form>
      </Modal>
    </div>
  );
};
