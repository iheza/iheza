import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissedAt) {
      const dismissedTime = new Date(dismissedAt).getTime();
      const now = new Date().getTime();
      const hoursSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        return; // Don't show for 24 hours after dismiss
      }
    }

    // Listen for custom event dispatched by App.js when beforeinstallprompt fires
    const handlePwaInstallReady = () => {
      if (window.deferredPrompt) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('pwaInstallReady', handlePwaInstallReady);

    // Also check if prompt is already available
    if (window.deferredPrompt) {
      setShowPrompt(true);
    }

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      window.deferredPrompt = null;
    });

    return () => {
      window.removeEventListener('pwaInstallReady', handlePwaInstallReady);
    };
  }, []);

  const handleInstall = async () => {
    const promptEvent = window.deferredPrompt;
    if (!promptEvent) return;

    // Show the install prompt
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    window.deferredPrompt = null;
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="pwa-install-prompt">
      <style>{`
        .pwa-install-prompt {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 1rem;
          box-shadow: 0 8px 32px rgba(3, 105, 161, 0.4);
          display: flex;
          align-items: center;
          gap: 1rem;
          z-index: 10000;
          max-width: 90%;
          animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        .pwa-icon {
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .pwa-content {
          flex: 1;
        }
        
        .pwa-title {
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }
        
        .pwa-description {
          font-size: 0.875rem;
          opacity: 0.9;
        }
        
        .pwa-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .pwa-install-btn {
          background: white;
          color: #0369a1;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        
        .pwa-install-btn:hover {
          transform: scale(1.05);
        }
        
        .pwa-dismiss-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          padding: 0.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .pwa-dismiss-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        @media (max-width: 600px) {
          .pwa-install-prompt {
            flex-direction: column;
            text-align: center;
            bottom: 70px;
            left: 1rem;
            right: 1rem;
            transform: none;
            max-width: none;
          }
          
          .pwa-actions {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
      
      <div className="pwa-icon">
        <Smartphone size={24} />
      </div>
      
      <div className="pwa-content">
        <div className="pwa-title">Install IHEZA App</div>
        <div className="pwa-description">
          Install for quick access on your device
        </div>
      </div>
      
      <div className="pwa-actions">
        <button className="pwa-install-btn" onClick={handleInstall} data-testid="pwa-install-btn">
          <Download size={16} />
          Install
        </button>
        <button className="pwa-dismiss-btn" onClick={handleDismiss} data-testid="pwa-dismiss-btn">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;
