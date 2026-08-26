import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { staffService } from '../services/staffService';
import { toast } from '../hooks/useSoundEnabledToast';
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
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];

const PRIORITY_CLASS = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
};

const STATUS_CLASS = {
  pending: 'pending',
  in_progress: 'in_progress',
  completed: 'completed',
  overdue: 'overdue',
};


const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#ec4899,#db2777)',
  'linear-gradient(135deg,#8b5cf6,#7c3aed)',
  'linear-gradient(135deg,#06b6d4,#0891b2)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f43f5e,#e11d48)',
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
  const [filterStatus, setFilterStatus] = useState('');
  const [taskReport, setTaskReport] = useState(null);
  const [showTaskFormatMenu, setShowTaskFormatMenu] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    notes: ''
  });

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
    const matchesStatus = !filterStatus || task.status === filterStatus;
    const matchesStaff = !selectedStaff || task.assigned_to === selectedStaff;
    return matchesStatus && matchesStaff;
  });

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase();
  };

  const getAvatarGradient = (id) => {
    let hash = 0;
    const str = String(id || '');
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  };

  const getStatusShort = (status) => {
    const map = { pending: 'Pending', in_progress: 'In Prog.', completed: 'Completed', overdue: 'Overdue' };
    return map[status] || 'Pending';
  };

  const getPriorityLabel = (priority) => {
    const p = PRIORITY_OPTIONS.find(x => x.value === priority);
    return p ? p.label : 'Medium';
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return 'fa-check-circle';
    if (status === 'overdue') return 'fa-exclamation-triangle';
    return 'fa-clock';
  };

  const completionRate = taskReport?.completion_rate || 0;

  return (
    <div className="task-assignment-page">
      <style>{`
        .task-assignment-page {
          background: #eef2f7;
          font-family: 'Segoe UI', 'Arial', sans-serif;
          padding: 1.2rem 1rem;
          display: flex;
          justify-content: center;
          min-height: 100vh;
        }
        .excel-wrapper {
          max-width: 1400px;
          width: 100%;
          background: white;
          border-radius: 18px;
          box-shadow: 0 16px 32px -12px rgba(0, 20, 30, 0.18);
          padding: 1.2rem 1.2rem 1.5rem;
        }
        .excel-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1a3b5d;
          padding-bottom: 0.6rem;
          margin-bottom: 1rem;
        }
        .excel-header .title { display: flex; align-items: center; gap: 0.6rem; }
        .excel-header .title h1 { font-size: 1.3rem; font-weight: 600; color: #0b2a44; }
        .excel-header .title .badge { background: #dce5f0; padding: 0.1rem 0.8rem; border-radius: 40px; font-weight: 600; color: #1a3b5d; font-size: 0.7rem; }
        .excel-header .tools { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .excel-header .tools button {
          background: white; border: 1px solid #c7d6e8; border-radius: 30px; padding: 0.25rem 1rem;
          font-weight: 500; color: #1f3b5c; cursor: pointer; transition: 0.15s;
          display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem;
        }
        .excel-header .tools button:hover { background: #f2f6fc; border-color: #1a3b5d; }
        .excel-header .tools button.primary { background: #1a3b5d; color: white; border-color: #1a3b5d; }
        .excel-header .tools button.primary:hover { background: #12304b; }

        .stats-compact {
          display: flex; align-items: center; gap: 0.5rem 1.2rem; flex-wrap: wrap;
          background: #f8faff; padding: 0.25rem 1rem; border-radius: 40px;
          border: 1px solid #e2e8f0; margin-bottom: 0.8rem;
        }
        .stats-compact .stat-item { display: flex; align-items: baseline; gap: 0.2rem; padding: 0.1rem 0.3rem; }
        .stats-compact .stat-item .value { font-size: 1rem; font-weight: 700; color: #0b2a44; }
        .stats-compact .stat-item .value.green { color: #2d6a3e; }
        .stats-compact .stat-item .value.orange { color: #b87a2b; }
        .stats-compact .stat-item .value.blue { color: #1a4b7a; }
        .stats-compact .stat-item .label { font-size: 0.6rem; color: #6a8aa8; text-transform: uppercase; letter-spacing: 0.2px; font-weight: 500; }
        .stats-compact .stat-divider { color: #d0d7e2; font-size: 0.6rem; padding: 0 0.1rem; }

        .filter-row {
          display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; margin-bottom: 0.8rem;
          background: #f8faff; padding: 0.3rem 1rem; border-radius: 40px; border: 1px solid #e2e8f0;
        }
        .filter-row select {
          padding: 0.2rem 0.6rem; border-radius: 30px; border: 1px solid #d0d7e2; background: white;
          font-size: 0.7rem; color: #1f3b5c; outline: none; cursor: pointer;
        }
        .filter-row select:focus { border-color: #1a3b5d; }
        .filter-row .clear-btn { background: transparent; border: none; color: #3f6490; font-size: 0.7rem; cursor: pointer; padding: 0.1rem 0.5rem; border-radius: 20px; }
        .filter-row .clear-btn:hover { background: #e2eaf3; }
        .filter-row .stats-info { font-size: 0.7rem; color: #5a7a9a; margin-left: auto; }

        .excel-container { overflow-x: auto; border-radius: 12px; border: 1px solid #d0d7e2; background: white; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02); }
        .excel-table { width: 100%; border-collapse: collapse; font-family: 'Segoe UI', 'Arial', sans-serif; font-size: 0.78rem; min-width: 1000px; }
        .excel-table thead th {
          background: #e8edf4; color: #1f3b5c; font-weight: 600; text-transform: uppercase;
          font-size: 0.65rem; letter-spacing: 0.3px; padding: 0.4rem 0.5rem;
          border-right: 1px solid #d0d7e2; border-bottom: 2px solid #b8c6d8;
          text-align: left; white-space: nowrap; position: sticky; top: 0; z-index: 10;
        }
        .excel-table thead th:last-child { border-right: none; }
        .excel-table tbody td {
          padding: 0.3rem 0.5rem; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;
          vertical-align: middle; color: #1e2f3f; background: white;
        }
        .excel-table tbody td:last-child { border-right: none; }
        .excel-table tbody tr:nth-child(even) td { background: #f8faff; }
        .excel-table tbody tr:hover td { background: #e8f0fe; }

        .priority-badge { display: inline-block; padding: 0.05rem 0.5rem; border-radius: 30px; font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2px; }
        .priority-badge.low { background: #eef2f7; color: #4a5a6e; }
        .priority-badge.medium { background: #dbeafe; color: #1a4b7a; }
        .priority-badge.high { background: #fff3d6; color: #8a6d2b; }
        .priority-badge.urgent { background: #f8dddd; color: #8a3a3a; }

        .status-badge { display: inline-flex; align-items: center; gap: 3px; padding: 0.05rem 0.5rem; border-radius: 30px; font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2px; }
        .status-badge.pending { background: #eef2f7; color: #4a5a6e; }
        .status-badge.in_progress { background: #dbeafe; color: #1a4b7a; }
        .status-badge.completed { background: #dff0d8; color: #2d6a3e; }
        .status-badge.overdue { background: #f8dddd; color: #8a3a3a; }

        .assignee-cell { display: flex; align-items: center; gap: 6px; }
        .assignee-avatar { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; font-size: 0.6rem; flex-shrink: 0; }
        .assignee-info .name { font-weight: 500; color: #0b2a44; font-size: 0.75rem; }
        .assignee-info .role { font-size: 0.6rem; color: #6a8aa8; }

        .action-group { display: flex; gap: 0.2rem; flex-wrap: wrap; align-items: center; }
        .action-group button { background: transparent; border: none; padding: 0.15rem 0.3rem; border-radius: 4px; cursor: pointer; color: #3f6490; transition: 0.1s; font-size: 0.7rem; }
        .action-group button:hover { background: #dce5f0; color: #0b2a44; }
        .action-group button.danger:hover { background: #f8dddd; color: #b33a3a; }

        .status-select { padding: 0.1rem 0.3rem; background: white; border: 1px solid #d0d7e2; border-radius: 4px; font-size: 0.6rem; color: #1f3b5c; outline: none; cursor: pointer; }

        .download-wrap { position: relative; display: inline-block; }
        .download-btn { display: inline-flex; align-items: center; gap: 3px; padding: 0.15rem 0.4rem; background: rgba(14, 165, 233, 0.12); color: #1a5a8a; border: 1px solid rgba(14, 165, 233, 0.2); border-radius: 4px; cursor: pointer; font-size: 0.6rem; font-weight: 500; }
        .download-btn:hover { background: rgba(14, 165, 233, 0.2); }
        .download-menu { position: absolute; bottom: calc(100% + 4px); right: 0; background: white; border: 1px solid #d0d7e2; border-radius: 6px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12); min-width: 140px; z-index: 20; overflow: hidden; }
        .download-menu button { display: flex; align-items: center; gap: 6px; width: 100%; padding: 0.3rem 0.6rem; border: none; background: transparent; cursor: pointer; font-size: 0.7rem; color: #1f3b5c; text-align: left; border-bottom: 1px solid #f0f3f8; }
        .download-menu button:last-child { border-bottom: none; }
        .download-menu button:hover { background: #f2f6fc; }

        .pagination-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 0.4rem 0.8rem; background: #f8faff; border-top: 1px solid #d0d7e2; border-radius: 0 0 12px 12px; font-size: 0.75rem; color: #1f3b5c; }
        .pagination-bar .info { color: #3f6490; font-size: 0.7rem; }

        .excel-footer { margin-top: 0.8rem; font-size: 0.7rem; color: #5a7a9a; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 0.6rem; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal { background: white; border-radius: 14px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2); }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 2px solid #1a3b5d; }
        .modal-title { font-size: 1.05rem; font-weight: 600; color: #0b2a44; }
        .modal-close { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.4rem; font-size: 1.1rem; }
        .modal-close:hover { color: #0b2a44; }
        .modal-body { padding: 1.25rem; }
        .modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding: 1rem 1.25rem; border-top: 1px solid #e2e8f0; }

        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.7rem; font-weight: 600; color: #1f3b5c; margin-bottom: 0.4rem; text-transform: uppercase; }
        .form-input, .form-select, .form-textarea {
          width: 100%; padding: 0.5rem 0.7rem; border: 1px solid #d0d7e2; border-radius: 8px;
          font-size: 0.8rem; color: #1f3b5c; outline: none; background: white; transition: 0.15s;
        }
        .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #1a3b5d; box-shadow: 0 0 0 3px rgba(26, 59, 93, 0.1); }
        .form-textarea { min-height: 80px; resize: vertical; }
        .btn { padding: 0.5rem 1.1rem; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: 0.15s; }
        .btn-secondary { background: white; border-color: #c7d6e8; color: #1f3b5c; }
        .btn-secondary:hover { background: #f2f6fc; }
        .btn-primary { background: #1a3b5d; color: white; border-color: #1a3b5d; }
        .btn-primary:hover { background: #12304b; }
        .loading-state { text-align: center; padding: 3rem; color: #5a7a9a; font-size: 0.85rem; }
        .empty-state { text-align: center; padding: 3rem; color: #5a7a9a; font-size: 0.85rem; }
        .empty-state i { font-size: 2rem; color: #b8c6d8; margin-bottom: 0.5rem; display: block; }
        @media (max-width: 700px) {
          .task-assignment-page { padding: 0.6rem; }
          .excel-wrapper { padding: 0.8rem; }
          .excel-header .title h1 { font-size: 1rem; }
          .stats-compact { gap: 0.3rem 0.8rem; padding: 0.15rem 0.8rem; }
          .stats-compact .stat-item .value { font-size: 0.85rem; }
          .filter-row { flex-direction: column; align-items: stretch; border-radius: 20px; padding: 0.5rem 0.8rem; }
          .filter-row .stats-info { margin-left: 0; text-align: center; }
          .excel-table { font-size: 0.65rem; min-width: 750px; }
        }
      `}</style>

      <div className="excel-wrapper">
        {/* HEADER */}
        <div className="excel-header">
          <div className="title">
            <h1><i className="fas fa-table" style={{ color: '#1a3b5d', marginRight: 6 }}></i>Task Assignment</h1>
            <span className="badge"><i className="far fa-calendar-alt"></i> {new Date().getFullYear()}</span>
          </div>
          <div className="tools">
            <button onClick={handlePrintReport}><i className="fas fa-print"></i> Print</button>
            {canAssignTasks && (
              <button className="primary" onClick={() => { setEditingTask(null); resetForm(); setShowModal(true); }}>
                <i className="fas fa-plus"></i> Assign Task
              </button>
            )}
          </div>
        </div>

        {/* COMPACT STATS ROW */}
        <div className="stats-compact">
          <span className="stat-item">
            <span className="value">{taskReport?.total_tasks || tasks.length || 0}</span>
            <span className="label">Total Tasks</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="value green">{taskReport?.completed || 0}</span>
            <span className="label">Completed</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="value orange">{taskReport?.pending || 0}</span>
            <span className="label">Pending</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="value blue">{completionRate}%</span>
            <span className="label">Completion Rate</span>
          </span>
        </div>

        {/* FILTER ROW */}
        <div className="filter-row">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select value={selectedStaff || ''} onChange={(e) => setSelectedStaff(e.target.value || null)}>
            <option value="">All Staff</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>
          <button className="clear-btn" onClick={() => { setFilterStatus(''); setSelectedStaff(null); }}>
            <i className="fas fa-times-circle"></i> Clear
          </button>
          <span className="stats-info"><i className="fas fa-filter"></i> {filteredTasks.length} records</span>
        </div>

        {/* EXCEL TABLE */}
        <div className="excel-container">
          {loading ? (
            <div className="loading-state"><i className="fas fa-spinner fa-spin"></i> Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-inbox"></i>
              No tasks found
            </div>
          ) : (
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>#</th>
                  <th style={{ minWidth: 160 }}>Task</th>
                  <th style={{ minWidth: 130 }}>Assignee</th>
                  <th style={{ width: 80 }}>Priority</th>
                  <th style={{ width: 95 }}>Status</th>
                  <th style={{ width: 90 }}>Due Date</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task, index) => (
                  <tr key={task.id || task._id || index}>
                    <td style={{ textAlign: 'center', color: '#7a92b0' }}>{index + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0b2a44' }}>{task.title}</div>
                      <div style={{ fontSize: '0.65rem', color: '#6a8aa8' }}>{task.description}</div>
                    </td>
                    <td>
                      <div className="assignee-cell">
                        <div className="assignee-avatar" style={{ background: getAvatarGradient(task.assigned_to) }}>
                          {getInitials(task.assigned_to_name)}
                        </div>
                        <div className="assignee-info">
                          <div className="name">{task.assigned_to_name || 'Unassigned'}</div>
                          <div className="role">{task.assigned_to_role || 'Staff'}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`priority-badge ${PRIORITY_CLASS[task.priority] || 'medium'}`}>{getPriorityLabel(task.priority)}</span></td>
                    <td><span className={`status-badge ${STATUS_CLASS[task.status] || 'pending'}`}><i className={`fas ${getStatusIcon(task.status)}`}></i> {getStatusShort(task.status)}</span></td>
                    <td style={{ fontSize: '0.7rem', color: task.status === 'overdue' ? '#b33a3a' : '#3f6490' }}>{task.due_date || 'No deadline'}</td>
                    <td>
                      <div className="action-group">
                        <div className="download-wrap">
                          <button className="download-btn" onClick={() => setShowTaskFormatMenu(showTaskFormatMenu === task.id ? null : task.id)}>
                            <i className="fas fa-download"></i> ▾
                          </button>
                          {showTaskFormatMenu === task.id && (
                            <div className="download-menu">
                              <button onClick={() => handleDownloadTask(task, 'docx')}><i className="fas fa-file-word"></i> Word (.doc)</button>
                              <button onClick={() => handleDownloadTask(task, 'pdf')}><i className="fas fa-file-pdf"></i> PDF</button>
                              <button onClick={() => handleDownloadTask(task, 'png')}><i className="fas fa-image"></i> PNG</button>
                              <button onClick={() => handleDownloadTask(task, 'jpeg')}><i className="fas fa-image"></i> JPEG</button>
                              <button onClick={() => handleDownloadTask(task, 'webp')}><i className="fas fa-image"></i> WebP</button>
                            </div>
                          )}
                        </div>
                        <select
                          className="status-select"
                          value={task.status || 'pending'}
                          onChange={(e) => handleUpdateTask(task.id || task._id, { status: e.target.value })}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <button title="Edit" onClick={() => handleEdit(task)}><i className="fas fa-pen"></i></button>
                        <button title="Delete" className="danger" onClick={() => handleDeleteTask(task.id || task._id)}><i className="fas fa-trash-alt"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* PAGINATION */}
          <div className="pagination-bar">
            <span className="info"><i className="fas fa-info-circle"></i> {filteredTasks.length} records · page 1 of 1</span>
          </div>
        </div>

        <div className="excel-footer">
          <i className="fas fa-file-excel" style={{ color: '#1f7c3a' }}></i> Excel-style grid ·
          <i className="fas fa-download"></i> download · <i className="fas fa-pen"></i> edit · <i className="fas fa-trash-alt"></i> delete
        </div>
      </div>

      {/* ASSIGN/EDIT TASK MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fas fa-tasks" style={{ color: '#1a3b5d', marginRight: 6 }}></i>
                {editingTask ? 'Edit Task' : 'Assign Task'}
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={editingTask ? (e) => { e.preventDefault(); handleUpdateTask(editingTask.id || editingTask._id, formData); setShowModal(false); } : handleCreateTask}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Title</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    placeholder="Enter task title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe the task"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign To</label>
                  <select
                    className="form-select"
                    required
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  >
                    <option value="">Select staff member</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Additional notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <i className="fas fa-check"></i> {editingTask ? 'Save Changes' : 'Assign Task'}
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

