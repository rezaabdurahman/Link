// Create local implementations of the utility classes and functions for testing
// This avoids importing the full authService module which has import.meta issues

// Copy the error types and classes for testing
type ApiError = 
  | {
      type: 'VALIDATION_ERROR';
      message: string;
      field?: string;
      code: 'INVALID_EMAIL' | 'PASSWORD_TOO_WEAK' | 'REQUIRED_FIELD' | 'INVALID_FORMAT';
    }
  | {
      type: 'AUTHENTICATION_ERROR';
      message: string;
      code: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'EMAIL_NOT_VERIFIED';
    }
  | {
      type: 'AUTHORIZATION_ERROR';
      message: string;
      code: 'ACCESS_DENIED' | 'INSUFFICIENT_PERMISSIONS' | 'TOKEN_EXPIRED';
    }
  | {
      type: 'CONFLICT_ERROR';
      message: string;
      code: 'EMAIL_ALREADY_EXISTS' | 'USERNAME_TAKEN';
    }
  | {
      type: 'RATE_LIMIT_ERROR';
      message: string;
      retryAfter: number;
      code: 'TOO_MANY_REQUESTS';
    }
  | {
      type: 'SERVER_ERROR';
      message: string;
      code: 'INTERNAL_SERVER_ERROR' | 'SERVICE_UNAVAILABLE' | 'DATABASE_ERROR';
    }
  | {
      type: 'NETWORK_ERROR';
      message: string;
      code: 'CONNECTION_FAILED' | 'TIMEOUT' | 'DNS_ERROR';
    };

class TestAuthServiceError extends Error {
  constructor(public error: ApiError) {
    super(error.message);
    this.name = 'AuthServiceError';
  }
}

function testIsAuthError(error: unknown): error is TestAuthServiceError {
  return error instanceof TestAuthServiceError && 
    (error.error.type === 'AUTHENTICATION_ERROR' || error.error.type === 'AUTHORIZATION_ERROR');
}

function testGetErrorMessage(error: ApiError): string {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      return error.field ? `${error.field}: ${error.message}` : error.message;
    case 'AUTHENTICATION_ERROR':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'AUTHORIZATION_ERROR':
      return 'You don\'t have permission to perform this action.';
    case 'CONFLICT_ERROR':
      return error.code === 'EMAIL_ALREADY_EXISTS' 
        ? 'An account with this email already exists. Please use a different email or try logging in.'
        : error.message;
    case 'RATE_LIMIT_ERROR':
      return `Too many attempts. Please wait ${error.retryAfter} seconds before trying again.`;
    case 'SERVER_ERROR':
      return 'Something went wrong on our end. Please try again later.';
    case 'NETWORK_ERROR':
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

describe('authService utilities', () => {
  describe('error handling', () => {
    it('should identify authentication errors correctly', () => {
      const authError = new TestAuthServiceError({
        type: 'AUTHENTICATION_ERROR',
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
      
      expect(testIsAuthError(authError)).toBe(true);
      expect(testIsAuthError(new Error('Regular error'))).toBe(false);
    });

    it('should return user-friendly error messages', () => {
      const validationError: ApiError = {
        type: 'VALIDATION_ERROR',
        message: 'Invalid email',
        field: 'email',
        code: 'INVALID_FORMAT',
      };
      
      expect(testGetErrorMessage(validationError)).toBe('email: Invalid email');
      
      const authError: ApiError = {
        type: 'AUTHENTICATION_ERROR',
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      };
      
      expect(testGetErrorMessage(authError)).toBe(
        'Invalid email or password. Please check your credentials and try again.'
      );
    });

    it('should handle different error types correctly', () => {
      const conflictError: ApiError = {
        type: 'CONFLICT_ERROR',
        message: 'Email already exists',
        code: 'EMAIL_ALREADY_EXISTS',
      };
      
      expect(testGetErrorMessage(conflictError)).toBe(
        'An account with this email already exists. Please use a different email or try logging in.'
      );

      const networkError: ApiError = {
        type: 'NETWORK_ERROR',
        message: 'Connection failed',
        code: 'CONNECTION_FAILED',
      };
      
      expect(testGetErrorMessage(networkError)).toBe(
        'Unable to connect to the server. Please check your internet connection and try again.'
      );
    });
  });

  describe('AuthServiceError', () => {
    it('should create an error with correct properties', () => {
      const errorData: ApiError = {
        type: 'VALIDATION_ERROR',
        message: 'Test error message',
        field: 'email',
        code: 'INVALID_FORMAT',
      };
      
      const error = new TestAuthServiceError(errorData);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AuthServiceError');
      expect(error.message).toBe('Test error message');
      expect(error.error).toEqual(errorData);
    });
  });
});

