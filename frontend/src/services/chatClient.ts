// Chat service layer for API interactions
// Provides conversation and message management with WebSocket support

import { apiClient } from './authClient';

// Base API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080';

// WebSocket URL (convert HTTP to WS)
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

// API endpoints
const CHAT_ENDPOINTS = {
  conversations: '/chat/conversations',
  messages: '/chat/messages',
  conversationMessages: (id: string) => `/chat/conversations/${id}/messages`,
  websocket: (conversationId: string, token: string) => `${WS_BASE_URL}/ws/chat/${conversationId}?token=${token}`,
} as const;

// Request/Response types matching backend API

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface ConversationMessage {
  id: string;
  content: string;
  message_type: 'text' | 'system' | 'context-card' | 'permission-request';
  sender_id: string;
  created_at: string;
  parent_id?: string | null;
}

export interface Conversation {
  id: string;
  name?: string;
  description?: string;
  type: 'direct' | 'group';
  is_private: boolean;
  max_members?: number;
  created_by: string;
  participants: ConversationParticipant[];
  unread_count: number;
  last_message?: ConversationMessage;
  created_at: string;
  updated_at: string;
}

export interface ConversationsResponse {
  data: Conversation[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface MessagesResponse {
  data: ConversationMessage[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface CreateConversationRequest {
  type: 'direct' | 'group';
  name?: string;
  description?: string;
  is_private?: boolean;
  max_members?: number;
  participant_ids: string[];
}

export interface SendMessageRequest {
  conversation_id: string;
  content: string;
  message_type: 'text';
  parent_id?: string | null;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'message' | 'typing' | 'stop_typing' | 'heartbeat';
  message?: {
    content: string;
    message_type: 'text';
    parent_id?: string | null;
  };
}

export interface WebSocketEvent {
  type: 'message' | 'user_joined' | 'user_left' | 'typing' | 'stop_typing';
  room_id: string;
  user_id: string;
  message?: ConversationMessage;
}

// Chat service functions

/**
 * Get user's conversations with pagination
 * @param options - Pagination options
 * @returns Promise resolving to conversations list
 */
export async function getConversations(options?: {
  limit?: number;
  offset?: number;
}): Promise<ConversationsResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  
  const queryString = params.toString();
  const endpoint = queryString ? `${CHAT_ENDPOINTS.conversations}?${queryString}` : CHAT_ENDPOINTS.conversations;
  
  return apiClient.get<ConversationsResponse>(endpoint);
}


/**
 * Create a new conversation
 * @param request - Conversation creation data
 * @returns Promise resolving to created conversation
 */
export async function createConversation(request: CreateConversationRequest): Promise<Conversation> {
  return apiClient.post<Conversation>(CHAT_ENDPOINTS.conversations, request);
}

/**
 * Get or create a direct conversation with a specific user
 * This leverages the backend's "find or create" logic in CreateDirectConversation
 * If a conversation already exists, it returns that. If not, it creates a new one.
 * @param participantId - The ID of the other participant
 * @returns Promise resolving to the conversation (existing or newly created)
 */
export async function getOrCreateDirectConversation(participantId: string): Promise<Conversation | null> {
  try {
    // The backend's CreateDirectConversation is actually "find or create"
    // It will return existing conversation if one exists, or create new one if not
    // This is perfect for our use case and much more efficient than searching
    const conversation = await createConversation({
      type: 'direct',
      participant_ids: [participantId]
    });
    
    return conversation;
  } catch (error) {
    console.error('Failed to find/create direct conversation:', error);
    return null; // Return null on error to allow fallback handling
  }
}

// Backward compatibility aliases
export const findDirectConversation = getOrCreateDirectConversation;

/**
 * Backward compatibility wrapper for conversationToDirectChat
 * @deprecated Use conversationToDirectChat() instead for better type safety
 */
export function conversationToChat(conversation: Conversation): Chat {
  return conversationToDirectChat(conversation);
}

/**
 * Get messages from a conversation
 * @param conversationId - ID of the conversation
 * @param options - Pagination options
 * @returns Promise resolving to messages list
 */
export async function getConversationMessages(
  conversationId: string, 
  options?: {
    limit?: number;
    offset?: number;
    before?: string;
  }
): Promise<MessagesResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.before) params.append('before', options.before);
  
  const queryString = params.toString();
  const endpoint = queryString 
    ? `${CHAT_ENDPOINTS.conversationMessages(conversationId)}?${queryString}` 
    : CHAT_ENDPOINTS.conversationMessages(conversationId);
  
  return apiClient.get<MessagesResponse>(endpoint);
}

/**
 * Send a message to a conversation
 * @param request - Message data
 * @returns Promise resolving to sent message
 */
export async function sendMessage(request: SendMessageRequest): Promise<ConversationMessage> {
  return apiClient.post<ConversationMessage>(CHAT_ENDPOINTS.messages, request);
}

// WebSocket connection management

export class ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private conversationId: string | null = null;
  private token: string | null = null;
  private reconnectInterval: number = 5000;
  private maxReconnectAttempts: number = 5;
  private reconnectAttempts: number = 0;
  private isIntentionallyClosed: boolean = false;

