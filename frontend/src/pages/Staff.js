import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStaff, createStaff, updateStaff, deleteStaff, selectStaff, selectStaffLoading } from '../store/slices/staffSlice';
import { selectCurrentUser, updateCurrentUser } from '../store/slices/authSlice';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, X, Users, Eye, UserX, Camera, Upload } from 'lucide-react';
import { apiClient } from '../services/authService';
import ChainToggle from '../components/ChainToggle';

// Role hierarchy for staff registration
// Principal: Can register academic, teacher, secretary, section_leader (for their own chain ONLY)
// Directors/Coordinators: NO ACCESS to Staff page anymore
const ROLES_CAN_REGISTER_STAFF = {
  'principal': ['academic', 'teacher', 'secretary', 'section_leader'],
};

// Only Principals can manage staff (and only their own chain, NOT IHEZA)
const ROLES_CAN_MANAGE_STAFF = ['principal'];

const allRoles = [
  { value: 'director', label: 'Director', allowedBy: [] },
  { value: 'coordinator', label: 'Coordinator', allowedBy: [] },
  { value: 'principal', label: 'Principal', allowedBy: ['director', 'coordinator'] },
  { value: 'academic', label: 'Academic', allowedBy: ['principal'] },
  { value: 'teacher', label: 'Teacher', allowedBy: ['principal'] },
  { value: 'secretary', label: 'Secretary', allowedBy: ['principal'] },
  { value: 'section_leader', label: 'Section Leader', allowedBy: ['principal'] },
];

