import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { toast } from '../hooks/useSoundEnabledToast';
import { 
  Trash2, RotateCcw, AlertTriangle, Search, X,
  Users, GraduationCap, ClipboardList, FileText,
  BookOpen, Calendar, DollarSign, QrCode, Bell,
  BookMarked, Award
} from 'lucide-react';
import { API_URL } from '../config/api';

const ITEM_TYPE_CONFIG = {
  students: { icon: GraduationCap, label: 'Student', color: '#3b82f6' },
  staff: { icon: Users, label: 'Staff', color: '#8b5cf6' },
  tasks: { icon: ClipboardList, label: 'Task', color: '#f59e0b' },
  staff_tasks: { icon: ClipboardList, label: 'Staff Task', color: '#f59e0b' },
  student_tasks: { icon: ClipboardList, label: 'Student Task', color: '#f59e0b' },
  classes: { icon: BookOpen, label: 'Class', color: '#22c55e' },
  subjects: { icon: BookMarked, label: 'Subject', color: '#06b6d4' },
  announcements: { icon: Bell, label: 'Announcement', color: '#ef4444' },
  lesson_plans: { icon: FileText, label: 'Lesson Plan', color: '#6366f1' },
  assessments: { icon: Award, label: 'Assessment', color: '#ec4899' },
  payments: { icon: DollarSign, label: 'Payment', color: '#10b981' },
  qr_codes: { icon: QrCode, label: 'QR Code', color: '#14b8a6' },
  almanac_events: { icon: Calendar, label: 'Event', color: '#f97316' },
  fee_structures: { icon: DollarSign, label: 'Fee Structure', color: '#84cc16' },
  documents: { icon: FileText, label: 'Document', color: '#0284c7' },
};

