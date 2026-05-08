import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { toast } from 'sonner';
import { 
  Bell, Plus, Edit2, Trash2, X, Download, Search,
  AlertTriangle, Calendar, User, FileText, Printer
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

function Announcements() {
  const currentUser = useSelector(selectCurrentUser);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
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
    const matchesSearch = ann.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ann.content?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || ann.announcement_type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeInfo = (type) => ANNOUNCEMENT_TYPES.find(t => t.value === type) || ANNOUNCEMENT_TYPES[0];

  return (
    <div className="announcements-page">
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
        loadAnnouncements(chain);
      }} />
      <style>{`
        .announcements-page { padding: 1.5rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.75rem; }
        .page-title-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        
        .filters-row { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .search-box { position: relative; flex: 1; min-width: 200px; }
        .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #64748b; }
        .search-input { width: 100%; padding: 0.75rem 0.75rem 0.75rem 2.5rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        .filter-select { padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        
        .announcements-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem; }
        @media (max-width: 768px) { .announcements-grid { grid-template-columns: 1fr; } }
        
        .announcement-card { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; overflow: hidden; }
        .announcement-card.urgent { border-left: 4px solid #ef4444; }
        .announcement-card.high { border-left: 4px solid #f59e0b; }
        
        .announcement-header { padding: 1rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); display: flex; align-items: flex-start; justify-content: space-between; }
        .announcement-type-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; text-transform: uppercase; }
        .announcement-priority { padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 500; margin-left: 0.5rem; }
        .priority-high { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .priority-normal { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .priority-low { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }
        
        .announcement-body { padding: 1rem; }
        .announcement-title { font-size: 1.125rem; font-weight: 600; color: #f8fafc; margin-bottom: 0.5rem; }
        .announcement-content { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; max-height: 100px; overflow: hidden; text-overflow: ellipsis; }
        
        .announcement-footer { padding: 1rem; border-top: 1px solid rgba(51, 65, 85, 0.5); display: flex; align-items: center; justify-content: space-between; }
        .announcement-meta { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 1rem; }
        .announcement-actions { display: flex; gap: 0.5rem; }
        
        .action-btn { padding: 0.5rem; background: rgba(51, 65, 85, 0.5); border: none; border-radius: 0.5rem; color: #94a3b8; cursor: pointer; transition: all 0.2s; }
        .action-btn:hover { background: rgba(51, 65, 85, 0.8); color: #f8fafc; }
        .action-btn.edit:hover { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
        .action-btn.delete:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .action-btn.print:hover { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal { background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
        .modal-title { font-size: 1.125rem; font-weight: 600; color: #f8fafc; }
        .modal-close { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.5rem; }
        .modal-body { padding: 1.25rem; }
        .modal-footer { display: flex; gap: 1rem; justify-content: flex-end; padding: 1.25rem; border-top: 1px solid rgba(51, 65, 85, 0.5); }
        
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.75rem; font-weight: 500; color: #94a3b8; margin-bottom: 0.5rem; text-transform: uppercase; }
        .form-input, .form-select, .form-textarea { width: 100%; padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        .form-textarea { resize: vertical; min-height: 150px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        
        .empty-state { text-align: center; padding: 3rem; color: #64748b; }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <Bell size={20} color="white" />
          </span>
          Announcements
        </h1>
        {canManageAnnouncements && (
          <button className="btn btn-warning" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={16} /> New Announcement
          </button>
        )}
      </div>
      
      <div className="filters-row">
        <div className="search-box">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search announcements..."
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
          {ANNOUNCEMENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>
      
      {loading ? (
        <div className="empty-state">Loading announcements...</div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p>No announcements found</p>
        </div>
      ) : (
        <div className="announcements-grid">
          {filteredAnnouncements.map(ann => {
            const typeInfo = getTypeInfo(ann.announcement_type);
            return (
              <div key={ann.id} className={`announcement-card ${ann.priority}`}>
                <div className="announcement-header">
                  <div>
                    <span 
                      className="announcement-type-badge"
                      style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}
                    >
                      {typeInfo.label}
                    </span>
                    <span className={`announcement-priority priority-${ann.priority}`}>
                      {ann.priority}
                    </span>
                  </div>
                  {ann.announcement_type === 'urgent' && (
                    <AlertTriangle size={20} color="#ef4444" />
                  )}
                </div>
                
                <div className="announcement-body">
                  <div className="announcement-title">{ann.title}</div>
                  <div className="announcement-content">{ann.content}</div>
                </div>
                
                <div className="announcement-footer">
                  <div className="announcement-meta">
                    <span><User size={12} /> {ann.created_by_name}</span>
                    <span><Calendar size={12} /> {new Date(ann.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="announcement-actions">
                    <button className="action-btn print" title="Print" onClick={() => handlePrint(ann)}>
                      <Printer size={14} />
                    </button>
                    {canManageAnnouncements && (
                      <>
                        <button className="action-btn edit" title="Edit" onClick={() => handleEdit(ann)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="action-btn delete" title="Delete" onClick={() => handleDeleteAnnouncement(ann.id)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingAnn ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                <X size={24} />
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
                <button type="submit" className="btn btn-warning">
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
