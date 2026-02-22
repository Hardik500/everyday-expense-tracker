/* eslint-disable react-refresh/only-export-components */
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log to console in development
    console.error('Error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // Store error details for debugging
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('lastError', JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  handleClearAndRetry = (): void => {
    // Clear session storage which might have corrupted state
    sessionStorage.clear();
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-bg-primary">
          <div className="max-w-[480px] w-full text-center p-10 bg-bg-card rounded-xl border border-border-color shadow-lg animate-page-scale-in">
            {/* Animated Error Icon */}
            <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-pulse" />
              <svg
                width="40"
                height="40"
                fill="none"
                stroke="#ef4444"
                viewBox="0 0 24 24"
                className="animate-shake"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-semibold text-text-primary mb-3">
              Something went wrong
            </h1>

            <p className="text-[0.9375rem] text-text-secondary mb-6 leading-relaxed">
              We encountered an unexpected error. Don't worry, your data is safe.
              Try refreshing the page or go back to the dashboard.
            </p>

            {/* Error details (collapsible in production) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left bg-bg-input rounded-lg p-4">
                <summary className="text-sm font-medium text-text-muted cursor-pointer select-none">
                  Error Details
                </summary>
                <pre className="mt-4 text-xs text-red-500 font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-auto">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={this.handleReload}
                className="primary min-w-[120px]"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="secondary min-w-[120px]"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Go Home
              </button>
            </div>

            <button
              onClick={this.handleClearAndRetry}
              className="mt-4 bg-transparent border-none text-text-muted text-sm cursor-pointer underline p-2 hover:text-text-primary transition-colors"
            >
              Clear cache and retry
            </button>

            {/* Support message */}
            <p className="mt-6 text-xs text-text-muted">
              If this error persists, please contact support with the error details.
            </p>
          </div>

          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-5px); }
              75% { transform: translateX(5px); }
            }
            .animate-shake {
              animation: shake 0.5s ease;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for catching async errors
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((err: Error) => {
    setError(err);
    console.error('Handled error:', err);
    
    // In production, you might send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // sendToErrorTracking(err);
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
}

export default ErrorBoundary;
