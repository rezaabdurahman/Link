import React, { ReactNode } from 'react';
import { useFeatureFlag, useFeatureValue, useFeatureVariant } from '../hooks/useFeatureFlag';

interface FeatureGateProps {
  /** The feature flag key to check */
  flagKey: string;
  
  /** Content to render when feature is enabled */
  children: ReactNode;
  
  /** Optional fallback content when feature is disabled */
  fallback?: ReactNode;
  
  /** Enable/disable wrapper div */
  wrapper?: boolean;
  
  /** CSS classes for wrapper */
  className?: string;
  
  /** Invert the logic (render when disabled) */
  invert?: boolean;
}

/**
 * Component that conditionally renders content based on feature flag status
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  flagKey,
  children,
  fallback = null,
  wrapper = false,
  className,
  invert = false,
}) => {
  const isEnabled = useFeatureFlag(flagKey);
  const shouldRender = invert ? !isEnabled : isEnabled;
  
  const content = shouldRender ? children : fallback;
  
  if (!content) {
    return null;
  }
  
  if (wrapper) {
    return <div className={className}>{content}</div>;
  }
  
  return <>{content}</>;
};

interface VariantGateProps {
  /** The feature flag key to check */
  flagKey: string;
  
  /** Variants to render based on feature variant */
  variants: Record<string, ReactNode>;
  
  /** Default variant to use if no specific variant matches */
  defaultVariant?: string;
  
  /** Fallback content when feature is disabled or no variant matches */
  fallback?: ReactNode;
  
  /** Enable/disable wrapper div */
  wrapper?: boolean;
  
  /** CSS classes for wrapper */
  className?: string;
}

/**
 * Component that renders different content based on feature flag variant
 */
export const VariantGate: React.FC<VariantGateProps> = ({
  flagKey,
  variants,
  defaultVariant = 'default',
  fallback = null,
  wrapper = false,
  className,
}) => {
  const isEnabled = useFeatureFlag(flagKey);
  const variant = useFeatureVariant(flagKey);
  
  if (!isEnabled) {
    const content = fallback;
    if (!content) return null;
    
    if (wrapper) {
      return <div className={className}>{content}</div>;
    }
    return <>{content}</>;
  }
  
  const variantKey = variant || defaultVariant;
  const content = variants[variantKey] || variants[defaultVariant] || fallback;
  
  if (!content) {
    return null;
  }
  
  if (wrapper) {
    return <div className={className}>{content}</div>;
  }
  
  return <>{content}</>;
};

interface ValueGateProps<T> {
  /** The feature flag key to check */
  flagKey: string;
  
  /** Function to render content based on feature value */
  children: (value: T) => ReactNode;
  
  /** Default value to use when feature is disabled */
  defaultValue: T;
  
  /** Fallback content when feature is disabled */
  fallback?: ReactNode;
  
  /** Enable/disable wrapper div */
  wrapper?: boolean;
  
  /** CSS classes for wrapper */
  className?: string;
}

/**
 * Component that renders content based on feature flag value
 */
export const ValueGate = <T,>({
  flagKey,
  children,
  defaultValue,
  fallback = null,
  wrapper = false,
  className,
}: ValueGateProps<T>) => {
  const isEnabled = useFeatureFlag(flagKey);
  const value = useFeatureValue<T>(flagKey, defaultValue);
  
  if (!isEnabled) {
    const content = fallback;
    if (!content) return null;
    
    if (wrapper) {
      return <div className={className}>{content}</div>;
    }
    return <>{content}</>;
  }
  
  const content = children(value);
  
  if (!content) {
    return null;
  }
  
  if (wrapper) {
    return <div className={className}>{content}</div>;
  }
  
  return <>{content}</>;
};

// Convenience components for common use cases
export const FeatureEnabled: React.FC<Omit<FeatureGateProps, 'invert'>> = (props) => (
  <FeatureGate {...props} invert={false} />
);

export const FeatureDisabled: React.FC<Omit<FeatureGateProps, 'invert'>> = (props) => (
  <FeatureGate {...props} invert={true} />
);

// Higher-order component for feature gating
export const withFeatureGate = <P extends object>(
  Component: React.ComponentType<P>,
  flagKey: string,
  fallback?: ReactNode
) => {
  return (props: P) => (
    <FeatureGate flagKey={flagKey} fallback={fallback}>
      <Component {...props} />
    </FeatureGate>
  );
};