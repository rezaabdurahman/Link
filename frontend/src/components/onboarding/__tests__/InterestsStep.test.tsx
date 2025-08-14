import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import InterestsStep from '../InterestsStep';
import { renderWithProviders, createMockOnboardingContext } from './test-utils';

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

describe('InterestsStep', () => {
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
      const { container } = renderWithProviders(<InterestsStep />);

      expect(screen.getByText('What Are You Into?')).toBeInTheDocument();
      expect(screen.getByText('Step 3 of 7')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search interests...')).toBeInTheDocument();
      expect(screen.getByText('Continue')).toBeInTheDocument();
      expect(screen.getByText('Skip this step')).toBeInTheDocument();
      expect(container).toMatchSnapshot();
    });

    it('should render with existing interests from step data', () => {
      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          interests: ['Technology', 'Travel', 'Cooking'],
        },
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      expect(screen.getByText('3 interests selected')).toBeInTheDocument();
      expect(screen.getByText('Technology ✓')).toBeInTheDocument();
      expect(screen.getByText('Travel ✓')).toBeInTheDocument();
      expect(screen.getByText('Cooking ✓')).toBeInTheDocument();
    });
  });

  describe('Interest Categories', () => {
    it('should render all interest categories', () => {
      renderWithProviders(<InterestsStep />);

      expect(screen.getByText('Food & Drink')).toBeInTheDocument();
      expect(screen.getByText('Sports & Fitness')).toBeInTheDocument();
      expect(screen.getByText('Arts & Culture')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('Travel & Adventure')).toBeInTheDocument();
      expect(screen.getByText('Social & Lifestyle')).toBeInTheDocument();
      expect(screen.getByText('Hobbies')).toBeInTheDocument();
    });

    it('should render interest options within categories', () => {
      renderWithProviders(<InterestsStep />);

      // Check some specific interests from different categories
      expect(screen.getByText('Coffee')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Photography')).toBeInTheDocument();
      expect(screen.getByText('Programming')).toBeInTheDocument();
    });

    it('should allow selecting interests', async () => {
      const onboardingContext = createMockOnboardingContext({
        setStepData: mockSetStepData,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      const coffeeButton = screen.getByText('Coffee');
      await user.click(coffeeButton);

      await waitFor(() => {
        expect(mockSetStepData).toHaveBeenLastCalledWith({ interests: ['Coffee'] });
      });

      expect(screen.getByText('Coffee ✓')).toBeInTheDocument();
      expect(screen.getByText('1 interest selected')).toBeInTheDocument();
    });

    it('should allow deselecting interests', async () => {
      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          interests: ['Coffee', 'Running'],
        },
        setStepData: mockSetStepData,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      const coffeeButton = screen.getByText('Coffee ✓');
      await user.click(coffeeButton);

      await waitFor(() => {
        expect(mockSetStepData).toHaveBeenLastCalledWith({ interests: ['Running'] });
      });

      expect(screen.getByText('1 interest selected')).toBeInTheDocument();
    });

    it('should disable interest buttons when loading', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      const coffeeButton = screen.getByText('Coffee');
      expect(coffeeButton).toBeDisabled();
    });
  });

  describe('Search Functionality', () => {
    it('should filter interests based on search query', async () => {
      renderWithProviders(<InterestsStep />);

      const searchInput = screen.getByPlaceholderText('Search interests...');
      await user.type(searchInput, 'coffee');

      expect(screen.getByText('Search Results:')).toBeInTheDocument();
      expect(screen.getByText('Coffee')).toBeInTheDocument();
      
      // Categories should be hidden during search
      expect(screen.queryByText('Food & Drink')).not.toBeInTheDocument();
    });

    it('should clear search results when search is cleared', async () => {
      renderWithProviders(<InterestsStep />);

      const searchInput = screen.getByPlaceholderText('Search interests...');
      await user.type(searchInput, 'coffee');
      
      expect(screen.getByText('Search Results:')).toBeInTheDocument();
      
      await user.clear(searchInput);
      
      expect(screen.queryByText('Search Results:')).not.toBeInTheDocument();
      expect(screen.getByText('Food & Drink')).toBeInTheDocument();
    });

    it('should allow selecting interests from search results', async () => {
      const onboardingContext = createMockOnboardingContext({
        setStepData: mockSetStepData,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      const searchInput = screen.getByPlaceholderText('Search interests...');
      await user.type(searchInput, 'coffee');

      const coffeeButton = screen.getByText('Coffee');
      await user.click(coffeeButton);

      await waitFor(() => {
        expect(mockSetStepData).toHaveBeenLastCalledWith({ interests: ['Coffee'] });
      });

      expect(screen.getByText('Coffee ✓')).toBeInTheDocument();
    });

    it('should show case-insensitive search results', async () => {
      renderWithProviders(<InterestsStep />);

      const searchInput = screen.getByPlaceholderText('Search interests...');
      await user.type(searchInput, 'COFFEE');

      expect(screen.getByText('Search Results:')).toBeInTheDocument();
      expect(screen.getByText('Coffee')).toBeInTheDocument();
    });
  });

  describe('Selected Interests Summary', () => {
    it('should display selected interests summary when interests are selected', () => {
      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          interests: ['Technology', 'Photography', 'Coffee'],
        },
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      expect(screen.getByText('Your Selected Interests:')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('Photography')).toBeInTheDocument();
      expect(screen.getByText('Coffee')).toBeInTheDocument();
    });

    it('should allow removing interests from summary', async () => {
      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          interests: ['Technology', 'Photography'],
        },
        setStepData: mockSetStepData,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      // Find the remove button for Technology (×)
      const summarySection = screen.getByText('Your Selected Interests:').closest('[data-testid="onboarding-card"]');
      const technologySpan = within(summarySection as HTMLElement).getByText('Technology').closest('span');
      const removeButton = within(technologySpan as HTMLElement).getByText('×');
      
      await user.click(removeButton);

      await waitFor(() => {
        expect(mockSetStepData).toHaveBeenLastCalledWith({ interests: ['Photography'] });
      });
    });

    it('should not display summary when no interests are selected', () => {
      renderWithProviders(<InterestsStep />);

      expect(screen.queryByText('Your Selected Interests:')).not.toBeInTheDocument();
    });
  });

  describe('Continue Functionality', () => {
    it('should call updateUserProfile and goToNextStep when continue is clicked with interests', async () => {
      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          interests: ['Technology', 'Coffee'],
        },
        updateUserProfile: mockUpdateUserProfile,
        goToNextStep: mockGoToNextStep,
        clearError: mockClearError,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      const continueButton = screen.getByText('Continue');
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockClearError).toHaveBeenCalled();
        expect(mockUpdateUserProfile).toHaveBeenCalledWith({
          interests: ['Technology', 'Coffee'],
        });
        expect(mockGoToNextStep).toHaveBeenCalled();
      });
    });

    it('should not call updateUserProfile if no interests are selected', async () => {
      const onboardingContext = createMockOnboardingContext({
        updateUserProfile: mockUpdateUserProfile,
        goToNextStep: mockGoToNextStep,
        clearError: mockClearError,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

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
        currentStepData: {
          interests: ['Technology'],
        },
        updateUserProfile: mockUpdateUserProfile.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
        goToNextStep: mockGoToNextStep,
        clearError: mockClearError,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      const continueButton = screen.getByText('Continue');
      await user.click(continueButton);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(continueButton).toBeDisabled();
    });
  });

  describe('Skip Functionality', () => {
    it('should call skipCurrentStep when skip button is clicked', async () => {
      const onboardingContext = createMockOnboardingContext({
        skipCurrentStep: mockSkipCurrentStep,
        clearError: mockClearError,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

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

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      const skipButton = screen.getByText('Skip this step');
      expect(skipButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error exists', () => {
      const onboardingContext = createMockOnboardingContext({
        error: 'Failed to save interests',
        clearError: mockClearError,
      });

      renderWithProviders(<InterestsStep />, { onboardingContextValue: onboardingContext });

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Failed to save interests')).toBeInTheDocument();
    });
  });

  describe('Snapshots', () => {
    it('should match snapshot with no interests selected', () => {
      const { container } = renderWithProviders(<InterestsStep />);
      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with interests selected', () => {
      const onboardingContext = createMockOnboardingContext({
        currentStepData: {
          interests: ['Technology', 'Photography', 'Coffee', 'Running'],
        },
      });

      const { container } = renderWithProviders(<InterestsStep />, {
        onboardingContextValue: onboardingContext,
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with search active', async () => {
      const { container } = renderWithProviders(<InterestsStep />);

      const searchInput = screen.getByPlaceholderText('Search interests...');
      fireEvent.change(searchInput, { target: { value: 'tech' } });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with error state', () => {
      const onboardingContext = createMockOnboardingContext({
        error: 'Test error message',
      });

      const { container } = renderWithProviders(<InterestsStep />, {
        onboardingContextValue: onboardingContext,
      });

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with loading state', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
        currentStepData: {
          interests: ['Technology'],
        },
      });

      const { container } = renderWithProviders(<InterestsStep />, {
        onboardingContextValue: onboardingContext,
      });

      expect(container).toMatchSnapshot();
    });
  });
});

// Helper function to work with nested elements
const within = (element: HTMLElement) => {
  return {
    getByText: (text: string | RegExp) => {
      const elements = Array.from(element.querySelectorAll('*'));
      const found = elements.find(el => {
        const textContent = el.textContent || '';
        return typeof text === 'string' ? textContent.includes(text) : text.test(textContent);
      });
      if (!found) throw new Error(`Unable to find element with text: ${text}`);
      return found as HTMLElement;
    }
  };
};
