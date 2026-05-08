import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { fetchStudents, createStudent, updateStudent, deleteStudent, bulkUploadStudents, selectStudents, selectStudentsLoading } from '../store/slices/studentSlice';
import { selectCurrentUser } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, X, GraduationCap, Building, Upload, FileText, Users, BookOpen, Layers, Download } from 'lucide-react';
import ChainToggle from '../components/ChainToggle';


const SCHOOL_PREFIXES = ['DUP', 'DLP', 'LALE', 'OLGUN'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];

// Roles that can register students - ONLY Secretary and Principal
const ROLES_CAN_REGISTER_STUDENTS = ['principal', 'secretary'];
// Roles that can edit/delete students - ONLY Secretary and Principal
const ROLES_CAN_MANAGE_STUDENTS = ['principal', 'secretary'];

function Students() {
  const dispatch = useDispatch();
  const students = useSelector(selectStudents);
  const loading = useSelector(selectStudentsLoading);
  const currentUser = useSelector(selectCurrentUser);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [chainFilter, setChainFilter] = useState('');
  const [classes, setClasses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [bulkData, setBulkData] = useState({
    chain: '',
    class_name: '',
    students_text: '',
  });

  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const currentYear = new Date().getFullYear();

  
  const [formData, setFormData] = useState({
    chain: '',
    student_number: '',
    admission_year: currentYear,
    first_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    class_name: '',
    parent_name: '',
    parent_phone: '',
    password: '',
  });

  useEffect(() => {
    dispatch(fetchStudents({ chainFilter }));
    loadClasses();
    
    // Set default chain based on user's chain
    if (currentUser?.chain && currentUser.chain !== 'IHEZA') {
      setChainFilter(currentUser.chain);
      setFormData(prev => ({ ...prev, chain: currentUser.chain }));
    }
  }, [dispatch, currentUser]);

  // Reload students when chain filter changes
  useEffect(() => {
    dispatch(fetchStudents({ chainFilter }));
  }, [chainFilter, dispatch]);

  const loadClasses = async () => {
    try {
      const data = await dataService.getClasses(chainFilter);
      setClasses(data);
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  };

  const generateAdmissionNo = () => {
    const { chain, student_number, admission_year } = formData;
    if (chain && student_number) {
      return `${chain}/STU${student_number.padStart(4, '0')}/${admission_year}`;
    }
    return '';
  };

  const parseAdmissionNo = (admissionNo) => {
    const match = admissionNo?.match(/^([A-Z]+)\/STU(\d{4})\/(\d{4})$/);
    if (match) {
      return {
        chain: match[1],
        student_number: match[2],
        admission_year: parseInt(match[3])
      };
    }
    return null;
  };

  const resetForm = () => {
    const defaultChain = currentUser?.chain && currentUser.chain !== 'IHEZA' ? currentUser.chain : '';
    setFormData({
      chain: defaultChain,
      student_number: '',
      admission_year: currentYear,
      first_name: '',
      last_name: '',
      gender: '',
      date_of_birth: '',
      class_name: '',
      parent_name: '',
      parent_phone: '',
      password: '',
    });
    setEditingStudent(null);
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    const parsed = parseAdmissionNo(student.admission_no);
    setFormData({
      chain: parsed?.chain || student.chain || '',
      student_number: parsed?.student_number || '',
      admission_year: parsed?.admission_year || currentYear,
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      gender: student.gender || '',
      date_of_birth: student.date_of_birth || '',
      class_name: student.class_name || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      password: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate chain selection
    if (!formData.chain) {
      toast.error('Please select a school');
      return;
    }
    
    if (!formData.student_number && !editingStudent) {
      toast.error('Please enter a student number');
      return;
    }
    
    try {
      if (editingStudent) {
        const updates = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          gender: formData.gender,
          date_of_birth: formData.date_of_birth,
          class_name: formData.class_name,
          parent_name: formData.parent_name,
          parent_phone: formData.parent_phone,
        };
        if (formData.password) {
          updates.password = formData.password;
        }
        await dispatch(updateStudent({ id: editingStudent.id, updates })).unwrap();
        toast.success('Student updated successfully');
      } else {
        const admission_no = generateAdmissionNo();
        const studentData = {
          admission_no,
          first_name: formData.first_name,
          last_name: formData.last_name,
          gender: formData.gender,
          date_of_birth: formData.date_of_birth,
          class_name: formData.class_name,
          chain: formData.chain,
          parent_name: formData.parent_name,
          parent_phone: formData.parent_phone,
          password: formData.password,
        };
        await dispatch(createStudent(studentData)).unwrap();
        toast.success('Student registered successfully');
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      toast.error(error || `Failed to ${editingStudent ? 'update' : 'register'} student`);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await dispatch(deleteStudent(id)).unwrap();
        toast.success('Student deleted');
      } catch (error) {
        toast.error('Failed to delete student');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const canSelectChain = currentUser?.role === 'director' || currentUser?.role === 'coordinator';
  const userChain = currentUser?.chain;
  
  // Role-based permissions
  const canAddStudent = ROLES_CAN_REGISTER_STUDENTS.includes(currentUser?.role?.toLowerCase());
  const canManageStudents = ROLES_CAN_MANAGE_STUDENTS.includes(currentUser?.role?.toLowerCase());

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admission_no?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = !classFilter || student.class_name === classFilter;
    const matchesChain = !chainFilter || student.chain === chainFilter;
    return matchesSearch && matchesClass && matchesChain;
  });

  const filteredClasses = chainFilter 
    ? classes.filter(c => c.chain === chainFilter)
    : classes;

  // Download CSV template for bulk upload
  const handleDownloadCSVTemplate = () => {
    const chain = bulkData.chain || currentUser?.chain || 'CHAIN';
    const headers = 'student_no,first_name,last_name,gender,parent_name,parent_phone';
    const exampleRows = [
      `0001,AHMED,HASSAN,MALE,HASSAN OMAR,0777123456`,
      `0002,FATMA,ALI,FEMALE,ALI SALIM,0772654321`,
      `0003,OMAR,YUSUF,MALE,YUSUF IBRAHIM,0765987654`,
      `0004,AISHA,MOHAMED,FEMALE,MOHAMED JUMA,0778456123`,
      `0005,HAMZA,SALIM,MALE,SALIM RASHID,0771234567`,
    ];
    
    const csvContent = [headers, ...exampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chain}_students_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`Template downloaded! Fill it out and paste the data here.`);
  };

  // Handle CSV file upload
  const handleCSVFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      // Skip header row if present
      const lines = text.split('\n').filter(l => l.trim());
      const dataLines = lines[0]?.toLowerCase().includes('student_no') 
        ? lines.slice(1) 
        : lines;
      
      setBulkData(prev => ({
        ...prev,
        students_text: dataLines.join('\n')
      }));
      toast.success(`Loaded ${dataLines.length} rows from CSV`);
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const handleBulkUpload = async () => {
    if (!bulkData.chain) {
      toast.error('Please select a school/chain');
      return;
    }
    if (!bulkData.class_name) {
      toast.error('Please select a class');
      return;
    }
    if (!bulkData.students_text.trim()) {
      toast.error('Please enter student data');
      return;
    }

    setBulkUploading(true);
    setBulkResults(null);

    try {
      // Parse the students text - format per line:
      // student_no, first_name, last_name, gender, parent_name, parent_phone
      // OR full admission_no if it contains '/'
      const lines = bulkData.students_text.trim().split('\n').filter(l => l.trim());
      const studentsToUpload = lines.map((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        let admission_no = parts[0] || '';
        const first_name = parts[1] || '';
        const last_name = parts[2] || '';
        const gender = parts[3] || '';
        const parent_name = parts[4] || '';
        const parent_phone = parts[5] || '';

        // If admission_no doesn't contain '/', it's just the student number
        // Auto-construct the full admission number using selected chain
        if (!admission_no.includes('/')) {
          // Pad to 4 digits
          const paddedNum = admission_no.replace(/\D/g, '').padStart(4, '0');
          admission_no = `${bulkData.chain}/STU${paddedNum}/${currentYear}`;
        }

        return {
          admission_no,
          first_name,
          last_name,
          gender: gender.toUpperCase(),
          class_name: bulkData.class_name,
          chain: bulkData.chain,
          parent_name,
          parent_phone,
          password: `${bulkData.chain.toLowerCase()}${admission_no.replace(/\D/g, '').slice(-4)}`,
        };
      });

      const result = await dispatch(bulkUploadStudents(studentsToUpload)).unwrap();
      setBulkResults(result);
      const importedCount = result?.imported || result?.length || 0;
      toast.success(`Successfully uploaded ${importedCount} students`);
      dispatch(fetchStudents({ chainFilter }));
    } catch (error) {
      toast.error(error?.message || 'Failed to upload students');
      setBulkResults({ error: error?.message || 'Upload failed' });
    } finally {
      setBulkUploading(false);
    }
  };

  const handleCloseBulkModal = () => {
    setShowBulkModal(false);
    setBulkData({ chain: '', class_name: '', students_text: '' });
    setBulkResults(null);
  };

  const handleOpenBulkModal = () => {
    // Auto-set chain based on user's chain for non-director/coordinator roles
    const defaultChain = canSelectChain ? '' : (currentUser?.chain || '');
    setBulkData({ chain: defaultChain, class_name: '', students_text: '' });
    setBulkResults(null);
    setShowBulkModal(true);
  };

  return (

    <div className="students-page">
      <style>{`
        .students-page {
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
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
          border-color: #10b981;
        }
        
        .filter-select {
          padding: 0.75rem 1rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.75rem;
          color: #f8fafc;
          min-width: 160px;
        }
        
        .students-table-container {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          overflow: hidden;
        }
        
        .students-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .students-table th {
          background: rgba(51, 65, 85, 0.5);
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
        }
        
        .students-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
          color: #f8fafc;
        }
        
        .students-table tr:hover td {
          background: rgba(51, 65, 85, 0.3);
        }
        
        .students-table tr:last-child td {
          border-bottom: none;
        }
        
        .student-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .student-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
        }
        
        .student-name {
          font-weight: 600;
        }
        
        .student-code {
          font-size: 0.75rem;
          color: #64748b;
          font-family: monospace;
        }
        
        .class-badge {
          display: inline-flex;
          padding: 0.25rem 0.75rem;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .chain-badge {
          display: inline-flex;
          padding: 0.25rem 0.5rem;
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        
        .gender-badge {
          display: inline-flex;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .gender-badge.male {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }
        
        .gender-badge.female {
          background: rgba(236, 72, 153, 0.2);
          color: #f472b6;
        }
        
        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }
        
        .action-btn {
          padding: 0.5rem;
          background: rgba(51, 65, 85, 0.5);
          border: none;
          border-radius: 0.5rem;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s;
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
          max-width: 600px;
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
        
        .form-section {
          margin-bottom: 1.5rem;
        }
        
        .form-section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        
        .form-row-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
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
          border-color: #10b981;
        }
        
        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .admission-preview {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          margin-top: 0.5rem;
        }
        
        .admission-preview-label {
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 0.25rem;
        }
        
        .admission-preview-value {
          font-family: monospace;
          font-size: 1rem;
          color: #10b981;
          font-weight: 600;
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
          flex-wrap: wrap;
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
            <GraduationCap size={20} color="white" />
          </span>
          Student Management
        </h1>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {canAddStudent && (
            <>
              <button 
                className="btn btn-primary"
                onClick={() => { resetForm(); setShowModal(true); }}
                data-testid="add-student-btn"
              >
                <Plus size={18} />
                Add Student
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleOpenBulkModal}
                data-testid="bulk-upload-btn"
                style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)' }}
              >
                <Upload size={18} />
                Bulk Upload
              </button>
            </>
          )}
        </div>

      </div>

      {/* Chain toggle for Director/Coordinator */}
      <ChainToggle selectedChain={chainFilter} onChainChange={(chain) => {
        setChainFilter(chain);
        setClassFilter(''); // Reset class filter when chain changes
      }} />
      
      <div className="stats-row">
        <div className="stat-chip">
          Total: <strong>{students.length}</strong>
        </div>
        <div className="stat-chip">
          <span style={{ color: '#60a5fa' }}>Boys: <strong>{students.filter(s => ['m', 'male'].includes(s.gender?.toLowerCase())).length}</strong></span>
        </div>
        <div className="stat-chip">
          <span style={{ color: '#f472b6' }}>Girls: <strong>{students.filter(s => ['f', 'female'].includes(s.gender?.toLowerCase())).length}</strong></span>
        </div>
        <div className="stat-chip">
          Filtered: <strong>{filteredStudents.length}</strong>
        </div>
      </div>
      
      <div className="filters-row">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or admission number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="student-search"
          />
        </div>
        {canSelectChain && (
          <select
            className="filter-select"
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
            data-testid="chain-filter"
          >
            <option value="">All Schools</option>
            {SCHOOL_PREFIXES.map(prefix => (
              <option key={prefix} value={prefix}>{prefix}</option>
            ))}
          </select>
        )}
        <select
          className="filter-select"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          data-testid="class-filter"
        >
          <option value="">All Classes</option>
          {filteredClasses.map(cls => (
            <option key={cls.id} value={cls.name}>{cls.name}</option>
          ))}
        </select>
      </div>
      
      <div className="students-table-container">
        {loading ? (
          <div className="empty-state">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state">
            {students.length === 0 
              ? 'No students registered yet. Click "Add Student" to get started.'
              : 'No students match your search criteria.'
            }
          </div>
        ) : (
          <table className="students-table" data-testid="students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>School</th>
                <th>Class</th>
                <th>Gender</th>
                <th>Parent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="student-info">
                      <div className="student-avatar">
                        {student.first_name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <div className="student-name">{student.first_name} {student.last_name}</div>
                        <div className="student-code">{student.admission_no}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="chain-badge">{student.chain}</span>
                  </td>
                  <td>
                    <span className="class-badge">{student.class_name || 'N/A'}</span>
                  </td>
                  <td>
                    <span className={`gender-badge ${student.gender?.toLowerCase()}`}>
                      {student.gender || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <div>{student.parent_name || 'N/A'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {student.parent_phone || ''}
                    </div>
                  </td>
                  <td>
                    {canManageStudents ? (
                      <div className="action-buttons">
                        <button 
                          className="action-btn edit" 
                          title="Edit"
                          onClick={() => handleEdit(student)}
                          data-testid={`edit-student-${student.id}`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="action-btn delete" 
                          title="Delete"
                          onClick={() => handleDelete(student.id)}
                          data-testid={`delete-student-${student.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Upload size={20} style={{ marginRight: '0.5rem', color: '#a78bfa' }} />
                Bulk Upload Students
              </h2>
              <button className="modal-close" onClick={handleCloseBulkModal}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              {/* Selection Cards Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Chain Card */}
                <div style={{
                  background: bulkData.chain ? 'rgba(139, 92, 246, 0.15)' : 'rgba(51, 65, 85, 0.5)',
                  border: `1px solid ${bulkData.chain ? 'rgba(139, 92, 246, 0.4)' : 'rgba(71, 85, 105, 0.5)'}`,
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Building size={18} color="#a78bfa" />
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>SCHOOL/CHAIN</span>
                  </div>
                  {canSelectChain ? (
                    <select
                      className="form-input"
                      value={bulkData.chain}
                      onChange={(e) => setBulkData({ ...bulkData, chain: e.target.value })}
                      style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                    >
                      <option value="">Select Chain</option>
                      {SCHOOL_PREFIXES.map(prefix => (
                        <option key={prefix} value={prefix}>{prefix}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '0.5rem',
                      color: '#34d399',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                    }}>
                      {currentUser?.chain || 'N/A'}
                    </div>
                  )}
                </div>

                {/* Class Card */}
                <div style={{
                  background: bulkData.class_name ? 'rgba(59, 130, 246, 0.15)' : 'rgba(51, 65, 85, 0.5)',
                  border: `1px solid ${bulkData.class_name ? 'rgba(59, 130, 246, 0.4)' : 'rgba(71, 85, 105, 0.5)'}`,
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Users size={18} color="#60a5fa" />
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>CLASS</span>
                  </div>
                  <select
                    className="form-input"
                    value={bulkData.class_name}
                    onChange={(e) => setBulkData({ ...bulkData, class_name: e.target.value })}
                    style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                  >
                    <option value="">Select Class</option>
                    {classes
                      .filter(c => !bulkData.chain || c.chain === bulkData.chain)
                      .map(cls => (
                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {/* Students Data Card */}
              <div style={{
                background: 'rgba(51, 65, 85, 0.5)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '0.75rem',
                padding: '1rem',
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} color="#f472b6" />
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>STUDENTS DATA</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleDownloadCSVTemplate}
                      style={{
                        background: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        borderRadius: '0.375rem',
                        padding: '0.375rem 0.75rem',
                        color: '#4ade80',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                      }}
                    >
                      <Download size={14} />
                      Download Template
                    </button>
                    <label style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: '0.375rem',
                      padding: '0.375rem 0.75rem',
                      color: '#60a5fa',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                    }}>
                      <Upload size={14} />
                      Upload CSV
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleCSVFileUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
                <textarea
                  className="form-input"
                  value={bulkData.students_text}
                  onChange={(e) => setBulkData({ ...bulkData, students_text: e.target.value })}
                  placeholder={`student_no, first_name, last_name, gender, parent_name, parent_phone\n0293, TAHMID, HAMZA YAHYA, MALE, HAMZA YAHYA SUKWA, 0772 272722\n0294, FATMA, ALI, FEMALE, ALI HASSAN, 0777 123456`}
                  rows={8}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                />
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                  Format: student_no, first_name, last_name, gender, parent_name, parent_phone (one per line)
                  <br />
                  <span style={{ color: '#60a5fa' }}>
                    Admission number will be auto-generated as: {bulkData.chain || 'CHAIN'}/STU[number]/{currentYear}
                  </span>
                </div>
              </div>

              {/* Results Display */}
              {bulkResults && (
                <div style={{
                  background: bulkResults.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${bulkResults.error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                }}>
                  <div style={{ fontWeight: 600, color: bulkResults.error ? '#ef4444' : '#34d399', marginBottom: '0.5rem' }}>
                    {bulkResults.error ? 'Upload Failed' : 'Upload Successful'}
                  </div>
                  {bulkResults.error ? (
                    <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{bulkResults.error}</div>
                  ) : (
                    <div>
                      <div style={{ color: '#6ee7b7', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        ✓ {bulkResults.imported || 0} students imported successfully
                      </div>
                      {bulkResults.failed > 0 && (
                        <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>
                          ✗ {bulkResults.failed} students failed
                        </div>
                      )}
                      {bulkResults.errors?.length > 0 && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#fca5a5' }}>
                          {bulkResults.errors.slice(0, 3).map((e, i) => (
                            <div key={i}>- {e.error || e}</div>
                          ))}
                          {bulkResults.errors.length > 3 && (
                            <div>...and {bulkResults.errors.length - 3} more errors</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCloseBulkModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleBulkUpload}
                disabled={bulkUploading}
                style={{
                  background: bulkUploading ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.8)',
                  border: '1px solid rgba(139, 92, 246, 0.5)',
                }}
              >
                {bulkUploading ? 'Uploading...' : 'Upload Students'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Student Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingStudent ? 'Edit Student' : 'Register New Student'}
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>

              <div className="modal-body">
                {/* Admission Number Section */}
                <div className="form-section">
                  <div className="form-section-title">
                    <Building size={16} />
                    Admission Details
                  </div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label className="form-label">School *</label>
                      <select
                        className="form-input"
                        value={formData.chain}
                        onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                        required
                        disabled={editingStudent || (!canSelectChain && userChain !== 'IHEZA')}
                      >
                        <option value="">Select School</option>
                        {SCHOOL_PREFIXES.map(prefix => (
                          <option key={prefix} value={prefix}>{prefix}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Student No. *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.student_number}
                        onChange={(e) => setFormData({ ...formData, student_number: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        placeholder="0001"
                        required={!editingStudent}
                        disabled={editingStudent}
                        maxLength={4}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Year *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.admission_year}
                        onChange={(e) => setFormData({ ...formData, admission_year: parseInt(e.target.value) })}
                        min="2020"
                        max="2030"
                        required={!editingStudent}
                        disabled={editingStudent}
                      />
                    </div>
                  </div>
                  {!editingStudent && formData.chain && formData.student_number && (
                    <div className="admission-preview">
                      <div className="admission-preview-label">Admission Number:</div>
                      <div className="admission-preview-value">{generateAdmissionNo()}</div>
                    </div>
                  )}
                  {editingStudent && (
                    <div className="admission-preview">
                      <div className="admission-preview-label">Admission Number (cannot be changed):</div>
                      <div className="admission-preview-value">{editingStudent.admission_no}</div>
                    </div>
                  )}
                </div>
                
                {/* Personal Information */}
                <div className="form-section">
                  <div className="form-section-title">
                    <GraduationCap size={16} />
                    Personal Information
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">First Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                        data-testid="student-firstname-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
                        data-testid="student-lastname-input"
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Gender *</label>
                      <select
                        className="form-input"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        required
                      >
                        <option value="">Select Gender</option>
                        {GENDERS.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date of Birth</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Class *</label>
                    <select
                      className="form-input"
                      value={formData.class_name}
                      onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                      required
                    >
                      <option value="">Select Class</option>
                      {classes
                        .filter(c => !formData.chain || c.chain === formData.chain)
                        .map(cls => (
                          <option key={cls.id} value={cls.name}>{cls.name}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
                
                {/* Parent Information */}
                <div className="form-section">
                  <div className="form-section-title">Parent/Guardian</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Parent Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.parent_name}
                        onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Parent Phone</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.parent_phone}
                        onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Password */}
                <div className="form-group">
                  <label className="form-label">
                    {editingStudent ? 'New Password (leave blank to keep current)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingStudent}
                    placeholder={editingStudent ? 'Leave blank to keep current' : 'Student login password'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" data-testid="submit-student-btn">
                  {editingStudent ? 'Update Student' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Students;
