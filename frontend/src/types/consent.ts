// Consent Type Enum
export enum ConsentType {
  AI_PROCESSING = 'ai_processing',
  DATA_ANONYMIZATION = 'data_anonymization',
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  PERSONALIZATION = 'personalization'
}

// Consent Source Enum
export enum ConsentSource {
  USER_ACTION = 'user_action',
  ONBOARDING = 'onboarding', 
  SETTINGS = 'settings',
  API = 'api',
  ADMIN = 'admin',
  SYSTEM = 'system'
}

// Consent Status Enum
export enum ConsentStatus {
  GRANTED = 'granted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
  PENDING = 'pending'
}

// Base Consent Interface
export interface Consent {
  id?: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  source: ConsentSource;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Consent State for UI
export interface ConsentState {
  aiProcessing: boolean;
  dataAnonymization: boolean;
  marketing: boolean;
  analytics: boolean;
  personalization: boolean;
  loading: boolean;
  error: string | null;
}

// Consent Toggle Props
export interface ConsentToggleProps {
  consentType: ConsentType;
  label: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  value: boolean;
  onChange: (granted: boolean) => void;
  loading?: boolean;
  error?: string;
}

// AI Consent Modal Props
export interface AIConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  loading?: boolean;
  showDataAnonymization?: boolean;
}

// Consent History Entry
export interface ConsentHistoryEntry {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  previousValue?: boolean;
  source: ConsentSource;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// Consent Type Info
export interface ConsentTypeInfo {
  key: ConsentType;
  name: string;
  description: string;
  required: boolean;
  category: ConsentCategory;
  legalBasis?: string;
  retentionPeriod?: string;
  dependencies?: ConsentType[];
}

// Consent Category
export enum ConsentCategory {
  ESSENTIAL = 'essential',
  FUNCTIONAL = 'functional',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  PERSONALIZATION = 'personalization'
}

// Consent Validation Result
export interface ConsentValidationResult {
  valid: boolean;
  missingConsents: ConsentType[];
  expiredConsents: ConsentType[];
  errors: string[];
}

// Consent Context State
export interface ConsentContextState {
  consents: ConsentState;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  // Actions
  updateConsent: (consentType: ConsentType, granted: boolean, source?: ConsentSource) => Promise<void>;
  updateBatchConsents: (updates: Array<{ type: ConsentType; granted: boolean }>, source?: ConsentSource) => Promise<void>;
  checkConsent: (consentType: ConsentType) => boolean;
  checkMultipleConsents: (consentTypes: ConsentType[]) => ConsentValidationResult;
  refreshConsents: () => Promise<void>;
  revokeAllConsents: () => Promise<void>;
  initializeDefaultConsents: () => Promise<void>;
}

// Consent Store State (Zustand)
export interface ConsentStore extends ConsentContextState {
  // Additional store-specific methods
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConsent: (consentType: ConsentType, granted: boolean) => void;
  setConsents: (consents: Partial<ConsentState>) => void;
  reset: () => void;
}

// Consent Hook Return Type
export interface UseConsentReturn {
  consents: ConsentState;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  // Convenience methods
  hasAIProcessingConsent: boolean;
  hasDataAnonymizationConsent: boolean;
  hasMarketingConsent: boolean;
  hasAnalyticsConsent: boolean;
  hasPersonalizationConsent: boolean;
  
