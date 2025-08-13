import React from 'react';

interface SkeletonShimmerProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number; // For text variant with multiple lines
}

const SkeletonShimmer: React.FC<SkeletonShimmerProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1
}) => {
  const baseClasses = 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer';

  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'text':
        return 'rounded-sm';
      case 'rectangular':
      default:
        return 'rounded-ios';
    }
  };

  const getDefaultDimensions = () => {
    switch (variant) {
      case 'circular':
        return { width: '48px', height: '48px' };
      case 'text':
        return { width: '100%', height: '1rem' };
      case 'rectangular':
      default:
        return { width: '100%', height: '2rem' };
    }
  };

  const defaultDimensions = getDefaultDimensions();
  const style = {
    width: width || defaultDimensions.width,
    height: height || defaultDimensions.height,
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${getVariantClasses()}`}
            style={{
              ...style,
              width: index === lines - 1 ? '75%' : style.width, // Last line is shorter
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${getVariantClasses()} ${className}`}
      style={style}
    />
  );
};

// Chat list item skeleton
export const ChatListItemSkeleton: React.FC = () => {
  return (
    <div
      className="flex items-center gap-4 p-4 border-b border-gray-100"
      role="status"
      aria-label="Loading conversation"
    >
      {/* Avatar skeleton */}
      <SkeletonShimmer
        variant="circular"
        width="56px"
        height="56px"
      />

      {/* Content skeleton */}
      <div className="flex-1 space-y-2">
        <div className="flex justify-between items-start">
          <SkeletonShimmer
            variant="text"
            width="40%"
            height="1.2rem"
          />
          <SkeletonShimmer
            variant="text"
            width="2rem"
            height="0.9rem"
          />
        </div>
        
        <SkeletonShimmer
          variant="text"
          width="60%"
          height="0.9rem"
        />
        
        <SkeletonShimmer
          variant="text"
          width="80%"
          height="1rem"
        />
      </div>
    </div>
  );
};

// Search results skeleton
export const SearchResultsSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div
      className="space-y-1"
      role="status"
      aria-label="Loading search results"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ChatListItemSkeleton key={index} />
      ))}
    </div>
  );
};

export default SkeletonShimmer;
