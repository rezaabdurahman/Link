// AuthContext - Global authentication state management with JWT persistence
// Provides user state, loading indicators, and authentication actions

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { AuthUser, AuthToken, AuthState, createInitialAuthState, isTokenValid } from '../types';
import { 
  login as loginService, 
  register as registerService, 
  logout as logoutService, 
  refresh as refreshService,
  me as meService,
  AuthServiceError,
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  getErrorMessage,
  apiClient
} from '../services/authService';
import secureTokenStorage from '../utils/secureTokenStorage';

// Context types
interface AuthContextType extends AuthState {
  // Authentication actions
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (userData: Partial<AuthUser>) => void;
  clearError: () => void;
}

// Action types for reducer
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: AuthUser; token?: AuthToken } }
  | { type: 'AUTH_FAILURE'; payload: { error: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'UPDATE_USER'; payload: { user: Partial<AuthUser> } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_INITIALIZED' };

// Authentication state reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        user: action.payload.user,
        token: action.payload.token || state.token,
        error: null,
        isInitialized: true,
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
        isInitialized: true,
      };

    case 'AUTH_LOGOUT':
      return {
        ...createInitialAuthState(),
        isInitialized: true,
      };

    case 'UPDATE_USER':
      if (!state.user) return state;
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload.user,
          updated_at: new Date().toISOString(),
        },
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_INITIALIZED':
      return {
        ...state,
        isInitialized: true,
      };

    default:
      return state;
  }
}

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook for using auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// AuthProvider props
interface AuthProviderProps {
  children: React.ReactNode;
}