function Staff() {
  const dispatch = useDispatch();
  const staff = useSelector(selectStaff);
  const loading = useSelector(selectStaffLoading);
  const currentUser = useSelector(selectCurrentUser);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
    const [selectedChain, setSelectedChain] = useState('');
  
  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    role: '',
    department: '',
    email: '',
    phone: '',
    password: '',
  });

  // Role-based permissions
  const userRole = currentUser?.role?.toLowerCase();
  const canRegisterStaff = ROLES_CAN_REGISTER_STAFF[userRole] && ROLES_CAN_REGISTER_STAFF[userRole].length > 0;
  const canManageStaff = ROLES_CAN_MANAGE_STAFF.includes(userRole);
  
  // Get available roles for the current user to register
  const availableRoles = allRoles.filter(r => r.allowedBy.includes(userRole));
  
  // For editing: include the staff's current role even if not in availableRoles
  const getEditRoles = (currentStaffRole) => {
    const roles = [...availableRoles];
    const normalizedRole = (currentStaffRole || '').toLowerCase();
    const existingRole = allRoles.find(r => r.value === normalizedRole);
    if (existingRole && !roles.find(r => r.value === existingRole.value)) {
      roles.unshift(existingRole);
    }
    return roles;
  };
  
  // Display roles for filter (all roles)
  const displayRoles = allRoles.map(r => r.label);

  useEffect(() => {
    dispatch(fetchStaff({ chain: selectedChain || undefined }));
  }, [dispatch, selectedChain]);

  const resetForm = () => {
    setFormData({
      employee_id: '',
      name: '',
      role: '',
      department: '',
      email: '',
      phone: '',
      password: '',
    });
    setEditingStaff(null);
  };

  const handleEdit = (member) => {
    setEditingStaff(member);
    // Normalize role to lowercase for matching with dropdown options
    const normalizedRole = (member.role || '').toLowerCase();
    setFormData({
      employee_id: member.employee_id || '',
      name: member.name || '',
      role: normalizedRole,
      department: member.department || '',
      email: member.email || '',
      phone: member.phone || '',
      password: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        const updates = { ...formData };
        if (!updates.password) delete updates.password;
        await dispatch(updateStaff({ id: editingStaff.id, updates })).unwrap();
        
        // If updating the currently logged-in user, also update the auth state
        if (editingStaff.id === currentUser?.id || editingStaff.access_code === currentUser?.accessCode) {
          dispatch(updateCurrentUser({
            name: updates.name,
            first_name: updates.name?.split(' ')[0],
            lastName: updates.name?.split(' ').slice(1).join(' '),
            email: updates.email,
            phone: updates.phone,
          }));
        }
        
        toast.success('Staff member updated successfully');
      } else {
        await dispatch(createStaff(formData)).unwrap();
        toast.success('Staff member added successfully');
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      toast.error(error || `Failed to ${editingStaff ? 'update' : 'add'} staff member`);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await dispatch(deleteStaff(id)).unwrap();
        toast.success('Staff member deleted');
      } catch (error) {
        toast.error('Failed to delete staff member');
      }
    }
  };
  
  const handleSuspend = async (member) => {
    const newStatus = member.status === 'suspended' ? 'active' : 'suspended';
    const action = newStatus === 'suspended' ? 'suspend' : 'reactivate';
    
    if (window.confirm(`Are you sure you want to ${action} ${member.name}?`)) {
      try {
        await dispatch(updateStaff({ 
          id: member.id, 
          updates: { status: newStatus }
        })).unwrap();
        toast.success(`Staff member ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}`);
      } catch (error) {
        toast.error(`Failed to ${action} staff member`);
      }
    }
  };
  
  const handleProfilePicUpload = async (member, event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('staff_id', member.id);
      
      const response = await apiClient.post('/staff/upload-profile-pic', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        toast.success('Profile picture uploaded successfully');
        dispatch(fetchStaff({ chain: selectedChain || undefined })); // Refresh staff list
        
        // If updating the currently logged-in user's photo, also update auth state
        if (member.id === currentUser?.id || member.access_code === currentUser?.accessCode) {
          dispatch(updateCurrentUser({
            photo_url: response.data.photo_url,
            profile_pic: response.data.photo_url,
          }));
        }
      }
    } catch (error) {
      toast.error('Failed to upload profile picture');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Principal can only manage staff from their own chain (NOT IHEZA chain)
  const userChain = currentUser?.chain;
  const canEditMember = (member) => {
    // Check if member belongs to IHEZA chain - Principals CANNOT edit IHEZA staff
    const memberChain = member.access_code?.split('/')[0] || member.chain;
    if (memberChain === 'IHEZA') return false;
    // Principals can only edit staff from their own chain
    if (userRole === 'principal' && memberChain !== userChain) return false;
    return canManageStaff;
  };

  const filteredStaff = staff.filter(member => {
    const matchesSearch = 
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.access_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || member.role === roleFilter;
    // Principals only see staff from their own chain
    const memberChain = member.access_code?.split('/')[0] || member.chain;
    const matchesChain = userChain === 'IHEZA' || memberChain === userChain;
    return matchesSearch && matchesRole && matchesChain;
  });

  const getRoleColor = (role) => {
    const colors = {
      'Teacher': '#f59e0b',
      'Coordinator': '#8b5cf6',
      'Principal': '#10b981',
      'Secretary': '#ef4444',
      'Academic': '#3b82f6',
      'Section Leader': '#ec4899',
      'Administrator': '#0f4c81',
    };
    return colors[role] || '#64748b';
  };

  return (
    <div className="staff-page">
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
        dispatch(fetchStaff({ chain: chain || undefined }));
      }} />
      <style>{`
        .staff-page {
          padding: 1.5rem;
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
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .filters-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        
        .search-box {
          flex: 1;
          min-width: 240px;
          position: relative;
        }
        
        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }
        
        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.75rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.75rem;
          color: #f8fafc;
          font-size: 0.95rem;
        }
        
        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
        }
        
        .filter-select {
          padding: 0.75rem 1rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.75rem;
          color: #f8fafc;
          min-width: 160px;
        }
        
        .staff-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.25rem;
        }
        
        .staff-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }
        
        .staff-card:hover {
          border-color: #3b82f6;
          transform: translateY(-2px);
        }
        
        .staff-card-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .staff-avatar {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.25rem;
          color: white;
        }
        
        .staff-info {
          flex: 1;
        }
        
        .staff-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 0.25rem;
        }
        
        .staff-id {
          font-size: 0.8rem;
          color: #64748b;
        }
        
        .staff-role-badge {
          display: inline-flex;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 0.5rem;
        }
        
        .staff-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 1rem;
        }
        
        .staff-detail {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .staff-actions {
          display: flex;
          gap: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .action-btn {
          flex: 1;
          padding: 0.5rem;
          background: rgba(51, 65, 85, 0.5);
          border: none;
          border-radius: 0.5rem;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.8rem;
        }
        
        .action-btn:hover {
          background: rgba(51, 65, 85, 0.8);
          color: #f8fafc;
        }
        
        .action-btn.edit:hover {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }
        
        .action-btn.delete:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        
        .action-btn.upload {
          border-color: rgba(59, 130, 246, 0.5);
          color: #3b82f6;
          cursor: pointer;
        }
        
        .action-btn.upload:hover {
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
        }
        
        .action-btn.suspend {
          border-color: rgba(245, 158, 11, 0.5);
          color: #f59e0b;
        }
        
        .action-btn.suspend:hover {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }
        
        .action-btn.reactivate {
          border-color: rgba(16, 185, 129, 0.5);
          color: #10b981;
        }
        
        .action-btn.reactivate:hover {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }
        
        .staff-status-badge {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          margin-left: 0.5rem;
        }
        
        .staff-status-badge.active {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }
        
        .staff-status-badge.suspended {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        
        .profile-pic {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          object-fit: cover;
        }
        
        .modal-overlay {
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
        
        .modal {
          background: #1e293b;
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f8fafc;
        }
        
        .modal-close {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0.5rem;
        }
        
        .modal-body {
          padding: 1.5rem;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }
        
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.95rem;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
        }
        
        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .modal-footer {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          padding: 1.5rem;
          border-top: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #64748b;
        }
        
        .stats-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .stat-chip {
          padding: 0.5rem 1rem;
          background: rgba(51, 65, 85, 0.5);
          border-radius: 9999px;
          font-size: 0.875rem;
          color: #94a3b8;
        }
        
        .stat-chip strong {
          color: #f8fafc;
        }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <Users size={20} color="white" />
          </span>
          Staff Management
        </h1>
        {canRegisterStaff && (
          <button 
            className="btn btn-primary"
            onClick={() => { resetForm(); setShowModal(true); }}
            data-testid="add-staff-btn"
          >
            <Plus size={18} />
            Add Staff
          </button>
        )}
      </div>
      
      <div className="stats-row">
        <div className="stat-chip">
          Total: <strong>{staff.length}</strong>
        </div>
        <div className="stat-chip">
          Filtered: <strong>{filteredStaff.length}</strong>
        </div>
      </div>
      
      <div className="filters-row">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or employee ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="staff-search"
          />
        </div>
        <select
          className="filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          data-testid="role-filter"
        >
          <option value="">All Roles</option>
          {displayRoles.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>
      
      {loading ? (
        <div className="empty-state">Loading staff...</div>
      ) : filteredStaff.length === 0 ? (
        <div className="empty-state">
          {staff.length === 0 
            ? (canRegisterStaff ? 'No staff members registered yet. Click "Add Staff" to get started.' : 'No staff members found.')
            : 'No staff members match your search criteria.'
          }
        </div>
      ) : (
        <div className="staff-grid" data-testid="staff-grid">
          {filteredStaff.map((member) => (
            <div key={member.id} className={`staff-card ${member.status === 'suspended' ? 'suspended' : ''}`}>
              <div className="staff-card-header">
                {member.profile_pic ? (
                  <img 
                    src={member.profile_pic} 
                    alt={member.name}
                    className="profile-pic"
                  />
                ) : (
                  <div 
                    className="staff-avatar"
                    style={{ background: getRoleColor(member.role) }}
                  >
                    {member.name?.charAt(0) || 'S'}
                  </div>
                )}
                <div className="staff-info">
                  <div className="staff-name">
                    {member.name}
                    <span className={`staff-status-badge ${member.status || 'active'}`}>
                      {member.status || 'Active'}
                    </span>
                  </div>
                  <div className="staff-id">{member.employee_id || member.access_code}</div>
                  <span 
                    className="staff-role-badge"
                    style={{ 
                      background: `${getRoleColor(member.role)}20`,
                      color: getRoleColor(member.role)
                    }}
                  >
                    {member.role}
                  </span>
                </div>
              </div>
              <div className="staff-details">
                {member.department && (
                  <div className="staff-detail">
                    Department: {member.department}
                  </div>
                )}
                {member.email && (
                  <div className="staff-detail">
                    {member.email}
                  </div>
                )}
                {member.phone && (
                  <div className="staff-detail">
                    {member.phone}
                  </div>
                )}
              </div>
              <div className="staff-actions">
                {canEditMember(member) ? (
                  <>
                    <button 
                      className="action-btn edit"
                      onClick={() => handleEdit(member)}
                      data-testid={`edit-staff-${member.id}`}
                      title="Edit staff details"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <label className="action-btn upload" title="Upload profile picture">
                      <Camera size={14} /> Photo
                      <input 
                        type="file" 
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleProfilePicUpload(member, e)}
                      />
                    </label>
                    <button 
                      className={`action-btn ${member.status === 'suspended' ? 'reactivate' : 'suspend'}`}
                      onClick={() => handleSuspend(member)}
                      data-testid={`suspend-staff-${member.id}`}
                      title={member.status === 'suspended' ? 'Reactivate staff' : 'Suspend staff'}
                    >
                      <UserX size={14} /> {member.status === 'suspended' ? 'Activate' : 'Suspend'}
                    </button>
                    <button 
                      className="action-btn delete"
                      onClick={() => handleDelete(member.id)}
                      data-testid={`delete-staff-${member.id}`}
                      title="Delete staff"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </>
                ) : (
                  <button className="action-btn" disabled style={{ opacity: 0.5 }}>
                    <Eye size={14} /> View Only
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Add/Edit Staff Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Employee ID *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.employee_id}
                      onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                      required
                      disabled={!!editingStaff}
                      data-testid="employee-id-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="staff-name-input"
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-input"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                    >
                      <option value="">Select Role</option>
                      {(editingStaff ? getEditRoles(editingStaff.role) : availableRoles).map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    {editingStaff ? 'New Password (leave blank to keep current)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingStaff}
                    placeholder={editingStaff ? 'Leave blank to keep current password' : 'Initial login password'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" data-testid="submit-staff-btn">
                  {editingStaff ? 'Update Staff' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Staff;
