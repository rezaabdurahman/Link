import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';

// Mock types for context
interface MockUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  bio?: string;
  interests?: string[];
}

interface MockAuthContext {
  user: MockUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface MockOnboardingContext {
  currentStepData: Record<string, any>;
  setStepData: jest.Mock;
  goToNextStep: jest.Mock;
  goToPreviousStep: jest.Mock;
  skipCurrentStep: jest.Mock;
  canGoPrevious: boolean;
  canGoNext: boolean;
  updateUserProfile: jest.Mock;
  completeOnboardingFlow: jest.Mock;
  isLoading: boolean;
  error: string | null;
  clearError: jest.Mock;
}

// Create mock contexts
const MockAuthContext = React.createContext<MockAuthContext>({
  user: {
    id: 'test-user-id',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    bio: 'Test bio',
    interests: ['Technology', 'Travel'],
  },
  isAuthenticated: true,
  isLoading: false,
});

const MockOnboardingContext = React.createContext<MockOnboardingContext>({
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
});

// Mock the context hooks
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => React.useContext(MockAuthContext),
}));

jest.mock('../../contexts/OnboardingContext', () => ({
  useOnboarding: () => React.useContext(MockOnboardingContext),
}));

// Mock framer-motion to avoid animation complexity in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

// Custom render function that includes necessary providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContextValue?: Partial<MockAuthContext>;
  onboardingContextValue?: Partial<MockOnboardingContext>;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    authContextValue = {},
    onboardingContextValue = {},
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  const defaultAuthValue = {
    user: {
      id: 'test-user-id',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      bio: 'Test bio',
      interests: ['Technology', 'Travel'],
    },
    isAuthenticated: true,
    isLoading: false,
    ...authContextValue,
  };

  const defaultOnboardingValue = {
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
    ...onboardingContextValue,
  };

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <MockAuthContext.Provider value={defaultAuthValue}>
          <MockOnboardingContext.Provider value={defaultOnboardingValue}>
            {children}
          </MockOnboardingContext.Provider>
        </MockAuthContext.Provider>
      </BrowserRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Export mock functions for easier access in tests
export const createMockOnboardingContext = (overrides: Partial<MockOnboardingContext> = {}) => ({
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
  ...overrides,
});

export const createMockAuthContext = (overrides: Partial<MockAuthContext> = {}) => ({
  user: {
    id: 'test-user-id',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    bio: 'Test bio',
    interests: ['Technology', 'Travel'],
  },
  isAuthenticated: true,
  isLoading: false,
  ...overrides,
});

export * from '@testing-library/react';
export { renderWithProviders as render };