// AuthProvider component
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(authReducer, createInitialAuthState());
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserRef = useRef<AuthUser | null>(null);

  // Update current user ref when state changes
  useEffect(() => {
    currentUserRef.current = state.user;
  }, [state.user]);

  // Helper function to create auth token from service response
  const createTokenFromResponse = (response: AuthResponse): AuthToken | undefined => {
    if (!response.token) return undefined;
    
    // Calculate expiration time (assume 1 hour if not provided)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    return {
      token: response.token,
      expiresAt,
      tokenType: 'Bearer' as const,
      issuedAt: new Date().toISOString(),
    };
  };

  // Schedule automatic token refresh
  const scheduleTokenRefresh = useCallback((token: AuthToken) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const timeUntilExpiry = new Date(token.expiresAt).getTime() - Date.now();
    const refreshTime = Math.max(0, timeUntilExpiry - (15 * 60 * 1000)); // Refresh 15 minutes before expiry

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await refreshService();
        
        if (response.token) {
          const newToken = createTokenFromResponse({
            user: {} as any,
            token: response.token,
            message: '',
          });
          
          if (newToken) {
            await secureTokenStorage.setToken(newToken);
            apiClient.setAuthToken(newToken.token);
            scheduleTokenRefresh(newToken);
            
            // Update state with new token, preserving current user
            const currentUser = currentUserRef.current;
            if (currentUser) {
              dispatch({
                type: 'AUTH_SUCCESS',
                payload: { 
                  user: currentUser, 
                  token: newToken 
                },
              });
            }
          }
        }
      } catch (error) {
        console.warn('Automatic token refresh failed:', error);
        // Clear token storage if refresh fails
        secureTokenStorage.clearAll();
        apiClient.setAuthToken(null);
      }
    }, refreshTime);
  }, []);

  // Initialize authentication state from storage
  useEffect(() => {
    const initializeAuth = async (): Promise<void> => {
      try {
        const storedToken = await secureTokenStorage.getToken();
        
        if (storedToken && isTokenValid(storedToken)) {
          // Check if this is a development token (starts with 'dev-token-')
          const isDevToken = storedToken.token.startsWith('dev-token-');
          
          // Set token in API client
          apiClient.setAuthToken(storedToken.token);
          
          if (isDevToken) {
            // For development tokens, skip API refresh and use stored token as-is
            // This allows dev authentication to work without a backend
            
            // Try to get user data stored by devAuth helper
            let devUser: AuthUser | null = null;
            try {
              const storedUserData = localStorage.getItem('dev_user_data');
              if (storedUserData) {
                devUser = JSON.parse(storedUserData);
              } else if ((window as any).__dev_user_data) {
                devUser = (window as any).__dev_user_data;
              }
            } catch {
              // Ignore parsing errors
            }
            
            // Use stored dev user data or create fallback
            const authUser: AuthUser = devUser || {
              id: 'dev-user',
              email: 'dev@example.com',
              username: 'devuser',
              first_name: 'Dev',
              last_name: 'User',
              profile_picture: null,
              email_verified: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            dispatch({
              type: 'AUTH_SUCCESS',
              payload: { user: authUser, token: storedToken },
            });

            // Don't schedule refresh for dev tokens to avoid API calls
            if (process.env.NODE_ENV === 'development') {
              console.log('🔧 Development token detected, skipping API refresh');
            }
          } else {
            // For production tokens, try to refresh to get current user data
            try {
              const refreshResponse = await refreshService();
              
              // Update token if new one received
              let currentToken = storedToken;
              if (refreshResponse.token) {
                const newToken = createTokenFromResponse({
                  user: {} as any, // Will be filled by actual user data
                  token: refreshResponse.token,
                  message: '',
                });
                if (newToken) {
                await secureTokenStorage.setToken(newToken);
                  apiClient.setAuthToken(newToken.token);
                  currentToken = newToken;
                }
              }

              // Fetch current user profile data
              const userResponse = await meService();
              
              // Convert MeResponse to AuthUser format
              const realUser: AuthUser = {
                id: userResponse.id,
                email: userResponse.email,
                username: userResponse.username,
                first_name: userResponse.first_name,
                last_name: userResponse.last_name,
                date_of_birth: userResponse.date_of_birth,
                profile_picture: userResponse.profile_picture,
                bio: userResponse.bio,
                location: userResponse.location,
                email_verified: userResponse.email_verified,
                created_at: userResponse.created_at,
                updated_at: userResponse.updated_at,
              };

              dispatch({
                type: 'AUTH_SUCCESS',
                payload: { user: realUser, token: currentToken },
              });

              // Schedule next refresh for production tokens
              scheduleTokenRefresh(currentToken);
            } catch (refreshError) {
              // If refresh fails, clear stored token
              secureTokenStorage.clearAll();
              apiClient.setAuthToken(null);
              dispatch({ type: 'SET_INITIALIZED' });
            }
          }
        } else {
          // No valid token found
          dispatch({ type: 'SET_INITIALIZED' });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        secureTokenStorage.clearAll();
        dispatch({ type: 'SET_INITIALIZED' });
      }
    };

    initializeAuth();
  }, [scheduleTokenRefresh]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Login function
  const login = useCallback(async (credentials: LoginRequest): Promise<void> => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await loginService(credentials);
      
      // Store token if provided
      let token: AuthToken | undefined;
      if (response.token) {
        token = createTokenFromResponse(response);
        if (token) {
          await secureTokenStorage.setToken(token);
          scheduleTokenRefresh(token);
        }
      }
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user: response.user as AuthUser, token },
      });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Login failed. Please try again.';
      
      dispatch({
        type: 'AUTH_FAILURE',
        payload: { error: errorMessage },
      });
      throw error;
    }
  }, [scheduleTokenRefresh]);

  // Register function
  const register = useCallback(async (userData: RegisterRequest): Promise<void> => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await registerService(userData);
      
      // Store token if provided
      let token: AuthToken | undefined;
      if (response.token) {
        token = createTokenFromResponse(response);
        if (token) {
          await secureTokenStorage.setToken(token);
          scheduleTokenRefresh(token);
        }
      }
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user: response.user as AuthUser, token },
      });
    } catch (error) {
      const errorMessage = error instanceof AuthServiceError 
        ? getErrorMessage(error.error)
        : 'Registration failed. Please try again.';
      
      dispatch({
        type: 'AUTH_FAILURE',
        payload: { error: errorMessage },
      });
      throw error;
    }
  }, [scheduleTokenRefresh]);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      await logoutService();
    } catch (error) {
      console.warn('Logout request failed:', error);
      // Continue with logout even if server request fails
    } finally {
      // Clear stored data
      secureTokenStorage.clearAll();
      
      // Clear dev user data if it exists
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('dev_user_data');
          if ((window as any).__dev_user_data) {
            delete (window as any).__dev_user_data;
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      
      // Clear refresh timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  // Refresh function
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await refreshService();
      
      if (response.token) {
        const newToken = createTokenFromResponse({
          user: state.user || {} as any,
          token: response.token,
          message: '',
        });
        
        if (newToken) {
          await secureTokenStorage.setToken(newToken);
          scheduleTokenRefresh(newToken);
          
          // Update state with new token
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { 
              user: state.user || {} as AuthUser, 
              token: newToken 
            },
          });
        }
      }
    } catch (error) {
      // If refresh fails, logout user
      console.error('Token refresh failed:', error);
      await logout();
      throw error;
    }
  }, [state.user, scheduleTokenRefresh, logout]);

  // Update user function
  const updateUser = useCallback((userData: Partial<AuthUser>): void => {
    dispatch({
      type: 'UPDATE_USER',
      payload: { user: userData },
    });
  }, []);

  // Clear error function
  const clearError = useCallback((): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Context value
  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refresh,
    updateUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
