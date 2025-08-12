// OnboardingLayout - Layout component for onboarding flow
// Provides consistent styling, header, and navigation for all onboarding steps

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  showSkipButton?: boolean;
  onBack?: () => void;
  onSkip?: () => void;
}

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  showBackButton = true,
  showSkipButton = true,
  onBack,
  onSkip,
}): JSX.Element => {
  const { user } = useAuth();
  const { 
    canGoPrevious, 
    goToPreviousStep, 
    skipOnboardingFlow,
    isLoading 
  } = useOnboarding();

  const handleBack = async (): Promise<void> => {
    if (onBack) {
      onBack();
    } else if (canGoPrevious) {
      try {
        await goToPreviousStep();
      } catch (error) {
        console.error('Failed to go to previous step:', error);
      }
    }
  };

  const handleSkip = async (): Promise<void> => {
    if (onSkip) {
      onSkip();
    } else {
      try {
        await skipOnboardingFlow();
      } catch (error) {
        console.error('Failed to skip onboarding:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Left side - Back button */}
            <div className="flex items-center space-x-4">
              {showBackButton && canGoPrevious && (
                <button
                  onClick={handleBack}
                  disabled={isLoading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              
              {/* Logo */}
              <Link to="/discovery" className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">L</span>
                </div>
                <span className="ml-2 text-xl font-semibold text-gray-800">Link</span>
              </Link>
            </div>

            {/* Center - User greeting */}
            <div className="hidden sm:block">
              {user && (
                <p className="text-sm text-gray-600">
                  Welcome, {user.first_name}!
                </p>
              )}
            </div>

            {/* Right side - Empty for now */}
            <div className="flex items-center">
              {/* No skip button - onboarding is required */}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-center items-center space-x-6 text-sm text-gray-500">
            <Link 
              to="/help" 
              className="hover:text-gray-700 transition-colors"
            >
              Help
            </Link>
            <Link 
              to="/privacy" 
              className="hover:text-gray-700 transition-colors"
            >
              Privacy
            </Link>
            <Link 
              to="/terms" 
              className="hover:text-gray-700 transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingLayout;
