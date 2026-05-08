import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { staffService } from '../services/staffService';
import { toast } from 'sonner';
import { 
  ClipboardList, Plus, Search, Edit2, Trash2, X, 
  CheckCircle, Clock, AlertTriangle, User, Download,
  Printer, FileText, Calendar, Image
} from 'lucide-react';
import { apiClient } from '../services/authService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#94a3b8' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: '#94a3b8' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: '#3b82f6' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: '#22c55e' },
  { value: 'overdue', label: 'Overdue', icon: AlertTriangle, color: '#ef4444' },
];

function TaskAssignment() {
  const currentUser = useSelector(selectCurrentUser);
  const printRef = useRef(null);
  
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [taskReport, setTaskReport] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    notes: ''
  });

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
              <tr><td><strong>Priority:</strong></td><td>${(task.priority || 'N/A').toUpperCase()}</td></tr>
              <tr><td><strong>Assigned To:</strong></td><td>${task.assigned_to_name || 'N/A'}</td></tr>
              <tr><td><strong>Due Date:</strong></td><td>${task.due_date || 'N/A'}</td></tr>
              <tr><td><strong>Status:</strong></td><td>${(task.status || 'pending').replace('_', ' ').toUpperCase()}</td></tr>
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
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Priority:</td><td style="border:1px solid #333;padding:8px">${(task.priority || 'N/A').toUpperCase()}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Assigned To:</td><td style="border:1px solid #333;padding:8px">${task.assigned_to_name || 'N/A'}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Due Date:</td><td style="border:1px solid #333;padding:8px">${task.due_date || 'N/A'}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Status:</td><td style="border:1px solid #333;padding:8px">${(task.status || 'pending').replace('_', ' ').toUpperCase()}</td></tr>
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

  const canAssignTasks = ['principal', 'director', 'coordinator'].includes(currentUser?.role?.toLowerCase());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, staffData, reportRes] = await Promise.all([
        apiClient.get('/staff-tasks').then(r => r.data),
        staffService.getStaff(),
        apiClient.get('/staff-tasks/report').then(r => r.data)
      ]);
      setTasks(tasksRes);
      setStaff(staffData);
      setTaskReport(reportRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const staffMember = staff.find(s => s.id === formData.assigned_to);
      
      const taskData = {
        ...formData,
        assigned_to_name: staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Unknown',
        assigned_to_role: staffMember?.role || 'Unknown',
        assigned_by: currentUser?.id,
        assigned_by_name: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim(),
        chain: currentUser?.chain,
        status: 'pending'
      };
      
      const response = await apiClient.post('/staff-tasks', taskData);
      
      if (response.status === 200 || response.status === 201) {
        toast.success('Task assigned successfully');
        setShowModal(false);
        resetForm();
        loadData();
      } else {
        throw new Error('Failed to create task');
      }
    } catch (error) {
      toast.error('Failed to assign task');
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const response = await apiClient.put(`/staff-tasks/${taskId}`, updates);
      
      if (response.status === 200) {
        toast.success('Task updated');
        loadData();
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    
    try {
      const response = await apiClient.delete(`/staff-tasks/${taskId}`);
      
      if (response.status === 200) {
        toast.success('Task deleted');
        loadData();
      }
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '', notes: '' });
    setEditingTask(null);
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
      priority: task.priority,
      due_date: task.due_date || '',
      notes: task.notes || ''
    });
    setShowModal(true);
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Staff Tasks Report</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #0f4c81; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 18px; font-weight: bold; color: #0f4c81; }
            .subtitle { font-size: 12px; color: #666; margin-top: 5px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
            .stat-box { text-align: center; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #0f4c81; }
            .stat-label { font-size: 10px; color: #666; text-transform: uppercase; }
            .section-title { font-size: 12px; font-weight: bold; background: #e0e0e0; padding: 8px; margin: 15px 0 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
            th { background: #0f4c81; color: white; }
            .priority-badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 500; }
            .status-badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 500; }
            .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">IHEZA - Staff Tasks Report</div>
            <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</div>
          </div>
          
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${taskReport?.total_tasks || 0}</div>
              <div class="stat-label">Total Tasks</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #22c55e">${taskReport?.completed || 0}</div>
              <div class="stat-label">Completed</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #f59e0b">${taskReport?.pending || 0}</div>
              <div class="stat-label">Pending</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${taskReport?.completion_rate || 0}%</div>
              <div class="stat-label">Completion Rate</div>
            </div>
          </div>
          
          <div class="section-title">TASK LIST</div>
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assigned To</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(task => `
                <tr>
                  <td><strong>${task.title}</strong><br/>${task.description?.substring(0, 50) || ''}</td>
                  <td>${task.assigned_to_name}<br/><small>${task.assigned_to_role}</small></td>
                  <td>${task.priority}</td>
                  <td>${task.due_date || 'No deadline'}</td>
                  <td>${task.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            IHEZA School Management System | Confidential
          </div>
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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.assigned_to_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || task.status === filterStatus;
    const matchesStaff = !selectedStaff || task.assigned_to === selectedStaff;
    return matchesSearch && matchesStatus && matchesStaff;
  });

  const getPriorityColor = (priority) => PRIORITY_OPTIONS.find(p => p.value === priority)?.color || '#94a3b8';
  const getStatusInfo = (status) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  return (
    <div className="task-assignment-page">
      <style>{`
        .task-assignment-page { padding: 1.5rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.75rem; }
        .page-title-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .header-actions { display: flex; gap: 0.5rem; }
        
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 768px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
        .stat-card { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; padding: 1.25rem; text-align: center; }
        .stat-value { font-size: 2rem; font-weight: 700; color: #f8fafc; }
        .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin-top: 0.25rem; }
        
        .content-grid { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; }
        @media (max-width: 1024px) { .content-grid { grid-template-columns: 1fr; } }
        
        .sidebar-panel { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; padding: 1rem; height: fit-content; }
        .panel-title { font-size: 0.875rem; font-weight: 600; color: #94a3b8; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
        
        .staff-list { max-height: 400px; overflow-y: auto; }
        .staff-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; margin-bottom: 0.5rem; }
        .staff-item:hover { background: rgba(51, 65, 85, 0.5); }
        .staff-item.selected { background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.5); }
        .staff-avatar { width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; font-size: 0.875rem; }
        .staff-info { flex: 1; }
        .staff-name { font-weight: 500; color: #f8fafc; font-size: 0.875rem; }
        .staff-role { font-size: 0.7rem; color: #64748b; text-transform: capitalize; }
        .staff-task-count { font-size: 0.75rem; color: #f59e0b; font-weight: 600; }
        
        .main-panel { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; overflow: hidden; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
        
        .filters-row { display: flex; gap: 1rem; flex-wrap: wrap; }
        .search-box { position: relative; flex: 1; min-width: 200px; }
        .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #64748b; }
        .search-input { width: 100%; padding: 0.75rem 0.75rem 0.75rem 2.5rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        .filter-select { padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        
        .tasks-list { padding: 1rem; }
        .task-card { background: rgba(51, 65, 85, 0.3); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.75rem; padding: 1rem; margin-bottom: 0.75rem; }
        .task-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.5rem; }
        .task-title { font-weight: 600; color: #f8fafc; font-size: 1rem; }
        .task-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .task-description { color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.75rem; }
        .task-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
        .task-assignee { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #64748b; }
        .task-actions { display: flex; gap: 0.5rem; }
        
        .priority-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; text-transform: uppercase; }
        .status-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; }
        .due-date { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem; }
        
        .action-btn { padding: 0.5rem; background: rgba(51, 65, 85, 0.5); border: none; border-radius: 0.5rem; color: #94a3b8; cursor: pointer; transition: all 0.2s; }
        .action-btn:hover { background: rgba(51, 65, 85, 0.8); color: #f8fafc; }
        .action-btn.edit:hover { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
        .action-btn.delete:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .action-btn.complete:hover { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        
        .status-select { padding: 0.35rem 0.5rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.25rem; color: #f8fafc; font-size: 0.75rem; cursor: pointer; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal { background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
        .modal-title { font-size: 1.125rem; font-weight: 600; color: #f8fafc; }
        .modal-close { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.5rem; }
        .modal-body { padding: 1.25rem; }
        .modal-footer { display: flex; gap: 1rem; justify-content: flex-end; padding: 1.25rem; border-top: 1px solid rgba(51, 65, 85, 0.5); }
        
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.75rem; font-weight: 500; color: #94a3b8; margin-bottom: 0.5rem; text-transform: uppercase; }
        .form-input, .form-select, .form-textarea { width: 100%; padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        .form-textarea { resize: vertical; min-height: 80px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        
        .empty-state { text-align: center; padding: 3rem; color: #64748b; }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <ClipboardList size={20} color="white" />
          </span>
          Task Assignment
        </h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handlePrintReport}>
            <Printer size={16} /> Print Report
          </button>
          {canAssignTasks && (
            <button className="btn btn-warning" onClick={() => { resetForm(); setShowModal(true); }}>
              <Plus size={16} /> Assign Task
            </button>
          )}
        </div>
      </div>
      
      {/* Stats Row */}
      {taskReport && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{taskReport.total_tasks}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#22c55e' }}>{taskReport.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{taskReport.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{taskReport.completion_rate}%</div>
            <div className="stat-label">Completion Rate</div>
          </div>
        </div>
      )}
      
      <div className="content-grid">
        {/* Sidebar - Staff List */}
        <div className="sidebar-panel">
          <div className="panel-title">
            <User size={16} /> Staff Members
          </div>
          <div 
            className={`staff-item ${!selectedStaff ? 'selected' : ''}`}
            onClick={() => setSelectedStaff(null)}
          >
            <div className="staff-avatar" style={{ background: '#64748b' }}>A</div>
            <div className="staff-info">
              <div className="staff-name">All Staff</div>
              <div className="staff-role">View all tasks</div>
            </div>
            <div className="staff-task-count">{tasks.length}</div>
          </div>
          <div className="staff-list">
            {staff.filter(s => s.role !== 'student').map(member => {
              const memberTasks = tasks.filter(t => t.assigned_to === member.id);
              return (
                <div
                  key={member.id}
                  className={`staff-item ${selectedStaff === member.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStaff(member.id)}
                >
                  <div className="staff-avatar">
                    {member.first_name?.charAt(0)}
                  </div>
                  <div className="staff-info">
                    <div className="staff-name">{member.first_name} {member.last_name}</div>
                    <div className="staff-role">{member.role}</div>
                  </div>
                  <div className="staff-task-count">{memberTasks.length}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Main Panel - Tasks */}
        <div className="main-panel">
          <div className="panel-header">
            <div className="filters-row">
              <div className="search-box">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="tasks-list">
            {loading ? (
              <div className="empty-state">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="empty-state">
                <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p>No tasks found</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const statusInfo = getStatusInfo(task.status);
                return (
                  <div key={task.id} className="task-card">
                    <div className="task-header">
                      <div>
                        <div className="task-title">{task.title}</div>
                        <div className="task-meta">
                          <span 
                            className="priority-badge"
                            style={{ backgroundColor: `${getPriorityColor(task.priority)}20`, color: getPriorityColor(task.priority) }}
                          >
                            {task.priority}
                          </span>
                          <span 
                            className="status-badge"
                            style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}
                          >
                            <statusInfo.icon size={12} />
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>
                      {task.due_date && (
                        <div className="due-date">
                          <Calendar size={12} /> {task.due_date}
                        </div>
                      )}
                    </div>
                    <div className="task-description">{task.description}</div>
                    <div className="task-footer">
                      <div className="task-assignee">
                        <User size={14} />
                        <span>{task.assigned_to_name}</span>
                        <span style={{ color: '#64748b' }}>({task.assigned_to_role})</span>
                      </div>
                      <div className="task-actions">
                        <div style={{ position: 'relative' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowTaskFormatMenu(showTaskFormatMenu === task.id ? null : task.id); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.4rem 0.6rem',
                              background: 'rgba(14, 165, 233, 0.2)',
                              color: '#38bdf8',
                              border: '1px solid rgba(14, 165, 233, 0.3)',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              fontSize: '0.7rem'
                            }}
                          >
                            <Download size={12} /> Download ▾
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
                        <select
                          className="status-select"
                          value={task.status}
                          onChange={(e) => handleUpdateTask(task.id, { status: e.target.value })}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        {canAssignTasks && (
                          <>
                            <button className="action-btn edit" onClick={() => handleEdit(task)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="action-btn delete" onClick={() => handleDeleteTask(task.id)}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      
      {/* Create/Edit Task Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTask ? 'Edit Task' : 'Assign New Task'}
              </h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Title *</label>
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
                
                <div className="form-group">
                  <label className="form-label">Assign To *</label>
                  <select
                    className="form-select"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                    required
                  >
                    <option value="">Select Staff Member</option>
                    {staff.filter(s => s.role !== 'student' && s.role !== 'principal' && s.role !== 'director' && s.role !== 'coordinator').map(member => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name} ({member.role})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-select"
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
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
                </div>
                
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-warning">
                  {editingTask ? 'Update Task' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskAssignment;
