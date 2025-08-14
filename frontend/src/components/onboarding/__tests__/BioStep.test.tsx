import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import BioStep from '../BioStep';
import { renderWithProviders, createMockOnboardingContext, createMockAuthContext } from './test-utils';

// Mock LoadingSpinner and ErrorMessage components
jest.mock('../../ui/LoadingSpinner', () => {
  return function MockLoadingSpinner({ size, color }: { size: string; color: string }) {
    return <div data-testid="loading-spinner" data-size={size} data-color={color}>Loading...</div>;
  };
});

jest.mock('../../ui/ErrorMessage', () => {
  return function MockErrorMessage({ 
    error, 
    onRetry, 
    className 
  }: { 
    error: string | Error; 
    onRetry: () => void; 
    className?: string; 
  }) {
    return (
      <div data-testid="error-message" className={className}>
        <p>{typeof error === 'string' ? error : error.message}</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  };
});

// Mock OnboardingCard and OnboardingStepHeader
jest.mock('../ui/OnboardingCard', () => {
  return function MockOnboardingCard({ 
    children, 
    className 
  }: { 
    children: React.ReactNode; 
    className?: string; 
  }) {
    return <div data-testid="onboarding-card" className={className}>{children}</div>;
  };
});

jest.mock('../ui/OnboardingStepHeader', () => {
  return function MockOnboardingStepHeader({
    stepNumber,
    totalSteps,
    title,
    subtitle
  }: {
    stepNumber: number;
    totalSteps: number;
    title: string;
    subtitle: string;
  }) {
    return (
      <div data-testid="step-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <span>Step {stepNumber} of {totalSteps}</span>
      </div>
    );
  };
});

describe('BioStep', () => {
  const mockUpdateUserProfile = jest.fn();
  const mockGoToNextStep = jest.fn();
  const mockSkipCurrentStep = jest.fn();
  const mockSetStepData = jest.fn();
  const mockClearError = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default state', () => {
      const { container } = renderWithProviders(<BioStep />);

      expect(screen.getByText('Tell us about yourself')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 7')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/I'm passionate about/)).toBeInTheDocument();
      expect(screen.getByText('Continue')).toBeInTheDocument();
      expect(screen.getByText('Skip this step')).toBeInTheDocument();
      expect(container).toMatchSnapshot();
    });

    it('should render with existing bio from user', () => {
      const authContext = createMockAuthContext({
        user: {
          id: 'test-user',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          bio: 'I love hiking and coffee!',
        },
      });

      renderWithProviders(<BioStep />, { authContextValue: authContext });

      const textarea = screen.getByDisplayValue('I love hiking and coffee!');
      expect(textarea).toBeInTheDocument();
    });

    it('should render with bio from current step data', () => {
      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          bio: 'Step data bio content',
        },
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      expect(screen.getByDisplayValue('Step data bio content')).toBeInTheDocument();
    });

    it('should prioritize currentStepData over user bio', () => {
      const authContext = createMockAuthContext({
        user: {
          id: 'test-user',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          bio: 'User bio',
        },
      });

      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          bio: 'Current step bio',
        },
      });

      renderWithProviders(<BioStep />, {
        authContextValue: authContext,
        onboardingContextValue: onboardingContext,
      });

      expect(screen.getByDisplayValue('Current step bio')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('User bio')).not.toBeInTheDocument();
    });
  });

  describe('Bio Input Functionality', () => {
    it('should update character count as user types', async () => {
      renderWithProviders(<BioStep />);

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      await user.type(textarea, 'Hello world');

      expect(screen.getByText('289 left')).toBeInTheDocument(); // 300 - 11
    });

    it('should show warning when characters remaining are low', async () => {
      renderWithProviders(<BioStep />);

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      const longText = 'a'.repeat(285); // Leaves 15 characters
      await user.type(textarea, longText);

      const remainingCount = screen.getByText('15 left');
      expect(remainingCount).toHaveClass('text-red-600', 'bg-red-50');
    });

    it('should respect maximum character limit', async () => {
      renderWithProviders(<BioStep />);

      const textarea = screen.getByPlaceholderText(/I'm passionate about/) as HTMLTextAreaElement;
      expect(textarea.maxLength).toBe(300);
    });

    it('should call setStepData when bio changes', async () => {
      const onboardingContext = createMockOnboardingContext({
        setStepData: mockSetStepData,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      await user.type(textarea, 'New bio content');

      // setStepData should be called for each character typed
      await waitFor(() => {
        expect(mockSetStepData).toHaveBeenLastCalledWith({ bio: 'New bio content' });
      });
    });

    it('should disable textarea when loading', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      expect(textarea).toBeDisabled();
    });
  });

  describe('Suggestion Functionality', () => {
    it('should render bio suggestions', () => {
      renderWithProviders(<BioStep />);

      expect(screen.getByText('Need inspiration? Try one of these:')).toBeInTheDocument();
      expect(screen.getByText(/Coffee lover ☕/)).toBeInTheDocument();
      expect(screen.getByText(/Tech enthusiast who enjoys hiking/)).toBeInTheDocument();
    });

    it('should populate textarea when suggestion is clicked', async () => {
      renderWithProviders(<BioStep />);

      const suggestion = screen.getByText(/Coffee lover ☕/);
      await user.click(suggestion);

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      expect(textarea).toHaveValue(expect.stringContaining('Coffee lover ☕'));
    });

    it('should disable suggestions when loading', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const suggestion = screen.getByText(/Coffee lover ☕/);
      expect(suggestion).toBeDisabled();
    });
  });

  describe('Continue Functionality', () => {
    it('should call updateUserProfile and goToNextStep when continue is clicked', async () => {
      const onboardingContext = createMockOnboardingContext({
        updateUserProfile: mockUpdateUserProfile,
        goToNextStep: mockGoToNextStep,
        clearError: mockClearError,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      await user.type(textarea, 'My awesome bio');

      const continueButton = screen.getByText('Continue');
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockClearError).toHaveBeenCalled();
        expect(mockUpdateUserProfile).toHaveBeenCalledWith({
          bio: 'My awesome bio',
        });
        expect(mockGoToNextStep).toHaveBeenCalled();
      });
    });

    it('should not call updateUserProfile if bio is empty', async () => {
      const onboardingContext = createMockOnboardingContext({
        updateUserProfile: mockUpdateUserProfile,
        goToNextStep: mockGoToNextStep,
        clearError: mockClearError,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const continueButton = screen.getByText('Continue');
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockClearError).toHaveBeenCalled();
        expect(mockUpdateUserProfile).not.toHaveBeenCalled();
        expect(mockGoToNextStep).toHaveBeenCalled();
      });
    });

    it('should show loading state during submission', async () => {
      const onboardingContext = createMockOnboardingContext({
        updateUserProfile: mockUpdateUserProfile.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
        goToNextStep: mockGoToNextStep,
        clearError: mockClearError,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const continueButton = screen.getByText('Continue');
      await user.click(continueButton);

      // Check loading state
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(continueButton).toBeDisabled();
    });

    it('should disable form elements during submission', async () => {
      const onboardingContext = createMockOnboardingContext({
        updateUserProfile: mockUpdateUserProfile.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
        goToNextStep: mockGoToNextStep,
        clearError: mockClearError,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const continueButton = screen.getByText('Continue');
      await user.click(continueButton);

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      const skipButton = screen.getByText('Skip this step');

      expect(textarea).toBeDisabled();
      expect(skipButton).toBeDisabled();
    });
  });

  describe('Skip Functionality', () => {
    it('should call skipCurrentStep when skip button is clicked', async () => {
      const onboardingContext = createMockOnboardingContext({
        skipCurrentStep: mockSkipCurrentStep,
        clearError: mockClearError,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const skipButton = screen.getByText('Skip this step');
      await user.click(skipButton);

      await waitFor(() => {
        expect(mockClearError).toHaveBeenCalled();
        expect(mockSkipCurrentStep).toHaveBeenCalled();
      });
    });

    it('should disable skip button during loading', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const skipButton = screen.getByText('Skip this step');
      expect(skipButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error exists', () => {
      const onboardingContext = createMockOnboardingContext({
        error: 'Failed to save bio',
        clearError: mockClearError,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Failed to save bio')).toBeInTheDocument();
    });

    it('should handle errors during continue process', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Update failed');

      const onboardingContext = createMockOnboardingContext({
        updateUserProfile: mockUpdateUserProfile.mockRejectedValue(mockError),
        clearError: mockClearError,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      await user.type(textarea, 'Test bio');

      const continueButton = screen.getByText('Continue');
      await user.click(continueButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to update bio:', mockError);
      });

      consoleError.mockRestore();
    });

    it('should handle errors during skip process', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Skip failed');

      const onboardingContext = createMockOnboardingContext({
        skipCurrentStep: mockSkipCurrentStep.mockRejectedValue(mockError),
        clearError: mockClearError,
      });

      renderWithProviders(<BioStep />, { onboardingContextValue: onboardingContext });

      const skipButton = screen.getByText('Skip this step');
      await user.click(skipButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to skip bio step:', mockError);
      });

      consoleError.mockRestore();
    });
  });

  describe('Snapshots', () => {
    it('should match snapshot with empty bio', () => {
      const { container } = renderWithProviders(<BioStep />);
      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with existing bio', () => {
      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          bio: 'Existing bio content for snapshot test',
        },
      });

      const { container } = renderWithProviders(<BioStep />, {
        onboardingContextValue: onboardingContext,
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with error state', () => {
      const onboardingContext = createMockOnboardingContext({
        error: 'Test error message',
      });

      const { container } = renderWithProviders(<BioStep />, {
        onboardingContextValue: onboardingContext,
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with loading state', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
      });

      const { container } = renderWithProviders(<BioStep />, {
        onboardingContextValue: onboardingContext,
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with low character count warning', async () => {
      const { container } = renderWithProviders(<BioStep />);

      const textarea = screen.getByPlaceholderText(/I'm passionate about/);
      const longText = 'a'.repeat(285);
      
      // Use fireEvent for this since we need the snapshot immediately after
      fireEvent.change(textarea, { target: { value: longText } });

      expect(container).toMatchSnapshot();
    });
  });
});
