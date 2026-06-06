import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { studentService } from '../services/studentService';
import { toast } from '../hooks/useSoundEnabledToast';
import { Plus, Edit2, Trash2, X, BookOpen, Users, UserCheck, Male, Female } from 'lucide-react';
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
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          transition: all 0.2s;
        }
        
        .class-card:hover {
          border-color: rgba(139, 92, 246, 0.5);
          transform: translateY(-2px);
        }
        
        .class-name {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 0.5rem;
        }
        
        .class-teacher {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #10b981;
          margin-bottom: 1rem;
          padding: 0.5rem 0.75rem;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 0.5rem;
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
          color: #64748b;
          text-transform: uppercase;
        }
        
        .info-value {
          font-size: 0.875rem;
          color: #f8fafc;
          font-weight: 500;
        }
        
        .gender-stats {
          display: flex;
          gap: 1rem;
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.3);
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
          color: #3b82f6;
        }
        
        .gender-icon.female {
          background: rgba(236, 72, 153, 0.2);
          color: #ec4899;
        }
        
        .gender-count {
          font-size: 1.125rem;
          font-weight: 700;
          color: #f8fafc;
        }
        
        .gender-label {
          font-size: 0.75rem;
          color: #64748b;
        }
        
        .class-actions {
          display: flex;
          gap: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: transparent;
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #94a3b8;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .action-btn:hover {
          background: rgba(139, 92, 246, 0.1);
          border-color: rgba(139, 92, 246, 0.5);
          color: #a78bfa;
        }
        
        .action-btn.delete:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.5);
          color: #ef4444;
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
          background: rgba(139, 92, 246, 0.2);
          border-radius: 9999px;
          font-size: 0.875rem;
          color: #a78bfa;
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
      
      {loading ? (
        <div className="empty-state">Loading classes...</div>
      ) : classes.length === 0 ? (
        <div className="empty-state">
          No classes created yet. Click "Add Class" to get started.
        </div>
      ) : (
        <div className="classes-grid" data-testid="classes-grid">
          {classes.map((cls) => {
            const stats = getClassStats(cls.name);
            return (
              <div key={cls.id} className="class-card">
                <div className="class-name">{cls.name}</div>
                
                <div className="class-teacher">
                  <UserCheck size={16} />
                  <span>Class Teacher: {getTeacherName(cls.class_teacher_id)}</span>
                </div>
                
                <div className="gender-stats">
                  <div className="gender-item">
                    <div className="gender-icon male">
                      <Users size={16} />
                    </div>
                    <div>
                      <div className="gender-count">{stats.males}</div>
                      <div className="gender-label">Boys</div>
                    </div>
                  </div>
                  <div className="gender-item">
                    <div className="gender-icon female">
                      <Users size={16} />
                    </div>
                    <div>
                      <div className="gender-count">{stats.females}</div>
                      <div className="gender-label">Girls</div>
                    </div>
                  </div>
                  <div className="total-badge">
                    <Users size={14} />
                    {stats.total} / {cls.capacity || 40}
                  </div>
                </div>
                
                <div className="class-info">
                  <div className="info-item">
                    <span className="info-label">Level</span>
                    <span className="info-value">{cls.level || 'Primary'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Capacity</span>
                    <span className="info-value">{cls.capacity || 40} students</span>
                  </div>
                </div>
                
                {canManageClasses && (
                  <div className="class-actions">
                    <button 
                      className="action-btn"
                      onClick={() => handleEdit(cls)}
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <button 
                      className="action-btn delete"
                      onClick={() => handleDelete(cls.id)}
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
                    {staff.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
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
