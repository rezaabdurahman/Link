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
      if (!isAuthAuthenticated || !user) {
        dispatch({ type: 'ONBOARDING_SET_INITIALIZED' });
        return;
      }

      try {
        dispatch({ type: 'ONBOARDING_LOADING' });
        const status = await getOnboardingStatus();
        dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
      } catch (error) {
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
    if (!user) throw new Error('User must be authenticated to start onboarding');

    try {
      dispatch({ type: 'ONBOARDING_LOADING' });
      await startOnboarding();
      
      // Refresh status to get updated data
      const status = await getOnboardingStatus();
      dispatch({ type: 'ONBOARDING_STATUS_SUCCESS', payload: status });
    } catch (error) {
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
      await completeOnboarding();
      
      // Refresh status
      const status = await getOnboardingStatus();
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
      await skipOnboarding();
      
      // Refresh status
      const status = await getOnboardingStatus();
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
