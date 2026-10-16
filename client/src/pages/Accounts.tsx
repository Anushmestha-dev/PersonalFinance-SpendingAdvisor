import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { formatINR } from '../lib/currency';
import { Modal } from '../components/ui/Modal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { Landmark, Trash2, Edit2, AlertCircle } from 'lucide-react';

export const Accounts = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('DEPOSITORY');
  const [balance, setBalance] = useState('');

  const loadAccounts = () => {
    setLoading(true);
    fetchApi('/api/accounts')
      .then(setAccounts)
      .catch((e) => toast.error(e.message || 'Failed to load accounts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const openAddModal = () => {
    setEditingAccount(null);
    setName('');
    setType('DEPOSITORY');
    setBalance('');
    setIsModalOpen(true);
  };

  const openEditModal = (acc: any) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.balance.toString());
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name, type, balance: parseFloat(balance) };
      if (editingAccount) {
        await fetchApi(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Account updated successfully');
      } else {
        await fetchApi('/api/accounts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Account created successfully');
      }
      setIsModalOpen(false);
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save account');
    }
  };

  const handleDelete = async (id: string, accName: string) => {
    if (!confirm(`Are you sure you want to delete "${accName}"? All its associated transactions will be removed.`)) return;
    try {
      await fetchApi(`/api/accounts/${id}`, { method: 'DELETE' });
      toast.success('Account deleted successfully');
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete account');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage your bank accounts, credit cards, and investments</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-sm"
        >
          Add Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : accounts.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Landmark}
              title="No accounts yet"
              description="Connect or create your first account to start tracking balances and transactions."
              actionText="Add Account"
              onAction={openAddModal}
            />
          </div>
        ) : (
          accounts.map(a => {
            const isDebt = a.type === 'LOAN' || a.type === 'CREDIT';

            return (
              <div
                key={a.id}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 space-y-3 relative group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{a.name}</h3>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full font-medium">
                        {a.type}
                      </span>
                      {isDebt && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded font-medium">
                          Liability
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition">
                    <button
                      onClick={() => openEditModal(a)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition"
                      title="Edit account"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id, a.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition"
                      title="Delete account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t dark:border-gray-700/50">
                  <div className="text-xs text-gray-400">Current Balance</div>
                  <div className={`text-2xl font-bold ${isDebt ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {formatINR(a.balance)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAccount ? "Edit Account" : "Add Account"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Account Name</label>
            <input
              type="text"
              required
              placeholder="e.g. HDFC Salary, ICICI Savings, SBI Credit Card"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Account Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent"
            >
              <option value="DEPOSITORY">Checking / Savings (Asset)</option>
              <option value="CREDIT">Credit Card (Liability / Debt)</option>
              <option value="INVESTMENT">Investment (Asset)</option>
              <option value="LOAN">Loan (Liability / Debt)</option>
            </select>
            {(type === 'LOAN' || type === 'CREDIT') && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Debt accounts are subtracted from your total balance.</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Starting Balance (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent font-medium"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition shadow-sm"
          >
            {editingAccount ? 'Update Account' : 'Save Account'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

