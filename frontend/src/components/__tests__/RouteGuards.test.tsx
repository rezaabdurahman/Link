import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import RequireAuth from '../RequireAuth';
import GuestOnly from '../GuestOnly';

jest.mock('../../services/authClient', () => ({
  // Mock any functions that are used in your components
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  me: jest.fn(),
}));

jest.mock('../../utils/secureTokenStorage', () => ({
  default: {
    getToken: jest.fn().mockResolvedValue(null),
    setToken: jest.fn(),
    clearAll: jest.fn(),
  },
}));

const TestApp = () => {
  const { isLoading } = useAuth();
  if (isLoading) {
    return <div role="status" aria-label="Loading authentication status">Loading...</div>;
  }
  return <Outlet />;
};

const renderWithRouter = (initialEntries: string[]) => {
  const routes = [
    {
      path: '/',
      element: (
        <AuthProvider>
          <TestApp />
        </AuthProvider>
      ),
      children: [
        {
          path: 'protected',
          element: <RequireAuth />, // Use the actual component
          children: [
            {
              index: true,
              element: <div data-testid="protected-content">Protected Content</div>,
            },
          ],
        },
        {
          path: 'guest',
          element: <GuestOnly />, // Use the actual component
          children: [
            {
              index: true,
              element: <div data-testid="guest-content">Guest Content</div>,
            },
          ],
        },
        {
          path: 'login',
          element: <div data-testid="login-page">Login Page</div>,
        },
      ],
    },
  ];

  const router = createMemoryRouter(routes, { initialEntries });
  render(<RouterProvider router={router} />);
};

describe('RouteGuards', () => {
  it('should show loading spinner while auth is initializing', async () => {
    renderWithRouter(['/protected']);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('should redirect to login for protected routes if not authenticated', async () => {
    renderWithRouter(['/protected']);
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('should allow access to guest-only routes if not authenticated', async () => {
    renderWithRouter(['/guest']);
    await waitFor(() => {
      expect(screen.getByTestId('guest-content')).toBeInTheDocument();
    });
  });
});
