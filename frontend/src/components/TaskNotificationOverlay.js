import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectCurrentPortal } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { SoundEffects } from '../hooks/useNotificationSound';
import { ClipboardList, Bell, ArrowRight, X } from 'lucide-react';

/**
 * TaskNotificationOverlay
 * 
 * Shows a full-screen blurred overlay with "You have a task" notification
 * when a task is assigned to the current user. The overlay persists until
 * the user clicks "View My Tasks" which navigates to /portal/my-tasks.
 * 
 * Only shows for roles that receive tasks (academic, teacher, secretary, section_leader).
 */
const TaskNotificationOverlay = () => {
  const currentUser = useSelector(selectCurrentUser);
  const portal = useSelector(selectCurrentPortal);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [hasPendingTasks, setHasPendingTasks] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [latestTask, setLatestTask] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  
  // Track previously seen task IDs to detect new tasks
  const seenTaskIdsRef = useRef(new Set());
  const soundPlayedRef = useRef(false);
  // Flag set when a poll fails (used by the adaptive backoff logic)
  const pollFailedRef = useRef(false);
  // Flag set when a poll fails with a HARD error (4xx/5xx) that should NOT
  // be retried. Once set, polling stops entirely until the component remounts.
  const hardStopRef = useRef(false);


  
  // Roles that receive tasks (same as MyTasks page)
  // Principals can also receive tasks from directors/coordinators
  const shouldShow = !['student', 'director', 'coordinator'].includes(portal);

  
  // Check if we're on the MyTasks page
  const isOnMyTasks = location.pathname === '/portal/my-tasks';
  
  const loadTasks = useCallback(async () => {
    if (!currentUser?.id || !shouldShow) return;
    
    try {
      const response = await apiClient.get(`/staff-tasks?assigned_to=${currentUser.id}`);
      const myTasks = response.data || [];
      
      // Filter for pending or in_progress tasks
      const pendingTasks = myTasks.filter(t => 
        t.status === 'pending' || t.status === 'in_progress'
      );
      
      setHasPendingTasks(pendingTasks.length > 0);
      setTaskCount(pendingTasks.length);
      
      if (pendingTasks.length > 0) {
        // Get the most recent task
        const sorted = [...pendingTasks].sort((a, b) => 
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        setLatestTask(sorted[0]);
        
        // Check if there are any NEW tasks (not seen before)
        let hasNewTask = false;
        pendingTasks.forEach(t => {
          if (!seenTaskIdsRef.current.has(t.id)) {
            hasNewTask = true;
          }
        });
        
        // Update seen task IDs
        pendingTasks.forEach(t => seenTaskIdsRef.current.add(t.id));
        
        // Show overlay if:
        // 1. There's a new task AND we're not on MyTasks page
        // 2. OR there are pending tasks AND we haven't dismissed AND we're not on MyTasks
        if (!isOnMyTasks && !dismissed) {
          if (hasNewTask || !soundPlayedRef.current) {
            setShowOverlay(true);
            if (!soundPlayedRef.current) {
              SoundEffects.notification();
              soundPlayedRef.current = true;
            }
          }
        }
      } else {
        // No pending tasks - hide overlay and reset
        setShowOverlay(false);
        setDismissed(false);
        soundPlayedRef.current = false;
      }
    } catch (error) {
      console.error('Error checking tasks:', error);
      // Distinguish HARD failures (4xx/5xx responses) from transient network
      // errors. Hard failures mean the endpoint is broken or the server is
      // down — retrying will never succeed, so we STOP polling entirely.
      const status = error?.response?.status;
      const isHardFailure = status >= 400 && status <= 599;
      if (isHardFailure) {
        hardStopRef.current = true;
        console.warn(
          `Task polling stopped: /staff-tasks returned HTTP ${status}. ` +
          'Not retrying to avoid hammering the server.'
        );
      } else {
        // Transient network error (timeout, HTTP2 protocol error, offline) —
        // signal the polling loop so it can back off and retry.
        pollFailedRef.current = true;
      }
    }
  }, [currentUser?.id, shouldShow, isOnMyTasks, dismissed]);


  
  // Initial load and polling with adaptive backoff and a hard-stop guard.
  // Normally polls every 60s. On transient network errors (timeout, HTTP2
  // protocol error, offline) it backs off up to 120s and stops after a max
  // number of consecutive failures. On HARD failures (4xx/5xx responses) it
  // stops polling entirely — retrying a broken endpoint only hammers the
  // server and spams the console with errors.
  //
  // Polling is also PAUSED while the tab is hidden (document.visibilityState
  // === 'hidden') so background tabs don't keep hammering the server. This
  // dramatically cuts sustained load when many staff users leave the app open
  // in background tabs.
  useEffect(() => {
    if (!shouldShow || !currentUser?.id) return;
    
    let interval = null;
    let consecutiveErrors = 0;
    let cancelled = false;
    // Max consecutive transient failures before we give up polling. Prevents
    // an infinite retry loop when the origin is unreachable.
    const MAX_CONSECUTIVE_ERRORS = 5;
    // Base poll interval (ms). Raised from 15s to 60s to reduce sustained load.
    const BASE_INTERVAL = 60000;
    // Max backoff after repeated failures.
    const MAX_BACKOFF = 120000;

    const scheduleNext = (delay) => {
      if (cancelled) return;
      interval = setTimeout(async () => {
        // If a previous poll hit a hard failure (4xx/5xx), stop entirely.
        if (hardStopRef.current) {
          cancelled = true;
          return;
        }

        // Pause polling while the tab is hidden. When the tab becomes visible
        // again, the visibilitychange listener below triggers an immediate
        // poll, so no notifications are missed.
        if (document.visibilityState === 'hidden') {
          scheduleNext(BASE_INTERVAL);
          return;
        }

        await loadTasks();

        // loadTasks swallows its own errors, so detect failure by checking
        // whether the poll actually produced a result. We approximate by
        // tracking a flag set inside loadTasks via a ref.
        if (pollFailedRef.current) {
          consecutiveErrors += 1;
          pollFailedRef.current = false;
        } else {
          consecutiveErrors = 0;
        }

        // Stop after too many consecutive transient failures to avoid an
        // infinite retry loop against an unreachable origin.
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.warn(
            `Task polling stopped after ${consecutiveErrors} consecutive ` +
            'transient failures. Will resume on next page load.'
          );
          cancelled = true;
          return;
        }

        // Backoff: 60s normally, up to 120s after repeated failures
        const delay = consecutiveErrors > 0
          ? Math.min(BASE_INTERVAL * Math.pow(2, consecutiveErrors), MAX_BACKOFF)
          : BASE_INTERVAL;
        scheduleNext(delay);
      }, delay);
    };

    // Initial check
    loadTasks();
    scheduleNext(BASE_INTERVAL);

    // When the tab becomes visible again, poll immediately (in case tasks
    // were assigned while hidden) and resume the normal schedule.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        if (interval) clearTimeout(interval);
        loadTasks();
        scheduleNext(BASE_INTERVAL);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      if (interval) clearTimeout(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [shouldShow, currentUser?.id, loadTasks]);



  
  // When user navigates to MyTasks, dismiss the overlay
  useEffect(() => {
    if (isOnMyTasks) {
      setShowOverlay(false);
      setDismissed(true);
    }
  }, [isOnMyTasks]);
  
  // When user leaves MyTasks and there are still pending tasks, re-show the overlay
  useEffect(() => {
    if (!isOnMyTasks && hasPendingTasks && dismissed) {
      // Reset dismissed so the next poll cycle can re-show the overlay
      setDismissed(false);
    }
  }, [isOnMyTasks, hasPendingTasks, dismissed]);
  
  const handleViewTasks = () => {
    setShowOverlay(false);
    setDismissed(true);
    navigate('/portal/my-tasks');
  };
  
  const handleDismiss = () => {
    setShowOverlay(false);
    setDismissed(true);
  };
  
  if (!shouldShow || !showOverlay) return null;
  
  return (
    <div className="task-notification-overlay">
      <style>{`
        .task-notification-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: taskOverlayFadeIn 0.3s ease-out;
        }
        
        @keyframes taskOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .task-notification-card {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 1.5rem;
          padding: 3rem;
          max-width: 480px;
          width: 90%;
          text-align: center;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
          animation: taskCardPopIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          position: relative;
        }
        
        @keyframes taskCardPopIn {
          from { 
            opacity: 0; 
            transform: scale(0.8) translateY(20px);
          }
          to { 
            opacity: 1; 
            transform: scale(1) translateY(0);
          }
        }
        
        .task-notification-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
          animation: taskBellRing 2s ease-in-out infinite;
        }
        
        @keyframes taskBellRing {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-15deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-10deg); }
          50% { transform: rotate(0deg); }
        }
        
        .task-notification-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #f8fafc;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }
        
        .task-notification-subtitle {
          font-size: 1rem;
          color: #94a3b8;
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }
        
        .task-notification-count {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #fbbf24;
          padding: 0.5rem 1.25rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }
        
        .task-notification-task-title {
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 2rem;
          text-align: left;
        }
        
        .task-notification-task-label {
          font-size: 0.7rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        
        .task-notification-task-name {
          font-size: 1rem;
          font-weight: 600;
          color: #f8fafc;
        }
        
        .task-notification-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .task-notification-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          border-radius: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          width: 100%;
        }
        
        .task-notification-btn-primary {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
        }
        
        .task-notification-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
        }
        
        .task-notification-btn-secondary {
          background: transparent;
          color: #94a3b8;
          border: 1px solid rgba(71, 85, 105, 0.5);
        }
        
        .task-notification-btn-secondary:hover {
          background: rgba(51, 65, 85, 0.3);
          color: #f8fafc;
        }
        
        .task-notification-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(51, 65, 85, 0.5);
          border: none;
          border-radius: 0.5rem;
          color: #64748b;
          cursor: pointer;
          padding: 0.5rem;
          transition: all 0.2s;
        }
        
        .task-notification-close:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        
        @media (max-width: 640px) {
          .task-notification-card {
            padding: 2rem 1.5rem;
          }
          
          .task-notification-title {
            font-size: 1.5rem;
          }
        }
      `}</style>
      
      <div className="task-notification-card">
        <button className="task-notification-close" onClick={handleDismiss} aria-label="Dismiss">
          <X size={18} />
        </button>
        
        <div className="task-notification-icon">
          <Bell size={36} color="white" />
        </div>
        
        <h2 className="task-notification-title">You have a task!</h2>
        <p className="task-notification-subtitle">
          A new task has been assigned to you. Please review and take action.
        </p>
        
        <div className="task-notification-count">
          <ClipboardList size={16} />
          {taskCount} pending task{taskCount !== 1 ? 's' : ''}
        </div>
        
        {latestTask && (
          <div className="task-notification-task-title">
            <div className="task-notification-task-label">Latest Task</div>
            <div className="task-notification-task-name">{latestTask.title}</div>
          </div>
        )}
        
        <div className="task-notification-actions">
          <button className="task-notification-btn task-notification-btn-primary" onClick={handleViewTasks}>
            View My Tasks <ArrowRight size={18} />
          </button>
          <button className="task-notification-btn task-notification-btn-secondary" onClick={handleDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskNotificationOverlay;
