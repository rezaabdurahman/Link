// Export existing hooks
export { useMontage } from './useMontage';
export { useFeatureFlag } from './useFeatureFlag';
export { useExperiment } from './useExperiment';
export { useFriendRequests, usePendingReceivedRequestsCount } from './useFriendRequests';
export { usePerformanceMonitoring } from './usePerformanceMonitoring';
export { useTypingAnimation } from './useTypingAnimation';

// Export new SWR hooks
export { useDiscoveryData } from './useDiscoveryData';
export { useChatsData, useChatOptimisticUpdates } from './useChatsData';
export { useUserProfile, useUserProfileOptimisticUpdates } from './useUserProfile';
export { useAvailabilityData, useAvailabilityOptimisticUpdates } from './useAvailabilityData';