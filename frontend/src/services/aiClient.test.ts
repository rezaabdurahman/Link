// Tests for AI client service functionality
// Tests the error handling and utility functions

import { 
  AIServiceError, 
  isAIServiceError, 
  getAIErrorMessage,
  getConversationSummaryWithFallback
} from './aiClient';

// Mock the apiClient to avoid actual HTTP calls during tests
jest.mock('./authClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('aiClient utilities', () => {
  describe('error handling', () => {
    it('should identify AI service errors correctly', () => {
      const aiError: AIServiceError = {
        type: 'AI_UNAVAILABLE',
        message: 'AI service is down',
        code: 'SERVICE_DOWN',
      };
      
      expect(isAIServiceError(aiError)).toBe(true);
      expect(isAIServiceError(new Error('Regular error'))).toBe(false);
      expect(isAIServiceError(null)).toBe(false);
      expect(isAIServiceError(undefined)).toBe(false);
    });

    it('should return user-friendly error messages for different error types', () => {
      const unavailableError: AIServiceError = {
        type: 'AI_UNAVAILABLE',
        message: 'Service unavailable',
      };
      
      expect(getAIErrorMessage(unavailableError)).toBe(
        'AI summary service is currently unavailable'
      );
      
      const quotaError: AIServiceError = {
        type: 'QUOTA_EXCEEDED',
        message: 'Quota exceeded',
      };
      
      expect(getAIErrorMessage(quotaError)).toBe(
        'AI summary quota exceeded, please try again later'
      );
      
      const invalidRequestError: AIServiceError = {
        type: 'INVALID_REQUEST',
        message: 'Invalid conversation',
      };
      
      expect(getAIErrorMessage(invalidRequestError)).toBe(
        'Unable to generate summary for this conversation'
      );
      
      const unknownError: AIServiceError = {
        type: 'UNKNOWN',
        message: 'Something went wrong',
      };
      
      expect(getAIErrorMessage(unknownError)).toBe(
        'Failed to generate conversation summary'
      );
    });
  });

  describe('getConversationSummaryWithFallback', () => {
    const mockApiClient = require('./authClient').apiClient;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return AI summary when API call succeeds', async () => {
      const mockResponse = {
        conversation_id: 'test-id',
        summary: 'AI generated summary',
        generated_at: '2024-01-01T00:00:00Z',
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await getConversationSummaryWithFallback('test-id');
      
      expect(result).toBe('AI generated summary');
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/v1/ai/conversations/test-id/summary?max_length=100'
      );
    });

    it('should return fallback summary when API call fails', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('API Error'));

      const result = await getConversationSummaryWithFallback(
        'test-id', 
        'Fallback summary'
      );
      
      expect(result).toBe('Fallback summary');
    });

    it('should use default fallback when none provided and API fails', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('API Error'));

      const result = await getConversationSummaryWithFallback('test-id');
      
      expect(result).toBe('No summary available');
    });

    it('should handle empty summary response gracefully', async () => {
      const mockResponse = {
        conversation_id: 'test-id',
        summary: '',
        generated_at: '2024-01-01T00:00:00Z',
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await getConversationSummaryWithFallback(
        'test-id',
        'Fallback summary'
      );
      
      expect(result).toBe('Fallback summary');
    });
  });

  describe('AIServiceError type checking', () => {
    it('should correctly identify valid AI service error objects', () => {
      const validError = {
        type: 'AI_UNAVAILABLE' as const,
        message: 'Service down',
      };
      
      expect(isAIServiceError(validError)).toBe(true);
    });

    it('should reject objects without proper type field', () => {
      const invalidError = {
        message: 'Service down',
        // Missing type field
      };
      
      expect(isAIServiceError(invalidError)).toBe(false);
    });

    it('should reject objects with wrong type field', () => {
      const invalidError = {
        type: 123, // Wrong type
        message: 'Service down',
      };
      
      expect(isAIServiceError(invalidError)).toBe(false);
    });
  });
});
