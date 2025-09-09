import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  ConsentStore, 
  ConsentState, 
  ConsentType, 
  ConsentSource,
  ConsentValidationResult,
  ConsentValidationError 
} from '../types/consent';
import { consentClient } from '../services/consentClient';

// Initial consent state
const initialConsentState: ConsentState = {
  aiProcessing: false,
  dataAnonymization: true, // Default to true for better privacy
  marketing: false,
  analytics: false,
  personalization: false,
  loading: false,
  error: null
};

// Zustand store for consent management
export const useConsentStore = create<ConsentStore>()(
  persist(
    (set, get) => ({
      // State
      consents: initialConsentState,
      loading: false,
      error: null,
      initialized: false,

      // Store-specific setters
      setLoading: (loading: boolean) => 
        set((state) => ({ 
          ...state, 
          loading,
          consents: { ...state.consents, loading }
        })),

      setError: (error: string | null) => 
        set((state) => ({ 
          ...state, 
          error,
          consents: { ...state.consents, error }
        })),

      setConsent: (consentType: ConsentType, granted: boolean) =>
        set((state) => ({
          ...state,
          consents: {
            ...state.consents,
            [consentType]: granted
          }
        })),

      setConsents: (consents: Partial<ConsentState>) =>
        set((state) => ({
          ...state,
          consents: {
            ...state.consents,
            ...consents
          }
        })),

      reset: () =>
        set({
          consents: initialConsentState,
          loading: false,
          error: null,
          initialized: false
        }),

      // Main actions
      updateConsent: async (
        consentType: ConsentType, 
        granted: boolean, 
        source: ConsentSource = ConsentSource.USER_ACTION
      ) => {
        const { setLoading, setError, setConsent } = get();
        
        try {
          setLoading(true);
          setError(null);

          // Update consent via API
          await consentClient.updateConsent(consentType, {
            granted,
            source
          });

          // Update local state
          setConsent(consentType, granted);

          console.log(`Consent ${consentType} ${granted ? 'granted' : 'revoked'}`);
        } catch (error) {
          console.error(`Failed to update ${consentType} consent:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to update consent';
          setError(errorMessage);
          throw error;
        } finally {
          setLoading(false);
        }
      },

      updateBatchConsents: async (
        updates: Array<{ type: ConsentType; granted: boolean }>,
        source: ConsentSource = ConsentSource.USER_ACTION
      ) => {
        const { setLoading, setError, setConsents } = get();
        
        try {
          setLoading(true);
          setError(null);

          // Prepare batch request
          const batchRequest = {
            consents: updates.map(update => ({
              consent_type: update.type,
              granted: update.granted,
              source
            })),
            source
          };

          // Update consents via API
          const response = await consentClient.updateBatchConsents(batchRequest);

          // Update local state with successful updates
          const updatedConsents: Partial<ConsentState> = {};
          response.consents.forEach(consent => {
            const consentType = consent.consent_type as ConsentType;
            updatedConsents[consentType] = consent.granted;
          });
          
          setConsents(updatedConsents);

          // Handle any failed updates
          if (response.failed_consents?.length) {
            console.warn('Some consents failed to update:', response.failed_consents);
            setError(`Failed to update ${response.failed_consents.length} consent(s)`);
          }

          console.log(`Updated ${updates.length} consents in batch`);
        } catch (error) {
          console.error('Failed to update batch consents:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to update consents';
          setError(errorMessage);
          throw error;
        } finally {
          setLoading(false);
        }
      },

      checkConsent: (consentType: ConsentType): boolean => {
        const { consents } = get();
        return consents[consentType] || false;
      },

      checkMultipleConsents: (consentTypes: ConsentType[]): ConsentValidationResult => {
        const { consents } = get();
        const missingConsents: ConsentType[] = [];
        const expiredConsents: ConsentType[] = []; // TODO: Implement expiry checking
        const errors: string[] = [];

        consentTypes.forEach(consentType => {
          if (!consents[consentType]) {
            missingConsents.push(consentType);
          }
        });

        if (missingConsents.length > 0) {
          errors.push(`Missing consents: ${missingConsents.join(', ')}`);
        }

        return {
          valid: missingConsents.length === 0 && expiredConsents.length === 0,
          missingConsents,
          expiredConsents,
          errors
        };
      },

      refreshConsents: async () => {
        const { setLoading, setError, setConsents } = get();
        
        try {
          setLoading(true);
          setError(null);

          // Fetch current consents from API
          const response = await consentClient.getUserConsents();

          // Map API response to local state
          const updatedConsents: Partial<ConsentState> = {
            loading: false,
            error: null
          };

          response.consents.forEach(consent => {
            const consentType = consent.consent_type as ConsentType;
            if (consentType in initialConsentState) {
              updatedConsents[consentType] = consent.granted;
            }
          });

          setConsents(updatedConsents);
          
          set((state) => ({ ...state, initialized: true }));

          console.log('Refreshed consents from server');
        } catch (error) {
          console.error('Failed to refresh consents:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to refresh consents';
          setError(errorMessage);
        } finally {
          setLoading(false);
        }
      },

      revokeAllConsents: async () => {
        const { setLoading, setError, setConsents } = get();
        
        try {
          setLoading(true);
          setError(null);

          await consentClient.revokeAllConsents();

          // Reset all consents to false
          setConsents({
            aiProcessing: false,
            dataAnonymization: false,
            marketing: false,
            analytics: false,
            personalization: false,
            loading: false,
            error: null
          });

          console.log('All consents revoked');
        } catch (error) {
          console.error('Failed to revoke all consents:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to revoke consents';
          setError(errorMessage);
          throw error;
        } finally {
          setLoading(false);
        }
      },

      initializeDefaultConsents: async () => {
        const { setLoading, setError, setConsents } = get();
        
        try {
          setLoading(true);
          setError(null);

          // Initialize default consents for new user
          const response = await consentClient.initializeDefaultConsents();

          // Update local state with initialized consents
          const updatedConsents: Partial<ConsentState> = {
            loading: false,
            error: null
          };

          response.consents.forEach(consent => {
            const consentType = consent.consent_type as ConsentType;
            if (consentType in initialConsentState) {
              updatedConsents[consentType] = consent.granted;
            }
          });

          setConsents(updatedConsents);
          
          set((state) => ({ ...state, initialized: true }));

          console.log('Initialized default consents');
        } catch (error) {
          console.error('Failed to initialize default consents:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize consents';
          setError(errorMessage);
          throw error;
        } finally {
          setLoading(false);
        }
      }
    }),
    {
      name: 'consent-storage',
      partialize: (state) => ({
        consents: state.consents,
        initialized: state.initialized
      }),
      // Rehydrate from storage
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('Rehydrated consent state from storage');
          // Optionally refresh from server after hydration
          setTimeout(() => {
            if (state.initialized) {
              state.refreshConsents().catch(console.error);
            }
          }, 1000);
        }
      },
    }
  )
);

// Selectors for convenience
export const useConsentSelectors = () => {
  const store = useConsentStore();
  
  return {
    // Boolean selectors
    hasAIProcessingConsent: store.consents.aiProcessing,
    hasDataAnonymizationConsent: store.consents.dataAnonymization,
    hasMarketingConsent: store.consents.marketing,
    hasAnalyticsConsent: store.consents.analytics,
    hasPersonalizationConsent: store.consents.personalization,
    
    // State selectors
    isLoading: store.loading,
    hasError: !!store.error,
    error: store.error,
    isInitialized: store.initialized,
    
    // Derived state
    hasAnyConsent: Object.values(store.consents).some(value => 
      typeof value === 'boolean' && value
    ),
    hasAllRequiredConsents: store.consents.dataAnonymization, // At minimum
    canUseAI: store.consents.aiProcessing && store.consents.dataAnonymization,
    
    // Validation helpers
    validateAIFeature: (): ConsentValidationResult => 
      store.checkMultipleConsents([
        ConsentType.AI_PROCESSING, 
        ConsentType.DATA_ANONYMIZATION
      ]),
    
    validateMarketingFeature: (): ConsentValidationResult =>
      store.checkMultipleConsents([ConsentType.MARKETING]),
      
    validateAnalyticsFeature: (): ConsentValidationResult =>
      store.checkMultipleConsents([ConsentType.ANALYTICS])
  };
};

// Action hooks for common operations
export const useConsentActions = () => {
  const store = useConsentStore();
  
  return {
    // Basic actions
    updateConsent: store.updateConsent,
    updateBatchConsents: store.updateBatchConsents,
    refreshConsents: store.refreshConsents,
    revokeAllConsents: store.revokeAllConsents,
    initializeDefaultConsents: store.initializeDefaultConsents,
    
    // Convenience actions
    grantAIProcessing: () => 
      store.updateConsent(ConsentType.AI_PROCESSING, true),
    
    revokeAIProcessing: () =>
      store.updateConsent(ConsentType.AI_PROCESSING, false),
      
    grantDataAnonymization: () =>
      store.updateConsent(ConsentType.DATA_ANONYMIZATION, true),
      
    revokeDataAnonymization: () =>
      store.updateConsent(ConsentType.DATA_ANONYMIZATION, false),
    
    grantMarketing: () =>
      store.updateConsent(ConsentType.MARKETING, true),
      
    revokeMarketing: () =>
      store.updateConsent(ConsentType.MARKETING, false),
    
    enableAllOptional: () =>
      store.updateBatchConsents([
        { type: ConsentType.MARKETING, granted: true },
        { type: ConsentType.ANALYTICS, granted: true },
        { type: ConsentType.PERSONALIZATION, granted: true }
      ]),
    
    disableAllOptional: () =>
      store.updateBatchConsents([
        { type: ConsentType.MARKETING, granted: false },
        { type: ConsentType.ANALYTICS, granted: false },
        { type: ConsentType.PERSONALIZATION, granted: false }
      ]),
    
    // AI-specific batch operation
    enableAIFeatures: () =>
      store.updateBatchConsents([
        { type: ConsentType.DATA_ANONYMIZATION, granted: true },
        { type: ConsentType.AI_PROCESSING, granted: true }
      ], ConsentSource.USER_ACTION),
      
    disableAIFeatures: () =>
      store.updateBatchConsents([
        { type: ConsentType.AI_PROCESSING, granted: false }
        // Keep data anonymization enabled for privacy
      ], ConsentSource.USER_ACTION)
  };
};

// Hook for checking if specific features can be used
export const useFeatureConsent = () => {
  const selectors = useConsentSelectors();
  
  return {
    canUseChatSummaries: selectors.canUseAI,
    canUseAIFeatures: selectors.canUseAI,
    canReceiveMarketing: selectors.hasMarketingConsent,
    canTrackAnalytics: selectors.hasAnalyticsConsent,
    canPersonalize: selectors.hasPersonalizationConsent,
    
    // Validation methods that throw errors
    requireAIConsent: () => {
      const validation = selectors.validateAIFeature();
      if (!validation.valid) {
        throw new ConsentValidationError(
          'AI features require user consent',
          validation.missingConsents
        );
      }
    },
    
    requireMarketingConsent: () => {
      const validation = selectors.validateMarketingFeature();
      if (!validation.valid) {
        throw new ConsentValidationError(
          'Marketing features require user consent',
          validation.missingConsents
        );
      }
    }
  };
};