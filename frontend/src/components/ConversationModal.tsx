import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Bot, Clock, MapPin, Bookmark, Check, X as XIcon } from 'lucide-react';
import { Message, Chat, User } from '../types';
// import { useFriendRequests } from '../hooks/useFriendRequests';
import { isFeatureEnabled } from '../config/featureFlags';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { 
  getConversationMessages, 
  sendMessage as sendApiMessage, 
  apiMessageToUIMessage, 
  chatWebSocket 
} from '../services/chatClient';
import { getUserCheckIns } from '../services/checkinClient';
import type { CheckIn as BackendCheckIn } from '../services/checkinClient';
import { 
  saveFriendMemory, 
  deleteFriendMemory, 
  getFriendMemories,
  getMemoryErrorMessage,
  type FriendMemoryRequest 
} from '../services/userClient';
import { useAuth } from '../contexts/AuthContext';
import ConversationalCueCards from './ConversationalCueCards';

// Constants
const BOT_SUMMARY_CONSTANTS = {
  MIN_DELAY_MS: 1500,
  MAX_DELAY_MS: 2500,
  CHECKINS_PAGE_SIZE: 5,
  MAX_ACTIVITIES_DISPLAY: 3,
  SUMMARY_TIMESTAMP_OFFSET_MS: 5 * 60 * 1000, // 5 minutes ago
  SHORT_TEXT_LIMIT: 50,
  LONG_TEXT_LIMIT: 80,
} as const;

interface ConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  initialMessage?: string;
  onAddFriend?: () => void;
  isFriend?: boolean;
}

interface BotSummary {
  id: string;
  type: 'summary';
  content: string;
  timestamp: Date;
  activities: Array<{
    type: 'checkin' | 'activity';
    content: string;
    location?: string;
    time: string;
  }>;
}

