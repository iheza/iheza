import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout, selectCurrentUser, selectCurrentPortal } from '../store/slices/authSlice';
import { 
  LayoutDashboard, Users, GraduationCap, BookOpen, 
  Calendar, BarChart3, Settings, LogOut, Menu, X,
  ChevronRight, QrCode, Award, FileText, DollarSign,
  ClipboardList, BookMarked, User, Bell, Building
} from 'lucide-react';

// Navigation permissions by role
// IMPORTANT: Students ONLY see "My Portal" - all other nav items are staff-only
const NAV_PERMISSIONS = {
  // Students page: Staff only
  students: ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'],
  // Staff page: ONLY Principals can access (and they cannot edit IHEZA chain staff)
  staff: ['principal'],
  // Classes: Staff only
  classes: ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'],
  // Attendance: Staff only
  attendance: ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'],
  // QR Check-In: Staff only
  'qr-attendance': ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'],
  // QR Management: Only principals and above
  'qr-management': ['director', 'coordinator', 'principal'],
  // Grades: Only for grade entry staff (Teachers, Academic, Section Leaders, Principals)
  grades: ['principal', 'academic', 'teacher', 'section_leader'],
  // Report Cards: Only Academic portal and Section Leaders can edit/send
  'report-cards': ['academic', 'section_leader'],
  // Fees: Secretary and principals only - NOT Directors or Coordinators
  fees: ['principal', 'secretary'],
  // Fee Structure: Read-only, visible to all staff and students
  'fee-structure': ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader', 'student'],
  // Task Assignment: Principal assigns to staff
  tasks: ['director', 'coordinator', 'principal'],
  // My Tasks: Staff who receive tasks (not Student, IHEZA chains, or Principal who assigns)
  'my-tasks': ['academic', 'teacher', 'secretary', 'section_leader'],
  // Classroom: Teachers assign to students
  classroom: ['director', 'coordinator', 'principal', 'academic', 'teacher', 'section_leader'],
  // Academic Hub: All staff EXCEPT Directors (they don't need teaching templates)
  'academic-hub': ['coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'],
  // Almanac: All portals can view (Section Leader and Principal can edit)
  'almanac': ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader', 'student'],
  // Reports: Staff only
  reports: ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'],
  // Dashboard: Staff only (students go directly to My Portal)
  dashboard: ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'],
  // Student Portal: Students ONLY - their personal view with Tasks, Report Cards, Fees, Announcements
  'student-portal': ['student'],
  // Announcements: Staff only (students view via My Portal)
  announcements: ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'],
  // Teachers: View-only list of teachers - for students, directors, coordinators
  teachers: ['director', 'coordinator', 'student'],
  // Generate Chain: Only for DUP/PRINCIPAL/0002/2021 (special principal access)
  // BACA principals and other principals created by DUP/PRINCIPAL/0002/2021 cannot have this
  'generate-chain': [], // Will be handled in custom logic
};

