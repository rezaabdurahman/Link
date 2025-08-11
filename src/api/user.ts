// User API service for profile-related operations
// Provides updateBroadcast function with robust error handling and strict typing

// Base API URL from environment variables
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:8080';

// API endpoints
const USER_ENDPOINTS = {
  updateBroadcast: '/users/profile/broadcast',
} as const;

// Request/Response types
export interface UpdateBroadcastRequest {
  broadcast: string;
}

export interface UpdateBroadcastResponse {
  broadcast: string;
}

// Backend ErrorResponse mapped to discriminated union
export type ApiError = 
  | {
      type: 'VALIDATION_ERROR';
      message: string;
      field?: string;
      code: 'INVALID_INPUT' | 'REQUIRED_FIELD' | 'INVALID_FORMAT' | 'BROADCAST_TOO_LONG';
    }
  | {
      type: 'AUTHENTICATION_ERROR';
      message: string;
      code: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'UNAUTHORIZED';
    }
  | {
      type: 'AUTHORIZATION_ERROR';
      message: string;
      code: 'ACCESS_DENIED' | 'INSUFFICIENT_PERMISSIONS';
    }
  | {
      type: 'RATE_LIMIT_ERROR';
      message: string;
      retryAfter: number;
      code: 'TOO_MANY_REQUESTS';
    }
  | {
      type: 'SERVER_ERROR';
      message: string;
      code: 'INTERNAL_SERVER_ERROR' | 'SERVICE_UNAVAILABLE' | 'DATABASE_ERROR';
    }
  | {
      type: 'NETWORK_ERROR';
      message: string;
      code: 'CONNECTION_FAILED' | 'TIMEOUT' | 'DNS_ERROR';
    };

export class UserServiceError extends Error {
  constructor(public error: ApiError) {
    super(error.message);
    this.name = 'UserServiceError';
  }
}

// HTTP client with authentication support
class UserApiClient {
  private authToken: string | null = null;

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Default headers with Content-Type
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add Authorization header if token is available (fallback for non-cookie auth)
    if (this.authToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestConfig: RequestInit = {
      ...options,
      headers,
      // Always include cookies for session-based authentication
      credentials: 'include',
    };

    try {
      const response = await fetch(url, requestConfig);
      
      // Handle different response types
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      // Handle network errors
      if (error instanceof UserServiceError) {
        throw error;
      }
      
      throw new UserServiceError({
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
        code: 'CONNECTION_FAILED',
      });
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorData: any;
    
    try {
      errorData = await response.json();
    } catch {
      // Handle non-JSON error responses
      throw new UserServiceError({
        type: 'SERVER_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
        code: 'INTERNAL_SERVER_ERROR',
      });
    }

    // Map HTTP status codes to error types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapStatusToError = (status: number, data: any): ApiError => {
      switch (status) {
        case 400:
          return {
            type: 'VALIDATION_ERROR',
            message: data.message || 'Invalid request data',
            field: data.field,
            code: data.code || 'INVALID_INPUT',
          };
        
        case 401:
          return {
            type: 'AUTHENTICATION_ERROR', 
            message: data.message || 'Authentication failed',
            code: data.code || 'UNAUTHORIZED',
          };
          
        case 403:
          return {
            type: 'AUTHORIZATION_ERROR',
            message: data.message || 'Access denied',
            code: data.code || 'ACCESS_DENIED',
          };
          
        case 429:
          return {
            type: 'RATE_LIMIT_ERROR',
            message: data.message || 'Too many requests',
            retryAfter: data.retryAfter || 60,
            code: 'TOO_MANY_REQUESTS',
          };
          
        case 500:
        default:
          return {
            type: 'SERVER_ERROR',
            message: data.message || 'Internal server error',
            code: data.code || 'INTERNAL_SERVER_ERROR',
          };
      }
    };

    const apiError = mapStatusToError(response.status, errorData);
    throw new UserServiceError(apiError);
  }

  // Public API methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'GET',
    });
  }
}

// Single instance of the API client
const apiClient = new UserApiClient();

/**
 * Update user broadcast message
 * @param broadcast The new broadcast message to set
 * @returns Promise resolving to the updated broadcast data
 * @throws UserServiceError with detailed error information
 */
export async function updateBroadcast(broadcast: string): Promise<{ broadcast: string }> {
  try {
    // Validate input
    if (typeof broadcast !== 'string') {
      throw new UserServiceError({
        type: 'VALIDATION_ERROR',
        message: 'Broadcast must be a string',
        field: 'broadcast',
        code: 'INVALID_FORMAT',
      });
    }

    // Prepare request data
    const requestData: UpdateBroadcastRequest = {
      broadcast: broadcast.trim(),
    };

    const response = await apiClient.put<UpdateBroadcastResponse>(
      USER_ENDPOINTS.updateBroadcast,
      requestData
    );
    
    return {
      broadcast: response.broadcast,
    };
  } catch (error) {
    if (error instanceof UserServiceError) {
      throw error;
    }
    throw new UserServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to update broadcast due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

// Helper function to check if error is authentication-related
export function isAuthError(error: unknown): error is UserServiceError {
  return error instanceof UserServiceError && 
    (error.error.type === 'AUTHENTICATION_ERROR' || error.error.type === 'AUTHORIZATION_ERROR');
}

// Helper function to get user-friendly error messages
export function getErrorMessage(error: ApiError): string {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      return error.field ? `${error.field}: ${error.message}` : error.message;
    case 'AUTHENTICATION_ERROR':
      return 'Authentication failed. Please log in again.';
    case 'AUTHORIZATION_ERROR':
      return 'You don\'t have permission to perform this action.';
    case 'RATE_LIMIT_ERROR':
      return `Too many requests. Please wait ${error.retryAfter} seconds before trying again.`;
    case 'SERVER_ERROR':
      return 'Something went wrong on our end. Please try again later.';
    case 'NETWORK_ERROR':
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

// Export API client for advanced usage (if needed)
export { apiClient };
