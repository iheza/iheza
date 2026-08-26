import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectCurrentPortal } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { toast } from '../hooks/useSoundEnabledToast';
import { ClipboardList, Check, Clock, AlertCircle, X, Download, FileText, Image, Play, CheckCircle2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

const MyTasks = () => {
  const currentUser = useSelector(selectCurrentUser);
  const portal = useSelector(selectCurrentPortal);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [blinking, setBlinking] = useState(false);

  // Don't show for Student, IHEZA chains, Director, or Coordinator
  // Principals CAN receive tasks from directors/coordinators
  const shouldShow = !['student', 'director', 'coordinator'].includes(portal);


  const loadTasks = useCallback(async () => {
    if (!currentUser?.id) return;
    
    try {
      setLoading(true);
      // Query staff-tasks filtered by the current user's ID
      const response = await apiClient.get(`/staff-tasks?assigned_to=${currentUser.id}`);
      const myTasks = response.data || [];
      setTasks(myTasks);
      
      // Check for pending tasks to enable blinking
      const hasPendingTasks = myTasks.some(t => t.status === 'pending' || t.status === 'in_progress');
      setBlinking(hasPendingTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (shouldShow) {
      loadTasks();
      // Refresh tasks every 30 seconds
      const interval = setInterval(loadTasks, 30000);
      return () => clearInterval(interval);
    }
  }, [shouldShow, loadTasks]);

  // Blink effect every 5 seconds
  useEffect(() => {
    if (blinking) {
      const blinkInterval = setInterval(() => {
        setBlinking(prev => !prev);
        setTimeout(() => setBlinking(true), 500);
      }, 5000);
      return () => clearInterval(blinkInterval);
    }
  }, [blinking]);

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
              <tr><td><strong>Assigned By:</strong></td><td>${task.assigned_by_name || 'Principal'}</td></tr>
              <tr><td><strong>Due Date:</strong></td><td>${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</td></tr>
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
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Assigned By:</td><td style="border:1px solid #333;padding:8px">${task.assigned_by_name || 'Principal'}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Due Date:</td><td style="border:1px solid #333;padding:8px">${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</td></tr>
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

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await apiClient.put(`/staff-tasks/${taskId}`, { status: newStatus });
      toast.success(`Task marked as ${newStatus}`);
      loadTasks();
      setSelectedTask(null);
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  if (!shouldShow) return null;

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-default';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'in_progress': return 'status-in_progress';
      default: return 'status-pending';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <Check size={13} />;
      case 'in_progress': return <Clock size={13} />;
      default: return <AlertCircle size={13} />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      default: return 'Pending';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="my-tasks-page">
      <style>{`
        /* ===== PAGE BACKGROUND ===== */
        .my-tasks-page {
          padding: 2rem 1rem;
          max-width: 1400px;
          margin: 0 auto;
          background: #f3f6fa;
          min-height: 100vh;
        }

        /* ===== HEADER ===== */
        .tasks-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 0.5rem 1rem;
        }

        .tasks-header h1 {
          font-size: 1.8rem;
          font-weight: 600;
          color: #0f4c81;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .blink-indicator {
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          animation: blink 1s ease-in-out infinite;
          display: inline-block;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }

        .task-stats {
          display: flex;
          gap: 1.2rem;
          background: white;
          padding: 0.5rem 1.2rem;
          border-radius: 40px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          font-size: 0.9rem;
          font-weight: 500;
          color: #1e293b;
          align-items: center;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .stat-badge {
          background: #e9edf2;
          padding: 0.1rem 0.6rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #0f4c81;
        }

        .stat-badge.pending { background: #fee9e7; color: #b91c1c; }
        .stat-badge.in-progress { background: #fff3d6; color: #a16207; }
        .stat-badge.completed { background: #e0f2e6; color: #166534; }

        /* ===== SHEET CONTAINER ===== */
        .sheet-container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(0, 20, 40, 0.08);
          overflow: auto;
          border: 1px solid #e2e8f0;
        }

        /* ===== TABLE ===== */
        .task-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
          min-width: 780px;
        }

        .task-table th {
          background: #f8fafd;
          color: #1e3a5f;
          font-weight: 600;
          font-size: 0.8rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          padding: 0.9rem 0.8rem;
          border-bottom: 2px solid #dce3ec;
          text-align: left;
          white-space: nowrap;
        }

        .task-table td {
          padding: 0.7rem 0.8rem;
          border-bottom: 1px solid #e9edf4;
          vertical-align: middle;
          background-color: white;
          transition: background 0.1s;
        }

        .task-table tr:hover td {
          background-color: #f5f9ff;
        }

        .task-table tr:last-child td {
          border-bottom: none;
        }

        .task-title-cell {
          font-weight: 500;
          color: #1e293b;
          cursor: pointer;
        }

        .task-title-cell:hover {
          color: #0f4c81;
          text-decoration: underline;
        }

        /* ===== STATUS BADGE ===== */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.7rem;
          border-radius: 30px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .status-pending { background: #fee9e7; color: #b91c1c; }
        .status-in_progress { background: #fff3d6; color: #a16207; }
        .status-completed { background: #e0f2e6; color: #166534; }

        /* ===== PRIORITY CHIP ===== */
        .priority-chip {
          display: inline-block;
          padding: 0.15rem 0.7rem;
          border-radius: 40px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          color: white;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .priority-high { background: #b91c1c; }
        .priority-medium { background: #b45309; }
        .priority-low { background: #15803d; }
        .priority-default { background: #6b7280; }

        /* ===== ACTION BUTTONS ===== */
        .action-group {
          display: flex;
          gap: 0.3rem;
          flex-wrap: wrap;
        }

        .btn-icon {
          background: #f1f5f9;
          border: none;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
          transition: 0.15s;
          color: #2c3e5c;
          white-space: nowrap;
        }

        .btn-icon:hover { background: #dce3ec; }

        .btn-start { background: #fbbf24; color: #78350f; }
        .btn-start:hover { background: #f59e0b; }

        .btn-complete { background: #34d399; color: #064e3b; }
        .btn-complete:hover { background: #10b981; }

        .btn-download { background: #e0e9f5; color: #0f4c81; }
        .btn-download:hover { background: #cbd9eb; }

        /* ===== EMPTY STATE ===== */
        .empty-state {
          padding: 3rem 1.5rem;
          text-align: center;
          color: #6b7a8f;
        }

        /* ===== MODAL ===== */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 20px;
          padding: 1.5rem;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          border-bottom: 1px solid #edf2f7;
          padding-bottom: 1rem;
        }

        .modal-header h2 {
          color: #0f4c81;
          font-size: 1.125rem;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
          padding: 0.25rem;
          border-radius: 0.375rem;
        }

        .modal-close:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .task-detail {
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #edf2f7;
        }

        .task-detail:last-of-type {
          border-bottom: none;
        }

        .task-detail-label {
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .task-detail-value {
          font-size: 0.9rem;
          color: #1e293b;
        }

        .task-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .btn-action {
          flex: 1;
          padding: 0.625rem;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: 0.15s;
        }

        .btn-start {
          background: #fbbf24;
          color: #78350f;
        }

        .btn-start:hover {
          background: #f59e0b;
        }

        .btn-complete {
          background: #34d399;
          color: #064e3b;
        }

        .btn-complete:hover {
          background: #10b981;
        }

        /* Download dropdown menu */
        .download-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.25rem;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 0.5rem;
          overflow: hidden;
          z-index: 20;
          min-width: 160px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }

        .download-menu-item {
          padding: 0.5rem 0.8rem;
          cursor: pointer;
          color: #333;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          border-bottom: 1px solid #e0e0e0;
          transition: background 0.1s;
        }

        .download-menu-item:hover {
          background: #f0f4ff;
        }

        .download-menu-item:last-child {
          border-bottom: none;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
          .my-tasks-page {
            padding: 1rem 0.5rem;
          }
          
          .tasks-header h1 {
            font-size: 1.4rem;
          }
          
          .task-stats {
            font-size: 0.8rem;
            padding: 0.4rem 0.8rem;
            gap: 0.8rem;
          }
          
          .task-table {
            font-size: 0.8rem;
          }
        }
      `}</style>

      <div className="tasks-header">
        <h1>
          <ClipboardList size={28} />
          My Tasks
          {blinking && pendingTasks.length > 0 && <span className="blink-indicator" />}
        </h1>
        <div className="task-stats">
          <span className="stat-item">
            Pending <span className="stat-badge pending">{pendingTasks.length}</span>
          </span>
          <span className="stat-item">
            In Progress <span className="stat-badge in-progress">{inProgressTasks.length}</span>
          </span>
          <span className="stat-item">
            Completed <span className="stat-badge completed">{completedTasks.length}</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="sheet-container">
          <div className="empty-state">Loading tasks...</div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="sheet-container">
          <div className="empty-state">
            <ClipboardList size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No tasks assigned to you</p>
          </div>
        </div>
      ) : (
        <div className="sheet-container">
          <table className="task-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '28%' }}>Task</th>
                <th style={{ width: '10%' }}>Priority</th>
                <th style={{ width: '15%' }}>Assigned By</th>
                <th style={{ width: '13%' }}>Due Date</th>
                <th style={{ width: '14%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td>
                    <span className={`status-badge ${getStatusClass(task.status)}`}>
                      {getStatusIcon(task.status)}
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td>
                    <div className="task-title-cell" onClick={() => setSelectedTask(task)}>
                      {task.title}
                    </div>
                  </td>
                  <td>
                    <span className={`priority-chip ${getPriorityClass(task.priority)}`}>
                      {task.priority || 'medium'}
                    </span>
                  </td>
                  <td>{task.assigned_by_name || 'Principal'}</td>
                  <td>{formatDate(task.due_date)}</td>
                  <td>
                    <div className="action-group">
                      {task.status === 'pending' && (
                        <button className="btn-icon btn-start" onClick={() => updateTaskStatus(task.id, 'in_progress')}>
                          <Play size={12} /> Start
                        </button>
                      )}
                      {(task.status === 'pending' || task.status === 'in_progress') && (
                        <button className="btn-icon btn-complete" onClick={() => updateTaskStatus(task.id, 'completed')}>
                          <CheckCircle2 size={12} /> Complete
                        </button>
                      )}
                      <div style={{ position: 'relative' }}>
                        <button 
                          className="btn-icon btn-download"
                          onClick={(e) => { e.stopPropagation(); setShowTaskFormatMenu(showTaskFormatMenu === task.id ? null : task.id); }}
                        >
                          <Download size={12} /> Download ▾
                        </button>
                        {showTaskFormatMenu === task.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowTaskFormatMenu(null)} />
                            <div className="download-menu">
                              <div className="download-menu-item" onClick={() => handleDownloadTask(task, 'docx')}>
                                <FileText size={12} /> Word Document (.doc)
                              </div>
                              <div className="download-menu-item" onClick={() => handleDownloadTask(task, 'pdf')}>
                                <FileText size={12} /> PDF Document (.pdf)
                              </div>
                              <div className="download-menu-item" onClick={() => handleDownloadTask(task, 'png')}>
                                <Image size={12} /> PNG Image (.png)
                              </div>
                              <div className="download-menu-item" onClick={() => handleDownloadTask(task, 'jpeg')}>
                                <Image size={12} /> JPEG Image (.jpg)
                              </div>
                              <div className="download-menu-item" onClick={() => handleDownloadTask(task, 'webp')}>
                                <Image size={12} /> WebP Image (.webp)
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedTask.title}</h2>
                <span className={`priority-chip ${getPriorityClass(selectedTask.priority)}`} style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                  {selectedTask.priority} priority
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <button 
                    className="btn-icon btn-download"
                    onClick={(e) => { e.stopPropagation(); setShowTaskFormatMenu(showTaskFormatMenu === selectedTask.id ? null : selectedTask.id); }}
                  >
                    <Download size={14} /> Download ▾
                  </button>
                  {showTaskFormatMenu === selectedTask.id && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowTaskFormatMenu(null)} />
                      <div className="download-menu">
                        <div className="download-menu-item" onClick={() => handleDownloadTask(selectedTask, 'docx')}>
                          <FileText size={12} /> Word Document (.doc)
                        </div>
                        <div className="download-menu-item" onClick={() => handleDownloadTask(selectedTask, 'pdf')}>
                          <FileText size={12} /> PDF Document (.pdf)
                        </div>
                        <div className="download-menu-item" onClick={() => handleDownloadTask(selectedTask, 'png')}>
                          <Image size={12} /> PNG Image (.png)
                        </div>
                        <div className="download-menu-item" onClick={() => handleDownloadTask(selectedTask, 'jpeg')}>
                          <Image size={12} /> JPEG Image (.jpg)
                        </div>
                        <div className="download-menu-item" onClick={() => handleDownloadTask(selectedTask, 'webp')}>
                          <Image size={12} /> WebP Image (.webp)
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button className="modal-close" onClick={() => setSelectedTask(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {selectedTask.description && (
              <div className="task-detail">
                <div className="task-detail-label">Description</div>
                <div className="task-detail-value">{selectedTask.description}</div>
              </div>
            )}

            <div className="task-detail">
              <div className="task-detail-label">Assigned By</div>
              <div className="task-detail-value">{selectedTask.assigned_by_name || 'Principal'}</div>
            </div>

            {selectedTask.due_date && (
              <div className="task-detail">
                <div className="task-detail-label">Due Date</div>
                <div className="task-detail-value">{formatDate(selectedTask.due_date)}</div>
              </div>
            )}

            <div className="task-detail">
              <div className="task-detail-label">Status</div>
              <div className="task-detail-value" style={{ textTransform: 'capitalize' }}>
                {selectedTask.status.replace('_', ' ')}
              </div>
            </div>

            <div className="task-actions">
              {selectedTask.status === 'pending' && (
                <button className="btn-action btn-start" onClick={() => updateTaskStatus(selectedTask.id, 'in_progress')}>
                  <Clock size={16} /> Start Task
                </button>
              )}
              {(selectedTask.status === 'pending' || selectedTask.status === 'in_progress') && (
                <button className="btn-action btn-complete" onClick={() => updateTaskStatus(selectedTask.id, 'completed')}>
                  <Check size={16} /> Mark Complete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTasks;
