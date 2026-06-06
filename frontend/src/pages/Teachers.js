import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectCurrentPortal } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { toast } from '../hooks/useSoundEnabledToast';
import { Users, Search, Mail, Phone, BookOpen, User } from 'lucide-react';
import ChainToggle from '../components/ChainToggle';

function Teachers() {
  const currentUser = useSelector(selectCurrentUser);
  const currentPortal = useSelector(selectCurrentPortal);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChain, setSelectedChain] = useState('');

  useEffect(() => {
    loadTeachers(selectedChain);
  }, [selectedChain]);
  
  const loadTeachers = async (chain) => {
    try {
      setLoading(true);
      const params = chain ? { chain } : {};
      const response = await apiClient.get('/users', { params });
      // Filter to show only teachers, academic, secretary, section_leader - exclude principal, director, coordinator
      const staffList = response.data.filter(user => {
        const role = (user.role || '').toLowerCase();
        return ['teacher', 'academic', 'secretary', 'section_leader'].includes(role) && 
               user.status === 'active';
      });
      setTeachers(staffList);
    } catch (error) {
      console.error('Failed to load teachers:', error);
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const filteredTeachers = teachers.filter(teacher => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (teacher.first_name || '').toLowerCase().includes(searchLower) ||
      (teacher.last_name || '').toLowerCase().includes(searchLower) ||
      (teacher.email || '').toLowerCase().includes(searchLower) ||
      (teacher.role || '').toLowerCase().includes(searchLower)
    );
  });

  // Hide access codes for students, directors, and coordinators
  const showAccessCode = !['student', 'director', 'coordinator'].includes(currentPortal?.toLowerCase());

  const getRoleColor = (role) => {
    const colors = {
      teacher: '#22c55e',
      academic: '#3b82f6',
      secretary: '#f59e0b',
      section_leader: '#8b5cf6',
    };
    return colors[(role || '').toLowerCase()] || '#64748b';
  };

  const getRoleLabel = (role) => {
    const labels = {
      teacher: 'Teacher',
      academic: 'Academic',
      secretary: 'Secretary',
      section_leader: 'Section Leader',
    };
    return labels[(role || '').toLowerCase()] || role;
  };

  return (
    <div className="teachers-page">
      <style>{`
        .teachers-page {
          padding: 1.5rem;
          min-height: 100vh;
        }
        
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f4c81;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .page-title-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .search-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 0.5rem 1rem;
          min-width: 280px;
        }
        
        .search-box input {
          border: none;
          outline: none;
          flex: 1;
          font-size: 0.875rem;
          color: #1e293b;
          background: transparent;
        }
        
        .search-box input::placeholder {
          color: #94a3b8;
        }
        
        .stats-bar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .stat-card {
          flex: 1;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .stat-info h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        
        .stat-info p {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0;
          text-transform: uppercase;
        }
        
        .teachers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        
        @media (max-width: 768px) {
          .teachers-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .teacher-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          overflow: hidden;
          transition: all 0.2s;
        }
        
        .teacher-card:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }
        
        .teacher-header {
          background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .teacher-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          border: 3px solid rgba(255, 255, 255, 0.3);
        }
        
        .teacher-avatar.has-photo {
          background-size: cover;
          background-position: center;
        }
        
        .teacher-basic {
          flex: 1;
        }
        
        .teacher-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: white;
          margin-bottom: 0.25rem;
        }
        
        .teacher-role {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          color: white;
        }
        
        .teacher-body {
          padding: 1.25rem;
        }
        
        .teacher-info-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid #f1f5f9;
        }
        
        .teacher-info-row:last-child {
          border-bottom: none;
        }
        
        .teacher-info-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }
        
        .teacher-info-content {
          flex: 1;
        }
        
        .teacher-info-label {
          font-size: 0.7rem;
          color: #94a3b8;
          text-transform: uppercase;
          margin-bottom: 0.125rem;
        }
        
        .teacher-info-value {
          font-size: 0.875rem;
          color: #1e293b;
          font-weight: 500;
        }
        
        .teacher-info-value a {
          color: #0369a1;
          text-decoration: none;
        }
        
        .teacher-info-value a:hover {
          text-decoration: underline;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 600;
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }
        
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #64748b;
        }
        
        .empty-state-icon {
          width: 80px;
          height: 80px;
          background: #f1f5f9;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }
        
        .loading-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #64748b;
        }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <Users size={20} color="white" />
          </span>
          Our Teachers & Staff
        </h1>
        
        <div className="search-box">
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="teacher-search"
          />
        </div>
      </div>

      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
      }} />

      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
            <Users size={24} color="#22c55e" />
          </div>
          <div className="stat-info">
            <h3>{teachers.filter(t => t.role?.toLowerCase() === 'teacher').length}</h3>
            <p>Teachers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
            <BookOpen size={24} color="#3b82f6" />
          </div>
          <div className="stat-info">
            <h3>{teachers.filter(t => t.role?.toLowerCase() === 'academic').length}</h3>
            <p>Academic Staff</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
            <User size={24} color="#8b5cf6" />
          </div>
          <div className="stat-info">
            <h3>{teachers.length}</h3>
            <p>Total Staff</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <p>Loading teachers...</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users size={40} color="#94a3b8" />
          </div>
          <h3 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>No Teachers Found</h3>
          <p>There are no teachers matching your search criteria.</p>
        </div>
      ) : (
        <div className="teachers-grid">
          {filteredTeachers.map(teacher => (
            <div key={teacher.id} className="teacher-card" data-testid={`teacher-card-${teacher.id}`}>
              <div className="teacher-header">
                <div 
                  className={`teacher-avatar ${(teacher.profile_pic || teacher.photo_url) ? 'has-photo' : ''}`}
                  style={(teacher.profile_pic || teacher.photo_url) ? { backgroundImage: `url(${teacher.profile_pic || teacher.photo_url})` } : {}}
                >
                  {!(teacher.profile_pic || teacher.photo_url) && (teacher.first_name?.charAt(0) || 'T')}
                </div>
                <div className="teacher-basic">
                  <div className="teacher-name">
                    {teacher.first_name} {teacher.last_name}
                  </div>
                  <span className="teacher-role" style={{ background: `${getRoleColor(teacher.role)}33` }}>
                    {getRoleLabel(teacher.role)}
                  </span>
                </div>
              </div>
              
              <div className="teacher-body">
                {showAccessCode && (
                  <div className="teacher-info-row">
                    <div className="teacher-info-icon">
                      <User size={16} />
                    </div>
                    <div className="teacher-info-content">
                      <div className="teacher-info-label">Access Code</div>
                      <div className="teacher-info-value">{teacher.access_code}</div>
                    </div>
                    <span className="status-badge">Active</span>
                  </div>
                )}
                
                {!showAccessCode && (
                  <div className="teacher-info-row">
                    <div className="teacher-info-content" style={{ paddingLeft: 0 }}>
                      <span className="status-badge">Active</span>
                    </div>
                  </div>
                )}
                
                {teacher.email && (
                  <div className="teacher-info-row">
                    <div className="teacher-info-icon">
                      <Mail size={16} />
                    </div>
                    <div className="teacher-info-content">
                      <div className="teacher-info-label">Email</div>
                      <div className="teacher-info-value">
                        <a href={`mailto:${teacher.email}`}>{teacher.email}</a>
                      </div>
                    </div>
                  </div>
                )}
                
                {teacher.phone && (
                  <div className="teacher-info-row">
                    <div className="teacher-info-icon">
                      <Phone size={16} />
                    </div>
                    <div className="teacher-info-content">
                      <div className="teacher-info-label">Phone</div>
                      <div className="teacher-info-value">
                        <a href={`tel:${teacher.phone}`}>{teacher.phone}</a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Teachers;
