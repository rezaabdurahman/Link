// GuestOnly - Route guard that prevents authenticated users from accessing guest-only pages
// Redirects authenticated users to the main app instead of showing login/signup pages

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * GuestOnly component that protects routes intended only for non-authenticated users
 * 
 * This component checks the authentication state and:
 * - Shows a loading state while authentication is being determined
 * - Redirects to the main app if user is already authenticated
 * - Renders the guest content (login/signup) if user is not authenticated
 */
const GuestOnly: React.FC = (): JSX.Element => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

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

  // If user is authenticated, redirect to the intended destination or main app
  if (user) {
    // Check if there's a specific destination stored in location state
    const from = location.state?.from || '/';
    return <Navigate to={from} replace />;
  }

  // User is not authenticated, render the guest-only content
  return <Outlet />;
};

export default GuestOnly;
