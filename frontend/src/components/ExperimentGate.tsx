import React, { ReactNode } from 'react';
import { useExperimentAssignment, useExperimentVariant, useExperimentPayload } from '../hooks/useExperiment';

interface ExperimentGateProps {
  /** The experiment key to check */
  experimentKey: string;
  
  /** Content to render when user is in experiment */
  children: ReactNode;
  
  /** Optional fallback content when user is not in experiment */
  fallback?: ReactNode;
  
  /** Enable/disable wrapper div */
  wrapper?: boolean;
  
  /** CSS classes for wrapper */
  className?: string;
}

/**
 * Component that conditionally renders content based on experiment assignment
 */
export const ExperimentGate: React.FC<ExperimentGateProps> = ({
  experimentKey,
  children,
  fallback = null,
  wrapper = false,
  className,
}) => {
  const inExperiment = useExperimentAssignment(experimentKey);
  
  const content = inExperiment ? children : fallback;
  
  if (!content) {
    return null;
  }
  
  if (wrapper) {
    return <div className={className}>{content}</div>;
  }
  
  return <>{content}</>;
};

interface ExperimentVariantGateProps {
  /** The experiment key to check */
  experimentKey: string;
  
  /** Variants to render based on experiment variant */
  variants: Record<string, ReactNode>;
  
  /** Fallback content when user is not in experiment */
  fallback?: ReactNode;
  
  /** Enable/disable wrapper div */
  wrapper?: boolean;
  
  /** CSS classes for wrapper */
  className?: string;
}

/**
 * Component that renders different content based on experiment variant
 */
export const ExperimentVariantGate: React.FC<ExperimentVariantGateProps> = ({
  experimentKey,
  variants,
  fallback = null,
  wrapper = false,
  className,
}) => {
  const inExperiment = useExperimentAssignment(experimentKey);
  const variant = useExperimentVariant(experimentKey);
  
  if (!inExperiment || !variant) {
    const content = fallback;
    if (!content) return null;
    
    if (wrapper) {
      return <div className={className}>{content}</div>;
    }
    return <>{content}</>;
  }
  
  const content = variants[variant] || variants.control || fallback;
  
  if (!content) {
    return null;
  }
  
  if (wrapper) {
    return <div className={className}>{content}</div>;
  }
  
  return <>{content}</>;
};

interface ABTestGateProps<T extends Record<string, ReactNode>> {
  /** The experiment key to check */
  experimentKey: string;
  
  /** Variants to render - must include 'control' variant */
  variants: T & { control: ReactNode };
  
  /** Enable/disable wrapper div */
  wrapper?: boolean;
  
  /** CSS classes for wrapper */
  className?: string;
}

/**
 * Component for A/B testing with required control variant
 */
export const ABTestGate = <T extends Record<string, ReactNode>>({
  experimentKey,
  variants,
  wrapper = false,
  className,
}: ABTestGateProps<T>) => {
  const inExperiment = useExperimentAssignment(experimentKey);
  const variant = useExperimentVariant(experimentKey);
  
  // Always show control if not in experiment or no variant
  const selectedVariant = inExperiment && variant ? variant : 'control';
  const content = variants[selectedVariant] || variants.control;
  
  if (!content) {
    return null;
  }
  
  if (wrapper) {
    return <div className={className}>{content}</div>;
  }
  
  return <>{content}</>;
};

interface ExperimentPayloadGateProps<T> {
  /** The experiment key to check */
  experimentKey: string;
  
  /** Function to render content based on experiment payload */
  children: (payload: T | null, inExperiment: boolean) => ReactNode;
  
  /** Enable/disable wrapper div */
  wrapper?: boolean;
  
  /** CSS classes for wrapper */
  className?: string;
}

/**
 * Component that renders content based on experiment payload
 */
export const ExperimentPayloadGate = <T,>({
  experimentKey,
  children,
  wrapper = false,
  className,
}: ExperimentPayloadGateProps<T>) => {
  const inExperiment = useExperimentAssignment(experimentKey);
  const payload = useExperimentPayload<T>(experimentKey);
  
  const content = children(payload, inExperiment);
  
  if (!content) {
    return null;
  }
  
  if (wrapper) {
    return <div className={className}>{content}</div>;
  }
  
  return <>{content}</>;
};

// Convenience components for common A/B test scenarios
interface SimpleABTestProps {
  experimentKey: string;
  control: ReactNode;
  treatment: ReactNode;
  wrapper?: boolean;
  className?: string;
}

export const SimpleABTest: React.FC<SimpleABTestProps> = ({
  experimentKey,
  control,
  treatment,
  wrapper = false,
  className,
}) => (
  <ABTestGate
    experimentKey={experimentKey}
    variants={{ control, treatment }}
    wrapper={wrapper}
    className={className}
  />
);

// Higher-order component for experiment gating
export const withExperimentGate = <P extends object>(
  Component: React.ComponentType<P>,
  experimentKey: string,
  fallback?: ReactNode
) => {
  return (props: P) => (
    <ExperimentGate experimentKey={experimentKey} fallback={fallback}>
      <Component {...props} />
    </ExperimentGate>
  );
};

export const withABTest = <P extends object>(
  ControlComponent: React.ComponentType<P>,
  TreatmentComponent: React.ComponentType<P>,
  experimentKey: string
) => {
  return (props: P) => (
    <SimpleABTest
      experimentKey={experimentKey}
      control={<ControlComponent {...props} />}
      treatment={<TreatmentComponent {...props} />}
    />
  );
};