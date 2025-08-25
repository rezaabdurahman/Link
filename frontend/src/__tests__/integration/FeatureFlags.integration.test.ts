/**
 * Integration test for feature flags functionality
 * Tests the complete flow from service call to UI rendering
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { FeatureToggle } from '../../components/FeatureToggle';
import { ExperimentProvider } from '../../components/ExperimentProvider';
import { useFeatureFlag, useExperiment } from '../../hooks';

// Mock the feature service
const mockEvaluateFlag = jest.fn();
const mockEvaluateExperiment = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock('../../services/featureService', () => ({
  featureService: {
    evaluateFlag: mockEvaluateFlag,
    evaluateExperiment: mockEvaluateExperiment,
    trackEvent: mockTrackEvent,
  },
}));

// Mock the feature context
jest.mock('../../contexts/FeatureContext', () => ({
  FeatureProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="feature-provider">{children}</div>,
  useFeatureContext: () => ({
    evaluateFlag: mockEvaluateFlag,
    evaluateExperiment: mockEvaluateExperiment,
    trackEvent: mockTrackEvent,
  }),
}));

describe('Feature Flags Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature Toggle Integration', () => {
    it('should render content when feature is enabled', async () => {
      mockEvaluateFlag.mockResolvedValue({
        enabled: true,
        value: true,
        variant: null,
        reason: 'FLAG_ENABLED',
      });

      render(
        <FeatureToggle feature="test_feature">
          <div data-testid="feature-content">Feature is enabled!</div>
        </FeatureToggle>
      );

      expect(await screen.findByTestId('feature-content')).toBeInTheDocument();
    });

    it('should not render content when feature is disabled', async () => {
      mockEvaluateFlag.mockResolvedValue({
        enabled: false,
        value: false,
        variant: null,
        reason: 'FLAG_DISABLED',
      });

      render(
        <FeatureToggle feature="test_feature">
          <div data-testid="feature-content">Feature is enabled!</div>
        </FeatureToggle>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
      });
    });

    it('should render fallback when feature is disabled', async () => {
      mockEvaluateFlag.mockResolvedValue({
        enabled: false,
        value: false,
        variant: null,
        reason: 'FLAG_DISABLED',
      });

      render(
        <FeatureToggle 
          feature="test_feature"
          fallback={<div data-testid="fallback-content">Feature is disabled</div>}
        >
          <div data-testid="feature-content">Feature is enabled!</div>
        </FeatureToggle>
      );

      expect(await screen.findByTestId('fallback-content')).toBeInTheDocument();
      expect(screen.queryByTestId('feature-content')).not.toBeInTheDocument();
    });
  });

  describe('Experiment Integration', () => {
    const TestComponent = () => {
      const { variant, trackConversion } = useExperiment('test_experiment');
      
      return (
        <div>
          <div data-testid="variant">{variant}</div>
          <button 
            data-testid="conversion-button"
            onClick={() => trackConversion('button_click')}
          >
            Convert
          </button>
        </div>
      );
    };

    it('should return experiment variant', async () => {
      mockEvaluateExperiment.mockResolvedValue({
        variant: 'treatment',
        inExperiment: true,
        reason: 'USER_IN_EXPERIMENT',
      });

      render(<TestComponent />);

      expect(await screen.findByTestId('variant')).toHaveTextContent('treatment');
    });

    it('should track conversion events', async () => {
      mockEvaluateExperiment.mockResolvedValue({
        variant: 'treatment',
        inExperiment: true,
        reason: 'USER_IN_EXPERIMENT',
      });

      render(<TestComponent />);

      const button = await screen.findByTestId('conversion-button');
      button.click();

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith({
          eventType: 'experiment_conversion',
          experimentKey: 'test_experiment',
          variant: 'treatment',
          conversionType: 'button_click',
          userId: expect.any(String),
          timestamp: expect.any(Date),
        });
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service failures gracefully', async () => {
      mockEvaluateFlag.mockRejectedValue(new Error('Service unavailable'));

      render(
        <FeatureToggle 
          feature="test_feature"
          fallback={<div data-testid="fallback-content">Service error</div>}
        >
          <div data-testid="feature-content">Feature enabled</div>
        </FeatureToggle>
      );

      // Should show fallback when service fails
      expect(await screen.findByTestId('fallback-content')).toBeInTheDocument();
    });

    it('should handle invalid responses gracefully', async () => {
      mockEvaluateFlag.mockResolvedValue({
        enabled: undefined,
        value: null,
        variant: undefined,
        reason: 'INVALID_RESPONSE',
      });

      const TestHookComponent = () => {
        const isEnabled = useFeatureFlag('test_feature', false);
        return <div data-testid="hook-result">{String(isEnabled)}</div>;
      };

      render(<TestHookComponent />);

      // Should default to false for invalid responses
      expect(await screen.findByTestId('hook-result')).toHaveTextContent('false');
    });
  });

  describe('Performance and Caching', () => {
    it('should not make duplicate service calls for same feature', async () => {
      mockEvaluateFlag.mockResolvedValue({
        enabled: true,
        value: true,
        variant: null,
        reason: 'FLAG_ENABLED',
      });

      const TestMultipleFlags = () => {
        const flag1 = useFeatureFlag('same_feature');
        const flag2 = useFeatureFlag('same_feature');
        
        return (
          <div>
            <div data-testid="flag1">{String(flag1)}</div>
            <div data-testid="flag2">{String(flag2)}</div>
          </div>
        );
      };

      render(<TestMultipleFlags />);

      await waitFor(() => {
        expect(screen.getByTestId('flag1')).toHaveTextContent('true');
        expect(screen.getByTestId('flag2')).toHaveTextContent('true');
      });

      // Should only make one service call even with multiple hook usages
      expect(mockEvaluateFlag).toHaveBeenCalledTimes(1);
    });
  });
});