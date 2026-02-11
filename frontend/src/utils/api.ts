export class APIError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data?: unknown) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    try {
        const token = localStorage.getItem('auth_token');

        const headers = {
            ...options.headers,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        } as Record<string, string>;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        let response: Response;
        try {
            response = await fetch(url, { 
                ...options, 
                headers,
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                throw new APIError('Request timed out. Please try again.', 408);
            }
            throw new APIError('Network error. Check your connection.', 0);
        }

        // Handle rate limiting (429)
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const message = retryAfter 
                ? `Rate limited. Please retry after ${retryAfter} seconds.`
                : 'Rate limit exceeded. Please slow down.';
            throw new APIError(message, 429);
        }

        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            window.location.reload();
            throw new APIError('Session expired. Please log in again.', 401);
        }

        // Handle server errors (500+)
        if (response.status >= 500) {
            throw new APIError('Server error. Please try again later.', response.status);
        }

        // Handle client errors (400-499)
        if (!response.ok) {
            let errorMessage = `Request failed with status ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch {
                // Response is not JSON
                errorMessage = await response.text() || errorMessage;
            }
            throw new APIError(errorMessage, response.status);
        }

        return response;
    } catch (error) {
        // MED-005: Re-throw APIErrors, wrap others
        if (error instanceof APIError) {
            throw error;
        }
        throw new APIError(
            error instanceof Error ? error.message : 'An unexpected error occurred',
            0
        );
    }
};

// MED-005: User-friendly error message helper
export const getUserFriendlyError = (error: unknown): string => {
    if (error instanceof APIError) {
        // Phase 6: Provide user-friendly messages
        switch (error.status) {
            case 0:
                return 'Unable to connect. Please check your internet connection.';
            case 400:
                return error.message || 'Invalid request. Please check your input.';
            case 401:
                return 'Your session has expired. Please log in again.';
            case 403:
                return 'You don\'t have permission to perform this action.';
            case 404:
                return 'The requested resource was not found.';
            case 408:
                return 'The request timed out. Please try again.';
            case 429:
                return error.message; // Rate limiting message from above
            case 500:
                return 'Something went wrong on our end. Please try again later.';
            case 502:
            case 503:
            case 504:
                return 'Service temporarily unavailable. Please try again later.';
            default:
                return error.message || `Error ${error.status}. Please try again.`;
        }
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
};

// MED-005: Promise wrapper with default handling
export const withErrorHandling = async <T,>(
    promise: Promise<T>,
    onError?: (error: APIError) => void
): Promise<T | null> => {
    try {
        return await promise;
    } catch (error) {
        const apiError = error instanceof APIError ? error : new APIError(String(error), 0);
        onError?.(apiError);
        return null;
    }
};
