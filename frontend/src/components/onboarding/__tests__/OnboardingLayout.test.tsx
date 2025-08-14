import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardingLayout from '../OnboardingLayout';
import { renderWithProviders, createMockOnboardingContext, createMockAuthContext } from './test-utils';

describe('OnboardingLayout', () => {
  const mockGoToPreviousStep = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      const { container } = renderWithProviders(
        <OnboardingLayout>
          <div>Test Content</div>
        </OnboardingLayout>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByText('Link')).toBeInTheDocument();
      expect(container).toMatchSnapshot();
    });

    it('should render with user greeting when user is logged in', () => {
      const authContext = createMockAuthContext({
        user: {
          id: 'test-user',
          first_name: 'Alice',
          last_name: 'Johnson',
          email: 'alice@example.com',
        },
      });

      renderWithProviders(
        <OnboardingLayout>
          <div>Test Content</div>
        </OnboardingLayout>,
        { authContextValue: authContext }
      );

      expect(screen.getByText('Welcome, Alice!')).toBeInTheDocument();
    });

    it('should not render user greeting when user is null', () => {
      const authContext = createMockAuthContext({ user: null });

      renderWithProviders(
        <OnboardingLayout>
          <div>Test Content</div>
        </OnboardingLayout>,
        { authContextValue: authContext }
      );

      expect(screen.queryByText(/Welcome,/)).not.toBeInTheDocument();
    });
  });

  describe('Back Button Functionality', () => {
    it('should show back button when canGoPrevious is true and showBackButton is true', () => {
      const onboardingContext = createMockOnboardingContext({
        canGoPrevious: true,
        goToPreviousStep: mockGoToPreviousStep,
      });

      renderWithProviders(
        <OnboardingLayout showBackButton={true}>
          <div>Test Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      expect(screen.getByLabelText('Go back')).toBeInTheDocument();
    });

    it('should not show back button when canGoPrevious is false', () => {
      const onboardingContext = createMockOnboardingContext({
        canGoPrevious: false,
      });

      renderWithProviders(
        <OnboardingLayout showBackButton={true}>
          <div>Test Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      expect(screen.queryByLabelText('Go back')).not.toBeInTheDocument();
    });

    it('should not show back button when showBackButton is false', () => {
      const onboardingContext = createMockOnboardingContext({
        canGoPrevious: true,
      });

      renderWithProviders(
        <OnboardingLayout showBackButton={false}>
          <div>Test Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      expect(screen.queryByLabelText('Go back')).not.toBeInTheDocument();
    });

    it('should call custom onBack callback when provided', async () => {
      const onboardingContext = createMockOnboardingContext({
        canGoPrevious: true,
        goToPreviousStep: mockGoToPreviousStep,
      });

      renderWithProviders(
        <OnboardingLayout showBackButton={true} onBack={mockOnBack}>
          <div>Test Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      const backButton = screen.getByLabelText('Go back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(mockOnBack).toHaveBeenCalledTimes(1);
        expect(mockGoToPreviousStep).not.toHaveBeenCalled();
      });
    });

    it('should call goToPreviousStep when no custom onBack is provided', async () => {
      const onboardingContext = createMockOnboardingContext({
        canGoPrevious: true,
        goToPreviousStep: mockGoToPreviousStep,
      });

      renderWithProviders(
        <OnboardingLayout showBackButton={true}>
          <div>Test Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      const backButton = screen.getByLabelText('Go back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(mockGoToPreviousStep).toHaveBeenCalledTimes(1);
      });
    });

    it('should disable back button when loading', () => {
      const onboardingContext = createMockOnboardingContext({
        canGoPrevious: true,
        isLoading: true,
        goToPreviousStep: mockGoToPreviousStep,
      });

      renderWithProviders(
        <OnboardingLayout showBackButton={true}>
          <div>Test Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      const backButton = screen.getByLabelText('Go back');
      expect(backButton).toBeDisabled();
    });

    it('should handle error in goToPreviousStep gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Navigation failed');
      const onboardingContext = createMockOnboardingContext({
        canGoPrevious: true,
        goToPreviousStep: jest.fn().mockRejectedValue(mockError),
      });

      renderWithProviders(
        <OnboardingLayout showBackButton={true}>
          <div>Test Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      const backButton = screen.getByLabelText('Go back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to go to previous step:', mockError);
      });

      consoleError.mockRestore();
    });
  });

  describe('CSS Classes and Structure', () => {
    it('should have correct CSS classes for iOS styling', () => {
      const { container } = renderWithProviders(
        <OnboardingLayout>
          <div>Test Content</div>
        </OnboardingLayout>
      );

      // Check main container classes
      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass('min-h-screen', 'bg-surface-dark');

      // Check header classes  
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('ios-card', 'border-b', 'border-gray-200/50');

      // Check footer classes
      const footer = container.querySelector('footer');
      expect(footer).toHaveClass('bg-surface-card', 'border-t', 'border-gray-200');
    });

    it('should render navigation links in footer', () => {
      renderWithProviders(
        <OnboardingLayout>
          <div>Test Content</div>
        </OnboardingLayout>
      );

      expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
      expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
      expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    });

    it('should render logo with correct structure', () => {
      renderWithProviders(
        <OnboardingLayout>
          <div>Test Content</div>
        </OnboardingLayout>
      );

      const logoLink = screen.getByRole('link', { name: /Link/ });
      expect(logoLink).toHaveAttribute('href', '/discovery');
      
      const logoIcon = logoLink.querySelector('.bg-aqua');
      expect(logoIcon).toHaveClass('w-8', 'h-8', 'bg-aqua', 'rounded-lg');
      expect(logoIcon).toHaveTextContent('L');
    });
  });

  describe('Snapshots', () => {
    it('should match snapshot with default state', () => {
      const { container } = renderWithProviders(
        <OnboardingLayout>
          <div>Onboarding Content</div>
        </OnboardingLayout>
      );

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with back button visible', () => {
      const onboardingContext = createMockOnboardingContext({
        canGoPrevious: true,
      });

      const { container } = renderWithProviders(
        <OnboardingLayout showBackButton={true}>
          <div>Onboarding Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with loading state', () => {
      const onboardingContext = createMockOnboardingContext({
        isLoading: true,
        canGoPrevious: true,
      });

      const { container } = renderWithProviders(
        <OnboardingLayout showBackButton={true}>
          <div>Loading Content</div>
        </OnboardingLayout>,
        { onboardingContextValue: onboardingContext }
      );

      expect(container).toMatchSnapshot();
    });

    it('should match snapshot with user greeting', () => {
      const authContext = createMockAuthContext({
        user: {
          id: 'test-user',
          first_name: 'Sarah',
          last_name: 'Smith',
          email: 'sarah@example.com',
        },
      });

      const { container } = renderWithProviders(
        <OnboardingLayout>
          <div>Personalized Content</div>
        </OnboardingLayout>,
        { authContextValue: authContext }
      );

      expect(container).toMatchSnapshot();
    });
  });
});