  // Event handlers
  public onMessage: ((event: WebSocketEvent) => void) | null = null;
  public onOpen: (() => void) | null = null;
  public onClose: (() => void) | null = null;
  public onError: ((error: Event) => void) | null = null;
  public onTyping: ((userId: string) => void) | null = null;
  public onStopTyping: ((userId: string) => void) | null = null;
  public onUserJoined: ((userId: string) => void) | null = null;
  public onUserLeft: ((userId: string) => void) | null = null;

  /**
   * Connect to a conversation's WebSocket
   * @param conversationId - ID of the conversation
   * @param token - JWT token for authentication
   */
  connect(conversationId: string, token: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    this.conversationId = conversationId;
    this.token = token;
    this.isIntentionallyClosed = false;
    this.reconnectAttempts = 0;

    this.createConnection();
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message via WebSocket
   * @param content - Message content
   * @param messageType - Type of message (default: 'text')
   * @param parentId - ID of parent message for replies
   */
  sendMessage(content: string, messageType: 'text' = 'text', parentId?: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: 'message',
        message: {
          content,
          message_type: messageType,
          parent_id: parentId || null,
        },
      };

      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = { type: 'typing' };
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send stop typing indicator
   */
  sendStopTyping(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = { type: 'stop_typing' };
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send heartbeat to keep connection alive
   */
  sendHeartbeat(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = { type: 'heartbeat' };
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private createConnection(): void {
    if (!this.conversationId || !this.token) {
      console.error('Cannot create WebSocket connection: missing conversationId or token');
      return;
    }

    try {
      const wsUrl = CHAT_ENDPOINTS.websocket(this.conversationId, this.token);
      this.ws = new WebSocket(wsUrl, ['jwt']);

      this.ws.onopen = () => {
        console.log('WebSocket connected to conversation:', this.conversationId);
        this.reconnectAttempts = 0;
        this.onOpen?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketEvent = JSON.parse(event.data);
          this.handleWebSocketEvent(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.onClose?.();

        // Attempt reconnection if not intentionally closed
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.createConnection(), this.reconnectInterval);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError?.(error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }

  private handleWebSocketEvent(event: WebSocketEvent): void {
    switch (event.type) {
      case 'message':
        this.onMessage?.(event);
        break;
      case 'typing':
        this.onTyping?.(event.user_id);
        break;
      case 'stop_typing':
        this.onStopTyping?.(event.user_id);
        break;
      case 'user_joined':
        this.onUserJoined?.(event.user_id);
        break;
      case 'user_left':
        this.onUserLeft?.(event.user_id);
        break;
      default:
        console.log('Unknown WebSocket event type:', event);
    }
  }
}

// Export singleton instance
export const chatWebSocket = new ChatWebSocketClient();

// Utility functions for converting between API and UI types
import type { Chat, Message } from '../types';

/**
 * Convert a backend Conversation (typically direct) to frontend Chat UI model
 * 
 * This handles the transformation between API data structure and UI component props:
 * - Extracts the "other participant" from participants array (excluding current user)
 * - Converts snake_case API fields to camelCase UI fields
 * - Adds UI-specific properties like priority and friendship status
 * - Provides sensible defaults for missing data
 * 
 * @param conversation - Backend conversation from API
 * @param currentUserId - ID of current user (to filter out from participants)
 * @param options - Additional UI-specific data (isFriend, priority)
 * @returns Chat object optimized for UI components
 */
export function conversationToDirectChat(
  conversation: Conversation, 
  currentUserId?: string,
  options?: {
    isFriend?: boolean;
    priority?: number;
  }
): Chat {
  // For direct conversations, we need to find the "other" participant (not current user)
  let otherParticipant: ConversationParticipant | undefined;
  
  if (currentUserId) {
    // Find the participant who is NOT the current user
    otherParticipant = conversation.participants.find(p => p.id !== currentUserId);
  }
  
  // Fallback: if we can't determine current user, use first participant
  if (!otherParticipant && conversation.participants.length > 0) {
    otherParticipant = conversation.participants[0];
  }
  
  return {
    id: conversation.id,
    participantId: otherParticipant?.id || '',
    participantName: otherParticipant?.name || conversation.name || 'Unknown',
    participantAvatar: otherParticipant?.avatar || '',
    lastMessage: conversation.last_message ? {
      id: conversation.last_message.id,
      senderId: conversation.last_message.sender_id,
      receiverId: '', // Will be filled by the UI context
      content: conversation.last_message.content,
      timestamp: new Date(conversation.last_message.created_at),
      type: conversation.last_message.message_type as Message['type'],
    } : {
      id: '',
      senderId: '',
      receiverId: '',
      content: '',
      timestamp: new Date(),
      type: 'text',
    },
    unreadCount: conversation.unread_count,
    conversationSummary: conversation.description || '',
    priority: options?.priority || 1, // Default priority, can be overridden
    isFriend: options?.isFriend ?? true, // Default to true for existing conversations
  };
}

/**
 * Convert API ConversationMessage to UI Message type
 */
export function apiMessageToUIMessage(apiMessage: ConversationMessage): Message {
  return {
    id: apiMessage.id,
    senderId: apiMessage.sender_id,
    receiverId: '', // Will be filled by UI context
    content: apiMessage.content,
    timestamp: new Date(apiMessage.created_at),
    type: apiMessage.message_type as Message['type'],
  };
}
