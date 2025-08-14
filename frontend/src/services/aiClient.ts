// AI service layer for API interactions
// Provides AI-powered features including conversation summaries

import { apiClient } from './authClient';

// Base API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080';

// API endpoints
const AI_ENDPOINTS = {
  conversationSummary: (conversationId: string) => `/api/v1/ai/conversations/${conversationId}/summary`,
  generateSummary: '/api/v1/ai/summary/generate',
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
    ? `${AI_ENDPOINTS.conversationSummary(conversationId)}?${queryString}` 
    : AI_ENDPOINTS.conversationSummary(conversationId);
  
  return apiClient.get<ConversationSummaryResponse>(endpoint);
}

/**
 * Generate a summary from a list of messages
 * @param request - Messages and options for summary generation
 * @returns Promise resolving to generated summary
 */
export async function generateSummary(request: GenerateSummaryRequest): Promise<ConversationSummaryResponse> {
  return apiClient.post<ConversationSummaryResponse>(AI_ENDPOINTS.generateSummary, request);
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
