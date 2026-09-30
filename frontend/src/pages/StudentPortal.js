import React, { useState, useEffect, useRef } from 'react';

import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { toast } from '../hooks/useSoundEnabledToast';
import { API_URL } from '../config/api';
import { exportReportCard } from '../utils/docExport';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

const TASK_TYPE_INFO = {
  homework: { label: 'Homework', icon: '📝', color: '#7c3aed', bg: '#ede9fe' },
  classwork: { label: 'Classwork', icon: '✏️', color: '#2563eb', bg: '#dbeafe' },
  package: { label: 'Package', icon: '📦', color: '#059669', bg: '#d1fae5' },
  test: { label: 'Test', icon: '📋', color: '#d97706', bg: '#fef3c7' },
};

const getPerformanceLevel = (score) => {
  if (score === null || score === undefined) return null;
  if (score >= 80) return { label: 'Excellent', cls: 'excellent' };
  if (score >= 70) return { label: 'V.Good', cls: 'vgood' };
  if (score >= 50) return { label: 'Good', cls: 'good' };
  if (score >= 40) return { label: 'Fair', cls: 'fair' };
  return { label: 'Fail', cls: 'fail' };
};

function StudentPortal() {
  const currentUser = useSelector(selectCurrentUser);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [grades, setGrades] = useState([]);
  const [feeData, setFeeData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [almanacEvents, setAlmanacEvents] = useState([]);
  const [selectedReportCard, setSelectedReportCard] = useState(null);
  const [showReportCardModal, setShowReportCardModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(null);
  // Task selected for the "View" detail modal (full task details + download)
  const [viewTask, setViewTask] = useState(null);
  const [showFeeModal, setShowFeeModal] = useState(null);

  const [showAnnouncementModal, setShowAnnouncementModal] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);

  // Which section modal is open: 'tasks' | 'report-cards' | 'fees' | 'announcements' | 'results' | 'almanac' | null
  const [openSection, setOpenSection] = useState(null);

  // LAZY-LOAD PER SECTION (see audit report).
  // On mount we fetch the profile info AND each section's data SEQUENTIALLY
  // (one request at a time) so the dashboard cards populate immediately on
  // first load without requiring a manual refresh, while still avoiding the
  // 502 overload caused by firing all 7 requests concurrently.
  // Each section's data is cached for the session so re-opening a modal is
  // instant (no refetch).
  const [sectionLoading, setSectionLoading] = useState(null); // section key currently loading
  const loadedSectionsRef = useRef(new Set());


  const SECTION_ENDPOINTS = {
    tasks: '/api/student-portal/my-tasks',
    'report-cards': '/api/student-portal/my-report-cards',
    fees: '/api/student-portal/my-fees',
    announcements: '/api/student-portal/my-announcements',
    results: '/api/student-portal/my-grades',
    almanac: '/api/almanac',
  };

  const getHeaders = () => {
    const token = localStorage.getItem('sessionToken');
    return { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) };
  };

  const handleUnauthorized = (res) => {
    if (res.status === 401) {
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('currentPortal');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('sessionExpiresAt');
      window.location.href = '/login';
      return true;
    }
    return false;
  };

  // Fetch a single section's data and store it in the matching state.
  const fetchSection = async (section) => {
    const endpoint = SECTION_ENDPOINTS[section];
    if (!endpoint) return;
    setSectionLoading(section);
    try {
      const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
      if (handleUnauthorized(res)) return;
      if (!res.ok) return;
      const data = await res.json();
      if (section === 'tasks') setTasks(data);
      else if (section === 'report-cards') setReportCards(data);
      else if (section === 'fees') setFeeData(data);
      else if (section === 'announcements') setAnnouncements(data);
      else if (section === 'results') setGrades(data);
      else if (section === 'almanac') setAlmanacEvents(data.events || []);
      loadedSectionsRef.current.add(section);
    } catch (error) {
      console.error(`Failed to load ${section}:`, error);
    } finally {
      setSectionLoading(null);
    }
  };

  // Load the student's profile info on mount, then fetch each section's data
  // SEQUENTIALLY (one request at a time) so the dashboard cards populate
  // immediately on first load WITHOUT requiring a manual refresh, while still
  // avoiding the 502 overload caused by firing all 7 requests concurrently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/student-portal/my-info`, { headers: getHeaders() });
        if (cancelled) return;
        if (handleUnauthorized(res)) return;
        if (res.ok) setStudentInfo(await res.json());
      } catch (error) {
        console.error('Failed to load student info:', error);
      }
      // Populate dashboard card counts by fetching each section one-by-one.
      for (const section of Object.keys(SECTION_ENDPOINTS)) {
        if (cancelled) return;
        if (loadedSectionsRef.current.has(section)) continue;
        try {
          const endpoint = SECTION_ENDPOINTS[section];
          const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
          if (cancelled) return;
          if (handleUnauthorized(res)) return;
          if (!res.ok) continue;
          const data = await res.json();
          if (section === 'tasks') setTasks(data);
          else if (section === 'report-cards') setReportCards(data);
          else if (section === 'fees') setFeeData(data);
          else if (section === 'announcements') setAnnouncements(data);
          else if (section === 'results') setGrades(data);
          else if (section === 'almanac') setAlmanacEvents(data.events || []);
          loadedSectionsRef.current.add(section);
        } catch (error) {
          console.error(`Failed to load ${section}:`, error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);


  // Open a section modal, lazily fetching its data on first open.
  // The modal opens immediately and shows a loading spinner while the
  // section's data is fetched (only on the first open; cached afterwards).
  const openModal = (section) => {
    setOpenSection(section);
    if (!loadedSectionsRef.current.has(section)) {
      fetchSection(section);
    }
  };


  const closeModal = () => setOpenSection(null);

  // Refresh: reload the profile info and every section (clears the cache).
  // Sections are fetched SEQUENTIALLY (one at a time) to avoid the 502
  // overload that happens when all requests fire concurrently.
  const loadAllData = async () => {
    setLoading(true);
    loadedSectionsRef.current.clear();
    try {
      const res = await fetch(`${API_URL}/api/student-portal/my-info`, { headers: getHeaders() });
      if (handleUnauthorized(res)) return;
      if (res.ok) setStudentInfo(await res.json());
      for (const section of Object.keys(SECTION_ENDPOINTS)) {
        await fetchSection(section);
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setLoading(false);
    }
  };




  const handleViewReportCard = (rc) => { setSelectedReportCard(rc); setShowReportCardModal(true); };

  const handleDownloadReportCard = (format) => {
    if (!selectedReportCard) return;
    const studentName = `${currentUser?.firstName || currentUser?.first_name || ''} ${currentUser?.lastName || currentUser?.last_name || ''}`.trim() || 'Student';
    const admissionNo = currentUser?.admissionNo || currentUser?.admission_no || currentUser?.accessCode || '';
    const className = currentUser?.className || currentUser?.class_name || '';
    const fileName = `Report_Card_${studentName.replace(/\s+/g, '_')}_${selectedReportCard.term || 'Term1'}`;
    const reportData = {
      student_name: studentName, admission_no: admissionNo, class_name: className,
      academic_year: selectedReportCard.academic_year, term: selectedReportCard.term,
      position: selectedReportCard.position, total_students: selectedReportCard.total_students,
      average: selectedReportCard.average, grades: selectedReportCard.grades || [],
      behavior_marks: {
        neatness: selectedReportCard.neatness || 3, cooperation: selectedReportCard.cooperation || 3,
        responsibility: selectedReportCard.responsibility || 3, punctuality: selectedReportCard.punctuality || 3,
        discipline: selectedReportCard.discipline || 3,
      },
      teacher_comment: selectedReportCard.teacher_comment, principal_comment: selectedReportCard.principal_comment,
    };
    const student = { name: studentName, admission_no: admissionNo, class_name: className };
    if (format === 'docx') { exportReportCard(reportData, student); toast.success('Report card downloaded as DOCX'); return; }
    const reportPreview = document.querySelector('.modal-body');
    if (!reportPreview) { toast.error('Could not capture report preview'); return; }
    html2canvas(reportPreview, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      .then(canvas => {
        if (format === 'pdf') {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`${fileName}.pdf`);
          toast.success('Report card downloaded as PDF');
        } else if (format === 'png') {
          canvas.toBlob((blob) => { saveAs(blob, `${fileName}.png`); toast.success('Report card downloaded as PNG'); }, 'image/png');
        } else if (format === 'jpeg') {
          canvas.toBlob((blob) => { saveAs(blob, `${fileName}.jpg`); toast.success('Report card downloaded as JPEG'); }, 'image/jpeg', 0.95);
        } else if (format === 'webp') {
          canvas.toBlob((blob) => { saveAs(blob, `${fileName}.webp`); toast.success('Report card downloaded as WebP'); }, 'image/webp', 0.95);
        }
      })
      .catch(error => { console.error('Error capturing report:', error); toast.error('Failed to generate download'); });
  };

  const handleDownloadTask = (task, format) => {
    const studentName = `${currentUser?.firstName || currentUser?.first_name || ''} ${currentUser?.lastName || currentUser?.last_name || ''}`.trim() || 'Student';
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
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeType });
            const suffix = task.attachments.length > 1 ? `_${idx + 1}` : '';
            saveAs(blob, `${fileName}${suffix}.${ext}`);
          } else if (att.startsWith('http://') || att.startsWith('https://')) {
            const urlParts = att.split('/');
            const originalName = urlParts[urlParts.length - 1] || `file_${idx + 1}`;
            const suffix = task.attachments.length > 1 ? `_${idx + 1}` : '';
            fetch(att).then(res => res.blob()).then(blob => { saveAs(blob, `${fileName}${suffix}_${originalName}`); })
              .catch(err => { console.error('Error fetching attachment:', err); window.open(att, '_blank'); });
          }
        }
      });
      toast.success(`Downloading ${task.attachments.length} attachment(s)`);
      return;
    }
    if (format === 'docx') {
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Task - ${task.title}</title><style>body{font-family:'Times New Roman',serif;font-size:12pt;margin:0.5in}h1{font-size:16pt;color:#0f4c81;text-align:center}.header{text-align:center;border-bottom:2px solid #0f4c81;padding-bottom:10px;margin-bottom:20px}.section{margin:15px 0}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #333;padding:8px;text-align:left}th{background:#0f4c81;color:white}.footer{margin-top:30px;text-align:center;font-size:10pt;color:#666;border-top:1px solid #ccc;padding-top:10px}</style></head><body><div class="header"><h1>TASK DETAILS</h1><p>IHEZA School Management System</p></div><div class="section"><table><tr><td><strong>Title:</strong></td><td>${task.title || 'N/A'}</td></tr><tr><td><strong>Type:</strong></td><td>${(task.task_type || 'N/A').toUpperCase()}</td></tr><tr><td><strong>Subject:</strong></td><td>${task.subject_name || 'N/A'}</td></tr><tr><td><strong>Student:</strong></td><td>${studentName}</td></tr><tr><td><strong>Due Date:</strong></td><td>${task.due_date || 'N/A'}</td></tr><tr><td><strong>Status:</strong></td><td>${(task.my_status || 'pending').toUpperCase()}</td></tr>${task.score !== null && task.score !== undefined ? `<tr><td><strong>Score:</strong></td><td>${task.score}</td></tr>` : ''}</table></div><div class="section"><h2>Description</h2><p>${task.description || 'No description provided.'}</p></div>${task.feedback ? `<div class="section"><h2>Teacher Feedback</h2><p>${task.feedback}</p></div>` : ''}<div class="footer"><p>Generated on: ${new Date().toLocaleDateString()}</p><p>IHEZA School Management System</p></div></body></html>`;
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
    tempDiv.innerHTML = `<div style="text-align:center;border-bottom:2px solid #0f4c81;padding-bottom:10px;margin-bottom:20px"><h1 style="font-size:16pt;color:#0f4c81;margin:0">TASK DETAILS</h1><p style="font-size:10pt;color:#666">IHEZA School Management System</p></div><table style="width:100%;border-collapse:collapse;margin:10px 0"><tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Title:</td><td style="border:1px solid #333;padding:8px">${task.title || 'N/A'}</td></tr><tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Type:</td><td style="border:1px solid #333;padding:8px">${(task.task_type || 'N/A').toUpperCase()}</td></tr><tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Subject:</td><td style="border:1px solid #333;padding:8px">${task.subject_name || 'N/A'}</td></tr><tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Student:</td><td style="border:1px solid #333;padding:8px">${studentName}</td></tr><tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Due Date:</td><td style="border:1px solid #333;padding:8px">${task.due_date || 'N/A'}</td></tr><tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Status:</td><td style="border:1px solid #333;padding:8px">${(task.my_status || 'pending').toUpperCase()}</td></tr>${task.score !== null && task.score !== undefined ? `<tr><td style="border:1px solid #333;padding:8px;font-weight:bold">Score:</td><td style="border:1px solid #333;padding:8px">${task.score}</td></tr>` : ''}</table><div style="margin:15px 0"><h2 style="font-size:12pt;color:#0f4c81">Description</h2><p style="font-size:10pt">${task.description || 'No description provided.'}</p></div>${task.feedback ? `<div style="margin:15px 0"><h2 style="font-size:12pt;color:#0f4c81">Teacher Feedback</h2><p style="font-size:10pt">${task.feedback}</p></div>` : ''}<div style="margin-top:30px;text-align:center;font-size:9pt;color:#666;border-top:1px solid #ccc;padding-top:10px"><p>Generated on: ${new Date().toLocaleDateString()}</p><p>IHEZA School Management System</p></div>`;
    document.body.appendChild(tempDiv);
    html2canvas(tempDiv, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      .then(canvas => {
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
      })
      .catch(error => { document.body.removeChild(tempDiv); console.error('Error capturing task:', error); toast.error('Failed to generate download'); });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <span className="status-badge completed">✓ Completed</span>;
      case 'pending': return <span className="status-badge pending">⏱ Pending</span>;
      case 'late': return <span className="status-badge late">⚠ Late</span>;
      default: return <span className="status-badge pending">⏱ Pending</span>;
    }
  };

  const getFeeStatusBadge = (status) => {
    switch (status) {
      case 'fully_paid': return <span className="fee-status paid">✓ Fully Paid</span>;
      case 'partial': return <span className="fee-status partial">⚠ Partial</span>;
      default: return <span className="fee-status unpaid">✗ Unpaid</span>;
    }
  };

  const taskCounts = {
    total: tasks.length,
    pending: tasks.filter(t => t.my_status === 'pending').length,
    completed: tasks.filter(t => t.my_status === 'completed').length,
  };

  const studentName = `${currentUser?.firstName || currentUser?.first_name || ''} ${currentUser?.lastName || currentUser?.last_name || ''}`.trim() || 'Student';
  const balance = feeData?.balance || 0;

  return (

    <div className="student-portal-page">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .student-portal-page { background: #f1f5f9; font-family: 'Inter', -apple-system, sans-serif; padding: 1.5rem; min-height: 100vh; }
        .app-wrapper { max-width: 1200px; width: 100%; margin: 0 auto; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 0.8rem; }
        .page-title { display: flex; align-items: center; gap: 0.6rem; }
        .page-title .icon-wrap { width: 38px; height: 38px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1rem; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.25); }
        .page-title h1 { font-size: 1.3rem; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; }
        .page-title .sub { font-size: 0.8rem; color: #64748b; font-weight: 400; margin-left: 0.2rem; }
        .header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.4rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.8rem; border: none; cursor: pointer; transition: all 0.2s ease; font-family: 'Inter', sans-serif; }
        .btn-outline { background: white; color: #475569; border: 1px solid #e2e8f0; }
        .btn-outline:hover { background: #f8fafc; border-color: #cbd5e1; }
        .stats-compact { display: flex; align-items: center; gap: 0.3rem 1.2rem; flex-wrap: wrap; background: white; padding: 0.25rem 1rem; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 1.2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .stats-compact .stat-item { display: flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.2rem; }
        .stats-compact .stat-item .icon { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }
        .stats-compact .stat-item .icon.blue { background: #dbeafe; color: #2563eb; }
        .stats-compact .stat-item .icon.green { background: #d1fae5; color: #059669; }
        .stats-compact .stat-item .icon.orange { background: #fef3c7; color: #d97706; }
        .stats-compact .stat-item .icon.purple { background: #ede9fe; color: #7c3aed; }
        .stats-compact .stat-item .icon.red { background: #fee2e2; color: #dc2626; }
        .stats-compact .stat-item .num { font-size: 1rem; font-weight: 700; color: #0f172a; line-height: 1.2; }
        .stats-compact .stat-item .label { font-size: 0.6rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 500; }
        .stats-compact .divider { color: #e2e8f0; font-size: 0.8rem; }
        /* ===== CARD GRID (50px height cards) ===== */
        .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.8rem; margin-bottom: 1.5rem; }
        @media (max-width: 900px) { .card-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .card-grid { grid-template-columns: 1fr; } }
        .dash-card {
          background: white; border-radius: 12px; padding: 0.6rem 0.9rem; border: 1px solid #e2e8f0;
          cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; gap: 0.8rem;
          height: 100px; min-height: 100px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); position: relative; overflow: hidden;
        }
        .dash-card .card-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
        .dash-card .card-content .info .title { font-size: 0.9rem; font-weight: 700; color: #0f172a; line-height: 1.2; }
        .dash-card .card-content .info .subtitle { font-size: 0.7rem; color: #94a3b8; margin-top: 0.15rem; }
        .dash-card .card-content .badge-count { background: #f1f5f9; color: #475569; font-size: 0.8rem; font-weight: 700; padding: 0.1rem 0.6rem; border-radius: 20px; flex-shrink: 0; }
        .dash-card .card-arrow { color: #94a3b8; font-size: 0.85rem; flex-shrink: 0; }

        .dash-card:hover { border-color: #b3c7e6; box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-2px); }
        .dash-card .card-icon.blue { background: #dbeafe; color: #2563eb; }
        .dash-card .card-icon.green { background: #d1fae5; color: #059669; }
        .dash-card .card-icon.orange { background: #fef3c7; color: #d97706; }
        .dash-card .card-icon.purple { background: #ede9fe; color: #7c3aed; }
        .dash-card .card-content { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; }
        .dash-card .card-content .badge-count.urgent { background: #fee2e2; color: #dc2626; }
        .dash-card .card-content .badge-count.success { background: #d1fae5; color: #059669; }
        .dash-card .card-content .badge-count.warning { background: #fef3c7; color: #d97706; }

        .footer-note { margin-top: 0.8rem; text-align: center; color: #94a3b8; font-size: 0.7rem; border-top: 1px solid #e2e8f0; padding-top: 0.8rem; }
        .loading-state { text-align: center; padding: 3rem; color: #64748b; font-size: 0.9rem; }
        /* ===== MODAL ===== */
        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-overlay.active { display: flex; }
        .modal { background: white; border-radius: 16px; width: 100%; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 24px 48px rgba(0,0,0,0.2); animation: modalIn 0.25s ease; }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: white; z-index: 1; border-radius: 16px 16px 0 0; }
        .modal-header h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; }
        .modal-header h2 .icon-sm { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; }
        .modal-header h2 .icon-sm.blue { background: #dbeafe; color: #2563eb; }
        .modal-header h2 .icon-sm.green { background: #d1fae5; color: #059669; }
        .modal-header h2 .icon-sm.orange { background: #fef3c7; color: #d97706; }
        .modal-header h2 .icon-sm.purple { background: #ede9fe; color: #7c3aed; }
        .modal-close { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.3rem; border-radius: 8px; font-size: 1.2rem; transition: background 0.2s ease; }
        .modal-close:hover { background: #f1f5f9; }
        .modal-body { padding: 1.5rem; }
        .modal-body .detail-row { display: flex; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
        .modal-body .detail-row .label { width: 120px; font-weight: 600; color: #475569; font-size: 0.8rem; flex-shrink: 0; }
        .modal-body .detail-row .value { flex: 1; color: #0f172a; font-size: 0.85rem; }
        .modal-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .modal-table thead th { background: #e8edf4; color: #1f3b5c; font-weight: 600; text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.4px; padding: 0.4rem 0.6rem; border-right: 1px solid #d0d7e2; border-bottom: 2px solid #b8c6d8; text-align: left; }
        .modal-table thead th:last-child { border-right: none; }
        .modal-table tbody td { padding: 0.35rem 0.6rem; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; vertical-align: middle; color: #1e2f3f; background: white; }
        .modal-table tbody td:last-child { border-right: none; }
        .modal-table tbody tr:nth-child(even) td { background: #f8faff; }
        .modal-table tbody tr:hover td { background: #e8f0fe; }
        .modal-table .type-badge { display: inline-block; padding: 0.05rem 0.4rem; border-radius: 20px; font-size: 0.55rem; font-weight: 600; }
        .modal-table .type-badge.homework { background: #ede9fe; color: #7c3aed; }
        .modal-table .type-badge.classwork { background: #dbeafe; color: #2563eb; }
        .modal-table .type-badge.package { background: #d1fae5; color: #059669; }
        .modal-table .type-badge.test { background: #fef3c7; color: #d97706; }
        .modal-table .status-badge { display: inline-flex; align-items: center; gap: 3px; padding: 0.05rem 0.4rem; border-radius: 20px; font-size: 0.55rem; font-weight: 600; }
        .modal-table .status-badge.completed { background: #d1fae5; color: #059669; }
        .modal-table .status-badge.pending { background: #fef3c7; color: #d97706; }
        .modal-table .status-badge.late { background: #fee2e2; color: #dc2626; }
        .modal-table .perf-badge { display: inline-block; padding: 0.05rem 0.4rem; border-radius: 20px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; }
        .modal-table .perf-badge.fail { background: #fee2e2; color: #dc2626; }
        .modal-table .perf-badge.fair { background: #fef3c7; color: #d97706; }
        .modal-table .perf-badge.good { background: #dbeafe; color: #2563eb; }
        .modal-table .perf-badge.vgood { background: #d1fae5; color: #059669; }
        .modal-table .perf-badge.excellent { background: #d1fae5; color: #059669; border: 1px solid #059669; }
        .modal-table .fee-status { display: inline-block; padding: 0.05rem 0.4rem; border-radius: 20px; font-size: 0.55rem; font-weight: 600; }
        .modal-table .fee-status.paid { background: #d1fae5; color: #059669; }
        .modal-table .fee-status.partial { background: #fef3c7; color: #d97706; }
        .modal-table .fee-status.unpaid { background: #fee2e2; color: #dc2626; }
        .act-btn { display: inline-flex; align-items: center; gap: 3px; padding: 0.15rem 0.45rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; color: #475569; font-size: 0.62rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease; font-family: 'Inter', sans-serif; white-space: nowrap; }
        .act-btn:hover { background: #e2e8f0; color: #0f172a; }
        .act-btn.view { background: #eff6ff; border-color: #bfdbfe; color: #2563eb; }
        .act-btn.view:hover { background: #dbeafe; }
        .act-btn.download { background: #ecfdf5; border-color: #a7f3d0; color: #059669; }
        .act-btn.download:hover { background: #d1fae5; }
        .modal-footer-note { margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.7rem; color: #94a3b8; }

        .modal-footer-note .act-btn { display: inline-flex; align-items: center; gap: 2px; padding: 0.1rem 0.35rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #64748b; font-size: 0.6rem; font-weight: 500; cursor: pointer; transition: all 0.15s ease; font-family: 'Inter', sans-serif; }
        .modal-footer-note .act-btn:hover { background: #e2e8f0; color: #0f172a; }
        .modal-footer-note .act-btn.view:hover { background: #dbeafe; color: #2563eb; border-color: #bfdbfe; }
        .modal-footer-note .act-btn.download:hover { background: #d1fae5; color: #059669; border-color: #a7f3d0; }
        @media (max-width: 768px) {
          body { padding: 0.8rem; }
          .page-title h1 { font-size: 1.1rem; }
          .page-title .sub { display: none; }
          .stats-compact { gap: 0.2rem 0.6rem; padding: 0.2rem 0.6rem; }
          .stats-compact .stat-item .num { font-size: 0.9rem; }
          .stats-compact .stat-item .label { font-size: 0.5rem; }
          .stats-compact .stat-item .icon { width: 22px; height: 22px; font-size: 0.6rem; }
          .modal { max-width: 95%; }
          .modal-table { font-size: 0.7rem; }
          .modal-table thead th,
          .modal-table tbody td { padding: 0.25rem 0.3rem; }
        }
      `}</style>

      <div className="app-wrapper">
        {/* HEADER */}
        <header className="page-header">
          <div className="page-title">
            <div className="icon-wrap"><i className="fas fa-user-graduate"></i></div>
            <div>
              <h1>My Portal <span className="sub">· Student Dashboard</span></h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={loadAllData}><i className="fas fa-sync-alt"></i> Refresh</button>
          </div>
        </header>

        {/* STATS */}
        <div className="stats-compact">
          <span className="stat-item">
            <span className="icon blue"><i className="fas fa-tasks"></i></span>
            <span className="num">{taskCounts.total}</span>
            <span className="label">Tasks</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon orange"><i className="fas fa-clock"></i></span>
            <span className="num">{taskCounts.pending}</span>
            <span className="label">Pending</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon green"><i className="fas fa-check-circle"></i></span>
            <span className="num">{taskCounts.completed}</span>
            <span className="label">Completed</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon purple"><i className="fas fa-file-alt"></i></span>
            <span className="num">{reportCards.length}</span>
            <span className="label">Report Cards</span>
          </span>
          <span className="divider">|</span>
          <span className="stat-item">
            <span className="icon red"><i className="fas fa-dollar-sign"></i></span>
            <span className="num">{balance ? balance.toLocaleString() : '0'}</span>
            <span className="label">Balance</span>
          </span>
        </div>

        {/* ===== CARD GRID ===== */}
        {loading ? (
          <div className="loading-state">Loading your dashboard...</div>
        ) : (
          <div className="card-grid">
            {/* CARD 1: My Tasks */}
            <div className="dash-card" onClick={() => openModal('tasks')}>
              <div className="card-icon blue"><i className="fas fa-tasks"></i></div>
              <div className="card-content">
                <div className="info">
                  <div className="title">My Tasks</div>
                  <div className="subtitle">{taskCounts.total} total · {taskCounts.pending} pending</div>
                </div>
                <span className="badge-count warning">{taskCounts.pending}</span>
                <span className="card-arrow"><i className="fas fa-chevron-right"></i></span>
              </div>
            </div>

            {/* CARD 2: Report Cards */}
            <div className="dash-card" onClick={() => openModal('report-cards')}>
              <div className="card-icon purple"><i className="fas fa-file-alt"></i></div>
              <div className="card-content">
                <div className="info">
                  <div className="title">Report Cards</div>
                  <div className="subtitle">{reportCards.length} available</div>
                </div>
                <span className="badge-count success">{reportCards.length}</span>
                <span className="card-arrow"><i className="fas fa-chevron-right"></i></span>
              </div>
            </div>

            {/* CARD 3: My Fees */}
            <div className="dash-card" onClick={() => openModal('fees')}>
              <div className="card-icon green"><i className="fas fa-dollar-sign"></i></div>
              <div className="card-content">
                <div className="info">
                  <div className="title">My Fees</div>
                  <div className="subtitle">TZS {balance ? balance.toLocaleString() : '0'} outstanding</div>
                </div>
                <span className="badge-count urgent">{balance ? '3' : '0'}</span>
                <span className="card-arrow"><i className="fas fa-chevron-right"></i></span>
              </div>
            </div>

            {/* CARD 4: Announcements */}
            <div className="dash-card" onClick={() => openModal('announcements')}>
              <div className="card-icon orange"><i className="fas fa-bell"></i></div>
              <div className="card-content">
                <div className="info">
                  <div className="title">Announcements</div>
                  <div className="subtitle">{announcements.length} new</div>
                </div>
                <span className="badge-count urgent">{announcements.length}</span>
                <span className="card-arrow"><i className="fas fa-chevron-right"></i></span>
              </div>
            </div>

            {/* CARD 5: My Results */}
            <div className="dash-card" onClick={() => openModal('results')}>
              <div className="card-icon purple"><i className="fas fa-chart-line"></i></div>
              <div className="card-content">
                <div className="info">
                  <div className="title">My Results</div>
                  <div className="subtitle">{grades.length} subjects graded</div>
                </div>
                <span className="badge-count success">{grades.length}</span>
                <span className="card-arrow"><i className="fas fa-chevron-right"></i></span>
              </div>
            </div>

            {/* CARD 6: Almanac */}
            <div className="dash-card" onClick={() => openModal('almanac')}>
              <div className="card-icon blue"><i className="fas fa-calendar-alt"></i></div>
              <div className="card-content">
                <div className="info">
                  <div className="title">Almanac</div>
                  <div className="subtitle">{almanacEvents.length} upcoming events</div>
                </div>
                <span className="badge-count warning">{almanacEvents.length}</span>
                <span className="card-arrow"><i className="fas fa-chevron-right"></i></span>
              </div>
            </div>
          </div>
        )}


        {/* FOOTER */}
        <div className="footer-note">
          <i className="fas fa-hand-pointer"></i> Click any card to view details
        </div>
      </div>

      {/* ======================== MODAL: TASKS ======================== */}
      <div className={`modal-overlay ${openSection === 'tasks' ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal">
          <div className="modal-header">
            <h2><span className="icon-sm blue"><i className="fas fa-tasks"></i></span> My Tasks</h2>
            <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {sectionLoading === 'tasks' ? (
              <div className="loading-state">Loading your tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="empty-state">No tasks assigned yet</div>
            ) : (

              <table className="modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Task</th>
                    <th>Type</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Performance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, idx) => {
                    const perf = getPerformanceLevel(task.score);
                    const hasScore = task.score !== null && task.score !== undefined;
                    return (
                      <tr key={task._id || idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{task.title || 'Untitled'}</strong>
                          {task.feedback && (
                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                              💬 "{task.feedback}"
                            </div>
                          )}
                        </td>
                        <td><span className={`type-badge ${task.task_type || 'homework'}`}>{(TASK_TYPE_INFO[task.task_type]?.label || task.task_type || 'Homework')}</span></td>
                        <td>{task.subject_name || 'N/A'}</td>
                        <td>{getStatusBadge(task.my_status)}</td>
                        <td>
                          {hasScore ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className={`perf-badge ${perf?.cls || ''}`}>{perf?.label || '—'}</span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>{task.score}/100</span>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            <button className="act-btn view" onClick={() => setViewTask(task)}>👁 View</button>
                            <button className="act-btn download" onClick={() => handleDownloadTask(task, 'pdf')}>⬇ Download</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            )}
            <div className="modal-footer-note">
              <i className="fas fa-info-circle"></i> {tasks.length} tasks shown · Click <i className="fas fa-eye"></i> to view full task details or <i className="fas fa-download"></i> to download
            </div>

          </div>
        </div>
      </div>

      {/* ======================== MODAL: VIEW TASK DETAIL ======================== */}
      <div className={`modal-overlay ${viewTask ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setViewTask(null); }}>
        <div className="modal" style={{ maxWidth: '620px' }}>
          <div className="modal-header">
            <h2><span className="icon-sm blue"><i className="fas fa-tasks"></i></span> Task Details</h2>
            <button className="modal-close" onClick={() => setViewTask(null)}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {viewTask && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <span className={`type-badge ${viewTask.task_type || 'homework'}`}>{(TASK_TYPE_INFO[viewTask.task_type]?.label || viewTask.task_type || 'Homework')}</span>
                  {getStatusBadge(viewTask.my_status)}
                  {viewTask.score !== null && viewTask.score !== undefined && (
                    <span className={`perf-badge ${getPerformanceLevel(viewTask.score)?.cls || ''}`}>{getPerformanceLevel(viewTask.score)?.label || '—'}</span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', lineHeight: 1.3 }}>
                  {viewTask.title || 'Untitled Task'}
                </h3>
                <div className="detail-row"><span className="label">Subject</span><span className="value">{viewTask.subject_name || 'N/A'}</span></div>
                <div className="detail-row"><span className="label">Class</span><span className="value">{viewTask.class_name || 'N/A'}</span></div>
                <div className="detail-row"><span className="label">Assigned By</span><span className="value">{viewTask.assigned_by_name || 'Teacher'}</span></div>
                <div className="detail-row"><span className="label">Due Date</span><span className="value">{viewTask.due_date ? new Date(viewTask.due_date).toLocaleDateString() : 'No due date'}</span></div>
                <div className="detail-row"><span className="label">Status</span><span className="value">{getStatusBadge(viewTask.my_status)}</span></div>
                {viewTask.score !== null && viewTask.score !== undefined && (
                  <div className="detail-row"><span className="label">Score</span><span className="value" style={{ fontWeight: 700, color: '#059669' }}>{viewTask.score}/100</span></div>
                )}
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Description</div>
                  <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                    {viewTask.description || 'No description provided.'}
                  </div>
                </div>
                {viewTask.feedback && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Teacher Feedback</div>
                    <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem', fontStyle: 'italic' }}>
                      "{viewTask.feedback}"
                    </div>
                  </div>
                )}
                {viewTask.attachments && viewTask.attachments.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Attachments ({viewTask.attachments.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {viewTask.attachments.map((att, ai) => {
                        let name = `Attachment ${ai + 1}`;
                        if (typeof att === 'string') {
                          if (att.startsWith('data:')) {
                            const mimeMatch = att.match(/^data:([^;]+);/);
                            const mimeType = mimeMatch ? mimeMatch[1] : 'file';
                            name = `Attachment ${ai + 1}.${mimeType.split('/')[1] || 'bin'}`;
                          } else if (att.startsWith('http')) {
                            const parts = att.split('/');
                            name = parts[parts.length - 1] || `Attachment ${ai + 1}`;
                          }
                        }
                        return (
                          <div key={ai} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <i className="fas fa-paperclip" style={{ marginRight: '0.4rem', color: '#64748b' }}></i>{name}
                            </span>
                            <button className="act-btn download" onClick={() => handleDownloadTask(viewTask, 'pdf')}><i className="fas fa-download"></i> Download</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="modal-footer-note">
                  <button className="act-btn download" onClick={() => handleDownloadTask(viewTask, 'pdf')}><i className="fas fa-file-pdf"></i> PDF</button>
                  <button className="act-btn download" onClick={() => handleDownloadTask(viewTask, 'docx')}><i className="fas fa-file-word"></i> DOCX</button>
                  <button className="act-btn download" onClick={() => handleDownloadTask(viewTask, 'png')}><i className="fas fa-image"></i> PNG</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======================== MODAL: REPORT CARDS ======================== */}
      <div className={`modal-overlay ${openSection === 'report-cards' ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>

        <div className="modal">
          <div className="modal-header">
            <h2><span className="icon-sm purple"><i className="fas fa-file-alt"></i></span> Report Cards</h2>
            <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {sectionLoading === 'report-cards' ? (
              <div className="loading-state">Loading your report cards...</div>
            ) : reportCards.length === 0 ? (
              <div className="empty-state">No report cards have been sent to you yet</div>
            ) : (

              <table className="modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Term</th>
                    <th>Year</th>
                    <th>Subjects</th>
                    <th>Average</th>
                    <th>Grade</th>
                    <th>Position</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportCards.map((rc, idx) => (
                    <tr key={rc._id || rc.id || idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{rc.term || 'N/A'}</strong></td>
                      <td>{rc.academic_year || 'N/A'}</td>
                      <td>{rc.grades?.length || 0}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{rc.average || 0}</td>
                      <td><span style={{ display: 'inline-block', padding: '0.05rem 0.4rem', borderRadius: '20px', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>{rc.overall_grade || rc.grade || 'N/A'}</span></td>
                      <td>{rc.position ? `${rc.position}/${rc.total_students || '?'}` : 'N/A'}</td>
                      <td>
                        <button className="act-btn view" onClick={() => handleViewReportCard(rc)}>👁 View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="modal-footer-note">
              <i className="fas fa-info-circle"></i> Click <i className="fas fa-eye"></i> to view full report card with comments
            </div>
          </div>
        </div>
      </div>

      {/* ======================== MODAL: FEES ======================== */}
      <div className={`modal-overlay ${openSection === 'fees' ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal">
          <div className="modal-header">
            <h2><span className="icon-sm green"><i className="fas fa-dollar-sign"></i></span> My Fees</h2>
            <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {sectionLoading === 'fees' ? (
              <div className="loading-state">Loading your fee records...</div>
            ) : (
            <>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: '8px', padding: '0.8rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Total Fees</div>

                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>TZS {(feeData?.total_fees || 0).toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: '8px', padding: '0.8rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Paid</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>TZS {(feeData?.total_paid || feeData?.paid || 0).toLocaleString()}</div>
              </div>

              <div style={{ flex: 1, background: '#f8fafc', borderRadius: '8px', padding: '0.8rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Balance</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dc2626' }}>TZS {(feeData?.balance || 0).toLocaleString()}</div>
              </div>
            </div>
            {feeData?.payments && feeData.payments.length > 0 ? (
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fee Type</th>
                    <th>Amount (TZS)</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feeData.payments.map((item, idx) => (
                    <tr key={item._id || item.id || idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{item.fee_type || item.fee_name || 'Payment'}</strong></td>
                      <td>{(item.amount || 0).toLocaleString()}</td>
                      <td style={{ textTransform: 'capitalize' }}>{item.payment_method || 'cash'}</td>
                      <td style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.reference_no || '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No fee records found</div>
            )}

            <div className="modal-footer-note">
              <i className="fas fa-info-circle"></i> Total outstanding: <strong style={{ color: '#dc2626' }}>TZS {(feeData?.balance || 0).toLocaleString()}</strong>
            </div>
            </>
            )}
          </div>
        </div>
      </div>

      {/* ======================== MODAL: ANNOUNCEMENTS ======================== */}

      <div className={`modal-overlay ${openSection === 'announcements' ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal">
          <div className="modal-header">
            <h2><span className="icon-sm orange"><i className="fas fa-bell"></i></span> Announcements</h2>
            <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {sectionLoading === 'announcements' ? (
              <div className="loading-state">Loading announcements...</div>
            ) : announcements.length === 0 ? (
              <div className="empty-state">No announcements yet</div>
            ) : (

              <table className="modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Posted By</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((ann, idx) => (
                    <tr key={ann._id || idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{ann.title || 'Untitled'}</strong></td>
                      <td><span style={{ display: 'inline-block', padding: '0.05rem 0.4rem', borderRadius: '20px', fontSize: '0.55rem', fontWeight: 600, background: ann.priority === 'urgent' ? '#fee2e2' : '#dbeafe', color: ann.priority === 'urgent' ? '#dc2626' : '#2563eb' }}>{ann.priority === 'urgent' ? 'Urgent' : 'General'}</span></td>
                      <td>{ann.created_by_name || 'Admin'}</td>
                      <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <button className="act-btn view" onClick={() => setSelectedAnnouncement(ann)}>👁 View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

            )}
            <div className="modal-footer-note">
              <i className="fas fa-info-circle"></i> Click <i className="fas fa-eye"></i> to view full announcement details
            </div>
          </div>
        </div>
      </div>

      {/* ======================== MODAL: ANNOUNCEMENT ZOOM CARD ======================== */}
      <div className={`modal-overlay ${selectedAnnouncement ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setSelectedAnnouncement(null); }}>
        <div className="modal" style={{ maxWidth: '560px' }}>
          <div className="modal-header">
            <h2><span className="icon-sm orange"><i className="fas fa-bell"></i></span> Announcement</h2>
            <button className="modal-close" onClick={() => setSelectedAnnouncement(null)}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {selectedAnnouncement && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700, background: selectedAnnouncement.priority === 'urgent' ? '#fee2e2' : '#dbeafe', color: selectedAnnouncement.priority === 'urgent' ? '#dc2626' : '#2563eb' }}>
                    {selectedAnnouncement.priority === 'urgent' ? '🔴 URGENT' : '📢 General'}
                  </span>
                  <span style={{ fontSize: '9px', color: '#94a3b8' }}>
                    {selectedAnnouncement.created_at ? new Date(selectedAnnouncement.created_at).toLocaleString() : ''}
                  </span>

                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', lineHeight: 1.3 }}>
                  {selectedAnnouncement.title || 'Untitled'}
                </h3>
                <div style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                  {selectedAnnouncement.body || selectedAnnouncement.message || selectedAnnouncement.content || 'No content provided.'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                    {(selectedAnnouncement.created_by_name || 'A').charAt(0).toUpperCase()}
                  </span>
                  <span><strong>{selectedAnnouncement.created_by_name || 'Admin'}</strong> · {selectedAnnouncement.audience || selectedAnnouncement.target || 'All Students'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======================== MODAL: MY RESULTS ======================== */}
      <div className={`modal-overlay ${openSection === 'results' ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>

        <div className="modal">
          <div className="modal-header">
            <h2><span className="icon-sm purple"><i className="fas fa-chart-line"></i></span> My Results</h2>
            <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {sectionLoading === 'results' ? (
              <div className="loading-state">Loading your results...</div>
            ) : grades.length === 0 ? (
              <div className="empty-state">No results have been published yet</div>
            ) : (

              <table className="modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject</th>
                    <th>Score</th>
                    <th>Grade</th>
                    <th>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g, idx) => {
                    const perf = getPerformanceLevel(g.score);
                    return (
                      <tr key={g._id || g.id || idx}>
                        <td>{idx + 1}</td>
                        <td><strong>{g.subject_name || g.subject || 'Unknown'}</strong></td>
                        <td style={{ fontWeight: 700 }}>{g.score !== null && g.score !== undefined ? g.score : '—'}</td>
                        <td><span style={{ display: 'inline-block', padding: '0.05rem 0.4rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>{g.grade || 'N/A'}</span></td>
                        <td>{perf ? <span className={`perf-badge ${perf.cls}`}>{perf.label}</span> : <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="modal-footer-note">
              <i className="fas fa-info-circle"></i> {grades.length} subjects graded · Performance based on latest scores
            </div>
          </div>
        </div>
      </div>

      {/* ======================== MODAL: ALMANAC ======================== */}
      <div className={`modal-overlay ${openSection === 'almanac' ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal">
          <div className="modal-header">
            <h2><span className="icon-sm blue"><i className="fas fa-calendar-alt"></i></span> Almanac</h2>
            <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {sectionLoading === 'almanac' ? (
              <div className="loading-state">Loading the school almanac...</div>
            ) : almanacEvents.length === 0 ? (
              <div className="empty-state">No upcoming events in the school almanac</div>
            ) : (

              <table className="modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {almanacEvents.map((ev, idx) => (
                    <tr key={ev._id || ev.id || idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{ev.title || ev.name || 'Event'}</strong></td>
                      <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{ev.start_date ? new Date(ev.start_date).toLocaleDateString() : (ev.date ? new Date(ev.date).toLocaleDateString() : '—')}</td>
                      <td><span style={{ display: 'inline-block', padding: '0.05rem 0.4rem', borderRadius: '20px', fontSize: '0.55rem', fontWeight: 600, background: '#dbeafe', color: '#2563eb' }}>{ev.visibility || ev.type || ev.category || 'General'}</span></td>
                    </tr>
                  ))}

                </tbody>
              </table>
            )}
            <div className="modal-footer-note">
              <i className="fas fa-info-circle"></i> {almanacEvents.length} events in the school calendar
            </div>
          </div>
        </div>
      </div>

      {/* ======================== MODAL: FULL REPORT CARD DETAIL ======================== */}
      <div className={`modal-overlay ${showReportCardModal ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setShowReportCardModal(false); }}>

        <div className="modal">
          <div className="modal-header">
            <h2><span className="icon-sm purple"><i className="fas fa-file-alt"></i></span> Report Card · {selectedReportCard?.term || ''}</h2>
            <button className="modal-close" onClick={() => setShowReportCardModal(false)}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            {selectedReportCard && (
              <>
                <div className="detail-row"><span className="label">Term</span><span className="value"><strong>{selectedReportCard.term}</strong></span></div>
                <div className="detail-row"><span className="label">Academic Year</span><span className="value">{selectedReportCard.academic_year}</span></div>
                <div className="detail-row"><span className="label">Subjects</span><span className="value">{selectedReportCard.grades?.length || 0}</span></div>
                <div className="detail-row"><span className="label">Average Score</span><span className="value" style={{ fontWeight: 700, color: '#059669' }}>{selectedReportCard.average}%</span></div>
                <div className="detail-row"><span className="label">Overall Grade</span><span className="value"><span style={{ display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: '20px', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>{selectedReportCard.overall_grade || selectedReportCard.grade}</span></span></div>
                <div className="detail-row"><span className="label">Position</span><span className="value">{selectedReportCard.position}{selectedReportCard.total_students ? ` / ${selectedReportCard.total_students}` : ''}</span></div>
                {selectedReportCard.teacher_comment && (
                  <div className="detail-row"><span className="label">Teacher's Comment</span><span className="value" style={{ fontStyle: 'italic' }}>"{selectedReportCard.teacher_comment}"</span></div>
                )}
                {selectedReportCard.principal_comment && (
                  <div className="detail-row"><span className="label">Principal's Comment</span><span className="value" style={{ fontStyle: 'italic' }}>"{selectedReportCard.principal_comment}"</span></div>
                )}
                {selectedReportCard.grades && selectedReportCard.grades.length > 0 && (
                  <>
                    <div style={{ marginTop: '1rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject Performance</div>
                    <table className="modal-table" style={{ marginTop: '0.5rem' }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Subject</th>
                          <th>Score</th>
                          <th>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReportCard.grades.map((g, gi) => (
                          <tr key={g._id || gi}>
                            <td>{gi + 1}</td>
                            <td><strong>{g.subject_name || 'Unknown'}</strong></td>
                            <td>{g.score !== null && g.score !== undefined ? g.score : '—'}</td>
                            <td><span style={{ display: 'inline-block', padding: '0.05rem 0.4rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700, background: '#d1fae5', color: '#059669' }}>{g.grade || 'N/A'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                <div className="modal-footer-note">
                  <button className="act-btn download" onClick={() => handleDownloadReportCard('pdf')}><i className="fas fa-file-pdf"></i> PDF</button>
                  <button className="act-btn download" onClick={() => handleDownloadReportCard('docx')}><i className="fas fa-file-word"></i> DOCX</button>
                  <button className="act-btn download" onClick={() => handleDownloadReportCard('png')}><i className="fas fa-image"></i> PNG</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentPortal;

