import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import WelcomeTutorialStep from '../WelcomeTutorialStep';
import { renderWithProviders, createMockOnboardingContext, createMockAuthContext } from './test-utils';

// Mock components
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

describe('WelcomeTutorialStep', () => {
  const mockCompleteOnboardingFlow = jest.fn();
  const mockSkipCurrentStep = jest.fn();
  const mockClearError = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default state', () => {
      const { container } = renderWithProviders(<WelcomeTutorialStep />);

      expect(screen.getByText('Welcome to Link, John! 🎉')).toBeInTheDocument();
      expect(screen.getByText('Step 7 of 7')).toBeInTheDocument();
      expect(screen.getByText('You\'re all set up and ready to start connecting with amazing people!')).toBeInTheDocument();
      expect(screen.getByText('Start Exploring Link!')).toBeInTheDocument();
      expect(screen.getByText('Skip tutorial and continue')).toBeInTheDocument();
      expect(container).toMatchSnapshot();
    });

    it('should render with custom user name', () => {
      const authContext = createMockAuthContext({
        user: {
          id: 'test-user',
          first_name: 'Alice',
          last_name: 'Smith',
          email: 'alice@example.com',
        },
      });

      renderWithProviders(<WelcomeTutorialStep />, { authContextValue: authContext });

      expect(screen.getByText('Welcome to Link, Alice! 🎉')).toBeInTheDocument();
    });

    it('should handle user without name gracefully', () => {
      const authContext = createMockAuthContext({
        user: {
          id: 'test-user',
          first_name: '',
          last_name: 'Smith',
          email: 'user@example.com',
        },
      });

      renderWithProviders(<WelcomeTutorialStep />, { authContextValue: authContext });

      expect(screen.getByText('Welcome to Link, ! 🎉')).toBeInTheDocument();
    });

    it('should handle null user gracefully', () => {
      const authContext = createMockAuthContext({
        user: null,
      });

      renderWithProviders(<WelcomeTutorialStep />, { authContextValue: authContext });

      expect(screen.getByText('Welcome to Link, ! 🎉')).toBeInTheDocument();
    });
  });

  describe('Features Section', () => {
    it('should display all feature items', () => {
      renderWithProviders(<WelcomeTutorialStep />);

      expect(screen.getByText('Here\'s what you can do now:')).toBeInTheDocument();
      expect(screen.getByText('Discover people nearby who share your interests')).toBeInTheDocument();
      expect(screen.getByText('Start conversations and make meaningful connections')).toBeInTheDocument();
      expect(screen.getByText('Join local events and activities')).toBeInTheDocument();
      expect(screen.getByText('Customize your profile anytime in settings')).toBeInTheDocument();
    });

    it('should have checkmark icons for features', () => {
      renderWithProviders(<WelcomeTutorialStep />);

      // Look for the feature card container
      const featuresCard = screen.getByText('Here\'s what you can do now:').closest('[data-testid="onboarding-card"]');
      expect(featuresCard).toBeInTheDocument();
      expect(featuresCard).toHaveClass('bg-gradient-to-r', 'from-aqua/10', 'to-aqua/20');
    });
  });

  describe('Pro Tips Section', () => {
    it('should display pro tips', () => {
      renderWithProviders(<WelcomeTutorialStep />);

      expect(screen.getByText('💡 Pro Tips:')).toBeInTheDocument();
      expect(screen.getByText('• Keep your profile updated to get better matches')).toBeInTheDocument();
      expect(screen.getByText('• Be genuine and authentic in your conversations')).toBeInTheDocument();
      expect(screen.getByText('• Don\'t hesitate to reach out to people who share your interests')).toBeInTheDocument();
      expect(screen.getByText('• Check out the opportunities section for local events')).toBeInTheDocument();
    });

    it('should style pro tips card correctly', () => {
      renderWithProviders(<WelcomeTutorialStep />);

      const tipsCard = screen.getByText('💡 Pro Tips:').closest('[data-testid="onboarding-card"]');
      expect(tipsCard).toHaveClass('bg-accent-copper/10', 'border-2', 'border-accent-copper/20');
    });
  });

  describe('Complete Functionality', () => {
    it('should call completeOnboardingFlow when start exploring button is clicked', async () => {
      const onboardingContext = createMockOnboardingContext({
        completeOnboardingFlow: mockCompleteOnboardingFlow,
        clearError: mockClearError,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      const startButton = screen.getByText('Start Exploring Link!');
      await user.click(startButton);

      await waitFor(() => {
        expect(mockClearError).toHaveBeenCalled();
        expect(mockCompleteOnboardingFlow).toHaveBeenCalled();
      });
    });

    it('should show loading state during completion', async () => {
      const onboardingContext = createMockOnboardingContext({
        completeOnboardingFlow: mockCompleteOnboardingFlow.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
        clearError: mockClearError,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      const startButton = screen.getByText('Start Exploring Link!');
      await user.click(startButton);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Completing setup...')).toBeInTheDocument();
      expect(startButton).toBeDisabled();
    });

    it('should disable buttons during completion', async () => {
      const onboardingContext = createMockOnboardingContext({
        completeOnboardingFlow: mockCompleteOnboardingFlow.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
        clearError: mockClearError,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      const startButton = screen.getByText('Start Exploring Link!');
      await user.click(startButton);

      const skipButton = screen.getByText('Skip tutorial and continue');
      expect(startButton).toBeDisabled();
      expect(skipButton).toBeDisabled();
    });

    it('should disable buttons when already loading', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      const startButton = screen.getByText('Start Exploring Link!');
      const skipButton = screen.getByText('Skip tutorial and continue');
      
      expect(startButton).toBeDisabled();
      expect(skipButton).toBeDisabled();
    });

    it('should handle completion errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Completion failed');

      const onboardingContext = createMockOnboardingContext({
        completeOnboardingFlow: mockCompleteOnboardingFlow.mockRejectedValue(mockError),
        clearError: mockClearError,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      const startButton = screen.getByText('Start Exploring Link!');
      await user.click(startButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to complete onboarding:', mockError);
      });

      consoleError.mockRestore();
    });
  });

  describe('Skip Functionality', () => {
    it('should call skipCurrentStep when skip button is clicked', async () => {
      const onboardingContext = createMockOnboardingContext({
        skipCurrentStep: mockSkipCurrentStep,
        clearError: mockClearError,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      const skipButton = screen.getByText('Skip tutorial and continue');
      await user.click(skipButton);

      await waitFor(() => {
        expect(mockClearError).toHaveBeenCalled();
        expect(mockSkipCurrentStep).toHaveBeenCalled();
      });
    });

    it('should handle skip errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Skip failed');

      const onboardingContext = createMockOnboardingContext({
        skipCurrentStep: mockSkipCurrentStep.mockRejectedValue(mockError),
        clearError: mockClearError,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      const skipButton = screen.getByText('Skip tutorial and continue');
      await user.click(skipButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to skip welcome tutorial step:', mockError);
      });

      consoleError.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error exists', () => {
      const onboardingContext = createMockOnboardingContext({
        error: 'Failed to complete onboarding',
        clearError: mockClearError,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Failed to complete onboarding')).toBeInTheDocument();
    });

    it('should handle Error objects in error state', () => {
      const errorObject = new Error('Something went wrong');
      const onboardingContext = createMockOnboardingContext({
        error: errorObject.message,
        clearError: mockClearError,
      });

      renderWithProviders(<WelcomeTutorialStep />, { onboardingContextValue: onboardingContext });

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('CSS Classes and Structure', () => {
    it('should have correct gradient icon styling', () => {
      renderWithProviders(<WelcomeTutorialStep />);

      const iconContainer = screen.getByText('🎉').closest('div')?.previousElementSibling;
      expect(iconContainer).toHaveClass('w-20', 'h-20', 'bg-gradient-to-r', 'from-aqua', 'to-aqua-dark', 'rounded-full');
    });

    it('should style main button correctly', () => {
      renderWithProviders(<WelcomeTutorialStep />);

      const startButton = screen.getByText('Start Exploring Link!');
      expect(startButton).toHaveClass('ios-button');
      expect(startButton).toHaveClass('text-xl', 'font-bold');
      expect(startButton).toHaveClass('shadow-xl');
    });

    it('should style skip button correctly', () => {
      renderWithProviders(<WelcomeTutorialStep />);

      const skipButton = screen.getByText('Skip tutorial and continue');
      expect(skipButton).toHaveClass('text-sm', 'text-gray-500', 'hover:text-gray-700');
    });
  });

  describe('Snapshots', () => {
    it('should match snapshot with default user', () => {
      const { container } = renderWithProviders(<WelcomeTutorialStep />);
      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with custom user name', () => {
      const authContext = createMockAuthContext({
        user: {
          id: 'test-user',
          first_name: 'Sarah',
          last_name: 'Wilson',
          email: 'sarah@example.com',
        },
      });

      const { container } = renderWithProviders(<WelcomeTutorialStep />, {
        authContextValue: authContext,
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with error state', () => {
      const onboardingContext = createMockOnboardingContext({
        error: 'Test error message',
      });

      const { container } = renderWithProviders(<WelcomeTutorialStep />, {
        onboardingContextValue: onboardingContext,
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with loading state', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
      });

      const { container } = renderWithProviders(<WelcomeTutorialStep />, {
        onboardingContextValue: onboardingContext,
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot during completion', async () => {
      const onboardingContext = createMockOnboardingContext({
        completeOnboardingFlow: mockCompleteOnboardingFlow.mockImplementation(() => new Promise(() => {})), // Never resolves
        clearError: mockClearError,
      });

      const { container } = renderWithProviders(<WelcomeTutorialStep />, {
        onboardingContextValue: onboardingContext,
      });

      const startButton = screen.getByText('Start Exploring Link!');
      await user.click(startButton);

      // Wait for the loading state to be visible
      await waitFor(() => {
        expect(screen.getByText('Completing setup...')).toBeInTheDocument();
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with null user', () => {
      const authContext = createMockAuthContext({
        user: null,
      });

      const { container } = renderWithProviders(<WelcomeTutorialStep />, {
        authContextValue: authContext,
      });

      expect(container).toMatchSnapshot();
    });
  });
});
