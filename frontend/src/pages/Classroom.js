import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { studentService } from '../services/studentService';

import { dataService } from '../services/dataService';
import { toast } from '../hooks/useSoundEnabledToast';
import { 
  BookOpen, Plus, X, Clock, 
  FileText, Package, ClipboardCheck, PenTool, Users, User,
  Send, Eye, Check, Upload, Trash2, Image, ExternalLink,
  Download, Printer, Calendar, Search, Filter, RefreshCw, Info
} from 'lucide-react';

import { API_URL } from '../config/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

const TASK_TYPES = [
  { value: 'homework', label: 'Homework', icon: FileText, color: '#8b5cf6' },
  { value: 'classwork', label: 'Classwork', icon: PenTool, color: '#3b82f6' },
  { value: 'package', label: 'Package', icon: Package, color: '#22c55e' },
  { value: 'test', label: 'Test', icon: ClipboardCheck, color: '#f59e0b' },
];

const TYPE_CLASS = {
  homework: 'homework',
  classwork: 'classwork',
  package: 'package',
  test: 'test',
};

function Classroom() {
  const currentUser = useSelector(selectCurrentUser);
  
  const [tasks, setTasks] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'homework',
    class_name: '',
    subject_id: '',
    due_date: '',
    assigned_to: [],
    attachments: []
  });

  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [showTaskFormatMenu, setShowTaskFormatMenu] = useState(null);

  const handleDownloadTask = (task, format) => {
    setShowTaskFormatMenu(null);
    
    const fileName = `Task_${(task.title || 'Task').replace(/\s+/g, '_')}`;
    
    const hasAttachments = task.attachments && task.attachments.length > 0;
    
    if (hasAttachments) {
      task.attachments.forEach((att, idx) => {
        if (typeof att === 'string') {
          if (att.startsWith('data:')) {
            const mimeMatch = att.match(/^data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const ext = mimeType.split('/')[1] || 'bin';
            const byteString = atob(att.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeType });
            const suffix = task.attachments.length > 1 ? `_${idx + 1}` : '';
            saveAs(blob, `${fileName}${suffix}.${ext}`);
          } else if (att.startsWith('http://') || att.startsWith('https://')) {
            const urlParts = att.split('/');
            const originalName = urlParts[urlParts.length - 1] || `file_${idx + 1}`;
            const suffix = task.attachments.length > 1 ? `_${idx + 1}` : '';
            fetch(att)
              .then(res => res.blob())
              .then(blob => saveAs(blob, `${fileName}${suffix}_${originalName}`))
              .catch(err => { console.error('Error fetching attachment:', err); window.open(att, '_blank'); });
          }
        }
      });
      toast.success(`Downloading ${task.attachments.length} attachment(s)`);
      return;
    }
    
    if (format === 'docx') {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Task - ${task.title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 0.5in; }
          h1 { font-size: 16pt; color: #0f4c81; text-align: center; }
          .header { text-align: center; border-bottom: 2px solid #0f4c81; padding-bottom: 10px; margin-bottom: 20px; }
          .section { margin: 15px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
          th { background: #0f4c81; color: white; }
          .footer { margin-top: 30px; text-align: center; font-size: 10pt; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
        </style>
        </head>
        <body>
          <div class="header"><h1>TASK DETAILS</h1><p>IHEZA School Management System</p></div>
          <div class="section">
            <table>
              <tr><td><strong>Title:</strong></td><td>${task.title || 'N/A'}</td></tr>
              <tr><td><strong>Type:</strong></td><td>${(task.task_type || 'N/A').toUpperCase()}</td></tr>
              <tr><td><strong>Subject:</strong></td><td>${task.subject_name || 'N/A'}</td></tr>
              <tr><td><strong>Class:</strong></td><td>${task.class_name || 'N/A'}</td></tr>
              <tr><td><strong>Given By:</strong></td><td>${task.assigned_by_name || 'N/A'}</td></tr>
              <tr><td><strong>Due Date:</strong></td><td>${task.due_date || 'N/A'}</td></tr>
            </table>
          </div>
          <div class="section"><h2>Description</h2><p>${task.description || 'No description provided.'}</p></div>
          <div class="footer"><p>Generated on: ${new Date().toLocaleDateString()}</p><p>IHEZA School Management System</p></div>
        </body>
        </html>
      `;
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.doc`;
      link.click();
      toast.success('Task downloaded as DOC');
      return;
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'background: white; color: #333; padding: 2rem; font-family: Times New Roman, serif; position: absolute; left: -9999px; top: 0; width: 600px;';
    tempDiv.innerHTML = `
      <div style="text-align:center;border-bottom:2px solid #0f4c81;padding-bottom:10px;margin-bottom:20px">
        <h1 style="font-size:16pt;color:#0f4c81;margin:0">TASK DETAILS</h1>
        <p style="font-size:10pt;color:#666">IHEZA School Management System</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:10px 0">
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Title:</td><td style="border:1px solid #333;padding:8px">${task.title || 'N/A'}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Type:</td><td style="border:1px solid #333;padding:8px">${(task.task_type || 'N/A').toUpperCase()}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Subject:</td><td style="border:1px solid #333;padding:8px">${task.subject_name || 'N/A'}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Class:</td><td style="border:1px solid #333;padding:8px">${task.class_name || 'N/A'}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Given By:</td><td style="border:1px solid #333;padding:8px">${task.assigned_by_name || 'N/A'}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Due Date:</td><td style="border:1px solid #333;padding:8px">${task.due_date || 'N/A'}</td></tr>
      </table>
      <div style="margin:15px 0"><h2 style="font-size:12pt;color:#0f4c81">Description</h2><p style="font-size:10pt">${task.description || 'No description provided.'}</p></div>
      <div style="margin-top:30px;text-align:center;font-size:9pt;color:#666;border-top:1px solid #ccc;padding-top:10px">
        <p>Generated on: ${new Date().toLocaleDateString()}</p><p>IHEZA School Management System</p>
      </div>
    `;
    document.body.appendChild(tempDiv);
    
    html2canvas(tempDiv, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    }).then(canvas => {
      document.body.removeChild(tempDiv);
      if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${fileName}.pdf`);
        toast.success('Task downloaded as PDF');
      } else if (format === 'png') {
        canvas.toBlob((blob) => { saveAs(blob, `${fileName}.png`); toast.success('Task downloaded as PNG'); }, 'image/png');
      } else if (format === 'jpeg') {
        canvas.toBlob((blob) => { saveAs(blob, `${fileName}.jpg`); toast.success('Task downloaded as JPEG'); }, 'image/jpeg', 0.95);
      } else if (format === 'webp') {
        canvas.toBlob((blob) => { saveAs(blob, `${fileName}.webp`); toast.success('Task downloaded as WebP'); }, 'image/webp', 0.95);
      }
    }).catch(error => {
      document.body.removeChild(tempDiv);
      console.error('Error capturing task:', error);
      toast.error('Failed to generate download');
    });
  };

  const canAssignTasks = ['teacher', 'academic', 'section_leader', 'principal', 'director', 'coordinator'].includes(currentUser?.role?.toLowerCase());

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadTasks();
      loadStudents();
    }
  }, [selectedClass, filterType]);

  const loadInitialData = async () => {
    try {
      const [classesData, subjectsData] = await Promise.all([
        dataService.getClasses(),
        dataService.getSubjects()
      ]);
      setClasses(classesData);
      setSubjects(subjectsData);
      
      if (classesData.length > 0) {
        setSelectedClass(classesData[0].name);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/student-tasks?class_name=${encodeURIComponent(selectedClass)}`;
      if (filterType) {
        url += `&task_type=${filterType}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const subject = subjects.find(s => s.id === formData.subject_id);
      
      const processedAttachments = formData.attachments.map(att => {
        return att.data;
      });
      
      const taskData = {
        ...formData,
        attachments: processedAttachments,
        subject_name: subject?.name || '',
        assigned_by: currentUser?.id,
        assigned_by_name: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim(),
        chain: currentUser?.chain
      };
      
      const response = await fetch(`${API_URL}/api/student-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      
      if (response.ok) {
        toast.success('Task assigned successfully');
        setShowModal(false);
        resetForm();
        loadTasks();
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Failed to create task:', errData);
        throw new Error(errData.detail || 'Failed to create task');
      }
    } catch (error) {
      console.error('Task creation error:', error);
      toast.error('Failed to assign task: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/student-tasks/${taskId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Task deleted successfully');
        loadTasks();
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploadingFile(true);
    
    try {
      const newAttachments = [];
      
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large (max 5MB)`);
          continue;
        }
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 
                             'application/pdf', 'application/msword', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`File ${file.name} type not allowed`);
          continue;
        }
        
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        newAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64
        });
      }
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments]
      }));
      
      if (newAttachments.length > 0) {
        toast.success(`${newAttachments.length} file(s) added`);
      }
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleViewTask = async (task) => {
    try {
      const response = await fetch(`${API_URL}/api/student-tasks/${task.id}`);
      const data = await response.json();
      setSelectedTask(data);
      setShowViewModal(true);
    } catch (error) {
      toast.error('Failed to load task details');
    }
  };

  const handleMarkCompletion = async (studentId, status) => {
    try {
      const response = await fetch(`${API_URL}/api/student-tasks/${selectedTask.id}/mark-completion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, status })
      });
      
      if (response.ok) {
        toast.success('Completion status updated');
        handleViewTask(selectedTask);
      }
    } catch (error) {
      toast.error('Failed to update completion');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      task_type: 'homework',
      class_name: selectedClass,
      subject_id: '',
      due_date: '',
      assigned_to: [],
      attachments: []
    });
  };

  const getTaskTypeInfo = (type) => TASK_TYPES.find(t => t.value === type) || TASK_TYPES[0];

  const getTaskCounts = () => {
    return TASK_TYPES.map(type => ({
      ...type,
      count: tasks.filter(t => t.task_type === type.value).length
    }));
  };

  const getProgress = (task) => {
    if (task.total_students && task.total_students > 0) {
      return Math.round(((task.completed_count || 0) / task.total_students) * 100);
    }
    return 0;
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSubject = !filterSubject || task.subject_name === filterSubject;
    const matchesSearch = !searchTerm || 
      task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assigned_by_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  const subjectOptions = [...new Set(tasks.map(t => t.subject_name).filter(Boolean))];

  const totalStudents = tasks.reduce((sum, t) => sum + (t.total_students || 0), 0);
  const totalCompleted = tasks.reduce((sum, t) => sum + (t.completed_count || 0), 0);
  const avgProgress = tasks.length > 0 ? Math.round((totalCompleted / totalStudents) * 100) : 0;

  return (
    <div className="classroom-page">
      <style>{`
        .classroom-page {
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
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.8rem;
        }
        .page-title { display: flex; align-items: center; gap: 0.6rem; }
        .page-title .icon-wrap {
          width: 38px; height: 38px;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 1rem;
          box-shadow: 0 4px 10px rgba(139, 92, 246, 0.25);
        }
        .page-title h1 { font-size: 1.3rem; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; }
        .page-title .sub { font-size: 0.8rem; color: #64748b; font-weight: 400; margin-left: 0.2rem; }
        .header-actions { display: flex; gap: 0.5rem; }

        .btn {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.4rem 1rem; border-radius: 8px;
          font-weight: 600; font-size: 0.8rem; border: none; cursor: pointer;
          transition: all 0.2s ease; font-family: 'Inter', sans-serif;
        }
        .btn-primary {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(139, 92, 246, 0.4); }
        .btn-outline { background: white; color: #475569; border: 1px solid #e2e8f0; }
        .btn-outline:hover { background: #f8fafc; border-color: #cbd5e1; }

        .stats-compact {
          display: flex; align-items: center; gap: 0.3rem 1.2rem; flex-wrap: wrap;
          background: white; padding: 0.3rem 1rem; border-radius: 10px;
          border: 1px solid #e2e8f0; margin-bottom: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .stats-compact .stat-item { display: flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.2rem; }
        .stats-compact .stat-item .icon {
          width: 28px; height: 28px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center; font-size: 0.75rem;
        }
        .stats-compact .stat-item .icon.purple { background: #ede9fe; color: #7c3aed; }
        .stats-compact .stat-item .icon.blue { background: #dbeafe; color: #2563eb; }
        .stats-compact .stat-item .icon.green { background: #d1fae5; color: #059669; }
        .stats-compact .stat-item .icon.orange { background: #fef3c7; color: #d97706; }
        .stats-compact .stat-item .num { font-size: 1.1rem; font-weight: 700; color: #0f172a; line-height: 1.2; }
        .stats-compact .stat-item .label { font-size: 0.6rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 500; }
        .stats-compact .divider { color: #e2e8f0; font-size: 0.8rem; }

        .filters-bar {
          display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
          background: white; padding: 0.4rem 0.8rem; border-radius: 10px;
          border: 1px solid #e2e8f0; margin-bottom: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .filters-bar .search-wrap { flex: 1; min-width: 160px; position: relative; }
        .filters-bar .search-wrap input {
          width: 100%; padding: 0.35rem 0.6rem 0.35rem 2rem;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px;
          color: #0f172a; font-size: 0.8rem; font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
        }
        .filters-bar .search-wrap input:focus {
          outline: none; border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }
        .filters-bar .search-wrap .search-icon {
          position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%);
          color: #94a3b8; font-size: 0.75rem;
        }
        .filters-bar select {
          padding: 0.35rem 0.7rem; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 7px;
          color: #0f172a; font-size: 0.8rem; font-family: 'Inter', sans-serif; cursor: pointer;
          min-width: 100px;
        }
        .filters-bar select:focus { outline: none; border-color: #8b5cf6; }
        .filters-bar .filter-label { font-size: 0.65rem; color: #64748b; font-weight: 500; }
        .filters-bar .result-count {
          font-size: 0.75rem; color: #64748b; margin-left: auto;
          display: flex; align-items: center; gap: 0.3rem;
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
          font-size: 0.65rem; letter-spacing: 0.4px; padding: 0.6rem 0.7rem;
          border-right: 1px solid #d0d7e2; border-bottom: 2px solid #b8c6d8;
          text-align: left; white-space: nowrap; position: sticky; top: 0; z-index: 10;
        }
        .excel-table thead th:last-child { border-right: none; }
        .excel-table tbody td {
          padding: 0.5rem 0.7rem; border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0; vertical-align: middle;
          color: #1e2f3f; background: white;
        }
        .excel-table tbody td:last-child { border-right: none; }
        .excel-table tbody tr:nth-child(even) td { background: #f8faff; }
        .excel-table tbody tr:hover td { background: #e8f0fe; }
        .excel-table .col-id { width: 40px; text-align: center; }
        .excel-table .col-name { min-width: 150px; font-weight: 600; color: #0f172a; }
        .excel-table .col-desc { min-width: 180px; }
        .excel-table .col-type { width: 100px; }
        .excel-table .col-subject { width: 110px; }
        .excel-table .col-class { width: 100px; }
        .excel-table .col-teacher { min-width: 140px; }
        .excel-table .col-due { width: 100px; }
        .excel-table .col-progress { width: 130px; }
        .excel-table .col-actions { width: 140px; }

        .type-badge { padding: 0.1rem 0.5rem; border-radius: 20px; font-size: 0.65rem; font-weight: 600; }
        .type-badge.homework { background: #ede9fe; color: #7c3aed; }
        .type-badge.classwork { background: #dbeafe; color: #2563eb; }
        .type-badge.package { background: #d1fae5; color: #059669; }
        .type-badge.test { background: #fef3c7; color: #d97706; }

        .subject-badge { padding: 0.1rem 0.4rem; border-radius: 12px; font-size: 0.65rem; font-weight: 500; background: #eef2f7; color: #4a5a6e; }

        .capacity-bar { display: flex; align-items: center; gap: 5px; }
        .capacity-bar .bar-track { width: 60px; height: 5px; background: #e2e8f0; border-radius: 10px; overflow: hidden; }
        .capacity-bar .bar-track .fill { height: 100%; border-radius: 10px; transition: width 0.3s ease; }
        .capacity-bar .fill.green { background: #10b981; }
        .capacity-bar .fill.orange { background: #f59e0b; }
        .capacity-bar .fill.red { background: #ef4444; }
        .capacity-bar .count { font-size: 0.75rem; font-weight: 600; color: #0f172a; min-width: 35px; }

        .teacher-cell { display: flex; align-items: center; gap: 5px; }
        .teacher-cell .avatar {
          width: 24px; height: 24px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 600; font-size: 0.6rem; color: white; flex-shrink: 0;
        }
        .teacher-cell .tname { font-size: 0.78rem; color: #0f172a; font-weight: 500; }
        .teacher-cell .tname.unassigned { color: #94a3b8; font-style: italic; }

        .due-cell { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #1e2f3f; }
        .due-cell .due-icon { color: #94a3b8; }

        .action-group { display: flex; gap: 0.25rem; flex-wrap: wrap; }
        .action-group .act-btn {
          display: inline-flex; align-items: center; gap: 2px;
          padding: 0.15rem 0.4rem; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 5px;
          color: #64748b; font-size: 0.6rem; font-weight: 500; cursor: pointer;
          transition: all 0.15s ease; font-family: 'Inter', sans-serif;
        }
        .action-group .act-btn:hover { background: #e2e8f0; color: #0f172a; }
        .action-group .act-btn.edit:hover { background: #ede9fe; color: #7c3aed; border-color: #c4b5fd; }
        .action-group .act-btn.delete:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
        .action-group .act-btn.view:hover { background: #dbeafe; color: #2563eb; border-color: #93c5fd; }
        .action-group .act-btn.download:hover { background: #d1fae5; color: #059669; border-color: #6ee7b7; }
        .action-group .act-btn.view-only { opacity: 0.5; cursor: default; }
        .action-group .act-btn.view-only:hover { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }

        .pagination-bar {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
          padding: 0.4rem 0.8rem; background: #f8faff;
          border-top: 1px solid #d0d7e2; border-radius: 0 0 12px 12px;
          font-size: 0.75rem; color: #1f3b5c;
        }
        .pagination-bar .info { color: #3f6490; font-size: 0.75rem; }
        .pagination-bar .pages { display: flex; gap: 0.15rem; }
        .pagination-bar .pages button {
          background: white; border: 1px solid #d0d7e2; padding: 0.15rem 0.6rem;
          border-radius: 5px; font-weight: 500; font-size: 0.7rem;
          color: #1f3b5c; cursor: pointer; transition: 0.1s;
        }
        .pagination-bar .pages button:hover { background: #eef3fa; }
        .pagination-bar .pages button.active { background: #7c3aed; color: white; border-color: #7c3aed; }
        .pagination-bar .pages button:disabled { opacity: 0.4; cursor: default; background: #f0f3f8; }

        .footer-note {
          margin-top: 1rem; text-align: center; color: #94a3b8; font-size: 0.7rem;
          border-top: 1px solid #e2e8f0; padding-top: 1rem;
        }

        .empty-state { text-align: center; padding: 3rem; color: #64748b; background: white; border-radius: 12px; border: 1px solid #d0d7e2; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1rem;
        }
        .modal {
          background: white; border-radius: 16px; width: 100%; max-width: 560px;
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
        .modal-body .form-group { margin-bottom: 0.8rem; }
        .modal-body .form-group label {
          display: block; font-size: 0.7rem; font-weight: 600; color: #475569;
          text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 0.2rem;
        }
        .modal-body .form-group input,
        .modal-body .form-group select,
        .modal-body .form-group textarea {
          width: 100%; padding: 0.5rem 0.8rem; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 10px; color: #0f172a;
          font-size: 0.85rem; font-family: 'Inter', sans-serif; transition: all 0.2s ease;
        }
        .modal-body .form-group input:focus,
        .modal-body .form-group select:focus,
        .modal-body .form-group textarea:focus {
          outline: none; border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }
        .modal-body .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
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

        .attachment-list { display: flex; flex-direction: column; gap: 0.4rem; }
        .attachment-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.4rem 0.6rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
        }
        .attachment-item .att-name { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #0f172a; }
        .attachment-remove { background: transparent; border: none; color: #b33a3a; cursor: pointer; padding: 0.25rem; }
        .attachment-remove:hover { color: #8a2a2a; }

        .completion-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto; }
        .completion-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: #f8faff; border: 1px solid #e2e8f0; border-radius: 0.5rem; }
        .student-info { display: flex; align-items: center; gap: 0.6rem; }
        .student-avatar { width: 32px; height: 32px; border-radius: 50%; background: #1a3b5d; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.8rem; }
        .student-name { font-size: 0.8rem; font-weight: 600; color: #0b2a44; }
        .student-code { font-size: 0.65rem; color: #6a8aa8; }
        .completion-status { display: flex; align-items: center; gap: 0.4rem; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .status-completed { background: #22c55e; }
        .status-pending { background: #f59e0b; }
        .mark-complete-btn { background: #1a3b5d; color: white; border: none; padding: 0.25rem 0.6rem; border-radius: 0.375rem; font-size: 0.7rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem; }
        .mark-complete-btn:hover { background: #12304b; }

        .task-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 1rem; }
        .task-detail-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem 0.7rem; }
        .task-detail-item .td-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.3px; color: #64748b; font-weight: 600; }
        .task-detail-item .td-value { font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-top: 0.1rem; }

        .download-menu { position: relative; }
        .download-menu .menu {
          position: absolute; right: 0; top: 100%; margin-top: 4px;
          background: white; border: 1px solid #e2e8f0; border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 0.3rem; z-index: 50; min-width: 150px;
        }
        .download-menu .menu button {
          display: flex; align-items: center; gap: 0.4rem; width: 100%;
          padding: 0.4rem 0.6rem; background: transparent; border: none; border-radius: 6px;
          font-size: 0.75rem; color: #1e2f3f; cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .download-menu .menu button:hover { background: #f1f5f9; }

        @media (max-width: 768px) {
          .classroom-page { padding: 0.8rem; }
          .page-title h1 { font-size: 1.1rem; }
          .page-title .sub { display: none; }
          .stats-compact { gap: 0.2rem 0.8rem; padding: 0.2rem 0.8rem; }
          .stats-compact .stat-item .num { font-size: 0.95rem; }
          .stats-compact .stat-item .label { font-size: 0.55rem; }
          .stats-compact .stat-item .icon { width: 24px; height: 24px; font-size: 0.65rem; }
          .filters-bar { flex-direction: column; align-items: stretch; }
          .filters-bar .search-wrap { min-width: unset; }
          .filters-bar select { min-width: unset; }
          .filters-bar .result-count { margin-left: 0; }
          .excel-table { min-width: 850px; font-size: 0.75rem; }
          .excel-table thead th,
          .excel-table tbody td { padding: 0.35rem 0.4rem; }
          .action-group .act-btn { font-size: 0.55rem; padding: 0.1rem 0.3rem; }
          .modal-body .form-row { grid-template-columns: 1fr; }
          .task-detail-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="app-wrapper">
        {/* HEADER */}
        <header className="page-header">
          <div className="page-title">
            <div className="icon-wrap"><BookOpen size={18} /></div>
            <div>
              <h1>Classroom <span className="sub">· Tasks</span></h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={loadTasks}>
              <RefreshCw size={14} /> Refresh
            </button>
            {canAssignTasks && (
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }} data-testid="add-task-btn">
                <Plus size={14} /> Assign Task
              </button>
            )}
          </div>
        </header>

        {/* STATS - COMPACT ONE LINE */}
        <div className="stats-compact">
          <span className="stat-item">
            <span className="icon purple"><BookOpen size={14} /></span>
            <span className="num">{tasks.length}</span>
            <span className="label">Tasks</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon blue"><Users size={14} /></span>
            <span className="num">{totalStudents}</span>
            <span className="label">Students</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon green"><Check size={14} /></span>
            <span className="num">{totalCompleted}</span>
            <span className="label">Completed</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon orange"><Clock size={14} /></span>
            <span className="num">{avgProgress}%</span>
            <span className="label">Progress</span>
          </span>
        </div>

        {/* FILTERS */}
        <div className="filters-bar">
          <div className="search-wrap">
            <Search className="search-icon" size={14} />
            <input
              type="text"
              placeholder="Search by task, teacher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="task-search"
            />
          </div>
          <span className="filter-label">Class</span>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} data-testid="class-select">
            {classes.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <span className="filter-label">Type</span>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} data-testid="type-filter">
            <option value="">All</option>
            {TASK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <span className="filter-label">Subject</span>
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">All</option>
            {subjectOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="result-count"><Filter size={12} /> {filteredTasks.length} results</span>
        </div>

        {/* EXCEL TABLE */}
        <div className="excel-container">
          <table className="excel-table">
            <thead>
              <tr>
                <th className="col-id">#</th>
                <th className="col-name">Task</th>
                <th className="col-type">Type</th>
                <th className="col-subject">Subject</th>
                <th className="col-class">Class</th>
                <th className="col-teacher">Given By</th>
                <th className="col-due">Due Date</th>
                <th className="col-progress">Progress</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading tasks...</td></tr>
              ) : filteredTasks.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No tasks found for this class.</td></tr>
              ) : (
                filteredTasks.map((task, index) => {
                  const typeInfo = getTaskTypeInfo(task.task_type);
                  const progress = getProgress(task);
                  const progressColor = progress >= 100 ? 'green' : progress >= 70 ? 'orange' : 'red';
                  return (
                    <tr key={task.id}>
                      <td className="col-id">{index + 1}</td>
                      <td className="col-name">{task.title}</td>
                      <td>
                        <span className={`type-badge ${task.task_type}`}>{typeInfo.label}</span>
                      </td>
                      <td>
                        <span className="subject-badge">{task.subject_name || '—'}</span>
                      </td>
                      <td>{task.class_name}</td>
                      <td>
                        <div className="teacher-cell">
                          <div className="avatar" style={{ background: `linear-gradient(135deg, ${typeInfo.color}, ${typeInfo.color}cc)` }}>
                            {(task.assigned_by_name || 'T').charAt(0)}
                          </div>
                          <span className="tname">{task.assigned_by_name || 'Not Assigned'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="due-cell">
                          <Calendar className="due-icon" size={12} />
                          {task.due_date || '—'}
                        </div>
                      </td>
                      <td>
                        <div className="capacity-bar">
                          <div className="bar-track"><div className={`fill ${progressColor}`} style={{ width: `${progress}%` }}></div></div>
                          <span className="count">{progress}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="action-group">
                          <button className="act-btn view" onClick={() => handleViewTask(task)} data-testid={`view-task-${task.id}`} title="View task details">
                            <Eye size={11} /> View
                          </button>
                          <div className="download-menu">
                            <button className="act-btn download" onClick={() => setShowTaskFormatMenu(showTaskFormatMenu === task.id ? null : task.id)} title="Download">
                              <Download size={11} /> DL
                            </button>
                            {showTaskFormatMenu === task.id && (
                              <div className="menu">
                                <button onClick={() => handleDownloadTask(task, 'pdf')}><Download size={12} /> PDF</button>
                                <button onClick={() => handleDownloadTask(task, 'docx')}><FileText size={12} /> DOC</button>
                                <button onClick={() => handleDownloadTask(task, 'png')}><Image size={12} /> PNG</button>
                                <button onClick={() => handleDownloadTask(task, 'jpeg')}><Image size={12} /> JPEG</button>
                                <button onClick={() => handleDownloadTask(task, 'webp')}><Image size={12} /> WebP</button>
                              </div>
                            )}
                          </div>
                          {canAssignTasks && (
                            <button className="act-btn delete" onClick={() => handleDeleteTask(task.id)} data-testid={`delete-task-${task.id}`} title="Delete task">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* PAGINATION */}
          <div className="pagination-bar">
            <span className="info"><Info size={12} /> {filteredTasks.length} records · page 1 of 1</span>
            <div className="pages">
              <button disabled><span>‹</span></button>
              <button className="active">1</button>
              <button disabled><span>›</span></button>
            </div>
          </div>
        </div>

      </div>


      {/* Assign Task Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2><Plus size={18} style={{ color: '#8b5cf6', marginRight: 6, verticalAlign: 'middle' }} /> Assign New Task</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Task Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    data-testid="task-title-input"
                    placeholder="e.g. Chapter 3 Exercises"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the task..."
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Task Type *</label>
                    <select
                      value={formData.task_type}
                      onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                      required
                    >
                      {TASK_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Subject *</label>
                    <select
                      value={formData.subject_id}
                      onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                      required
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Class *</label>
                    <select
                      value={formData.class_name}
                      onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                      required
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Attachments</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    style={{ padding: '0.4rem', fontSize: '0.75rem' }}
                  />
                  {uploadingFile && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>Uploading...</div>}
                  {formData.attachments.length > 0 && (
                    <div className="attachment-list" style={{ marginTop: '0.5rem' }}>
                      {formData.attachments.map((att, idx) => (
                        <div key={idx} className="attachment-item">
                          <span className="att-name"><FileText size={12} /> {att.name}</span>
                          <button type="button" className="attachment-remove" onClick={() => removeAttachment(idx)}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" data-testid="submit-task-btn">
                  <Send size={14} /> Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Task Modal */}
      {showViewModal && selectedTask && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2><Eye size={18} style={{ color: '#8b5cf6', marginRight: 6, verticalAlign: 'middle' }} /> Task Details</h2>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="task-detail-grid">
                <div className="task-detail-item">
                  <div className="td-label">Title</div>
                  <div className="td-value">{selectedTask.title}</div>
                </div>
                <div className="task-detail-item">
                  <div className="td-label">Type</div>
                  <div className="td-value">{getTaskTypeInfo(selectedTask.task_type).label}</div>
                </div>
                <div className="task-detail-item">
                  <div className="td-label">Subject</div>
                  <div className="td-value">{selectedTask.subject_name || '—'}</div>
                </div>
                <div className="task-detail-item">
                  <div className="td-label">Class</div>
                  <div className="td-value">{selectedTask.class_name}</div>
                </div>
                <div className="task-detail-item">
                  <div className="td-label">Given By</div>
                  <div className="td-value">{selectedTask.assigned_by_name || '—'}</div>
                </div>
                <div className="task-detail-item">
                  <div className="td-label">Due Date</div>
                  <div className="td-value">{selectedTask.due_date || '—'}</div>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <p style={{ fontSize: '0.85rem', color: '#1e2f3f', background: '#f8fafc', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {selectedTask.description || 'No description provided.'}
                </p>
              </div>
              {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                <div className="form-group">
                  <label>Attachments</label>
                  <div className="attachment-list">
                    {selectedTask.attachments.map((att, idx) => (
                      <div key={idx} className="attachment-item">
                        <span className="att-name"><FileText size={12} /> Attachment {idx + 1}</span>
                        <a href={att} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <ExternalLink size={12} /> Open
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Student Progress ({selectedTask.completed_count || 0}/{selectedTask.total_students || 0})</label>
                <div className="completion-list">
                  {(selectedTask.students || []).map(student => (
                    <div key={student.id} className="completion-item">
                      <div className="student-info">
                        <div className="student-avatar">{(student.name || 'S').charAt(0)}</div>
                        <div>
                          <div className="student-name">{student.name}</div>
                          <div className="student-code">{student.admission_number || student.student_code || ''}</div>
                        </div>
                      </div>
                      <div className="completion-status">
                        <span className={`status-indicator ${student.completed ? 'status-completed' : 'status-pending'}`}></span>
                        <span style={{ fontSize: '0.7rem', color: student.completed ? '#059669' : '#d97706', fontWeight: 600 }}>
                          {student.completed ? 'Completed' : 'Pending'}
                        </span>
                        {canAssignTasks && (
                          <button
                            className="mark-complete-btn"
                            onClick={() => handleMarkCompletion(student.id, !student.completed)}
                          >
                            <Check size={12} /> {student.completed ? 'Undo' : 'Mark'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowViewModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => handleDownloadTask(selectedTask, 'pdf')}>
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Classroom;

