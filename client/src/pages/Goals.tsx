import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

export const Goals = () => {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('');
  const [deadline, setDeadline] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/api/goals');
      setGoals(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setTargetAmount('');
    setSavedAmount('0');
    setDeadline('');
    setIsModalOpen(true);
  };

  const openEditModal = (g: any) => {
    setEditingId(g.id);
    setName(g.name);
    setTargetAmount(g.targetAmount);
    setSavedAmount(g.savedAmount);
    setDeadline(g.deadline.split('T')[0]);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name, targetAmount: parseFloat(targetAmount), savedAmount: parseFloat(savedAmount), deadline };
      if (editingId) {
        await fetchApi(`/api/goals/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Goal updated');
      } else {
        await fetchApi('/api/goals', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Goal added');
      }
      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      await fetchApi(`/api/goals/${id}`, { method: 'DELETE' });
      toast.success('Goal deleted');
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddMoney = async (g: any) => {
    const amountStr = prompt('Enter amount to add:');
    if (!amountStr) return;
    const addAmt = parseFloat(amountStr);
    if (isNaN(addAmt) || addAmt <= 0) return toast.error('Invalid amount');
    try {
      await fetchApi(`/api/goals/${g.id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ name: g.name, targetAmount: g.targetAmount, savedAmount: parseFloat(g.savedAmount) + addAmt, deadline: g.deadline }) 
      });
      toast.success('Money added to goal');
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading goals...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Savings Goals</h1>
        <button onClick={openAddModal} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Goal</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-lg shadow">No active savings goals.</div>
        ) : (
          goals.map(g => {
            const saved = Number(g.savedAmount);
            const target = Number(g.targetAmount);
            const percentage = Math.min((saved / target) * 100, 100);

            return (
              <div key={g.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
                <div className="flex justify-between">
                  <h3 className="font-semibold text-lg">{g.name}</h3>
                  <div className="space-x-2 text-sm">
                    <button onClick={() => openEditModal(g)} className="text-blue-500 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(g.id)} className="text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Target: ${target.toLocaleString()}</span>
                  <span className="text-blue-600 font-medium">{percentage.toFixed(1)}%</span>
                </div>
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${percentage}%` }}></div>
                </div>
                <div className="text-sm text-gray-500 flex justify-between items-center">
                  <span>${saved.toLocaleString()} saved</span>
                  <span>Due: {new Date(g.deadline).toLocaleDateString()}</span>
                </div>
                <button onClick={() => handleAddMoney(g)} className="w-full mt-2 py-1.5 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm">
                  Add Money
                </button>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Goal" : "Add Goal"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Goal Name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Target Amount</label>
              <input type="number" step="0.01" min="1" required value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Saved Amount</label>
              <input type="number" step="0.01" min="0" required value={savedAmount} onChange={e => setSavedAmount(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Deadline</label>
            <input type="date" required value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-transparent" />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Goal</button>
        </form>
      </Modal>
    </div>
  );
};
