import React, { ErrorInfo, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import * as Sentry from '@sentry/react';
import { ErrorMetadata, RecoveryStrategy, ErrorBoundaryState } from '../../utils/errorTypes';
import { errorService } from '../../services/errorService';
import { ErrorFallbackUI } from './ErrorFallbackUI';
import { ErrorReportModal } from './ErrorReportModal';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  routeName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo, metadata: ErrorMetadata) => void;
  onRecover?: (metadata: ErrorMetadata) => void;
  enableReporting?: boolean;
  maxRetries?: number;
}

interface State extends ErrorBoundaryState {
  showReportModal: boolean;
  isRecovering: boolean;
  lastRecoveryAttempt: number;
}

class RouteErrorBoundaryClass extends React.Component<Props & { navigate: (path: string) => void; location: any }, State> {
  private _focusTimeoutRef: NodeJS.Timeout | null = null;
  private _errorContainerRef = React.createRef<HTMLDivElement>();

  constructor(props: Props & { navigate: (path: string) => void; location: any }) {
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
        navigate: this.props.navigate,
        reload: () => window.location.reload(),
        retry: this.handleRetry
      });

      // Add route-specific context
      metadata.context = {
        ...metadata.context,
        route: this.props.location.pathname,
        routeName: this.props.routeName,
        search: this.props.location.search,
        state: this.props.location.state
      };

      this.setState({
        errorInfo,
        metadata
      });

      // Call custom error handler if provided
      if (this.props.onError) {
        this.props.onError(error, errorInfo, metadata);
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.group('🚨 Route Error Boundary Caught Error');
        console.error('Error:', error);
        console.error('Route:', this.props.location.pathname);
        console.error('Error Type:', metadata.type);
        console.error('Severity:', metadata.severity);
        console.error('Metadata:', metadata);
        console.groupEnd();
      }

      // Focus management for accessibility
      this.manageFocus();
      
    } catch (handlingError) {
      console.error('Failed to handle route error:', handlingError);
      
      // Fallback to basic state update
      this.setState({
        errorInfo,
        metadata: null
      });
    }
  }

  componentDidUpdate(prevProps: Props & { navigate: (path: string) => void; location: any }) {
    // Reset error state when route changes
    if (prevProps.location.pathname !== this.props.location.pathname) {
      if (this.state.hasError) {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          metadata: null,
          retryAttempts: 0,
          recoveryAttempts: 0,
          showReportModal: false,
          isRecovering: false,
          lastErrorTime: 0,
          lastRecoveryAttempt: 0
        });
      }
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
      console.error('Route recovery failed:', recoveryError);
      this.setState({ isRecovering: false });
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
        announcement.textContent = 'A route error has occurred. Recovery options are available.';
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
      
      if (success && (strategy.type === 'retry' || strategy.type === 'navigate')) {
        // For navigation strategies, the component will unmount
        // For retry strategies, reset the error state
        if (strategy.type === 'retry') {
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
      
      console.log('Route error reported successfully');
    } catch (error) {
      console.error('Failed to submit route error report:', error);
    }
  };

  componentWillUnmount() {
    if (this._focusTimeoutRef) {
      clearTimeout(this._focusTimeoutRef);
    }
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, metadata, isRecovering, showReportModal } = this.state;
      const { enableReporting = true } = this.props;

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <>
          <div className="min-h-[400px] flex flex-col justify-center items-center px-4 py-8">
            <ErrorFallbackUI
              ref={this._errorContainerRef}
              error={error}
              errorInfo={errorInfo}
              metadata={metadata}
              level="route"
              isRecovering={isRecovering}
              onRecoveryStrategy={this.handleRecoveryStrategy}
              onReload={() => window.location.reload()}
              enableReporting={enableReporting}
            />
          </div>
          
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

    return this.props.children;
  }
}

// Wrapper component to use React Router hooks
const RouteErrorBoundary: React.FC<Props> = ({ 
  children, 
  fallback, 
  routeName,
  onError,
  onRecover,
  enableReporting,
  maxRetries
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <RouteErrorBoundaryClass
      navigate={navigate}
      location={location}
      fallback={fallback}
      routeName={routeName}
      onError={onError}
      onRecover={onRecover}
      enableReporting={enableReporting}
      maxRetries={maxRetries}
    >
      {children}
    </RouteErrorBoundaryClass>
  );
};

export default RouteErrorBoundary;