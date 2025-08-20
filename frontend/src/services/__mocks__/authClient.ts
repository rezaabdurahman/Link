// Mock auth client for Jest tests

export interface RegisterRequest {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  confirmPassword?: string;
  date_of_birth?: string;
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
    date_of_birth?: string;
    profile_picture?: string | null;
    bio?: string | null;
    location?: string | null;
    email_verified: boolean;
    created_at: string;
    updated_at: string;
  };
  token?: string;
  message: string;
}

export interface MeResponse {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  profile_picture?: string | null;
  bio?: string | null;
  location?: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export type ApiError = {
  type: 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'CONFLICT_ERROR' | 'SERVER_ERROR' | 'NETWORK_ERROR';
  message: string;
  code: string;
};

export class AuthServiceError extends Error {
  constructor(public error: ApiError) {
    super(error.message);
    this.name = 'AuthServiceError';
  }
}

// Mock API client
export const apiClient = {
  setAuthToken: jest.fn(),
  register: jest.fn(),
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn(),
};

// Mock functions
export const getErrorMessage = jest.fn((error: any) => error.message || 'An error occurred');

export const register = jest.fn(async (data: RegisterRequest): Promise<AuthResponse> => {
  return {
    user: {
      id: '1',
      email: data.email,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    message: 'Account created successfully',
  };
});

export const login = jest.fn();
export const refreshToken = jest.fn();
export const logout = jest.fn();
export const getCurrentUser = jest.fn();
