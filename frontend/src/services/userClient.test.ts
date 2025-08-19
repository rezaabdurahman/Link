// Basic test for userService to verify functionality
// Tests the getUserProfile and getMyProfile functions with various scenarios

import { getUserProfile, getMyProfile, AuthServiceError, ApiError, getProfileErrorMessage } from './userClient';
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
      
      expect(mockApiClient.get).toHaveBeenCalledWith('/users/profile/user123');
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
      
      expect(mockApiClient.get).toHaveBeenCalledWith('/users/profile/user123');
    });

    it('should handle network errors', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(getUserProfile('user123')).rejects.toThrow(AuthServiceError);
    });
  });

  describe('getMyProfile', () => {
    it('should successfully fetch current user profile', async () => {
      const mockUser = {
        id: 'current-user-123',
        email: 'current@example.com',
        username: 'currentuser',
        first_name: 'Current',
        last_name: 'User',
        email_verified: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        age: 25,
        interests: ['technology', 'music'],
        social_links: [],
        additional_photos: [],
        privacy_settings: {
          show_age: true,
          show_location: false,
          show_mutual_friends: true,
        },
      };

      mockApiClient.get.mockResolvedValueOnce(mockUser);

      const result = await getMyProfile();
      
      expect(mockApiClient.get).toHaveBeenCalledWith('/users/profile/me');
      expect(result).toEqual(mockUser);
    });

    it('should handle authentication errors', async () => {
      const authError = new AuthServiceError({
        type: 'AUTHENTICATION_ERROR',
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });

      mockApiClient.get.mockRejectedValueOnce(authError);

      await expect(getMyProfile()).rejects.toThrow(AuthServiceError);
      expect(mockApiClient.get).toHaveBeenCalledWith('/users/profile/me');
    });

    it('should handle network errors', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(getMyProfile()).rejects.toThrow(AuthServiceError);
    });

    it('should wrap unexpected errors in AuthServiceError', async () => {
      mockApiClient.get.mockRejectedValueOnce(new TypeError('Unexpected error'));

      try {
        await getMyProfile();
      } catch (error) {
        expect(error).toBeInstanceOf(AuthServiceError);
        expect((error as AuthServiceError).error.type).toBe('SERVER_ERROR');
        expect((error as AuthServiceError).error.message).toBe('Failed to fetch your profile due to an unexpected error');
      }
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

    it('should return appropriate message for authentication errors', () => {
      const error: ApiError = {
        type: 'AUTHENTICATION_ERROR',
        message: 'Token invalid',
        code: 'INVALID_TOKEN',
      };

      const message = getProfileErrorMessage(error);
      expect(message).toBe('Please log in to view user profiles');
    });

    it('should return default message for unknown error types', () => {
      const error: ApiError = {
        type: 'SERVER_ERROR',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };

      const message = getProfileErrorMessage(error);
      expect(message).toBe('Internal server error');
    });

    it('should handle authorization errors without userId', () => {
      const error: ApiError = {
        type: 'AUTHORIZATION_ERROR',
        message: 'Access denied',
        code: 'ACCESS_DENIED',
      };

      const message = getProfileErrorMessage(error);
      expect(message).toBe('You don\'t have permission to view this profile');
    });
  });
});
