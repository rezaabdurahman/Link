import { http } from 'msw';
import {
  ConversationsResponse,
  Conversation,
  ConversationParticipant,
  ConversationMessage,
  MessagesResponse,
  CreateConversationRequest
} from '../../services/chatClient';
import { chats, nearbyUsers } from '../../data/mockData';
import { getDisplayName } from '../../utils/nameHelpers';
import { extractUserId, generateId, now, parsePaginationParams, simulateDelay } from '../utils/mockHelpers';
import { createAuthError, createValidationError, createSuccessResponse } from '../utils/responseBuilders';
import { buildApiUrl, API_ENDPOINTS } from '../utils/config';

// Helper function to convert UI Chat to API Conversation
const convertChatToConversation = (chat: typeof chats[0]): Conversation => {
  const conversationParticipant: ConversationParticipant = {
    id: chat.participantId,
    name: chat.participantName,
    avatar: chat.participantAvatar,
  };

  return {
    id: chat.id,
    type: 'direct',
    is_private: false,
    created_by: '1', // Current user
    participants: [conversationParticipant],
    unread_count: chat.unreadCount,
    last_message: {
      id: chat.lastMessage.id,
      content: chat.lastMessage.content,
      message_type: chat.lastMessage.type as 'text',
      sender_id: chat.lastMessage.senderId,
      created_at: chat.lastMessage.timestamp.toISOString(),
    },
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    updated_at: chat.lastMessage.timestamp.toISOString(),
  };
};

export const handlers = [
  // GET /chat/conversations - Get user's conversations
  http.get(buildApiUrl(API_ENDPOINTS.CHAT.conversations), ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    const url = new URL(request.url);
    const { limit, offset } = parsePaginationParams(url);

    // Convert mock chats to API conversations
    const conversations = chats.map(convertChatToConversation);
    const totalCount = conversations.length;
    const paginatedConversations = conversations.slice(offset, offset + limit);

    const response: ConversationsResponse = {
      data: paginatedConversations,
      total: totalCount,
      limit,
      offset,
      has_more: offset + limit < totalCount,
    };

    return createSuccessResponse(response);
  }),

  // POST /chat/conversations - Create new conversation
  http.post(buildApiUrl(API_ENDPOINTS.CHAT.conversations), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as CreateConversationRequest;
      
      // Create new conversation
      const conversationId = generateId();
      const participantId = body.participant_ids[0];
      const participant = nearbyUsers.find(user => user.id === participantId);
      
      const conversation: Conversation = {
        id: conversationId,
        type: body.type,
        name: body.name,
        description: body.description,
        is_private: body.is_private || false,
        max_members: body.max_members,
        created_by: userId,
        participants: [{
          id: participantId,
          name: participant ? getDisplayName(participant) : 'Unknown User',
          avatar: participant?.profilePicture,
        }],
        unread_count: 0,
        created_at: now(),
        updated_at: now(),
      };

      return createSuccessResponse(conversation, 201);
    } catch (error) {
      return createValidationError('Failed to parse conversation creation request');
    }
  }),

  // GET /chat/conversations/:conversationId/messages - Get conversation messages
  http.get(buildApiUrl('/chat/conversations/:conversationId/messages'), ({ params, request }) => {
    const userId = extractUserId(request);
    const { conversationId } = params;
    
    if (!userId) {
      return createAuthError();
    }

    const url = new URL(request.url);
    const { limit, offset } = parsePaginationParams(url);

    // Mock messages for the conversation
    const mockMessages: ConversationMessage[] = [
      {
        id: 'msg-1',
        content: 'Hey there! How are you doing?',
        message_type: 'text',
        sender_id: conversationId === 'chat1' ? '2' : '4',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-2',
        content: 'I\'m doing great! Thanks for asking. What about you?',
        message_type: 'text',
        sender_id: '1', // Current user
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-3',
        content: 'Fantastic! Looking forward to hanging out soon.',
        message_type: 'text',
        sender_id: conversationId === 'chat1' ? '2' : '4',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ];
    
    const totalCount = mockMessages.length;
    const paginatedMessages = mockMessages.slice(offset, offset + limit);

    const response: MessagesResponse = {
      data: paginatedMessages,
      total: totalCount,
      limit,
      offset,
      has_more: offset + limit < totalCount,
    };

    return createSuccessResponse(response);
  }),

  // POST /chat/messages - Send a message
  http.post(buildApiUrl(API_ENDPOINTS.CHAT.messages), async ({ request }) => {
    const userId = extractUserId(request);
    
    if (!userId) {
      return createAuthError();
    }

    try {
      const body = await request.json() as {
        conversation_id: string;
        content: string;
        message_type: 'text';
        parent_id?: string;
      };
      
      const message: ConversationMessage = {
        id: generateId(),
        content: body.content,
        message_type: body.message_type,
        sender_id: userId,
        created_at: now(),
        parent_id: body.parent_id || null,
      };

      // Simulate network delay
      await simulateDelay(200);

      return createSuccessResponse(message, 201);
    } catch (error) {
      return createValidationError('Failed to parse message send request');
    }
  }),
];
