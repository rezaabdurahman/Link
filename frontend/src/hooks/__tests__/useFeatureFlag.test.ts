import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlag } from '../useFeatureFlag';
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

describe('useFeatureFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false for unknown feature flag', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: false,
      value: false,
      variant: null,
      reason: 'FLAG_NOT_FOUND',
    });

    const { result } = renderHook(() => useFeatureFlag('unknown_flag'), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('should return true for enabled feature flag', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: true,
      value: true,
      variant: null,
      reason: 'FLAG_ENABLED',
    });

    const { result } = renderHook(() => useFeatureFlag('dark_mode'), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('should return default value when service fails', async () => {
    mockFeatureService.evaluateFlag.mockRejectedValue(new Error('Service unavailable'));

    const { result } = renderHook(() => useFeatureFlag('dark_mode', true), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('should call trackEvent when flag is evaluated', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: true,
      value: true,
      variant: null,
      reason: 'FLAG_ENABLED',
    });

    renderHook(() => useFeatureFlag('dark_mode'), { wrapper });

    await waitFor(() => {
      expect(mockFeatureService.trackEvent).toHaveBeenCalledWith({
        eventType: 'feature_flag_evaluated',
        flagKey: 'dark_mode',
        enabled: true,
        userId: expect.any(String),
        timestamp: expect.any(Date),
      });
    });
  });
});