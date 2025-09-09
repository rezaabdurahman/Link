import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const INTENDED_PATH_KEY = 'intended_path_during_auth';

/**
 * Hook to prevent unwanted navigation during auth state transitions
 * 
 * This hook preserves the intended route when authentication state changes from
 * undefined/loading to authenticated, preventing React Router from redirecting
 * users away from their intended destination.
 * 
 * @example
 * ```tsx
 * const { intendedPath, currentPath } = useStableLocation();
 * // Hook automatically handles route preservation during auth transitions
 * ```
 * 
 * @returns {Object} Hook state object
 * @returns {string | null} returns.intendedPath - The originally intended path stored in sessionStorage
 * @returns {string} returns.currentPath - The current location pathname
 * 
 * @description
 * How it works:
 * 1. Captures the initial path in sessionStorage when user is not yet authenticated
 * 2. Detects when authentication completes (isLoading=false, user exists)  
 * 3. If current path differs from intended path, restores original path
 * 4. Uses 100ms delay to allow React Router to settle before navigation
 * 5. Automatically cleans up sessionStorage after successful restoration
 * 
 * Features:
 * - Survives React re-renders and component unmounts via sessionStorage
 * - Handles incognito mode with graceful error handling
 * - Prevents memory leaks with proper timeout cleanup
 * - Avoids storing auth-related paths (/login, /signup)
 * - Development-only console logging
 */
export const useStableLocation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoading, user } = useAuth();
  
  // Store intended path in sessionStorage to survive React re-renders
  const getIntendedPath = (): string | null => {
    try {
      return sessionStorage.getItem(INTENDED_PATH_KEY);
    } catch (error) {
      console.warn('🔒 useStableLocation: Failed to read from sessionStorage:', error);
      return null;
    }
  };
  
  const setIntendedPath = (path: string) => {
    try {
      sessionStorage.setItem(INTENDED_PATH_KEY, path);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔒 useStableLocation: Stored intended path:', path);
      }
    } catch (error) {
      console.warn('🔒 useStableLocation: Failed to store intended path:', error);
    }
  };
  
  const clearIntendedPath = () => {
    try {
      sessionStorage.removeItem(INTENDED_PATH_KEY);
    } catch (error) {
      console.warn('🔒 useStableLocation: Failed to clear intended path:', error);
    }
  };
  
  // On first load when user is undefined/loading, capture the intended path
  useEffect(() => {
    const storedPath = getIntendedPath();
    
    // If no stored path and user is not yet loaded, store current path
    // Avoid storing temporary redirect paths by checking for valid routes
    if (!storedPath && (!user || isLoading) && location.pathname !== '/' && 
        !location.pathname.includes('/login') && !location.pathname.includes('/signup')) {
      setIntendedPath(location.pathname);
    }
  }, [location.pathname, user, isLoading]);
  
  // After auth completes, check if we need to restore path
  useEffect(() => {
    const storedPath = getIntendedPath();
    
    if (!isLoading && user && storedPath && location.pathname !== storedPath) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔒 useStableLocation: Auth complete, restoring path from', location.pathname, 'to', storedPath);
      }
      
      // Use a small delay to ensure the router has settled
      const timeoutId = setTimeout(() => {
        navigate(storedPath, { replace: true });
        clearIntendedPath();
      }, 100);
      
      // Cleanup timeout if component unmounts
      return () => clearTimeout(timeoutId);
    } else if (!isLoading && user) {
      // Auth complete and we're on the right path, clean up
      clearIntendedPath();
    }
  }, [isLoading, user, location.pathname, navigate]);
  
  return {
    intendedPath: getIntendedPath(),
    currentPath: location.pathname
  };
};