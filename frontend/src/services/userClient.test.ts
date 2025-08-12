// Basic test for userService to verify functionality
// Tests the getUserProfile function with various scenarios

import { getUserProfile, AuthServiceError, ApiError, getProfileErrorMessage } from './userService';
import { apiClient } from './authClient';

// Mock the apiClient
jest.mock('./authClient', () => ({
  apiClient: {
    get: jest.fn(),
  },
  AuthServiceError: class AuthServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
      this.name = 'AuthServiceError';
    }
  },
  getErrorMessage: jest.fn((error: any) => error.message),
  isAuthError: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should successfully fetch user profile', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        email_verified: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockApiClient.get.mockResolvedValueOnce(mockUser);

      const result = await getUserProfile('user123');
      
      expect(mockApiClient.get).toHaveBeenCalledWith('/users/user123/profile');
      expect(result).toEqual(mockUser);
    });

    it('should validate userId parameter', async () => {
      await expect(getUserProfile('')).rejects.toThrow(AuthServiceError);
      await expect(getUserProfile('   ')).rejects.toThrow(AuthServiceError);
    });

    it('should trim userId before making request', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      mockApiClient.get.mockResolvedValueOnce(mockUser);

      await getUserProfile('  user123  ');
      
      expect(mockApiClient.get).toHaveBeenCalledWith('/users/user123/profile');
    });

    it('should handle network errors', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(getUserProfile('user123')).rejects.toThrow(AuthServiceError);
    });
  });

  describe('getProfileErrorMessage', () => {
    it('should return appropriate message for validation errors', () => {
      const error: ApiError = {
        type: 'VALIDATION_ERROR',
        message: 'Invalid user ID',
        field: 'userId',
        code: 'REQUIRED_FIELD',
      };

      const message = getProfileErrorMessage(error);
      expect(message).toBe('Invalid user ID provided');
    });

    it('should return appropriate message for authorization errors', () => {
      const error: ApiError = {
        type: 'AUTHORIZATION_ERROR',
        message: 'Access denied',
        code: 'ACCESS_DENIED',
      };

      const message = getProfileErrorMessage(error, 'user123');
      expect(message).toBe('This user\'s profile is private or you don\'t have permission to view it');
    });
  });
});
