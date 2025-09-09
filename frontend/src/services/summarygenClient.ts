// Summary generation service layer for API interactions
// Provides AI-powered conversation summaries

import { apiClient } from './authClient';

// Base API URL from environment variables
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080';

// API endpoints
const SUMMARYGEN_ENDPOINTS = {
  conversationSummary: (conversationId: string) => `/summarygen/conversations/${conversationId}/summary`,
  generateSummary: '/summarygen/summary/generate',
  // Cue card endpoints
  generateCueCards: '/ai/cue-cards/generate',
  generateMessage: '/ai/cue-cards/generate-message',
  analyzeTonality: '/ai/tonality/analyze',
} as const;

// Legacy AI endpoints for backward compatibility (deprecated - use SUMMARYGEN_ENDPOINTS)
const AI_ENDPOINTS = {
  conversationSummary: (conversationId: string) => `/summarygen/conversations/${conversationId}/summary`,
  generateSummary: '/summarygen/summary/generate',
} as const;

// Request/Response types

export interface ConversationSummaryRequest {
  conversation_id: string;
  max_length?: number; // Optional character limit for summary
  include_sentiment?: boolean; // Whether to include sentiment analysis
}

export interface ConversationSummaryResponse {
  conversation_id: string;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  key_topics?: string[];
  generated_at: string; // ISO timestamp
  confidence_score?: number; // 0-1, how confident the AI is in the summary
}

export interface GenerateSummaryRequest {
  messages: Array<{
    content: string;
    sender_id: string;
    timestamp: string;
  }>;
  max_length?: number;
  include_sentiment?: boolean;
}

// AI service functions

/**
 * Get or generate a conversation summary
 * @param conversationId - ID of the conversation to summarize
 * @param options - Summary generation options
 * @returns Promise resolving to conversation summary
 */
export async function getConversationSummary(
  conversationId: string,
  options?: {
    max_length?: number;
    include_sentiment?: boolean;
    force_refresh?: boolean; // Force re-generation even if cached
  }
): Promise<ConversationSummaryResponse> {
  const params = new URLSearchParams();
  if (options?.max_length) params.append('max_length', options.max_length.toString());
  if (options?.include_sentiment) params.append('include_sentiment', 'true');
  if (options?.force_refresh) params.append('force_refresh', 'true');
  
  const queryString = params.toString();
  const endpoint = queryString 
    ? `${SUMMARYGEN_ENDPOINTS.conversationSummary(conversationId)}?${queryString}` 
    : SUMMARYGEN_ENDPOINTS.conversationSummary(conversationId);
  
  return apiClient.get<ConversationSummaryResponse>(endpoint);
}

/**
 * Generate a summary from a list of messages
 * @param request - Messages and options for summary generation
 * @returns Promise resolving to generated summary
 */
export async function generateSummary(request: GenerateSummaryRequest): Promise<ConversationSummaryResponse> {
  return apiClient.post<ConversationSummaryResponse>(SUMMARYGEN_ENDPOINTS.generateSummary, request);
}

/**
 * Get conversation summary with graceful fallback
 * This function provides a safe way to get summaries with fallback handling
 * @param conversationId - ID of the conversation
 * @param fallbackSummary - Fallback text to use if AI service fails
 * @returns Promise resolving to summary string (never throws)
 */
export async function getConversationSummaryWithFallback(
  conversationId: string,
  fallbackSummary: string = 'No summary available'
): Promise<string> {
  try {
    const response = await getConversationSummary(conversationId, {
      max_length: 100, // Keep summaries short for UI display
      include_sentiment: false, // Skip sentiment for performance
    });
    
    return response.summary || fallbackSummary;
  } catch (error) {
    // Log error but don't throw - graceful degradation
    console.warn(`Failed to get conversation summary for ${conversationId}:`, error);
    return fallbackSummary;
  }
}

/**
 * Batch get summaries for multiple conversations
 * Optimized for displaying conversation lists
 * @param conversationIds - Array of conversation IDs
 * @returns Promise resolving to map of conversationId -> summary
 */
