import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { toast } from '../hooks/useSoundEnabledToast';
import { 
  User, BookOpen, FileText, DollarSign, Bell, Clock, CheckCircle,
  Package, PenTool, ClipboardCheck, Calendar, Star, AlertCircle,
  CreditCard, ChevronRight, Eye, Download, Image, ExternalLink
} from 'lucide-react';
import { API_URL } from '../config/api';
import { exportReportCard } from '../utils/docExport';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

const TASK_TYPE_INFO = {
  homework: { label: 'Homework', icon: FileText, color: '#8b5cf6' },
  classwork: { label: 'Classwork', icon: PenTool, color: '#3b82f6' },
  package: { label: 'Package', icon: Package, color: '#22c55e' },
  test: { label: 'Test', icon: ClipboardCheck, color: '#f59e0b' },
};

function StudentPortal() {
  const currentUser = useSelector(selectCurrentUser);
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(false);
  
  const [tasks, setTasks] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [feeData, setFeeData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedReportCard, setSelectedReportCard] = useState(null);
  const [showReportCardModal, setShowReportCardModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get the token from localStorage
      const token = localStorage.getItem('sessionToken');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      switch (activeTab) {
        case 'tasks':
          const tasksRes = await fetch(`${API_URL}/api/student-portal/my-tasks`, { headers });
          if (tasksRes.ok) setTasks(await tasksRes.json());
          break;
        case 'report-cards':
          const rcRes = await fetch(`${API_URL}/api/student-portal/my-report-cards`, { headers });
          if (rcRes.ok) setReportCards(await rcRes.json());
          break;
        case 'fees':
          const feeRes = await fetch(`${API_URL}/api/student-portal/my-fees`, { headers });
          if (feeRes.ok) setFeeData(await feeRes.json());
          break;
        case 'announcements':
          const annRes = await fetch(`${API_URL}/api/student-portal/my-announcements`, { headers });
          if (annRes.ok) setAnnouncements(await annRes.json());
          break;
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReportCard = (rc) => {
    setSelectedReportCard(rc);
    setShowReportCardModal(true);
  };

  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showTaskFormatMenu, setShowTaskFormatMenu] = useState(null);

  const handleDownloadReportCard = (format) => {
    if (!selectedReportCard) return;
    setShowFormatMenu(false);
    
    const studentName = `${currentUser?.firstName || currentUser?.first_name || ''} ${currentUser?.lastName || currentUser?.last_name || ''}`.trim() || 'Student';
    const admissionNo = currentUser?.admissionNo || currentUser?.admission_no || currentUser?.accessCode || '';
    const className = currentUser?.className || currentUser?.class_name || '';
    const fileName = `Report_Card_${studentName.replace(/\s+/g, '_')}_${selectedReportCard.term || 'Term1'}`;
    
    // Prepare report data in the format expected by exportReportCard
    const reportData = {
      student_name: studentName,
      admission_no: admissionNo,
      class_name: className,
      academic_year: selectedReportCard.academic_year,
      term: selectedReportCard.term,
      position: selectedReportCard.position,
      total_students: selectedReportCard.total_students,
      average: selectedReportCard.average,
      grades: selectedReportCard.grades || [],
      behavior_marks: {
        neatness: selectedReportCard.neatness || 3,
        cooperation: selectedReportCard.cooperation || 3,
        responsibility: selectedReportCard.responsibility || 3,
        punctuality: selectedReportCard.punctuality || 3,
        discipline: selectedReportCard.discipline || 3,
      },
      teacher_comment: selectedReportCard.teacher_comment,
      principal_comment: selectedReportCard.principal_comment,
    };
    
    const student = {
      name: studentName,
      admission_no: admissionNo,
      class_name: className,
    };
    
    if (format === 'docx') {
      // Use the professional docExport utility for proper DOCX with CSS
      exportReportCard(reportData, student);
      toast.success('Report card downloaded as DOCX');
      return;
    }
    
    // For image and PDF formats, capture the report preview as a canvas
    const reportPreview = document.querySelector('.report-preview');
    if (!reportPreview) {
      toast.error('Could not capture report preview');
      return;
    }
    
    html2canvas(reportPreview, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    }).then(canvas => {
      if (format === 'pdf') {
        // Create PDF from canvas image
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${fileName}.pdf`);
        toast.success('Report card downloaded as PDF');
      } else if (format === 'png') {
        canvas.toBlob((blob) => {
          saveAs(blob, `${fileName}.png`);
          toast.success('Report card downloaded as PNG');
        }, 'image/png');
      } else if (format === 'jpeg') {
        canvas.toBlob((blob) => {
          saveAs(blob, `${fileName}.jpg`);
          toast.success('Report card downloaded as JPEG');
        }, 'image/jpeg', 0.95);
      } else if (format === 'webp') {
        canvas.toBlob((blob) => {
          saveAs(blob, `${fileName}.webp`);
          toast.success('Report card downloaded as WebP');
        }, 'image/webp', 0.95);
      }
    }).catch(error => {
      console.error('Error capturing report:', error);
      toast.error('Failed to generate download');
    });
  };

  const handleDownloadTask = (task, format) => {
    setShowTaskFormatMenu(null);
    
    const studentName = `${currentUser?.firstName || currentUser?.first_name || ''} ${currentUser?.lastName || currentUser?.last_name || ''}`.trim() || 'Student';
    const fileName = `Task_${(task.title || 'Task').replace(/\s+/g, '_')}`;
    
    // Check if task has attachments (sent files like PDF, image, Word doc, etc.)
    const hasAttachments = task.attachments && task.attachments.length > 0;
    
    if (hasAttachments) {
      // Download the actual attachment file(s) directly
      task.attachments.forEach((att, idx) => {
        if (typeof att === 'string') {
          if (att.startsWith('data:')) {
            // Base64 data URI - extract MIME type and download
            const mimeMatch = att.match(/^data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const ext = mimeType.split('/')[1] || 'bin';
            
            // Convert base64 to blob
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
            // URL - fetch and download
            const urlParts = att.split('/');
            const originalName = urlParts[urlParts.length - 1] || `file_${idx + 1}`;
            const suffix = task.attachments.length > 1 ? `_${idx + 1}` : '';
            
            fetch(att)
              .then(res => res.blob())
              .then(blob => {
                saveAs(blob, `${fileName}${suffix}_${originalName}`);
              })
              .catch(err => {
                console.error('Error fetching attachment:', err);
                // Fallback: open in new tab
                window.open(att, '_blank');
              });
          }
        }
      });
      toast.success(`Downloading ${task.attachments.length} attachment(s)`);
      return;
    }
    
    // No attachments - this is a written task, generate a summary
    if (format === 'docx') {
      // Create a simple DOC from task data
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
          <div class="header">
            <h1>TASK DETAILS</h1>
            <p>IHEZA School Management System</p>
          </div>
          <div class="section">
            <table>
              <tr><td><strong>Title:</strong></td><td>${task.title || 'N/A'}</td></tr>
              <tr><td><strong>Type:</strong></td><td>${(task.task_type || 'N/A').toUpperCase()}</td></tr>
              <tr><td><strong>Subject:</strong></td><td>${task.subject_name || 'N/A'}</td></tr>
              <tr><td><strong>Student:</strong></td><td>${studentName}</td></tr>
              <tr><td><strong>Due Date:</strong></td><td>${task.due_date || 'N/A'}</td></tr>
              <tr><td><strong>Status:</strong></td><td>${(task.my_status || 'pending').toUpperCase()}</td></tr>
              ${task.score !== null && task.score !== undefined ? `<tr><td><strong>Score:</strong></td><td>${task.score}</td></tr>` : ''}
            </table>
          </div>
          <div class="section">
            <h2>Description</h2>
            <p>${task.description || 'No description provided.'}</p>
          </div>
          ${task.feedback ? `
          <div class="section">
            <h2>Teacher Feedback</h2>
            <p>${task.feedback}</p>
          </div>
          ` : ''}
          <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>IHEZA School Management System</p>
          </div>
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
    
    // For image and PDF formats, create a temporary preview element
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
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Student:</td><td style="border:1px solid #333;padding:8px">${studentName}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Due Date:</td><td style="border:1px solid #333;padding:8px">${task.due_date || 'N/A'}</td></tr>
        <tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Status:</td><td style="border:1px solid #333;padding:8px">${(task.my_status || 'pending').toUpperCase()}</td></tr>
        ${task.score !== null && task.score !== undefined ? `<tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Score:</td><td style="border:1px solid #333;padding:8px">${task.score}</td></tr>` : ''}
      </table>
      <div style="margin:15px 0">
        <h2 style="font-size:12pt;color:#0f4c81">Description</h2>
        <p style="font-size:10pt">${task.description || 'No description provided.'}</p>
      </div>
      ${task.feedback ? `<div style="margin:15px 0"><h2 style="font-size:12pt;color:#0f4c81">Teacher Feedback</h2><p style="font-size:10pt">${task.feedback}</p></div>` : ''}
      <div style="margin-top:30px;text-align:center;font-size:9pt;color:#666;border-top:1px solid #ccc;padding-top:10px">
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <p>IHEZA School Management System</p>
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
        canvas.toBlob((blob) => {
          saveAs(blob, `${fileName}.png`);
          toast.success('Task downloaded as PNG');
        }, 'image/png');
      } else if (format === 'jpeg') {
        canvas.toBlob((blob) => {
          saveAs(blob, `${fileName}.jpg`);
          toast.success('Task downloaded as JPEG');
        }, 'image/jpeg', 0.95);
      } else if (format === 'webp') {
        canvas.toBlob((blob) => {
          saveAs(blob, `${fileName}.webp`);
          toast.success('Task downloaded as WebP');
        }, 'image/webp', 0.95);
      }
    }).catch(error => {
      document.body.removeChild(tempDiv);
      console.error('Error capturing task:', error);
      toast.error('Failed to generate download');
    });
  };

  const renderStars = (count) => '★'.repeat(count) + '☆'.repeat(5 - count);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <span className="status-badge completed"><CheckCircle size={12} /> Completed</span>;
      case 'pending': return <span className="status-badge pending"><Clock size={12} /> Pending</span>;
      case 'late': return <span className="status-badge late"><AlertCircle size={12} /> Late</span>;
      default: return <span className="status-badge pending"><Clock size={12} /> Pending</span>;
    }
  };

  const getFeeStatusBadge = (status) => {
    switch (status) {
      case 'fully_paid': return <span className="fee-status paid"><CheckCircle size={14} /> Fully Paid</span>;
      case 'partial': return <span className="fee-status partial"><AlertCircle size={14} /> Partial Payment</span>;
      default: return <span className="fee-status unpaid"><AlertCircle size={14} /> Unpaid</span>;
    }
  };

  const taskCounts = {
    total: tasks.length,
    pending: tasks.filter(t => t.my_status === 'pending').length,
    completed: tasks.filter(t => t.my_status === 'completed').length,
  };

  return (
    <div className="student-portal-page">
      <style>{`
        .student-portal-page { padding: 1.5rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.75rem; }
        .page-title-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        
        .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .tab { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; background: rgba(51, 65, 85, 0.3); border: 1px solid transparent; border-radius: 0.75rem; color: #94a3b8; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .tab:hover { background: rgba(51, 65, 85, 0.5); color: #f8fafc; }
        .tab.active { background: rgba(59, 130, 246, 0.2); border-color: #3b82f6; color: #f8fafc; }
        .tab-badge { background: rgba(59, 130, 246, 0.3); padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
        
        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 640px) { .stats-row { grid-template-columns: 1fr; } }
        .stat-card { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; padding: 1.25rem; text-align: center; }
        .stat-value { font-size: 2rem; font-weight: 700; color: #f8fafc; }
        .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
        
        .panel { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; overflow: hidden; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
        .panel-title { font-size: 0.875rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; gap: 0.5rem; }
        .panel-body { padding: 1rem; }
        
        .task-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .task-card { background: rgba(51, 65, 85, 0.3); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.75rem; padding: 1rem; }
        .task-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.5rem; }
        .task-type-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; }
        .task-title { font-weight: 600; color: #f8fafc; margin-bottom: 0.25rem; }
        .task-subject { font-size: 0.8rem; color: #64748b; }
        .task-description { color: #94a3b8; font-size: 0.8rem; margin: 0.5rem 0; }
        .task-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
        .task-due { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem; }
        .task-score { font-size: 0.875rem; font-weight: 600; color: #22c55e; }
        
        .status-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; }
        .status-badge.completed { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .status-badge.pending { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .status-badge.late { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        
        /* Report Cards */
        .rc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .rc-card { background: rgba(51, 65, 85, 0.3); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.75rem; padding: 1rem; cursor: pointer; transition: all 0.2s; }
        .rc-card:hover { border-color: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }
        .rc-term { font-weight: 600; color: #f8fafc; margin-bottom: 0.25rem; }
        .rc-date { font-size: 0.75rem; color: #64748b; }
        .rc-stats { display: flex; gap: 1rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(51, 65, 85, 0.5); }
        .rc-stat { text-align: center; flex: 1; }
        .rc-stat-value { font-weight: 700; color: #f8fafc; }
        .rc-stat-label { font-size: 0.65rem; color: #64748b; text-transform: uppercase; }
        
        /* Fees */
        .fee-summary { text-align: center; padding: 2rem; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%); border-radius: 1rem; margin-bottom: 1.5rem; }
        .fee-status { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 9999px; font-weight: 600; margin-bottom: 1rem; }
        .fee-status.paid { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .fee-status.partial { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .fee-status.unpaid { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .fee-amount { font-size: 2.5rem; font-weight: 700; color: #f8fafc; }
        .fee-label { font-size: 0.875rem; color: #64748b; }
        
        .fee-breakdown { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 640px) { .fee-breakdown { grid-template-columns: 1fr; } }
        .fee-box { text-align: center; padding: 1rem; background: rgba(51, 65, 85, 0.3); border-radius: 0.5rem; }
        .fee-box-value { font-size: 1.25rem; font-weight: 700; }
        .fee-box-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
        
        .payment-list { max-height: 300px; overflow-y: auto; }
        .payment-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid rgba(51, 65, 85, 0.3); }
        .payment-item:last-child { border-bottom: none; }
        .payment-amount { font-weight: 600; color: #22c55e; }
        .payment-date { font-size: 0.75rem; color: #64748b; }
        .payment-method { font-size: 0.7rem; color: #94a3b8; text-transform: capitalize; }
        
        /* Announcements */
        .announcement-list { display: flex; flex-direction: column; gap: 1rem; }
        .announcement-card { background: rgba(51, 65, 85, 0.3); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.75rem; padding: 1rem; }
        .announcement-card.urgent { border-left: 4px solid #ef4444; }
        .announcement-card.high { border-left: 4px solid #f59e0b; }
        .announcement-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.5rem; }
        .announcement-title { font-weight: 600; color: #f8fafc; }
        .announcement-type { padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 500; text-transform: uppercase; }
        .announcement-content { color: #94a3b8; font-size: 0.875rem; }
        .announcement-meta { display: flex; gap: 1rem; margin-top: 0.75rem; font-size: 0.75rem; color: #64748b; }
        
        .empty-state { text-align: center; padding: 3rem; color: #64748b; }
        
        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal { background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); position: sticky; top: 0; background: #1e293b; z-index: 1; }
        .modal-title { font-size: 1.125rem; font-weight: 600; color: #f8fafc; }
        .modal-close { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.5rem; font-size: 1.5rem; }
        .modal-body { padding: 1.25rem; }
        
        /* Report Card Preview */
        .report-preview { background: white; color: #333; padding: 1.5rem; border-radius: 0.5rem; }
        .rp-header { text-align: center; border-bottom: 2px solid #0f4c81; padding-bottom: 1rem; margin-bottom: 1rem; }
        .rp-school { font-size: 1.25rem; font-weight: 700; color: #0f4c81; }
        .rp-title { font-size: 0.875rem; font-weight: 600; margin-top: 0.5rem; background: #0f4c81; color: white; display: inline-block; padding: 0.25rem 1rem; border-radius: 4px; }
        .rp-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px; }
        .rp-info-item { }
        .rp-info-label { font-size: 0.6rem; color: #666; text-transform: uppercase; }
        .rp-info-value { font-weight: 600; font-size: 0.875rem; }
        .rp-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .rp-table th { background: #0f4c81; color: white; padding: 0.5rem; font-size: 0.75rem; text-align: left; }
        .rp-table td { padding: 0.5rem; border-bottom: 1px solid #e0e0e0; font-size: 0.8rem; }
        .rp-grade { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; color: white; }
        .rp-grade-A { background: #22c55e; }
        .rp-grade-B { background: #3b82f6; }
        .rp-grade-C { background: #8b5cf6; }
        .rp-grade-D { background: #f59e0b; }
        .rp-grade-E { background: #f97316; }
        .rp-grade-F { background: #ef4444; }
        .rp-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem; }
        .rp-summary-box { text-align: center; padding: 0.75rem; background: #f0f4f8; border-radius: 4px; }
        .rp-summary-value { font-size: 1.25rem; font-weight: 700; color: #0f4c81; }
        .rp-summary-label { font-size: 0.6rem; color: #666; text-transform: uppercase; }
        .rp-behavior { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px; margin-bottom: 1rem; }
        .rp-behavior-item { text-align: center; }
        .rp-behavior-label { font-size: 0.6rem; color: #666; text-transform: capitalize; }
        .rp-behavior-stars { color: #f59e0b; font-size: 0.875rem; }
        .rp-comment { padding: 0.75rem; background: #f9f9f9; border-left: 3px solid #0f4c81; margin-bottom: 0.5rem; }
        .rp-comment-label { font-size: 0.6rem; color: #666; text-transform: uppercase; margin-bottom: 0.25rem; }
        .rp-comment-text { font-size: 0.8rem; color: #333; }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <User size={20} color="white" />
          </span>
          My Portal
        </h1>
      </div>
      
      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
          <BookOpen size={18} /> My Tasks
          {taskCounts.pending > 0 && <span className="tab-badge">{taskCounts.pending}</span>}
        </div>
        <div className={`tab ${activeTab === 'report-cards' ? 'active' : ''}`} onClick={() => setActiveTab('report-cards')}>
          <FileText size={18} /> Report Cards
        </div>
        <div className={`tab ${activeTab === 'fees' ? 'active' : ''}`} onClick={() => setActiveTab('fees')}>
          <DollarSign size={18} /> My Fees
        </div>
        <div className={`tab ${activeTab === 'announcements' ? 'active' : ''}`} onClick={() => setActiveTab('announcements')}>
          <Bell size={18} /> Announcements
          {announcements.length > 0 && <span className="tab-badge">{announcements.length}</span>}
        </div>
      </div>
      
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <>
          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <>
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-value">{taskCounts.total}</div>
                  <div className="stat-label">Total Tasks</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#f59e0b' }}>{taskCounts.pending}</div>
                  <div className="stat-label">Pending</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#22c55e' }}>{taskCounts.completed}</div>
                  <div className="stat-label">Completed</div>
                </div>
              </div>
              
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title"><BookOpen size={16} /> Assigned Tasks</span>
                </div>
                <div className="panel-body">
                  {tasks.length === 0 ? (
                    <div className="empty-state">
                      <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p>No tasks assigned yet</p>
                    </div>
                  ) : (
                    <div className="task-list">
                      {tasks.map(task => {
                        const typeInfo = TASK_TYPE_INFO[task.task_type] || TASK_TYPE_INFO.homework;
                        const Icon = typeInfo.icon;
                        return (
                          <div key={task.id} className="task-card">
                            <div className="task-header">
                              <span 
                                className="task-type-badge"
                                style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}
                              >
                                <Icon size={12} /> {typeInfo.label}
                              </span>
                              {getStatusBadge(task.my_status)}
                            </div>
                            <div className="task-title">{task.title}</div>
                            <div className="task-subject">{task.subject_name}</div>
                            <div className="task-description">{task.description}</div>
                            {task.attachments && task.attachments.length > 0 && (
                              <div style={{ 
                                margin: '0.5rem 0', 
                                padding: '0.5rem', 
                                background: 'rgba(59, 130, 246, 0.1)', 
                                borderRadius: '0.5rem',
                                border: '1px solid rgba(59, 130, 246, 0.2)'
                              }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <FileText size={12} /> {task.attachments.length} attachment(s)
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  {task.attachments.map((att, idx) => {
                                    // Check if it's a base64 data URI (image)
                                    if (typeof att === 'string' && att.startsWith('data:image/')) {
                                      return (
                                        <div key={idx} style={{ position: 'relative' }}>
                                          <img 
                                            src={att} 
                                            alt={`Attachment ${idx + 1}`}
                                            style={{ 
                                              width: '80px', 
                                              height: '80px', 
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
                                    // For non-image attachments or URLs
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
                            <div className="task-footer">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {task.due_date && (
                                  <div className="task-due">
                                    <Calendar size={12} /> Due: {task.due_date}
                                  </div>
                                )}
                                {task.score !== null && task.score !== undefined && (
                                  <div className="task-score">Score: {task.score}</div>
                                )}
                                {task.feedback && (
                                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                    "{task.feedback}"
                                  </div>
                                )}
                              </div>
                              <div style={{ position: 'relative' }}>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setShowTaskFormatMenu(showTaskFormatMenu === task.id ? null : task.id); }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.3rem 0.6rem',
                                    background: 'rgba(14, 165, 233, 0.2)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(14, 165, 233, 0.3)',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  <Download size={12} /> Download ▾
                                </button>
                                {showTaskFormatMenu === task.id && (
                                  <>
                                    <div 
                                      style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                      onClick={() => setShowTaskFormatMenu(null)}
                                    />
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      right: 0,
                                      marginBottom: '0.25rem',
                                      background: '#1e293b',
                                      border: '1px solid rgba(51, 65, 85, 0.5)',
                                      borderRadius: '0.5rem',
                                      overflow: 'hidden',
                                      zIndex: 20,
                                      minWidth: '160px',
                                      boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                                    }}>
                                      <div 
                                        onClick={() => handleDownloadTask(task, 'docx')}
                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                                        onMouseLeave={e => e.target.style.background = 'transparent'}
                                      >
                                        <FileText size={12} /> Word Document (.doc)
                                      </div>
                                      <div 
                                        onClick={() => handleDownloadTask(task, 'pdf')}
                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                                        onMouseLeave={e => e.target.style.background = 'transparent'}
                                      >
                                        <FileText size={12} /> PDF Document (.pdf)
                                      </div>
                                      <div 
                                        onClick={() => handleDownloadTask(task, 'png')}
                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                                        onMouseLeave={e => e.target.style.background = 'transparent'}
                                      >
                                        <Image size={12} /> PNG Image (.png)
                                      </div>
                                      <div 
                                        onClick={() => handleDownloadTask(task, 'jpeg')}
                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                                        onMouseLeave={e => e.target.style.background = 'transparent'}
                                      >
                                        <Image size={12} /> JPEG Image (.jpg)
                                      </div>
                                      <div 
                                        onClick={() => handleDownloadTask(task, 'webp')}
                                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                                        onMouseLeave={e => e.target.style.background = 'transparent'}
                                      >
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
              </div>
            </>
          )}
          
          {/* Report Cards Tab */}
          {activeTab === 'report-cards' && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title"><FileText size={16} /> My Report Cards</span>
              </div>
              <div className="panel-body">
                {reportCards.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No report cards available yet</p>
                  </div>
                ) : (
                  <div className="rc-grid">
                    {reportCards.map(rc => (
                      <div key={rc.id} className="rc-card" onClick={() => handleViewReportCard(rc)}>
                        <div className="rc-term">{rc.term} {rc.academic_year}</div>
                        <div className="rc-date">Sent: {new Date(rc.sent_at).toLocaleDateString()}</div>
                        <div className="rc-stats">
                          <div className="rc-stat">
                            <div className="rc-stat-value">{rc.grades?.length || 0}</div>
                            <div className="rc-stat-label">Subjects</div>
                          </div>
                          <div className="rc-stat">
                            <div className="rc-stat-value">{rc.average?.toFixed(1) || 0}</div>
                            <div className="rc-stat-label">Average</div>
                          </div>
                          <div className="rc-stat">
                            <div className="rc-stat-value" style={{ color: '#3b82f6' }}>{rc.overall_grade}</div>
                            <div className="rc-stat-label">Grade</div>
                          </div>
                          <div className="rc-stat">
                            <div className="rc-stat-value">{rc.position || '-'}</div>
                            <div className="rc-stat-label">Position</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                            <Eye size={14} /> View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Fees Tab */}
          {activeTab === 'fees' && feeData && (
            <>
              <div className="fee-summary">
                {getFeeStatusBadge(feeData.status)}
                <div className="fee-amount">TZS {feeData.balance?.toLocaleString()}</div>
                <div className="fee-label">Outstanding Balance</div>
              </div>
              
              <div className="fee-breakdown">
                <div className="fee-box">
                  <div className="fee-box-value" style={{ color: '#f8fafc' }}>TZS {feeData.total_fees?.toLocaleString()}</div>
                  <div className="fee-box-label">Total Fees</div>
                </div>
                <div className="fee-box">
                  <div className="fee-box-value" style={{ color: '#22c55e' }}>TZS {feeData.total_paid?.toLocaleString()}</div>
                  <div className="fee-box-label">Paid</div>
                </div>
                <div className="fee-box">
                  <div className="fee-box-value" style={{ color: '#ef4444' }}>TZS {feeData.balance?.toLocaleString()}</div>
                  <div className="fee-box-label">Balance</div>
                </div>
              </div>
              
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title"><CreditCard size={16} /> Fee Structure</span>
                </div>
                <div className="panel-body">
                  {feeData.fee_structures?.map(fs => (
                    <div key={fs.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <span style={{ color: '#f8fafc' }}>{fs.name}</span>
                      <span style={{ color: '#94a3b8' }}>TZS {fs.amount?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {feeData.payments?.length > 0 && (
                <div className="panel" style={{ marginTop: '1rem' }}>
                  <div className="panel-header">
                    <span className="panel-title"><DollarSign size={16} /> Payment History</span>
                  </div>
                  <div className="panel-body">
                    <div className="payment-list">
                      {feeData.payments.map(p => (
                        <div key={p.id} className="payment-item">
                          <div>
                            <div className="payment-amount">TZS {p.amount?.toLocaleString()}</div>
                            <div className="payment-method">{p.payment_method}</div>
                          </div>
                          <div className="payment-date">{new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Announcements Tab */}
          {activeTab === 'announcements' && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title"><Bell size={16} /> Announcements</span>
              </div>
              <div className="panel-body">
                {announcements.length === 0 ? (
                  <div className="empty-state">
                    <Bell size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No announcements</p>
                  </div>
                ) : (
                  <div className="announcement-list">
                    {announcements.map(ann => (
                      <div key={ann.id} className={`announcement-card ${ann.priority}`}>
                        <div className="announcement-header">
                          <div className="announcement-title">{ann.title}</div>
                          <span 
                            className="announcement-type"
                            style={{ 
                              background: ann.announcement_type === 'urgent' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                              color: ann.announcement_type === 'urgent' ? '#ef4444' : '#3b82f6'
                            }}
                          >
                            {ann.announcement_type}
                          </span>
                        </div>
                        <div className="announcement-content">{ann.content}</div>
                        <div className="announcement-meta">
                          <span>By: {ann.created_by_name}</span>
                          <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Report Card Modal */}
      {showReportCardModal && selectedReportCard && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{selectedReportCard.term} {selectedReportCard.academic_year} Report Card</h2>
              <button className="modal-close" onClick={() => setShowReportCardModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setShowFormatMenu(!showFormatMenu)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    <Download size={16} /> Download <span style={{ marginLeft: '0.25rem' }}>▾</span>
                  </button>
                  {showFormatMenu && (
                    <>
                      <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                        onClick={() => setShowFormatMenu(false)}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '0.25rem',
                        background: '#1e293b',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        zIndex: 20,
                        minWidth: '160px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                      }}>
                        <div 
                          onClick={() => handleDownloadReportCard('docx')}
                          style={{ padding: '0.6rem 1rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                          onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                          <FileText size={14} /> Word Document (.docx)
                        </div>
                        <div 
                          onClick={() => handleDownloadReportCard('pdf')}
                          style={{ padding: '0.6rem 1rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                          onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                          <FileText size={14} /> PDF Document (.pdf)
                        </div>
                        <div 
                          onClick={() => handleDownloadReportCard('png')}
                          style={{ padding: '0.6rem 1rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                          onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                          <Image size={14} /> PNG Image (.png)
                        </div>
                        <div 
                          onClick={() => handleDownloadReportCard('jpeg')}
                          style={{ padding: '0.6rem 1rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}
                          onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                          <Image size={14} /> JPEG Image (.jpg)
                        </div>
                        <div 
                          onClick={() => handleDownloadReportCard('webp')}
                          style={{ padding: '0.6rem 1rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          onMouseEnter={e => e.target.style.background = 'rgba(59, 130, 246, 0.2)'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                          <Image size={14} /> WebP Image (.webp)
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="report-preview">
                <div className="rp-header">
                  <div className="rp-school">IHEZA</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>The Institute of Holistic Education of Zanzibar</div>
                  <div className="rp-title">STUDENT REPORT CARD</div>
                </div>
                
                <div className="rp-info">
                  <div className="rp-info-item" style={{ gridColumn: 'span 2' }}>
                    <div className="rp-info-label">Student Name</div>
                    <div className="rp-info-value" style={{ fontWeight: 'bold', color: '#0f4c81' }}>
                      {currentUser?.firstName || currentUser?.first_name} {currentUser?.lastName || currentUser?.last_name}
                    </div>
                  </div>
                  <div className="rp-info-item">
                    <div className="rp-info-label">Admission No</div>
                    <div className="rp-info-value">{currentUser?.admissionNo || currentUser?.admission_no || currentUser?.accessCode}</div>
                  </div>
                  <div className="rp-info-item">
                    <div className="rp-info-label">Class</div>
                    <div className="rp-info-value">{currentUser?.className || currentUser?.class_name}</div>
                  </div>
                  <div className="rp-info-item">
                    <div className="rp-info-label">Term</div>
                    <div className="rp-info-value">{selectedReportCard.term}</div>
                  </div>
                  <div className="rp-info-item">
                    <div className="rp-info-label">Year</div>
                    <div className="rp-info-value">{selectedReportCard.academic_year}</div>
                  </div>
                  <div className="rp-info-item">
                    <div className="rp-info-label">Position</div>
                    <div className="rp-info-value">{selectedReportCard.position || '-'} / {selectedReportCard.total_students || '-'}</div>
                  </div>
                  <div className="rp-info-item">
                    <div className="rp-info-label">Overall</div>
                    <div className="rp-info-value">{selectedReportCard.overall_grade}</div>
                  </div>
                </div>
                
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Score</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReportCard.grades?.map((g, i) => (
                      <tr key={i}>
                        <td>{g.subject_name}</td>
                        <td>{g.score}</td>
                        <td><span className={`rp-grade rp-grade-${g.grade}`}>{g.grade}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="rp-summary">
                  <div className="rp-summary-box">
                    <div className="rp-summary-value">{selectedReportCard.grades?.length || 0}</div>
                    <div className="rp-summary-label">Subjects</div>
                  </div>
                  <div className="rp-summary-box">
                    <div className="rp-summary-value">{selectedReportCard.total_score?.toFixed(0) || 0}</div>
                    <div className="rp-summary-label">Total</div>
                  </div>
                  <div className="rp-summary-box">
                    <div className="rp-summary-value">{selectedReportCard.average?.toFixed(1) || 0}</div>
                    <div className="rp-summary-label">Average</div>
                  </div>
                  <div className="rp-summary-box">
                    <div className="rp-summary-value">{selectedReportCard.overall_grade}</div>
                    <div className="rp-summary-label">Grade</div>
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#666', marginBottom: '0.5rem' }}>BEHAVIOR & CONDUCT</div>
                  <div className="rp-behavior">
                    {['neatness', 'cooperation', 'responsibility', 'punctuality', 'discipline'].map(mark => (
                      <div key={mark} className="rp-behavior-item">
                        <div className="rp-behavior-label">{mark}</div>
                        <div className="rp-behavior-stars">{renderStars(selectedReportCard[mark] || 3)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {selectedReportCard.teacher_comment && (
                  <div className="rp-comment">
                    <div className="rp-comment-label">Teacher's Comment</div>
                    <div className="rp-comment-text">{selectedReportCard.teacher_comment}</div>
                  </div>
                )}
                
                {selectedReportCard.principal_comment && (
                  <div className="rp-comment">
                    <div className="rp-comment-label">Principal's Comment</div>
                    <div className="rp-comment-text">{selectedReportCard.principal_comment}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentPortal;
