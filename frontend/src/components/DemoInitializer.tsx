// DemoInitializer - Automatically sets up demo authentication when in demo mode
// This component handles auto-login for demo environments

import React, { useEffect } from 'react';
import { APP_CONFIG } from '../config';
import { devLogin, DEV_USERS } from '../utils/devAuth';
import { useAuth } from '../contexts/AuthContext';

/**
 * DemoInitializer component that automatically logs in a demo user
 * when the app is running in demo mode
 */
const DemoInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized } = useAuth();

  useEffect(() => {
    const initializeDemo = async () => {
      // Only auto-login in demo mode when no user is authenticated
      if (APP_CONFIG.isDemo && APP_CONFIG.auth.autoLogin && isInitialized && !user) {
        try {
          console.log('🚀 Demo mode: Auto-logging in demo user...');
          
          // Use the 'jane' demo user for a more realistic demo experience
          await devLogin(DEV_USERS.jane);
          
          // Reload to trigger auth state update
          window.location.reload();
        } catch (error) {
          console.error('Failed to auto-login demo user:', error);
        }
      }
    };

    initializeDemo();
  }, [isInitialized, user]);

  // Show loading state in demo mode while auto-login is happening
  if (APP_CONFIG.isDemo && APP_CONFIG.auth.autoLogin && isInitialized && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-aqua/5 to-accent-copper/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Setting up demo...</h2>
          <p className="text-gray-600">Preparing your Link demo experience</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default DemoInitializer;