function Layout({ children }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useSelector(selectCurrentUser);
  const currentPortal = useSelector(selectCurrentPortal);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Get chain name from current user or use default
  const chainName = currentUser?.chain || 'IHEZA';

  const handleLogout = async () => {
    await dispatch(logout());
    // Redirect to chain landing page for school chain users, otherwise home page
    const userChain = currentUser?.chain;
    if (userChain && userChain !== 'IHEZA') {
      // Redirect to the chain page (using chain code as both chainCode and chainName)
      navigate(`/chain/${userChain}`);
    } else {
      navigate('/');
    }
  };

  const navItems = [
    { path: '/portal/dashboard', icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },
    { path: '/portal/students', icon: GraduationCap, label: 'Students', key: 'students' },
    { path: '/portal/staff', icon: Users, label: 'Staff', key: 'staff' },
    { path: '/portal/generate-chain', icon: Building, label: 'Generate Chain', key: 'generate-chain' },
    { path: '/portal/classes', icon: BookOpen, label: 'Classes', key: 'classes' },
    { path: '/portal/attendance', icon: Calendar, label: 'Attendance', key: 'attendance' },
    { path: '/portal/qr-attendance', icon: QrCode, label: 'QR Check-In', key: 'qr-attendance' },
    { path: '/portal/qr-management', icon: QrCode, label: 'QR Codes', key: 'qr-management' },
    { path: '/portal/classroom', icon: BookOpen, label: 'Classroom', key: 'classroom' },
    { path: '/portal/tasks', icon: ClipboardList, label: 'Task Assignment', key: 'tasks' },
    { path: '/portal/my-tasks', icon: ClipboardList, label: 'My Tasks', key: 'my-tasks' },
    { path: '/portal/academic-hub', icon: BookMarked, label: 'Academic Hub', key: 'academic-hub' },
    { path: '/portal/grades', icon: Award, label: 'Grades', key: 'grades' },
    { path: '/portal/report-cards', icon: FileText, label: 'Report Cards', key: 'report-cards' },
    { path: '/portal/fees', icon: DollarSign, label: 'Fees', key: 'fees' },
    { path: '/portal/fee-structure', icon: FileText, label: 'Fee Structure', key: 'fee-structure' },
    { path: '/portal/almanac', icon: Calendar, label: 'Almanac', key: 'almanac' },
    { path: '/portal/announcements', icon: Bell, label: 'Announcements', key: 'announcements' },
    { path: '/portal/student-portal', icon: User, label: 'My Portal', key: 'student-portal' },
    { path: '/portal/teachers', icon: Users, label: 'Teachers', key: 'teachers' },
    { path: '/portal/reports', icon: BarChart3, label: 'Reports', key: 'reports' },
  ];

  // Filter nav items based on user role
  const userRole = currentUser?.role?.toLowerCase();
  const filteredNavItems = navItems.filter(item => {
    const permissions = NAV_PERMISSIONS[item.key];
    
    // Special handling for generate-chain: Only for DUP/PRINCIPAL/0002/2021
    if (item.key === 'generate-chain') {
      // Only show if user is DUP/PRINCIPAL/0002/2021
      return currentUser?.accessCode === 'DUP/PRINCIPAL/0002/2021';
    }
    
    return permissions && permissions.includes(userRole);
  });

  const isActive = (path) => location.pathname === path;
  
  // Determine if this is BACA school for styling
  const isBacaSchool = currentUser?.chain === 'BACA';

  return (
    <div className="layout">
      <style>{`
        .layout {
          display: flex;
          min-height: 100vh;
          background: ${isBacaSchool ? '#fef3c7' : '#e0f2fe'};
        }
        
        .sidebar {
          width: ${sidebarOpen ? '260px' : '72px'};
          background: ${isBacaSchool 
            ? 'linear-gradient(180deg, #78350f 0%, #92400e 100%)' 
            : 'linear-gradient(180deg, #0369a1 0%, #0284c7 100%)'};
          border-right: 1px solid ${isBacaSchool ? 'rgba(120, 53, 15, 0.3)' : 'rgba(14, 165, 233, 0.3)'};
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 100;
        }
        
        .sidebar-header {
          padding: 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .logo-text {
          font-size: 1.25rem;
          font-weight: 800;
          color: #ffffff;
          opacity: ${sidebarOpen ? 1 : 0};
          transition: opacity 0.2s;
          white-space: nowrap;
        }
        
        .sidebar-toggle {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.5rem;
          transition: all 0.2s;
        }
        
        .sidebar-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        
        .sidebar-nav {
          flex: 1;
          padding: 1rem 0.75rem;
          overflow-y: auto;
        }
        
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          border-radius: 0.75rem;
          margin-bottom: 0.25rem;
          transition: all 0.2s;
          white-space: nowrap;
        }
        
        .nav-item:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }
        
        .nav-item.active {
          background: rgba(255, 255, 255, 0.25);
          color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .nav-icon {
          flex-shrink: 0;
        }
        
        .nav-label {
          opacity: ${sidebarOpen ? 1 : 0};
          transition: opacity 0.2s;
        }
        
        .sidebar-footer {
          padding: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          margin-bottom: 0.75rem;
        }
        
        .user-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: #0369a1;
          flex-shrink: 0;
          overflow: hidden;
        }
        
        .user-avatar.has-photo {
          background: none;
        }
        
        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .user-details {
          opacity: ${sidebarOpen ? 1 : 0};
          transition: opacity 0.2s;
          overflow: hidden;
        }
        
        .user-name {
          font-weight: 600;
          color: #ffffff;
          font-size: 0.875rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .user-role {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.7);
          text-transform: capitalize;
        }
        
        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: ${sidebarOpen ? 'flex-start' : 'center'};
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 0.75rem;
          color: #ffffff;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.3);
          color: #fecaca;
        }
        
        .main-content {
          flex: 1;
          margin-left: ${sidebarOpen ? '260px' : '72px'};
          transition: margin-left 0.3s ease;
          min-height: 100vh;
        }
        
        .topbar {
          height: 64px;
          background: ${isBacaSchool 
            ? 'linear-gradient(90deg, #92400e 0%, #b45309 100%)' 
            : 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)'};
          border-bottom: 1px solid ${isBacaSchool ? 'rgba(120, 53, 15, 0.3)' : 'rgba(14, 165, 233, 0.3)'};
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        
        .mobile-menu-btn {
          display: none;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 0.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          margin-right: 1rem;
        }
        
        .mobile-menu-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 99;
        }
        
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.875rem;
        }
        
        .breadcrumb-item {
          color: #ffffff;
        }
        
        .topbar-user {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .topbar-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          font-size: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          overflow: hidden;
        }
        
        .topbar-avatar.has-photo {
          background-size: cover;
          background-position: center;
        }
        
        .topbar-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .topbar-user-info {
          display: flex;
          flex-direction: column;
        }
        
        .topbar-user-name {
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          line-height: 1.2;
        }
        
        .topbar-user-role {
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.75rem;
          text-transform: capitalize;
        }
        
        @media (max-width: 768px) {
          .topbar-user-info {
            display: none;
          }
        }
        
        .content-area {
          padding: 0;
        }
        
        /* BACA-specific card styling */
        ${isBacaSchool ? `
          .content-area .card,
          .content-area [class*="card"],
          .content-area [class*="Card"] {
            background-color: #f7e5a3 !important;
            border-color: #e6d494 !important;
          }
          
          .content-area .bg-card {
            background-color: #f7e5a3 !important;
          }
          
          .content-area .bg-white {
            background-color: #f7e5a3 !important;
          }
          
          .content-area .bg-slate-100,
          .content-area .bg-gray-100,
          .content-area .bg-zinc-100 {
            background-color: #f7e5a3 !important;
          }
        ` : ''}
        
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(${sidebarOpen ? '0' : '-100%'});
            width: 260px;
          }
          
          .main-content {
            margin-left: 0;
          }
          
          .mobile-menu-btn {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .sidebar-overlay {
            display: ${sidebarOpen ? 'block' : 'none'};
          }
          
          .topbar {
            padding: 0 1rem;
          }
          
          .breadcrumb {
            font-size: 0.75rem;
          }
        }
      `}</style>
      
      {/* Mobile Overlay */}
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <GraduationCap size={20} color="white" />
            </div>
            <span className="logo-text">{chainName}</span>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon size={20} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className={`user-avatar ${(currentUser?.photo_url || currentUser?.profile_pic) ? 'has-photo' : ''}`}>
              {(currentUser?.photo_url || currentUser?.profile_pic) ? (
                <img src={currentUser.photo_url || currentUser.profile_pic} alt={currentUser?.name || 'User'} />
              ) : (
                currentUser?.name?.charAt(0) || currentUser?.first_name?.charAt(0) || 'U'
              )}
            </div>
            <div className="user-details">
              <div className="user-name">{currentUser?.name || currentUser?.first_name || 'User'}</div>
              <div className="user-role">{currentPortal || currentUser?.role || 'Portal'}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} data-testid="logout-btn">
            <LogOut size={18} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              <span>Portal</span>
              <ChevronRight size={16} />
              <span className="breadcrumb-item">
                {location.pathname.split('/').pop() || 'Dashboard'}
              </span>
            </div>
          </div>
          
          <div className="topbar-user">
            <div className="topbar-user-info">
              <span className="topbar-user-name">{currentUser?.name || currentUser?.first_name || 'User'}</span>
              <span className="topbar-user-role">{currentPortal || currentUser?.role || 'Portal'}</span>
            </div>
            <div 
              className={`topbar-avatar ${(currentUser?.photo_url || currentUser?.profile_pic) ? 'has-photo' : ''}`}
              style={(currentUser?.photo_url || currentUser?.profile_pic) ? { backgroundImage: `url(${currentUser.photo_url || currentUser.profile_pic})` } : {}}
            >
              {!(currentUser?.photo_url || currentUser?.profile_pic) && (
                currentUser?.name?.charAt(0) || currentUser?.first_name?.charAt(0) || 'U'
              )}
            </div>
          </div>
        </header>
        <div className="content-area">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
