import React from 'react';

/**
 * A beautiful, center-aligned loading spinner with an optional message.
 * Reusable across the app for data-fetching states.
 */
function LoadingSpinner({ message = 'Loading...', size = 48, color = '#0ea5e9' }) {
  return (
    <div className="loading-spinner-wrap">
      <style>{`
        .loading-spinner-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          gap: 1rem;
          width: 100%;
        }
        .loading-spinner-ring {
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: 4px solid rgba(14, 165, 233, 0.15);
          border-top-color: ${color};
          animation: loading-spin 0.8s linear infinite;
        }
        .loading-spinner-message {
          font-size: 0.875rem;
          color: #64748b;
          font-weight: 500;
          letter-spacing: 0.3px;
        }
        @keyframes loading-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="loading-spinner-ring" />
      {message && <div className="loading-spinner-message">{message}</div>}
    </div>
  );
}

export default LoadingSpinner;
