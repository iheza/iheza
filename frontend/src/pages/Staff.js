import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStaff, createStaff, updateStaff, deleteStaff, selectStaff, selectStaffLoading } from '../store/slices/staffSlice';
import { selectCurrentUser, updateCurrentUser } from '../store/slices/authSlice';
import { toast } from '../hooks/useSoundEnabledToast';
import { Plus, Search, Edit2, Trash2, X, Users, Eye, UserX, Camera, Upload, RefreshCw, UserPlus, Mail, Phone, Building, IdCard, UserCheck, Clock, Filter } from 'lucide-react';

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
  const [statusFilter, setStatusFilter] = useState('');
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
    const matchesStatus = !statusFilter || (member.status || 'active') === statusFilter;
    // Principals only see staff from their own chain
    const memberChain = member.access_code?.split('/')[0] || member.chain;
    const matchesChain = userChain === 'IHEZA' || memberChain === userChain;
    return matchesSearch && matchesRole && matchesStatus && matchesChain;
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

  const getRoleIcon = (role) => {
    const icons = {
      'Teacher': '🎓',
      'Coordinator': '🛡️',
      'Principal': '👔',
      'Secretary': '✏️',
      'Academic': '📚',
      'Section Leader': '👥',
      'Administrator': '⚙️',
    };
    return icons[role] || '👤';
  };

  const activeCount = staff.filter(m => (m.status || 'active') === 'active').length;
  const suspendedCount = staff.filter(m => m.status === 'suspended').length;
  const departmentsCount = new Set(staff.map(m => m.department).filter(Boolean)).size;

  return (
    <div className="staff-page">
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
        dispatch(fetchStaff({ chain: chain || undefined }));
      }} />
      <style>{`
        .staff-page {
          background: #f1f5f9;
          font-family: 'Inter', -apple-system, sans-serif;
          padding: 1.5rem;
          display: flex;
          justify-content: center;
          min-height: 100vh;
        }
        .app-wrapper { max-width: 1400px; width: 100%; }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .page-title { display: flex; align-items: center; gap: 0.75rem; }
        .page-title .icon-wrap {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 1.1rem;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .page-title h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; }
        .page-title .sub { font-size: 0.8rem; color: #64748b; font-weight: 400; margin-left: 0.3rem; }
        .header-actions { display: flex; gap: 0.6rem; }

        .btn {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.5rem 1.1rem; border-radius: 10px;
          font-weight: 600; font-size: 0.8rem; border: none; cursor: pointer;
          transition: all 0.2s ease; font-family: 'Inter', sans-serif;
        }
        .btn-primary {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: white; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4); }
        .btn-outline { background: white; color: #475569; border: 1px solid #e2e8f0; }
        .btn-outline:hover { background: #f8fafc; border-color: #cbd5e1; }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 0.8rem; margin-bottom: 1.5rem;
        }
        .stat-box {
          background: white; border-radius: 10px; padding: 0.25rem 0.6rem;
          display: flex; align-items: center; gap: 0.5rem;
          border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: all 0.2s ease;
          min-height: 50px; max-height: 50px; height: 50px;
        }
        .stat-box:hover { border-color: #b3c7e6; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .stat-box .icon {
          width: 30px; height: 30px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; flex-shrink: 0;
        }
        .stat-box .icon.blue { background: #dbeafe; color: #2563eb; }
        .stat-box .icon.green { background: #d1fae5; color: #059669; }
        .stat-box .icon.orange { background: #fef3c7; color: #d97706; }
        .stat-box .icon.purple { background: #ede9fe; color: #7c3aed; }
        .stat-box .info .num { font-size: 1rem; font-weight: 700; color: #0f172a; line-height: 1.1; }
        .stat-box .info .label { font-size: 0.55rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }


        .filters-bar {
          display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem;
          background: white; padding: 0.5rem 1rem; border-radius: 12px;
          border: 1px solid #e2e8f0; margin-bottom: 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .filters-bar .search-wrap { flex: 1; min-width: 180px; position: relative; }
        .filters-bar .search-wrap input {
          width: 100%; padding: 0.4rem 0.6rem 0.4rem 2rem;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
          color: #0f172a; font-size: 0.8rem; font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
        }
        .filters-bar .search-wrap input:focus {
          outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .filters-bar .search-wrap .search-icon {
          position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%);
          color: #94a3b8; font-size: 0.75rem;
        }
        .filters-bar select {
          padding: 0.4rem 0.8rem; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 8px;
          color: #0f172a; font-size: 0.8rem; font-family: 'Inter', sans-serif; cursor: pointer;
        }
        .filters-bar select:focus { outline: none; border-color: #2563eb; }
        .filters-bar .filter-label { font-size: 0.7rem; color: #64748b; font-weight: 500; }
        .filters-bar .result-count { font-size: 0.75rem; color: #64748b; margin-left: auto; }

        .staff-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }
        .staff-card {
          background: white; border-radius: 16px; padding: 1.25rem;
          border: 1px solid #e2e8f0; transition: all 0.25s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04); position: relative;
        }
        .staff-card:hover {
          border-color: #b3c7e6; box-shadow: 0 8px 24px rgba(0,0,0,0.07);
          transform: translateY(-3px);
        }
        .staff-card.suspended { opacity: 0.6; background: #f8fafc; }
        .staff-card.suspended::after {
          content: 'SUSPENDED';
          position: absolute; top: 10px; right: -24px;
          background: #ef4444; color: white; font-size: 0.5rem; font-weight: 700;
          padding: 0.1rem 1.8rem; transform: rotate(45deg); letter-spacing: 0.5px;
        }
        .staff-card.active::after {
          content: 'ACTIVE';
          position: absolute; top: 10px; right: -24px;
          background: #059669; color: white; font-size: 0.5rem; font-weight: 700;
          padding: 0.1rem 1.8rem; transform: rotate(45deg); letter-spacing: 0.5px;
        }

        .card-top { display: flex; align-items: flex-start; gap: 0.8rem; margin-bottom: 0.8rem; }
        .card-avatar {
          width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 1.1rem; color: white; flex-shrink: 0; position: relative;
        }
        .card-avatar img { width: 100%; height: 100%; border-radius: 14px; object-fit: cover; }
        .card-avatar .status-dot {
          position: absolute; bottom: -2px; right: -2px;
          width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;
        }
        .card-avatar .status-dot.active { background: #22c55e; }
        .card-avatar .status-dot.suspended { background: #ef4444; }

        .card-user { flex: 1; min-width: 0; }
        .card-user .name {
          font-size: 1rem; font-weight: 700; color: #0f172a;
          display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
        }
        .card-user .name .status-badge {
          font-size: 0.55rem; font-weight: 600; padding: 0.1rem 0.4rem;
          border-radius: 20px; text-transform: uppercase; letter-spacing: 0.3px;
        }
        .card-user .name .status-badge.active { background: #d1fae5; color: #059669; }
        .card-user .name .status-badge.suspended { background: #fee2e2; color: #dc2626; }
        .card-user .employee-id { font-size: 0.7rem; color: #94a3b8; font-family: 'Inter', monospace; }
        .card-user .role-tag {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.15rem 0.6rem; border-radius: 20px;
          font-size: 0.65rem; font-weight: 600; margin-top: 0.3rem;
        }

        .card-details { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.8rem; }
        .card-details .detail {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.75rem; color: #64748b;
        }
        .card-details .detail .val { color: #0f172a; font-weight: 500; }

        .card-actions {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3rem;
          padding-top: 0.7rem; border-top: 1px solid #f1f5f9;
        }
        .card-actions .act-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.2rem;
          padding: 0.3rem 0.1rem; background: #f8fafc; border: none; border-radius: 8px;
          color: #64748b; font-size: 0.65rem; font-weight: 500; cursor: pointer;
          transition: all 0.2s ease; font-family: 'Inter', sans-serif;
        }
        .card-actions .act-btn:hover { background: #e2e8f0; color: #0f172a; }
        .card-actions .act-btn.edit:hover { background: #dbeafe; color: #2563eb; }
        .card-actions .act-btn.photo:hover { background: #ede9fe; color: #7c3aed; }
        .card-actions .act-btn.suspend:hover { background: #fef3c7; color: #d97706; }
        .card-actions .act-btn.delete:hover { background: #fee2e2; color: #dc2626; }
        .card-actions .act-btn.reactivate:hover { background: #d1fae5; color: #059669; }
        .card-actions .act-btn.view-only { opacity: 0.5; cursor: default; }
        .card-actions .act-btn.view-only:hover { background: #f8fafc; color: #64748b; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1rem;
        }
        .modal {
          background: white; border-radius: 20px; width: 100%; max-width: 500px;
          max-height: 90vh; overflow-y: auto; animation: modalIn 0.25s ease;
          box-shadow: 0 24px 48px rgba(0,0,0,0.2);
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(16px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0;
        }
        .modal-header h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; }
        .modal-close { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.3rem; border-radius: 8px; transition: background 0.2s ease; }
        .modal-close:hover { background: #f1f5f9; }
        .modal-body { padding: 1.5rem; }
        .modal-body .form-group { margin-bottom: 0.8rem; }
        .modal-body .form-group label {
          display: block; font-size: 0.7rem; font-weight: 600; color: #475569;
          text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 0.2rem;
        }
        .modal-body .form-group input,
        .modal-body .form-group select {
          width: 100%; padding: 0.5rem 0.8rem; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 10px; color: #0f172a;
          font-size: 0.85rem; font-family: 'Inter', sans-serif; transition: all 0.2s ease;
        }
        .modal-body .form-group input:focus,
        .modal-body .form-group select:focus {
          outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .modal-body .form-group input:disabled { opacity: 0.6; cursor: not-allowed; }
        .modal-body .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
        .modal-footer {
          display: flex; gap: 0.8rem; justify-content: flex-end;
          padding: 1.25rem 1.5rem; border-top: 1px solid #e2e8f0;
        }
        .btn-success {
          background: linear-gradient(135deg, #059669, #10b981);
          color: white; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
        }
        .btn-success:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4); }
        .btn-ghost { background: transparent; color: #475569; border: 1px solid #e2e8f0; }
        .btn-ghost:hover { background: #f8fafc; }

        .empty-state { text-align: center; padding: 3rem; color: #64748b; background: white; border-radius: 16px; border: 1px solid #e2e8f0; }
        .footer-note {
          margin-top: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.7rem;
          border-top: 1px solid #e2e8f0; padding-top: 1.2rem;
        }

        @media (max-width: 768px) {
          .staff-page { padding: 1rem; }
          .page-title h1 { font-size: 1.2rem; }
          .page-title .sub { display: none; }
          .filters-bar { flex-direction: column; align-items: stretch; }
          .filters-bar .search-wrap { min-width: unset; }
          .staff-grid { grid-template-columns: 1fr; }
          .modal-body .form-row { grid-template-columns: 1fr; }
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .card-actions { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .stats-row { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="app-wrapper">
        {/* HEADER */}
        <header className="page-header">
          <div className="page-title">
            <div className="icon-wrap"><Users size={20} /></div>
            <div>
              <h1>Staff <span className="sub">· Management</span></h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={() => dispatch(fetchStaff({ chain: selectedChain || undefined }))}>
              <RefreshCw size={14} /> Refresh
            </button>
            {canRegisterStaff && (
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }} data-testid="add-staff-btn">
                <Plus size={14} /> Add Staff
              </button>
            )}
          </div>
        </header>

        {/* STATS */}
        <div className="stats-row">
          <div className="stat-box">
            <div className="icon blue"><Users size={18} /></div>
            <div className="info"><div className="num">{staff.length}</div><div className="label">Total</div></div>
          </div>
          <div className="stat-box">
            <div className="icon green"><UserCheck size={18} /></div>
            <div className="info"><div className="num">{activeCount}</div><div className="label">Active</div></div>
          </div>
          <div className="stat-box">
            <div className="icon orange"><Clock size={18} /></div>
            <div className="info"><div className="num">{suspendedCount}</div><div className="label">Suspended</div></div>
          </div>

          <div className="stat-box">
            <div className="icon purple"><Building size={18} /></div>
            <div className="info"><div className="num">{departmentsCount}</div><div className="label">Departments</div></div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="filters-bar">
          <div className="search-wrap">
            <Search className="search-icon" size={14} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="staff-search"
            />
          </div>
          <span className="filter-label">Role</span>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} data-testid="role-filter">
            <option value="">All Roles</option>
            {displayRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <span className="filter-label">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <span className="result-count"><Filter size={12} /> {filteredStaff.length} results</span>
        </div>

        {/* STAFF GRID */}
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
            {filteredStaff.map((member) => {
              const status = member.status || 'active';
              const roleColor = getRoleColor(member.role);
              return (
                <div key={member.id} className={`staff-card ${status}`}>
                  <div className="card-top">
                    <div className="card-avatar" style={{ background: `linear-gradient(135deg, ${roleColor}, ${roleColor}cc)` }}>
                      {member.profile_pic ? (
                        <img src={member.profile_pic} alt={member.name} />
                      ) : (
                        member.name?.charAt(0) || 'S'
                      )}
                      <span className={`status-dot ${status}`}></span>
                    </div>
                    <div className="card-user">
                      <div className="name">
                        {member.name}
                        <span className={`status-badge ${status}`}>{status}</span>
                      </div>
                      <div className="employee-id"><IdCard size={11} /> {member.employee_id || member.access_code}</div>
                      <span className="role-tag" style={{ background: `${roleColor}20`, color: roleColor }}>
                        {getRoleIcon(member.role)} {member.role}
                      </span>
                    </div>
                  </div>
                  <div className="card-details">
                    {member.email && (
                      <div className="detail"><Mail size={12} /> <span className="val">{member.email}</span></div>
                    )}
                    {member.phone && (
                      <div className="detail"><Phone size={12} /> <span className="val">{member.phone}</span></div>
                    )}
                    {member.department && (
                      <div className="detail"><Building size={12} /> <span className="val">{member.department}</span></div>
                    )}
                  </div>
                  <div className="card-actions">
                    {canEditMember(member) ? (
                      <>
                        <button className="act-btn edit" onClick={() => handleEdit(member)} data-testid={`edit-staff-${member.id}`} title="Edit staff details">
                          <Edit2 size={12} /> Edit
                        </button>
                        <label className="act-btn photo" title="Upload profile picture">
                          <Camera size={12} /> Photo
                          <input 
                            type="file" 
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleProfilePicUpload(member, e)}
                          />
                        </label>
                        <button 
                          className={`act-btn ${status === 'suspended' ? 'reactivate' : 'suspend'}`}
                          onClick={() => handleSuspend(member)}
                          data-testid={`suspend-staff-${member.id}`}
                          title={status === 'suspended' ? 'Reactivate staff' : 'Suspend staff'}
                        >
                          <UserX size={12} /> {status === 'suspended' ? 'Activate' : 'Suspend'}
                        </button>
                        <button className="act-btn delete" onClick={() => handleDelete(member.id)} data-testid={`delete-staff-${member.id}`} title="Delete staff">
                          <Trash2 size={12} /> Delete
                        </button>
                      </>
                    ) : (
                      <button className="act-btn view-only" disabled>
                        <Eye size={12} /> View Only
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FOOTER */}
        <div className="footer-note">
          <Users size={12} /> IHEZA Staff Management · {filteredStaff.length} members displayed
        </div>
      </div>

      {/* Add/Edit Staff Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                <UserPlus size={18} style={{ color: '#2563eb', marginRight: 6, verticalAlign: 'middle' }} />
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Employee ID *</label>
                    <input
                      type="text"
                      value={formData.employee_id}
                      onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                      required
                      disabled={!!editingStaff}
                      data-testid="employee-id-input"
                      placeholder="EMP-001"
                    />
                  </div>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="staff-name-input"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Role *</label>
                    <select
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
                    <label>Department</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Science Dept."
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@iheza.edu"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+255 123 456 789"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>{editingStaff ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingStaff}
                    placeholder={editingStaff ? 'Leave blank to keep current password' : 'Initial login password'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" data-testid="submit-staff-btn">
                  <Upload size={14} /> {editingStaff ? 'Update Staff' : 'Add Staff'}
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