export async function getBatchConversationSummaries(
  conversationIds: string[]
): Promise<Record<string, string>> {
  const summaryPromises = conversationIds.map(async (id) => {
    const summary = await getConversationSummaryWithFallback(id, '');
    return { id, summary };
  });
  
  try {
    // Execute all requests concurrently but with individual error handling
    const results = await Promise.all(summaryPromises);
    
    // Convert to object map
    return results.reduce((acc, { id, summary }) => {
      acc[id] = summary;
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    console.error('Failed to get batch conversation summaries:', error);
    // Return empty map on failure
    return {};
  }
}

// Utility functions for AI service error handling

export interface AIServiceError {
  type: 'AI_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'INVALID_REQUEST' | 'UNKNOWN';
  message: string;
  code?: string;
}

/**
 * Check if an error is related to AI service availability
 */
export function isAIServiceError(error: unknown): error is AIServiceError {
  return typeof error === 'object' && 
         error !== null && 
         'type' in error && 
         typeof (error as AIServiceError).type === 'string';
}

/**
 * Get user-friendly message for AI service errors
 */
export function getAIErrorMessage(error: AIServiceError): string {
  switch (error.type) {
    case 'AI_UNAVAILABLE':
      return 'AI summary service is currently unavailable';
    case 'QUOTA_EXCEEDED':
      return 'AI summary quota exceeded, please try again later';
    case 'INVALID_REQUEST':
      return 'Unable to generate summary for this conversation';
    default:
      return 'Failed to generate conversation summary';
  }
}

// === CUE CARD FUNCTIONALITY ===

// Types for cue cards
export interface CueCard {
  id: string;
  prompt_text: string;
  category: 'question' | 'activity' | 'follow-up' | 'interest' | 'plans' | 'emoji';
  relevance_score: number;
  metadata?: {
    reasoning?: string;
    context_signals?: string[];
    tone_adjustment?: string;
  };
}

export interface TonalityProfile {
  user_id: string;
  conversation_id?: string;
  formality_score: number;    // 0.0 (casual) to 1.0 (formal)
  enthusiasm_score: number;   // 0.0 (reserved) to 1.0 (enthusiastic)
  brevity_score: number;      // 0.0 (verbose) to 1.0 (concise)
  common_phrases: string[];
  emoji_usage: Record<string, number>;
  pattern_confidence: Record<string, number>;
}

export interface UserContext {
  interests: string[];
  communication_style?: string;
  topic_preferences?: Record<string, number>;
  tonality_profile?: TonalityProfile;
}

export type CueCardGenerationMode = 'contextual' | 'cold_start' | 're_engagement';

export interface GenerateCueCardsRequest {
  conversation_id: string;
  recent_messages: Array<{
    id: string;
    sender_id: string;
    content: string;
    timestamp: number;
    metadata?: Record<string, string>;
  }>;
  user_context: UserContext;
  card_count?: number;
  mode?: CueCardGenerationMode;
}

export interface GenerateCueCardsResponse {
  cue_cards: CueCard[];
  tonality_analysis?: TonalityProfile;
  processing_time_ms?: number;
  tokens_used?: number;
}

export interface GenerateMessageRequest {
  conversation_id: string;
  selected_card: CueCard;
  user_tonality?: TonalityProfile;
  conversation_tonality?: TonalityProfile;
  apply_tonality_adjustment?: boolean;
}

export interface TonalityAdjustments {
  original_tone: string;
  adjusted_tone: string;
  modifications: string[];
}

export interface GenerateMessageResponse {
  message: string;
  adjustments_applied?: TonalityAdjustments;
  confidence_score: number;
  processing_time_ms?: number;
  tokens_used?: number;
}

export interface AnalyzeTonalityRequest {
  user_id: string;
  messages: Array<{
    id: string;
    sender_id: string;
    content: string;
    timestamp: number;
    metadata?: Record<string, string>;
  }>;
  scope?: 'conversation_specific' | 'user_general' | 'mutual_adaptation';
}

export interface TonalityInsight {
  type: string;
  observation: string;
  confidence: number;
}

export interface AnalyzeTonalityResponse {
  profile: TonalityProfile;
  pattern_confidence: Record<string, number>;
  insights: TonalityInsight[];
  processing_time_ms?: number;
}

// Cue Card API Functions

/**
 * Generate contextual conversation cue cards
 * @param request - Cue card generation request
 * @returns Promise resolving to generated cue cards
 */
export async function generateCueCards(request: GenerateCueCardsRequest): Promise<GenerateCueCardsResponse> {
  try {
    const response = await apiClient.post<GenerateCueCardsResponse>(
      SUMMARYGEN_ENDPOINTS.generateCueCards,
      {
        ...request,
        card_count: request.card_count || 3,
        mode: request.mode || 'contextual'
      }
    );
    
    return response;
  } catch (error) {
    console.error('Failed to generate cue cards:', error);
    // Return fallback cue cards
    return getFallbackCueCards();
  }
}

/**
 * Generate a message from a selected cue card with tonality adjustment
 * @param request - Message generation request
 * @returns Promise resolving to generated message
 */
export async function generateMessageFromCue(request: GenerateMessageRequest): Promise<GenerateMessageResponse> {
  try {
    const response = await apiClient.post<GenerateMessageResponse>(
      SUMMARYGEN_ENDPOINTS.generateMessage,
      {
        ...request,
        apply_tonality_adjustment: request.apply_tonality_adjustment ?? true
      }
    );
    
    return response;
  } catch (error) {
    console.error('Failed to generate message from cue:', error);
    // Return fallback message
    return {
      message: request.selected_card.prompt_text,
      confidence_score: 0.5,
      adjustments_applied: undefined
    };
  }
}

/**
 * Analyze user communication tonality patterns
 * @param request - Tonality analysis request
 * @returns Promise resolving to tonality analysis
 */
export async function analyzeTonality(request: AnalyzeTonalityRequest): Promise<AnalyzeTonalityResponse> {
  return apiClient.post<AnalyzeTonalityResponse>(SUMMARYGEN_ENDPOINTS.analyzeTonality, {
    ...request,
    scope: request.scope || 'user_general'
  });
}

/**
 * Get fallback cue cards when AI service is unavailable
 */
function getFallbackCueCards(): GenerateCueCardsResponse {
  return {
    cue_cards: [
      {
        id: 'fallback_1',
        prompt_text: "How's your day going?",
        category: 'question',
        relevance_score: 0.6,
        metadata: {
          reasoning: 'Generic conversation starter',
          context_signals: ['fallback'],
          tone_adjustment: 'neutral'
        }
      },
      {
        id: 'fallback_2',
        prompt_text: "What are you up to?",
        category: 'question',
        relevance_score: 0.6,
        metadata: {
          reasoning: 'Simple activity inquiry',
          context_signals: ['fallback'],
          tone_adjustment: 'casual'
        }
      },
      {
        id: 'fallback_3',
        prompt_text: "That sounds great!",
        category: 'follow-up',
        relevance_score: 0.5,
        metadata: {
          reasoning: 'Positive response',
          context_signals: ['fallback'],
          tone_adjustment: 'enthusiastic'
        }
      }
    ],
    processing_time_ms: 0,
    tokens_used: 0
  };
}

// Utility functions for cue cards

/**
 * Determine the appropriate generation mode based on conversation state
 * @param messages - Recent conversation messages
 * @param lastMessageTime - Timestamp of the last message
 * @returns Appropriate generation mode
 */
export function determineCueCardMode(
  messages: Array<{ timestamp: number }>,
  lastMessageTime?: number
): CueCardGenerationMode {
  if (!messages.length) {
    return 'cold_start';
  }
  
  const now = Date.now();
  const lastTime = lastMessageTime || messages[messages.length - 1]?.timestamp;
  
  if (lastTime) {
    const hoursSinceLastMessage = (now - lastTime * 1000) / (1000 * 60 * 60);
    if (hoursSinceLastMessage > 24) {
      return 're_engagement';
    }
  }
  
  return 'contextual';
}

/**
 * Build user context from available user data
 * @param user - User data
 * @param tonalityProfile - Optional existing tonality profile
 * @returns User context for cue card generation
 */
export function buildUserContext(
  user: { interests?: string[] } | null,
  tonalityProfile?: TonalityProfile
): UserContext {
  return {
    interests: user?.interests || [],
    communication_style: tonalityProfile ? describeTonalityProfile(tonalityProfile) : undefined,
    topic_preferences: {},
    tonality_profile: tonalityProfile
  };
}

/**
 * Describe a tonality profile in human-readable terms
 */
function describeTonalityProfile(profile: TonalityProfile): string {
  const traits: string[] = [];
  
  if (profile.formality_score < 0.3) {
    traits.push('casual');
  } else if (profile.formality_score > 0.7) {
    traits.push('formal');
  }
  
  if (profile.enthusiasm_score > 0.7) {
    traits.push('enthusiastic');
  } else if (profile.enthusiasm_score < 0.3) {
    traits.push('reserved');
  }
  
  if (profile.brevity_score > 0.7) {
    traits.push('concise');
  } else if (profile.brevity_score < 0.3) {
    traits.push('detailed');
  }
  
  return traits.length > 0 ? traits.join(', ') : 'balanced';
}

/**
 * Cache cue cards locally for performance
 * @param conversationId - Conversation ID
 * @param cueCards - Cue cards to cache
 */
export function cacheCueCardsLocally(conversationId: string, cueCards: CueCard[]): void {
  try {
    const cacheKey = `cue_cards_${conversationId}`;
    const cacheData = {
      cue_cards: cueCards,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache cue cards locally:', error);
  }
}

/**
 * Get cached cue cards if available and fresh
 * @param conversationId - Conversation ID
 * @returns Cached cue cards or null if not available/expired
 */
export function getCachedCueCards(conversationId: string): CueCard[] | null {
  try {
    const cacheKey = `cue_cards_${conversationId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const cacheData = JSON.parse(cached);
    const cacheAge = Date.now() - cacheData.timestamp;
    
    // Cache expires after 5 minutes
    if (cacheAge > 5 * 60 * 1000) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return cacheData.cue_cards;
  } catch (error) {
    console.warn('Failed to get cached cue cards:', error);
    return null;
  }
}
