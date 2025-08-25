// Development authentication helper
// Provides quick authentication bypass for frontend development

import { AuthUser, AuthToken } from '../types';
import secureTokenStorage from './secureTokenStorage';

/**
 * Create a mock authenticated user for development
 * This bypasses the normal authentication flow
 */
export async function devLogin(userData?: Partial<AuthUser>): Promise<{ user: AuthUser; token: AuthToken }> {
  const mockUser: AuthUser = {
    id: userData?.id || 'dev-user-123',
    email: userData?.email || 'dev@example.com',
    username: userData?.username || 'devuser',
    first_name: userData?.first_name || 'Dev',
    last_name: userData?.last_name || 'User',
    profile_picture: userData?.profile_picture || null,
    bio: userData?.bio || 'Demo user for Link app',
    location: userData?.location || 'San Francisco, CA',
    interests: userData?.interests || ['technology', 'travel', 'music'],
    social_links: userData?.social_links || [],
    additional_photos: userData?.additional_photos || [],
    privacy_settings: userData?.privacy_settings || {
      show_age: true,
      show_location: true,
      show_mutual_friends: true,
      show_name: true,
      show_social_media: true,
      show_montages: true,
      show_checkins: true,
    },
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Create a mock token that expires in 1 hour
  const mockToken: AuthToken = {
    token: 'dev-token-' + mockUser.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    tokenType: 'Bearer' as const,
    issuedAt: new Date().toISOString(),
  };

  // Store the token
  await secureTokenStorage.setToken(mockToken);
  
  // Store user data for AuthContext to retrieve
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('dev_user_data', JSON.stringify(mockUser));
    } catch {
      // Fallback if localStorage fails
      (window as any).__dev_user_data = mockUser;
    }
  }

  return { user: mockUser, token: mockToken };
}

/**
 * Quick development login with preset users
 */
export const DEV_USERS = {
  john: {
    id: 'user-john',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    username: 'johndoe',
    profile_picture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  },
  jane: {
    id: 'user-jane', 
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    username: 'janesmith',
    profile_picture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  },
  dev: {
    id: 'dev-user',
    first_name: 'Dev',
    last_name: 'Tester',
    email: 'dev@test.com',
    username: 'devtester',
    profile_picture: null,
  },
} as const;

/**
 * Console helper functions for quick testing
 * Use these in browser console for quick authentication
 * SECURITY: Only available in development builds
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Make dev functions available globally in development only
  (window as any).devAuth = {
    loginAs: async (userKey: keyof typeof DEV_USERS) => {
      const userData = DEV_USERS[userKey];
      const result = await devLogin(userData);
      console.log('🔐 Dev login successful:', result.user);
      window.location.reload(); // Reload to trigger auth state update
      return result;
    },
    
    loginCustom: async (userData: Partial<AuthUser>) => {
      const result = await devLogin(userData);
      console.log('🔐 Dev login successful:', result.user);
      window.location.reload();
      return result;
    },
    
    logout: () => {
      secureTokenStorage.clearAll();
      // Clear stored dev user data
      try {
        localStorage.removeItem('dev_user_data');
        if ((window as any).__dev_user_data) {
          delete (window as any).__dev_user_data;
        }
      } catch {
        // Ignore cleanup errors
      }
      console.log('🔓 Dev logout successful');
      window.location.reload();
    },
    
    status: async () => {
      const token = await secureTokenStorage.getToken();
      console.log('🔍 Auth status:', token ? 'Authenticated' : 'Not authenticated');
      if (token) {
        console.log('Token expires:', new Date(token.expiresAt).toLocaleString());
      }
    },
    
    help: () => {
      console.log(`
🔧 Development Authentication Helper
===================================

Available commands:
- devAuth.loginAs('john')    → Login as John Doe
- devAuth.loginAs('jane')    → Login as Jane Smith  
- devAuth.loginAs('dev')     → Login as Dev Tester
- devAuth.loginCustom({...}) → Login with custom user data
- devAuth.logout()           → Clear authentication
- devAuth.status()           → Check current auth status
- devAuth.help()             → Show this help

Example:
> devAuth.loginAs('john')
> devAuth.status()
> devAuth.logout()
      `);
    }
  };

  // Show welcome message in development
  console.log('🔧 Dev Authentication Helper loaded. Type "devAuth.help()" for commands.');
}

/**
 * Auto-authenticate for development mode
 * Automatically stores a development token and user data if none exists
 */
export async function autoAuthenticateForDev(): Promise<void> {
  try {
    // Check if we already have a token
    const existingToken = await secureTokenStorage.getToken();
    if (existingToken && existingToken.token) {
      console.log('🔧 Dev auth: Existing token found, skipping auto-authentication');
      return;
    }

    // Auto-login with the default demo user
    console.log('🔧 Dev auth: No token found, auto-authenticating with demo user');
    await devLogin(DEV_USERS.jane);
    console.log('🔧 Dev auth: Auto-authentication completed successfully');
  } catch (error) {
    console.error('🔧 Dev auth: Auto-authentication failed:', error);
    // Don't throw - let the app continue without auth
  }
}
