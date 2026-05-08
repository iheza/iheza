import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectCurrentPortal } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { toast } from 'sonner';
import { ClipboardList, Check, Clock, AlertCircle, X, ChevronRight, Download, FileText, Image } from 'lucide-react';
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

  // Don't show for Student, IHEZA chains, or Principal (who assigns tasks)
  const shouldShow = !['student', 'director', 'coordinator', 'principal'].includes(portal);

  const loadTasks = useCallback(async () => {
    if (!currentUser?.id) return;
    
    try {
      setLoading(true);
      const response = await apiClient.get(`/tasks/my-tasks`);
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
      await apiClient.put(`/tasks/${taskId}`, { status: newStatus });
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
  const completedTasks = tasks.filter(t => t.status === 'completed').slice(0, 5);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#64748b';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <Check size={14} color="#22c55e" />;
      case 'in_progress': return <Clock size={14} color="#f59e0b" />;
      default: return <AlertCircle size={14} color="#ef4444" />;
    }
  };

  return (
    <div className="my-tasks-page">
      <style>{`
        .my-tasks-page {
          padding: 1rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .tasks-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }

        .tasks-header h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f4c81;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .blink-indicator {
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }

        .tasks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .tasks-section {
          background: white;
          border-radius: 1rem;
          padding: 1.25rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .section-title {
          font-size: 1rem;
          font-weight: 600;
          color: #0f4c81;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .task-count {
          background: #0f4c81;
          color: white;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
        }

        .task-item {
          padding: 0.875rem;
          background: #f8fafc;
          border-radius: 0.5rem;
          margin-bottom: 0.75rem;
          border-left: 3px solid;
          cursor: pointer;
          transition: all 0.2s;
        }

        .task-item:hover {
          background: #e3f2fd;
          transform: translateX(4px);
        }

        .task-item.pending { border-left-color: #ef4444; }
        .task-item.in_progress { border-left-color: #f59e0b; }
        .task-item.completed { border-left-color: #22c55e; opacity: 0.7; }

        .task-title {
          font-weight: 600;
          color: #1e293b;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .task-meta {
          display: flex;
          gap: 0.75rem;
          font-size: 0.75rem;
          color: #64748b;
        }

        .priority-badge {
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.65rem;
          font-weight: 600;
          color: white;
        }

        .task-description {
          margin-top: 0.5rem;
          font-size: 0.8rem;
          color: #475569;
          line-height: 1.4;
        }

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
          border-radius: 1rem;
          padding: 1.5rem;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
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
        }

        .task-detail {
          margin-bottom: 1rem;
        }

        .task-detail-label {
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 0.25rem;
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
        }

        .btn-start {
          background: #f59e0b;
          color: white;
        }

        .btn-complete {
          background: #22c55e;
          color: white;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #64748b;
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .my-tasks-page {
            padding: 0.75rem;
          }
          
          .tasks-header h1 {
            font-size: 1.25rem;
          }
          
          .task-item {
            padding: 0.75rem;
          }
        }
      `}</style>

      <div className="tasks-header">
        <h1>
          <ClipboardList size={24} />
          My Tasks
          {blinking && pendingTasks.length > 0 && <span className="blink-indicator" />}
        </h1>
      </div>

      {loading ? (
        <div className="empty-state">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No tasks assigned to you</p>
        </div>
      ) : (
        <div className="tasks-grid">
          {/* Pending Tasks */}
          <div className="tasks-section">
            <div className="section-title">
              <AlertCircle size={18} color="#ef4444" />
              Pending
              {pendingTasks.length > 0 && <span className="task-count">{pendingTasks.length}</span>}
            </div>
            {pendingTasks.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No pending tasks</p>
            ) : (
              pendingTasks.map(task => (
                <div 
                  key={task.id} 
                  className="task-item pending"
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="task-title">
                    {getStatusIcon(task.status)}
                    {task.title}
                    <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
                  </div>
                  <div className="task-meta">
                    <span className="priority-badge" style={{ background: getPriorityColor(task.priority) }}>
                      {task.priority}
                    </span>
                    {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* In Progress Tasks */}
          <div className="tasks-section">
            <div className="section-title">
              <Clock size={18} color="#f59e0b" />
              In Progress
              {inProgressTasks.length > 0 && <span className="task-count">{inProgressTasks.length}</span>}
            </div>
            {inProgressTasks.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No tasks in progress</p>
            ) : (
              inProgressTasks.map(task => (
                <div 
                  key={task.id} 
                  className="task-item in_progress"
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="task-title">
                    {getStatusIcon(task.status)}
                    {task.title}
                    <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
                  </div>
                  <div className="task-meta">
                    <span className="priority-badge" style={{ background: getPriorityColor(task.priority) }}>
                      {task.priority}
                    </span>
                    {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Completed Tasks */}
          <div className="tasks-section">
            <div className="section-title">
              <Check size={18} color="#22c55e" />
              Completed
              {completedTasks.length > 0 && <span className="task-count">{completedTasks.length}</span>}
            </div>
            {completedTasks.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No completed tasks</p>
            ) : (
              completedTasks.map(task => (
                <div key={task.id} className="task-item completed">
                  <div className="task-title">
                    {getStatusIcon(task.status)}
                    {task.title}
                  </div>
                  <div className="task-meta">
                    <span>Completed</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedTask.title}</h2>
                <span className="priority-badge" style={{ background: getPriorityColor(selectedTask.priority), marginTop: '0.5rem', display: 'inline-block' }}>
                  {selectedTask.priority} priority
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowTaskFormatMenu(showTaskFormatMenu === selectedTask.id ? null : selectedTask.id); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.4rem 0.7rem',
                      background: '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    <Download size={14} /> Download ▾
                  </button>
                  {showTaskFormatMenu === selectedTask.id && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowTaskFormatMenu(null)} />
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem',
                        background: 'white', border: '1px solid #e0e0e0', borderRadius: '0.5rem',
                        overflow: 'hidden', zIndex: 20, minWidth: '160px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
                      }}>
                        <div onClick={() => handleDownloadTask(selectedTask, 'docx')}
                          style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#333', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #e0e0e0' }}
                          onMouseEnter={e => e.target.style.background = '#f0f4ff'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                          <FileText size={12} /> Word Document (.doc)
                        </div>
                        <div onClick={() => handleDownloadTask(selectedTask, 'pdf')}
                          style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#333', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #e0e0e0' }}
                          onMouseEnter={e => e.target.style.background = '#f0f4ff'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                          <FileText size={12} /> PDF Document (.pdf)
                        </div>
                        <div onClick={() => handleDownloadTask(selectedTask, 'png')}
                          style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#333', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #e0e0e0' }}
                          onMouseEnter={e => e.target.style.background = '#f0f4ff'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                          <Image size={12} /> PNG Image (.png)
                        </div>
                        <div onClick={() => handleDownloadTask(selectedTask, 'jpeg')}
                          style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#333', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #e0e0e0' }}
                          onMouseEnter={e => e.target.style.background = '#f0f4ff'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                          <Image size={12} /> JPEG Image (.jpg)
                        </div>
                        <div onClick={() => handleDownloadTask(selectedTask, 'webp')}
                          style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#333', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          onMouseEnter={e => e.target.style.background = '#f0f4ff'} onMouseLeave={e => e.target.style.background = 'transparent'}>
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
                <div className="task-detail-value">{new Date(selectedTask.due_date).toLocaleDateString()}</div>
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
