// RouteGuards.test.tsx - Tests for authentication route guards
// Verifies RequireAuth and GuestOnly components redirect appropriately based on auth state

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import RequireAuth from '../RequireAuth';
import GuestOnly from '../GuestOnly';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the auth service to avoid actual API calls
jest.mock('../../services/authClient', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  me: jest.fn(),
  AuthServiceError: jest.fn(),
  getErrorMessage: jest.fn(),
  apiClient: {
    setAuthToken: jest.fn(),
  },
}));

// Mock secure token storage with delayed responses
jest.mock('../../utils/secureTokenStorage', () => ({
  default: {
    getToken: jest.fn().mockResolvedValue(null),
    setToken: jest.fn(),
    clearAll: jest.fn(),
  },
}));

// Mock config module to ensure predictable auth requirements
jest.mock('../../config', () => ({
  isAuthRequired: jest.fn().mockReturnValue(true),
}));

// Helper to wait for auth initialization
const waitForAuthInitialization = () => new Promise(resolve => setTimeout(resolve, 150));

// Test wrapper that renders components within proper router context
const renderWithRouter = (component: React.ReactElement, initialRoute = '/') => {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <AuthProvider>
            {component}
          </AuthProvider>
        ),
      },
      {
        path: '/login',
        element: <div data-testid="login-page">Login Page</div>,
      },
    ],
    {
      initialEntries: [initialRoute],
      future: {
        // v7_startTransition: true, // Disabled for compatibility
        v7_relativeSplatPath: true,
      },
    }
  );
  
  return render(<RouterProvider router={router} />);
};


describe('Route Guards', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('RequireAuth', () => {
    it('shows loading spinner while auth is loading', () => {
      // Render synchronously without waiting
      renderWithRouter(<RequireAuth />);

      // Check if loading spinner is present immediately before any async operations complete
      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toBeInTheDocument();
      expect(loadingElement).toHaveAttribute('aria-label', 'Loading authentication status');
    });

    it('redirects to login when user is not authenticated', async () => {
      await act(async () => {
        renderWithRouter(<RequireAuth />);
      });

      // Wait for auth initialization to complete
      await act(async () => {
        await waitForAuthInitialization();
      });

      // After auth resolves to unauthenticated, should redirect to login
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });
  });

  describe('GuestOnly', () => {
    it('shows loading spinner while auth is loading', () => {
      renderWithRouter(<GuestOnly />);

      // Check if loading spinner is present initially
      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toBeInTheDocument();
      expect(loadingElement).toHaveAttribute('aria-label', 'Loading authentication status');
    });

    it('allows access to guest-only content when user is not authenticated', async () => {
      const TestContent = () => <div data-testid="guest-content">Guest Only Content</div>;
      
      const router = createMemoryRouter(
        [
          {
            path: '/',
            element: (
              <AuthProvider>
                <GuestOnly />
              </AuthProvider>
            ),
            children: [
              {
                index: true,
                element: <TestContent />,
              },
            ],
          },
        ],
        {
          future: {
            // v7_startTransition: true, // Disabled for compatibility
            v7_relativeSplatPath: true,
          },
        }
      );

      await act(async () => {
        render(<RouterProvider router={router} />);
      });

      // Wait for auth initialization to complete
      await act(async () => {
        await waitForAuthInitialization();
      });

      // Should show guest content when not authenticated
      await waitFor(() => {
        expect(screen.getByTestId('guest-content')).toBeInTheDocument();
      });
    });
  });
});
