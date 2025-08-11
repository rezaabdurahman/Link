import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  updateBroadcast,
  UserServiceError,
  isAuthError,
  getErrorMessage,
  ApiError,
} from './user';

// Test constants
const API_BASE_URL = 'http://localhost:8080';
const BROADCAST_ENDPOINT = '/users/profile/broadcast';

// MSW handlers for user API endpoints
const userApiHandlers = [
  // Successful broadcast update
  http.put(`${API_BASE_URL}${BROADCAST_ENDPOINT}`, async ({ request }) => {
    const body = await request.json();
    
    // Simulate validation
    if (!body.broadcast) {
      return HttpResponse.json(
        {
          message: 'Broadcast message is required',
          field: 'broadcast',
          code: 'REQUIRED_FIELD',
        },
        { status: 400 }
      );
    }
    
    if (body.broadcast.length > 500) {
      return HttpResponse.json(
        {
          message: 'Broadcast message too long',
          field: 'broadcast',
          code: 'BROADCAST_TOO_LONG',
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      broadcast: body.broadcast,
    });
  }),

  // Unauthorized request
  http.put(`${API_BASE_URL}/users/profile/broadcast-unauthorized`, () => {
    return HttpResponse.json(
      {
        message: 'Authentication token is invalid',
        code: 'TOKEN_EXPIRED',
      },
      { status: 401 }
    );
  }),

  // Rate limited request
  http.put(`${API_BASE_URL}/users/profile/broadcast-rate-limited`, () => {
    return HttpResponse.json(
      {
        message: 'Too many requests',
        retryAfter: 120,
        code: 'TOO_MANY_REQUESTS',
      },
      { status: 429 }
    );
  }),

  // Server error
  http.put(`${API_BASE_URL}/users/profile/broadcast-server-error`, () => {
    return HttpResponse.json(
      {
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }),
];

// Setup MSW server
const server = setupServer(...userApiHandlers);

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  process.env = {
    ...originalEnv,
    API_BASE_URL: API_BASE_URL,
  };
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  process.env = originalEnv;
});

describe('user API', () => {
  describe('updateBroadcast', () => {
    it('should successfully update broadcast message', async () => {
      const testBroadcast = 'Looking for coffee partners this afternoon! ☕';
      
      const result = await updateBroadcast(testBroadcast);
      
      expect(result).toEqual({
        broadcast: testBroadcast,
      });
    });

    it('should trim whitespace from broadcast message', async () => {
      const testBroadcast = '  Gaming session tonight!  ';
      const trimmedBroadcast = 'Gaming session tonight!';
      
      const result = await updateBroadcast(testBroadcast);
      
      expect(result).toEqual({
        broadcast: trimmedBroadcast,
      });
    });

    it('should handle empty broadcast message', async () => {
      const testBroadcast = '';
      
      // This should trigger the server's validation error
      try {
        await updateBroadcast(testBroadcast);
        fail('Should have thrown an error for empty broadcast');
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('VALIDATION_ERROR');
        expect(userError.error.code).toBe('REQUIRED_FIELD');
      }
    });

    it('should validate input type', async () => {
      try {
        // @ts-expect-error - Testing invalid input type
        await updateBroadcast(123);
        fail('Should have thrown an error for non-string input');
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('VALIDATION_ERROR');
        expect(userError.error.code).toBe('INVALID_FORMAT');
        expect(userError.error.message).toBe('Broadcast must be a string');
      }
    });

    it('should handle authentication errors', async () => {
      // Mock the endpoint to return 401
      server.use(
        http.put(`${API_BASE_URL}${BROADCAST_ENDPOINT}`, () => {
          return HttpResponse.json(
            {
              message: 'Authentication token is invalid',
              code: 'TOKEN_EXPIRED',
            },
            { status: 401 }
          );
        })
      );

      try {
        await updateBroadcast('Test broadcast');
        fail('Should have thrown an authentication error');
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('AUTHENTICATION_ERROR');
        expect(userError.error.code).toBe('TOKEN_EXPIRED');
        expect(isAuthError(error)).toBe(true);
      }
    });

    it('should handle rate limiting errors', async () => {
      server.use(
        http.put(`${API_BASE_URL}${BROADCAST_ENDPOINT}`, () => {
          return HttpResponse.json(
            {
              message: 'Too many requests',
              retryAfter: 120,
              code: 'TOO_MANY_REQUESTS',
            },
            { status: 429 }
          );
        })
      );

      try {
        await updateBroadcast('Test broadcast');
        fail('Should have thrown a rate limiting error');
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('RATE_LIMIT_ERROR');
        expect(userError.error.code).toBe('TOO_MANY_REQUESTS');
        if (userError.error.type === 'RATE_LIMIT_ERROR') {
          expect(userError.error.retryAfter).toBe(120);
        }
      }
    });

    it('should handle server errors', async () => {
      server.use(
        http.put(`${API_BASE_URL}${BROADCAST_ENDPOINT}`, () => {
          return HttpResponse.json(
            {
              message: 'Database connection failed',
              code: 'DATABASE_ERROR',
            },
            { status: 500 }
          );
        })
      );

      try {
        await updateBroadcast('Test broadcast');
        fail('Should have thrown a server error');
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('SERVER_ERROR');
        expect(userError.error.code).toBe('DATABASE_ERROR');
      }
    });

    it('should handle network errors', async () => {
      server.use(
        http.put(`${API_BASE_URL}${BROADCAST_ENDPOINT}`, () => {
          return HttpResponse.error();
        })
      );

      try {
        await updateBroadcast('Test broadcast');
        fail('Should have thrown a network error');
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('NETWORK_ERROR');
        expect(userError.error.code).toBe('CONNECTION_FAILED');
      }
    });

    it('should handle non-JSON error responses', async () => {
      server.use(
        http.put(`${API_BASE_URL}${BROADCAST_ENDPOINT}`, () => {
          return new HttpResponse('Internal Server Error', {
            status: 500,
            headers: {
              'Content-Type': 'text/plain',
            },
          });
        })
      );

      try {
        await updateBroadcast('Test broadcast');
        fail('Should have thrown a server error');
      } catch (error) {
        expect(error).toBeInstanceOf(UserServiceError);
        const userError = error as UserServiceError;
        expect(userError.error.type).toBe('SERVER_ERROR');
        expect(userError.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(userError.error.message).toBe('HTTP 500: Internal Server Error');
      }
    });
  });

  describe('error handling utilities', () => {
    describe('isAuthError', () => {
      it('should identify authentication errors correctly', () => {
        const authError = new UserServiceError({
          type: 'AUTHENTICATION_ERROR',
          message: 'Invalid credentials',
          code: 'UNAUTHORIZED',
        });
        
        expect(isAuthError(authError)).toBe(true);
        expect(isAuthError(new Error('Regular error'))).toBe(false);
      });

      it('should identify authorization errors correctly', () => {
        const authError = new UserServiceError({
          type: 'AUTHORIZATION_ERROR',
          message: 'Access denied',
          code: 'ACCESS_DENIED',
        });
        
        expect(isAuthError(authError)).toBe(true);
      });

      it('should not identify non-auth errors as auth errors', () => {
        const validationError = new UserServiceError({
          type: 'VALIDATION_ERROR',
          message: 'Invalid input',
          field: 'broadcast',
          code: 'INVALID_FORMAT',
        });
        
        expect(isAuthError(validationError)).toBe(false);
      });
    });

    describe('getErrorMessage', () => {
      it('should return user-friendly error messages for validation errors', () => {
        const validationError: ApiError = {
          type: 'VALIDATION_ERROR',
          message: 'Invalid broadcast message',
          field: 'broadcast',
          code: 'INVALID_FORMAT',
        };
        
        expect(getErrorMessage(validationError)).toBe('broadcast: Invalid broadcast message');
      });

      it('should return user-friendly error messages for auth errors', () => {
        const authError: ApiError = {
          type: 'AUTHENTICATION_ERROR',
          message: 'Invalid credentials',
          code: 'UNAUTHORIZED',
        };
        
        expect(getErrorMessage(authError)).toBe('Authentication failed. Please log in again.');
      });

      it('should return user-friendly error messages for rate limit errors', () => {
        const rateLimitError: ApiError = {
          type: 'RATE_LIMIT_ERROR',
          message: 'Too many requests',
          retryAfter: 60,
          code: 'TOO_MANY_REQUESTS',
        };
        
        expect(getErrorMessage(rateLimitError)).toBe('Too many requests. Please wait 60 seconds before trying again.');
      });

      it('should return user-friendly error messages for server errors', () => {
        const serverError: ApiError = {
          type: 'SERVER_ERROR',
          message: 'Database connection failed',
          code: 'DATABASE_ERROR',
        };
        
        expect(getErrorMessage(serverError)).toBe('Something went wrong on our end. Please try again later.');
      });

      it('should return user-friendly error messages for network errors', () => {
        const networkError: ApiError = {
          type: 'NETWORK_ERROR',
          message: 'Connection failed',
          code: 'CONNECTION_FAILED',
        };
        
        expect(getErrorMessage(networkError)).toBe('Unable to connect to the server. Please check your internet connection and try again.');
      });
    });

    describe('UserServiceError', () => {
      it('should create an error with correct properties', () => {
        const errorData: ApiError = {
          type: 'VALIDATION_ERROR',
          message: 'Test error message',
          field: 'broadcast',
          code: 'INVALID_FORMAT',
        };
        
        const error = new UserServiceError(errorData);
        
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('UserServiceError');
        expect(error.message).toBe('Test error message');
        expect(error.error).toEqual(errorData);
      });
    });
  });
});

// Export MSW handlers for use in other tests or global setup
export { userApiHandlers };