const ConversationModal: React.FC<ConversationModalProps> = ({ 
  isOpen, 
  onClose, 
  chat, 
  initialMessage
}): JSX.Element => {
  const [messages, setMessages] = useState<(Message | BotSummary)[]>([]);
  const [newMessage, setNewMessage] = useState<string>(initialMessage || '');
  const [user] = useState<User | null>(null);
  const [savedMemories, setSavedMemories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [memoriesLoading, setMemoriesLoading] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [linkBotTyping, setLinkBotTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const botSummaryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user: currentUser, token } = useAuth();
  
  // Feature flag for friend memory functionality
  const isFriendMemoryEnabled = useFeatureFlag('friend_memory_feature');
  
  // Use friendship hook to get real-time friendship status
  // const { getFriendshipStatus } = useFriendRequests();
  // const friendshipStatus = chat?.participantId ? getFriendshipStatus(chat.participantId).status : 'none';
  
  // Determine if users are friends based on real friendship status
  // const areFriends = friendshipStatus === 'friends';
  // const showFriendButton = chat && !areFriends;

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages and setup WebSocket when modal opens
  useEffect(() => {
    if (isOpen && chat && token) {
      loadConversationMessages();
      setupWebSocket();
      loadSavedMemories();
      
      // Set initial message if provided
      if (initialMessage) {
        setNewMessage(initialMessage);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      
      // Cleanup function
      return () => {
        chatWebSocket.disconnect();
        // Clear bot summary timeout if it exists
        if (botSummaryTimeoutRef.current) {
          clearTimeout(botSummaryTimeoutRef.current);
          botSummaryTimeoutRef.current = null;
        }
      };
    }
    // Return undefined cleanup for cases where the effect doesn't run
    return undefined;
  }, [isOpen, chat, initialMessage, token, isFriendMemoryEnabled]);

  // Load existing saved memories for this friend
  const loadSavedMemories = async () => {
    if (!chat?.participantId || !chat.isFriend || !isFriendMemoryEnabled) return;
    
    try {
      setMemoriesLoading(true);
      const memoriesResponse = await getFriendMemories(chat.participantId, { limit: 50 });
      const memoryMessageIds = new Set(memoriesResponse.memories.map(memory => memory.message_id));
      setSavedMemories(memoryMessageIds);
    } catch (error) {
      console.warn('Failed to load saved memories:', error);
      // Don't show error to user as this is not critical
    } finally {
      setMemoriesLoading(false);
    }
  };

  // Load conversation messages from API
  const loadConversationMessages = async () => {
    if (!chat || !token) return;
    
    // If chat doesn't have an ID, it's a new conversation - skip loading messages
    if (!chat.id) {
      setLoading(false);
      setMessages([]);
      return;
    }
    
    try {
      setLoading(true);
      const response = await getConversationMessages(chat.id, { limit: 50 });
      const uiMessages = response.data.map(apiMessage => ({
        ...apiMessageToUIMessage(apiMessage),
        receiverId: apiMessage.sender_id === currentUser?.id ? chat.participantId : currentUser?.id || '',
        senderId: apiMessage.sender_id === currentUser?.id ? 'current-user' : chat.participantId,
      }));
      
      // Only add bot summary for friends with typing animation
      if (chat.isFriend) {
        // First set the regular messages
        setMessages(uiMessages);
        
        // Show LinkBot typing indicator
        setLinkBotTyping(true);
        
        // Generate and add bot summary with real checkin data
        const generateAndAddBotSummary = async () => {
          try {
            const activities = await generateCheckinActivities(chat.participantId);
            const botSummary: BotSummary = {
              id: `bot-${Date.now()}`,
              type: 'summary',
              content: generateBotSummary(chat.participantName),
              timestamp: new Date(Date.now() - BOT_SUMMARY_CONSTANTS.SUMMARY_TIMESTAMP_OFFSET_MS),
              activities
            };
            
            setMessages(prev => [...prev, botSummary]);
          } catch (error) {
            console.error('Failed to generate bot summary:', error);
            // Fallback to simple message without activities
            const fallbackSummary: BotSummary = {
              id: `bot-${Date.now()}`,
              type: 'summary',
              content: generateBotSummary(chat.participantName),
              timestamp: new Date(Date.now() - BOT_SUMMARY_CONSTANTS.SUMMARY_TIMESTAMP_OFFSET_MS),
              activities: [{
                type: 'activity',
                content: 'Unable to load recent activity',
                time: 'N/A'
              }]
            };
            setMessages(prev => [...prev, fallbackSummary]);
          } finally {
            setLinkBotTyping(false);
          }
        };
        
        // After a delay, add the bot summary and hide typing
        const delay = BOT_SUMMARY_CONSTANTS.MIN_DELAY_MS + 
                     Math.random() * (BOT_SUMMARY_CONSTANTS.MAX_DELAY_MS - BOT_SUMMARY_CONSTANTS.MIN_DELAY_MS);
        botSummaryTimeoutRef.current = setTimeout(() => {
          generateAndAddBotSummary();
        }, delay);
      } else {
        setMessages(uiMessages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      // Fall back to empty messages array
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket connection
  const setupWebSocket = () => {
    if (!chat || !token?.token) return;
    
    // If chat doesn't have an ID, it's a new conversation - skip WebSocket setup
    if (!chat.id) {
      console.log('Skipping WebSocket setup for new conversation');
      return;
    }
    
    // Setup WebSocket event handlers
    chatWebSocket.onMessage = (event) => {
      if (event.message) {
        const newMessage: Message = {
          ...apiMessageToUIMessage(event.message),
          senderId: event.user_id === currentUser?.id ? 'current-user' : chat.participantId,
          receiverId: event.user_id === currentUser?.id ? chat.participantId : currentUser?.id || '',
        };
        setMessages(prev => [...prev, newMessage]);
      }
    };
    
    chatWebSocket.onTyping = (userId) => {
      if (userId !== currentUser?.id) {
        setTypingUsers(prev => new Set([...prev, userId]));
        // Remove typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        }, 3000);
      }
    };
    
    chatWebSocket.onStopTyping = (userId) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };
    
    chatWebSocket.onOpen = () => {
      console.log('Connected to WebSocket for conversation:', chat.id);
    };
    
    chatWebSocket.onError = (error) => {
      console.error('WebSocket error:', error);
    };
    
    // Connect to WebSocket
    chatWebSocket.connect(chat.id, token.token);
  };

  const generateBotSummary = (name: string): string => {
    const summaries = [
      `Here's what ${name} has been up to since your last chat:`,
      `Catching you up on ${name}'s recent activities:`,
      `${name}'s latest updates since you last spoke:`,
      `Quick summary of ${name}'s recent stories and check-ins:`
    ];
    return summaries[Math.floor(Math.random() * summaries.length)];
  };

  const generateCheckinActivities = async (userId: string): Promise<Array<{ type: 'checkin' | 'activity'; content: string; location?: string; time: string; }>> => {
    try {
      // Get recent checkins for the user (friends privacy or higher)
      const checkinsResponse = await getUserCheckIns(userId, {
        page: 1,
        page_size: BOT_SUMMARY_CONSTANTS.CHECKINS_PAGE_SIZE,
        privacy: 'friends' // Only show checkins visible to friends
      });
      
      const activities = checkinsResponse.checkins.map((checkin: BackendCheckIn) => {
        const timeAgo = formatTimeAgo(new Date(checkin.created_at));
        let content = '';
        
        if (checkin.location?.location_name) {
          content = `Checked in at ${checkin.location.location_name}`;
          if (checkin.text_content) {
            content += ` - "${checkin.text_content.substring(0, BOT_SUMMARY_CONSTANTS.SHORT_TEXT_LIMIT)}${checkin.text_content.length > BOT_SUMMARY_CONSTANTS.SHORT_TEXT_LIMIT ? '...' : ''}"`;
          }
        } else if (checkin.text_content) {
          content = `Posted: "${checkin.text_content.substring(0, BOT_SUMMARY_CONSTANTS.LONG_TEXT_LIMIT)}${checkin.text_content.length > BOT_SUMMARY_CONSTANTS.LONG_TEXT_LIMIT ? '...' : ''}"`;
        } else if (checkin.media_attachments.length > 0) {
          content = `Shared ${checkin.media_attachments.length} photo${checkin.media_attachments.length > 1 ? 's' : ''}`;
        } else {
          content = 'Posted an update';
        }
        
        return {
          type: 'checkin' as const,
          content,
          location: checkin.location?.location_name,
          time: timeAgo
        };
      });
      
      // If no checkins found, return a fallback activity
      if (activities.length === 0) {
        return [{
          type: 'activity' as const,
          content: "No recent activity to show",
          time: "N/A"
        }];
      }
      
      return activities.slice(0, BOT_SUMMARY_CONSTANTS.MAX_ACTIVITIES_DISPLAY);
    } catch (error) {
      console.warn('Failed to fetch user checkins for bot summary:', error);
      // Fallback to a generic activity
      return [{
        type: 'activity' as const,
        content: "Recent activity not available",
        time: "N/A"
      }];
    }
  };
  
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const handleSuggestionClick = (suggestion: string): void => {
    setNewMessage(suggestion);
  };

  const handleToggleMemory = async (message: Message): Promise<void> => {
    if (!chat?.isFriend || !currentUser || memoriesLoading || !isFriendMemoryEnabled) return;
    
    const isCurrentlySaved = savedMemories.has(message.id);
    
    try {
      if (isCurrentlySaved) {
        // Delete the memory
        // Note: We would need to store memory IDs to delete properly
        // For now, we'll just remove from local state and let it reload
        setSavedMemories(prev => {
          const newSet = new Set(prev);
          newSet.delete(message.id);
          return newSet;
        });
        
        // Find and delete the memory from the backend
        // This is a simplified approach - in production, we'd store the memory ID mapping
        const memoriesResponse = await getFriendMemories(chat.participantId, { limit: 50 });
        const existingMemory = memoriesResponse.memories.find(mem => mem.message_id === message.id);
        
        if (existingMemory) {
          await deleteFriendMemory(existingMemory.id);
        }
      } else {
        // Save the memory
        const memoryRequest: FriendMemoryRequest = {
          friend_id: chat.participantId,
          message_id: message.id,
          conversation_id: chat.id || '', // Fallback to empty string if no chat ID
          sender_id: message.senderId === 'current-user' ? currentUser.id : chat.participantId,
          message_type: message.type || 'text',
          message_content: message.content,
          notes: '', // Empty notes initially
        };
        
        await saveFriendMemory(memoryRequest);
        
        // Update local state
        setSavedMemories(prev => new Set([...prev, message.id]));
      }
    } catch (error) {
      console.error('Failed to toggle memory:', error);
      
      // Revert local state on error
      if (isCurrentlySaved) {
        setSavedMemories(prev => new Set([...prev, message.id]));
      } else {
        setSavedMemories(prev => {
          const newSet = new Set(prev);
          newSet.delete(message.id);
          return newSet;
        });
      }
      
      // Show error to user
      const errorMessage = getMemoryErrorMessage(error as any);
      // You could show a toast notification here
      console.warn('Memory toggle failed:', errorMessage);
    }
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!newMessage.trim() || !chat || !currentUser) return;
    
    const messageContent = newMessage.trim();
    // const currentUserName = `${currentUser.first_name} ${currentUser.last_name}`;
    
    // Check if this is the first message to a non-friend (keep this logic for permission system)
    const isFirstMessageToNonFriend = !chat.isFriend && messages.length <= 2;
    
    if (isFirstMessageToNonFriend) {
      // Handle permission-based messaging (keep existing logic for demo)
      const queuedMessageId = `queued-${Date.now()}`;
      
      const queuedMessage: Message = {
        id: queuedMessageId,
        content: messageContent,
        senderId: 'current-user',
        receiverId: chat.participantId,
        timestamp: new Date(),
        type: 'queued'
      };
      
      setMessages(prev => [...prev, queuedMessage]);
      setNewMessage('');
      
      // Add LinkBot permission flow (simplified for demo)
      setTimeout(() => {
        const linkBotMessage: Message = {
          id: `linkbot-${Date.now()}`,
          content: `I'm asking ${chat.participantName} for permission to receive your message. I'll let you know when they respond!`,
          senderId: 'linkbot',
          receiverId: 'current-user',
          timestamp: new Date(),
          type: 'system'
        };
        
        setMessages(prev => [...prev, linkBotMessage]);
        
        // Auto-approve for demo after 2 seconds
        setTimeout(() => {
          handlePermissionResponse('', true, queuedMessageId);
        }, 2000);
      }, 800);
    } else {
      // Normal message flow - use real API and WebSocket
      try {
        // Optimistic update - add message immediately
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          content: messageContent,
          senderId: 'current-user',
          receiverId: chat.participantId,
          timestamp: new Date(),
          type: 'text'
        };
        
        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');
        
        // Send via WebSocket if connected, otherwise use REST API
        if (chat.id && chatWebSocket.isConnected()) {
          chatWebSocket.sendMessage(messageContent);
        } else if (chat.id) {
          // Fallback to REST API for existing conversations
          await sendApiMessage({
            conversation_id: chat.id,
            content: messageContent,
            message_type: 'text'
          });
        } else {
          // For new conversations without ID, we can't send actual messages yet
          // In a real implementation, this would trigger conversation creation
          console.log('Cannot send message to conversation without ID');
        }
        
        // Remove optimistic message and let WebSocket/API response handle the real message
        // The real message will be received via WebSocket onMessage handler
        setTimeout(() => {
          setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        }, 1000);
        
      } catch (error) {
        console.error('Failed to send message:', error);
        // Revert optimistic update on error
        setMessages(prev => prev.filter(msg => msg.id.startsWith('temp-')));
        setNewMessage(messageContent); // Restore message content
      }
    }
  };
  
  const handlePermissionResponse = (permissionMessageId: string, approved: boolean, queuedMessageId: string): void => {
    // Update the permission request message to show response
    setMessages(prev => prev.map(msg => {
      if (msg.id === permissionMessageId && 'permissionData' in msg) {
        return {
          ...msg,
          permissionData: {
            ...(msg.permissionData || {}),
            isApproved: approved
          }
        } as Message;
      }
      return msg;
    }));
    
    // Add LinkBot response message
    setTimeout(() => {
      const responseMessage: Message = {
        id: `response-${Date.now()}`,
        content: approved 
          ? `Great! ${chat?.participantName} has accepted your message. You can now chat freely!`
          : `${chat?.participantName} declined to receive your message. You can try reaching out another time.`,
        senderId: 'linkbot',
        receiverId: 'current-user',
        timestamp: new Date(),
        type: 'system'
      };
      
      setMessages(prev => {
        let newMessages = [...prev, responseMessage];
        
        if (approved) {
          // Convert queued message to regular message and deliver it
          newMessages = newMessages.map(msg => {
            if (msg.id === queuedMessageId && 'senderId' in msg) {
              return {
                ...msg,
                type: 'text' as const
              } as Message;
            }
            return msg;
          });
          
          // Simulate recipient response to the original message
          setTimeout(() => {
            const recipientResponse: Message = {
              id: `recipient-response-${Date.now()}`,
              content: "Thanks for reaching out! I'd love to chat.",
              senderId: chat?.participantId || '',
              receiverId: 'current-user',
              timestamp: new Date(),
              type: 'text'
            };
            
            setMessages(prev => [...prev, recipientResponse]);
            
            // Mark as friends after successful first contact
            if (chat) {
              chat.isFriend = true;
            }
          }, 1500);
        } else {
          // Remove the queued message if permission was denied
          newMessages = newMessages.filter(msg => msg.id !== queuedMessageId);
        }
        
        return newMessages;
      });
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen || !chat) return <>!</>;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center" data-testid="conversation-modal">
      <div className="bg-surface-card rounded-t-3xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img 
              src={chat.participantAvatar} 
              alt={chat.participantName}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h3 className="font-semibold text-gray-900">{chat.participantName}</h3>
              <p className="text-xs text-gray-600">
                {user?.isAvailable ? 'Available' : 'Away'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-full transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && messages.length === 0 && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-aqua"></div>
              <span className="ml-2 text-gray-500 text-sm">Loading messages...</span>
            </div>
          )}
          
          {messages.map((message) => {
            if ('type' in message && message.type === 'summary') {
              // Bot summary message
              return (
                <div key={message.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-b from-accent-copper-light to-accent-copper-dark flex items-center justify-center flex-shrink-0 shadow-md">
                    <Bot size={16} className="text-white drop-shadow-sm" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-accent-copper-light rounded-2xl rounded-tl-sm p-3">
                      <p className="text-sm text-white mb-3">{message.content}</p>
                      <div className="space-y-2">
                        {message.activities.map((activity, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <div className="w-1 h-1 rounded-full bg-aqua mt-2 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-white">{activity.content}</p>
                              <div className="flex items-center gap-2 text-white/70 mt-1 flex-wrap">
                                <Clock size={10} />
                                <span>{activity.time}</span>
                                {activity.location && (
                                  <>
                                    <MapPin size={10} />
                                    <span>{activity.location}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-3">
                      LinkBot • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            } else {
              // Regular message and other message types
              const msg = message as Message;
              const isFromCurrentUser = msg.senderId === 'current-user';
              const isSaved = savedMemories.has(msg.id);
              const isLinkBot = msg.senderId === 'linkbot';
              
              // Handle different message types
              if (msg.type === 'system' && isLinkBot) {
                // LinkBot system message
                return (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-accent-copper-light to-accent-copper-dark flex items-center justify-center flex-shrink-0 shadow-md">
                      <Bot size={16} className="text-white drop-shadow-sm" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-accent-copper-light rounded-2xl rounded-tl-sm p-3">
                        <p className="text-sm text-white">{msg.content}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-3">
                        LinkBot • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              } else if (msg.type === 'permission-request' && isLinkBot) {
                // Permission request from LinkBot
                return (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-accent-copper-light to-accent-copper-dark flex items-center justify-center flex-shrink-0 shadow-md">
                      <Bot size={16} className="text-white drop-shadow-sm" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-accent-copper-light rounded-2xl rounded-tl-sm p-3">
                        <p className="text-sm text-white mb-3">{msg.content}</p>
                        {msg.permissionData && msg.permissionData.isApproved === undefined && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handlePermissionResponse(msg.id, true, msg.permissionData!.queuedMessageId!)}
                              className="flex items-center gap-1 px-3 py-2 bg-aqua hover:bg-aqua-dark text-white text-xs font-medium rounded-full transition-colors hover-scale"
                            >
                              <Check size={12} />
                              Yes
                            </button>
                            <button
                              onClick={() => handlePermissionResponse(msg.id, false, msg.permissionData!.queuedMessageId!)}
                              className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-full transition-colors hover-scale"
                            >
                              <XIcon size={12} />
                              No
                            </button>
                          </div>
                        )}
                        {msg.permissionData && msg.permissionData.isApproved !== undefined && (
                          <div className="mt-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              msg.permissionData.isApproved 
                                ? 'bg-aqua/20 text-aqua' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {msg.permissionData.isApproved ? '✓ Accepted' : '✗ Declined'}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-3">
                        LinkBot • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              } else if (msg.type === 'queued') {
                // Queued message (pending approval)
                return (
                  <div key={msg.id} className="flex gap-3 flex-row-reverse">
                    <div className="max-w-[80%] text-right flex items-start flex-row-reverse gap-2">
                      <div className="flex-1">
                        <div className="rounded-2xl p-3 bg-yellow-100 text-yellow-800 rounded-br-sm border border-yellow-200">
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs text-yellow-600 mt-1">⏳ Waiting for permission...</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Regular text message
                return (
                  <div key={msg.id} className={`flex gap-3 ${isFromCurrentUser ? 'flex-row-reverse' : ''}`}>
                    {!isFromCurrentUser && (
                      <img 
                        src={chat.participantAvatar} 
                        alt={chat.participantName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    )}
                    <div className={`max-w-[80%] ${isFromCurrentUser ? 'text-right' : ''} flex items-start ${isFromCurrentUser ? 'flex-row-reverse' : ''} gap-2`}>
                      <div className="flex-1">
                        <div className={`rounded-2xl p-3 ${
                          isFromCurrentUser 
                            ? 'bg-aqua text-white rounded-br-sm' 
                            : 'bg-surface-hover text-gray-900 rounded-bl-sm'
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!isFromCurrentUser && chat?.isFriend && isFriendMemoryEnabled && (
                        <button
                          onClick={() => handleToggleMemory(msg)}
                          disabled={memoriesLoading}
                          className={`mt-2 p-1.5 rounded-full transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                            isSaved 
                              ? 'bg-accent-copper/20 text-accent-copper hover:bg-accent-copper/30' 
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                          }`}
                          title={isSaved ? 'Remove from friend memory' : 'Save to friend memory'}
                        >
                          <Bookmark size={12} className={`transition-all duration-200 ${
                            isSaved ? 'fill-current' : ''
                          }`} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
            }
          })}
          
          {/* LinkBot Typing Indicator */}
          {linkBotTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-b from-accent-copper-light to-accent-copper-dark flex items-center justify-center flex-shrink-0 shadow-md">
                <Bot size={16} className="text-white drop-shadow-sm" />
              </div>
              <div className="flex-1">
                <div className="bg-accent-copper-light rounded-2xl rounded-tl-sm p-3 max-w-[120px]">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-3">
                  LinkBot is generating summary...
                </p>
              </div>
            </div>
          )}
          
          {/* User Typing Indicator */}
          {typingUsers.size > 0 && (
            <div className="flex gap-3">
              <img 
                src={chat.participantAvatar} 
                alt={chat.participantName}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1">
                <div className="bg-surface-hover text-gray-900 rounded-2xl rounded-bl-sm p-3 max-w-[80px]">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {chat.participantName} is typing...
                </p>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Conversational Cue Cards */}
        {isFeatureEnabled('CONVERSATION_CUE_CARDS') && (
          <ConversationalCueCards
            chat={chat}
            user={user}
            messages={messages.filter(msg => 'senderId' in msg) as Message[]}
            onSuggestionClick={handleSuggestionClick}
          />
        )}

        {/* Input */}
        <div className="p-4 pt-2">
          <div className="flex items-end gap-2 bg-surface-hover rounded-2xl p-3">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message or start with @ to ask Linkbot"
              className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-sm resize-none min-h-[20px] max-h-20"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover-scale ${
                newMessage.trim()
                  ? newMessage.startsWith('@')
                    ? 'bg-gradient-to-b from-accent-copper-light to-accent-copper-dark text-white hover:shadow-md border border-accent-copper/40 hover-glow'
                    : 'bg-aqua text-white hover:bg-aqua-dark hover-glow'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {newMessage.trim() && newMessage.startsWith('@') ? (
                <Bot size={14} className="drop-shadow-sm" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ConversationModal;
