import React, { ErrorInfo, ReactNode } from 'react';
// import * as Sentry from '@sentry/react';
import { ErrorMetadata, RecoveryStrategy, ErrorBoundaryState } from '../../utils/errorTypes';
import { errorService } from '../../services/errorService';
import { ErrorFallbackUI } from './ErrorFallbackUI';
import { ErrorReportModal } from './ErrorReportModal';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'global' | 'route' | 'component';
  onError?: (error: Error, errorInfo: ErrorInfo, metadata: ErrorMetadata) => void;
  onRecover?: (metadata: ErrorMetadata) => void;
  userId?: string;
  enableReporting?: boolean;
  customRecoveryStrategies?: RecoveryStrategy[];
}

interface State extends ErrorBoundaryState {
  showReportModal: boolean;
  isRecovering: boolean;
  lastRecoveryAttempt: number;
}

class GlobalErrorBoundary extends React.Component<Props, State> {
  private _retryTimeout: NodeJS.Timeout | null = null;
  private _focusTimeoutRef: NodeJS.Timeout | null = null;
  private _errorContainerRef = React.createRef<HTMLDivElement>();

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      metadata: null,
      retryAttempts: 0,
      lastErrorTime: 0,
      recoveryAttempts: 0,
      showReportModal: false,
      isRecovering: false,
      lastRecoveryAttempt: 0
    };
    
    // Configure error service
    errorService.setAnalytics({
      track: this.trackAnalytics.bind(this),
      identify: this.identifyUser.bind(this),
      increment: this.incrementMetric.bind(this),
      timing: this.trackTiming.bind(this)
    });
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
      // Handle error with enhanced service
      const metadata = await errorService.handleError(error, errorInfo, {
        navigate: undefined, // Global boundary doesn't navigate
        reload: this.handleReload,
        retry: this.handleRetry
      });

      // Add custom recovery strategies from props
      if (this.props.customRecoveryStrategies) {
        metadata.recoveryStrategies.push(...this.props.customRecoveryStrategies);
      }

      this.setState({
        errorInfo,
        metadata,
      });

      // Call custom error handler if provided
      if (this.props.onError) {
        this.props.onError(error, errorInfo, metadata);
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.group('🚨 Enhanced Error Boundary Caught Error');
        console.error('Error:', error);
        console.error('Error Type:', metadata.type);
        console.error('Severity:', metadata.severity);
        console.error('Metadata:', metadata);
        console.error('Component Stack:', errorInfo.componentStack);
        console.groupEnd();
      }

      // Focus management for accessibility
      this.manageFocus();
      
    } catch (handlingError) {
      console.error('Failed to handle error:', handlingError);
      
      // Fallback to basic state update
      this.setState({
        errorInfo,
        metadata: null
      });
    }
  }

  private handleRetry = async () => {
    if (!this.state.metadata) return;
    
    const strategy = this.state.metadata.recoveryStrategies.find(s => s.type === 'retry');
    if (!strategy) return;

    this.setState({ isRecovering: true });

    try {
      const success = await errorService.executeRecovery(this.state.metadata, strategy);
      
      if (success) {
        // Wait a bit for any async operations
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          metadata: null,
          retryAttempts: this.state.retryAttempts + 1,
          isRecovering: false,
          lastRecoveryAttempt: Date.now()
        });

        if (this.props.onRecover && this.state.metadata) {
          this.props.onRecover(this.state.metadata);
        }
      } else {
        this.setState({ isRecovering: false });
      }
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.setState({ isRecovering: false });
    }
  };

  private handleReload = () => {
    // Clear any cached data before reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      }).finally(() => {
        (window as any).location.reload();
      });
    } else {
      (window as any).location.reload();
    }
  };

  // Enhanced focus management for accessibility
  private manageFocus = () => {
    this._focusTimeoutRef = setTimeout(() => {
      if (this._errorContainerRef.current) {
        this._errorContainerRef.current.focus();
        
        // Announce to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = 'An error has occurred. Error recovery options are available.';
        document.body.appendChild(announcement);
        
        setTimeout(() => {
          document.body.removeChild(announcement);
        }, 1000);
      }
    }, 100);
  };

  // Handle recovery strategy execution
  private handleRecoveryStrategy = async (strategy: RecoveryStrategy) => {
    if (!this.state.metadata) return;

    if (strategy.type === 'report') {
      this.setState({ showReportModal: true });
      return;
    }

    this.setState({ isRecovering: true });
    
    try {
      const success = await errorService.executeRecovery(this.state.metadata, strategy);
      
      if (success && strategy.type === 'retry') {
        // For retry strategies, reset the error state
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          metadata: null,
          isRecovering: false,
          recoveryAttempts: this.state.recoveryAttempts + 1,
          lastRecoveryAttempt: Date.now()
        });

        if (this.props.onRecover && this.state.metadata) {
          this.props.onRecover(this.state.metadata);
        }
      } else {
        this.setState({ isRecovering: false });
      }
    } catch (error) {
      console.error('Recovery strategy failed:', error);
      this.setState({ isRecovering: false });
    }
  };

  // Handle error reporting
  private handleReportSubmit = async (userDescription: string, reproductionSteps: string[]) => {
    if (!this.state.metadata || !this.state.error) return;

    try {
      const context = await import('../../utils/errorUtils').then(m => m.collectErrorContext());
      
      await import('../../utils/errorUtils').then(m => m.reportError({
        error: this.state.error!,
        metadata: this.state.metadata!,
        context,
        userDescription,
        reproductionSteps
      }));

      this.setState({ showReportModal: false });
      
      // Show success message
      console.log('Error reported successfully');
    } catch (error) {
      console.error('Failed to submit error report:', error);
    }
  };

  // Analytics methods
  private trackAnalytics = (event: string, properties?: Record<string, any>) => {
    // Integrate with your analytics service here
    console.log('Analytics:', event, properties);
  };

  private identifyUser = (userId: string, properties?: Record<string, any>) => {
    // Integrate with your user identification system
    console.log('Identify user:', userId, properties);
  };

  private incrementMetric = (metric: string, value: number = 1) => {
    // Integrate with your metrics system
    console.log('Increment metric:', metric, value);
  };

  private trackTiming = (metric: string, duration: number) => {
    // Integrate with your performance tracking
    console.log('Track timing:', metric, duration);
  };

  private renderErrorFallback() {
    const { error, errorInfo, metadata, isRecovering, showReportModal } = this.state;
    const { level = 'global', enableReporting = true } = this.props;

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <>
        <ErrorFallbackUI
          ref={this._errorContainerRef}
          error={error}
          errorInfo={errorInfo}
          metadata={metadata}
          level={level}
          isRecovering={isRecovering}
          onRecoveryStrategy={this.handleRecoveryStrategy}
          onReload={this.handleReload}
          enableReporting={enableReporting}
        />
        
        {showReportModal && metadata && (
          <ErrorReportModal
            metadata={metadata}
            onSubmit={this.handleReportSubmit}
            onClose={() => this.setState({ showReportModal: false })}
          />
        )}
      </>
    );
  }

  componentWillUnmount() {
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
    }
    if (this._focusTimeoutRef) {
      clearTimeout(this._focusTimeoutRef);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.renderErrorFallback();
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;