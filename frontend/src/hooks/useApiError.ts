import { useState, useCallback } from 'react';

export interface ApiError {
  message: string;
  status?: number;
  endpoint?: string;
  recoverable: boolean;
}

export function useApiError() {
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleError = useCallback((err: unknown, endpoint?: string): ApiError => {
    let apiError: ApiError;

    if (err instanceof Response) {
      apiError = {
        message: `Server error (${err.status}): ${err.statusText}`,
        status: err.status,
        endpoint,
        recoverable: err.status >= 500, // Server errors might be temporary
      };
    } else if (err instanceof Error) {
      apiError = {
        message: err.message,
        endpoint,
        recoverable: true, // Network errors are usually recoverable
      };
    } else {
      apiError = {
        message: 'An unexpected error occurred',
        endpoint,
        recoverable: false,
      };
    }

    setError(apiError);
    console.error('API Error:', apiError);
    return apiError;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const wrapApiCall = useCallback(<T,>(
    promise: Promise<T>,
    endpoint: string,
    options?: { silent?: boolean }
  ): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    return promise
      .then((result) => {
        setIsLoading(false);
        return result;
      })
      .catch((err) => {
        setIsLoading(false);
        const apiError = handleError(err, endpoint);
        
        if (!options?.silent) {
          // Error is set, component can display it
        }
        
        return null;
      });
  }, [handleError]);

  return {
    error,
    isLoading,
    handleError,
    clearError,
    wrapApiCall,
  };
}
