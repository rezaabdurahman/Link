import { ErrorInfo } from 'react';

export enum ErrorType {
  RUNTIME = 'runtime',
  NETWORK = 'network',
  CHUNK_LOADING = 'chunk_loading',
  PERMISSION = 'permission',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  ASYNC = 'async',
  ROUTE = 'route',
  COMPONENT = 'component',
  GLOBAL = 'global',
  NOT_FOUND = 'not_found',
  PERFORMANCE = 'performance',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorMetadata {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  timestamp: number;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  buildVersion?: string;
  fingerprint: string;
  message?: string;
  context?: Record<string, any>;
  stackTrace?: string;
  componentStack?: string;
  retryCount: number;
  maxRetries: number;
  isRecoverable: boolean;
  recoveryStrategies: RecoveryStrategy[];
  tags: Record<string, string>;
}

export interface RecoveryStrategy {
  type: 'retry' | 'refresh' | 'navigate' | 'fallback' | 'report';
  label: string;
  description: string;
  action: () => void | Promise<void>;
  priority: number;
  conditions?: string[];
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  metadata: ErrorMetadata | null;
  retryAttempts: number;
  lastErrorTime: number;
  recoveryAttempts: number;
}

export interface ErrorContextData {
  route?: string;
  routeName?: string;
  userId?: string;
  sessionId?: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  connection?: {
    type: string;
    downlink?: number;
    rtt?: number;
  };
  performance?: {
    memory?: any;
    timing?: any;
  };
  featureFlags?: Record<string, boolean>;
  experiments?: string[];
}

export interface ErrorReportData {
  error: Error;
  metadata: ErrorMetadata;
  context: ErrorContextData;
  reproductionSteps?: string[];
  userDescription?: string;
  attachments?: File[];
}

export interface ErrorBoundaryConfig {
  level: 'global' | 'route' | 'component' | 'async';
  maxRetries: number;
  retryDelay: number;
  enableReporting: boolean;
  enableAnalytics: boolean;
  fallbackComponent?: React.ComponentType<any>;
  onError?: (error: Error, metadata: ErrorMetadata) => void;
  onRecover?: (metadata: ErrorMetadata) => void;
  ignoredErrors?: (string | RegExp)[];
  customRecoveryStrategies?: RecoveryStrategy[];
}

export interface ErrorAnalytics {
  track: (event: string, properties?: Record<string, any>) => void;
  identify: (userId: string, properties?: Record<string, any>) => void;
  increment: (metric: string, value?: number) => void;
  timing: (metric: string, duration: number) => void;
}

export interface NetworkErrorDetails {
  status?: number;
  statusText?: string;
  url: string;
  method?: string;
  timeout?: boolean;
  offline?: boolean;
  cors?: boolean;
}

export interface ChunkLoadingErrorDetails {
  chunkName?: string;
  chunkId?: string;
  publicPath?: string;
  attemptedUrls?: string[];
  networkStatus: 'online' | 'offline';
  cacheStatus?: 'miss' | 'stale' | 'error';
}