import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { toast } from '../hooks/useSoundEnabledToast';
import GenerateChain from '../components/Principal/GenerateChain';
import { Edit, Link as LinkIcon, Save, X, Building, Globe, Trash2 } from 'lucide-react';

function GenerateChainPage() {
  const currentUser = useSelector(selectCurrentUser);
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingChain, setEditingChain] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    display_name: '',
    location: '',
    description: ''
  });

  // Load chains on component mount
  useEffect(() => {
    loadChains();
  }, []);

  const loadChains = async () => {
    try {
      setLoading(true);
      // Try to fetch chains from the database
      const response = await apiClient.get('/chains');
      setChains(response.data || []);
    } catch (error) {
      console.error('Failed to load chains:', error);
      // If endpoint doesn't exist or returns 404, use empty array
      // Don't show error toast for missing endpoint
      if (error.response?.status !== 404 && error.response?.status !== 403) {
        toast.error('Failed to load chains');
      }
      setChains([]); // Set empty array so UI doesn't break
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (chain) => {
    setEditingChain(chain.code);
    setEditForm({
      name: chain.name || '',
      display_name: chain.display_name || chain.name || '',
      location: chain.location || '',
      description: chain.description || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingChain(null);
    setEditForm({
      name: '',
      display_name: '',
      location: '',
      description: ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingChain) return;

    try {
      const response = await apiClient.put(`/users/chains/${editingChain}`, editForm);
      toast.success(response.data.message || 'Chain updated successfully');
      setEditingChain(null);
      loadChains(); // Refresh chains list
    } catch (error) {
      console.error('Failed to update chain:', error);
      toast.error(error.response?.data?.detail || 'Failed to update chain');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDeleteChain = async (chainCode) => {
    if (!window.confirm(`Are you sure you want to delete chain ${chainCode}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiClient.delete(`/chains/${chainCode}`);
      toast.success(response.data.message || 'Chain deleted successfully');
      loadChains(); // Refresh chains list
    } catch (error) {
      console.error('Failed to delete chain:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete chain');
    }
  };

  const generateChainLink = (chain) => {
    // Create a URL-friendly version of the chain name
    const urlFriendlyName = chain.display_name?.toLowerCase().replace(/\s+/g, '-') || 
                          chain.name?.toLowerCase().replace(/\s+/g, '-') || 
                          chain.code.toLowerCase();
    return `${window.location.origin}/chain/${urlFriendlyName}/${chain.code}`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Link copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy link');
    });
  };

  return (
    <div className="generate-chain-page">
      <style>{`
        .generate-chain-page {
          padding: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .page-header {
          margin-bottom: 2rem;
        }
        
        .page-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 0.5rem;
        }
        
        .page-header p {
          color: #94a3b8;
        }
        
        .sections-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-top: 2rem;
        }
        
        @media (max-width: 1024px) {
          .sections-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .section-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
        }
        
        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .chains-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .chain-item {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 0.75rem;
          padding: 1rem;
          border: 1px solid rgba(100, 116, 139, 0.3);
        }
        
        .chain-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        
        .chain-code {
          font-weight: 600;
          color: #f8fafc;
          font-size: 1rem;
        }
        
        .chain-name {
          color: #cbd5e1;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }
        
        .chain-location {
          color: #94a3b8;
          font-size: 0.75rem;
          margin-bottom: 0.5rem;
        }
        
        .chain-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }
        
        .action-button {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 0.75rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(100, 116, 139, 0.5);
          border-radius: 0.5rem;
          color: #cbd5e1;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .action-button:hover {
          background: rgba(51, 65, 85, 0.8);
          color: #f8fafc;
        }
        
        .edit-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1rem;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .form-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #cbd5e1;
        }
        
        .form-input {
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.3);
          border: 1px solid rgba(100, 116, 139, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
        }
        
        .form-textarea {
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.3);
          border: 1px solid rgba(100, 116, 139, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
          min-height: 80px;
          resize: vertical;
        }
        
        .form-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        
        .save-button {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #10b981, #34d399);
          border: none;
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .save-button:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        
        .cancel-button {
          padding: 0.75rem 1.5rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(100, 116, 139, 0.5);
          border-radius: 0.5rem;
          color: #cbd5e1;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .cancel-button:hover {
          background: rgba(51, 65, 85, 0.8);
          color: #f8fafc;
        }
        
        .chain-link {
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.3);
          border-radius: 0.5rem;
          border-left: 3px solid #3b82f6;
        }
        
        .link-label {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
        
        .link-value {
          font-size: 0.875rem;
          color: #cbd5e1;
          word-break: break-all;
          margin-bottom: 0.5rem;
        }
        
        .copy-link-button {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 0.75rem;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          color: #93c5fd;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .copy-link-button:hover {
          background: rgba(59, 130, 246, 0.3);
          color: #bfdbfe;
        }
        
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #64748b;
        }
        
        .loading-state {
          text-align: center;
          padding: 2rem;
          color: #94a3b8;
        }
      `}</style>
      
      <div className="page-header">
        <h1>Chain Management</h1>
        <p>Create, edit, and manage school chains in the IHEZA system</p>
      </div>
      
      <div className="sections-grid">
        {/* Left Column: Existing Chains */}
        <div className="section-card">
          <h3 className="section-title">
            <Building size={20} />
            Existing Chains
          </h3>
          
          {loading ? (
            <div className="loading-state">Loading chains...</div>
          ) : chains.length === 0 ? (
            <div className="empty-state">
              <p>No chains found. Create your first chain using the form on the right.</p>
            </div>
          ) : (
            <div className="chains-list">
              {chains.map((chain) => (
                <div key={chain.code} className="chain-item">
                  <div className="chain-header">
                    <div className="chain-code">{chain.code}</div>
                    {editingChain !== chain.code && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="action-button"
                          onClick={() => handleEditClick(chain)}
                        >
                          <Edit size={14} />
                          Edit
                        </button>
                        <button 
                          className="action-button"
                          onClick={() => handleDeleteChain(chain.code)}
                          style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="chain-name">{chain.name}</div>
                  <div className="chain-location">{chain.location}</div>
                  
                  {chain.description && (
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                      {chain.description}
                    </div>
                  )}
                  
                  {/* Chain Link Section */}
                  <div className="chain-link">
                    <div className="link-label">Chain Landing Page Link:</div>
                    <div className="link-value">{generateChainLink(chain)}</div>
                    <button 
                      className="copy-link-button"
                      onClick={() => copyToClipboard(generateChainLink(chain))}
                    >
                      <LinkIcon size={14} />
                      Copy Link
                    </button>
                  </div>
                  
                  {/* Edit Form (when editing this chain) */}
                  {editingChain === chain.code && (
                    <div className="edit-form">
                      <div className="form-group">
                        <label className="form-label">Chain Name *</label>
                        <input
                          type="text"
                          name="name"
                          value={editForm.name}
                          onChange={handleInputChange}
                          className="form-input"
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Display Name (for landing page)</label>
                        <input
                          type="text"
                          name="display_name"
                          value={editForm.display_name}
                          onChange={handleInputChange}
                          className="form-input"
                          placeholder="Name to show on landing page header"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Location *</label>
                        <input
                          type="text"
                          name="location"
                          value={editForm.location}
                          onChange={handleInputChange}
                          className="form-input"
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                          name="description"
                          value={editForm.description}
                          onChange={handleInputChange}
                          className="form-textarea"
                          placeholder="Optional description"
                        />
                      </div>
                      
                      <div className="form-actions">
                        <button className="save-button" onClick={handleSaveEdit}>
                          <Save size={16} />
                          Save Changes
                        </button>
                        <button className="cancel-button" onClick={handleCancelEdit}>
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Right Column: Create New Chain */}
        <div className="section-card">
          <h3 className="section-title">
            <Globe size={20} />
            Create New Chain
          </h3>
          <GenerateChain onChainCreated={loadChains} />
        </div>
      </div>
    </div>
  );
}

export default GenerateChainPage;
