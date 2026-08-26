import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { toast } from '../hooks/useSoundEnabledToast';
import { 
  Bell, Plus, Edit2, Trash2, X,
  AlertTriangle, Calendar, Printer
} from 'lucide-react';

import { API_URL } from '../config/api';
import ChainToggle from '../components/ChainToggle';

const ANNOUNCEMENT_TYPES = [
  { value: 'general', label: 'General', color: '#3b82f6' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  { value: 'event', label: 'Event', color: '#22c55e' },
  { value: 'academic', label: 'Academic', color: '#8b5cf6' },
  { value: 'financial', label: 'Financial', color: '#f59e0b' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

const TYPE_CLASS = {
  general: 'general',
  urgent: 'urgent',
  event: 'event',
  academic: 'academic',
  financial: 'financial',
};

const PRIORITY_CLASS = {
  low: 'low',
  normal: 'normal',
  high: 'high',
};

function Announcements() {
  const currentUser = useSelector(selectCurrentUser);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [selectedChain, setSelectedChain] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    announcement_type: 'general',
    priority: 'normal',
    expires_at: ''
  });

  const canManageAnnouncements = ['secretary', 'principal', 'director', 'coordinator'].includes(currentUser?.role?.toLowerCase());

  useEffect(() => {
    loadAnnouncements(selectedChain);
  }, [selectedChain]);

  const loadAnnouncements = async (chainFilter = '') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      let url = `${API_URL}/api/announcements`;
      if (chainFilter) {
        url += `?chain=${chainFilter}`;
      }
      const response = await fetch(url, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      }
    } catch (error) {
      console.error('Failed to load announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const annData = {
        ...formData,
        chain: currentUser?.chain,
        created_by: currentUser?.id,
        created_by_name: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim(),
        status: 'published'
      };
      
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_URL}/api/announcements`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(annData)
      });
      
      if (response.ok) {
        toast.success('Announcement created');
        setShowModal(false);
        resetForm();
        loadAnnouncements();
      } else {
        throw new Error('Failed to create');
      }
    } catch (error) {
      toast.error('Failed to create announcement');
    }
  };

  const handleUpdateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_URL}/api/announcements/${editingAnn.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success('Announcement updated');
        setShowModal(false);
        resetForm();
        loadAnnouncements();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update announcement');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_URL}/api/announcements/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (response.ok) {
        toast.success('Announcement deleted');
        loadAnnouncements();
      }
    } catch (error) {
      toast.error('Failed to delete announcement');
    }
  };

  const handleEdit = (ann) => {
    setEditingAnn(ann);
    setFormData({
      title: ann.title,
      content: ann.content,
      announcement_type: ann.announcement_type,
      priority: ann.priority,
      expires_at: ann.expires_at || ''
    });
    setShowModal(true);
  };

  const handlePrint = (ann) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>${ann.title}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #0f4c81; padding-bottom: 15px; margin-bottom: 20px; }
            .school-name { font-size: 20px; font-weight: bold; color: #0f4c81; }
            .announcement-type { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: 500; margin-top: 10px; }
            .title { font-size: 18px; font-weight: bold; margin: 20px 0; }
            .content { font-size: 14px; line-height: 1.6; margin-bottom: 30px; }
            .meta { font-size: 12px; color: #666; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">IHEZA</div>
            <div style="font-size: 12px; color: #666;">The Institute of Holistic Education of Zanzibar</div>
            <div class="announcement-type" style="background: ${ann.announcement_type === 'urgent' ? '#fee2e2' : '#e0f2fe'}; color: ${ann.announcement_type === 'urgent' ? '#dc2626' : '#0369a1'};">
              ${ann.announcement_type.toUpperCase()}
            </div>
          </div>
          <div class="title">${ann.title}</div>
          <div class="content">${ann.content}</div>
          <div class="meta">
            <p>Posted by: ${ann.created_by_name || 'Administrator'}</p>
            <p>Date: ${new Date(ann.created_at).toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const resetForm = () => {
    setEditingAnn(null);
    setFormData({
      title: '',
      content: '',
      announcement_type: 'general',
      priority: 'normal',
      expires_at: ''
    });
  };

  const filteredAnnouncements = announcements.filter(ann => {
    const matchesType = !filterType || ann.announcement_type === filterType;
    const matchesPriority = !filterPriority || ann.priority === filterPriority;
    return matchesType && matchesPriority;
  });

  const getTypeInfo = (type) => ANNOUNCEMENT_TYPES.find(t => t.value === type) || ANNOUNCEMENT_TYPES[0];

  const countByType = (type) => announcements.filter(a => a.announcement_type === type).length;

  return (
    <div className="announcements-page">
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
        loadAnnouncements(chain);
      }} />
      <style>{`
        .announcements-page {
          background: #eef2f7;
          font-family: 'Segoe UI', 'Arial', sans-serif;
          padding: 1.2rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
        }
        .excel-wrapper {
          max-width: 1400px;
          width: 100%;
          background: white;
          border-radius: 18px;
          box-shadow: 0 16px 32px -12px rgba(0, 20, 30, 0.18);
          padding: 1.2rem 1.2rem 1.5rem;
        }
        .excel-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1a3b5d;
          padding-bottom: 0.6rem;
          margin-bottom: 1rem;
        }
        .excel-header .title { display: flex; align-items: center; gap: 0.6rem; }
        .excel-header .title h1 { font-size: 1.3rem; font-weight: 600; color: #0b2a44; }
        .excel-header .title .badge { background: #dce5f0; padding: 0.1rem 0.8rem; border-radius: 40px; font-weight: 600; color: #1a3b5d; font-size: 0.7rem; }
        .excel-header .tools { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .excel-header .tools button {
          background: white; border: 1px solid #c7d6e8; border-radius: 30px; padding: 0.25rem 1rem;
          font-weight: 500; color: #1f3b5c; cursor: pointer; transition: 0.15s;
          display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem;
        }
        .excel-header .tools button:hover { background: #f2f6fc; border-color: #1a3b5d; }
        .excel-header .tools button.primary { background: #1a3b5d; color: white; border-color: #1a3b5d; }
        .excel-header .tools button.primary:hover { background: #12304b; }

        .stats-compact {
          display: flex; align-items: center; gap: 0.5rem 1.2rem; flex-wrap: wrap;
          background: #f8faff; padding: 0.2rem 1rem; border-radius: 40px;
          border: 1px solid #e2e8f0; margin-bottom: 0.8rem;
        }
        .stats-compact .stat-item { display: flex; align-items: baseline; gap: 0.2rem; padding: 0.1rem 0.2rem; }
        .stats-compact .stat-item .value { font-size: 1rem; font-weight: 700; color: #0b2a44; }
        .stats-compact .stat-item .value.green { color: #2d6a3e; }
        .stats-compact .stat-item .value.orange { color: #b87a2b; }
        .stats-compact .stat-item .value.blue { color: #1a4b7a; }
        .stats-compact .stat-item .value.red { color: #b33a3a; }
        .stats-compact .stat-item .value.purple { color: #5b3a8a; }
        .stats-compact .stat-item .label { font-size: 0.6rem; color: #6a8aa8; text-transform: uppercase; letter-spacing: 0.2px; font-weight: 500; }
        .stats-compact .stat-divider { color: #d0d7e2; font-size: 0.6rem; }

        .filter-row {
          display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; margin-bottom: 0.8rem;
          background: #f8faff; padding: 0.3rem 1rem; border-radius: 40px; border: 1px solid #e2e8f0;
        }
        .filter-row select {
          padding: 0.2rem 0.6rem; border-radius: 30px; border: 1px solid #d0d7e2; background: white;
          font-size: 0.7rem; color: #1f3b5c; outline: none; cursor: pointer;
        }
        .filter-row select:focus { border-color: #1a3b5d; }
        .filter-row .clear-btn { background: transparent; border: none; color: #3f6490; font-size: 0.7rem; cursor: pointer; padding: 0.1rem 0.4rem; border-radius: 20px; }
        .filter-row .clear-btn:hover { background: #e2eaf3; }
        .filter-row .stats-info { font-size: 0.7rem; color: #5a7a9a; margin-left: auto; }

        .excel-container { overflow-x: auto; border-radius: 12px; border: 1px solid #d0d7e2; background: white; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02); }
        .excel-table { width: 100%; border-collapse: collapse; font-family: 'Segoe UI', 'Arial', sans-serif; font-size: 0.78rem; min-width: 1000px; }
        .excel-table thead th {
          background: #e8edf4; color: #1f3b5c; font-weight: 600; text-transform: uppercase;
          font-size: 0.65rem; letter-spacing: 0.3px; padding: 0.4rem 0.5rem;
          border-right: 1px solid #d0d7e2; border-bottom: 2px solid #b8c6d8;
          text-align: left; white-space: nowrap; position: sticky; top: 0; z-index: 10;
        }
        .excel-table thead th:last-child { border-right: none; }
        .excel-table tbody td {
          padding: 0.3rem 0.5rem; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;
          vertical-align: middle; color: #1e2f3f; background: white;
        }
        .excel-table tbody td:last-child { border-right: none; }
        .excel-table tbody tr:nth-child(even) td { background: #f8faff; }
        .excel-table tbody tr:hover td { background: #e8f0fe; }

        .type-badge { display: inline-block; padding: 0.05rem 0.5rem; border-radius: 30px; font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2px; }
        .type-badge.general { background: #dbeafe; color: #1a4b7a; }
        .type-badge.urgent { background: #f8dddd; color: #8a3a3a; }
        .type-badge.event { background: #dff0d8; color: #2d6a3e; }
        .type-badge.academic { background: #ede7f6; color: #5b3a8a; }
        .type-badge.financial { background: #fff3d6; color: #8a6d2b; }

        .priority-badge { display: inline-block; padding: 0.05rem 0.4rem; border-radius: 12px; font-size: 0.6rem; font-weight: 600; text-transform: uppercase; }
        .priority-badge.low { background: #eef2f7; color: #4a5a6e; }
        .priority-badge.normal { background: #dbeafe; color: #1a4b7a; }
        .priority-badge.high { background: #fff3d6; color: #8a6d2b; }

        .action-group { display: flex; gap: 0.2rem; flex-wrap: wrap; align-items: center; }
        .action-group button { background: transparent; border: none; padding: 0.15rem 0.3rem; border-radius: 4px; cursor: pointer; color: #3f6490; transition: 0.1s; font-size: 0.7rem; }
        .action-group button:hover { background: #dce5f0; color: #0b2a44; }
        .action-group button.danger:hover { background: #f8dddd; color: #b33a3a; }
        .action-group button.success:hover { background: #dff0d8; color: #2d6a3e; }

        .pagination-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 0.4rem 0.8rem; background: #f8faff; border-top: 1px solid #d0d7e2; border-radius: 0 0 12px 12px; font-size: 0.75rem; color: #1f3b5c; }
        .pagination-bar .info { color: #3f6490; font-size: 0.7rem; }

        .loading-state { text-align: center; padding: 3rem; color: #5a7a9a; font-size: 0.85rem; }

        .empty-state { text-align: center; padding: 3rem; color: #5a7a9a; font-size: 0.85rem; }
        .empty-state i { font-size: 2rem; color: #b8c6d8; margin-bottom: 0.5rem; display: block; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal { background: white; border-radius: 14px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2); }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 2px solid #1a3b5d; }
        .modal-title { font-size: 1.05rem; font-weight: 600; color: #0b2a44; }
        .modal-close { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.4rem; }
        .modal-close:hover { color: #0b2a44; }
        .modal-body { padding: 1.25rem; }
        .modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding: 1rem 1.25rem; border-top: 1px solid #e2e8f0; }

        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.7rem; font-weight: 600; color: #1f3b5c; margin-bottom: 0.4rem; text-transform: uppercase; }
        .form-input, .form-select, .form-textarea {
          width: 100%; padding: 0.5rem 0.7rem; border: 1px solid #d0d7e2; border-radius: 8px;
          font-size: 0.8rem; color: #1f3b5c; outline: none; background: white; transition: 0.15s;
        }
        .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #1a3b5d; box-shadow: 0 0 0 3px rgba(26, 59, 93, 0.1); }
        .form-textarea { min-height: 120px; resize: vertical; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .btn { padding: 0.5rem 1.1rem; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: 0.15s; }
        .btn-secondary { background: white; border-color: #c7d6e8; color: #1f3b5c; }
        .btn-secondary:hover { background: #f2f6fc; }
        .btn-primary { background: #1a3b5d; color: white; border-color: #1a3b5d; }
        .btn-primary:hover { background: #12304b; }

        @media (max-width: 700px) {
          .announcements-page { padding: 0.6rem; }
          .excel-wrapper { padding: 0.8rem; }
          .excel-header .title h1 { font-size: 1rem; }
          .stats-compact { gap: 0.3rem 0.8rem; }
          .filter-row { flex-direction: column; align-items: stretch; border-radius: 20px; padding: 0.5rem 0.8rem; }
          .filter-row .stats-info { margin-left: 0; text-align: center; }
          .excel-table { font-size: 0.65rem; min-width: 750px; }
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="excel-wrapper">
        {/* HEADER */}
        <div className="excel-header">
          <div className="title">
            <h1><Bell size={20} style={{ color: '#1a3b5d', marginRight: 6 }} />Announcements</h1>
            <span className="badge"><Calendar size={12} /> {new Date().getFullYear()}</span>
          </div>
          <div className="tools">
            <button onClick={() => window.print()}><Printer size={14} /> Print</button>
            {canManageAnnouncements && (
              <button className="primary" onClick={() => { resetForm(); setShowModal(true); }}>
                <Plus size={14} /> New
              </button>
            )}
          </div>
        </div>

        {/* STATS COMPACT */}
        <div className="stats-compact">
          <span className="stat-item">
            <span className="value">{announcements.length}</span>
            <span className="label">Total</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="value blue">{countByType('general')}</span>
            <span className="label">General</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="value red">{countByType('urgent')}</span>
            <span className="label">Urgent</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="value green">{countByType('event')}</span>
            <span className="label">Event</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="value purple">{countByType('academic')}</span>
            <span className="label">Academic</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="value orange">{countByType('financial')}</span>
            <span className="label">Financial</span>
          </span>
        </div>

        {/* FILTER ROW */}
        <div className="filter-row">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {ANNOUNCEMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">All Priority</option>
            {PRIORITY_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button className="clear-btn" onClick={() => { setFilterType(''); setFilterPriority(''); }}>
            <X size={12} /> Clear
          </button>
          <span className="stats-info"><Bell size={12} /> {filteredAnnouncements.length} records</span>
        </div>

        {/* EXCEL TABLE */}
        <div className="excel-container">
          {loading ? (
            <div className="loading-state">Loading announcements...</div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="empty-state">
              <Bell size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No announcements found</p>
            </div>
          ) : (
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>#</th>
                  <th style={{ minWidth: 160 }}>Title</th>
                  <th style={{ minWidth: 200 }}>Content</th>
                  <th style={{ width: 90 }}>Type</th>
                  <th style={{ width: 80 }}>Priority</th>
                  <th style={{ width: 100 }}>Posted By</th>
                  <th style={{ width: 85 }}>Date</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnnouncements.map((ann, index) => {
                  const typeInfo = getTypeInfo(ann.announcement_type);
                  return (
                    <tr key={ann.id}>
                      <td style={{ textAlign: 'center', color: '#7a92b0' }}>{index + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0b2a44' }}>
                          {ann.announcement_type === 'urgent' && <AlertTriangle size={12} color="#ef4444" style={{ marginRight: 4 }} />}
                          {ann.title}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.7rem', color: '#3f4a5a' }}>{ann.content}</td>
                      <td><span className={`type-badge ${TYPE_CLASS[ann.announcement_type] || 'general'}`}>{typeInfo.label}</span></td>
                      <td><span className={`priority-badge ${PRIORITY_CLASS[ann.priority] || 'normal'}`}>{ann.priority}</span></td>
                      <td style={{ fontSize: '0.7rem' }}>{ann.created_by_name || 'Administrator'}</td>
                      <td style={{ fontSize: '0.7rem', color: '#3f6490' }}>{new Date(ann.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="action-group">
                          <button title="Print" className="success" onClick={() => handlePrint(ann)}><Printer size={14} /></button>
                          {canManageAnnouncements && (
                            <>
                              <button title="Edit" onClick={() => handleEdit(ann)}><Edit2 size={14} /></button>
                              <button title="Delete" className="danger" onClick={() => handleDeleteAnnouncement(ann.id)}><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* PAGINATION */}
          <div className="pagination-bar">
            <span className="info"><Bell size={12} /> {filteredAnnouncements.length} records · page 1 of 1</span>
          </div>
        </div>

      </div>


      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingAnn ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={editingAnn ? handleUpdateAnnouncement : handleCreateAnnouncement}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="Announcement title"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={formData.announcement_type}
                      onChange={(e) => setFormData({...formData, announcement_type: e.target.value})}
                    >
                      {ANNOUNCEMENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-select"
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Content *</label>
                  <textarea
                    className="form-textarea"
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    required
                    placeholder="Write your announcement..."
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Expires On (Optional)</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAnn ? 'Update' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Announcements;
