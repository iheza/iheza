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
  FileText, Award, Sparkles, UserPlus, TrendingDown, Image
} from 'lucide-react';



// Module-level cache for the "What's New" dashboard data. The Dashboard is
// re-mounted frequently (every navigation back to it), and re-fetching all
// chains' data each time is wasteful. We cache per-chain results with a short
// TTL so re-mounts within the window reuse the previous fetch instead of
// firing another 7-call burst per chain.
const whatsNewCache = new Map(); // chain -> { data, expiresAt }
const WHATS_NEW_TTL_MS = 60000; // 60s

function getCachedWhatsNew(chain) {
  const entry = whatsNewCache.get(chain);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  return null;
}

function setCachedWhatsNew(chain, data) {
  whatsNewCache.set(chain, { data, expiresAt: Date.now() + WHATS_NEW_TTL_MS });
}

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
  // "What's New" data grouped by chain (Director sees all chains)
  const [whatsNewByChain, setWhatsNewByChain] = useState({});
  // Flat list of slides: [{ chain, category }] — cycles through all chains automatically
  const [slides, setSlides] = useState([]);


  const [activeCategory, setActiveCategory] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next');



  // Only these roles can see Staff Management
  const canManageStaff = ['director', 'coordinator', 'principal'].includes(currentUser?.role?.toLowerCase());

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Build the "What's New" data for a single chain.
  // Uses the backend /dashboard/whats-new aggregation endpoint, which fetches
  // all 7 datasets (payments, documents, grades, subjects, users, almanac,
  // admissions) in a SINGLE request and pre-computes the same analytics that
  // this component used to compute client-side. This collapses the previous
  // 7-call parallel burst per chain into 1 request, dramatically reducing
  // origin load under concurrent dashboard loads.
  const buildChainWhatsNew = async (chain) => {
    const params = chain ? { chain } : {};
    const response = await apiClient.get('/dashboard/whats-new', { params });
    const data = response.data || {};

    return {
      payments: data.payments || [],
      documents: data.documents || [],
      teacherAnalytics: data.teacherAnalytics || [],
      teacherSubmissions: data.teacherSubmissions || [],
      projectPics: data.projectPics || [],
      upcomingEvents: data.upcomingEvents || [],
      newAdmissions: data.newAdmissions || [],
    };
  };


  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const syncData = await dataService.syncData();
      
      // /api/sync now returns counts_only=true (numbers) to avoid downloading
      // the full 1000-student + 1000-user arrays just to count them. Handle
      // both the new numeric shape and the legacy array shape defensively.
      const countOf = (v) => (typeof v === 'number' ? v : (Array.isArray(v) ? v.length : 0));
      setStats({
        students: countOf(syncData.students),
        staff: countOf(syncData.staff) || countOf(syncData.users),
        classes: countOf(syncData.classes),
        subjects: countOf(syncData.subjects),
      });


      // Determine which chains to show in "What's New".
      // Director sees ALL chains (LALE, DLP, DUP) automatically; others see only their own chain.
      const isDirector = currentUser?.role?.toLowerCase() === 'director';
      const viewChains = isDirector
        ? ['LALE', 'DLP', 'DUP']
        : [currentUser?.chain || 'DUP'].filter(Boolean);

      const byChain = {};
      const newSlides = [];

      // Iterate chains sequentially, reusing cached data when available and
      // staggering fresh fetches so the 7-call bursts per chain don't all
      // fire at once (which would spike the origin under concurrent load).
      for (let i = 0; i < viewChains.length; i++) {
        const chain = viewChains[i];

        // Reuse cached "What's New" data if it's still fresh.
        let chainData = getCachedWhatsNew(chain);
        if (!chainData) {
          chainData = await buildChainWhatsNew(chain);
          setCachedWhatsNew(chain, chainData);
        }

        byChain[chain] = chainData;

        // Build slides for this chain (only categories that have data)
        ['payments', 'documents', 'teacherAnalytics', 'teacherSubmissions', 'projectPics', 'upcomingEvents', 'newAdmissions'].forEach(cat => {
          if (chainData[cat] && chainData[cat].length > 0) {
            newSlides.push({ chain, category: cat });
          }
        });

        // Stagger the next chain's fetch by 300ms so the origin isn't hit
        // with all chains' 7-call bursts simultaneously.
        if (i < viewChains.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }


      setWhatsNewByChain(byChain);
      setSlides(newSlides);
      setActiveCategory(0);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // The active slide (chain + category) currently being shown
  const activeSlide = slides[activeCategory] || null;
  // The data for the active slide's chain
  const activeChainData = activeSlide ? (whatsNewByChain[activeSlide.chain] || {}) : {};

  // Auto-rotate slides every 5 seconds (cycles through all chains automatically)
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideDirection('next');
      setActiveCategory(prev => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);



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

  // Map each "What's New" category to its full-content page
  const categoryPageMap = {
    payments: '/portal/fees',
    documents: '/portal/documents',
    teacherAnalytics: '/portal/reports',
    teacherSubmissions: '/portal/documents',
    projectPics: '/portal/documents',
    upcomingEvents: '/portal/almanac',
    newAdmissions: '/portal/admission',
  };


  const navigateToCategoryPage = (category) => {
    const path = categoryPageMap[category];
    if (path) {
      window.location.href = path;
    }
  };


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
          display: flex;
          flex-wrap: wrap;
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
          flex: 0 0 auto;
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
        
        .whats-new-view-all {
          margin-left: auto;
          font-size: 0.65rem;
          font-weight: 600;
          color: #2563eb;
          text-transform: none;
          letter-spacing: 0;
          background: #dbeafe;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        
        .whats-new-slide:hover .whats-new-view-all {
          background: #2563eb;
          color: #ffffff;
        }
        
        .chain-badge {
          font-size: 0.6rem;
          font-weight: 700;
          color: #ffffff;
          background: #0f4c81;
          padding: 0.1rem 0.45rem;
          border-radius: 9999px;
          text-transform: none;
          letter-spacing: 0.03em;
          white-space: nowrap;
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

        /* ─── MOBILE: fit all 4 stat cards in one line ─── */
        @media (max-width: 640px) {
          .stats-grid {
            display: flex;
            flex-wrap: nowrap;
            gap: 0.4rem;
            justify-content: space-between;
          }
          .stat-card {
            flex: 1 1 0;
            min-width: 0;
            height: auto;
            min-height: 64px;
            padding: 0.35rem 0.2rem;
            gap: 0.15rem;
            border-radius: 0.5rem;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
          .stat-icon {
            width: 22px;
            height: 22px;
            border-radius: 6px;
            flex-shrink: 0;
          }
          .stat-icon svg {
            width: 12px;
            height: 12px;
          }
          .stat-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
          }
          .stat-value {
            font-size: 0.85rem;
            line-height: 1.1;
          }
          .stat-label {
            font-size: 0.5rem;
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
            line-height: 1.1;
            word-break: break-word;
            text-align: center;
          }
          .stat-trend {
            display: none;
          }


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
            ) : slides.length === 0 ? (
              <div className="empty-state">No recent activity yet</div>
            ) : (
              <div className="whats-new-carousel">
                {/* Only show the active slide (chain + category) */}
                {activeSlide?.category === 'payments' && (
                  <div className="whats-new-section whats-new-slide" onClick={() => navigateToCategoryPage('payments')} style={{ cursor: 'pointer' }}>
                    <div className="whats-new-section-title">
                      <DollarSign size={14} />
                      Recent Payments
                      {activeSlide.chain && <span className="chain-badge">{activeSlide.chain}</span>}
                      <span className="whats-new-view-all">View all →</span>
                    </div>

                    {activeChainData.payments.map((p, idx) => (
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

                {activeSlide?.category === 'documents' && (
                  <div className="whats-new-section whats-new-slide" onClick={() => navigateToCategoryPage('documents')} style={{ cursor: 'pointer' }}>
                    <div className="whats-new-section-title">
                      <FileText size={14} />
                      Document Uploads
                      {activeSlide.chain && <span className="chain-badge">{activeSlide.chain}</span>}
                      <span className="whats-new-view-all">View all →</span>
                    </div>

                    {activeChainData.documents.map((d, idx) => (
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

                {activeSlide?.category === 'teacherAnalytics' && (
                  <div className="whats-new-section whats-new-slide" onClick={() => navigateToCategoryPage('teacherAnalytics')} style={{ cursor: 'pointer' }}>
                    <div className="whats-new-section-title">
                      <Award size={14} />
                      Teacher Performance
                      {activeSlide.chain && <span className="chain-badge">{activeSlide.chain}</span>}
                      <span className="whats-new-view-all">View all →</span>
                    </div>

                    {activeChainData.teacherAnalytics.map((t, idx) => (
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

                {activeSlide?.category === 'teacherSubmissions' && (
                  <div className="whats-new-section whats-new-slide" onClick={() => navigateToCategoryPage('teacherSubmissions')} style={{ cursor: 'pointer' }}>
                    <div className="whats-new-section-title">
                      <FileText size={14} />
                      Teacher Submission Ranking
                      {activeSlide.chain && <span className="chain-badge">{activeSlide.chain}</span>}
                      <span className="whats-new-view-all">View all →</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.65rem',
                      color: '#64748b',
                      padding: '0 0.5rem 0.4rem 0.5rem',
                      borderBottom: '1px solid #e2e8f0',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}>
                      <span>#</span>
                      <span style={{ flex: 1, marginLeft: '0.5rem' }}>Teacher</span>
                      <span>Count</span>
                      <span style={{ width: '40px', textAlign: 'right' }}>%</span>
                    </div>
                    {activeChainData.teacherSubmissions.map((t, idx) => {
                      const total = activeChainData.teacherSubmissions.reduce((sum, x) => sum + x.count, 0) || 1;
                      const pct = Math.round((t.count / total) * 100);
                      const isTop = idx === 0;
                      const isBottom = idx === activeChainData.teacherSubmissions.length - 1 && activeChainData.teacherSubmissions.length > 1;
                      return (
                        <div key={`sub-${idx}`} className="whats-new-item teacher" style={{ animationDelay: `${idx * 0.15}s`, alignItems: 'center' }}>
                          <div className="whats-new-icon teacher">
                            <FileText size={16} />
                          </div>
                          <div className="whats-new-content">
                            <div className="whats-new-title">
                              {isTop ? '🥇 ' : isBottom ? '📉 ' : `${idx + 1}. `}
                              {t.name === 'Unknown' ? 'Not Assigned' : t.name}
                            </div>
                            <div className="whats-new-desc">
                              {t.count} submission{t.count === 1 ? '' : 's'}
                            </div>
                          </div>
                          <span className={`teacher-score ${isTop ? 'high' : isBottom ? 'low' : ''}`}>
                            {t.count} · {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeSlide?.category === 'projectPics' && (
                  <div className="whats-new-section whats-new-slide" onClick={() => navigateToCategoryPage('projectPics')} style={{ cursor: 'pointer' }}>
                    <div className="whats-new-section-title">
                      <Image size={14} />
                      Recent Project Pictures
                      {activeSlide.chain && <span className="chain-badge">{activeSlide.chain}</span>}
                      <span className="whats-new-view-all">View all →</span>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.75rem'
                    }}>
                      {activeChainData.projectPics.map((p, idx) => (
                        <div key={`pic-${idx}`} className="whats-new-item document" style={{ animationDelay: `${idx * 0.15}s`, flexDirection: 'column', alignItems: 'stretch', padding: '0.75rem' }}>
                          {p.data ? (
                            <img
                              src={p.data}
                              alt={p.name}
                              style={{
                                width: '100%',
                                height: '100px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '100%',
                              height: '100px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#f1f5f9',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              color: '#94a3b8',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              <Image size={24} style={{ marginRight: '6px' }} />
                              Project Picture
                            </div>
                          )}
                          <div className="whats-new-content">
                            <div className="whats-new-title" style={{ whiteSpace: 'normal', fontSize: '0.75rem' }}>
                              {p.caption || p.name || 'Project Picture'}
                            </div>
                            <div className="whats-new-desc" style={{ whiteSpace: 'normal' }}>
                              {p.uploaded_by || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      ))}

                    </div>
                  </div>
                )}

                {activeSlide?.category === 'upcomingEvents' && (

                  <div className="whats-new-section whats-new-slide" onClick={() => navigateToCategoryPage('upcomingEvents')} style={{ cursor: 'pointer' }}>

                    <div className="whats-new-section-title">
                      <Calendar size={14} />
                      Upcoming Events
                      {activeSlide.chain && <span className="chain-badge">{activeSlide.chain}</span>}
                      <span className="whats-new-view-all">View all →</span>
                    </div>

                    {activeChainData.upcomingEvents.map((e, idx) => (
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

                {activeSlide?.category === 'newAdmissions' && (
                  <div className="whats-new-section whats-new-slide" onClick={() => navigateToCategoryPage('newAdmissions')} style={{ cursor: 'pointer' }}>
                    <div className="whats-new-section-title">
                      <UserPlus size={14} />
                      New Admissions
                      {activeSlide.chain && <span className="chain-badge">{activeSlide.chain}</span>}
                      <span className="whats-new-view-all">View all →</span>
                    </div>

                    {activeChainData.newAdmissions.map((a, idx) => (
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
                {slides.length > 1 && (
                  <div className="whats-new-dots">
                    {slides.map((slide, idx) => (
                      <button
                        key={`${slide.chain}-${slide.category}`}
                        className={`whats-new-dot ${idx === activeCategory ? 'active' : ''}`}
                        onClick={() => {
                          setSlideDirection(idx > activeCategory ? 'next' : 'prev');
                          setActiveCategory(idx);
                        }}
                        aria-label={`Show ${slide.chain} ${slide.category}`}
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
