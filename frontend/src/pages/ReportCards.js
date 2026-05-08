import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { studentService } from '../services/studentService';
import { toast } from 'sonner';
import { 
  FileText, Search, Printer, Download, Send, Save, 
  ChevronRight, Star, User, BookOpen, Award, Settings,
  Image, Upload, X, Edit3
} from 'lucide-react';
import { exportReportCard } from '../utils/docExport';
import { API_URL } from '../config/api';
import { apiClient } from '../services/authService';

const BEHAVIOR_MARKS = ['neatness', 'cooperation', 'responsibility', 'punctuality', 'discipline'];
const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Final'];

function ReportCards() {
  const currentUser = useSelector(selectCurrentUser);
  const printRef = useRef(null);
  
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Behavior marks state
  const [behaviorMarks, setBehaviorMarks] = useState({
    neatness: 3, cooperation: 3, responsibility: 3, punctuality: 3, discipline: 3
  });
  const [teacherComment, setTeacherComment] = useState('');
  const [principalComment, setPrincipalComment] = useState('');

  const canCreateReportCards = ['teacher', 'academic', 'section_leader', 'principal', 'director', 'coordinator'].includes(currentUser?.role?.toLowerCase());
  const canEditSchoolSettings = ['principal', 'director', 'coordinator', 'academic', 'section_leader'].includes(currentUser?.role?.toLowerCase());

  // School settings state
  const [schoolSettings, setSchoolSettings] = useState({
    school_name: 'IHEZA',
    school_subtitle: 'The Institute of Holistic Education of Zanzibar',
    logo: null
  });
  const [showSchoolSettings, setShowSchoolSettings] = useState(false);
  const [editingSchoolName, setEditingSchoolName] = useState(false);
  const [editingSchoolSubtitle, setEditingSchoolSubtitle] = useState(false);
  const [tempSchoolName, setTempSchoolName] = useState('');
  const [tempSchoolSubtitle, setTempSchoolSubtitle] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  const loadSchoolSettings = useCallback(async () => {
    try {
      const response = await apiClient.get('/school-settings');
      const data = response.data;
      setSchoolSettings({
        school_name: data.school_name || 'IHEZA',
        school_subtitle: data.school_subtitle || 'The Institute of Holistic Education of Zanzibar',
        logo: data.logo || null
      });
    } catch (error) {
      console.error('Failed to load school settings:', error);
    }
  }, []);

  const handleSaveSchoolName = async () => {
    if (!tempSchoolName.trim()) return;
    try {
      const response = await apiClient.put('/school-settings', { school_name: tempSchoolName.trim() });
      const data = response.data;
      setSchoolSettings(prev => ({ ...prev, school_name: data.school_name }));
      setEditingSchoolName(false);
      toast.success('School name saved');
    } catch (error) {
      toast.error('Failed to save school name');
    }
  };

  const handleSaveSchoolSubtitle = async () => {
    if (!tempSchoolSubtitle.trim()) return;
    try {
      const response = await apiClient.put('/school-settings', { school_subtitle: tempSchoolSubtitle.trim() });
      const data = response.data;
      setSchoolSettings(prev => ({ ...prev, school_subtitle: data.school_subtitle }));
      setEditingSchoolSubtitle(false);
      toast.success('School subtitle saved');
    } catch (error) {
      toast.error('Failed to save school subtitle');
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be less than 2MB');
      return;
    }
    
    setUploadingLogo(true);
    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const response = await apiClient.put('/school-settings', { logo: base64 });
      const data = response.data;
      setSchoolSettings(prev => ({ ...prev, logo: data.logo }));
      toast.success('Logo uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await apiClient.put('/school-settings', { logo: null });
      setSchoolSettings(prev => ({ ...prev, logo: null }));
      toast.success('Logo removed');
    } catch (error) {
      toast.error('Failed to remove logo');
    }
  };

  useEffect(() => {
    loadInitialData();
    loadSchoolSettings();
  }, [loadSchoolSettings]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedStudent && selectedTerm) {
      loadReportCard();
    }
  }, [selectedStudent, selectedTerm, academicYear]);

  const loadInitialData = async () => {
    try {
      const [classesData, subjectsData] = await Promise.all([
        dataService.getClasses(),
        dataService.getSubjects()
      ]);
      setClasses(classesData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await studentService.getStudents(selectedClass);
      setStudents(data);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  };

  const loadReportCard = async () => {
    if (!selectedStudent) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/student-report-card/${selectedStudent.id}?term=${encodeURIComponent(selectedTerm)}&academic_year=${academicYear}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
        setBehaviorMarks(data.behavior_marks || {
          neatness: 3, cooperation: 3, responsibility: 3, punctuality: 3, discipline: 3
        });
        setTeacherComment(data.teacher_comment || '');
        setPrincipalComment(data.principal_comment || '');
      } else {
        setReportData(null);
      }
    } catch (error) {
      console.error('Failed to load report card:', error);
      toast.error('Failed to load report card');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReportCard = async () => {
    if (!selectedStudent) return;
    
    try {
      setSaving(true);
      
      const reportCardData = {
        student_id: selectedStudent.id,
        term: selectedTerm,
        academic_year: academicYear,
        chain: selectedStudent.chain || currentUser?.chain,
        ...behaviorMarks,
        teacher_comment: teacherComment,
        principal_comment: principalComment,
        position: reportData?.position,
        total_students: reportData?.total_students,
        status: 'draft',
        created_by: currentUser?.id || 'unknown'
      };
      
      const response = await fetch(`${API_URL}/api/report-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportCardData)
      });
      
      if (response.ok) {
        toast.success('Report card saved');
        loadReportCard();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error('Failed to save report card');
    } finally {
      setSaving(false);
    }
  };

  const handleSendToStudent = async () => {
    if (!reportData?.report_card_id) {
      toast.error('Please save the report card first');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/report-cards/${reportData.report_card_id}/send`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast.success('Report card sent to student portal');
        loadReportCard();
      } else {
        throw new Error('Failed to send');
      }
    } catch (error) {
      toast.error('Failed to send report card');
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Report Card - ${selectedStudent?.first_name} ${selectedStudent?.last_name}</title>
          <style>
            ${getPrintStyles()}
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
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
  
  const handleDownloadDoc = () => {
    if (!selectedStudent || !reportData) {
      toast.error('Please select a student and load their report card first');
      return;
    }
    
    try {
      const exportData = {
        ...reportData,
        student_name: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
        admission_no: selectedStudent.admission_no,
        class_name: selectedStudent.class_name,
        term: selectedTerm,
        academic_year: academicYear,
        behavior_marks: BEHAVIOR_MARKS.map(mark => ({
          category: mark.charAt(0).toUpperCase() + mark.slice(1),
          rating: behaviorMarks[mark]
        })),
        teacher_comment: teacherComment,
        grades: reportData.grades || []
      };
      
      exportReportCard(exportData, selectedStudent);
      toast.success('Report card downloaded as Word document');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report card');
    }
  };

  const getPrintStyles = () => `
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; }
    .report-card-print { max-width: 100%; padding: 15px; }
    .report-header { text-align: center; border-bottom: 2px solid #0f4c81; padding-bottom: 10px; margin-bottom: 10px; }
    .school-name { font-size: 18px; font-weight: bold; color: #0f4c81; }
    .school-subtitle { font-size: 10px; color: #666; }
    .report-title { font-size: 14px; font-weight: bold; margin-top: 8px; background: #0f4c81; color: white; padding: 4px; }
    .student-info { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; padding: 8px; background: #f5f5f5; border-radius: 4px; }
    .info-item { flex: 1; min-width: 120px; }
    .info-label { font-size: 9px; color: #666; text-transform: uppercase; }
    .info-value { font-weight: 600; }
    .grades-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    .grades-table th, .grades-table td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
    .grades-table th { background: #0f4c81; color: white; font-size: 10px; }
    .grades-table tr:nth-child(even) { background: #f9f9f9; }
    .grade-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 10px; }
    .grade-A { background: #22c55e; color: white; }
    .grade-B { background: #3b82f6; color: white; }
    .grade-C { background: #8b5cf6; color: white; }
    .grade-D { background: #f59e0b; color: white; }
    .grade-E { background: #f97316; color: white; }
    .grade-F { background: #ef4444; color: white; }
    .summary-row { display: flex; gap: 10px; margin: 10px 0; }
    .summary-box { flex: 1; text-align: center; padding: 8px; background: #f0f0f0; border-radius: 4px; }
    .summary-value { font-size: 16px; font-weight: bold; color: #0f4c81; }
    .summary-label { font-size: 9px; color: #666; }
    .behavior-section { margin: 10px 0; }
    .section-title { font-size: 11px; font-weight: bold; background: #e0e0e0; padding: 4px 8px; margin-bottom: 5px; }
    .behavior-grid { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px; }
    .behavior-item { flex: 1; min-width: 80px; text-align: center; }
    .behavior-label { font-size: 9px; color: #666; }
    .stars { color: #f59e0b; }
    .comments-section { margin: 10px 0; }
    .comment-box { padding: 8px; background: #f9f9f9; border-left: 3px solid #0f4c81; margin: 5px 0; min-height: 30px; }
    .comment-label { font-size: 9px; color: #666; margin-bottom: 3px; }
    .footer { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd; }
    .signature-box { text-align: center; width: 30%; }
    .signature-line { border-top: 1px solid #333; margin-top: 30px; padding-top: 3px; font-size: 9px; }
  `;

  const filteredStudents = students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const admNo = s.admission_no?.toLowerCase() || '';
    return fullName.includes(searchTerm.toLowerCase()) || admNo.includes(searchTerm.toLowerCase());
  });

  const renderStars = (count) => {
    return '★'.repeat(count) + '☆'.repeat(5 - count);
  };

  return (
    <div className="report-cards-page">
      <style>{`
        .report-cards-page { padding: 1.5rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.75rem; }
        .page-title-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        
        .content-grid { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; }
        @media (max-width: 1024px) { .content-grid { grid-template-columns: 1fr; } }
        
        .sidebar-panel { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; padding: 1rem; height: fit-content; }
        .panel-title { font-size: 0.875rem; font-weight: 600; color: #94a3b8; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
        
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.75rem; font-weight: 500; color: #64748b; margin-bottom: 0.5rem; text-transform: uppercase; }
        .form-select, .form-input { width: 100%; padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        .form-select:focus, .form-input:focus { outline: none; border-color: #8b5cf6; }
        
        .search-box { position: relative; margin-bottom: 1rem; }
        .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #64748b; }
        .search-input { width: 100%; padding: 0.75rem 0.75rem 0.75rem 2.5rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        
        .student-list { max-height: 300px; overflow-y: auto; }
        .student-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; }
        .student-item:hover { background: rgba(51, 65, 85, 0.5); }
        .student-item.selected { background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.5); }
        .student-avatar { width: 36px; height: 36px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; font-size: 0.875rem; }
        .student-info { flex: 1; }
        .student-name { font-weight: 500; color: #f8fafc; font-size: 0.875rem; }
        .student-code { font-size: 0.7rem; color: #64748b; font-family: monospace; }
        
        .main-panel { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; overflow: hidden; }
        
        .report-card-view { padding: 1.5rem; }
        .report-header-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .report-actions { display: flex; gap: 0.5rem; }
        
        .empty-state { text-align: center; padding: 4rem 2rem; color: #64748b; }
        .empty-icon { width: 64px; height: 64px; background: rgba(51, 65, 85, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; }
        
        /* Report Card Print Styles */
        .report-card-print { background: white; border-radius: 0.5rem; padding: 1.5rem; color: #333; }
        .rc-header { text-align: center; border-bottom: 3px solid #0f4c81; padding-bottom: 1rem; margin-bottom: 1rem; }
        .rc-school-name { font-size: 1.5rem; font-weight: 700; color: #0f4c81; }
        .rc-school-subtitle { font-size: 0.75rem; color: #666; }
        .rc-title { font-size: 1rem; font-weight: 600; margin-top: 0.5rem; background: #0f4c81; color: white; padding: 0.5rem; display: inline-block; border-radius: 4px; }
        
        .rc-student-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem; }
        .rc-info-item { }
        .rc-info-label { font-size: 0.65rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .rc-info-value { font-weight: 600; color: #333; font-size: 0.875rem; }
        
        .rc-grades-table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        .rc-grades-table th { background: #0f4c81; color: white; padding: 0.5rem; text-align: left; font-size: 0.75rem; font-weight: 600; }
        .rc-grades-table td { padding: 0.5rem; border-bottom: 1px solid #e0e0e0; font-size: 0.8rem; }
        .rc-grades-table tr:nth-child(even) { background: #f9f9f9; }
        
        .rc-grade-badge { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; }
        .rc-grade-A { background: #22c55e; color: white; }
        .rc-grade-B { background: #3b82f6; color: white; }
        .rc-grade-C { background: #8b5cf6; color: white; }
        .rc-grade-D { background: #f59e0b; color: white; }
        .rc-grade-E { background: #f97316; color: white; }
        .rc-grade-F { background: #ef4444; color: white; }
        
        .rc-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; }
        .rc-summary-box { text-align: center; padding: 1rem; background: #f0f4f8; border-radius: 0.5rem; }
        .rc-summary-value { font-size: 1.5rem; font-weight: 700; color: #0f4c81; }
        .rc-summary-label { font-size: 0.65rem; color: #666; text-transform: uppercase; }
        
        .rc-section { margin: 1rem 0; }
        .rc-section-title { font-size: 0.75rem; font-weight: 600; background: #e8e8e8; padding: 0.5rem; margin-bottom: 0.5rem; color: #333; }
        
        .rc-behavior-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; padding: 0.5rem; }
        .rc-behavior-item { text-align: center; }
        .rc-behavior-label { font-size: 0.65rem; color: #666; text-transform: capitalize; }
        .rc-stars { color: #f59e0b; font-size: 0.875rem; }
        
        .rc-comment-box { padding: 0.75rem; background: #f9f9f9; border-left: 3px solid #0f4c81; margin: 0.5rem 0; min-height: 50px; }
        .rc-comment-label { font-size: 0.65rem; color: #666; margin-bottom: 0.25rem; text-transform: uppercase; }
        .rc-comment-text { font-size: 0.8rem; color: #333; }
        
        /* Behavior Edit */
        .behavior-edit-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; margin: 1rem 0; }
        .behavior-edit-item { text-align: center; padding: 0.5rem; background: rgba(51, 65, 85, 0.3); border-radius: 0.5rem; }
        .behavior-edit-label { font-size: 0.7rem; color: #94a3b8; text-transform: capitalize; margin-bottom: 0.25rem; }
        .behavior-select { width: 100%; padding: 0.5rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.25rem; color: #f8fafc; font-size: 0.875rem; text-align: center; }
        
        .comment-textarea { width: 100%; padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; resize: vertical; min-height: 60px; }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <FileText size={20} color="white" />
          </span>
          Report Cards
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {canEditSchoolSettings && (
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setTempSchoolName(schoolSettings.school_name);
                setTempSchoolSubtitle(schoolSettings.school_subtitle);
                setShowSchoolSettings(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Settings size={16} /> School Settings
            </button>
          )}
        </div>
      </div>

      {/* School Settings Modal */}
      {showSchoolSettings && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid rgba(51,65,85,0.5)',
            borderRadius: '1rem', padding: '2rem', maxWidth: '500px', width: '100%',
            maxHeight: '90vh', overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={20} /> School Settings
              </h2>
              <button 
                onClick={() => setShowSchoolSettings(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* School Name */}
            <div className="form-group">
              <label className="form-label">School Name</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {editingSchoolName ? (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      value={tempSchoolName}
                      onChange={(e) => setTempSchoolName(e.target.value)}
                      placeholder="Enter school name"
                      style={{ flex: 1 }}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSaveSchoolName}
                      style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                    >
                      Save
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setEditingSchoolName(false)}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#f8fafc', flex: 1 }}>{schoolSettings.school_name}</span>
                    <button 
                      onClick={() => setEditingSchoolName(true)}
                      style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer' }}
                    >
                      <Edit3 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* School Subtitle */}
            <div className="form-group">
              <label className="form-label">School Subtitle</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {editingSchoolSubtitle ? (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      value={tempSchoolSubtitle}
                      onChange={(e) => setTempSchoolSubtitle(e.target.value)}
                      placeholder="Enter school subtitle"
                      style={{ flex: 1 }}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSaveSchoolSubtitle}
                      style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                    >
                      Save
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setEditingSchoolSubtitle(false)}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#f8fafc', flex: 1 }}>{schoolSettings.school_subtitle}</span>
                    <button 
                      onClick={() => setEditingSchoolSubtitle(true)}
                      style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer' }}
                    >
                      <Edit3 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Logo Upload */}
            <div className="form-group">
              <label className="form-label">School Logo</label>
              <div style={{ 
                border: '2px dashed rgba(71,85,105,0.5)', 
                borderRadius: '0.75rem', 
                padding: '1.5rem',
                textAlign: 'center',
                background: 'rgba(51,65,85,0.3)'
              }}>
                {schoolSettings.logo ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img 
                      src={schoolSettings.logo} 
                      alt="School Logo" 
                      style={{ 
                        maxWidth: '200px', maxHeight: '120px', 
                        borderRadius: '0.5rem', objectFit: 'contain'
                      }} 
                    />
                    <button
                      onClick={handleRemoveLogo}
                      style={{
                        position: 'absolute', top: '-8px', right: '-8px',
                        background: '#ef4444', border: 'none', borderRadius: '50%',
                        width: '24px', height: '24px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'white'
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Image size={40} color="#64748b" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                      No logo uploaded
                    </p>
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Upload size={16} />
                  {uploadingLogo ? 'Uploading...' : schoolSettings.logo ? 'Change Logo' : 'Upload Logo'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowSchoolSettings(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="content-grid">
        {/* Sidebar - Student Selection */}
        <div className="sidebar-panel">
          <div className="panel-title">
            <User size={16} /> Select Student
          </div>
          
          <div className="form-group">
            <label className="form-label">Class</label>
            <select
              className="form-select"
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(null); }}
              data-testid="class-select"
            >
              <option value="">Select Class</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.name}>{cls.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Term</label>
            <select
              className="form-select"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
            >
              {TERMS.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Academic Year</label>
            <input
              type="text"
              className="form-input"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2025"
            />
          </div>
          
          {selectedClass && (
            <>
              <div className="search-box">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search student..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="student-list">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className={`student-item ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                    onClick={() => setSelectedStudent(student)}
                    data-testid={`student-${student.id}`}
                  >
                    <div className="student-avatar">
                      {student.first_name?.charAt(0)}
                    </div>
                    <div className="student-info">
                      <div className="student-name">{student.first_name} {student.last_name}</div>
                      <div className="student-code">{student.admission_no}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        
        {/* Main Panel - Report Card */}
        <div className="main-panel">
          {!selectedStudent ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FileText size={32} color="#64748b" />
              </div>
              <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Select a Student</h3>
              <p>Choose a class and student from the left panel to view or create their report card</p>
            </div>
          ) : loading ? (
            <div className="empty-state">Loading report card...</div>
          ) : (
            <div className="report-card-view">
              <div className="report-header-bar">
                <div>
                  <h2 style={{ color: '#f8fafc', marginBottom: '0.25rem' }}>
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {selectedStudent.admission_no} | {selectedTerm} {academicYear}
                  </p>
                </div>
                <div className="report-actions">
                  {canCreateReportCards && (
                    <button className="btn btn-secondary" onClick={handleSaveReportCard} disabled={saving}>
                      <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={handlePrint}>
                    <Printer size={16} /> Print
                  </button>
                  <button className="btn btn-secondary" onClick={handleDownloadDoc}>
                    <Download size={16} /> Download DOC
                  </button>
                  {canCreateReportCards && reportData?.report_card_id && (
                    <button className="btn btn-primary" onClick={handleSendToStudent}>
                      <Send size={16} /> Send to Student
                    </button>
                  )}
                </div>
              </div>
              
              {/* Behavior Marks Edit */}
              {canCreateReportCards && (
                <div className="rc-section" style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    Behavior Marks (1-5)
                  </div>
                  <div className="behavior-edit-grid">
                    {BEHAVIOR_MARKS.map(mark => (
                      <div key={mark} className="behavior-edit-item">
                        <div className="behavior-edit-label">{mark}</div>
                        <select
                          className="behavior-select"
                          value={behaviorMarks[mark] || 3}
                          onChange={(e) => setBehaviorMarks({...behaviorMarks, [mark]: parseInt(e.target.value)})}
                        >
                          {[1,2,3,4,5].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label">Teacher's Comment</label>
                    <textarea
                      className="comment-textarea"
                      value={teacherComment}
                      onChange={(e) => setTeacherComment(e.target.value)}
                      placeholder="Enter teacher's comment..."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Principal's Comment</label>
                    <textarea
                      className="comment-textarea"
                      value={principalComment}
                      onChange={(e) => setPrincipalComment(e.target.value)}
                      placeholder="Enter principal's comment..."
                    />
                  </div>
                </div>
              )}
              
              {/* Printable Report Card */}
              <div ref={printRef}>
                <div className="report-card-print">
                  <div className="rc-header">
                    {schoolSettings.logo && (
                      <img 
                        src={schoolSettings.logo} 
                        alt="School Logo" 
                        style={{ maxWidth: '80px', maxHeight: '60px', marginBottom: '0.5rem', objectFit: 'contain' }} 
                      />
                    )}
                    <div className="rc-school-name">{schoolSettings.school_name}</div>
                    <div className="rc-school-subtitle">{schoolSettings.school_subtitle}</div>
                    <div className="rc-title">STUDENT REPORT CARD - {selectedTerm.toUpperCase()} {academicYear}</div>
                  </div>
                  
                  <div className="rc-student-info">
                    <div className="rc-info-item">
                      <div className="rc-info-label">Student Name</div>
                      <div className="rc-info-value">{selectedStudent.first_name} {selectedStudent.last_name}</div>
                    </div>
                    <div className="rc-info-item">
                      <div className="rc-info-label">Admission No.</div>
                      <div className="rc-info-value">{selectedStudent.admission_no}</div>
                    </div>
                    <div className="rc-info-item">
                      <div className="rc-info-label">Class</div>
                      <div className="rc-info-value">{selectedStudent.class_name}</div>
                    </div>
                    <div className="rc-info-item">
                      <div className="rc-info-label">Position</div>
                      <div className="rc-info-value">
                        {reportData?.position || '-'} / {reportData?.total_students || '-'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Grades Table */}
                  <table className="rc-grades-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Score</th>
                        <th>Grade</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData?.grades?.length > 0 ? (
                        reportData.grades.map((g, idx) => (
                          <tr key={idx}>
                            <td>{g.subject_name}</td>
                            <td>{g.score}</td>
                            <td>
                              <span className={`rc-grade-badge rc-grade-${g.grade}`}>{g.grade}</span>
                            </td>
                            <td>{g.remarks || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: '#666' }}>
                            No grades recorded for this term
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  
                  {/* Summary */}
                  <div className="rc-summary">
                    <div className="rc-summary-box">
                      <div className="rc-summary-value">{reportData?.grades?.length || 0}</div>
                      <div className="rc-summary-label">Subjects</div>
                    </div>
                    <div className="rc-summary-box">
                      <div className="rc-summary-value">{reportData?.total_score || 0}</div>
                      <div className="rc-summary-label">Total Score</div>
                    </div>
                    <div className="rc-summary-box">
                      <div className="rc-summary-value">{reportData?.average?.toFixed(1) || 0}</div>
                      <div className="rc-summary-label">Average</div>
                    </div>
                    <div className="rc-summary-box">
                      <div className="rc-summary-value">
                        <span className={`rc-grade-badge rc-grade-${reportData?.overall_grade || 'F'}`}>
                          {reportData?.overall_grade || '-'}
                        </span>
                      </div>
                      <div className="rc-summary-label">Overall</div>
                    </div>
                  </div>
                  
                  {/* Behavior Marks */}
                  <div className="rc-section">
                    <div className="rc-section-title">BEHAVIOR & CONDUCT</div>
                    <div className="rc-behavior-grid">
                      {BEHAVIOR_MARKS.map(mark => (
                        <div key={mark} className="rc-behavior-item">
                          <div className="rc-behavior-label">{mark}</div>
                          <div className="rc-stars">{renderStars(behaviorMarks[mark] || 3)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Comments */}
                  <div className="rc-section">
                    <div className="rc-section-title">COMMENTS</div>
                    <div className="rc-comment-box">
                      <div className="rc-comment-label">Teacher's Comment</div>
                      <div className="rc-comment-text">{teacherComment || 'No comment'}</div>
                    </div>
                    <div className="rc-comment-box">
                      <div className="rc-comment-label">Principal's Comment</div>
                      <div className="rc-comment-text">{principalComment || 'No comment'}</div>
                    </div>
                  </div>
                  
                  {/* Signatures */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
                    <div style={{ textAlign: 'center', width: '30%' }}>
                      <div style={{ borderTop: '1px solid #333', marginTop: '40px', paddingTop: '5px', fontSize: '0.7rem' }}>
                        Class Teacher
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', width: '30%' }}>
                      <div style={{ borderTop: '1px solid #333', marginTop: '40px', paddingTop: '5px', fontSize: '0.7rem' }}>
                        Principal
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', width: '30%' }}>
                      <div style={{ borderTop: '1px solid #333', marginTop: '40px', paddingTop: '5px', fontSize: '0.7rem' }}>
                        Parent/Guardian
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportCards;
