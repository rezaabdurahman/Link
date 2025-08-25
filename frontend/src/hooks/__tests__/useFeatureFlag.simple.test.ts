/**
 * Simple test for useFeatureFlag hook without MSW dependencies
 * Tests the basic functionality and error handling
 */

import { renderHook, act } from '@testing-library/react';
import { useFeatureFlag } from '../useFeatureFlag';
import { FeatureProvider } from '../../contexts/FeatureContext';
import React from 'react';

// Simple mock for featureService without MSW
const mockFeatureService = {
  evaluateFlag: jest.fn(),
  evaluateExperiment: jest.fn(),
  trackEvent: jest.fn(),
};

// Mock the service at the module level
jest.mock('../../services/featureService', () => ({
  featureService: mockFeatureService,
}));

// Mock the context to avoid provider setup
jest.mock('../../contexts/FeatureContext', () => ({
  FeatureProvider: ({ children }: { children: React.ReactNode }) => children,
  useFeatureContext: () => ({
    evaluateFlag: mockFeatureService.evaluateFlag,
    evaluateExperiment: mockFeatureService.evaluateExperiment,
    trackEvent: mockFeatureService.trackEvent,
  }),
}));

describe('useFeatureFlag - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false for disabled feature flag', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: false,
      value: false,
      variant: null,
      reason: 'FLAG_DISABLED',
    });

    const { result } = renderHook(() => useFeatureFlag('disabled_flag'));

    // Wait for the async evaluation
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current).toBe(false);
  });

  it('should return true for enabled feature flag', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: true,
      value: true,
      variant: null,
      reason: 'FLAG_ENABLED',
    });

    const { result } = renderHook(() => useFeatureFlag('enabled_flag'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current).toBe(true);
  });

  it('should return default value when service fails', async () => {
    mockFeatureService.evaluateFlag.mockRejectedValue(new Error('Service error'));

    const { result } = renderHook(() => useFeatureFlag('error_flag', true));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current).toBe(true);
  });

  it('should handle percentage flags correctly', async () => {
    mockFeatureService.evaluateFlag.mockResolvedValue({
      enabled: true,
      value: true,
      variant: null,
      reason: 'PERCENTAGE_ENABLED',
    });

    const { result } = renderHook(() => useFeatureFlag('percentage_flag'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current).toBe(true);
    expect(mockFeatureService.evaluateFlag).toHaveBeenCalledWith('percentage_flag', {
      userId: expect.any(String),
      attributes: {},
    });
  });
});