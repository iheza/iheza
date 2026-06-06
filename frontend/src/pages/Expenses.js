import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { toast } from '../hooks/useSoundEnabledToast';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  DollarSign, Plus, Trash2, Search, X, Edit2,
  TrendingUp, TrendingDown, Calendar, Filter, Download,
  PieChart, BarChart3, Wallet, CreditCard, Receipt,
  Building, ChevronDown, ChevronUp, Save, Eye, Upload
} from 'lucide-react';
import { API_URL } from '../config/api';
import ChainToggle from '../components/ChainToggle';

const EXPENSE_CATEGORIES = [
  { id: 'utilities', name: 'Utilities', color: '#3b82f6', icon: '⚡' },
  { id: 'rent', name: 'Rent & Leases', color: '#8b5cf6', icon: '🏢' },
  { id: 'salaries', name: 'Salaries & Wages', color: '#22c55e', icon: '👥' },
  { id: 'supplies', name: 'School Supplies', color: '#f59e0b', icon: '📚' },
  { id: 'maintenance', name: 'Maintenance & Repairs', color: '#ef4444', icon: '🔧' },
  { id: 'transport', name: 'Transportation', color: '#06b6d4', icon: '🚌' },
  { id: 'food', name: 'Food & Catering', color: '#f97316', icon: '🍽️' },
  { id: 'technology', name: 'Technology & IT', color: '#6366f1', icon: '💻' },
  { id: 'marketing', name: 'Marketing & Advertising', color: '#ec4899', icon: '📢' },
  { id: 'insurance', name: 'Insurance', color: '#14b8a6', icon: '🛡️' },
  { id: 'events', name: 'Events & Activities', color: '#a855f7', icon: '🎉' },
  { id: 'furniture', name: 'Furniture & Equipment', color: '#84cc16', icon: '🪑' },
  { id: 'medical', name: 'Medical & Health', color: '#dc2626', icon: '🏥' },
  { id: 'security', name: 'Security', color: '#64748b', icon: '🔒' },
  { id: 'other', name: 'Other', color: '#78716c', icon: '📋' },
];

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash' },
  { id: 'bank_transfer', name: 'Bank Transfer' },
  { id: 'mobile_money', name: 'Mobile Money' },
  { id: 'cheque', name: 'Cheque' },
  { id: 'credit_card', name: 'Credit Card' },
];

