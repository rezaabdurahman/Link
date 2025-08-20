import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SignupPage from './SignupPage';
import { useAuth } from '../contexts/AuthContext';

// Mock the useAuth hook to isolate the component from the AuthContext
jest.mock('../contexts/AuthContext');

const mockedUseAuth = useAuth as jest.Mock;

describe('SignupPage', () => {
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  beforeEach(() => {
    // Reset mocks before each test to ensure a clean state
    jest.clearAllMocks();
  });

  it('should call register with correctly transformed data on successful submission', async () => {
    const user = userEvent.setup();
    const mockRegister = jest.fn().mockResolvedValue(undefined);

    mockedUseAuth.mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: null,
      clearError: jest.fn(),
      user: null,
    });

    render(<SignupPage />, { wrapper: TestWrapper });

    // Fill out the form with valid data
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/username/i), 'johndoe');
    await user.type(screen.getByLabelText(/email address/i), 'john.doe@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');

    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Ensure the button is enabled before clicking
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await user.click(submitButton);

    // Verify that the register function was called with the transformed data
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
      expect(mockRegister).toHaveBeenCalledWith({
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
    });
  });
});
