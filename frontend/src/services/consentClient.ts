import { apiClient } from './index';
import { ConsentType } from '../types/consent';
import { getCurrentUserId } from '../utils/authUtils';

// API Response Types
export interface ConsentResponse {
  user_id: string;
  consent_type: string;
  granted: boolean;
  expires_at?: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface UserConsentsResponse {
  user_id: string;
  consents: ConsentResponse[];
  total_count: number;
}

export interface ConsentHistoryResponse {
  entries: ConsentHistoryEntry[];
  total_count: number;
  has_more: boolean;
}

export interface ConsentHistoryEntry {
  id: string;
  user_id: string;
  consent_type: string;
  granted: boolean;
  previous_value?: boolean;
  source: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ConsentTypesResponse {
  consent_types: ConsentTypeInfo[];
}

export interface ConsentTypeInfo {
  key: string;
  name: string;
  description: string;
  required: boolean;
  category: string;
  legal_basis?: string;
  retention_period?: string;
}

// Request Types
export interface ConsentUpdateRequest {
  granted: boolean;
  source?: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

export interface BatchConsentRequest {
  consents: {
    consent_type: string;
    granted: boolean;
    source?: string;
    expires_at?: string;
    metadata?: Record<string, any>;
  }[];
  source?: string;
}

export interface ConsentCheckRequest {
  user_id: string;
  consent_types: string[];
}

export interface ConsentCheckResponse {
  user_id: string;
  consents: Record<string, boolean>;
  missing_consents: string[];
  expired_consents: string[];
}

/**
 * Consent API Client
 * Handles all consent-related API operations
 */
class ConsentClient {
  private baseURL = '/api/consent/v1';

  /**
   * Update a specific consent for the current user
   */
  async updateConsent(consentType: ConsentType, request: ConsentUpdateRequest): Promise<ConsentResponse> {
    const userId = getCurrentUserId();
    const response = await apiClient.post(`${this.baseURL}/consents/${userId}/${consentType}`, request);
    return response as ConsentResponse;
  }

  /**
   * Update multiple consents for the current user in a batch operation
   */
  async updateBatchConsents(request: BatchConsentRequest): Promise<{ consents: ConsentResponse[]; failed_consents?: any[] }> {
    const userId = getCurrentUserId();
    const response = await apiClient.post(`${this.baseURL}/consents/${userId}/batch`, request);
    return response as { consents: ConsentResponse[]; failed_consents?: any[] };
  }

  /**
   * Get a specific consent for the current user
   */
  async getUserConsent(consentType: ConsentType): Promise<ConsentResponse> {
    const userId = getCurrentUserId();
    const response = await apiClient.get(`${this.baseURL}/consents/${userId}/${consentType}`);
    return response as ConsentResponse;
  }

  /**
   * Get all consents for the current user
   */
  async getUserConsents(): Promise<UserConsentsResponse> {
    const userId = getCurrentUserId();
    const response = await apiClient.get(`${this.baseURL}/consents/${userId}`);
    return response as UserConsentsResponse;
  }

  /**
   * Revoke all consents for the current user
   */
  async revokeAllConsents(): Promise<{ message: string; user_id: string }> {
    const userId = getCurrentUserId();
    const response = await apiClient.delete(`${this.baseURL}/consents/${userId}`);
    return response as { message: string; user_id: string };
  }

  /**
   * Check multiple consent types for the current user
   */
  async checkConsents(consentTypes: ConsentType[]): Promise<ConsentCheckResponse> {
    const userId = getCurrentUserId();
    const response = await apiClient.post(`${this.baseURL}/consents/check`, {
      user_id: userId,
      consent_types: consentTypes
    });
    return response as ConsentCheckResponse;
  }

  /**
   * Get consent history for the current user
   */
  async getConsentHistory(limit = 50, offset = 0): Promise<ConsentHistoryResponse> {
    const userId = getCurrentUserId();
    const response = await apiClient.get(`${this.baseURL}/consents/${userId}/history?limit=${limit}&offset=${offset}`);
    return response as ConsentHistoryResponse;
  }

  /**
   * Get available consent types (public endpoint)
   */
  async getConsentTypes(): Promise<ConsentTypesResponse> {
    const response = await apiClient.get(`${this.baseURL}/consent-types`);
    return response as ConsentTypesResponse;
  }

  /**
   * Get current privacy policy (public endpoint)
   */
  async getPrivacyPolicy(): Promise<any> {
    const response = await apiClient.get(`${this.baseURL}/privacy-policy`);
    return response as any;
  }

  // Convenience methods for common consent operations

  /**
   * Check if user has granted AI processing consent
   */
  async hasAIProcessingConsent(): Promise<boolean> {
    try {
      const response = await this.checkConsents([ConsentType.AI_PROCESSING]);
      return response.consents[ConsentType.AI_PROCESSING] || false;
    } catch (error) {
      console.error('Failed to check AI processing consent:', error);
      return false;
    }
  }

  /**
   * Check if user has granted data anonymization consent
   */
  async hasDataAnonymizationConsent(): Promise<boolean> {
    try {
      const response = await this.checkConsents([ConsentType.DATA_ANONYMIZATION]);
      return response.consents[ConsentType.DATA_ANONYMIZATION] || false;
    } catch (error) {
      console.error('Failed to check data anonymization consent:', error);
      return false;
    }
  }

  /**
   * Grant AI processing consent
   */
  async grantAIProcessingConsent(source = 'user_action'): Promise<ConsentResponse> {
    return this.updateConsent(ConsentType.AI_PROCESSING, {
      granted: true,
      source,
      metadata: {
        granted_at: new Date().toISOString(),
        ip_address: 'client_ip' // Will be filled by backend
      }
    });
  }

  /**
   * Revoke AI processing consent
   */
  async revokeAIProcessingConsent(source = 'user_action'): Promise<ConsentResponse> {
    return this.updateConsent(ConsentType.AI_PROCESSING, {
      granted: false,
      source,
      metadata: {
        revoked_at: new Date().toISOString(),
        ip_address: 'client_ip' // Will be filled by backend
      }
    });
  }

  /**
   * Grant data anonymization consent
   */
  async grantDataAnonymizationConsent(source = 'user_action'): Promise<ConsentResponse> {
    return this.updateConsent(ConsentType.DATA_ANONYMIZATION, {
      granted: true,
      source,
      metadata: {
        granted_at: new Date().toISOString(),
        ip_address: 'client_ip' // Will be filled by backend
      }
    });
  }

  /**
   * Revoke data anonymization consent
   */
  async revokeDataAnonymizationConsent(source = 'user_action'): Promise<ConsentResponse> {
    return this.updateConsent(ConsentType.DATA_ANONYMIZATION, {
      granted: false,
      source,
      metadata: {
        revoked_at: new Date().toISOString(),
        ip_address: 'client_ip' // Will be filled by backend
      }
    });
  }

  /**
   * Initialize default consents for new user (onboarding)
   */
  async initializeDefaultConsents(): Promise<{ consents: ConsentResponse[]; failed_consents?: any[] }> {
    return this.updateBatchConsents({
      consents: [
        {
          consent_type: ConsentType.AI_PROCESSING,
          granted: false, // Default to false, user must explicitly opt-in
          source: 'onboarding'
        },
        {
          consent_type: ConsentType.DATA_ANONYMIZATION,
          granted: true, // Default to true for better privacy
          source: 'onboarding'
        }
      ],
      source: 'onboarding'
    });
  }
}

// Export singleton instance
export const consentClient = new ConsentClient();
export default consentClient;