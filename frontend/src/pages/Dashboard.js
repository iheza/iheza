import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectCurrentPortal } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { apiClient } from '../services/authService';
import GenerateChain from '../components/Principal/GenerateChain';
import { toast } from '../hooks/useSoundEnabledToast';
import { 
  Users, GraduationCap, Calendar, ClipboardList, 
  TrendingUp, BookOpen, DollarSign, Database,
  FileText, Award, Sparkles, UserPlus, TrendingDown
} from 'lucide-react';


function Dashboard() {
  const currentUser = useSelector(selectCurrentUser);
  const currentPortal = useSelector(selectCurrentPortal);
  const [stats, setStats] = useState({
    students: 0,
    staff: 0,
    classes: 0,
    subjects: 0,
  });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [whatsNew, setWhatsNew] = useState({
    payments: [],
    documents: [],
    teacherAnalytics: [],
    upcomingEvents: [],
    newAdmissions: [],
  });
  const [activeCategory, setActiveCategory] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next');


  // Only these roles can see Staff Management
  const canManageStaff = ['director', 'coordinator', 'principal'].includes(currentUser?.role?.toLowerCase());

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const syncData = await dataService.syncData();
      
      setStats({
        students: syncData.students?.length || 0,
        staff: syncData.staff?.length || 0,
        classes: syncData.classes?.length || 0,
        subjects: syncData.subjects?.length || 0,
      });

      // Fetch all "What's new" data in parallel
      const [
        paymentsRes,
        documentsRes,
        gradesRes,
        subjectsRes,
        usersRes,
        almanacRes,
        admissionsRes
      ] = await Promise.allSettled([
        apiClient.get('/payments'),
        apiClient.get('/documents'),
        apiClient.get('/grades'),
        apiClient.get('/subjects'),
        apiClient.get('/users'),
        apiClient.get('/almanac'),
        apiClient.get('/admissions'),
      ]);

      // 1. Recent payments (when a student's payments are edited)
      const payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data || []) : [];
      const recentPayments = payments
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);

      // 2. Recent document uploads and auto-saves
      const documents = documentsRes.status === 'fulfilled' ? (documentsRes.value.data || []) : [];
      const recentDocuments = documents
        .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))
        .slice(0, 5);

      // 3. Teacher performance analytics (high and low performing teachers)
      const grades = gradesRes.status === 'fulfilled' ? (gradesRes.value.data || []) : [];
      const subjects = subjectsRes.status === 'fulfilled' ? (subjectsRes.value.data || []) : [];
      const users = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : [];
      
      // Map subject_id -> teacher_id, then teacher_id -> teacher name
      const subjectTeacherMap = {};
      subjects.forEach(sub => {
        if (sub.teacher_id) subjectTeacherMap[sub.id] = sub.teacher_id;
      });
      
      const teacherNameMap = {};
      users.forEach(u => {
        if (u.role === 'teacher' || u.role === 'academic') {
          teacherNameMap[u.id] = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.access_code;
        }
      });
      
      // Group grades by subject, compute average score per teacher
      const teacherScores = {};
      grades.forEach(g => {
        const teacherId = subjectTeacherMap[g.subject_id];
        if (!teacherId) return;
        if (!teacherScores[teacherId]) {
          teacherScores[teacherId] = { total: 0, count: 0, subject: '' };
        }
        teacherScores[teacherId].total += g.score || 0;
        teacherScores[teacherId].count += 1;
        teacherScores[teacherId].subject = g.subject_id;
      });
      
      const teacherAnalytics = Object.entries(teacherScores)
        .map(([teacherId, data]) => ({
          teacherId,
          teacherName: teacherNameMap[teacherId] || 'Unknown Teacher',
          average: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
          subjectCount: data.count,
        }))
        .sort((a, b) => b.average - a.average)
        .slice(0, 5);

      // 4. Upcoming events from the almanac
      const almanacData = almanacRes.status === 'fulfilled' ? (almanacRes.value.data || {}) : {};
      const events = almanacData.events || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcomingEvents = events
        .filter(e => {
          const startDate = new Date(e.start_date);
          return startDate >= today;
        })
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
        .slice(0, 5);

      // 5. New admissions (most recent)
      const admissions = admissionsRes.status === 'fulfilled' ? (admissionsRes.value.data || []) : [];
      const recentAdmissions = admissions
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);

      setWhatsNew({
        payments: recentPayments,
        documents: recentDocuments,
        teacherAnalytics,
        upcomingEvents,
        newAdmissions: recentAdmissions,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  // Build list of available categories (only those with data)
  const availableCategories = [];
  if (whatsNew.payments.length > 0) availableCategories.push('payments');
  if (whatsNew.documents.length > 0) availableCategories.push('documents');
  if (whatsNew.teacherAnalytics.length > 0) availableCategories.push('teacherAnalytics');
  if (whatsNew.upcomingEvents.length > 0) availableCategories.push('upcomingEvents');
  if (whatsNew.newAdmissions.length > 0) availableCategories.push('newAdmissions');

  // Auto-rotate categories every 4 seconds
  useEffect(() => {
    if (availableCategories.length <= 1) return;
    const timer = setInterval(() => {
      setSlideDirection('next');
      setActiveCategory(prev => (prev + 1) % availableCategories.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [availableCategories.length]);

  // Import DLP data function
  const handleImportDLPData = async () => {

    if (!window.confirm('This will import 88 DLP students, 6 classes, and 6 subjects. Continue?')) {
      return;
    }
    
    try {
      setImporting(true);
      const response = await apiClient.post('/import-dlp-data');
      const data = response.data;
      
      toast.success(`Import successful! Students: ${data.total_dlp_students}, Classes: ${data.total_dlp_classes}, Subjects: ${data.total_dlp_subjects}`);
      
      // Reload dashboard data
      await loadDashboardData();
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import DLP data. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  // Import DUP Grade 7 data function - REAL DATA
  const handleImportDUPGrade7 = async () => {
    if (!window.confirm('This will import your REAL 11 Grade 7 students and 34 Almanac events. Continue?')) {
      return;
    }
    
    try {
      setImporting(true);
      const response = await apiClient.post('/import-dup-grade7');
      const data = response.data;
      
      const imported = data.imported || {};
      toast.success(`Import successful! Students: ${imported.students_inserted || 0} new, ${imported.students_updated || 0} updated. Almanac: ${imported.almanac_inserted || 0} new, ${imported.almanac_updated || 0} updated.`);
      
      // Reload dashboard data
      await loadDashboardData();
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import DUP Grade 7 data. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  // Show import button for DLP chain Principal/Director - DISABLED for now
  const showDLPImportButton = false;

  // Show import button for DUP chain Principal/Director
  const showDUPImportButton = currentUser?.chain === 'DUP' && 
    ['principal', 'director'].includes(currentUser?.role?.toLowerCase());

  const StatCard = ({ icon: Icon, label, value, color, trend }) => (
    <div className="stat-card" style={{ '--stat-color': color }}>
      <div className="stat-icon">
        <Icon size={24} />
      </div>
      <div className="stat-info">
        <div className="stat-value">{loading ? '...' : value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {trend && (
        <div className="stat-trend">
          <TrendingUp size={14} />
          {trend}
        </div>
      )}
    </div>
  );

  const QuickAction = ({ icon: Icon, label, onClick, color }) => (
    <button className="quick-action" style={{ '--action-color': color }} onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="dashboard">
      <style>{`
        .dashboard {
          padding: 1.5rem;
        }
        
        .dashboard-header {
          margin-bottom: 2rem;
        }
        
        .dashboard-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 0.5rem;
        }
        
        .dashboard-header p {
          color: #94a3b8;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }
        
        .stat-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          height: 50px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
        }
        
        .stat-card:hover {
          border-color: var(--stat-color);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        
        .stat-icon {
          width: 32px;
          height: 32px;
          background: var(--stat-color);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        
        .stat-icon svg {
          width: 16px;
          height: 16px;
        }
        
        .stat-info {
          flex: 1;
          min-width: 0;
        }
        
        .stat-value {
          font-size: 1rem;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.1;
        }
        
        .stat-label {
          color: #94a3b8;
          font-size: 0.7rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .stat-trend {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: #22c55e;
          font-size: 0.7rem;
          font-weight: 500;
          flex-shrink: 0;
        }

        
        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }
        
        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .section-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          overflow: hidden;
        }
        
        .section-card.whats-new-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.08);
        }
        
        .section-card.whats-new-card .section-header {
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        }
        
        .section-card.whats-new-card .section-title {
          color: #1e3a8a;
        }
        
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .section-title {
          font-size: 1rem;
          font-weight: 600;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .section-content {
          padding: 1.5rem;
        }

        
        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        
        .quick-action {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(51, 65, 85, 0.3);
          border: 1px solid transparent;
          border-radius: 0.75rem;
          color: #f8fafc;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          font-size: 0.875rem;
          font-weight: 500;
        }
        
        .quick-action:hover {
          background: var(--action-color);
          border-color: var(--action-color);
        }
        
        .announcement-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .announcement-item {
          padding: 1rem;
          background: rgba(51, 65, 85, 0.3);
          border-radius: 0.75rem;
          border-left: 3px solid #3b82f6;
        }
        
        .announcement-title {
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 0.25rem;
        }
        
        .announcement-date {
          font-size: 0.75rem;
          color: #64748b;
        }
        
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #64748b;
        }
        
        /* What's New section styles */
        .whats-new-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .whats-new-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: #ffffff;
          border-radius: 0.75rem;
          border-left: 4px solid #2563eb;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
          transition: all 0.3s ease;
          opacity: 0;
          transform: translateX(-20px);
          animation: slideInItem 0.5s ease forwards;
        }
        
        @keyframes slideInItem {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .whats-new-item:hover {
          background: #f0f7ff;
          transform: translateX(4px);
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.15);
        }
        
        .whats-new-item.payment {
          border-left-color: #2563eb;
        }
        
        .whats-new-item.document {
          border-left-color: #7c3aed;
        }
        
        .whats-new-item.teacher {
          border-left-color: #d97706;
        }
        
        .whats-new-item.event {
          border-left-color: #2563eb;
        }
        
        .whats-new-item.admission {
          border-left-color: #dc2626;
        }
        
        .whats-new-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        
        .whats-new-icon.payment { background: #2563eb; }
        .whats-new-icon.document { background: #7c3aed; }
        .whats-new-icon.teacher { background: #d97706; }
        .whats-new-icon.event { background: #2563eb; }
        .whats-new-icon.admission { background: #dc2626; }
        
        .whats-new-content {
          flex: 1;
          min-width: 0;
        }
        
        .whats-new-title {
          font-weight: 600;
          color: #1e3a8a;
          font-size: 0.875rem;
          margin-bottom: 0.125rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .whats-new-desc {
          font-size: 0.75rem;
          color: #3b82f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .whats-new-time {
          font-size: 0.7rem;
          color: #dc2626;
          flex-shrink: 0;
          margin-left: auto;
          padding-left: 0.5rem;
          font-weight: 500;
        }
        
        .whats-new-section {
          margin-bottom: 1.25rem;
        }
        
        .whats-new-section:last-child {
          margin-bottom: 0;
        }
        
        .whats-new-section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e3a8a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }
        
        .teacher-score {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
        }
        
        .teacher-score.high {
          background: #dbeafe;
          color: #1d4ed8;
        }
        
        .teacher-score.low {
          background: #fee2e2;
          color: #dc2626;
        }
        
        /* Carousel styles */
        .whats-new-carousel {
          position: relative;
          overflow: hidden;
          min-height: 200px;
        }
        
        .whats-new-slide {
          animation: slideInFromRight 0.6s ease forwards;
        }
        
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(60px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .whats-new-dots {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
        }
        
        .whats-new-dot {
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          border: none;
          background: #cbd5e1;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 0;
        }
        
        .whats-new-dot.active {
          background: #2563eb;
          width: 24px;
          border-radius: 9999px;
        }
        
        .whats-new-dot:hover {
          background: #93c5fd;
        }



        
        .welcome-banner {
          background: linear-gradient(135deg, #0f4c81 0%, #1a5f9e 100%);
          border-radius: 0.75rem;
          padding: 0.5rem 1rem;
          height: 50px;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        
        .welcome-text {
          display: flex;
          align-items: center;
          gap: 1rem;
          min-width: 0;
        }
        
        .welcome-text h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .welcome-text p {
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.875rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        
        .welcome-badge {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          color: white;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: capitalize;
          flex-shrink: 0;
        }

      `}</style>
      
      <div className="welcome-banner">
        <div className="welcome-text">
          <h2>Welcome back, {currentUser?.name || 'User'}!</h2>
          <p>Here's what's happening at IHEZA today.</p>
        </div>
        <div className="welcome-badge">
          {currentPortal} Portal
        </div>
      </div>
      
      {/* Generate New Chain Component - Only for DUP/PRINCIPAL/0002/2021 */}
      {currentUser?.access_code === 'DUP/PRINCIPAL/0002/2021' && (
        <GenerateChain />
      )}
      
      {/* Import DLP Data Button */}
      {showDLPImportButton && (
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{ color: 'white', fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              Setup DLP School Data
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem' }}>
              Import 88 students, 6 classes, and 6 subjects for DLP chain.
            </p>
          </div>
          <button
            onClick={handleImportDLPData}
            disabled={importing}
            style={{
              background: 'white',
              color: '#d97706',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: '600',
              cursor: importing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: importing ? 0.7 : 1
            }}
          >
            <Database size={18} />
            {importing ? 'Importing...' : 'Import DLP Data'}
          </button>
        </div>
      )}

      {/* Import DUP Grade 7 Data Button */}
      {showDUPImportButton && (
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{ color: 'white', fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              Import REAL Grade 7 Students & Almanac
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem' }}>
              Import your 11 real Grade 7 students (WALID, SUHEIL, SAIMINA, etc.) and 34 almanac events.
            </p>
          </div>
          <button
            onClick={handleImportDUPGrade7}
            disabled={importing}
            style={{
              background: 'white',
              color: '#2563eb',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: '600',
              cursor: importing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: importing ? 0.7 : 1
            }}
          >
            <Database size={18} />
            {importing ? 'Importing...' : 'Import Grade 7'}
          </button>
        </div>
      )}

      <div className="stats-grid">
        <StatCard 
          icon={GraduationCap} 
          label="Total Students" 
          value={stats.students}
          color="#10b981"
        />
        {canManageStaff && (
          <StatCard 
            icon={Users} 
            label="Staff Members" 
            value={stats.staff}
            color="#3b82f6"
          />
        )}
        <StatCard 
          icon={BookOpen} 
          label="Active Classes" 
          value={stats.classes}
          color="#8b5cf6"
        />
        <StatCard 
          icon={ClipboardList} 
          label="Subjects" 
          value={stats.subjects}
          color="#f59e0b"
        />
      </div>
      
      <div className="dashboard-grid">
        <div className="section-card whats-new-card">
          <div className="section-header">
            <h3 className="section-title">
              <Sparkles size={18} />
              What's New
            </h3>
          </div>

          <div className="section-content">
            {loading ? (
              <div className="empty-state">Loading latest activity...</div>
            ) : availableCategories.length === 0 ? (
              <div className="empty-state">No recent activity yet</div>
            ) : (
              <div className="whats-new-carousel">
                {/* Only show the active category */}
                {availableCategories[activeCategory] === 'payments' && (
                  <div className="whats-new-section whats-new-slide">
                    <div className="whats-new-section-title">
                      <DollarSign size={14} />
                      Recent Payments
                    </div>
                    {whatsNew.payments.map((p, idx) => (
                      <div key={`pay-${idx}`} className="whats-new-item payment" style={{ animationDelay: `${idx * 0.15}s` }}>
                        <div className="whats-new-icon payment">
                          <DollarSign size={16} />
                        </div>
                        <div className="whats-new-content">
                          <div className="whats-new-title">
                            Payment of ${p.amount || 0} {p.fee_type ? `(${p.fee_type})` : ''}
                          </div>
                          <div className="whats-new-desc">
                            {p.payment_method || 'cash'} · {p.reference_no || 'No reference'}
                          </div>
                        </div>
                        <div className="whats-new-time">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {availableCategories[activeCategory] === 'documents' && (
                  <div className="whats-new-section whats-new-slide">
                    <div className="whats-new-section-title">
                      <FileText size={14} />
                      Document Uploads
                    </div>
                    {whatsNew.documents.map((d, idx) => (
                      <div key={`doc-${idx}`} className="whats-new-item document" style={{ animationDelay: `${idx * 0.15}s` }}>
                        <div className="whats-new-icon document">
                          <FileText size={16} />
                        </div>
                        <div className="whats-new-content">
                          <div className="whats-new-title">{d.name || 'Document'}</div>
                          <div className="whats-new-desc">
                            {d.source || 'upload'} · {d.type || 'file'}
                          </div>
                        </div>
                        <div className="whats-new-time">
                          {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {availableCategories[activeCategory] === 'teacherAnalytics' && (
                  <div className="whats-new-section whats-new-slide">
                    <div className="whats-new-section-title">
                      <Award size={14} />
                      Teacher Performance
                    </div>
                    {whatsNew.teacherAnalytics.map((t, idx) => (
                      <div key={`teacher-${idx}`} className="whats-new-item teacher" style={{ animationDelay: `${idx * 0.15}s` }}>
                        <div className="whats-new-icon teacher">
                          <Award size={16} />
                        </div>
                        <div className="whats-new-content">
                          <div className="whats-new-title">{t.teacherName}</div>
                          <div className="whats-new-desc">
                            {t.subjectCount} grade records
                          </div>
                        </div>
                        <span className={`teacher-score ${t.average >= 70 ? 'high' : 'low'}`}>
                          {t.average >= 70 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {t.average}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {availableCategories[activeCategory] === 'upcomingEvents' && (
                  <div className="whats-new-section whats-new-slide">
                    <div className="whats-new-section-title">
                      <Calendar size={14} />
                      Upcoming Events
                    </div>
                    {whatsNew.upcomingEvents.map((e, idx) => (
                      <div key={`event-${idx}`} className="whats-new-item event" style={{ animationDelay: `${idx * 0.15}s` }}>
                        <div className="whats-new-icon event">
                          <Calendar size={16} />
                        </div>
                        <div className="whats-new-content">
                          <div className="whats-new-title">{e.title}</div>
                          <div className="whats-new-desc">
                            {e.description || 'No description'}
                          </div>
                        </div>
                        <div className="whats-new-time">
                          {e.start_date ? new Date(e.start_date).toLocaleDateString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {availableCategories[activeCategory] === 'newAdmissions' && (
                  <div className="whats-new-section whats-new-slide">
                    <div className="whats-new-section-title">
                      <UserPlus size={14} />
                      New Admissions
                    </div>
                    {whatsNew.newAdmissions.map((a, idx) => (
                      <div key={`adm-${idx}`} className="whats-new-item admission" style={{ animationDelay: `${idx * 0.15}s` }}>
                        <div className="whats-new-icon admission">
                          <UserPlus size={16} />
                        </div>
                        <div className="whats-new-content">
                          <div className="whats-new-title">{a.student_name || 'New Student'}</div>
                          <div className="whats-new-desc">
                            {a.status || 'pending'} · {a.admission_no || 'No admission no'}
                          </div>
                        </div>
                        <div className="whats-new-time">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Category indicator dots */}
                {availableCategories.length > 1 && (
                  <div className="whats-new-dots">
                    {availableCategories.map((cat, idx) => (
                      <button
                        key={cat}
                        className={`whats-new-dot ${idx === activeCategory ? 'active' : ''}`}
                        onClick={() => {
                          setSlideDirection(idx > activeCategory ? 'next' : 'prev');
                          setActiveCategory(idx);
                        }}
                        aria-label={`Show ${cat}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
        
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">Quick Actions</h3>
          </div>
          <div className="section-content">
            <div className="quick-actions-grid">
              <QuickAction 
                icon={GraduationCap} 
                label="View Students" 
                color="#10b981"
                onClick={() => window.location.href = '/portal/students'}
              />
              {canManageStaff && (
                <QuickAction 
                  icon={Users} 
                  label="Manage Staff" 
                  color="#3b82f6"
                  onClick={() => window.location.href = '/portal/staff'}
                />
              )}
              <QuickAction 
                icon={Calendar} 
                label="Attendance" 
                color="#8b5cf6"
                onClick={() => window.location.href = '/portal/attendance'}
              />
              <QuickAction 
                icon={ClipboardList} 
                label="Reports" 
                color="#f59e0b"
                onClick={() => window.location.href = '/portal/reports'}
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
