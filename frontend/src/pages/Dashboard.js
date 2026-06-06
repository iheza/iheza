import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectCurrentPortal } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { apiClient } from '../services/authService';
import GenerateChain from '../components/Principal/GenerateChain';
import { toast } from '../hooks/useSoundEnabledToast';
import { 
  Users, GraduationCap, Calendar, ClipboardList, 
  TrendingUp, BookOpen, DollarSign, Bell, Database
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
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);

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

      const comms = await dataService.getCommunications('announcement');
      setRecentAnnouncements(comms.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
          border-radius: 1rem;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.3s ease;
        }
        
        .stat-card:hover {
          border-color: var(--stat-color);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        
        .stat-icon {
          width: 56px;
          height: 56px;
          background: var(--stat-color);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        
        .stat-info {
          flex: 1;
        }
        
        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #f8fafc;
        }
        
        .stat-label {
          color: #94a3b8;
          font-size: 0.875rem;
        }
        
        .stat-trend {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: #22c55e;
          font-size: 0.8rem;
          font-weight: 500;
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
        
        .welcome-banner {
          background: linear-gradient(135deg, #0f4c81 0%, #1a5f9e 100%);
          border-radius: 1rem;
          padding: 2rem;
          margin-bottom: 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .welcome-text h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
        }
        
        .welcome-text p {
          color: rgba(255, 255, 255, 0.8);
        }
        
        .welcome-badge {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          text-transform: capitalize;
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
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">
              <Bell size={18} />
              Recent Announcements
            </h3>
          </div>
          <div className="section-content">
            {recentAnnouncements.length > 0 ? (
              <div className="announcement-list">
                {recentAnnouncements.map((ann, idx) => (
                  <div key={idx} className="announcement-item">
                    <div className="announcement-title">{ann.subject}</div>
                    <div className="announcement-date">
                      {new Date(ann.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No announcements yet
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
