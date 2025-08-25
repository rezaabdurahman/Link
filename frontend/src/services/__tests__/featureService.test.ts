import { FeatureService } from '../featureService';
import { FEATURE_DEFAULTS } from '../../config/featureDefaults';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('FeatureService', () => {
  let featureService: FeatureService;

  beforeEach(() => {
    featureService = new FeatureService('http://localhost:8080');
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('evaluateFlag', () => {
    it('should evaluate flag successfully', async () => {
      const mockResponse = {
        enabled: true,
        value: true,
        variant: null,
        reason: 'FLAG_ENABLED',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await featureService.evaluateFlag('dark_mode', {
        userId: 'user-123',
        attributes: { plan: 'premium' },
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/features/flags/dark_mode/evaluate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: 'user-123',
            attributes: { plan: 'premium' },
          }),
        }
      );
    });

    it('should return default value when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await featureService.evaluateFlag('dark_mode', {
        userId: 'user-123',
      });

      expect(result).toEqual({
        enabled: FEATURE_DEFAULTS.dark_mode,
        value: FEATURE_DEFAULTS.dark_mode,
        variant: null,
        reason: 'DEFAULT_FALLBACK',
      });
    });

    it('should return default value when API returns error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await featureService.evaluateFlag('unknown_flag', {
        userId: 'user-123',
      });

      expect(result).toEqual({
        enabled: false,
        value: false,
        variant: null,
        reason: 'DEFAULT_FALLBACK',
      });
    });
  });

  describe('evaluateExperiment', () => {
    it('should evaluate experiment successfully', async () => {
      const mockResponse = {
        variant: 'treatment',
        inExperiment: true,
        reason: 'USER_IN_EXPERIMENT',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await featureService.evaluateExperiment('new_discovery_algorithm', {
        userId: 'user-123',
        attributes: { region: 'US' },
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/features/experiments/new_discovery_algorithm/evaluate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: 'user-123',
            attributes: { region: 'US' },
          }),
        }
      );
    });

    it('should return control variant when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await featureService.evaluateExperiment('new_discovery_algorithm', {
        userId: 'user-123',
      });

      expect(result).toEqual({
        variant: 'control',
        inExperiment: false,
        reason: 'FALLBACK',
      });
    });
  });

  describe('trackEvent', () => {
    it('should track event successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const event = {
        eventType: 'feature_flag_evaluated' as const,
        flagKey: 'dark_mode',
        enabled: true,
        userId: 'user-123',
        timestamp: new Date(),
      };

      await featureService.trackEvent(event);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/features/events',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );
    });

    it('should not throw when tracking fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const event = {
        eventType: 'feature_flag_evaluated' as const,
        flagKey: 'dark_mode',
        enabled: true,
        userId: 'user-123',
        timestamp: new Date(),
      };

      await expect(featureService.trackEvent(event)).resolves.not.toThrow();
    });
  });
});