// OnboardingContext - Global onboarding state management
// Provides onboarding status, progress tracking, and flow navigation

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  OnboardingStatusResponse,
  OnboardingStepType,
  getOnboardingStatus,
  startOnboarding,
  updateOnboardingStep,
  completeOnboarding,
  skipOnboarding,
  skipOnboardingStep,
  updateProfile,
  getNextStep,
  getPreviousStep,
  calculateProgress,
  ProfileUpdateRequest,
} from '../services/onboardingClient';
import { AuthServiceError, getErrorMessage } from '../services/authClient';

// Utility function for retrying API calls with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000,
  shouldRetry: (error: any) => boolean = () => true
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if this is not a retryable error
      if (!shouldRetry(error)) {
        throw error;
      }
      
      // Don't delay after the last attempt
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} failed, waiting ${delay}ms before retry...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`❌ All ${maxRetries} retry attempts failed`);
  throw lastError;
}

// Utility functions for localStorage caching
const CACHE_KEY = 'onboarding_status_cache';
const CACHE_EXPIRY_KEY = 'onboarding_status_cache_expiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedOnboardingStatus(): OnboardingStatusResponse | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    
    if (!cached || !expiry) {
      return null;
    }
    
    if (Date.now() > parseInt(expiry)) {
      // Cache expired
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_EXPIRY_KEY);
      return null;
    }
    
    return JSON.parse(cached);
  } catch (error) {
    console.warn('Failed to read cached onboarding status:', error);
    return null;
  }
}

function setCachedOnboardingStatus(status: OnboardingStatusResponse): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(status));
    localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
  } catch (error) {
    console.warn('Failed to cache onboarding status:', error);
  }
}

function clearCachedOnboardingStatus(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
  } catch (error) {
    console.warn('Failed to clear cached onboarding status:', error);
  }
}

// Helper to determine if an error should be retried
function shouldRetryError(error: any): boolean {
  // Retry on network errors, timeouts, and connection issues
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Retry on specific AuthServiceError types
  if (error instanceof AuthServiceError) {
    const retryableErrors = ['NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT'];
    return retryableErrors.includes(error.error?.type || '');
  }
  
  return false;
}

// Onboarding State Interface
export interface OnboardingState {
  readonly status: OnboardingStatusResponse | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isInitialized: boolean;
  readonly currentStepData: Record<string, any>;
}

// Context Type Interface
interface OnboardingContextType extends OnboardingState {
  // Navigation actions
  startOnboardingFlow: () => Promise<void>;
  goToNextStep: () => Promise<void>;
  goToPreviousStep: () => Promise<void>;
  goToStep: (step: OnboardingStepType) => Promise<void>;
  
  // Step actions
  updateCurrentStep: (data: Record<string, any>) => Promise<void>;
  skipCurrentStep: () => Promise<void>;
  completeOnboardingFlow: () => Promise<void>;
  skipOnboardingFlow: () => Promise<void>;
  
  // Profile actions
  updateUserProfile: (data: ProfileUpdateRequest) => Promise<void>;
  
  // State management
  refreshStatus: () => Promise<void>;
  clearError: () => void;
  setStepData: (data: Record<string, any>) => void;
  
  // Computed properties
  progress: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
}

// Action types for reducer
type OnboardingAction =
  | { type: 'ONBOARDING_LOADING' }
  | { type: 'ONBOARDING_STATUS_SUCCESS'; payload: OnboardingStatusResponse }
  | { type: 'ONBOARDING_ERROR'; payload: string }
  | { type: 'ONBOARDING_CLEAR_ERROR' }
  | { type: 'ONBOARDING_SET_INITIALIZED' }
  | { type: 'ONBOARDING_SET_STEP_DATA'; payload: Record<string, any> }
  | { type: 'ONBOARDING_UPDATE_STEP_DATA'; payload: Record<string, any> };

// Initial state
const createInitialOnboardingState = (): OnboardingState => ({
  status: null,
  isLoading: false,
  error: null,
  isInitialized: false,
  currentStepData: {},
});

// Onboarding state reducer
function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'ONBOARDING_LOADING':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'ONBOARDING_STATUS_SUCCESS':
      return {
        ...state,
        status: action.payload,
        isLoading: false,
        error: null,
        isInitialized: true,
      };

    case 'ONBOARDING_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        isInitialized: true,
      };

    case 'ONBOARDING_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'ONBOARDING_SET_INITIALIZED':
      return {
        ...state,
        isInitialized: true,
      };

    case 'ONBOARDING_SET_STEP_DATA':
      return {
        ...state,
        currentStepData: action.payload,
      };

    case 'ONBOARDING_UPDATE_STEP_DATA':
      return {
        ...state,
        currentStepData: {
          ...state.currentStepData,
          ...action.payload,
        },
      };

    default:
      return state;
  }
}