  // Actions
  grantAIProcessing: () => Promise<void>;
  revokeAIProcessing: () => Promise<void>;
  grantDataAnonymization: () => Promise<void>;
  revokeDataAnonymization: () => Promise<void>;
  updateConsent: (consentType: ConsentType, granted: boolean, source?: ConsentSource) => Promise<void>;
  refreshConsents: () => Promise<void>;
  initializeDefaults: () => Promise<void>;
}

// Form Data for Consent UI
export interface ConsentFormData {
  aiProcessing: boolean;
  dataAnonymization: boolean;
  marketing: boolean;
  analytics: boolean;
  personalization: boolean;
}

// Consent Banner Configuration
export interface ConsentBannerConfig {
  show: boolean;
  title: string;
  message: string;
  acceptAllText: string;
  rejectAllText: string;
  customizeText: string;
  essentialConsents: ConsentType[];
  optionalConsents: ConsentType[];
}

// Privacy Policy Version
export interface PrivacyPolicyVersion {
  id: string;
  version: string;
  title: string;
  content: string;
  effectiveDate: Date;
  createdAt: Date;
  isActive: boolean;
}

// Consent Audit Log Entry
export interface ConsentAuditEntry {
  id: string;
  userId: string;
  action: 'grant' | 'revoke' | 'update' | 'batch_update' | 'revoke_all';
  consentType?: ConsentType;
  details: Record<string, any>;
  source: ConsentSource;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// GDPR Data Export
export interface GDPRDataExport {
  userId: string;
  exportDate: Date;
  consents: Consent[];
  consentHistory: ConsentHistoryEntry[];
  auditLog: ConsentAuditEntry[];
}

// Error Types
export class ConsentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ConsentError';
  }
}

export class ConsentValidationError extends ConsentError {
  constructor(message: string, public missingConsents: ConsentType[] = []) {
    super(message, 'CONSENT_VALIDATION_ERROR');
    this.name = 'ConsentValidationError';
  }
}

export class ConsentExpiredError extends ConsentError {
  constructor(message: string, public expiredConsents: ConsentType[] = []) {
    super(message, 'CONSENT_EXPIRED_ERROR');
    this.name = 'ConsentExpiredError';
  }
}

// Type Guards
export const isConsentType = (value: string): value is ConsentType => {
  return Object.values(ConsentType).includes(value as ConsentType);
};

export const isConsentSource = (value: string): value is ConsentSource => {
  return Object.values(ConsentSource).includes(value as ConsentSource);
};

export const isConsentCategory = (value: string): value is ConsentCategory => {
  return Object.values(ConsentCategory).includes(value as ConsentCategory);
};

// Default Consent Configuration
export const DEFAULT_CONSENT_CONFIG: Record<ConsentType, ConsentTypeInfo> = {
  [ConsentType.AI_PROCESSING]: {
    key: ConsentType.AI_PROCESSING,
    name: 'AI Processing',
    description: 'Allow AI to process your conversations for generating summaries and insights',
    required: false,
    category: ConsentCategory.FUNCTIONAL,
    legalBasis: 'Consent',
    retentionPeriod: '2 years',
    dependencies: [ConsentType.DATA_ANONYMIZATION]
  },
  [ConsentType.DATA_ANONYMIZATION]: {
    key: ConsentType.DATA_ANONYMIZATION,
    name: 'Data Anonymization',
    description: 'Allow anonymization of your data before AI processing for privacy protection',
    required: false,
    category: ConsentCategory.FUNCTIONAL,
    legalBasis: 'Consent',
    retentionPeriod: 'Processing duration only'
  },
  [ConsentType.MARKETING]: {
    key: ConsentType.MARKETING,
    name: 'Marketing Communications',
    description: 'Receive promotional emails and notifications about new features',
    required: false,
    category: ConsentCategory.MARKETING,
    legalBasis: 'Consent',
    retentionPeriod: 'Until withdrawn'
  },
  [ConsentType.ANALYTICS]: {
    key: ConsentType.ANALYTICS,
    name: 'Analytics',
    description: 'Help improve the app by allowing usage analytics and performance monitoring',
    required: false,
    category: ConsentCategory.ANALYTICS,
    legalBasis: 'Legitimate Interest',
    retentionPeriod: '26 months'
  },
  [ConsentType.PERSONALIZATION]: {
    key: ConsentType.PERSONALIZATION,
    name: 'Personalization',
    description: 'Personalize your experience based on your preferences and activity',
    required: false,
    category: ConsentCategory.PERSONALIZATION,
    legalBasis: 'Consent',
    retentionPeriod: '2 years'
  }
};