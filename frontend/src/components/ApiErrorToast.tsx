import React, { useEffect, useState } from 'react';
import { ApiError } from '../hooks/useApiError';
import './ApiErrorToast.css';

interface Props {
  error: ApiError | null;
  onDismiss: () => void;
  autoDismiss?: boolean;
  dismissAfter?: number;
}

export function ApiErrorToast({ 
  error, 
  onDismiss, 
  autoDismiss = true,
  dismissAfter = 5000 
}: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (error) {
      setIsVisible(true);
      setIsExiting(false);

      if (autoDismiss) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, dismissAfter);
        return () => clearTimeout(timer);
      }
    }
  }, [error, autoDismiss, dismissAfter]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300);
  };

  const handleRetry = () => {
    onDismiss();
    window.location.reload();
  };

  if (!isVisible || !error) return null;

  return (
    <div className={`api-error-toast ${isExiting ? 'exiting' : ''}`}>
      <div className="api-error-content">
        <div className="api-error-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        
        <div className="api-error-message">
          <p className="api-error-title">Something went wrong</p>
          <p className="api-error-detail">{error.message}</p>
          {error.endpoint && (
            <p className="api-error-endpoint">{error.endpoint}</p>
          )}
        </div>

        <div className="api-error-actions">
          {error.recoverable && (
            <button 
              className="api-error-retry"
              onClick={handleRetry}
              title="Reload page"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          
          <button 
            className="api-error-close"
            onClick={handleDismiss}
            title="Dismiss"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {autoDismiss && (
        <div 
          className="api-error-progress"
          style={{ animationDuration: `${dismissAfter}ms` }}
        />
      )}
    </div>
  );
}

export default ApiErrorToast;