function Bin() {
  const currentUser = useSelector(selectCurrentUser);
  const isPrincipal = currentUser?.role === 'principal';
  const [binItems, setBinItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  useEffect(() => {
    loadBinItems();
  }, []);

  const loadBinItems = async () => {
    setLoading(true);
    try {
      // 1. Load from backend API
      const token = localStorage.getItem('sessionToken');
      let backendItems = [];
      if (token) {
        try {
          const response = await fetch(`${API_URL}/api/bin`, {
            headers: {
              ...(token && { 'Authorization': `Bearer ${token}` })
            }
          });
          if (response.ok) {
            backendItems = await response.json();
          }
        } catch (err) {
          console.error('Failed to load backend bin:', err);
        }
      }

      // 2. Load from localStorage (documents bin)
      let localItems = [];
      try {
        const saved = localStorage.getItem('iheza_bin');
        if (saved) {
          localItems = JSON.parse(saved);
        }
      } catch (err) {
        console.error('Failed to load local bin:', err);
      }

      // 3. Combine both sources
      setBinItems([...backendItems, ...localItems]);
    } catch (error) {
      console.error('Failed to load bin:', error);
      toast.error('Failed to load bin');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (itemId) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_URL}/api/bin/restore/${itemId}`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (response.ok) {
        toast.success('Item restored successfully');
        setBinItems(prev => prev.filter(item => item.id !== itemId));
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to restore item');
      }
    } catch (error) {
      toast.error('Failed to restore item');
    }
  };

  const handlePermanentDelete = async (itemId) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_URL}/api/bin/${itemId}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (response.ok) {
        toast.success('Item permanently deleted');
        setBinItems(prev => prev.filter(item => item.id !== itemId));
        setConfirmDelete(null);
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to delete item');
      }
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const handleEmptyBin = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_URL}/api/bin`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Bin emptied');
        setBinItems([]);
        setConfirmEmpty(false);
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to empty bin');
      }
    } catch (error) {
      toast.error('Failed to empty bin');
    }
  };

  const toggleSelectItem = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkRestore = async () => {
    for (const itemId of selectedItems) {
      await handleRestore(itemId);
    }
    setSelectedItems(new Set());
  };

  const handleBulkDelete = async () => {
    for (const itemId of selectedItems) {
      await handlePermanentDelete(itemId);
    }
    setSelectedItems(new Set());
  };

  const getItemTypeConfig = (type) => {
    return ITEM_TYPE_CONFIG[type] || { icon: FileText, label: type || 'Unknown', color: '#64748b' };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const filteredItems = binItems.filter(item => {
    const matchesSearch = !searchTerm || 
      (item.item_summary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.item_type || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || item.item_type === filterType;
    return matchesSearch && matchesType;
  });

  // Get unique item types for filter
  const itemTypes = [...new Set(binItems.map(item => item.item_type))];

  return (
    <div className="bin-page">
      <style>{`
        .bin-page {
          padding: 1.5rem;
          min-height: 100vh;
        }
        
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .page-title-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .page-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        
        .filters-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          align-items: center;
        }
        
        .search-box {
          position: relative;
          flex: 1;
          min-width: 200px;
        }
        
        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }
        
        .search-input {
          width: 100%;
          padding: 0.75rem 0.75rem 0.75rem 2.5rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
        }
        
        .filter-select {
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
          min-width: 150px;
        }
        
        .stats-bar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        
        .stat-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 0.75rem;
          padding: 0.75rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .stat-card .stat-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f8fafc;
        }
        
        .stat-card .stat-label {
          font-size: 0.75rem;
          color: #94a3b8;
        }
        
        .bin-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .bin-item {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 0.75rem;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s;
        }
        
        .bin-item:hover {
          border-color: rgba(71, 85, 105, 0.8);
          background: rgba(30, 41, 59, 0.95);
        }
        
        .bin-item.selected {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
        }
        
        .item-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #3b82f6;
        }
        
        .item-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .item-info {
          flex: 1;
          min-width: 0;
        }
        
        .item-summary {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .item-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: #64748b;
          flex-wrap: wrap;
        }
        
        .item-type-badge {
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .item-actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        
        .action-btn {
          padding: 0.5rem 0.75rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          transition: all 0.2s;
        }
        
        .action-btn.restore {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }
        
        .action-btn.restore:hover {
          background: rgba(16, 185, 129, 0.25);
        }
        
        .action-btn.delete-permanent {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }
        
        .action-btn.delete-permanent:hover {
          background: rgba(239, 68, 68, 0.25);
        }
        
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #64748b;
        }
        
        .empty-state svg {
          margin: 0 auto 1rem;
          opacity: 0.3;
        }
        
        .empty-state h3 {
          font-size: 1.125rem;
          color: #94a3b8;
          margin: 0 0 0.5rem 0;
        }
        
        .empty-state p {
          font-size: 0.875rem;
          color: #64748b;
          margin: 0;
        }
        
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        
        .confirm-dialog {
          background: #1e293b;
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          max-width: 400px;
          width: 100%;
          text-align: center;
        }
        
        .confirm-dialog h3 {
          font-size: 1.125rem;
          color: #f8fafc;
          margin: 1rem 0 0.5rem;
        }
        
        .confirm-dialog p {
          font-size: 0.875rem;
          color: #94a3b8;
          margin: 0 0 1.5rem;
        }
        
        .confirm-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
        }
        
        .btn {
          padding: 0.625rem 1.25rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-secondary {
          background: rgba(51, 65, 85, 0.5);
          color: #94a3b8;
        }
        
        .btn-secondary:hover {
          background: rgba(51, 65, 85, 0.8);
          color: #f8fafc;
        }
        
        .btn-danger {
          background: #dc2626;
          color: white;
        }
        
        .btn-danger:hover {
          background: #b91c1c;
        }
        
        .btn-warning {
          background: #d97706;
          color: white;
        }
        
        .btn-warning:hover {
          background: #b45309;
        }
        
        .btn-success {
          background: #059669;
          color: white;
        }
        
        .btn-success:hover {
          background: #047857;
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .bulk-actions {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 0.75rem;
          margin-bottom: 1rem;
          align-items: center;
        }
        
        .bulk-actions .selected-count {
          font-size: 0.875rem;
          color: #60a5fa;
          font-weight: 500;
        }
        
        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .bin-item {
            flex-wrap: wrap;
          }
          
          .item-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <Trash2 size={20} color="white" />
          </span>
          Bin
        </h1>
        <div className="page-actions">
          {isPrincipal && binItems.length > 0 && (
            <button className="btn btn-danger" onClick={() => setConfirmEmpty(true)}>
              <Trash2 size={16} /> Empty Bin
            </button>
          )}
          <button className="btn btn-secondary" onClick={loadBinItems} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-card">
          <Trash2 size={20} color="#ef4444" />
          <div>
            <div className="stat-value">{binItems.length}</div>
            <div className="stat-label">Deleted Items</div>
          </div>
        </div>
        <div className="stat-card">
          <RotateCcw size={20} color="#34d399" />
          <div>
            <div className="stat-value">{itemTypes.length}</div>
            <div className="stat-label">Item Types</div>
          </div>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-box">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search deleted items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          {itemTypes.map(type => {
            const config = getItemTypeConfig(type);
            return (
              <option key={type} value={type}>{config.label}s</option>
            );
          })}
        </select>
      </div>

      {isPrincipal && selectedItems.size > 0 && (
        <div className="bulk-actions">
          <span className="selected-count">{selectedItems.size} selected</span>
          <button className="btn btn-success" onClick={handleBulkRestore}>
            <RotateCcw size={14} /> Restore All
          </button>
          <button className="btn btn-danger" onClick={handleBulkDelete}>
            <Trash2 size={14} /> Delete Permanently
          </button>
          <button className="btn btn-secondary" onClick={() => setSelectedItems(new Set())}>
            <X size={14} /> Clear Selection
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p>Loading bin items...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <Trash2 size={48} />
          <h3>Bin is empty</h3>
          <p>Deleted items will appear here. You can restore them or permanently delete them.</p>
        </div>
      ) : (
        <div className="bin-items-list">
          {filteredItems.map(item => {
            const config = getItemTypeConfig(item.item_type);
            const Icon = config.icon;
            
            return (
              <div key={item.id} className={`bin-item ${selectedItems.has(item.id) ? 'selected' : ''}`}>
                {isPrincipal && (
                  <input
                    type="checkbox"
                    className="item-checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelectItem(item.id)}
                  />
                )}
                <div className="item-icon" style={{ background: `${config.color}20` }}>
                  <Icon size={20} color={config.color} />
                </div>
                <div className="item-info">
                  <div className="item-summary">{item.item_summary || 'Unknown item'}</div>
                  <div className="item-meta">
                    <span className="item-type-badge" style={{ background: `${config.color}20`, color: config.color }}>
                      {config.label}
                    </span>
                    <span>Deleted by: {item.deleted_by?.name || 'Unknown'}</span>
                    <span>{formatDate(item.deleted_at)}</span>
                  </div>
                </div>
                {isPrincipal && (
                  <div className="item-actions">
                    <button
                      className="action-btn restore"
                      onClick={() => handleRestore(item.id)}
                      title="Restore"
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button
                      className="action-btn delete-permanent"
                      onClick={() => setConfirmDelete(item.id)}
                      title="Delete permanently"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm permanent delete dialog */}
      {confirmDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle size={40} color="#ef4444" />
            <h3>Permanently Delete?</h3>
            <p>This item will be permanently deleted and cannot be recovered. Are you sure?</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handlePermanentDelete(confirmDelete)}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm empty bin dialog */}
      {confirmEmpty && (
        <div className="confirm-overlay" onClick={() => setConfirmEmpty(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle size={40} color="#ef4444" />
            <h3>Empty Bin?</h3>
            <p>All {binItems.length} items in the bin will be permanently deleted. This cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmEmpty(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleEmptyBin}>
                Empty Bin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Bin;
