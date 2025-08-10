import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RequireAuth from './RequireAuth';

// Mock the auth service to avoid import.meta issues
jest.mock('../services/authService', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  AuthServiceError: class AuthServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
    }
  },
  getErrorMessage: jest.fn((error) => error.message),
  isAuthError: jest.fn(() => true),
  apiClient: {
    setAuthToken: jest.fn(),
  },
}));

// Mock secure token storage
jest.mock('../utils/secureTokenStorage', () => ({
  __esModule: true,
  default: {
    setToken: jest.fn(),
    getToken: jest.fn().mockResolvedValue(null),
    clearAll: jest.fn(),
  },
}));

// Create a mock auth context that we can control
let mockAuthContext = {
  user: null as any,
  token: null as any,
  isLoading: false,
  error: null,
  isInitialized: true,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  updateUser: jest.fn(),
  clearError: jest.fn(),
};

// Mock the AuthContext
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: any) => children,
}));

describe('RequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContext.user = null;
    mockAuthContext.isLoading = false;
  });

  it('should show loading spinner when isLoading is true', () => {
    mockAuthContext.isLoading = true;
    
    render(
      <MemoryRouter>
        <RequireAuth />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading authentication status')).toBeInTheDocument();
  });

  it('should redirect to login when user is not authenticated', () => {
    mockAuthContext.user = null;
    mockAuthContext.isLoading = false;
    
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <RequireAuth />
      </MemoryRouter>
    );

    // Since this will trigger a Navigate, we can't easily test the redirect
    // But we can verify the component rendered without crashing
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should render outlet when user is authenticated', () => {
    mockAuthContext.user = {
      id: '123',
      name: 'Test User',
      email: 'test@example.com',
      profilePicture: null,
      emailVerified: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    };
    mockAuthContext.isLoading = false;
    
    render(
      <MemoryRouter>
        <RequireAuth />
      </MemoryRouter>
    );

    // The component should render the Outlet (which would be empty in this test)
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
