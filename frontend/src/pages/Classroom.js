import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { studentService } from '../services/studentService';
import { dataService } from '../services/dataService';
import { toast } from 'sonner';
import { 
  BookOpen, Plus, Search, X, CheckCircle, Clock, 
  FileText, Package, ClipboardCheck, PenTool, Users,
  Send, Eye, Check, Upload, Trash2, Edit2, Image, ExternalLink,
  Download
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
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'homework',
    class_name: '',
    subject_id: '',
    due_date: '',
    assigned_to: [], // Empty means entire class
    attachments: [] // File attachments (base64)
  });

  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [showTaskFormatMenu, setShowTaskFormatMenu] = useState(null);

  const handleDownloadTask = (task, format) => {
    setShowTaskFormatMenu(null);
    
    const fileName = `Task_${(task.title || 'Task').replace(/\s+/g, '_')}`;
    
    // Check if task has attachments
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
    
    // No attachments - generate summary
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
    
    // For image and PDF formats
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
      
      // Convert attachments to a format the backend can handle
      // Backend expects List[str] (URLs or file references)
      // We'll store base64 data inline for simplicity
      const processedAttachments = formData.attachments.map(att => {
        // For images, store as base64 data URI
        // For other files, store as base64 data URI
        return att.data; // Already a base64 data URI
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
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large (max 5MB)`);
          continue;
        }
        
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 
                             'application/pdf', 'application/msword', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`File ${file.name} type not allowed`);
          continue;
        }
        
        // Convert to base64
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

  return (
    <div className="classroom-page">
      <style>{`
        .classroom-page { padding: 1.5rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.75rem; }
        .page-title-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        
        .class-selector { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .class-select { padding: 0.75rem 1.5rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; font-weight: 500; }
        
        .task-type-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 768px) { .task-type-cards { grid-template-columns: repeat(2, 1fr); } }
        .type-card { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; padding: 1.25rem; cursor: pointer; transition: all 0.2s; }
        .type-card:hover { border-color: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }
        .type-card.active { border-color: var(--card-color); box-shadow: 0 0 0 1px var(--card-color); }
        .type-card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        .type-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .type-label { font-weight: 600; color: #f8fafc; }
        .type-count { font-size: 2rem; font-weight: 700; color: #f8fafc; }
        
        .panel { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; overflow: hidden; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
        .panel-title { font-size: 0.875rem; font-weight: 600; color: #94a3b8; }
        
        .tasks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; padding: 1rem; }
        .task-card { background: rgba(51, 65, 85, 0.3); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.75rem; padding: 1rem; transition: all 0.2s; cursor: pointer; }
        .task-card:hover { border-color: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }
        .task-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem; }
        .task-type-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; }
        .task-title { font-weight: 600; color: #f8fafc; font-size: 1rem; margin-bottom: 0.25rem; }
        .task-subject { font-size: 0.8rem; color: #64748b; }
        .task-description { color: #94a3b8; font-size: 0.8rem; margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .task-footer { display: flex; align-items: center; justify-content: space-between; }
        .task-due { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem; }
        .task-progress { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #22c55e; }
        
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
        .form-textarea { resize: vertical; min-height: 100px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        
        .task-type-selector { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
        .type-option { padding: 0.75rem; background: rgba(51, 65, 85, 0.3); border: 2px solid transparent; border-radius: 0.5rem; cursor: pointer; text-align: center; transition: all 0.2s; }
        .type-option:hover { background: rgba(51, 65, 85, 0.5); }
        .type-option.selected { border-color: var(--type-color); background: rgba(51, 65, 85, 0.5); }
        .type-option-label { font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }
        
        .completion-list { max-height: 400px; overflow-y: auto; }
        .completion-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-bottom: 1px solid rgba(51, 65, 85, 0.3); }
        .completion-item:last-child { border-bottom: none; }
        .student-info { display: flex; align-items: center; gap: 0.75rem; }
        .student-avatar { width: 32px; height: 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; font-size: 0.75rem; }
        .student-name { font-weight: 500; color: #f8fafc; font-size: 0.875rem; }
        .student-code { font-size: 0.7rem; color: #64748b; }
        .completion-status { display: flex; align-items: center; gap: 0.5rem; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; }
        .status-pending { background: #f59e0b; }
        .status-completed { background: #22c55e; }
        .mark-complete-btn { padding: 0.35rem 0.75rem; background: rgba(34, 197, 94, 0.2); border: none; border-radius: 0.25rem; color: #22c55e; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; }
        .mark-complete-btn:hover { background: rgba(34, 197, 94, 0.3); }
        
        .task-delete-btn { padding: 0.35rem; background: rgba(239, 68, 68, 0.1); border: none; border-radius: 0.25rem; color: #ef4444; cursor: pointer; }
        .task-delete-btn:hover { background: rgba(239, 68, 68, 0.2); }
        
        .task-attachments { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); }
        .attachment-count { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem; }
        
        .file-upload-area { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
        .attachments-list { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .attachment-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: rgba(59, 130, 246, 0.1); border-radius: 0.375rem; font-size: 0.8rem; }
        .attachment-name { flex: 1; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .attachment-remove { background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 0.25rem; }
        .attachment-remove:hover { color: #f87171; }
        
        .empty-state { text-align: center; padding: 3rem; color: #64748b; }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <BookOpen size={20} color="white" />
          </span>
          Classroom
        </h1>
        {canAssignTasks && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={16} /> Assign Task
          </button>
        )}
      </div>
      
      {/* Class Selector */}
      <div className="class-selector">
        <select
          className="class-select"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          {classes.map(cls => (
            <option key={cls.id} value={cls.name}>{cls.name}</option>
          ))}
        </select>
        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
          {students.length} students
        </span>
      </div>
      
      {/* Task Type Cards */}
      <div className="task-type-cards">
        {getTaskCounts().map(type => {
          const Icon = type.icon;
          return (
            <div
              key={type.value}
              className={`type-card ${filterType === type.value ? 'active' : ''}`}
              style={{ '--card-color': type.color }}
              onClick={() => setFilterType(filterType === type.value ? '' : type.value)}
            >
              <div className="type-card-header">
                <div className="type-icon" style={{ backgroundColor: `${type.color}20` }}>
                  <Icon size={20} color={type.color} />
                </div>
                <span className="type-label">{type.label}</span>
              </div>
              <div className="type-count" style={{ color: type.color }}>{type.count}</div>
            </div>
          );
        })}
      </div>
      
      {/* Tasks Panel */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            {filterType ? `${getTaskTypeInfo(filterType).label} Tasks` : 'All Tasks'} for {selectedClass}
          </span>
        </div>
        
        {loading ? (
          <div className="empty-state">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p>No tasks assigned yet</p>
            {canAssignTasks && <p style={{ fontSize: '0.875rem' }}>Click "Assign Task" to create one</p>}
          </div>
        ) : (
          <div className="tasks-grid">
            {tasks.map(task => {
              const typeInfo = getTaskTypeInfo(task.task_type);
              const Icon = typeInfo.icon;
              return (
                <div key={task.id} className="task-card">
                  <div className="task-header">
                    <div>
                      <span 
                        className="task-type-badge"
                        style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}
                      >
                        <Icon size={12} /> {typeInfo.label}
                      </span>
                    </div>
                    {canAssignTasks && (
                      <button 
                        className="task-delete-btn"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="task-title" onClick={() => handleViewTask(task)}>{task.title}</div>
                  <div className="task-subject">{task.subject_name}</div>
                  <div className="task-description">{task.description}</div>
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="task-attachments">
                      <span className="attachment-count">
                        <FileText size={12} /> {task.attachments.length} file(s) attached
                      </span>
                    </div>
                  )}
                  <div className="task-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {task.due_date && (
                        <div className="task-due">
                          <Clock size={12} /> Due: {task.due_date}
                        </div>
                      )}
                      <div className="task-progress">
                        <Users size={12} /> {task.assigned_to?.length || students.length}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowTaskFormatMenu(showTaskFormatMenu === task.id ? null : task.id); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.3rem 0.5rem',
                          background: 'rgba(14, 165, 233, 0.2)',
                          color: '#38bdf8',
                          border: '1px solid rgba(14, 165, 233, 0.3)',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.65rem'
                        }}
                      >
                        <Download size={10} /> Download ▾
                      </button>
                      {showTaskFormatMenu === task.id && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowTaskFormatMenu(null)} />
                          <div style={{
                            position: 'absolute', bottom: '100%', right: 0, marginBottom: '0.25rem',
                            background: '#1e293b', border: '1px solid rgba(51, 65, 85, 0.5)',
                            borderRadius: '0.5rem', overflow: 'hidden', zIndex: 20, minWidth: '160px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                          }}>
                            <div onClick={() => handleDownloadTask(task, 'docx')}
                              style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                              onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                              <FileText size={12} /> Word Document (.doc)
                            </div>
                            <div onClick={() => handleDownloadTask(task, 'pdf')}
                              style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                              onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                              <FileText size={12} /> PDF Document (.pdf)
                            </div>
                            <div onClick={() => handleDownloadTask(task, 'png')}
                              style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                              onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                              <Image size={12} /> PNG Image (.png)
                            </div>
                            <div onClick={() => handleDownloadTask(task, 'jpeg')}
                              style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                              onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                              <Image size={12} /> JPEG Image (.jpg)
                            </div>
                            <div onClick={() => handleDownloadTask(task, 'webp')}
                              style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                              onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                              <Image size={12} /> WebP Image (.webp)
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Create Task Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Assign New Task</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Type</label>
                  <div className="task-type-selector">
                    {TASK_TYPES.map(type => {
                      const Icon = type.icon;
                      return (
                        <div
                          key={type.value}
                          className={`type-option ${formData.task_type === type.value ? 'selected' : ''}`}
                          style={{ '--type-color': type.color }}
                          onClick={() => setFormData({...formData, task_type: type.value})}
                        >
                          <Icon size={20} color={type.color} />
                          <div className="type-option-label">{type.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="Enter task title"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    required
                    placeholder="Describe the task..."
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Class</label>
                    <select
                      className="form-select"
                      value={formData.class_name || selectedClass}
                      onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                    >
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <select
                      className="form-select"
                      value={formData.subject_id}
                      onChange={(e) => setFormData({...formData, subject_id: e.target.value})}
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  />
                </div>
                
                {/* File Upload Section */}
                <div className="form-group">
                  <label className="form-label">Attachments (Optional)</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                    >
                      {uploadingFile ? 'Uploading...' : (
                        <>
                          <Upload size={16} /> Upload Files
                        </>
                      )}
                    </button>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                      Images, PDF, DOC (max 5MB each)
                    </span>
                  </div>
                  
                  {formData.attachments.length > 0 && (
                    <div className="attachments-list">
                      {formData.attachments.map((file, index) => (
                        <div key={index} className="attachment-item">
                          {file.type.startsWith('image/') ? (
                            <Image size={14} />
                          ) : (
                            <FileText size={14} />
                          )}
                          <span className="attachment-name">{file.name}</span>
                          <button
                            type="button"
                            className="attachment-remove"
                            onClick={() => removeAttachment(index)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                  This task will be assigned to all students in {formData.class_name || selectedClass}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Send size={16} /> Assign Task
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
              <h2 className="modal-title">{selectedTask.title}</h2>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <span 
                  className="task-type-badge"
                  style={{ 
                    backgroundColor: `${getTaskTypeInfo(selectedTask.task_type).color}20`, 
                    color: getTaskTypeInfo(selectedTask.task_type).color 
                  }}
                >
                  {getTaskTypeInfo(selectedTask.task_type).label}
                </span>
                {selectedTask.subject_name && (
                  <span style={{ marginLeft: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                    {selectedTask.subject_name}
                  </span>
                )}
              </div>
              
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>{selectedTask.description}</p>
              
              {selectedTask.due_date && (
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Due: {selectedTask.due_date}
                </p>
              )}
              
              {/* Display attachments in view modal */}
              {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                <div style={{ 
                  marginBottom: '1rem',
                  padding: '0.75rem', 
                  background: 'rgba(59, 130, 246, 0.1)', 
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <FileText size={12} /> {selectedTask.attachments.length} attachment(s)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {selectedTask.attachments.map((att, idx) => {
                      if (typeof att === 'string' && att.startsWith('data:image/')) {
                        return (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img 
                              src={att} 
                              alt={`Attachment ${idx + 1}`}
                              style={{ 
                                width: '100px', 
                                height: '100px', 
                                objectFit: 'cover', 
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}
                              onClick={() => window.open(att, '_blank')}
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          background: 'rgba(51, 65, 85, 0.5)',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          color: '#94a3b8'
                        }}>
                          <FileText size={12} />
                          <span>File {idx + 1}</span>
                          <ExternalLink size={10} style={{ cursor: 'pointer' }} onClick={() => window.open(att, '_blank')} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                padding: '1rem', 
                background: 'rgba(51, 65, 85, 0.3)', 
                borderRadius: '0.5rem',
                marginBottom: '1rem'
              }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
                    {selectedTask.total_students}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>
                    {selectedTask.completed_count}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Completed</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
                    {selectedTask.total_students - selectedTask.completed_count}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Pending</div>
                </div>
              </div>
              
              <h4 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.75rem' }}>Student Progress</h4>
              <div className="completion-list">
                {selectedTask.completions?.map(comp => (
                  <div key={comp.id} className="completion-item">
                    <div className="student-info">
                      <div className="student-avatar">
                        {comp.student_name?.charAt(0)}
                      </div>
                      <div>
                        <div className="student-name">{comp.student_name}</div>
                        <div className="student-code">{comp.admission_no}</div>
                      </div>
                    </div>
                    <div className="completion-status">
                      {comp.status === 'completed' ? (
                        <>
                          <span className="status-indicator status-completed" />
                          <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>Completed</span>
                        </>
                      ) : (
                        <>
                          <span className="status-indicator status-pending" />
                          {canAssignTasks && (
                            <button 
                              className="mark-complete-btn"
                              onClick={() => handleMarkCompletion(comp.student_id, 'completed')}
                            >
                              <Check size={12} /> Mark Complete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Classroom;
