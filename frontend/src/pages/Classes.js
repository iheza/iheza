import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { studentService } from '../services/studentService';
import { toast } from '../hooks/useSoundEnabledToast';
import { Plus, Edit2, Trash2, X, BookOpen, Users, UserCheck } from 'lucide-react';
import { apiClient } from '../services/authService';
import ChainToggle from '../components/ChainToggle';

function Classes() {
  const currentUser = useSelector(selectCurrentUser);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [selectedChain, setSelectedChain] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    section: '',
    capacity: 40,
    class_teacher_id: '',
    chain: currentUser?.chain || 'DLP',
  });

  const userRole = currentUser?.role?.toLowerCase();
  // ONLY Principal and Secretary can Add/Edit/Delete classes
  const canManageClasses = ['principal', 'secretary'].includes(userRole);

  useEffect(() => {
    loadData(selectedChain);
  }, [selectedChain]);
  
  const loadData = async (chain) => {
    try {
      setLoading(true);
      const params = chain ? { chain } : {};
      const [classesData, studentsData] = await Promise.all([
        dataService.getClasses(chain),
        studentService.getStudents(null, chain)  // Pass chain filter
      ]);
      setClasses(classesData);
      setStudents(studentsData);
      
      // Load staff (teachers) for class teacher assignment
      try {
        const response = await apiClient.get('/staff', { params });
        setStaff(response.data.filter(s => s.role?.toLowerCase() === 'teacher'));
      } catch (e) {
        console.log('Staff load failed');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      level: '',
      section: '',
      capacity: 40,
      class_teacher_id: '',
      chain: currentUser?.chain || 'DLP',
    });
    setEditingClass(null);
  };

  const handleEdit = (cls) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name || '',
      level: cls.level || '',
      section: cls.section || '',
      capacity: cls.capacity || 40,
      class_teacher_id: cls.class_teacher_id || '',
      chain: cls.chain || currentUser?.chain || 'DLP' // Include chain field
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Add chain field from current user
      const classData = {
        ...formData,
        chain: currentUser?.chain || 'DLP' // Default to DLP if chain not found
      };
      
      if (editingClass) {
        await dataService.updateClass(editingClass.id, classData);
        toast.success('Class updated successfully');
      } else {
        await dataService.createClass(classData);
        toast.success('Class created successfully');
      }
      setShowModal(false);
      resetForm();
      loadData(selectedChain);
    } catch (error) {
      toast.error(editingClass ? 'Failed to update class' : 'Failed to create class');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this class?')) {
      try {
        await dataService.deleteClass(id);
        toast.success('Class deleted');
        loadData(selectedChain);
      } catch (error) {
        toast.error('Failed to delete class');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Calculate class stats
  const getClassStats = (className) => {
    const classStudents = students.filter(s => s.class_name === className);
    const males = classStudents.filter(s => ['m', 'male'].includes(s.gender?.toLowerCase())).length;
    const females = classStudents.filter(s => ['f', 'female'].includes(s.gender?.toLowerCase())).length;
    return { total: classStudents.length, males, females };
  };

  // Get teacher name by ID
  const getTeacherName = (teacherId) => {
    const teacher = staff.find(s => s.id === teacherId);
    return teacher ? teacher.name : 'Not Assigned';
  };

  return (
    <div className="classes-page">
      <style>{`
        .classes-page {
          padding: 1.5rem;
        }
        
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
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
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }
        
        .btn-secondary {
          background: rgba(51, 65, 85, 0.5);
          color: #f8fafc;
          border: 1px solid rgba(71, 85, 105, 0.5);
        }
        
        .btn-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        
        .classes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        
        .class-card {
          background: #dbeafe;
          border: 1px solid #bfdbfe;
          border-radius: 1rem;
          padding: 1.5rem;
          transition: all 0.2s;
        }
        
        .class-card:hover {
          border-color: #93c5fd;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.15);
        }
        
        .class-name {
          font-size: 1.25rem;
          font-weight: 700;
          color: #000000;
          margin-bottom: 0.5rem;
        }
        
        .class-teacher {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #dc2626;
          margin-bottom: 1rem;
          padding: 0.5rem 0.75rem;
          background: rgba(220, 38, 38, 0.1);
          border-radius: 0.5rem;
          font-weight: 600;
        }
        
        .class-info {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .info-label {
          font-size: 0.75rem;
          color: #dc2626;
          text-transform: uppercase;
          font-weight: 600;
        }
        
        .info-value {
          font-size: 0.875rem;
          color: #000000;
          font-weight: 600;
        }
        
        .gender-stats {
          display: flex;
          gap: 1rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .gender-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }
        
        .gender-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .gender-icon.male {
          background: rgba(59, 130, 246, 0.2);
          color: #2563eb;
        }
        
        .gender-icon.female {
          background: rgba(220, 38, 38, 0.2);
          color: #dc2626;
        }
        
        .gender-count {
          font-size: 1.125rem;
          font-weight: 700;
          color: #000000;
        }
        
        .gender-label {
          font-size: 0.75rem;
          color: #dc2626;
          font-weight: 600;
        }
        
        .class-actions {
          display: flex;
          gap: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid #bfdbfe;
        }
        
        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: transparent;
          border: 1px solid #93c5fd;
          border-radius: 0.5rem;
          color: #000000;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .action-btn:hover {
          background: rgba(37, 99, 235, 0.1);
          border-color: #2563eb;
          color: #2563eb;
        }
        
        .action-btn.delete:hover {
          background: rgba(220, 38, 38, 0.1);
          border-color: #dc2626;
          color: #dc2626;
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
          border-color: #8b5cf6;
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
        
        .total-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          background: rgba(220, 38, 38, 0.15);
          border-radius: 9999px;
          font-size: 0.875rem;
          color: #dc2626;
          font-weight: 600;
        }

        /* ---------- STATS COMPACT (ONE LINE) ---------- */
        .stats-compact {
          display: flex;
          align-items: center;
          gap: 0.3rem 1.2rem;
          flex-wrap: wrap;
          background: white;
          padding: 0.25rem 1rem;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          margin-bottom: 0.8rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .stats-compact .stat-item {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.1rem 0.2rem;
        }
        .stats-compact .stat-item .icon {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
        }
        .stats-compact .stat-item .icon.blue { background: #dbeafe; color: #2563eb; }
        .stats-compact .stat-item .icon.green { background: #d1fae5; color: #059669; }
        .stats-compact .stat-item .icon.purple { background: #ede9fe; color: #7c3aed; }
        .stats-compact .stat-item .icon.orange { background: #fef3c7; color: #d97706; }
        .stats-compact .stat-item .icon.red { background: #fee2e2; color: #dc2626; }
        .stats-compact .stat-item .num {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }
        .stats-compact .stat-item .label {
          font-size: 0.6rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 500;
        }
        .stats-compact .divider {
          color: #e2e8f0;
          font-size: 0.8rem;
        }
        /* ---------- EXCEL TABLE ---------- */
        .excel-container {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid #d0d7e2;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .excel-table {
          width: 100%;
          border-collapse: collapse;
          font-family: inherit;
          font-size: 0.82rem;
          min-width: 1000px;
        }
        .excel-table thead th {
          background: #e8edf4;
          color: #1f3b5c;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.65rem;
          letter-spacing: 0.4px;
          padding: 0.5rem 0.7rem;
          border-right: 1px solid #d0d7e2;
          border-bottom: 2px solid #b8c6d8;
          text-align: left;
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .excel-table thead th:last-child {
          border-right: none;
        }
        .excel-table tbody td {
          padding: 0.4rem 0.7rem;
          border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
          color: #1e2f3f;
          background: white;
        }
        .excel-table tbody td:last-child {
          border-right: none;
        }
        .excel-table tbody tr:nth-child(even) td {
          background: #f8faff;
        }
        .excel-table tbody tr:hover td {
          background: #e8f0fe;
        }
        .excel-table .col-id { width: 35px; text-align: center; }
        .excel-table .col-name { min-width: 150px; }
        .excel-table .col-teacher { min-width: 160px; }
        .excel-table .col-boys { width: 70px; text-align: center; }
        .excel-table .col-girls { width: 70px; text-align: center; }
        .excel-table .col-total { width: 90px; text-align: center; }
        .excel-table .col-level { width: 90px; }
        .excel-table .col-capacity { width: 100px; }
        .excel-table .col-actions { width: 140px; }
        .class-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .class-cell .icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          flex-shrink: 0;
          background: #ede9fe;
          color: #7c3aed;
        }
        .class-cell .info .name {
          font-weight: 600;
          color: #0f172a;
          font-size: 0.85rem;
        }
        .class-cell .info .meta {
          font-size: 0.6rem;
          color: #94a3b8;
        }
        .teacher-cell {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: #1e2f3f;
        }
        .teacher-cell .teacher-icon {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #dbeafe;
          color: #2563eb;
          flex-shrink: 0;
        }
        .teacher-cell.not-assigned {
          color: #dc2626;
        }
        .teacher-cell.not-assigned .teacher-icon {
          background: #fee2e2;
          color: #dc2626;
        }
        .count-cell {
          font-weight: 700;
          font-size: 0.9rem;
          color: #0f172a;
          text-align: center;
        }
        .count-cell.boys { color: #2563eb; }
        .count-cell.girls { color: #dc2626; }
        .capacity-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0.1rem 0.5rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .capacity-badge.ok { background: #d1fae5; color: #059669; }
        .capacity-badge.warn { background: #fef3c7; color: #d97706; }
        .capacity-badge.full { background: #fee2e2; color: #dc2626; }
        .level-badge {
          display: inline-block;
          padding: 0.05rem 0.4rem;
          border-radius: 20px;
          font-size: 0.6rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .level-badge.primary { background: #dbeafe; color: #2563eb; }
        .level-badge.nursery { background: #fce7f3; color: #db2777; }
        .level-badge.secondary { background: #ede9fe; color: #7c3aed; }
        .level-badge.high { background: #fef3c7; color: #d97706; }
        .action-group {
          display: flex;
          gap: 0.2rem;
          flex-wrap: wrap;
        }
        .action-group .act-btn {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 0.1rem 0.35rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          color: #64748b;
          font-size: 0.6rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .action-group .act-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .action-group .act-btn.edit:hover {
          background: #dbeafe;
          color: #2563eb;
          border-color: #bfdbfe;
        }
        .action-group .act-btn.delete:hover {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fca5a5;
        }
        @media (max-width: 768px) {
          .stats-compact { gap: 0.2rem 0.6rem; padding: 0.2rem 0.6rem; }
          .stats-compact .stat-item .num { font-size: 0.9rem; }
          .stats-compact .stat-item .label { font-size: 0.5rem; }
          .stats-compact .stat-item .icon { width: 22px; height: 22px; font-size: 0.6rem; }
          .excel-table { min-width: 850px; font-size: 0.75rem; }
          .excel-table thead th,
          .excel-table tbody td { padding: 0.3rem 0.4rem; }
          .action-group .act-btn { font-size: 0.5rem; padding: 0.1rem 0.25rem; }
        }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <BookOpen size={20} color="white" />
          </span>
          Class Management
        </h1>
        {canManageClasses && (
          <button 
            className="btn btn-primary"
            onClick={() => { resetForm(); setShowModal(true); }}
            data-testid="add-class-btn"
          >
            <Plus size={18} />
            Add Class
          </button>
        )}
      </div>

      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
      }} />

      {/* Stats Compact Bar */}
      <div className="stats-compact">
        <span className="stat-item">
          <span className="icon purple"><BookOpen size={14} /></span>
          <span className="num">{classes.length}</span>
          <span className="label">Classes</span>
        </span>
        <span className="divider">|</span>
        <span className="stat-item">
          <span className="icon blue"><Users size={14} /></span>
          <span className="num">{students.length}</span>
          <span className="label">Students</span>
        </span>
        <span className="divider">|</span>
        <span className="stat-item">
          <span className="icon green"><UserCheck size={14} /></span>
          <span className="num">{classes.filter(c => c.class_teacher_id).length}</span>
          <span className="label">Assigned Teachers</span>
        </span>
        <span className="divider">|</span>
        <span className="stat-item">
          <span className="icon orange"><Users size={14} /></span>
          <span className="num">{classes.reduce((sum, c) => sum + (c.capacity || 40), 0)}</span>
          <span className="label">Total Capacity</span>
        </span>
      </div>
      
      {loading ? (
        <div className="empty-state">Loading classes...</div>
      ) : classes.length === 0 ? (
        <div className="empty-state">
          No classes created yet. Click "Add Class" to get started.
        </div>
      ) : (
        <div className="excel-container" data-testid="classes-grid">
          <table className="excel-table">
            <thead>
              <tr>
                <th className="col-id">#</th>
                <th className="col-name">Class</th>
                <th className="col-teacher">Class Teacher</th>
                <th className="col-boys">Boys</th>
                <th className="col-girls">Girls</th>
                <th className="col-total">Total / Capacity</th>
                <th className="col-level">Level</th>
                <th className="col-capacity">Capacity</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls, idx) => {
                const stats = getClassStats(cls.name);
                const teacherName = getTeacherName(cls.class_teacher_id);
                const isAssigned = teacherName !== 'Not Assigned';
                const capacity = cls.capacity || 40;
                const capacityPct = Math.round((stats.total / capacity) * 100);
                const capacityCls = capacityPct >= 100 ? 'full' : capacityPct >= 80 ? 'warn' : 'ok';
                const level = (cls.level || 'primary').toLowerCase();
                return (
                  <tr key={`${cls.id ?? 'none'}-${idx}`}>

                    <td className="col-id">{idx + 1}</td>
                    <td className="col-name">
                      <div className="class-cell">
                        <div className="icon">
                          <BookOpen size={16} />
                        </div>
                        <div className="info">
                          <div className="name">{cls.name}</div>
                          <div className="meta">
                            {cls.section ? `Section ${cls.section}` : 'No section'}
                            {cls.chain && ` · ${cls.chain}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={`teacher-cell ${isAssigned ? '' : 'not-assigned'}`}>
                        <span className="teacher-icon">
                          <UserCheck size={12} />
                        </span>
                        <span>{teacherName}</span>
                      </div>
                    </td>
                    <td><span className="count-cell boys">{stats.males}</span></td>
                    <td><span className="count-cell girls">{stats.females}</span></td>
                    <td>
                      <span className={`capacity-badge ${capacityCls}`}>
                        <Users size={12} />
                        {stats.total} / {capacity}
                      </span>
                    </td>
                    <td>
                      <span className={`level-badge ${level}`}>
                        {cls.level || 'Primary'}
                      </span>
                    </td>
                    <td>{capacity} students</td>
                    <td className="col-actions">
                      {canManageClasses && (
                        <div className="action-group">
                          <button 
                            className="act-btn edit"
                            onClick={() => handleEdit(cls)}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button 
                            className="act-btn delete"
                            onClick={() => handleDelete(cls.id)}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingClass ? 'Edit Class' : 'Create New Class'}
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Class Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., GRADE 4A"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Level *</label>
                    <select
                      className="form-input"
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                      required
                    >
                      <option value="">Select Level</option>
                      <option value="nursery">Nursery</option>
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="high">High School</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Section</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      placeholder="e.g., A, B, C"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacity *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 40 })}
                      min="1"
                      max="100"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Class Teacher</label>
                  <select
                    className="form-input"
                    value={formData.class_teacher_id}
                    onChange={(e) => setFormData({ ...formData, class_teacher_id: e.target.value })}
                  >
                    <option value="">Select Class Teacher</option>
                    {staff.map((teacher, idx) => (
                      <option key={`${teacher.id ?? 'none'}-${idx}`} value={teacher.id}>
                        {teacher.name} ({teacher.access_code || teacher.employee_id})
                      </option>
                    ))}

                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  {editingClass ? 'Update Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Classes;
