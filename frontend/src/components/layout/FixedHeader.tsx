import React, { PropsWithChildren } from 'react';

interface FixedHeaderProps extends PropsWithChildren {
  className?: string;
}

/**
 * A reusable fixed header component that provides consistent styling
 * across pages like Discovery and Chat. Uses backdrop blur and border
 * for iOS-like appearance.
 */
export const FixedHeader: React.FC<FixedHeaderProps> = ({ 
  children, 
  className = "" 
}) => {
  return (
    <header className={`flex-shrink-0 bg-white/95 backdrop-blur-ios border-b border-gray-100 z-10 ${className}`}>
      <div className="max-w-sm mx-auto px-4 pt-12">
        {children}
      </div>
    </header>
  );
};

export default FixedHeader;
