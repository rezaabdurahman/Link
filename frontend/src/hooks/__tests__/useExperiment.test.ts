import { renderHook, waitFor } from '@testing-library/react';
import { useExperiment } from '../useExperiment';
import { FeatureProvider } from '../../contexts/FeatureContext';
import { ReactNode } from 'react';

const mockFeatureService = {
  evaluateFlag: jest.fn(),
  evaluateExperiment: jest.fn(),
  trackEvent: jest.fn(),
};

jest.mock('../../services/featureService', () => ({
  featureService: mockFeatureService,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <FeatureProvider>{children}</FeatureProvider>
);

describe('useExperiment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return control variant for unknown experiment', async () => {
    mockFeatureService.evaluateExperiment.mockResolvedValue({
      variant: 'control',
      inExperiment: false,
      reason: 'EXPERIMENT_NOT_FOUND',
    });

    const { result } = renderHook(() => useExperiment('unknown_experiment'), { wrapper });

    await waitFor(() => {
      expect(result.current.variant).toBe('control');
      expect(result.current.inExperiment).toBe(false);
    });
  });

  it('should return experiment variant when user is in experiment', async () => {
    mockFeatureService.evaluateExperiment.mockResolvedValue({
      variant: 'treatment',
      inExperiment: true,
      reason: 'USER_IN_EXPERIMENT',
    });

    const { result } = renderHook(() => useExperiment('new_discovery_algorithm'), { wrapper });

    await waitFor(() => {
      expect(result.current.variant).toBe('treatment');
      expect(result.current.inExperiment).toBe(true);
    });
  });

  it('should track conversion when trackConversion is called', async () => {
    mockFeatureService.evaluateExperiment.mockResolvedValue({
      variant: 'treatment',
      inExperiment: true,
      reason: 'USER_IN_EXPERIMENT',
    });

    const { result } = renderHook(() => useExperiment('new_discovery_algorithm'), { wrapper });

    await waitFor(() => {
      result.current.trackConversion('user_signup');
    });

    expect(mockFeatureService.trackEvent).toHaveBeenCalledWith({
      eventType: 'experiment_conversion',
      experimentKey: 'new_discovery_algorithm',
      variant: 'treatment',
      conversionType: 'user_signup',
      userId: expect.any(String),
      timestamp: expect.any(Date),
    });
  });

  it('should handle service failure gracefully', async () => {
    mockFeatureService.evaluateExperiment.mockRejectedValue(new Error('Service unavailable'));

    const { result } = renderHook(() => useExperiment('new_discovery_algorithm'), { wrapper });

    await waitFor(() => {
      expect(result.current.variant).toBe('control');
      expect(result.current.inExperiment).toBe(false);
    });
  });
});