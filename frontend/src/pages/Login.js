import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, selectAuthLoading, selectAuthError, clearError } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { toast } from 'sonner';
import { GraduationCap, Eye, EyeOff, LogIn, ArrowLeft, Building } from 'lucide-react';

const portals = [
  { id: 'director', name: 'Director', color: '#0f4c81', prefix: 'IHEZA' },
  { id: 'coordinator', name: 'Coordinator', color: '#7c3aed', prefix: 'IHEZA' },
  { id: 'principal', name: 'Principal', color: '#059669', prefix: 'SCHOOL' },
  { id: 'teacher', name: 'Teacher', color: '#d97706', prefix: 'SCHOOL' },
  { id: 'academic', name: 'Academic', color: '#2563eb', prefix: 'SCHOOL' },
  { id: 'secretary', name: 'Secretary', color: '#dc2626', prefix: 'SCHOOL' },
  { id: 'sectionleader', name: 'Section Leader', color: '#ec4899', prefix: 'SCHOOL' },
  { id: 'student', name: 'Student', color: '#10b981', prefix: 'SCHOOL' },
];

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);

  // Get chain code and slug from URL query parameters
  const searchParams = new URLSearchParams(location.search);
  const chainCode = searchParams.get('chain');
  const chainSlug = searchParams.get('chainSlug');
  const portalFromUrl = searchParams.get('portal');
  
  const preselectedPortal = location.state?.portal || portalFromUrl || '';
  
  const [formData, setFormData] = useState({
    accessCode: '',
    password: '',
    portal: preselectedPortal,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [chain, setChain] = useState(null);
  const [chainLoading, setChainLoading] = useState(false);

  // Fetch chain data if chain code is provided
  useEffect(() => {
    const fetchChainData = async () => {
      if (chainCode) {
        try {
          setChainLoading(true);
          const response = await apiClient.get(`/chains/${chainCode}`);
          setChain(response.data);
        } catch (error) {
          console.error('Failed to load chain data:', error);
          // If chain not found, continue with default IHEZA branding
        } finally {
          setChainLoading(false);
        }
      }
    };

    fetchChainData();
  }, [chainCode]);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.portal) {
      toast.error('Please select a portal');
      return;
    }

    // Students only need admission number, no password
    const isStudent = formData.portal === 'student';
    
    if (!formData.accessCode) {
      toast.error(isStudent ? 'Please enter your admission number' : 'Please enter access code');
      return;
    }
    
    if (!isStudent && !formData.password) {
      toast.error('Please enter password');
      return;
    }

    try {
      const result = await dispatch(login({
        accessCode: formData.accessCode,
        password: isStudent ? 'not_required' : formData.password,
        portal: formData.portal,
        chain: chainCode, // Pass chain code from URL if available
      })).unwrap();
      
      toast.success(`Welcome, ${result.user.name}!`);
      // Students go directly to My Portal, staff go to Dashboard
      navigate(isStudent ? '/portal/student-portal' : '/portal/dashboard');
    } catch (err) {
      // Error handled by Redux
    }
  };

  const selectedPortal = portals.find(p => p.id === formData.portal);
  
  const getFormatHint = () => {
    // No format hints shown - users enter their credentials directly
    return null;
  };
  
  const formatHint = getFormatHint();

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          position: relative;
        }
        
        .login-page::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 30% 20%, rgba(15, 76, 129, 0.15) 0%, transparent 50%);
          pointer-events: none;
        }
        
        .login-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
          z-index: 1;
        }
        
        .login-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(203, 213, 225, 0.8);
          border-radius: 1.5rem;
          padding: 2.5rem;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 24px 48px rgba(15, 76, 129, 0.15);
        }
        
        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .login-logo {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, var(--portal-color, #0f4c81) 0%, var(--portal-color-light, #1a5f9e) 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          box-shadow: 0 8px 24px rgba(15, 76, 129, 0.25);
        }
        
        .login-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f4c81;
          margin-bottom: 0.5rem;
        }
        
        .login-subtitle {
          color: #475569;
          font-size: 0.95rem;
        }
        
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: #64748b;
          text-decoration: none;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
          transition: color 0.2s;
        }
        
        .back-link:hover {
          color: #0f4c81;
        }
        
        .portal-select-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }
        
        .portal-btn {
          padding: 0.75rem 0.5rem;
          background: rgba(241, 245, 249, 0.8);
          border: 2px solid transparent;
          border-radius: 0.75rem;
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        
        .portal-btn:hover {
          background: rgba(226, 232, 240, 0.9);
          color: #1e293b;
        }
        
        .portal-btn.selected {
          border-color: var(--portal-color);
          background: rgba(var(--portal-rgb), 0.15);
          color: var(--portal-color);
        }
        
        .input-group {
          margin-bottom: 1.25rem;
        }
        
        .input-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: #0f4c81;
          margin-bottom: 0.5rem;
        }
        
        .input-wrapper {
          position: relative;
        }
        
        .input-field {
          width: 100%;
          padding: 0.875rem 1rem;
          background: rgba(241, 245, 249, 0.8);
          border: 1px solid rgba(203, 213, 225, 0.8);
          border-radius: 0.75rem;
          color: #1e293b;
          font-size: 1rem;
          transition: all 0.2s;
        }
        
        .input-field.monospace {
          font-family: monospace;
        }
        
        .input-field:focus {
          outline: none;
          border-color: var(--portal-color, #0f4c81);
          box-shadow: 0 0 0 3px rgba(15, 76, 129, 0.15);
        }
        
        .input-field::placeholder {
          color: #94a3b8;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        .format-hint {
          margin-top: 0.5rem;
          padding: 0.75rem;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 0.5rem;
          font-size: 0.75rem;
        }
        
        .format-hint-label {
          color: #a78bfa;
          margin-bottom: 0.25rem;
        }
        
        .format-hint code {
          background: rgba(51, 65, 85, 0.5);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          color: #f8fafc;
        }
        
        .password-toggle {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0.25rem;
        }
        
        .password-toggle:hover {
          color: #94a3b8;
        }
        
        .login-btn {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, var(--portal-color, #0f4c81) 0%, var(--portal-color-light, #1a5f9e) 100%);
          border: none;
          border-radius: 0.75rem;
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s;
          margin-top: 1rem;
        }
        
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .demo-credentials {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.75rem;
          font-size: 0.75rem;
        }
        
        .demo-credentials h4 {
          color: #60a5fa;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }
        
        .demo-credentials p {
          color: #94a3b8;
          line-height: 1.6;
          margin-bottom: 0.5rem;
        }
        
        .demo-credentials code {
          background: rgba(51, 65, 85, 0.5);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          color: #f8fafc;
          font-size: 0.7rem;
        }
        
        .school-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.5rem;
        }
        
        .school-badge {
          padding: 0.25rem 0.5rem;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 0.25rem;
          font-size: 0.65rem;
          color: #a78bfa;
        }
      `}</style>
      
      <div className="login-container">
        <div className="login-card" style={{ '--portal-color': selectedPortal?.color || '#0f4c81' }}>
          <a href={chainCode ? `/chain/${chainCode}` : "/"} className="back-link">
            <ArrowLeft size={16} />
            {chainCode ? `Back to ${chain?.display_name || chain?.name || chainCode} Homepage` : 'Back to Home'}
          </a>
          
          <div className="login-header">
            <div className="login-logo">
              <GraduationCap size={32} color="white" />
            </div>
            <h1 className="login-title">
              {selectedPortal ? `${selectedPortal.name} Login` : (chain ? `${chain.display_name || chain.name} Login` : 'IHEZA Login')}
            </h1>
            <p className="login-subtitle">
              {chain ? chain.name : 'Institute of Holistic Education of Zanzibar'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Select Portal</label>
              <div className="portal-select-grid">
                {portals.map((portal) => (
                  <button
                    key={portal.id}
                    type="button"
                    className={`portal-btn ${formData.portal === portal.id ? 'selected' : ''}`}
                    style={{ '--portal-color': portal.color }}
                    onClick={() => setFormData({ ...formData, portal: portal.id, accessCode: '' })}
                    data-testid={`portal-select-${portal.id}`}
                  >
                    {portal.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="input-group">
              <label className="input-label">Access Code</label>
              <input
                type="text"
                className="input-field monospace"
                placeholder="Enter your access code"
                value={formData.accessCode}
                onChange={(e) => setFormData({ ...formData, accessCode: e.target.value.toUpperCase() })}
                data-testid="access-code-input"
              />
            </div>
            
            {formData.portal !== 'student' && (
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    data-testid="password-input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}
            
            {formData.portal === 'student' && (
              <div className="format-hint" style={{ marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <div style={{ color: '#10b981', fontWeight: '500' }}>No password required for students</div>
                <div>Just enter your admission number to login</div>
              </div>
            )}
            
            <button
              type="submit"
              className="login-btn"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <>Signing in...</>
              ) : (
                <>
                  <LogIn size={20} />
                  Sign In
                </>
              )}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}

export default Login;
