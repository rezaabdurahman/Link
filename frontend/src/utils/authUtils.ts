// Auth utility functions
import { jwtDecode } from 'jwt-decode';

// Get current user ID from JWT token or auth context
export const getCurrentUserId = (): string => {
  // Try to get user ID from localStorage/sessionStorage first
  const storedUserId = localStorage.getItem('userId');
  if (storedUserId) {
    return storedUserId;
  }

  // Try to extract from JWT token
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (token) {
    try {
      // Decode token without verification (we just need to extract user ID)
      const decoded = jwtDecode(token) as any;
      if (decoded?.sub) {
        return decoded.sub;
      }
      if (decoded?.user_id) {
        return decoded.user_id;
      }
      if (decoded?.uid) {
        return decoded.uid;
      }
    } catch (error) {
      console.warn('Failed to decode JWT token:', error);
    }
  }

  // Fallback - this should not happen in a properly authenticated app
  console.warn('No user ID found in auth context');
  return 'unknown';
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (!token) {
    return false;
  }

  try {
    const decoded = jwtDecode(token) as any;
    if (!decoded) {
      return false;
    }

    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Failed to validate token:', error);
    return false;
  }
};

// Get auth headers for API requests
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (!token) {
    return {};
  }

  return {
    'Authorization': `Bearer ${token}`,
    'X-User-ID': getCurrentUserId() // For additional context
  };
};