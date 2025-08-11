// Unit tests for broadcast functionality in user service
// Tests success scenarios and 400 error responses for updateBroadcast

import { updateBroadcast, UserServiceError } from './user';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock successful response
const mockBroadcastResponse = {
  broadcast: 'Test broadcast message'
};

describe('updateBroadcast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success scenarios', () => {
    it('should successfully update broadcast message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue(mockBroadcastResponse),
      } as any);

      const result = await updateBroadcast('Hello world!');
      
      expect(result).toEqual({ broadcast: 'Test broadcast message' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/users/profile/broadcast',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ broadcast: 'Hello world!' }),
          credentials: 'include'
        })
      );
    });

    it('should trim whitespace from broadcast message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue(mockBroadcastResponse),
      } as any);

      await updateBroadcast('  Hello world!  ');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ broadcast: 'Hello world!' })
        })
      );
    });

    it('should handle empty response content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        json: jest.fn().mockResolvedValue({}),
      } as any);

      const result = await updateBroadcast('Test message');
      
      expect(result).toEqual({});
    });
  });

  describe('validation errors', () => {
    it('should throw error for non-string broadcast', async () => {
      await expect(updateBroadcast(123 as any)).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast(123 as any);
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('VALIDATION_ERROR');
        expect(userError.error.message).toBe('Broadcast must be a string');
        expect(userError.error.field).toBe('broadcast');
        expect(userError.error.code).toBe('INVALID_FORMAT');
      }
    });

    it('should handle 400 validation error from server', async () => {
      const errorResponse = {
        message: 'Broadcast message is too long',
        field: 'broadcast',
        code: 'BROADCAST_TOO_LONG'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(updateBroadcast('Very long message...')).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast('Very long message...');
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('VALIDATION_ERROR');
        expect(userError.error.message).toBe('Broadcast message is too long');
        expect(userError.error.field).toBe('broadcast');
        expect(userError.error.code).toBe('BROADCAST_TOO_LONG');
      }
    });

    it('should handle 400 required field error', async () => {
      const errorResponse = {
        message: 'Broadcast field is required',
        field: 'broadcast',
        code: 'REQUIRED_FIELD'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(updateBroadcast('')).rejects.toThrow(UserServiceError);
    });
  });

  describe('error scenarios', () => {
    it('should handle 401 authentication error', async () => {
      const errorResponse = {
        message: 'Authentication token expired',
        code: 'TOKEN_EXPIRED'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(updateBroadcast('Test message')).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast('Test message');
      } catch (error) {
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('AUTHENTICATION_ERROR');
        expect(userError.error.code).toBe('TOKEN_EXPIRED');
      }
    });

    it('should handle 429 rate limit error', async () => {
      const errorResponse = {
        message: 'Too many broadcast updates',
        retryAfter: 60
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(updateBroadcast('Test message')).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast('Test message');
      } catch (error) {
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('RATE_LIMIT_ERROR');
        expect(userError.error.retryAfter).toBe(60);
        expect(userError.error.code).toBe('TOO_MANY_REQUESTS');
      }
    });

    it('should handle network connection errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(updateBroadcast('Test message')).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast('Test message');
      } catch (error) {
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('NETWORK_ERROR');
        expect(userError.error.code).toBe('CONNECTION_FAILED');
      }
    });

    it('should handle 500 server error', async () => {
      const errorResponse = {
        message: 'Internal server error',
        code: 'DATABASE_ERROR'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(updateBroadcast('Test message')).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast('Test message');
      } catch (error) {
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('SERVER_ERROR');
        expect(userError.error.code).toBe('DATABASE_ERROR');
      }
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('Not JSON')),
      } as any);

      await expect(updateBroadcast('Test message')).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast('Test message');
      } catch (error) {
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('SERVER_ERROR');
        expect(userError.error.message).toBe('HTTP 500: Internal Server Error');
      }
    });

    it('should handle unexpected errors during API call', async () => {
      // Simulate the catch block in updateBroadcast function
      const mockError = new Error('Unexpected error');
      mockFetch.mockRejectedValueOnce(mockError);

      await expect(updateBroadcast('Test message')).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast('Test message');
      } catch (error) {
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('NETWORK_ERROR');
        expect(userError.error.message).toBe('Unexpected error');
        expect(userError.error.code).toBe('CONNECTION_FAILED');
      }
    });
  });
});
