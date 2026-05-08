import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/authService';
import { toast } from 'sonner';
import { 
  Building, Users, BookOpen, Home, 
  Shield, Users2, School, ClipboardList,
  GraduationCap, FileText, UserCheck, User,
  Download, Smartphone
} from 'lucide-react';

function ChainLandingPage() {
  const { chainName, chainCode } = useParams();
  const navigate = useNavigate();
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    loadChainData();
    
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    
    // Check if install prompt is available
    if (window.deferredPrompt) {
      setCanInstall(true);
    }
    
    // Listen for install prompt ready event
    const handleInstallReady = () => {
      setCanInstall(true);
    };
    
    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      toast.success('App installed successfully!');
    };
    
    window.addEventListener('pwaInstallReady', handleInstallReady);
    window.addEventListener('pwaInstalled', handleAppInstalled);
    
    return () => {
      window.removeEventListener('pwaInstallReady', handleInstallReady);
      window.removeEventListener('pwaInstalled', handleAppInstalled);
    };
  }, [chainCode, chainName]);

  // Update manifest link for chain-specific PWA
  useEffect(() => {
    if (chain?.code) {
      // Update the manifest link to chain-specific version
      let manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        manifestLink.href = `/api/manifest/${chain.code}`;
      } else {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = `/api/manifest/${chain.code}`;
        document.head.appendChild(manifestLink);
      }
    }
    
    return () => {
      // Reset to default manifest when leaving
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        manifestLink.href = '/manifest.json';
      }
    };
  }, [chain?.code]);

  const loadChainData = async () => {
    try {
      setLoading(true);
      // Use chainCode if provided, otherwise use chainName as the code
      const codeToUse = chainCode || chainName;
      // Get chain information from database
      const response = await apiClient.get(`/chains/${codeToUse}`);
      setChain(response.data);
    } catch (error) {
      console.error('Failed to load chain data:', error);
      toast.error('Chain not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handlePortalSelect = (portal) => {
    // Navigate to login page with chain context
    // Use chainCode if provided, otherwise use chainName as the code
    const codeToPass = chainCode || chainName;
    navigate(`/login?chain=${codeToPass}&chainSlug=${chainName}&portal=${portal}`);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  // Handle PWA install
  const handleInstallApp = async () => {
    if (!window.deferredPrompt) {
      // Fallback for browsers that don't support beforeinstallprompt
      toast.info('To install: Look for "Install" or "Add to Home Screen" in your browser menu');
      return;
    }
    
    try {
      setInstalling(true);
      
      // Show the install prompt
      window.deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await window.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('Installing app...');
        setIsInstalled(true);
      } else {
        toast.info('App installation cancelled');
      }
      
      // Clear the prompt
      window.deferredPrompt = null;
      setCanInstall(false);
    } catch (error) {
      console.error('Install error:', error);
      toast.error('Failed to install app');
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="chain-landing-page">
        <style>{`
          .chain-landing-page {
            min-height: 100vh;
            background: white;
            color: #1e293b;
            padding: 2rem;
          }
          
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            gap: 1rem;
          }
          
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading chain information...</p>
        </div>
      </div>
    );
  }

  if (!chain) {
    return (
      <div className="chain-landing-page">
        <style>{`
          .chain-landing-page {
            min-height: 100vh;
            background: white;
            color: #1e293b;
            padding: 2rem;
          }
          
          .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            gap: 1.5rem;
            text-align: center;
          }
          
          .error-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1e293b;
          }
          
          .error-message {
            color: #64748b;
            max-width: 500px;
          }
          
          .back-button {
            padding: 0.75rem 1.5rem;
            background: #3b82f6;
            border: 1px solid #3b82f6;
            border-radius: 0.5rem;
            color: white;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .back-button:hover {
            background: #2563eb;
            border-color: #2563eb;
          }
        `}</style>
        
        <div className="error-container">
          <div className="error-title">Chain Not Found</div>
          <div className="error-message">
            The chain "{chainCode}" could not be found.
          </div>
          <button className="back-button" onClick={handleGoHome}>
            <Home size={16} />
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const displayName = chain.display_name || chain.name || chain.code;

  // Portal options for the new chain - reordered as requested
  const portals = [
    {
      id: 'director',
      title: 'Director',
      description: 'Full system administration',
      icon: Shield,
      color: 'linear-gradient(135deg, #8b5cf6, #a78bfa)'
    },
    {
      id: 'coordinator',
      title: 'Coordinator',
      description: 'Coordination & oversight',
      icon: Users2,
      color: 'linear-gradient(135deg, #3b82f6, #60a5fa)'
    },
    {
      id: 'principal',
      title: 'Principal',
      description: 'School management',
      icon: Building,
      color: 'linear-gradient(135deg, #10b981, #34d399)'
    },
    {
      id: 'teacher',
      title: 'Teacher',
      description: 'Academic management',
      icon: School,
      color: 'linear-gradient(135deg, #f59e0b, #fbbf24)'
    },
    {
      id: 'sectionleader',
      title: 'Section Leader',
      description: 'Section management',
      icon: UserCheck,
      color: 'linear-gradient(135deg, #3b82f6, #60a5fa)'
    },
    {
      id: 'student',
      title: 'Student',
      description: 'Student portal',
      icon: User,
      color: 'linear-gradient(135deg, #10b981, #34d399)'
    },
    {
      id: 'secretary',
      title: 'Secretary',
      description: 'Administrative tasks',
      icon: ClipboardList,
      color: 'linear-gradient(135deg, #ef4444, #f87171)'
    },
    {
      id: 'academic',
      title: 'Academic',
      description: 'Academic affairs',
      icon: GraduationCap,
      color: 'linear-gradient(135deg, #8b5cf6, #a78bfa)'
    }
  ];

  return (
    <div className="chain-landing-page">
      <style>{`
        .chain-landing-page {
          min-height: 100vh;
          background: white;
          color: #1e293b;
        }
        
        .chain-header {
          padding: 1rem 1rem;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 1px solid #e2e8f0;
          text-align: center;
        }
        
        .header-content {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .chain-title-section {
          margin: 0.5rem 0;
        }
        
        .chain-code-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: #3b82f6;
          color: white;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        
        .chain-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
          color: #1e293b;
        }
        
        .chain-subtitle {
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 0.75rem;
        }
        
        .chain-info {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1.5rem;
          margin-top: 0.75rem;
          flex-wrap: nowrap;
        }
        
        .info-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0;
          background: transparent;
          border: none;
          box-shadow: none;
        }
        
        .info-icon {
          display: none;
        }
        
        .info-content {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .info-label {
          font-size: 0.6rem;
          color: #64748b;
          margin-bottom: 0.1rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .info-value {
          font-size: 0.75rem;
          font-weight: 600;
          color: #1e293b;
        }
        
        .info-separator {
          color: #cbd5e1;
          font-size: 0.75rem;
          font-weight: 300;
        }
        
        .chain-content {
          padding: 1rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .portal-section {
          text-align: center;
          margin-bottom: 1rem;
        }
        
        .section-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #1e293b;
        }
        
        .portals-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-top: 0.75rem;
        }
        
        .portal-card {
          background: white;
          border-radius: 0.375rem;
          padding: 0.5rem;
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .portal-card:hover {
          transform: translateY(-2px);
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }
        
        .portal-icon {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.25rem;
          color: white;
        }
        
        .portal-title {
          font-size: 0.65rem;
          font-weight: 600;
          margin-bottom: 0.1rem;
          color: #1e293b;
        }
        
        .portal-description {
          font-size: 0.5rem;
          color: #64748b;
          margin-bottom: 0.25rem;
          line-height: 1.1;
        }
        
        .portal-button {
          padding: 0.25rem 0.75rem;
          background: #3b82f6;
          border: 1px solid #3b82f6;
          border-radius: 0.25rem;
          color: white;
          font-size: 0.6rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .portal-button:hover {
          background: #2563eb;
          border-color: #2563eb;
        }
        
        .chain-description {
          background: #f8fafc;
          border-radius: 0.5rem;
          padding: 0.75rem;
          margin-top: 1rem;
          border: 1px solid #e2e8f0;
        }
        
        .description-title {
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #1e293b;
        }
        
        .description-content {
          line-height: 1.4;
          color: #475569;
          font-size: 0.75rem;
        }
        
        .empty-description {
          color: #64748b;
          font-style: italic;
          font-size: 0.75rem;
        }
        
        @media (max-width: 768px) {
          .chain-header {
            padding: 1.5rem;
          }
          
          .back-button {
            position: relative;
            left: 0;
            top: 0;
            margin-bottom: 1rem;
          }
          
          .chain-content {
            padding: 1.5rem;
          }
          
          .chain-title {
            font-size: 1.25rem;
          }
          
          .chain-subtitle {
            font-size: 0.9rem;
          }
          
          .section-title {
            font-size: 1.1rem;
          }
          
          .portals-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .chain-info {
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
            gap: 1rem;
          }
          
          .info-item {
            min-width: 100px;
          }
          
          .info-label {
            font-size: 0.55rem;
          }
          
          .info-value {
            font-size: 0.65rem;
          }
          
          .portal-card {
            padding: 0.4rem;
          }
          
          .portal-title {
            font-size: 0.6rem;
          }
          
          .portal-description {
            font-size: 0.45rem;
          }
          
          .portal-button {
            padding: 0.2rem 0.5rem;
            font-size: 0.5rem;
          }
        }
        
        @media (max-width: 480px) {
          .portals-grid {
            grid-template-columns: 1fr;
          }
          
          .portal-card {
            padding: 0.5rem;
          }
          
          .portal-title {
            font-size: 0.7rem;
          }
          
          .portal-description {
            font-size: 0.55rem;
          }
          
          .portal-button {
            padding: 0.25rem 0.75rem;
            font-size: 0.6rem;
          }
        }

        /* PWA Install Section Styles */
        .pwa-install-section {
          margin-top: 2rem;
          padding: 1rem;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 1rem;
          border: 1px solid #bae6fd;
        }
        
        .pwa-install-card {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1rem;
        }
        
        .pwa-install-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #0369a1, #0284c7);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        
        .pwa-install-content {
          flex: 1;
        }
        
        .pwa-install-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #0369a1;
        }
        
        .pwa-install-description {
          font-size: 0.9rem;
          color: #475569;
          margin-bottom: 1rem;
          line-height: 1.5;
        }
        
        .pwa-install-actions {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        
        .pwa-install-btn {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #0369a1, #0284c7);
          border: none;
          border-radius: 0.5rem;
          color: white;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        
        .pwa-install-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(3, 105, 161, 0.3);
        }
        
        .pwa-install-info-btn {
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: 2px solid #0369a1;
          border-radius: 0.5rem;
          color: #0369a1;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .pwa-install-info-btn:hover {
          background: rgba(3, 105, 161, 0.1);
        }
        
        .pwa-install-note {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 0.25rem;
          border-left: 3px solid #0369a1;
        }
        
        @media (max-width: 768px) {
          .pwa-install-card {
            flex-direction: column;
            text-align: center;
            gap: 1rem;
          }
          
          .pwa-install-actions {
            flex-direction: column;
          }
          
          .pwa-install-btn,
          .pwa-install-info-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
      
      <header className="chain-header">
        <div className="header-content">
          <div className="chain-title-section">
            <div className="chain-code-badge">
              {chain.code} • {chain.type.charAt(0).toUpperCase() + chain.type.slice(1)}
            </div>
            <h1 className="chain-title">{displayName}</h1>
            <div className="chain-subtitle">
              Welcome to the {displayName} Portal System
            </div>
          </div>
          
          <div className="chain-info">
            <div className="info-item">
              <div className="info-content">
                <div className="info-label">Chain Type</div>
                <div className="info-value">{chain.type.charAt(0).toUpperCase() + chain.type.slice(1)}</div>
              </div>
            </div>
            
            <div className="info-item">
              <div className="info-content">
                <div className="info-label">Location</div>
                <div className="info-value">{chain.location}</div>
              </div>
            </div>
            
            <div className="info-item">
              <div className="info-content">
                <div className="info-label">Status</div>
                <div className="info-value">{chain.status.charAt(0).toUpperCase() + chain.status.slice(1)}</div>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="chain-content">
        <div className="portal-section">
          <h2 className="section-title">Select Your Portal</h2>
          
          <div className="portals-grid">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <div 
                  key={portal.id}
                  className="portal-card"
                  onClick={() => handlePortalSelect(portal.id)}
                >
                  <div 
                    className="portal-icon"
                    style={{ background: portal.color }}
                  >
                    <Icon size={8} />
                  </div>
                  <h3 className="portal-title">{portal.title}</h3>
                  <p className="portal-description">{portal.description}</p>
                  <button className="portal-button">
                    Enter Portal →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="chain-description">
          <div className="description-title">About {displayName}</div>
          <div className="description-content">
            {chain.description ? (
              chain.description
            ) : (
              <div className="empty-description">
                {displayName} is a new educational institution in the IHEZA network. 
                This is a fresh school chain with no existing data, ready for new staff and students to join.
                The portal system provides comprehensive management tools for all school operations.
              </div>
            )}
          </div>
        </div>

        {/* PWA Installation Section */}
        <div className="pwa-install-section">
          <div className="pwa-install-card">
            <div className="pwa-install-icon">
              <Smartphone size={32} />
            </div>
            <div className="pwa-install-content">
              <h3 className="pwa-install-title">Install {displayName} App</h3>
              <p className="pwa-install-description">
                Get the full experience by installing the IHEZA app on your device. 
                The app will remember this school and open directly to {displayName}'s portal.
              </p>
              
              {isInstalled ? (
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  background: '#dcfce7', 
                  borderRadius: '0.5rem',
                  color: '#166534',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  App Installed! Open from your home screen.
                </div>
              ) : (
                <div className="pwa-install-actions">
                  <button 
                    className="pwa-install-btn"
                    onClick={handleInstallApp}
                    disabled={installing}
                    style={{ opacity: installing ? 0.7 : 1 }}
                  >
                    <Download size={20} />
                    {installing ? 'Installing...' : canInstall ? 'Install App Now' : 'Install App'}
                  </button>
                  {!canInstall && !isInstalled && (
                    <button 
                      className="pwa-install-info-btn"
                      onClick={() => {
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        const isAndroid = /Android/.test(navigator.userAgent);
                        
                        let instructions = '';
                        if (isIOS) {
                          instructions = `To install on iOS:\n\n1. Tap the Share button (rectangle with arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm`;
                        } else if (isAndroid) {
                          instructions = `To install on Android:\n\n1. Tap the menu button (⋮ three dots)\n2. Tap "Install app" or "Add to Home screen"\n3. Tap "Install" to confirm`;
                        } else {
                          instructions = `To install:\n\n• Chrome/Edge: Click the install icon in the address bar\n• Or use the browser menu → "Install ${displayName}"`;
                        }
                        
                        alert(instructions);
                      }}
                    >
                      How to Install
                    </button>
                  )}
                </div>
              )}
              
              <div className="pwa-install-note">
                <small>Installed app will open to: {window.location.origin}/chain/{chain.code}</small>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ChainLandingPage;
