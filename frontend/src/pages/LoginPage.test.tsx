import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

// Mock the auth service to avoid import.meta issues
jest.mock('../services/authClient', () => ({
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

// Create a mock AuthContext
const mockAuthContext = {
  user: null,
  token: null,
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

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: '/login',
  search: '',
  hash: '',
  state: null as any,
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Test wrapper with router
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock auth context
    mockAuthContext.user = null;
    mockAuthContext.isLoading = false;
    mockAuthContext.error = null;
    mockAuthContext.login.mockClear();
    mockAuthContext.clearError.mockClear();
  });

  describe('Rendering', () => {
    it('should render login form with all required fields', () => {
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByText('Sign in to continue connecting')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
      expect(screen.getByText('Create one')).toBeInTheDocument();
    });

    it('should render submit button as disabled initially', () => {
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveClass('bg-gray-200', 'cursor-not-allowed');
    });
  });

  describe('Form Validation', () => {
    it('should show email validation error for invalid email', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger blur for validation

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show password validation error for short password', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, '123');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      });
    });

    it('should show required field errors when fields are empty', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');

      // Focus and blur without typing to trigger required validation
      await user.click(emailInput);
      await user.click(passwordInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });

    it('should enable submit button when form is valid and filled', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      await waitFor(() => {
        expect(submitButton).toBeEnabled();
        expect(submitButton).toHaveClass('bg-aqua');
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility when eye icon is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

      // Initially password should be hidden
      expect(passwordInput.type).toBe('password');

      // Click toggle to show password
      await user.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      // Click again to hide password
      await user.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('Form Submission', () => {
    it('should call login function with correct credentials on form submission', async () => {
      const user = userEvent.setup();
      const mockLogin = jest.fn().mockResolvedValue(undefined);
      
      // Mock the useAuth hook to return our mock login function
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          login: mockLogin,
          isLoading: false,
          error: null,
          clearError: jest.fn(),
          user: null,
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should show loading state during login', async () => {
      const user = userEvent.setup();
      
      // Mock loading state
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          login: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
          isLoading: true,
          error: null,
          clearError: jest.fn(),
          user: null,
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      // Check loading state
      const submitButton = screen.getByRole('button', { name: /signing in/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });

    it('should display error toast on login failure', async () => {
      const user = userEvent.setup();
      const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
      
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          login: mockLogin,
          isLoading: false,
          error: 'Invalid credentials',
          clearError: jest.fn(),
          user: null,
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeInTheDocument();
        expect(screen.getByTestId('toast')).toHaveAttribute('data-type', 'error');
      });
    });
  });

  describe('Navigation', () => {
    it('should redirect to home if user is already authenticated', () => {
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          login: jest.fn(),
          isLoading: false,
          error: null,
          clearError: jest.fn(),
          user: { id: '123', name: 'Test User', email: 'test@example.com' },
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });

    it('should redirect to intended route after successful login', () => {
      const mockLocationWithFrom = {
        ...mockLocation,
        state: { from: '/protected' },
      };
      mockUseLocation.mockReturnValue(mockLocationWithFrom);

      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          login: jest.fn().mockResolvedValue(undefined),
          isLoading: false,
          error: null,
          clearError: jest.fn(),
          user: { id: '123', name: 'Test User', email: 'test@example.com' },
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/protected', { replace: true });
    });

    it('should navigate to registration page when create account link is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const createAccountLink = screen.getByText('Create one');
      await user.click(createAccountLink);

      // Note: Since we're using Link component, navigation would happen automatically
      // In a real test, we'd check that the Link has the correct 'to' prop
      expect(createAccountLink.closest('a')).toHaveAttribute('href', '/register');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and accessibility attributes', () => {
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });

    it('should announce form validation errors to screen readers', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'invalid');
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByText('Please enter a valid email address');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });
  });
});
