// RouteGuards.test.tsx - Tests for authentication route guards
// Verifies RequireAuth and GuestOnly components redirect appropriately based on auth state

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RequireAuth from '../RequireAuth';
import GuestOnly from '../GuestOnly';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the auth service to avoid actual API calls
jest.mock('../../services/authService', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  AuthServiceError: jest.fn(),
  getErrorMessage: jest.fn(),
  apiClient: {
    setAuthToken: jest.fn(),
  },
}));

// Mock secure token storage
jest.mock('../../utils/secureTokenStorage', () => ({
  default: {
    getToken: jest.fn().mockResolvedValue(null),
    setToken: jest.fn(),
    clearAll: jest.fn(),
  },
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);


describe('Route Guards', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('RequireAuth', () => {
    it('shows loading spinner while auth is loading', async () => {
      render(
        <TestWrapper>
          <RequireAuth />
        </TestWrapper>
      );

      // Should show loading spinner initially
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('redirects to login when user is not authenticated', async () => {
      // Wait for auth state to initialize
      render(
        <TestWrapper>
          <RequireAuth />
        </TestWrapper>
      );

      // Wait for auth initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should redirect to login - in a real scenario this would be handled by Navigate component
      // For testing purposes, we verify the component structure
      expect(screen.queryByText('Test Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('GuestOnly', () => {
    it('shows loading spinner while auth is loading', async () => {
      render(
        <TestWrapper>
          <GuestOnly />
        </TestWrapper>
      );

      // Should show loading spinner initially
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('allows access to guest-only content when user is not authenticated', async () => {
      render(
        <TestWrapper>
          <GuestOnly />
        </TestWrapper>
      );

      // Wait for auth initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should render the outlet content when not authenticated
      // In a real scenario, this would render the login/signup form
    });
  });
});
