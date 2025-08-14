// OnboardingStepHeader - Reusable header component for onboarding steps
// Encapsulates step pill, title, subtitle with design-system colours

import React from 'react';

interface OnboardingStepHeaderProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  className?: string;
}

const OnboardingStepHeader: React.FC<OnboardingStepHeaderProps> = ({
  stepNumber,
  totalSteps,
  title,
  subtitle,
  className = ''
}): JSX.Element => {
  // Determine step pill color based on step number
  const getStepPillColor = (step: number) => {
    if (step <= 2) return 'bg-primary-50 text-primary-700';
    if (step <= 4) return 'bg-primary-100 text-primary-600';
    if (step <= 6) return 'bg-aqua/20 text-aqua-dark';
    return 'bg-aqua/30 text-aqua-deeper';
  };

  const getStepIconColor = (step: number) => {
    if (step <= 2) return 'bg-primary-100';
    if (step <= 4) return 'bg-primary-200';
    if (step <= 6) return 'bg-aqua/30';
    return 'bg-aqua/40';
  };

  return (
    <div className={`text-center mb-8 ${className}`}>
      {/* Step Pill */}
      <div className={`inline-flex items-center space-x-2 ${getStepPillColor(stepNumber)} px-3 py-2 rounded-full text-sm font-medium mb-4`}>
        <span className={`w-5 h-5 ${getStepIconColor(stepNumber)} rounded-full flex items-center justify-center text-xs font-bold`}>
          {stepNumber}
        </span>
        <span>Step {stepNumber} of {totalSteps}</span>
      </div>
      
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
        {title}
      </h1>
      
      {/* Subtitle */}
      <p className="text-lg text-text-secondary max-w-3xl mx-auto leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
};

export default OnboardingStepHeader;