// Create context
const OnboardingContext = createContext<OnboardingContextType | null>(null);

// Custom hook for using onboarding context
export function useOnboarding(): OnboardingContextType {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

// OnboardingProvider props
interface OnboardingProviderProps {
  children: React.ReactNode;
}

// OnboardingProvider component
export function OnboardingProvider({ children }: OnboardingProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(onboardingReducer, createInitialOnboardingState());
  const { user, isAuthenticated: isAuthAuthenticated } = useAuth();

  // Initialize onboarding status when user is authenticated
  useEffect(() => {
    const initializeOnboarding = async (): Promise<void> => {
      console.log('🔧 OnboardingContext: Initializing...', { isAuthAuthenticated, user: user?.id });
      
      if (!isAuthAuthenticated || !user) {
        console.log('🔧 OnboardingContext: No auth/user, setting initialized');
        dispatch({ type: 'ONBOARDING_SET_INITIALIZED' });
        return;
      }

      // Check for cached status first
      const cachedStatus = getCachedOnboardingStatus();
      if (cachedStatus) {
        console.log('🔧 OnboardingContext: Using cached onboarding status:', cachedStatus);
        dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: cachedStatus });
        // Still fetch fresh data in the background, but don't block UI
        fetchFreshStatus();
        return;
      }

      // No cache, load with retry logic
      await fetchFreshStatus();
    };

    const fetchFreshStatus = async (): Promise<void> => {
      try {
        console.log('🔧 OnboardingContext: Loading onboarding status with retry logic...');
        dispatch({ type: 'ONBOARDING_LOADING' });
        
        const status = await retryWithBackoff(
          () => getOnboardingStatus(),
          3, // maxRetries
          2000, // baseDelay (2 seconds)
          shouldRetryError
        );
        
        console.log('🔧 OnboardingContext: Initial onboarding status loaded:', status);
        
        // Cache the successful result
        setCachedOnboardingStatus(status);
        
        dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      } catch (error) {
        console.error('❌ OnboardingContext: Failed to load initial status after retries:', error);
        
        const errorMessage = error instanceof AuthServiceError 
          ? getErrorMessage(error.error)
          : 'Failed to load onboarding status';
        
        dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      }
    };

    initializeOnboarding();
  }, [isAuthAuthenticated, user]);

  // Start onboarding flow
  const startOnboardingFlow = useCallback(async (): Promise<void> => {
    if (!user) {
      const error = new Error('User must be authenticated to start onboarding');
      console.error('🔧 OnboardingContext: Start flow failed - no user:', error);
      throw error;
    }

    console.log('🔧 OnboardingContext: Starting onboarding flow for user:', user.id);

    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      
      console.log('🔧 OnboardingContext: Calling startOnboarding API with retry logic...');
      const startResult = await retryWithBackoff(
        () => startOnboarding(),
        3, // maxRetries
        2000, // baseDelay (2 seconds)
        shouldRetryError
      );
      console.log('🔧 OnboardingContext: Start onboarding API result:', startResult);
      
      // Refresh status to get updated data
      console.log('🔧 OnboardingContext: Refreshing onboarding status...');
      const status = await retryWithBackoff(
        () => getOnboardingStatus(),
        3, // maxRetries
        2000, // baseDelay (2 seconds)
        shouldRetryError
      );
      console.log('🔧 OnboardingContext: Fresh onboarding status:', status);
      
      // Cache the updated status
      setCachedOnboardingStatus(status);
      
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      console.log('✅ OnboardingContext: Successfully started onboarding flow');
      
    } catch (error) {
      console.error('❌ OnboardingContext: Failed to start onboarding after retries:', error);
      
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to start onboarding';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, [user]);

  // Navigate to next step
  const goToNextStep = useCallback(async (): Promise<void> => {
    if (!state.status?.current_step) return;

    const currentStep = state.status.current_step;
    const nextStep = getNextStep(currentStep);

    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      
      // Update current step first
      await updateOnboardingStep({
        step: currentStep,
        data: state.currentStepData,
      });
      
      // If this was the last step, complete onboarding
      if (!nextStep) {
        await completeOnboarding();
      }
      
      // Refresh status
      const status = await getOnboardingStatus();
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      
      // Clear step data for new step
      dispatch({ type: 'ONBOARDING_SET_STEP_DATA', payload: {} });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to go to next step';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, [state.status?.current_step, state.currentStepData]);

  // Navigate to previous step
  const goToPreviousStep = useCallback(async (): Promise<void> => {
    if (!state.status?.current_step) return;

    const previousStep = getPreviousStep(state.status.current_step);
    if (!previousStep) return;

    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      await updateOnboardingStep({
        step: previousStep,
        data: {},
      });
      
      // Refresh status
      const status = await getOnboardingStatus();
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      
      // Clear step data for previous step
      dispatch({ type: 'ONBOARDING_SET_STEP_DATA', payload: {} });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to go to previous step';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, [state.status?.current_step]);

  // Navigate to specific step
  const goToStep = useCallback(async (step: OnboardingStepType): Promise<void> => {
    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      await updateOnboardingStep({
        step,
        data: {},
      });
      
      // Refresh status
      const status = await getOnboardingStatus();
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      
      // Clear step data for new step
      dispatch({ type: 'ONBOARDING_SET_STEP_DATA', payload: {} });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to navigate to step';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  // Update current step with data
  const updateCurrentStep = useCallback(async (data: Record<string, any>): Promise<void> => {
    if (!state.status?.current_step) return;

    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      await updateOnboardingStep({
        step: state.status.current_step,
        data,
      });
      
      // Update local step data
      dispatch({ type: 'ONBOARDING_UPDATE_STEP_DATA', payload: data });
      
      // Refresh status
      const status = await getOnboardingStatus();
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to update step';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, [state.status?.current_step]);

  // Skip current step
  const skipCurrentStep = useCallback(async (): Promise<void> => {
    if (!state.status?.current_step) return;

    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      await skipOnboardingStep({ step: state.status.current_step });
      
      // Refresh status
      const status = await getOnboardingStatus();
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      
      // Clear step data
      dispatch({ type: 'ONBOARDING_SET_STEP_DATA', payload: {} });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to skip step';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, [state.status?.current_step]);

  // Complete entire onboarding flow
  const completeOnboardingFlow = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      await retryWithBackoff(
        () => completeOnboarding(),
        3,
        2000,
        shouldRetryError
      );
      
      // Refresh status
      const status = await retryWithBackoff(
        () => getOnboardingStatus(),
        3,
        2000,
        shouldRetryError
      );
      
      // Clear cache since onboarding is now complete
      clearCachedOnboardingStatus();
      
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      
      // Clear step data
      dispatch({ type: 'ONBOARDING_SET_STEP_DATA', payload: {} });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to complete onboarding';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  // Skip entire onboarding flow
  const skipOnboardingFlow = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      await retryWithBackoff(
        () => skipOnboarding(),
        3,
        2000,
        shouldRetryError
      );
      
      // Refresh status
      const status = await retryWithBackoff(
        () => getOnboardingStatus(),
        3,
        2000,
        shouldRetryError
      );
      
      // Clear cache since onboarding is now skipped
      clearCachedOnboardingStatus();
      
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      
      // Clear step data
      dispatch({ type: 'ONBOARDING_SET_STEP_DATA', payload: {} });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to skip onboarding';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  // Update user profile
  const updateUserProfile = useCallback(async (data: ProfileUpdateRequest): Promise<void> => {
    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      await updateProfile(data);
      
      // Update step data with profile updates
      dispatch({ type: 'ONBOARDING_UPDATE_STEP_DATA', payload: data });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to update profile';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, []);

  // Refresh onboarding status
  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      const status = await getOnboardingStatus();
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Failed to refresh status';
      
      dispatch({ type: 'ONBOARDING_ERROR', payload: errorMessage });
      throw error;
    }
  }, [user]);

  // Clear error
  const clearError = useCallback((): void => {
    dispatch({ type: 'ONBOARDING_CLEAR_ERROR' });
  }, []);

  // Set step data
  const setStepData = useCallback((data: Record<string, any>): void => {
    dispatch({ type: 'ONBOARDING_SET_STEP_DATA', payload: data });
  }, []);

  // Computed properties
  const progress = state.status ? calculateProgress(state.status) : 0;
  const canGoNext = state.status?.current_step ? getNextStep(state.status.current_step) !== null : false;
  const canGoPrevious = state.status?.current_step ? getPreviousStep(state.status.current_step) !== null : false;
  const isCompleted = state.status?.status === 'completed';
  const isSkipped = state.status?.status === 'skipped';

  // Context value
  const contextValue: OnboardingContextType = {
    ...state,
    startOnboardingFlow,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    updateCurrentStep,
    skipCurrentStep,
    completeOnboardingFlow,
    skipOnboardingFlow,
    updateUserProfile,
    refreshStatus,
    clearError,
    setStepData,
    progress,
    canGoNext,
    canGoPrevious,
    isCompleted,
    isSkipped,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

export default OnboardingProvider;
