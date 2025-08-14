import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock the contexts to avoid import issues
const mockAuthContext = {
  user: {
    id: 'test-user-id',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    bio: 'Test bio',
  },
  isAuthenticated: true,
  isLoading: false,
};

const mockOnboardingContext = {
  currentStepData: {},
  setStepData: jest.fn(),
  goToNextStep: jest.fn().mockResolvedValue(undefined),
  goToPreviousStep: jest.fn().mockResolvedValue(undefined),
  skipCurrentStep: jest.fn().mockResolvedValue(undefined),
  canGoPrevious: true,
  canGoNext: true,
  updateUserProfile: jest.fn().mockResolvedValue(undefined),
  completeOnboardingFlow: jest.fn().mockResolvedValue(undefined),
  isLoading: false,
  error: null,
  clearError: jest.fn(),
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

jest.mock('../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => mockOnboardingContext,
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

// Import the component after mocking
import OnboardingLayout from '../OnboardingLayout';

describe('OnboardingLayout Snapshots', () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    );
  };

  it('should match snapshot with default props', () => {
    const { container } = renderWithRouter(
      <OnboardingLayout>
        <div>Test Content</div>
      </OnboardingLayout>
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot with back button visible', () => {
    // Update mock to show back button
    mockOnboardingContext.canGoPrevious = true;

    const { container } = renderWithRouter(
      <OnboardingLayout showBackButton={true}>
        <div>Test Content with Back Button</div>
      </OnboardingLayout>
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot with user greeting', () => {
    const { container } = renderWithRouter(
      <OnboardingLayout>
        <div>Personalized Content</div>
      </OnboardingLayout>
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot in loading state', () => {
    // Update mock to loading state
    mockOnboardingContext.isLoading = true;
    mockOnboardingContext.canGoPrevious = true;

    const { container } = renderWithRouter(
      <OnboardingLayout showBackButton={true}>
        <div>Loading State Content</div>
      </OnboardingLayout>
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
