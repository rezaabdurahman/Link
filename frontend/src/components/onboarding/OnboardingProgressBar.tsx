// OnboardingProgressBar - Visual progress indicator for onboarding flow
// Shows current progress as a percentage with smooth animations

import React from 'react';
import { Check } from 'lucide-react';

interface OnboardingProgressBarProps {
  progress: number; // Progress as percentage (0-100)
  showPercentage?: boolean;
  className?: string;
}

const OnboardingProgressBar: React.FC<OnboardingProgressBarProps> = ({
  progress,
  showPercentage = true,
  className = '',
}): JSX.Element => {
  // Ensure progress is within valid range
  const validProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Your Progress
        </span>
        {showPercentage && (
          <div className="flex items-center space-x-2">
            {validProgress === 100 && (
              <div className="flex items-center space-x-1 text-green-600">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Complete!</span>
              </div>
            )}
            <span className="text-sm font-medium text-gray-700">
              {Math.round(validProgress)}%
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar Container */}
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          {/* Progress Fill */}
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${validProgress}%` }}
          />
        </div>

        {/* Progress Steps (optional visual markers) */}
        <div className="absolute inset-0 flex justify-between items-center px-1">
          {[...Array(7)].map((_, index) => {
            const stepProgress = ((index + 1) / 7) * 100;
            const isCompleted = validProgress >= stepProgress;
            const isCurrent = validProgress >= (index / 7) * 100 && validProgress < stepProgress;

            return (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isCompleted
                    ? 'bg-white shadow-sm scale-110'
                    : isCurrent
                    ? 'bg-blue-100 scale-105'
                    : 'bg-gray-300'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Step Labels */}
      <div className="flex justify-between mt-3 px-1">
        {[
          'Profile',
          'About',
          'Interests',
          'Location',
          'Privacy',
          'Notifications',
          'Tutorial'
        ].map((label, index) => {
          const stepProgress = ((index + 1) / 7) * 100;
          const isCompleted = validProgress >= stepProgress;
          const isCurrent = validProgress >= (index / 7) * 100 && validProgress < stepProgress;

          return (
            <span
              key={index}
              className={`text-xs transition-colors duration-300 ${
                isCompleted
                  ? 'text-indigo-600 font-medium'
                  : isCurrent
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingProgressBar;
