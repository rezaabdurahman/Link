// Unit tests for broadcast functionality in user service
// Tests success scenarios and 400 error responses for updateBroadcast

import { updateBroadcast, UserServiceError } from './user';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('updateBroadcast API helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success scenarios', () => {
    it('should successfully update broadcast message', async () => {
      const mockResponse = {
        broadcast: 'Test broadcast message'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue(mockResponse),
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

    it('should trim whitespace from message', async () => {
      const mockResponse = { broadcast: 'Hello world!' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      await updateBroadcast('  Hello world!  ');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ broadcast: 'Hello world!' })
        })
      );
    });
  });

  describe('400 Error scenarios', () => {
    it('should handle validation error for invalid input', async () => {
      await expect(updateBroadcast(123 as any)).rejects.toThrow(UserServiceError);
      
      try {
        await updateBroadcast(123 as any);
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('VALIDATION_ERROR');
        expect(userError.error.message).toBe('Broadcast must be a string');
        expect(userError.error.code).toBe('INVALID_FORMAT');
      }
    });

    it('should handle 400 server validation error', async () => {
      const errorResponse = {
        message: 'Broadcast message is too long',
        field: 'broadcast',
        code: 'BROADCAST_TOO_LONG'
      };

      // Create a proper mock Response with all required properties
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue(errorResponse),
      } as Partial<Response>;

      mockFetch.mockResolvedValueOnce(mockResponse as Response);

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
  });
});
