import React, { useEffect, useState } from 'react';
import { ApiError } from '../hooks/useApiError';

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
    <div
      className={`fixed bottom-4 left-4 right-4 max-w-[480px] ml-auto bg-bg-card border border-border-color border-l-4 border-l-red-500 rounded-lg shadow-lg z-[9999] overflow-hidden transition-all duration-300 ${
        isExiting
          ? 'animate-[toastSlideOut_0.3s_ease_forwards]'
          : 'animate-[toastSlideIn_0.3s_ease]'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-text-primary mb-1">Something went wrong</p>
          <p className="text-sm text-text-secondary leading-relaxed break-words m-0">
            {error.message}
          </p>
          {error.endpoint && (
            <p className="text-xs text-text-muted mt-1 mb-0 font-mono">
              {error.endpoint}
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {error.recoverable && (
            <button
              className="w-8 h-8 rounded-md bg-transparent text-text-secondary cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red-500/10 hover:text-red-500"
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
            className="w-8 h-8 rounded-md bg-transparent text-text-secondary cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red-500/10 hover:text-red-500"
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
          className="h-[3px] bg-red-500 animate-progressShrink"
          style={{ animationDuration: `${dismissAfter}ms` }}
        />
      )}
    </div>
  );
}

export default ApiErrorToast;

// Add custom animations to index.css
// These animations are already in index.css, but we'll add them here for reference
/*
@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toastSlideOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}

@keyframes progressShrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}
*/