// Development authentication helper
// Provides quick authentication bypass for frontend development

import { AuthUser, AuthToken } from '../types';
import secureTokenStorage from './secureTokenStorage';
import { DEV_USER_IDS } from '../constants/users';

/**
 * Create a mock authenticated user for development
 * This bypasses the normal authentication flow
 */
export async function devLogin(userData?: Partial<AuthUser>): Promise<{ user: AuthUser; token: AuthToken }> {
  const mockUser: AuthUser = {
    id: userData?.id || DEV_USER_IDS.ALEX_THOMPSON,
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
  
  // IMPORTANT: Set token on API client immediately for MSW to work
  if (typeof window !== 'undefined') {
    try {
      const { apiClient } = await import('../services/authClient');
      apiClient.setAuthToken(mockToken.token);
      console.log('🔧 DevAuth: Set token on API client:', mockToken.token.substring(0, 20) + '...');
    } catch (error) {
      console.warn('🔧 DevAuth: Could not set token on API client:', error);
    }
  }
  
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
  jane: {
    id: DEV_USER_IDS.JANE_SMITH,
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    username: 'janesmith',
    profile_picture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
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
    
    resetOnboarding: (status: 'not_started' | 'in_progress' | 'completed' = 'not_started') => {
      // Clear onboarding-related localStorage entries
      const keysToRemove = ['onboardingState', 'onboardingStatus', 'onboarding_progress'];
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove ${key} from localStorage:`, error);
        }
      });
      
      // Set the desired onboarding status for MSW testing
      try {
        localStorage.setItem('dev_onboarding_override', JSON.stringify({
          status,
          timestamp: Date.now(),
          current_step: status === 'in_progress' ? 'profile_picture' : undefined
        }));
      } catch (error) {
        console.warn('Failed to set onboarding override:', error);
      }
      
      console.log(`🔄 Onboarding reset to: ${status}`);
      console.log('📍 Navigate to /onboarding to test the flow');
      return status;
    },
    
    loginAsNewUser: async (userData?: Partial<AuthUser>) => {
      // Create a completely new user for onboarding testing
      const newUserId = 'new-user-' + Date.now();
      const newUserData: Partial<AuthUser> = {
        id: newUserId,
        first_name: 'New',
        last_name: 'User',
        email: 'newuser@example.com',
        username: 'newuser' + Date.now(),
        profile_picture: null,
        bio: null,
        location: null,
        interests: [],
        ...userData
      };
      
      // Login as the new user
      const result = await devLogin(newUserData);
      
      // Set onboarding to not_started for this user
      try {
        localStorage.setItem('dev_onboarding_override', JSON.stringify({
          status: 'not_started',
          timestamp: Date.now(),
          user_id: newUserId
        }));
      } catch (error) {
        console.warn('Failed to set onboarding override:', error);
      }
      
      console.log('👤 Created new user for onboarding testing:', result.user);
      console.log('🚀 Onboarding status set to: not_started');
      console.log('📍 Navigate to /onboarding to test the flow');
      
      // Don't auto-reload for this function, let user navigate manually
      return result;
    },

    help: () => {
      console.log(`
🔧 Development Authentication Helper
===================================

Authentication:
- devAuth.loginAs('jane')         → Login as Jane Smith
- devAuth.loginCustom({...})      → Login with custom user data
- devAuth.loginAsNewUser({...})   → Create & login as new user for onboarding
- devAuth.logout()                → Clear authentication
- devAuth.status()                → Check current auth status

Onboarding Testing:
- devAuth.resetOnboarding()         → Reset to 'not_started'
- devAuth.resetOnboarding('in_progress') → Set to 'in_progress'
- devAuth.resetOnboarding('completed')   → Set to 'completed'

Workflow Examples:
1. Test fresh onboarding:
   > devAuth.loginAsNewUser()
   > // Navigate to /onboarding manually

2. Test onboarding steps:
   > devAuth.resetOnboarding('in_progress')
   > // Navigate to /onboarding

3. Standard testing:
   > devAuth.loginAs('jane')
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

    // Auto-login with the current user (Alex Thompson)
    console.log('🔧 Dev auth: No token found, auto-authenticating with current user');
    await devLogin({
      id: DEV_USER_IDS.ALEX_THOMPSON,
      first_name: 'Alex', 
      last_name: 'Thompson',
      email: 'alex@example.com',
      username: 'alexthompson',
      profile_picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'
    });
    console.log('🔧 Dev auth: Auto-authentication completed successfully');
  } catch (error) {
    console.error('🔧 Dev auth: Auto-authentication failed:', error);
    // Don't throw - let the app continue without auth
  }
}
