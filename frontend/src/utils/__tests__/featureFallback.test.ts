import { ResilientFeatureService } from '../featureFallback';
import { BaseFeatureService } from '../featureFallback';

// Mock the BaseFeatureService
const mockBaseFeatureService = {
  evaluateFlag: jest.fn(),
  evaluateExperiment: jest.fn(),
  trackEvent: jest.fn(),
};

jest.mock('../featureFallback', () => {
  const actual = jest.requireActual('../featureFallback');
  return {
    ...actual,
    BaseFeatureService: jest.fn().mockImplementation(() => mockBaseFeatureService),
  };
});

describe('ResilientFeatureService', () => {
  let resilientService: ResilientFeatureService;

  beforeEach(() => {
    resilientService = new ResilientFeatureService('http://localhost:8080');
    mockBaseFeatureService.evaluateFlag.mockClear();
    mockBaseFeatureService.evaluateExperiment.mockClear();
    mockBaseFeatureService.trackEvent.mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('circuit breaker for evaluateFlag', () => {
    it('should pass through successful requests', async () => {
      const mockResponse = {
        enabled: true,
        value: true,
        variant: null,
        reason: 'FLAG_ENABLED',
      };

      mockBaseFeatureService.evaluateFlag.mockResolvedValue(mockResponse);

      const result = await resilientService.evaluateFlag('dark_mode', {
        userId: 'user-123',
      });

      expect(result).toEqual(mockResponse);
      expect(mockBaseFeatureService.evaluateFlag).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after consecutive failures', async () => {
      const error = new Error('Service unavailable');
      mockBaseFeatureService.evaluateFlag.mockRejectedValue(error);

      // Make 5 failed requests (threshold is 5)
      for (let i = 0; i < 5; i++) {
        await resilientService.evaluateFlag('dark_mode', { userId: 'user-123' });
      }

      // 6th request should use fallback without calling the service
      mockBaseFeatureService.evaluateFlag.mockClear();
      const result = await resilientService.evaluateFlag('dark_mode', { userId: 'user-123' });

      expect(mockBaseFeatureService.evaluateFlag).not.toHaveBeenCalled();
      expect(result).toEqual({
        enabled: true, // from FEATURE_DEFAULTS
        value: true,
        variant: null,
        reason: 'CIRCUIT_BREAKER_OPEN',
      });
    });

    it('should transition to half-open after timeout', async () => {
      const error = new Error('Service unavailable');
      mockBaseFeatureService.evaluateFlag.mockRejectedValue(error);

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await resilientService.evaluateFlag('dark_mode', { userId: 'user-123' });
      }

      // Fast-forward past the timeout (30 seconds)
      jest.advanceTimersByTime(31000);

      // Mock successful response for half-open test
      const successResponse = {
        enabled: true,
        value: true,
        variant: null,
        reason: 'FLAG_ENABLED',
      };
      mockBaseFeatureService.evaluateFlag.mockResolvedValueOnce(successResponse);

      const result = await resilientService.evaluateFlag('dark_mode', { userId: 'user-123' });

      expect(result).toEqual(successResponse);
      expect(mockBaseFeatureService.evaluateFlag).toHaveBeenCalledTimes(1);
    });
  });

  describe('circuit breaker for evaluateExperiment', () => {
    it('should open circuit after consecutive failures', async () => {
      const error = new Error('Service unavailable');
      mockBaseFeatureService.evaluateExperiment.mockRejectedValue(error);

      // Make 5 failed requests
      for (let i = 0; i < 5; i++) {
        await resilientService.evaluateExperiment('test_experiment', { userId: 'user-123' });
      }

      // 6th request should use fallback
      mockBaseFeatureService.evaluateExperiment.mockClear();
      const result = await resilientService.evaluateExperiment('test_experiment', { userId: 'user-123' });

      expect(mockBaseFeatureService.evaluateExperiment).not.toHaveBeenCalled();
      expect(result).toEqual({
        variant: 'control',
        inExperiment: false,
        reason: 'CIRCUIT_BREAKER_OPEN',
      });
    });
  });

  describe('trackEvent', () => {
    it('should pass through to base service', async () => {
      const event = {
        eventType: 'feature_flag_evaluated' as const,
        flagKey: 'dark_mode',
        enabled: true,
        userId: 'user-123',
        timestamp: new Date(),
      };

      mockBaseFeatureService.trackEvent.mockResolvedValue(undefined);

      await resilientService.trackEvent(event);

      expect(mockBaseFeatureService.trackEvent).toHaveBeenCalledWith(event);
    });

    it('should not throw even if base service fails', async () => {
      const event = {
        eventType: 'feature_flag_evaluated' as const,
        flagKey: 'dark_mode',
        enabled: true,
        userId: 'user-123',
        timestamp: new Date(),
      };

      mockBaseFeatureService.trackEvent.mockRejectedValue(new Error('Tracking failed'));

      await expect(resilientService.trackEvent(event)).resolves.not.toThrow();
    });
  });
});