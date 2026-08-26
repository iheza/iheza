import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { getApiBaseUrl } from '../config/api';


/**
 * PushNotificationManager
 * 
 * Handles:
 *  - Requesting notification permission (with a friendly prompt)
 *  - Subscribing the user's browser to the backend push service
 *  - Unsubscribing when the user opts out
 *  - Persisting the user's choice in localStorage
 * 
 * It is rendered once at the app root (inside Layout) and shows a small
 * banner prompting the user to enable notifications. Once enabled, it
 * silently keeps the subscription in sync with the backend.
 */
function PushNotificationManager() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if the user has already made a choice about notifications
  useEffect(() => {
    if (typeof Notification === 'undefined') {
      // Notifications not supported
      return;
    }

    const choice = localStorage.getItem('push-notification-choice');
    if (choice === 'enabled') {
      setPermission('granted');
      // Ensure subscription is active
      ensureSubscription();
    } else if (choice === 'disabled') {
      setPermission('denied');
    } else {
      // No choice made yet - show the prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, []);


  // Get the auth token from localStorage (same key used by the app)
  const getToken = useCallback(() => {
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('sessionToken') ||
      localStorage.getItem('authToken') ||
      ''
    );
  }, []);

  // Get the API base URL
  const getBaseUrl = useCallback(() => {
    try {
      return getApiBaseUrl();
    } catch (e) {
      return process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
    }
  }, []);


  // Convert a base64url string to a Uint8Array (for applicationServerKey)
  const urlBase64ToUint8Array = useCallback((base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  // Fetch the VAPID public key from the backend
  const getVapidPublicKey = useCallback(async () => {
    const baseUrl = getBaseUrl();
    const token = getToken();
    const res = await fetch(`${baseUrl}/api/push/vapid-public-key`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error('Could not fetch VAPID key');
    }
    const data = await res.json();
    return data.publicKey;
  }, [getBaseUrl, getToken]);

  // Subscribe the current browser to push notifications
  const ensureSubscription = useCallback(async () => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        // Get VAPID key and subscribe
        const vapidKey = await getVapidPublicKey();
        if (!vapidKey) {
          setError('Push notifications are not configured on the server.');
          return;
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      // Send the subscription to the backend
      const baseUrl = getBaseUrl();
      const token = getToken();
      const res = await fetch(`${baseUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subscription.toJSON().keys,
        }),
      });

      if (res.ok) {
        setSubscribed(true);
        localStorage.setItem('push-notification-choice', 'enabled');
      } else {
        setError('Could not register for notifications.');
      }
    } catch (e) {
      console.warn('[Push] Subscription failed:', e);
      setError('Could not enable notifications.');
    } finally {
      setLoading(false);
    }
  }, [getBaseUrl, getToken, getVapidPublicKey, urlBase64ToUint8Array]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Notify backend
          const baseUrl = getBaseUrl();
          const token = getToken();
          try {
            await fetch(`${baseUrl}/api/push/unsubscribe`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ endpoint: subscription.endpoint }),
            });
          } catch (e) {
            // Ignore backend errors on unsubscribe
          }
          await subscription.unsubscribe();
        }
      }
      setSubscribed(false);
      localStorage.setItem('push-notification-choice', 'disabled');
    } catch (e) {
      console.warn('[Push] Unsubscribe failed:', e);
    }
  }, [getBaseUrl, getToken]);

  const handleEnable = async () => {
    setShowPrompt(false);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        await ensureSubscription();
      } else {
        localStorage.setItem('push-notification-choice', 'disabled');
      }
    } catch (e) {
      console.warn('[Push] Permission request failed:', e);
      localStorage.setItem('push-notification-choice', 'disabled');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('push-notification-choice', 'disabled');
  };

  // If notifications are not supported, render nothing
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // Show the enable prompt banner
  if (showPrompt && permission !== 'granted') {
    return (
      <div className="push-notification-prompt">
        <style>{`
          .push-notification-prompt {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #ffffff;
            color: #1e293b;
            padding: 1rem 1.5rem;
            border-radius: 1rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
            border: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 1rem;
            z-index: 10001;
            max-width: 90%;
            animation: pushSlideUp 0.3s ease;
          }
          
          @keyframes pushSlideUp {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
          
          .push-icon {
            width: 44px;
            height: 44px;
            background: #eff6ff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: #0369a1;
          }
          
          .push-content {
            flex: 1;
          }
          
          .push-title {
            font-weight: 600;
            font-size: 0.95rem;
            margin-bottom: 0.25rem;
            color: #0f172a;
          }
          
          .push-description {
            font-size: 0.8rem;
            color: #64748b;
          }
          
          .push-actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
          }
          
          .push-enable-btn {
            background: #0369a1;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            transition: all 0.2s;
            white-space: nowrap;
          }
          
          .push-enable-btn:hover {
            background: #0284c7;
          }
          
          .push-enable-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .push-dismiss-btn {
            background: transparent;
            color: #94a3b8;
            border: none;
            padding: 0.4rem;
            border-radius: 0.4rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .push-dismiss-btn:hover {
            background: #f1f5f9;
            color: #475569;
          }
          
          @media (max-width: 600px) {
            .push-notification-prompt {
              flex-direction: column;
              text-align: center;
              bottom: 70px;
              left: 1rem;
              right: 1rem;
              transform: none;
              max-width: none;
            }
            
            .push-actions {
              width: 100%;
              justify-content: center;
            }
          }
        `}</style>

        <div className="push-icon">
          <Bell size={22} />
        </div>

        <div className="push-content">
          <div className="push-title">Enable Notifications</div>
          <div className="push-description">
            Get alerts for new tasks, announcements, report cards & fee reminders
          </div>
        </div>

        <div className="push-actions">
          <button
            className="push-enable-btn"
            onClick={handleEnable}
            disabled={loading}
            data-testid="push-enable-btn"
          >
            <Bell size={14} />
            {loading ? 'Enabling...' : 'Enable'}
          </button>
          <button
            className="push-dismiss-btn"
            onClick={handleDismiss}
            data-testid="push-dismiss-btn"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // If subscribed, show a small status indicator (optional)
  if (subscribed && permission === 'granted') {
    return (
      <button
        onClick={unsubscribe}
        title="Notifications enabled - click to disable"
        className="push-status-indicator"
        data-testid="push-status-indicator"
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 10001,
          background: '#ecfdf5',
          color: '#059669',
          border: '1px solid #a7f3d0',
          borderRadius: '9999px',
          padding: '0.5rem 0.75rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <Bell size={14} />
        Notifications On
      </button>
    );
  }

  return null;
}

export default PushNotificationManager;
