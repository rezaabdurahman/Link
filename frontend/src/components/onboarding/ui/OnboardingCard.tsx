// OnboardingCard - Reusable card component for onboarding steps
// Implements glass morphism styling via ios-card class from design system

import React from 'react';

interface OnboardingCardProps {
  children: React.ReactNode;
  className?: string;
}

const OnboardingCard: React.FC<OnboardingCardProps> = ({ 
  children, 
  className = '' 
}): JSX.Element => {
  return (
    <div className={`ios-card p-6 ${className}`}>
      {children}
    </div>
  );
};

export default OnboardingCard;
