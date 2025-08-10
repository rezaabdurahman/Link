import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { devLogin, DEV_USERS } from '../utils/devAuth';
import { useAuth } from '../contexts/AuthContext';

const DemoPage: React.FC = () => {
  const [isLoggingIn, setIsLoggingIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const loginDemo = async () => {
      try {
        // Auto-login as John Doe for demo purposes
        await devLogin(DEV_USERS.john);
        // Force a page reload to trigger auth context update
        window.location.reload();
      } catch (err) {
        setError('Failed to initialize demo mode');
        setIsLoggingIn(false);
      }
    };

    if (!user) {
      loginDemo();
    } else {
      setIsLoggingIn(false);
    }
  }, [user]);

  // If user is already logged in, redirect to main app
  if (user && !isLoggingIn) {
    return <Navigate to="/" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Demo Error</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <a 
            href="/" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"
          aria-label="Loading demo"
        />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading Demo</h1>
        <p className="text-gray-600">Setting up your preview experience...</p>
      </div>
    </div>
  );
};

export default DemoPage;
