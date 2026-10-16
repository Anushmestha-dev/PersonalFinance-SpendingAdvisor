import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchApi } from '../lib/api';
import { formatSignedINR, formatINR } from '../lib/currency';
import { Modal } from '../components/ui/Modal';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { Sparkles, Upload, FileText, ArrowUpDown, CheckCircle } from 'lucide-react';

interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

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

  // Transaction Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [type, setType] = useState('EXPENSE');
  const [suggestLoading, setSuggestLoading] = useState(false);

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCSV>({ headers: [], rows: [] });
  const [importAccountId, setImportAccountId] = useState('');
  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [amountCol, setAmountCol] = useState('');
  const [typeCol, setTypeCol] = useState('');
  const [defaultImportType, setDefaultImportType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [isImporting, setIsImporting] = useState(false);

  const handleSuggestCategory = async () => {
    if (!description.trim()) {
      toast.error('Please enter a description first to suggest a category');
      return;
    }
    setSuggestLoading(true);
    try {
      const res = await fetchApi('/api/ai/categorize', {
        method: 'POST',
        body: JSON.stringify({
          description: description.trim(),
          amount: parseFloat(amount) || 0,
          type,
        }),
      });

      if (res.categoryId) {
        setCategoryId(res.categoryId);
        toast.success(`Suggested category: ${res.category}`);
      } else {
        toast.error('Could not find a matching category');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to suggest category');
    } finally {
      setSuggestLoading(false);
    }
  };

  const loadDependencies = async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        fetchApi('/api/accounts'),
        fetchApi('/api/categories')
      ]);
      setAccounts(accRes);
      setCategories(catRes);
      if (accRes.length > 0) {
        setImportAccountId(accRes[0].id);
      }
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
      toast.error(e.message || 'Failed to load transactions');
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
        toast.success('Transaction updated successfully');
      } else {
        await fetchApi('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Transaction added successfully');
      }
      setIsModalOpen(false);
      loadTransactions();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save transaction');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await fetchApi(`/api/transactions/${id}`, { method: 'DELETE' });
      toast.success('Transaction deleted successfully');
      loadTransactions();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete transaction');
    }
  };

  // CSV Parsing and Auto-detection
  const parseCSVText = (text: string): ParsedCSV => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          if (inQuotes && line[i + 1] === char) {
            current += char;
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine).filter(r => r.some(col => col.length > 0));
    return { headers, rows };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSVText(text);
      setParsedData(parsed);

      // Auto-detect columns
      const headers = parsed.headers;
      const detectedDate = headers.find(h => /date|dt|posting|txn.*date/i.test(h)) || headers[0] || '';
      const detectedDesc = headers.find(h => /desc|particular|narration|memo|detail|merchant|remark/i.test(h)) || headers[1] || '';
      const detectedAmount = headers.find(h => /amount|debit|withdrawal|credit|deposit|val|sum|net/i.test(h)) || headers[2] || '';
      const detectedType = headers.find(h => /type|dr\/cr|cr\/dr|direction/i.test(h)) || '';

      setDateCol(detectedDate);
      setDescCol(detectedDesc);
      setAmountCol(detectedAmount);
      setTypeCol(detectedType);
    };
    reader.readAsText(file);
  };

  // Helper date normalizer
  const normalizeDate = (val: string): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const [, day, month, year] = dmy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  // Helper amount normalizer
  const parseAmountNumber = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/[₹$,\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.abs(num);
  };

  // Helper type detector
  const detectRowType = (row: string[]): 'INCOME' | 'EXPENSE' => {
    if (typeCol) {
      const typeIdx = parsedData.headers.indexOf(typeCol);
      if (typeIdx !== -1 && row[typeIdx]) {
        const val = row[typeIdx].toLowerCase();
        if (/cr|credit|deposit|income/i.test(val)) return 'INCOME';
        if (/dr|debit|withdrawal|expense/i.test(val)) return 'EXPENSE';
      }
    }
    return defaultImportType;
  };

  // Preview rows based on mapping
  const previewRows = useMemo(() => {
    if (!parsedData.rows.length) return [];
    const dateIdx = parsedData.headers.indexOf(dateCol);
    const descIdx = parsedData.headers.indexOf(descCol);
    const amountIdx = parsedData.headers.indexOf(amountCol);

    return parsedData.rows.slice(0, 5).map((row, idx) => {
      const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
      const rawDesc = descIdx !== -1 ? row[descIdx] : '';
      const rawAmt = amountIdx !== -1 ? row[amountIdx] : '0';
      const parsedAmt = parseAmountNumber(rawAmt);
      const rowType = detectRowType(row);

      return {
        id: idx,
        date: normalizeDate(rawDate),
        description: rawDesc || 'Imported Transaction',
        amount: parsedAmt,
        type: rowType,
      };
    });
  }, [parsedData, dateCol, descCol, amountCol, typeCol, defaultImportType]);

  const handleSaveImport = async () => {
    if (!importAccountId) {
      toast.error('Please select an account to import transactions into');
      return;
    }
    if (!dateCol || !amountCol) {
      toast.error('Please map at least Date and Amount columns');
      return;
    }

    const dateIdx = parsedData.headers.indexOf(dateCol);
    const descIdx = parsedData.headers.indexOf(descCol);
    const amountIdx = parsedData.headers.indexOf(amountCol);

    const mappedTransactions = parsedData.rows
      .map(row => {
        const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
        const rawDesc = descIdx !== -1 ? row[descIdx] : '';
        const rawAmt = amountIdx !== -1 ? row[amountIdx] : '0';
        const parsedAmt = parseAmountNumber(rawAmt);
        const rowType = detectRowType(row);

        if (parsedAmt <= 0) return null;

        return {
          date: normalizeDate(rawDate),
          description: (rawDesc || 'Imported Transaction').trim(),
          amount: parsedAmt,
          type: rowType,
        };
      })
      .filter(Boolean);

    if (mappedTransactions.length === 0) {
      toast.error('No valid transactions found in the CSV');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetchApi('/api/transactions/import', {
        method: 'POST',
        body: JSON.stringify({
          accountId: importAccountId,
          transactions: mappedTransactions,
        }),
      });

      toast.success(
        `Import completed: ${res.imported} imported, ${res.skippedDuplicates} duplicates skipped.`
      );
      setIsImportModalOpen(false);
      setCsvFile(null);
      setParsedData({ headers: [], rows: [] });
      loadTransactions();
    } catch (e: any) {
      toast.error(e.message || 'Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage and track your account activity</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg flex items-center space-x-2 transition shadow-sm"
          >
            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-sm"
          >
            Add Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <input
          type="text"
          placeholder="Search descriptions..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent"
        >
          <option value="">All Types</option>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </select>
        <select
          value={filterAccount}
          onChange={e => { setFilterAccount(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent"
        >
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(1); }}
          title="Start Date"
          className="px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent"
        />
        <input
          type="date"
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(1); }}
          title="End Date"
          className="px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent"
        />
      </div>

      {/* Transactions Table & Empty/Loading States */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-750 border-b dark:border-gray-700">
                  <th className="p-4 font-medium text-xs text-gray-500 uppercase">Date</th>
                  <th className="p-4 font-medium text-xs text-gray-500 uppercase">Description</th>
                  <th className="p-4 font-medium text-xs text-gray-500 uppercase">Account</th>
                  <th className="p-4 font-medium text-xs text-gray-500 uppercase">Category</th>
                  <th className="p-4 font-medium text-xs text-gray-500 uppercase">Amount</th>
                  <th className="p-4 font-medium text-xs text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                <TableRowSkeleton columns={6} />
                <TableRowSkeleton columns={6} />
                <TableRowSkeleton columns={6} />
                <TableRowSkeleton columns={6} />
                <TableRowSkeleton columns={6} />
              </tbody>
            </table>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={ArrowUpDown}
            title="No transactions found"
            description="No transactions match your filters. Add a new transaction or import a statement CSV to get started."
            actionText="Add Transaction"
            onAction={openAddModal}
            className="border-0 shadow-none rounded-none py-14"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                  <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Account</th>
                  <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="p-4 text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {new Date(t.date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t.description || '-'}
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                      {t.account?.name || '-'}
                    </td>
                    <td className="p-4 text-sm">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {t.category?.name || '-'}
                      </span>
                    </td>
                    <td className={`p-4 text-sm font-semibold whitespace-nowrap ${t.type === 'INCOME' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {formatSignedINR(t.amount, t.type)}
                    </td>
                    <td className="p-4 text-sm space-x-3 whitespace-nowrap font-medium">
                      <button onClick={() => openEditModal(t)} className="text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
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
        <div className="flex justify-center items-center space-x-4 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-1.5 text-sm bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 font-medium">Page {page} of {meta.totalPages} ({meta.total} total)</span>
          <button
            disabled={page === meta.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-1.5 text-sm bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Transaction" : "Add Transaction"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent">
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Account</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} required className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Category</label>
                <button
                  type="button"
                  onClick={handleSuggestCategory}
                  disabled={suggestLoading}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1 font-medium disabled:opacity-50"
                  title="Auto-suggest category using Gemini AI"
                >
                  <Sparkles className={`w-3 h-3 ${suggestLoading ? 'animate-spin' : ''}`} />
                  <span>{suggestLoading ? 'Suggesting...' : 'Suggest'}</span>
                </button>
              </div>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent">
                {categories.filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Amount (₹)</label>
            <input type="number" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent font-medium" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Description</label>
              <button
                type="button"
                onClick={handleSuggestCategory}
                disabled={suggestLoading}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1 font-medium disabled:opacity-50"
              >
                <Sparkles className={`w-3 h-3 ${suggestLoading ? 'animate-spin' : ''}`} />
                <span>Suggest category</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. Starbucks, Uber, Grocery, Netflix..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent"
            />
          </div>
          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition shadow-sm">
            Save Transaction
          </button>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Import Bank Statement CSV">
        <div className="space-y-5">
          {!csvFile ? (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition cursor-pointer relative">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center space-y-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload bank CSV statement</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select a CSV file downloaded from your bank or card provider
                </p>
                <span className="mt-2 inline-block px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg">
                  Browse file
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">{csvFile.name}</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">({parsedData.rows.length} rows found)</span>
                </div>
                <button
                  onClick={() => { setCsvFile(null); setParsedData({ headers: [], rows: [] }); }}
                  className="text-xs text-red-500 hover:underline font-medium"
                >
                  Change file
                </button>
              </div>

              {/* Target Account */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                  Target Account
                </label>
                <select
                  value={importAccountId}
                  onChange={e => setImportAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent font-medium"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                </select>
              </div>

              {/* Column Mapping Selectors */}
              <div className="p-4 bg-gray-50 dark:bg-gray-750/50 rounded-xl space-y-3 border dark:border-gray-700">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Detected Column Mapping (adjust if needed)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date Column *</label>
                    <select
                      value={dateCol}
                      onChange={e => setDateCol(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border dark:border-gray-600 rounded-md bg-transparent"
                    >
                      {parsedData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description Column *</label>
                    <select
                      value={descCol}
                      onChange={e => setDescCol(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border dark:border-gray-600 rounded-md bg-transparent"
                    >
                      {parsedData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Column *</label>
                    <select
                      value={amountCol}
                      onChange={e => setAmountCol(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border dark:border-gray-600 rounded-md bg-transparent"
                    >
                      {parsedData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type Column (Optional)</label>
                    <select
                      value={typeCol}
                      onChange={e => setTypeCol(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border dark:border-gray-600 rounded-md bg-transparent"
                    >
                      <option value="">None (Use default below)</option>
                      {parsedData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                {!typeCol && (
                  <div className="pt-2 flex items-center space-x-3 text-xs">
                    <span className="text-gray-500">Default direction for unclassified rows:</span>
                    <label className="inline-flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={defaultImportType === 'EXPENSE'}
                        onChange={() => setDefaultImportType('EXPENSE')}
                      />
                      <span>Expense</span>
                    </label>
                    <label className="inline-flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={defaultImportType === 'INCOME'}
                        onChange={() => setDefaultImportType('INCOME')}
                      />
                      <span>Income</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Preview (First 5 Rows)
                  </h4>
                  <span className="text-[11px] text-gray-400 flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>Duplicates will be automatically skipped</span>
                  </span>
                </div>
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-750 border-b dark:border-gray-700">
                      <tr>
                        <th className="p-2 font-medium">Date</th>
                        <th className="p-2 font-medium">Description</th>
                        <th className="p-2 font-medium">Amount</th>
                        <th className="p-2 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
                      {previewRows.map(row => (
                        <tr key={row.id}>
                          <td className="p-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{row.date}</td>
                          <td className="p-2 truncate max-w-[180px] font-medium">{row.description}</td>
                          <td className="p-2 font-semibold whitespace-nowrap">{formatINR(row.amount)}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${row.type === 'INCOME' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                              {row.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveImport}
                  disabled={isImporting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {isImporting ? 'Importing...' : `Import ${parsedData.rows.length} Transactions`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

