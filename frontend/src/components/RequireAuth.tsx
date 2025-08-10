// RequireAuth - Protected route component that requires user authentication
// Redirects to login page if user is not authenticated while preserving the intended destination

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAuthRequired } from '../config';

/**
 * RequireAuth component that protects routes requiring authentication
 * 
 * This component checks the authentication state and:
 * - Shows a loading state while authentication is being determined
 * - Redirects to login if user is not authenticated, preserving the intended destination
 * - Renders the protected content if user is authenticated
 */
const RequireAuth: React.FC = (): JSX.Element => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Skip authentication if environment doesn't require it (demo mode, etc.)
  if (!isAuthRequired()) {
    return <Outlet />;
  }

  // Show loading state while authentication status is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div 
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" 
          role="status" 
          aria-label="Loading authentication status"
        ></div>
      </div>
    );
  }

  // If user is not authenticated, redirect to login with the intended destination
  if (!user) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // User is authenticated, render the protected content
  return <Outlet />;
};

export default RequireAuth;
