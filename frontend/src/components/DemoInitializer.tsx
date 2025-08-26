// DemoInitializer - Automatically sets up demo authentication when in demo mode
// This component handles auto-login for demo environments

import React, { useEffect, useState } from 'react';
import { APP_CONFIG } from '../config';
import { devLogin, DEV_USERS } from '../utils/devAuth';
import { useAuth } from '../contexts/AuthContext';

/**
 * DemoInitializer component that automatically logs in a demo user
 * when the app is running in demo mode
 */
const DemoInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitialized } = useAuth();
  const [demoSetupAttempted, setDemoSetupAttempted] = useState(false);

  useEffect(() => {
    const initializeDemo = async () => {
      // Only use build-time environment variables for security
      const isDemoMode = APP_CONFIG.isDemo;
      
      console.log('🔧 Demo init check:', { isDemoMode, user: !!user, demoSetupAttempted, isInitialized });
      
      // Only auto-login in demo mode when no user is authenticated and we haven't tried yet
      if (isDemoMode && !user && !demoSetupAttempted && isInitialized) {
        try {
          console.log('🔧 Starting demo login...');
          setDemoSetupAttempted(true);
          
          // Use the 'jane' demo user for a more realistic demo experience
          const result = await devLogin(DEV_USERS.jane);
          console.log('🔧 Demo login completed:', result);
          
          // Force a small delay and then reload to ensure token is stored
          setTimeout(() => {
            console.log('🔧 Reloading page after demo login...');
            window.location.reload();
          }, 100);
        } catch (error) {
          console.error('Failed to auto-login demo user:', error);
          setDemoSetupAttempted(false); // Allow retry
        }
      }
    };

    initializeDemo();
  }, [isInitialized, user, demoSetupAttempted]);

  // Only use build-time environment variables for security
  const isDemoMode = APP_CONFIG.isDemo;
  
  // Show loading state in demo mode while auto-login is happening
  if (isDemoMode && isInitialized && !user && !demoSetupAttempted) {
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
