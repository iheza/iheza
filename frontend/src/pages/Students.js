import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { fetchStudents, createStudent, updateStudent, deleteStudent, bulkUploadStudents, selectStudents, selectStudentsLoading } from '../store/slices/studentSlice';
import { selectCurrentUser } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { studentService } from '../services/studentService';
import { toast } from '../hooks/useSoundEnabledToast';
import { Plus, Search, Edit2, Trash2, X, GraduationCap, Building, Upload, FileText, Users, Download, RefreshCw, Filter, Info, VenusAndMars, Venus, School } from 'lucide-react';
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

  const handleExportAllStudents = () => {
    if (!students || students.length === 0) {
      toast.error('No students to export');
      return;
    }
    
    try {
      const chainLabel = chainFilter || 'all_schools';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `iheza_students_${chainLabel}_${dateStr}.doc`;
      
      studentService.exportStudentsToDoc(students, filename);
      toast.success(`Exported ${students.length} students to Word document`);
    } catch (error) {
      toast.error('Failed to export students');
      console.error('Export error:', error);
    }
  };

  // Stats
  const activeStudents = students.filter(s => !['graduated', 'left'].includes((s.status || '').toLowerCase()));
  const totalCount = activeStudents.length;
  const boysCount = activeStudents.filter(s => ['m', 'male'].includes(s.gender?.toLowerCase())).length;
  const girlsCount = activeStudents.filter(s => ['f', 'female'].includes(s.gender?.toLowerCase())).length;
  const schoolsCount = new Set(students.map(s => s.chain).filter(Boolean)).size;

  const avatarColors = [
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #ec4899, #db2777)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    'linear-gradient(135deg, #ef4444, #dc2626)',
    'linear-gradient(135deg, #14b8a6, #0d9488)',
    'linear-gradient(135deg, #f97316, #ea580c)',
  ];

  return (
    <div className="students-page">
      <style>{`
        .students-page {
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
          margin-bottom: 0.8rem;
          flex-wrap: wrap;
          gap: 0.8rem;
        }
        .page-title { display: flex; align-items: center; gap: 0.6rem; }
        .page-title .icon-wrap {
          width: 38px; height: 38px;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 1rem;
          box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);
        }
        .page-title h1 { font-size: 1.3rem; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; }
        .page-title .sub { font-size: 0.8rem; color: #64748b; font-weight: 400; margin-left: 0.2rem; }
        .header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

        .btn {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.4rem 1rem; border-radius: 8px;
          font-weight: 600; font-size: 0.8rem; border: none; cursor: pointer;
          transition: all 0.2s ease; font-family: 'Inter', sans-serif;
        }
        .btn-primary {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(16, 185, 129, 0.4); }
        .btn-outline { background: white; color: #475569; border: 1px solid #e2e8f0; }
        .btn-outline:hover { background: #f8fafc; border-color: #cbd5e1; }
        .btn-purple {
          background: rgba(139, 92, 246, 0.15); color: #7c3aed;
          border: 1px solid rgba(139, 92, 246, 0.25);
        }
        .btn-purple:hover { background: rgba(139, 92, 246, 0.25); transform: translateY(-2px); }

        .stats-compact {
          display: flex; align-items: center; gap: 0.3rem 1.2rem; flex-wrap: wrap;
          background: white; padding: 0.25rem 1rem; border-radius: 10px;
          border: 1px solid #e2e8f0; margin-bottom: 0.8rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .stats-compact .stat-item { display: flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.2rem; }
        .stats-compact .stat-item .icon {
          width: 26px; height: 26px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center; font-size: 0.7rem;
        }
        .stats-compact .stat-item .icon.green { background: #d1fae5; color: #059669; }
        .stats-compact .stat-item .icon.blue { background: #dbeafe; color: #2563eb; }
        .stats-compact .stat-item .icon.pink { background: #fce7f3; color: #db2777; }
        .stats-compact .stat-item .icon.purple { background: #ede9fe; color: #7c3aed; }
        .stats-compact .stat-item .num { font-size: 1rem; font-weight: 700; color: #0f172a; line-height: 1.2; }
        .stats-compact .stat-item .label {
          font-size: 0.6rem; color: #64748b; text-transform: uppercase;
          letter-spacing: 0.3px; font-weight: 500;
        }
        .stats-compact .divider { color: #e2e8f0; font-size: 0.8rem; }

        .filters-bar {
          display: flex; align-items: center; gap: 0.4rem 0.8rem; flex-wrap: nowrap;
          background: white; padding: 0.2rem 0.8rem; border-radius: 10px;
          border: 1px solid #e2e8f0; margin-bottom: 0.8rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow-x: auto;
        }
        .filters-bar .search-wrap { flex: 1; min-width: 140px; max-width: 220px; position: relative; flex-shrink: 1; }
        .filters-bar .search-wrap input {
          width: 100%; padding: 0.25rem 0.4rem 0.25rem 1.8rem;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
          color: #0f172a; font-size: 0.75rem; font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
        }
        .filters-bar .search-wrap input:focus {
          outline: none; border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }
        .filters-bar .search-wrap .search-icon {
          position: absolute; left: 0.5rem; top: 50%; transform: translateY(-50%);
          color: #94a3b8; font-size: 0.65rem;
        }
        .filters-bar .filter-group { display: flex; align-items: center; gap: 0.2rem; flex-shrink: 0; }
        .filters-bar .filter-group .filter-label {
          font-size: 0.6rem; color: #64748b; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .filters-bar .filter-group select {
          padding: 0.2rem 0.5rem; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 6px;
          color: #0f172a; font-size: 0.75rem; font-family: 'Inter', sans-serif; cursor: pointer;
          min-width: 70px; max-width: 110px;
        }
        .filters-bar .filter-group select:focus { outline: none; border-color: #10b981; }
        .filters-bar .result-count {
          font-size: 0.7rem; color: #64748b; display: flex; align-items: center; gap: 0.3rem;
          flex-shrink: 0; margin-left: auto; white-space: nowrap;
        }

        .excel-container {
          overflow-x: auto; border-radius: 12px;
          border: 1px solid #d0d7e2; background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .excel-table {
          width: 100%; border-collapse: collapse;
          font-family: 'Inter', sans-serif; font-size: 0.82rem; min-width: 1000px;
        }
        .excel-table thead th {
          background: #e8edf4; color: #1f3b5c; font-weight: 600; text-transform: uppercase;
          font-size: 0.65rem; letter-spacing: 0.4px; padding: 0.5rem 0.7rem;
          border-right: 1px solid #d0d7e2; border-bottom: 2px solid #b8c6d8;
          text-align: left; white-space: nowrap; position: sticky; top: 0; z-index: 10;
        }
        .excel-table thead th:last-child { border-right: none; }
        .excel-table tbody td {
          padding: 0.4rem 0.7rem; border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0; vertical-align: middle;
          color: #1e2f3f; background: white;
        }
        .excel-table tbody td:last-child { border-right: none; }
        .excel-table tbody tr:nth-child(even) td { background: #f8faff; }
        .excel-table tbody tr:hover td { background: #e8f0fe; }
        .excel-table .col-id { width: 35px; text-align: center; }
        .excel-table .col-name { min-width: 160px; }
        .excel-table .col-school { width: 70px; }
        .excel-table .col-class { width: 90px; }
        .excel-table .col-gender { width: 75px; }
        .excel-table .col-parent { min-width: 150px; }
        .excel-table .col-actions { width: 110px; }

        .student-cell { display: flex; align-items: center; gap: 8px; }
        .student-cell .avatar {
          width: 30px; height: 30px; border-radius: 8px;
          background: linear-gradient(135deg, #10b981, #059669);
          display: flex; align-items: center; justify-content: center;
          font-weight: 600; font-size: 0.7rem; color: white; flex-shrink: 0;
        }
        .student-cell .info .name { font-weight: 600; color: #0f172a; font-size: 0.85rem; }
        .student-cell .info .admission {
          font-size: 0.6rem; color: #94a3b8; font-family: 'Inter', monospace;
        }

        .school-badge {
          display: inline-block; padding: 0.05rem 0.4rem; border-radius: 20px;
          font-size: 0.6rem; font-weight: 600; background: #ede9fe; color: #7c3aed;
        }
        .class-badge {
          display: inline-block; padding: 0.05rem 0.4rem; border-radius: 20px;
          font-size: 0.6rem; font-weight: 600; background: #dbeafe; color: #2563eb;
        }
        .gender-badge {
          display: inline-block; padding: 0.05rem 0.4rem; border-radius: 20px;
          font-size: 0.6rem; font-weight: 600; text-transform: uppercase;
        }
        .gender-badge.male { background: #dbeafe; color: #2563eb; }
        .gender-badge.female { background: #fce7f3; color: #db2777; }
        .gender-badge.other { background: #e2e8f0; color: #475569; }

        .parent-cell .pname { font-size: 0.8rem; color: #0f172a; font-weight: 500; }
        .parent-cell .pphone { font-size: 0.6rem; color: #94a3b8; }

        .action-group { display: flex; gap: 0.2rem; flex-wrap: wrap; }
        .action-group .act-btn {
          display: inline-flex; align-items: center; gap: 2px;
          padding: 0.1rem 0.35rem; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 4px;
          color: #64748b; font-size: 0.6rem; font-weight: 500; cursor: pointer;
          transition: all 0.15s ease; font-family: 'Inter', sans-serif;
        }
        .action-group .act-btn:hover { background: #e2e8f0; color: #0f172a; }
        .action-group .act-btn.edit:hover { background: #dbeafe; color: #2563eb; border-color: #bfdbfe; }
        .action-group .act-btn.delete:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
        .action-group .act-btn.view-only { opacity: 0.5; cursor: default; }
        .action-group .act-btn.view-only:hover { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }

        .pagination-bar {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
          padding: 0.3rem 0.8rem; background: #f8faff;
          border-top: 1px solid #d0d7e2; border-radius: 0 0 12px 12px;
          font-size: 0.75rem; color: #1f3b5c;
        }
        .pagination-bar .info { color: #3f6490; font-size: 0.7rem; }
        .pagination-bar .pages { display: flex; gap: 0.15rem; }
        .pagination-bar .pages button {
          background: white; border: 1px solid #d0d7e2; padding: 0.1rem 0.5rem;
          border-radius: 4px; font-weight: 500; font-size: 0.65rem;
          color: #1f3b5c; cursor: pointer; transition: 0.1s;
        }
        .pagination-bar .pages button:hover { background: #eef3fa; }
        .pagination-bar .pages button.active { background: #10b981; color: white; border-color: #10b981; }
        .pagination-bar .pages button:disabled { opacity: 0.4; cursor: default; background: #f0f3f8; }

        .empty-state { text-align: center; padding: 3rem; color: #64748b; background: white; border-radius: 12px; border: 1px solid #d0d7e2; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1rem;
        }
        .modal {
          background: white; border-radius: 16px; width: 100%; max-width: 600px;
          max-height: 90vh; overflow-y: auto; animation: modalIn 0.25s ease;
          box-shadow: 0 24px 48px rgba(0,0,0,0.2);
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(16px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 1.4rem; border-bottom: 1px solid #e2e8f0;
        }
        .modal-header h2 { font-size: 1.05rem; font-weight: 700; color: #0f172a; }
        .modal-close { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.3rem; border-radius: 8px; transition: background 0.2s ease; }
        .modal-close:hover { background: #f1f5f9; }
        .modal-body { padding: 1.4rem; }
        .modal-footer {
          display: flex; gap: 0.8rem; justify-content: flex-end;
          padding: 1.1rem 1.4rem; border-top: 1px solid #e2e8f0;
        }
        .btn-success {
          background: linear-gradient(135deg, #059669, #10b981);
          color: white; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
        }
        .btn-success:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4); }
        .btn-ghost { background: transparent; color: #475569; border: 1px solid #e2e8f0; }
        .btn-ghost:hover { background: #f8fafc; }

        .form-section { margin-bottom: 1.2rem; }
        .form-section-title {
          font-size: 0.75rem; font-weight: 700; color: #475569;
          text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 0.6rem;
          display: flex; align-items: center; gap: 0.4rem;
        }
        .form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
        .form-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; }
        .form-group { margin-bottom: 0.8rem; }
        .form-label {
          display: block; font-size: 0.7rem; font-weight: 600; color: #475569;
          text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 0.2rem;
        }
        .form-input {
          width: 100%; padding: 0.5rem 0.8rem; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 10px; color: #0f172a;
          font-size: 0.85rem; font-family: 'Inter', sans-serif; transition: all 0.2s ease;
        }
        .form-input:focus { outline: none; border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
        .form-input:disabled { opacity: 0.6; cursor: not-allowed; }

        .admission-preview {
          background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 0.5rem; padding: 0.75rem 1rem; margin-top: 0.5rem;
        }
        .admission-preview-label { font-size: 0.75rem; color: #64748b; margin-bottom: 0.25rem; }
        .admission-preview-value {
          font-family: monospace; font-size: 1rem; color: #10b981; font-weight: 600;
        }

        .bulk-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }
        .bulk-card-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 0.75rem;
        }
        .bulk-card-title {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.8rem; font-weight: 700; color: #475569;
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .bulk-card-actions { display: flex; gap: 0.5rem; }
        .mini-btn {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.3rem 0.6rem; border-radius: 6px;
          font-size: 0.7rem; font-weight: 600; cursor: pointer;
          border: 1px solid; font-family: 'Inter', sans-serif;
        }
        .mini-btn.green { background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.4); color: #059669; }
        .mini-btn.blue { background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.4); color: #2563eb; }
        .mini-btn.purple { background: rgba(139, 92, 246, 0.15); border-color: rgba(139, 92, 246, 0.4); color: #7c3aed; }
        .mini-btn:hover { filter: brightness(0.95); }

        .bulk-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem; }
        .bulk-select-card {
          background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 0.75rem; padding: 1rem; cursor: pointer; transition: all 0.2s;
        }
        .bulk-select-card.selected { background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.4); }
        .bulk-select-card .card-label {
          display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;
          font-size: 0.8rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.3px;
        }
        .bulk-select-card .chain-locked {
          padding: 0.5rem 0.75rem; background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 0.5rem;
          color: #059669; font-size: 0.9rem; font-weight: 600;
        }

        .bulk-results {
          background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 0.75rem; padding: 1rem; margin-bottom: 1rem;
        }
        .bulk-results.error { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); }
        .bulk-results .res-title { font-weight: 600; color: #059669; margin-bottom: 0.5rem; }
        .bulk-results.error .res-title { color: #ef4444; }
        .bulk-results .res-text { color: #059669; font-size: 0.85rem; margin-bottom: 0.25rem; }
        .bulk-results.error .res-text { color: #fca5a5; }
        .bulk-results .res-errors { margin-top: 0.5rem; font-size: 0.8rem; color: #fca5a5; }

        .chain-toggle-wrap { margin-bottom: 0.8rem; }

        @media (max-width: 900px) {
          .filters-bar { flex-wrap: wrap; gap: 0.3rem 0.6rem; }
          .filters-bar .search-wrap { min-width: 120px; max-width: unset; flex: 1 1 100%; }
          .filters-bar .filter-group select { min-width: 60px; max-width: unset; }
        }
        @media (max-width: 768px) {
          .students-page { padding: 0.8rem; }
          .page-title h1 { font-size: 1.1rem; }
          .page-title .sub { display: none; }
          .stats-compact { gap: 0.2rem 0.6rem; padding: 0.2rem 0.6rem; }
          .stats-compact .stat-item .num { font-size: 0.9rem; }
          .stats-compact .stat-item .label { font-size: 0.5rem; }
          .stats-compact .stat-item .icon { width: 22px; height: 22px; font-size: 0.6rem; }
          .filters-bar { padding: 0.3rem 0.6rem; }
          .excel-table { min-width: 850px; font-size: 0.75rem; }
          .excel-table thead th,
          .excel-table tbody td { padding: 0.3rem 0.4rem; }
          .action-group .act-btn { font-size: 0.5rem; padding: 0.1rem 0.25rem; }
          .bulk-grid { grid-template-columns: 1fr; }
          .form-row, .form-row-3 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="app-wrapper">

        {/* HEADER */}
        <header className="page-header">
          <div className="page-title">
            <div className="icon-wrap"><GraduationCap size={18} /></div>
            <div>
              <h1>Students <span className="sub">· Management</span></h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={() => dispatch(fetchStudents({ chainFilter }))}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-purple" onClick={handleExportAllStudents} data-testid="export-students-btn" title="Download all students as a Word document">
              <FileText size={14} /> Export
            </button>
            {canAddStudent && (
              <>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }} data-testid="add-student-btn">
                  <Plus size={14} /> Add
                </button>
                <button className="btn btn-purple" onClick={handleOpenBulkModal} data-testid="bulk-upload-btn">
                  <Upload size={14} /> Bulk
                </button>
              </>
            )}
          </div>
        </header>

        {/* Chain toggle for Director/Coordinator */}
        <div className="chain-toggle-wrap">
          <ChainToggle selectedChain={chainFilter} onChainChange={(chain) => {
            setChainFilter(chain);
            setClassFilter('');
          }} />
        </div>

        {/* STATS - COMPACT ONE LINE */}
        <div className="stats-compact">
          <span className="stat-item">
            <span className="icon green"><Users size={14} /></span>
            <span className="num">{totalCount}</span>
            <span className="label">Total</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon blue"><VenusAndMars size={14} /></span>
            <span className="num">{boysCount}</span>
            <span className="label">Boys</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon pink"><Venus size={14} /></span>
            <span className="num">{girlsCount}</span>
            <span className="label">Girls</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon purple"><School size={14} /></span>
            <span className="num">{schoolsCount}</span>
            <span className="label">Schools</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="num" style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Filtered: <strong style={{ color: '#0f172a' }}>{filteredStudents.length}</strong>
            </span>
          </span>
        </div>

        {/* FILTERS - COMPACT ONE LINE */}
        <div className="filters-bar">
          <div className="search-wrap">
            <Search className="search-icon" size={12} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="student-search"
            />
          </div>

          {canSelectChain && (
            <div className="filter-group">
              <span className="filter-label">School</span>
              <select value={chainFilter} onChange={(e) => setChainFilter(e.target.value)} data-testid="chain-filter">
                <option value="">All</option>
                {SCHOOL_PREFIXES.map(prefix => (
                  <option key={prefix} value={prefix}>{prefix}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <span className="filter-label">Class</span>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} data-testid="class-filter">
              <option value="">All</option>
              {filteredClasses.map(cls => (
                <option key={cls.id} value={cls.name}>{cls.name}</option>
              ))}
            </select>
          </div>

          <span className="result-count"><Filter size={12} /> {filteredStudents.length} results</span>
        </div>

        {/* EXCEL TABLE */}
        <div className="excel-container">
          {loading ? (
            <div className="empty-state">Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="empty-state">
              {students.length === 0
                ? 'No students registered yet. Click "Add" to get started.'
                : 'No students match your search criteria.'
              }
            </div>
          ) : (
            <table className="excel-table" data-testid="students-table">
              <thead>
                <tr>
                  <th className="col-id">#</th>
                  <th className="col-name">Student</th>
                  <th className="col-school">School</th>
                  <th className="col-class">Class</th>
                  <th className="col-gender">Gender</th>
                  <th className="col-parent">Parent/Guardian</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => (
                  <tr key={student.id}>
                    <td className="col-id">{index + 1}</td>
                    <td className="col-name">
                      <div className="student-cell">
                        <div className="avatar" style={{ background: avatarColors[index % avatarColors.length] }}>
                          {student.first_name?.charAt(0) || 'S'}
                        </div>
                        <div className="info">
                          <div className="name">{student.first_name} {student.last_name}</div>
                          <div className="admission">{student.admission_no}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="school-badge">{student.chain}</span></td>
                    <td><span className="class-badge">{student.class_name || 'N/A'}</span></td>
                    <td>
                      <span className={`gender-badge ${student.gender?.toLowerCase()}`}>
                        {student.gender || 'N/A'}
                      </span>
                    </td>
                    <td className="col-parent">
                      <div className="parent-cell">
                        <div className="pname">{student.parent_name || 'N/A'}</div>
                        <div className="pphone">{student.parent_phone || ''}</div>
                      </div>
                    </td>
                    <td className="col-actions">
                      {canManageStudents ? (
                        <div className="action-group">
                          <button className="act-btn edit" title="Edit" onClick={() => handleEdit(student)} data-testid={`edit-student-${student.id}`}>
                            <Edit2 size={11} /> Edit
                          </button>
                          <button className="act-btn delete" title="Delete" onClick={() => handleDelete(student.id)} data-testid={`delete-student-${student.id}`}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ) : (
                        <div className="action-group">
                          <button className="act-btn view-only" disabled><span>View</span></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* PAGINATION */}
          <div className="pagination-bar">
            <span className="info"><Info size={12} /> {filteredStudents.length} records · page 1 of 1</span>
            <div className="pages">
              <button disabled><span>‹</span></button>
              <button className="active">1</button>
              <button disabled><span>›</span></button>
            </div>
          </div>
        </div>

      </div>

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2><Upload size={18} style={{ color: '#7c3aed', marginRight: 6, verticalAlign: 'middle' }} /> Bulk Upload Students</h2>
              <button className="modal-close" onClick={handleCloseBulkModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="bulk-grid">
                {/* Chain Card */}
                <div className={`bulk-select-card ${bulkData.chain ? 'selected' : ''}`}>
                  <div className="card-label"><Building size={16} color="#7c3aed" /> School/Chain</div>
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
                    <div className="chain-locked">{currentUser?.chain || 'N/A'}</div>
                  )}
                </div>

                {/* Class Card */}
                <div className={`bulk-select-card ${bulkData.class_name ? 'selected' : ''}`}>
                  <div className="card-label"><Users size={16} color="#2563eb" /> Class</div>
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
              <div className="bulk-card">
                <div className="bulk-card-header">
                  <div className="bulk-card-title"><FileText size={16} color="#db2777" /> Students Data</div>
                  <div className="bulk-card-actions">
                    <button type="button" className="mini-btn green" onClick={handleDownloadCSVTemplate}>
                      <Download size={12} /> Download Template
                    </button>
                    <label className="mini-btn blue" style={{ cursor: 'pointer' }}>
                      <Upload size={12} /> Upload CSV
                      <input type="file" accept=".csv,.txt" onChange={handleCSVFileUpload} style={{ display: 'none' }} />
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
                  <span style={{ color: '#2563eb' }}>
                    Admission number will be auto-generated as: {bulkData.chain || 'CHAIN'}/STU[number]/{currentYear}
                  </span>
                </div>
              </div>

              {/* Results Display */}
              {bulkResults && (
                <div className={`bulk-results ${bulkResults.error ? 'error' : ''}`}>
                  <div className="res-title">{bulkResults.error ? 'Upload Failed' : 'Upload Successful'}</div>
                  {bulkResults.error ? (
                    <div className="res-text">{bulkResults.error}</div>
                  ) : (
                    <div>
                      <div className="res-text">✓ {bulkResults.imported || 0} students imported successfully</div>
                      {bulkResults.failed > 0 && (
                        <div className="res-text">✗ {bulkResults.failed} students failed</div>
                      )}
                      {bulkResults.errors?.length > 0 && (
                        <div className="res-errors">
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
              <button type="button" className="btn btn-ghost" onClick={handleCloseBulkModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleBulkUpload}
                disabled={bulkUploading}
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
              <h2>{editingStudent ? 'Edit Student' : 'Register New Student'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Admission Number Section */}
                <div className="form-section">
                  <div className="form-section-title"><Building size={14} /> Admission Details</div>
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
                  <div className="form-section-title"><GraduationCap size={14} /> Personal Information</div>
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
                <button type="button" className="btn btn-ghost" onClick={handleCloseModal}>
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

