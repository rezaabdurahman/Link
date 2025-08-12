import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import SignupPage from './SignupPage';

// Mock modules
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

// Mock the auth service
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
    getToken: jest.fn(),
    clearAll: jest.fn(),
  },
}));

// Mock Toast component
jest.mock('../components/Toast', () => {
  return function MockToast({ message, type, isVisible, onClose }: any) {
    return isVisible ? (
      <div data-testid="toast" data-type={type} onClick={onClose}>
        {message}
      </div>
    ) : null;
  };
});

// Test wrapper with router and auth context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

describe('SignupPage', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  describe('Rendering', () => {
    it('should render signup form with all required fields', () => {
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      expect(screen.getByText('Join Link')).toBeInTheDocument();
      expect(screen.getByText('Create your account and start connecting')).toBeInTheDocument();
      expect(screen.getByLabelText('First Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });

    it('should render submit button as disabled initially', () => {
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /create account/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveClass('bg-gray-200', 'cursor-not-allowed');
    });
  });

  describe('Form Validation', () => {
    it('should show first name validation errors', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText('First Name');
      
      // Test required error
      await user.click(firstNameInput);
      await user.tab();
      await waitFor(() => {
        expect(screen.getByText('First name is required')).toBeInTheDocument();
      });

      // Test minimum length error
      await user.type(firstNameInput, 'A');
      await user.tab();
      await waitFor(() => {
        expect(screen.getByText('First name must be at least 2 characters')).toBeInTheDocument();
      });
    });

    it('should show username validation errors', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText('Username');
      
      // Test invalid characters
      await user.type(usernameInput, 'user@name!');
      await user.tab();
      await waitFor(() => {
        expect(screen.getByText('Username can only contain letters, numbers, and underscores')).toBeInTheDocument();
      });

      // Clear and test minimum length
      await user.clear(usernameInput);
      await user.type(usernameInput, 'ab');
      await user.tab();
      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('should show email validation error for invalid email', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show password validation errors for weak password', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password');
      
      // Test minimum length
      await user.type(passwordInput, '123');
      await user.tab();
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });

      // Test complexity requirement
      await user.clear(passwordInput);
      await user.type(passwordInput, 'weakpassword');
      await user.tab();
      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one uppercase letter, one lowercase letter, and one number')).toBeInTheDocument();
      });
    });

    it('should show password confirmation mismatch error', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password456');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
      });
    });

    it('should enable submit button when all fields are valid and filled', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText('First Name');
      const lastNameInput = screen.getByLabelText('Last Name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');

      await waitFor(() => {
        expect(submitButton).toBeEnabled();
        expect(submitButton).toHaveClass('bg-aqua');
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility for both password fields', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      const confirmPasswordInput = screen.getByLabelText('Confirm Password') as HTMLInputElement;
      
      // Get toggle buttons by their parent containers
      const passwordToggleButtons = screen.getAllByRole('button', { name: /toggle password visibility/i });
      const passwordToggle = passwordToggleButtons[0]; // First password field toggle
      const confirmPasswordToggle = passwordToggleButtons[1]; // Confirm password field toggle

      // Initially both passwords should be hidden
      expect(passwordInput.type).toBe('password');
      expect(confirmPasswordInput.type).toBe('password');

      // Click toggle to show password
      await user.click(passwordToggle);
      expect(passwordInput.type).toBe('text');

      // Click toggle to show confirm password
      await user.click(confirmPasswordToggle);
      expect(confirmPasswordInput.type).toBe('text');

      // Click again to hide passwords
      await user.click(passwordToggle);
      expect(passwordInput.type).toBe('password');
      
      await user.click(confirmPasswordToggle);
      expect(confirmPasswordInput.type).toBe('password');
    });
  });

  describe('Form Submission', () => {
    it('should call register function with correct data on form submission', async () => {
      const user = userEvent.setup();
      const mockRegister = jest.fn().mockResolvedValue(undefined);
      
      // Mock the useAuth hook to return our mock register function
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          register: mockRegister,
          isLoading: false,
          error: null,
          clearError: jest.fn(),
          user: null,
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText('First Name');
      const lastNameInput = screen.getByLabelText('Last Name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password123',
          confirmPassword: 'Password123',
        });
      });
    });

    it('should show loading state during registration', async () => {
      const user = userEvent.setup();
      
      // Mock loading state
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          register: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
          isLoading: true,
          error: null,
          clearError: jest.fn(),
          user: null,
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText('First Name');
      const lastNameInput = screen.getByLabelText('Last Name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');

      // Check loading state
      const submitButton = screen.getByRole('button', { name: /creating account/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Creating account...')).toBeInTheDocument();
    });

    it('should display error toast on registration failure', async () => {
      const user = userEvent.setup();
      const mockRegister = jest.fn().mockRejectedValue(new Error('Email already exists'));
      
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          register: mockRegister,
          isLoading: false,
          error: 'Email already exists',
          clearError: jest.fn(),
          user: null,
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText('First Name');
      const lastNameInput = screen.getByLabelText('Last Name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'existing@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeInTheDocument();
        expect(screen.getByTestId('toast')).toHaveAttribute('data-type', 'error');
      });
    });

    it('should show success toast and redirect on successful registration', async () => {
      const user = userEvent.setup();
      const mockRegister = jest.fn().mockResolvedValue(undefined);
      
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          register: mockRegister,
          isLoading: false,
          error: null,
          clearError: jest.fn(),
          user: { id: '123', name: 'John Doe', email: 'john@example.com' },
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText('First Name');
      const lastNameInput = screen.getByLabelText('Last Name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeInTheDocument();
        expect(screen.getByTestId('toast')).toHaveAttribute('data-type', 'success');
        expect(screen.getByText('Account created successfully! Welcome to Link!')).toBeInTheDocument();
      });

      // Should redirect to home after delay
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      }, { timeout: 2000 });
    });
  });

  describe('Navigation', () => {
    it('should redirect to home if user is already authenticated', () => {
      jest.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({
          register: jest.fn(),
          isLoading: false,
          error: null,
          clearError: jest.fn(),
          user: { id: '123', name: 'Test User', email: 'test@example.com' },
        }),
        AuthProvider: ({ children }: any) => children,
      }));

      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });

    it('should navigate to login page when sign in link is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const signInLink = screen.getByText('Sign in');
      await user.click(signInLink);

      // Note: Since we're using Link component, navigation would happen automatically
      // In a real test, we'd check that the Link has the correct 'to' prop
      expect(signInLink.closest('a')).toHaveAttribute('href', '/login');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and accessibility attributes', () => {
      render(
        <TestWrapper>
          <SignupPage />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText('First Name');
      const lastNameInput = screen.getByLabelText('Last Name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');

      expect(firstNameInput).toHaveAttribute('type', 'text');
      expect(firstNameInput).toHaveAttribute('autocomplete', 'given-name');
      expect(lastNameInput).toHaveAttribute('autocomplete', 'family-name');
      expect(usernameInput).toHaveAttribute('autocomplete', 'username');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
      expect(confirmPasswordInput).toHaveAttribute('autocomplete', 'new-password');
    });

    it('should announce form validation errors to screen readers', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SignupPage />
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
