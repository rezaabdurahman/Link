import { http } from 'msw';
import {
  RegisterRequest,
  LoginRequest, 
  AuthResponse,
  MeResponse
} from '../../services/authClient';
import { extractUserId, generateId, now } from '../utils/mockHelpers';
import { createAuthError, createValidationError, createSuccessResponse, createConflictError } from '../utils/responseBuilders';
import { buildApiUrl, API_ENDPOINTS } from '../utils/config';

// Mock database for user authentication and profiles
const mockUserProfiles: Map<string, any> = new Map();
const mockUserCredentials: Map<string, { email: string; password: string; userId: string }> = new Map();

// Initialize demo user data
const demoUser = {
  id: 'demo-user-1',
  email: 'demo@example.com',
  username: 'demouser',
  first_name: 'Demo',
  last_name: 'User',
  date_of_birth: '1990-01-01',
  profile_picture: null,
  bio: 'Demo user for Link app',
  location: 'San Francisco, CA',
  email_verified: true,
  created_at: now(),
  updated_at: now(),
};

// Additional demo user for testing
const janeUser = {
  id: '17',
  email: 'jane@example.com',
  username: 'janesmith',
  first_name: 'Jane',
  last_name: 'Smith',
  date_of_birth: '1995-05-15',
  profile_picture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  bio: 'Demo user for Link chat app',
  location: 'San Francisco, CA',
  email_verified: true,
  created_at: now(),
  updated_at: now(),
};

// Store demo users
mockUserProfiles.set('demo-user-1', demoUser);
mockUserProfiles.set('17', janeUser);

// Store credentials for authentication
mockUserCredentials.set('demo@example.com', {
  email: 'demo@example.com',
  password: 'demo123',
  userId: 'demo-user-1'
});

mockUserCredentials.set('jane@example.com', {
  email: 'jane@example.com', 
  password: 'jane123',
  userId: '17'
});

