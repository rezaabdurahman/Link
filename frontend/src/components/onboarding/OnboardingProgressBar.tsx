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
    <div className={`mb-8 sm:mb-12 ${className}`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <span className="text-base sm:text-lg font-semibold text-text-primary">
          Your Progress
        </span>
        {showPercentage && (
          <div className="flex items-center space-x-2 sm:space-x-3">
            {validProgress === 100 && (
              <div className="flex items-center space-x-1 sm:space-x-2 text-aqua">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-aqua/20 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <span className="text-xs sm:text-sm font-semibold">Complete!</span>
              </div>
            )}
            <span className="text-base sm:text-lg font-bold text-text-primary bg-surface-hover px-2 sm:px-3 py-1 rounded-full">
              {Math.round(validProgress)}%
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar Container */}
      <div className="relative">
        <div className="w-full bg-surface-border rounded-full h-3 sm:h-4 overflow-hidden shadow-inner">
          {/* Progress Fill */}
          <div
            className="h-full bg-aqua rounded-full transition-all duration-700 ease-out relative overflow-hidden"
            style={{ width: `${validProgress}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12" />
          </div>
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
                    ? 'bg-primary-100 scale-105'
                    : 'bg-gray-300'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Step Labels - Hidden on very small screens */}
      <div className="hidden sm:flex justify-between mt-3 px-1">
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
                  ? 'text-aqua font-medium'
                  : isCurrent
                  ? 'text-primary-600 font-medium'
                  : 'text-text-muted'
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