function Expenses() {
  const currentUser = useSelector(selectCurrentUser);
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedChain, setSelectedChain] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [dateRange, setDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'other',
    payment_method: 'cash',
    vendor: '',
    receipt_image: '',
    receipt_image_name: '',
    notes: '',
    expense_date: new Date().toISOString().split('T')[0],
  });

  const userRole = currentUser?.role?.toLowerCase();
  const isPrincipal = userRole === 'principal';
  const isDirectorOrCoordinator = ['director', 'coordinator'].includes(userRole);
  // Only principals can edit/delete expenses
  const canEditExpenses = isPrincipal;
  // Directors and coordinators can add expenses
  const canAddExpenses = isPrincipal || isDirectorOrCoordinator;
  // Principals see only their chain, directors/coordinators can filter
  const userChain = currentUser?.chain || 'IHEZA';
  // For principal, force their chain; for director/coordinator, use selectedChain or empty (all)
  const effectiveChain = isPrincipal ? userChain : selectedChain;

  const getAuthHeaders = () => {
    const token = localStorage.getItem('sessionToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  const loadExpenses = useCallback(async (chain) => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      // For principal, always use their own chain
      const chainParam = isPrincipal ? userChain : (chain || '');
      let url = `${API_URL}/api/expenses`;
      if (chainParam) {
        url += `?chain=${encodeURIComponent(chainParam)}`;
      }
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      } else {
        const saved = localStorage.getItem('iheza_expenses');
        if (saved) setExpenses(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
      const saved = localStorage.getItem('iheza_expenses');
      if (saved) setExpenses(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpenses(selectedChain);
  }, [selectedChain, loadExpenses]);

  const saveToLocalStorage = (data) => {
    localStorage.setItem('iheza_expenses', JSON.stringify(data));
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) {
      toast.error(t('expenses.descriptionRequired'));
      return;
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('expenses.validAmount'));
      return;
    }
    const newExpense = {
      ...formData,
      amount,
      chain: selectedChain || currentUser?.chain || 'IHEZA',
      created_by: currentUser?._id || currentUser?.id || 'unknown',
      created_by_name: currentUser?.name || currentUser?.first_name || 'Unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/api/expenses`, {
        method: 'POST', headers, body: JSON.stringify(newExpense),
      });
      if (response.ok) {
        const saved = await response.json();
        setExpenses(prev => [saved, ...prev]);
        toast.success('Expense added successfully');
      } else {
        const localExpense = { ...newExpense, id: Date.now().toString(), _id: Date.now().toString() };
        const updated = [localExpense, ...expenses];
        setExpenses(updated);
        saveToLocalStorage(updated);
        toast.success('Expense saved locally');
      }
    } catch (err) {
      const localExpense = { ...newExpense, id: Date.now().toString(), _id: Date.now().toString() };
      const updated = [localExpense, ...expenses];
      setExpenses(updated);
      saveToLocalStorage(updated);
      toast.success('Expense saved locally (offline mode)');
    }
    resetForm();
    setShowAddModal(false);
  };

  const handleEditExpense = async (e) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) {
      toast.error(t('expenses.descriptionRequired'));
      return;
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('expenses.validAmount'));
      return;
    }
    const updatedExpense = { ...editingExpense, ...formData, amount, updated_at: new Date().toISOString() };
    try {
      const headers = getAuthHeaders();
      const expenseId = editingExpense._id || editingExpense.id;
      const response = await fetch(`${API_URL}/api/expenses/${expenseId}`, {
        method: 'PUT', headers, body: JSON.stringify(updatedExpense),
      });
      if (response.ok) {
        const saved = await response.json();
        setExpenses(prev => prev.map(e => (e._id === expenseId || e.id === expenseId) ? saved : e));
        toast.success('Expense updated successfully');
      } else {
        setExpenses(prev => prev.map(e => (e._id === expenseId || e.id === expenseId) ? updatedExpense : e));
        saveToLocalStorage(expenses.map(e => (e._id === expenseId || e.id === expenseId) ? updatedExpense : e));
        toast.success('Expense updated locally');
      }
    } catch (err) {
      const expenseId = editingExpense._id || editingExpense.id;
      setExpenses(prev => prev.map(e => (e._id === expenseId || e.id === expenseId) ? updatedExpense : e));
      saveToLocalStorage(expenses.map(e => (e._id === expenseId || e.id === expenseId) ? updatedExpense : e));
      toast.success('Expense updated locally (offline mode)');
    }
    setShowEditModal(false);
    setEditingExpense(null);
    resetForm();
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/api/expenses/${expenseId}`, { method: 'DELETE', headers });
      if (response.ok) {
        setExpenses(prev => prev.filter(e => e._id !== expenseId && e.id !== expenseId));
        toast.success('Expense deleted');
      } else {
        setExpenses(prev => prev.filter(e => e._id !== expenseId && e.id !== expenseId));
        saveToLocalStorage(expenses.filter(e => e._id !== expenseId && e.id !== expenseId));
        toast.success('Expense deleted locally');
      }
    } catch (err) {
      setExpenses(prev => prev.filter(e => e._id !== expenseId && e.id !== expenseId));
      saveToLocalStorage(expenses.filter(e => e._id !== expenseId && e.id !== expenseId));
      toast.success('Expense deleted locally (offline mode)');
    }
  };

  const resetForm = () => {
    setFormData({
      description: '', amount: '', category: 'other', payment_method: 'cash',
      vendor: '', receipt_image: '', receipt_image_name: '', notes: '',
      expense_date: new Date().toISOString().split('T')[0],
    });
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description || '',
      amount: expense.amount?.toString() || '',
      category: expense.category || 'other',
      payment_method: expense.payment_method || 'cash',
      vendor: expense.vendor || '',
      receipt_image: expense.receipt_image || '',
      receipt_image_name: expense.receipt_image_name || '',
      notes: expense.notes || '',
      expense_date: expense.expense_date ? expense.expense_date.split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowEditModal(true);
  };

  const exportToExcel = () => {
    const data = getFilteredExpenses();
    if (data.length === 0) {
      toast.error('No expenses to export');
      return;
    }
    // Build CSV content
    const headers = ['Date', 'Description', 'Category', 'Vendor', 'Amount (TZS)', 'Payment Method', 'Notes'];
    const rows = data.map(e => [
      e.expense_date || e.created_at || '',
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(getCategoryInfo(e.category).name || '').replace(/"/g, '""')}"`,
      `"${(e.vendor || '').replace(/"/g, '""')}"`,
      e.amount || 0,
      `"${getPaymentMethodName(e.payment_method)}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `expenses_export_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} expenses`);
  };

  const getFilteredExpenses = () => {
    let filtered = [...expenses];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.description?.toLowerCase().includes(term) ||
        e.vendor?.toLowerCase().includes(term) ||
        e.receipt_image_name?.toLowerCase().includes(term) ||
        e.notes?.toLowerCase().includes(term)
      );
    }
    if (selectedCategory) {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    if (dateRange === 'today') filtered = filtered.filter(e => new Date(e.expense_date || e.created_at) >= startOfDay);
    else if (dateRange === 'week') filtered = filtered.filter(e => new Date(e.expense_date || e.created_at) >= startOfWeek);
    else if (dateRange === 'month') filtered = filtered.filter(e => new Date(e.expense_date || e.created_at) >= startOfMonth);
    else if (dateRange === 'year') filtered = filtered.filter(e => new Date(e.expense_date || e.created_at) >= startOfYear);
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') comparison = new Date(b.expense_date || b.created_at) - new Date(a.expense_date || a.created_at);
      else if (sortBy === 'amount') comparison = (b.amount || 0) - (a.amount || 0);
      else if (sortBy === 'category') comparison = (a.category || '').localeCompare(b.category || '');
      return sortOrder === 'desc' ? comparison : -comparison;
    });
    return filtered;
  };

  const getAnalytics = () => {
    const filtered = getFilteredExpenses();
    const totalExpenses = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalCount = filtered.length;
    const categoryTotals = {};
    const categoryCounts = {};
    filtered.forEach(e => {
      const cat = e.category || 'other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const methodTotals = {};
    filtered.forEach(e => {
      const method = e.payment_method || 'cash';
      methodTotals[method] = (methodTotals[method] || 0) + (e.amount || 0);
    });
    const monthlyTotals = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    filtered.forEach(e => {
      const date = new Date(e.expense_date || e.created_at);
      const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
      monthlyTotals[key] = (monthlyTotals[key] || 0) + (e.amount || 0);
    });
    const avgExpense = totalCount > 0 ? totalExpenses / totalCount : 0;
    const largestExpense = filtered.length > 0
      ? filtered.reduce((max, e) => (e.amount || 0) > (max.amount || 0) ? e : max, filtered[0])
      : null;
    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => ({
        category: cat, total, count: categoryCounts[cat] || 0,
        percentage: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
      }));
    return { totalExpenses, totalCount, avgExpense, largestExpense, categoryTotals, categoryCounts, methodTotals, monthlyTotals, sortedCategories, months };
  };

  const filteredExpenses = getFilteredExpenses();
  const analytics = getAnalytics();

  const getCategoryInfo = (catId) => {
    return EXPENSE_CATEGORIES.find(c => c.id === catId) || { id: 'other', name: 'Other', color: '#78716c', icon: '📋' };
  };

  const getPaymentMethodName = (methodId) => {
    const method = PAYMENT_METHODS.find(m => m.id === methodId);
    return method ? method.name : methodId;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'TZS',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 1000, padding: '20px',
  };

  const modalContentStyle = {
    background: '#1e293b', borderRadius: '16px', padding: '28px',
    width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
    border: '1px solid rgba(148,163,184,0.15)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px',
    color: '#e2e8f0', fontSize: '14px', outline: 'none',
  };

  const labelStyle = {
    display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: '500',
    marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  const renderExpenseForm = (isEdit = false) => (
    <form onSubmit={isEdit ? handleEditExpense : handleAddExpense}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>{t('expenses.description')} *</label>
          <input
            type="text" value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            style={inputStyle} placeholder={t('expenses.descriptionPlaceholder')}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>{t('expenses.amount')} *</label>
          <input
            type="text" value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            style={inputStyle} placeholder={t('expenses.amountPlaceholder')}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>{t('expenses.category')}</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            style={inputStyle}
          >
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t('expenses.paymentMethod')}</label>
          <select
            value={formData.payment_method}
            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
            style={inputStyle}
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t('expenses.expenseDate')}</label>
          <input
            type="date" value={formData.expense_date}
            onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('expenses.vendor')}</label>
          <input
            type="text" value={formData.vendor}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            style={inputStyle} placeholder={t('expenses.vendorPlaceholder')}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('expenses.receiptImage')}</label>
          <div style={{ position: 'relative' }}>
            <input
              type="file" accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setFormData({ ...formData, receipt_image: reader.result, receipt_image_name: file.name });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              style={{ ...inputStyle, padding: '8px 14px', cursor: 'pointer' }}
            />
            {formData.receipt_image_name && (
              <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Upload size={12} />
                {formData.receipt_image_name}
              </div>
            )}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>{t('expenses.notes')}</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            placeholder={t('expenses.notesPlaceholder')}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
          style={{
            padding: '10px 20px', background: 'rgba(148,163,184,0.1)',
            border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px',
            color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
          }}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          style={{
            padding: '10px 24px', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <Save size={16} />
          {isEdit ? t('expenses.updateExpense') : t('expenses.saveExpense')}
        </button>
      </div>
    </form>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ color: '#000000', fontSize: '24px', fontWeight: '700', margin: '0 0 4px 0' }}>
            <DollarSign size={24} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#22c55e' }} />
            {t('expenses.title')}
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>{t('expenses.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isPrincipal && (
            <ChainToggle selectedChain={selectedChain} onChainChange={setSelectedChain} />
          )}
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'analytics' : 'list')}
            style={{
              padding: '10px 16px',
              background: viewMode === 'analytics' ? 'rgba(59,130,246,0.2)' : 'rgba(15,23,42,0.6)',
              border: `1px solid ${viewMode === 'analytics' ? 'rgba(59,130,246,0.4)' : 'rgba(148,163,184,0.2)'}`,
              borderRadius: '10px',
              color: viewMode === 'analytics' ? '#60a5fa' : '#94a3b8',
              cursor: 'pointer', fontSize: '13px', fontWeight: '500',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {viewMode === 'list' ? <PieChart size={16} /> : <Receipt size={16} />}
            {viewMode === 'list' ? t('common.analytics') : t('common.list')}
          </button>
          {filteredExpenses.length > 0 && (
            <button
              onClick={exportToExcel}
              style={{
                padding: '10px 16px', background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px',
                color: '#22c55e', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
              title={t('common.export')}
            >
              <Download size={16} />
              {t('common.export')}
            </button>
          )}
          {canAddExpenses && (
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              style={{
                padding: '10px 20px', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
              }}
            >
              <Plus size={16} />
              {t('expenses.addExpense')}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '12px', padding: '18px', color: 'white', boxShadow: '0 4px 15px rgba(34,197,94,0.2)' }}>
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>{t('expenses.total')}</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{formatCurrency(analytics.totalExpenses)}</div>
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{analytics.totalCount} {t('expenses.transactions')}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', borderRadius: '12px', padding: '18px', color: 'white', boxShadow: '0 4px 15px rgba(59,130,246,0.2)' }}>
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>{t('expenses.average')}</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{formatCurrency(analytics.avgExpense)}</div>
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{t('expenses.perTransaction')}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '12px', padding: '18px', color: 'white', boxShadow: '0 4px 15px rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>{t('expenses.categoriesUsed')}</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{Object.keys(analytics.categoryTotals).length}</div>
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{t('expenses.differentCategories')}</div>
        </div>
        {analytics.largestExpense && (
          <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', borderRadius: '12px', padding: '18px', color: 'white', boxShadow: '0 4px 15px rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>{t('expenses.largest')}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {analytics.largestExpense.description || 'N/A'}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '2px' }}>{formatCurrency(analytics.largestExpense.amount)}</div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text" placeholder={t('common.search') + '...'} value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '36px' }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
              <X size={14} />
            </button>
          )}
        </div>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '140px' }}>
          <option value="">{t('expenses.allCategories')}</option>
          {EXPENSE_CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
          ))}
        </select>
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '120px' }}>
          <option value="all">{t('common.allTime')}</option>
          <option value="today">{t('common.today')}</option>
          <option value="week">{t('common.thisWeek')}</option>
          <option value="month">{t('common.thisMonth')}</option>
          <option value="year">{t('common.thisYear')}</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '120px' }}>
          <option value="date">{t('common.sortByDate')}</option>
          <option value="amount">{t('common.sortByAmount')}</option>
          <option value="category">{t('common.sortByCategory')}</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          title={sortOrder === 'desc' ? t('common.newestFirst') : t('common.oldestFirst')}
        >
          {sortOrder === 'desc' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div style={{ background: 'rgba(30,41,59,0.8)', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.1)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
          ) : filteredExpenses.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <Wallet size={48} style={{ color: '#334155', marginBottom: '12px' }} />
              <div style={{ color: '#64748b', fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>{t('expenses.noExpenses')}</div>
              <div style={{ color: '#475569', fontSize: '13px' }}>
                {searchTerm || selectedCategory || dateRange !== 'all'
                  ? t('expenses.adjustFilters')
                  : t('expenses.addFirst')}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('common.date')}</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('common.description')}</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('expenses.category')}</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('expenses.vendor')}</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('common.amount')}</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('expenses.paymentMethod')}</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense, idx) => {
                    const catInfo = getCategoryInfo(expense.category);
                    return (
                      <tr key={expense._id || expense.id || idx} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatDate(expense.expense_date || expense.created_at)}</td>
                        <td style={{ padding: '14px 16px', color: '#e2e8f0', fontWeight: '500' }}>
                          <div>{expense.description}</div>
                          {expense.notes && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{expense.notes}</div>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: `${catInfo.color}15`, color: catInfo.color, borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                            {catInfo.icon} {catInfo.name}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{expense.vendor || <span style={{ color: '#475569' }}>—</span>}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', color: '#f87171', fontWeight: '600', fontSize: '14px' }}>{formatCurrency(expense.amount)}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{ padding: '3px 8px', background: 'rgba(148,163,184,0.1)', borderRadius: '4px', fontSize: '11px', color: '#94a3b8' }}>
                            {getPaymentMethodName(expense.payment_method)}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {canEditExpenses && (
                              <>
                                <button onClick={() => openEditModal(expense)} style={{ padding: '6px', background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: '6px', color: '#60a5fa', cursor: 'pointer' }} title={t('common.edit')}>
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDeleteExpense(expense._id || expense.id)} style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: '#f87171', cursor: 'pointer' }} title={t('common.delete')}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div>
          {/* Category Breakdown */}
          <div style={{ background: 'rgba(30,41,59,0.8)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(148,163,184,0.1)', marginBottom: '20px' }}>
            <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 16px 0' }}>
              <PieChart size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              {t('expenses.categoryBreakdown')}
            </h3>
            {analytics.sortedCategories.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>{t('expenses.noData')}</p>
            ) : (
              <div>
                {analytics.sortedCategories.map((cat, idx) => {
                  const catInfo = getCategoryInfo(cat.category);
                  return (
                    <div key={cat.category} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: '#cbd5e1' }}>{catInfo.icon} {catInfo.name}</span>
                        <span style={{ color: '#94a3b8' }}>{formatCurrency(cat.total)} ({cat.percentage}%)</span>
                      </div>
                      <div style={{ background: 'rgba(148,163,184,0.15)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${cat.percentage}%`, background: catInfo.color, height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{cat.count} {t('expenses.transactions')}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Monthly Trends */}
          <div style={{ background: 'rgba(30,41,59,0.8)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(148,163,184,0.1)', marginBottom: '20px' }}>
            <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 16px 0' }}>
              <BarChart3 size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              {t('expenses.monthlyTrends')}
            </h3>
            {Object.keys(analytics.monthlyTotals).length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>{t('expenses.noMonthlyData')}</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', padding: '0 4px' }}>
                {Object.entries(analytics.monthlyTotals).map(([month, total], idx) => {
                  const maxVal = Math.max(...Object.values(analytics.monthlyTotals), 1);
                  const height = (total / maxVal) * 140;
                  return (
                    <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', fontWeight: total > 0 ? '600' : '400' }}>
                        {formatCurrency(total)}
                      </div>
                      <div style={{ width: '100%', height: `${Math.max(height, 4)}px`, background: 'linear-gradient(180deg, #22c55e, #16a34a)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease', minHeight: total > 0 ? '4px' : '2px' }} />
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>{month}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Method Breakdown */}
          <div style={{ background: 'rgba(30,41,59,0.8)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(148,163,184,0.1)' }}>
            <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 16px 0' }}>
              <CreditCard size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              {t('expenses.paymentMethods')}
            </h3>
            {Object.keys(analytics.methodTotals).length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>{t('expenses.noPaymentData')}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                {Object.entries(analytics.methodTotals).map(([method, total]) => {
                  const pct = analytics.totalExpenses > 0 ? Math.round((total / analytics.totalExpenses) * 100) : 0;
                  const methodColors = {
                    cash: { bg: '#22c55e', label: 'Cash' },
                    bank_transfer: { bg: '#3b82f6', label: 'Bank Transfer' },
                    mobile_money: { bg: '#8b5cf6', label: 'Mobile Money' },
                    cheque: { bg: '#f59e0b', label: 'Cheque' },
                    credit_card: { bg: '#ec4899', label: 'Credit Card' },
                  };
                  const mc = methodColors[method] || { bg: '#64748b', label: method };
                  return (
                    <div key={method} style={{ background: `${mc.bg}15`, borderRadius: '10px', padding: '16px', textAlign: 'center', border: `1px solid ${mc.bg}30` }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{mc.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: mc.bg }}>{formatCurrency(total)}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{pct}% of total</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <div style={modalOverlayStyle} onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#22c55e' }} />
                {t('expenses.addNewExpense')}
              </h2>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            {renderExpenseForm(false)}
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditModal && (
        <div style={modalOverlayStyle} onClick={() => { setShowEditModal(false); resetForm(); }}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <Edit2 size={18} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#3b82f6' }} />
                {t('expenses.editExpense')}
              </h2>
              <button onClick={() => { setShowEditModal(false); resetForm(); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            {renderExpenseForm(true)}
          </div>
        </div>
      )}
    </div>
  );
}

export default Expenses;
