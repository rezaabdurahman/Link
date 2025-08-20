// Authentication service layer for API interactions
// Provides register, login, refresh, and logout functions with robust error handling

import { getEnvVar } from '../utils/env';

// Base API URL from environment variables
const API_BASE_URL = getEnvVar('VITE_API_BASE_URL') || getEnvVar('VITE_API_URL') || 'http://localhost:8080';

// API endpoints (clean URLs through API Gateway)
const AUTH_ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login', 
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/users/profile',
} as const;

// Request/Response types
export interface RegisterRequest {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  confirmPassword?: string;
  date_of_birth?: string; // ISO string format
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string; // ISO string format
    profile_picture?: string | null;
    bio?: string | null;
    location?: string | null;
    email_verified: boolean;
    created_at: string; // ISO string format
    updated_at: string; // ISO string format
  };
  token?: string; // Optional for token-based auth fallback
  message: string;
}

export interface RefreshResponse {
  token?: string;
  expiresAt: string;
}

// User profile response from /me endpoint
export interface MeResponse {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string; // ISO string format
  profile_picture?: string | null;
  bio?: string | null;
  location?: string | null;
  email_verified: boolean;
  created_at: string; // ISO string format
  updated_at: string; // ISO string format
}

// Backend ErrorResponse mapped to discriminated union
export type ApiError = 
  | {
      type: 'VALIDATION_ERROR';
      message: string;
      field?: string;
      code: 'INVALID_EMAIL' | 'PASSWORD_TOO_WEAK' | 'REQUIRED_FIELD' | 'INVALID_FORMAT';
    }
  | {
      type: 'AUTHENTICATION_ERROR';
      message: string;
      code: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'EMAIL_NOT_VERIFIED' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN';
    }
  | {
      type: 'AUTHORIZATION_ERROR';
      message: string;
      code: 'ACCESS_DENIED' | 'INSUFFICIENT_PERMISSIONS' | 'TOKEN_EXPIRED';
    }
  | {
      type: 'CONFLICT_ERROR';
      message: string;
      code: 'EMAIL_ALREADY_EXISTS' | 'USERNAME_TAKEN' | 'BLOCK_EXISTS';
    }
  | {
      type: 'NOT_FOUND_ERROR';
      message: string;
      code: 'USER_NOT_FOUND' | 'BLOCK_NOT_FOUND';
    }
  | {
      type: 'BUSINESS_LOGIC_ERROR';
      message: string;
      code: 'CANNOT_BLOCK_SELF' | 'USER_BLOCKED';
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
      code: 'INTERNAL_SERVER_ERROR' | 'SERVICE_UNAVAILABLE' | 'DATABASE_ERROR' | 'INTERNAL_ERROR';
    }
  | {
      type: 'NETWORK_ERROR';
      message: string;
      code: 'CONNECTION_FAILED' | 'TIMEOUT' | 'DNS_ERROR';
    };

export class AuthServiceError extends Error {
  constructor(public error: ApiError) {
    super(error.message);
    this.name = 'AuthServiceError';
  }
}

// HTTP client with authentication support
class AuthApiClient {
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

      // Handle empty responses (like logout)
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      // Handle network errors
      if (error instanceof AuthServiceError) {
        throw error;
      }
      
      throw new AuthServiceError({
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
      throw new AuthServiceError({
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
            code: data.code || 'INVALID_FORMAT',
          };
        
        case 401:
          return {
            type: 'AUTHENTICATION_ERROR', 
            message: data.message || 'Authentication failed',
            code: data.code || 'INVALID_CREDENTIALS',
          };
          
        case 403:
          return {
            type: 'AUTHORIZATION_ERROR',
            message: data.message || 'Access denied',
            code: data.code || 'ACCESS_DENIED',
          };
          
        case 409:
          return {
            type: 'CONFLICT_ERROR',
            message: data.message || 'Resource conflict',
            code: data.code || 'EMAIL_ALREADY_EXISTS',
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
    throw new AuthServiceError(apiError);
  }

  // Public API methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'GET',
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

// Single instance of the API client
const apiClient = new AuthApiClient();

// Authentication service functions

/**
 * Register a new user account
 * @param userData Registration data including name, email, and password
 * @returns Promise resolving to user data and authentication info
 * @throws AuthServiceError with detailed error information
 */
export async function register(userData: RegisterRequest): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>(AUTH_ENDPOINTS.register, userData);
    
    // Store token if provided (fallback auth method)
    if (response.token) {
      apiClient.setAuthToken(response.token);
    }
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Registration failed due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Authenticate user with email and password
 * @param credentials User email and password
 * @returns Promise resolving to user data and authentication info
 * @throws AuthServiceError with detailed error information
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>(AUTH_ENDPOINTS.login, credentials);
    
    // Store token if provided (fallback auth method)  
    if (response.token) {
      apiClient.setAuthToken(response.token);
    }
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR', 
      message: 'Login failed due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Refresh authentication token/session
 * @returns Promise resolving to new token data
 * @throws AuthServiceError with detailed error information
 */
export async function refresh(): Promise<RefreshResponse> {
  try {
    const response = await apiClient.post<RefreshResponse>(AUTH_ENDPOINTS.refresh);
    
    // Update stored token if provided
    if (response.token) {
      apiClient.setAuthToken(response.token);
    }
    
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      // Clear stored token on refresh failure
      apiClient.setAuthToken(null);
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Token refresh failed due to an unexpected error', 
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

/**
 * Log out user and invalidate session/token
 * @returns Promise resolving when logout is complete
 * @throws AuthServiceError with detailed error information
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.delete(AUTH_ENDPOINTS.logout);
    
    // Clear stored token
    apiClient.setAuthToken(null);
  } catch (error) {
    // Always clear token on logout, even if request fails
    apiClient.setAuthToken(null);
    
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Logout failed due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR', 
    });
  }
}

/**
 * Get current user profile data
 * @returns Promise resolving to current user profile
 * @throws AuthServiceError with detailed error information
 */
export async function me(): Promise<MeResponse> {
  try {
    const response = await apiClient.get<MeResponse>(AUTH_ENDPOINTS.me);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError({
      type: 'SERVER_ERROR',
      message: 'Failed to fetch user profile due to an unexpected error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}

// Helper function to check if error is authentication-related
export function isAuthError(error: unknown): error is AuthServiceError {
  return error instanceof AuthServiceError && 
    (error.error.type === 'AUTHENTICATION_ERROR' || error.error.type === 'AUTHORIZATION_ERROR');
}

// Helper function to get user-friendly error messages
export function getErrorMessage(error: ApiError): string {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      return error.field ? `${error.field}: ${error.message}` : error.message;
    case 'AUTHENTICATION_ERROR':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'AUTHORIZATION_ERROR':
      return 'You don\'t have permission to perform this action.';
    case 'CONFLICT_ERROR':
      return error.code === 'EMAIL_ALREADY_EXISTS' 
        ? 'An account with this email already exists. Please use a different email or try logging in.'
        : error.message;
    case 'RATE_LIMIT_ERROR':
      return `Too many attempts. Please wait ${error.retryAfter} seconds before trying again.`;
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
