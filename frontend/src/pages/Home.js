import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectCurrentUser } from '../store/slices/authSlice';
import { GraduationCap, Users, BookOpen, Calendar, ClipboardList, Shield, UserCheck, Building } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config/api';

const portals = [
  { id: 'director', name: 'Director', icon: Shield, color: '#0f4c81', description: 'Full system administration' },
  { id: 'coordinator', name: 'Coordinator', icon: UserCheck, color: '#7c3aed', description: 'Coordination & oversight' },
  { id: 'principal', name: 'Principal', icon: Building, color: '#059669', description: 'School management' },
  { id: 'teacher', name: 'Teacher', icon: BookOpen, color: '#d97706', description: 'Academic management' },
  { id: 'secretary', name: 'Secretary', icon: ClipboardList, color: '#dc2626', description: 'Administrative tasks' },
  { id: 'academic', name: 'Academic', icon: GraduationCap, color: '#2563eb', description: 'Academic affairs' },
  { id: 'sectionleader', name: 'Section Leader', icon: Users, color: '#7c3aed', description: 'Section management' },
  { id: 'student', name: 'Student', icon: GraduationCap, color: '#10b981', description: 'Student portal' },
];

function Home() {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectCurrentUser);
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    // Check API health
    axios.get(`${API_URL}/api/health`)
      .then(res => setApiStatus('connected'))
      .catch(() => setApiStatus('disconnected'));
  }, []);

  const handlePortalClick = (portalId) => {
    navigate('/login', { state: { portal: portalId } });
  };

  return (
    <div className="home-page">
      <style>{`
        .home-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #e3f2fd 100%);
          position: relative;
          overflow: hidden;
        }
        
        .home-page::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 30%, rgba(15, 76, 129, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(15, 76, 129, 0.05) 0%, transparent 50%);
          pointer-events: none;
        }
        
        .home-content {
          position: relative;
          z-index: 1;
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .home-header {
          text-align: center;
          margin-bottom: 2rem;
          padding-top: 2rem;
        }

        
        .logo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .logo-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #0f4c81 0%, #1a5f9e 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(15, 76, 129, 0.3);
        }
        
        .home-title {
          font-size: 2rem;
          font-weight: 800;
          background: linear-gradient(135deg, #0f4c81 0%, #1a5f9e 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
        }
        
        .home-subtitle {
          font-size: 0.9rem;
          color: #475569;
          max-width: 600px;
          margin: 0 auto;
        }

        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.4);
          border-radius: 9999px;
          margin-top: 1.5rem;
          font-size: 0.875rem;
          color: #16a34a;
        }
        
        .status-badge.disconnected {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.4);
          color: #dc2626;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .portals-grid {
          display: grid;
          grid-template-columns: repeat(4, auto);
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .portal-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(203, 213, 225, 0.8);
          border-radius: 0.75rem;
          padding: 0.5rem 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
          min-height: 100px;
          width: fit-content;
        }
        
        .portal-card:hover {
          transform: translateY(-2px);
          border-color: var(--portal-color);
          box-shadow: 0 4px 12px rgba(15, 76, 129, 0.15);
        }
        
        .portal-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--portal-color);
          opacity: 0.9;
          flex-shrink: 0;
        }
        
        .portal-name {
          font-size: 1rem;
          font-weight: 600;
          color: #0f4c81;
          line-height: 1;
          white-space: nowrap;
        }


        
        .portal-description {
          display: none;
        }
        
        .portal-arrow {
          display: none;
        }

        @media (max-width: 768px) {
          .portals-grid {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 0.4rem;
          }
          
          .portal-card {
            min-height: 50px;
            padding: 0.25rem 0.5rem;
            gap: 0.3rem;
            width: calc(33.333% - 0.4rem);
            flex-direction: column;
          }
          
          .portal-icon-wrapper {
            width: 24px;
            height: 24px;
            border-radius: 6px;
          }
          
          .portal-name {
            font-size: 0.7rem;
            white-space: normal;
            text-align: center;
            line-height: 1.1;
            word-break: break-word;
          }
        }




        
        .quick-actions {

          text-align: center;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 1rem;
          border: 1px solid rgba(203, 213, 225, 0.8);
        }
        
        .quick-actions h3 {
          font-size: 1.125rem;
          color: #0f4c81;
          margin-bottom: 1rem;
        }
        
        .quick-actions-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .footer {
          text-align: center;
          padding: 2rem;
          color: #64748b;
          font-size: 0.875rem;
        }
      `}</style>
      
      <div className="home-content">
        <header className="home-header">
          <div className="logo-container">
            <div className="logo-icon">
              <GraduationCap size={32} color="white" />
            </div>
          </div>
          <h1 className="home-title">IHEZA</h1>
          <div className="portals-grid">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <div
                  key={portal.id}
                  className="portal-card"
                  style={{ '--portal-color': portal.color }}
                  onClick={() => handlePortalClick(portal.id)}
                  data-testid={`portal-${portal.id}`}
                >
                  <div className="portal-icon-wrapper">
                    <Icon size={8} color="white" />
                  </div>

                  <div className="portal-name">{portal.name}</div>
                  <div className="portal-description">{portal.description}</div>
                  <div className="portal-arrow">
                    Enter Portal →
                  </div>
                </div>
              );
            })}
          </div>
          <p className="home-subtitle">
            The Institute of Holistic Education of Zanzibar - Comprehensive School Management System
          </p>
          <div className={`status-badge ${apiStatus !== 'connected' ? 'disconnected' : ''}`}>
            <span className="status-dot"></span>
            {apiStatus === 'checking' ? 'Checking connection...' : 
             apiStatus === 'connected' ? 'System Online' : 'System Offline'}
          </div>
        </header>
        
        {isAuthenticated && currentUser && (
          <div className="quick-actions mb-6">
            <h3>Welcome back, {currentUser.name}!</h3>
            <div className="quick-actions-buttons">
              <Link to="/portal/dashboard" className="btn btn-primary">
                Go to Dashboard
              </Link>
              <Link to="/portal/students" className="btn btn-secondary">
                View Students
              </Link>
            </div>
          </div>
        )}

        
        <footer className="footer">
          <p>© 2025 IHEZA - The Institute of Holistic Education of Zanzibar</p>
        </footer>
      </div>
    </div>
  );
}

export default Home;