export const handlers = [
  // POST /auth/login - User login
  http.post(buildApiUrl(API_ENDPOINTS.AUTH.login), async ({ request }) => {
    console.log('🔐 MSW: Login request received');
    
    try {
      const body = await request.json() as LoginRequest;
      
      // Basic validation
      if (!body.email || !body.password) {
        return createValidationError('Email and password are required');
      }

      // Check credentials
      const credentials = mockUserCredentials.get(body.email.toLowerCase());
      if (!credentials || credentials.password !== body.password) {
        return createAuthError('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Get user profile
      const user = mockUserProfiles.get(credentials.userId);
      if (!user) {
        return createAuthError('User not found', 'USER_NOT_FOUND');
      }

      // Create response matching AuthResponse interface
      const response: AuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          date_of_birth: user.date_of_birth,
          profile_picture: user.profile_picture,
          bio: user.bio,
          location: user.location,
          email_verified: user.email_verified,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        token: `dev-token-${user.id}`,
        message: 'Login successful',
      };

      console.log('🔐 MSW: Login successful for user:', user.email);
      return createSuccessResponse(response);
      
    } catch (error) {
      console.error('🔐 MSW: Login error:', error);
      return createValidationError('Invalid request body');
    }
  }),

  // POST /auth/register - User registration
  http.post(buildApiUrl(API_ENDPOINTS.AUTH.register), async ({ request }) => {
    console.log('📝 MSW: Registration request received');
    
    try {
      const body = await request.json() as RegisterRequest;
      
      // Basic validation
      if (!body.email || !body.username || !body.first_name || !body.last_name || !body.password) {
        return createValidationError('All required fields must be provided');
      }

      // Check if email already exists
      if (mockUserCredentials.has(body.email.toLowerCase())) {
        return createConflictError('Email already exists');
      }

      // Check if username already exists
      const usernameExists = Array.from(mockUserProfiles.values()).some(
        profile => profile.username.toLowerCase() === body.username.toLowerCase()
      );
      if (usernameExists) {
        return createConflictError('Username already taken');
      }

      // Create new user
      const newUserId = generateId();
      const newUser = {
        id: newUserId,
        email: body.email,
        username: body.username,
        first_name: body.first_name,
        last_name: body.last_name,
        date_of_birth: body.date_of_birth,
        profile_picture: null,
        bio: null,
        location: null,
        email_verified: true, // Auto-verify for demo
        created_at: now(),
        updated_at: now(),
      };

      // Store user profile and credentials
      mockUserProfiles.set(newUserId, newUser);
      mockUserCredentials.set(body.email.toLowerCase(), {
        email: body.email,
        password: body.password,
        userId: newUserId
      });

      // Create response matching AuthResponse interface
      const response: AuthResponse = {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          date_of_birth: newUser.date_of_birth,
          profile_picture: newUser.profile_picture,
          bio: newUser.bio,
          location: newUser.location,
          email_verified: newUser.email_verified,
          created_at: newUser.created_at,
          updated_at: newUser.updated_at,
        },
        token: `dev-token-${newUser.id}`,
        message: 'Registration successful',
      };

      console.log('📝 MSW: Registration successful for user:', newUser.email);
      return createSuccessResponse(response, 201);
      
    } catch (error) {
      console.error('📝 MSW: Registration error:', error);
      return createValidationError('Invalid request body');
    }
  }),

  // GET /auth/me - Get current authenticated user (legacy endpoint)
  http.get(buildApiUrl(API_ENDPOINTS.AUTH.me), ({ request }) => {
    console.log('👤 MSW: Auth /me request received');
    
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError('User not authenticated', 'UNAUTHENTICATED');
    }

    const user = mockUserProfiles.get(userId);
    if (!user) {
      // Return default demo user if none found
      const defaultUser: MeResponse = {
        id: '17',
        email: 'jane@example.com',
        username: 'janesmith',
        first_name: 'Jane',
        last_name: 'Smith',
        date_of_birth: '1995-05-15',
        profile_picture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        bio: 'Demo user for Link chat app',
        location: 'San Francisco, CA',
        email_verified: true,
        created_at: now(),
        updated_at: now(),
      };
      
      console.log('👤 MSW: Returning default user for /auth/me');
      return createSuccessResponse(defaultUser);
    }

    const response: MeResponse = {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      date_of_birth: user.date_of_birth,
      profile_picture: user.profile_picture,
      bio: user.bio,
      location: user.location,
      email_verified: user.email_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    console.log('👤 MSW: Returning user profile for /auth/me:', user.email);
    return createSuccessResponse(response);
  }),

  // POST /auth/refresh - Refresh authentication token
  http.post(buildApiUrl(API_ENDPOINTS.AUTH.refresh), ({ request }) => {
    console.log('🔄 MSW: Token refresh request received');
    
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.includes('dev-token-')) {
      return createAuthError('Invalid or expired token', 'INVALID_TOKEN');
    }

    // Extract user ID from token
    const tokenParts = authHeader.replace('Bearer ', '').split('-');
    const userId = tokenParts.length > 2 ? tokenParts.slice(2).join('-') : null;

    if (!userId || !mockUserProfiles.has(userId)) {
      return createAuthError('Invalid token', 'INVALID_TOKEN');
    }

    // Return refreshed token
    const response = {
      token: `dev-token-${Date.now()}-${userId}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    console.log('🔄 MSW: Token refreshed successfully for user:', userId);
    return createSuccessResponse(response);
  }),

  // POST /auth/logout - User logout
  http.post(buildApiUrl(API_ENDPOINTS.AUTH.logout), () => {
    console.log('🚪 MSW: Logout request received');
    
    // For mock implementation, just return success
    // In real implementation, you'd invalidate the session/token
    
    const response = { message: 'Logout successful' };
    console.log('🚪 MSW: Logout successful');
    return createSuccessResponse(response);
  }),
];
