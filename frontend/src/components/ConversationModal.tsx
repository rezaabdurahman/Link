import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Bot, User as UserIcon, Clock, MapPin, UserPlus, Bookmark, Check, X as XIcon } from 'lucide-react';
import { Chat, User, Message } from '../types';
import ConversationalCueCards from './ConversationalCueCards';
import { isFeatureEnabled } from '../config/featureFlags';
import { 
  getConversationMessages, 
  sendMessage as sendApiMessage, 
  apiMessageToUIMessage, 
  chatWebSocket 
} from '../services/chatClient';
import { useAuth } from '../contexts/AuthContext';

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
    type: 'story' | 'checkin' | 'activity';
    content: string;
    location?: string;
    time: string;
  }>;
}

const ConversationModal: React.FC<ConversationModalProps> = ({ 
  isOpen, 
  onClose, 
  chat, 
  initialMessage,
  onAddFriend,
  isFriend
}): JSX.Element => {
  const [messages, setMessages] = useState<(Message | BotSummary)[]>([]);
  const [newMessage, setNewMessage] = useState<string>(initialMessage || '');
  const [user] = useState<User | null>(null);
  const [savedContexts, setSavedContexts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { user: currentUser, token } = useAuth();

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
      
      // Set initial message if provided
      if (initialMessage) {
        setNewMessage(initialMessage);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      
      // Cleanup function
      return () => {
        chatWebSocket.disconnect();
      };
    }
  }, [isOpen, chat, initialMessage, token]);

  // Load conversation messages from API
  const loadConversationMessages = async () => {
    if (!chat || !token) return;
    
    try {
      setLoading(true);
      const response = await getConversationMessages(chat.id, { limit: 50 });
      const uiMessages = response.data.map(apiMessage => ({
        ...apiMessageToUIMessage(apiMessage),
        receiverId: apiMessage.sender_id === currentUser?.id ? chat.participantId : currentUser?.id || '',
        senderId: apiMessage.sender_id === currentUser?.id ? 'current-user' : chat.participantId,
      }));
      
      // Generate bot summary for friends
      const botSummary: BotSummary = {
        id: `bot-${Date.now()}`,
        type: 'summary',
        content: generateBotSummary({ name: chat.participantName }),
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        activities: generateMockActivities()
      };
      
      // Only add bot summary for friends
      if (chat.isFriend) {
        setMessages([...uiMessages, botSummary]);
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

  const generateBotSummary = (user: { name: string }): string => {
    const summaries = [
      `Here's what ${user.name} has been up to since your last chat:`,
      `Catching you up on ${user.name}'s recent activities:`,
      `${user.name}'s latest updates since you last spoke:`,
      `Quick summary of ${user.name}'s recent stories and check-ins:`
    ];
    return summaries[Math.floor(Math.random() * summaries.length)];
  };

  const generateMockActivities = (): Array<{ type: 'story' | 'checkin' | 'activity'; content: string; location?: string; time: string; }> => {
    const activities = [
      {
        type: 'story' as const,
        content: "Posted a story about trying the new coffee shop downtown ☕",
        time: "2 hours ago"
      },
      {
        type: 'checkin' as const,
        content: "Checked in at Golden Gate Park",
        location: "Golden Gate Park, SF",
        time: "5 hours ago"
      },
      {
        type: 'activity' as const,
        content: "Shared photos from last night's rooftop dinner 📸",
        time: "1 day ago"
      },
      {
        type: 'checkin' as const,
        content: "Checked in at SoulCycle Mission",
        location: "SoulCycle Mission Bay",
        time: "2 days ago"
      },
      {
        type: 'story' as const,
        content: "Posted about finishing a 10K run along the Embarcadero 🏃‍♀️",
        time: "3 days ago"
      }
    ];

    // Return 2-4 random activities
    const shuffled = activities.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
  };

  const handleSuggestionClick = (suggestion: string): void => {
    setNewMessage(suggestion);
  };

  const handleToggleContext = (messageId: string): void => {
    setSavedContexts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
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
        if (chatWebSocket.isConnected()) {
          chatWebSocket.sendMessage(messageContent);
        } else {
          // Fallback to REST API
          await sendApiMessage({
            conversation_id: chat.id,
            content: messageContent,
            message_type: 'text'
          });
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-surface-card rounded-t-3xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {user?.profilePicture ? (
              <img 
                src={user.profilePicture} 
                alt={chat.participantName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-aqua/20 flex items-center justify-center">
                <UserIcon size={20} className="text-aqua" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{chat.participantName}</h3>
              <p className="text-xs text-gray-600">
                {user?.isAvailable ? 'Available' : 'Away'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onAddFriend && (
              <button
                onClick={onAddFriend}
                className={`p-2 hover:bg-surface-hover rounded-full transition-colors ${
                  isFriend 
                    ? 'text-text-primary' 
                    : 'text-aqua'
                }`}
                title={isFriend ? 'Friends' : 'Add Friend'}
              >
                <UserPlus size={16} />
              </button>
            )}
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
                  <div className="w-8 h-8 rounded-full bg-gradient-to-b from-accent-copper-light to-accent-copper-dark flex items-center justify-center flex-shrink-0 shadow-sm border border-accent-copper/40">
                    <Bot size={16} className="text-white drop-shadow-sm" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-accent-copper rounded-2xl rounded-tl-sm p-3">
                      <p className="text-sm text-white mb-3">{message.content}</p>
                      <div className="space-y-2">
                        {message.activities.map((activity, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <div className="w-1 h-1 rounded-full bg-aqua mt-2 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-white">{activity.content}</p>
                              <div className="flex items-center gap-2 text-white/70 mt-1">
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
              const isSaved = savedContexts.has(msg.id);
              const isLinkBot = msg.senderId === 'linkbot';
              
              // Handle different message types
              if (msg.type === 'system' && isLinkBot) {
                // LinkBot system message
                return (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-accent-copper-light to-accent-copper-dark flex items-center justify-center flex-shrink-0 shadow-sm border border-accent-copper/40">
                      <Bot size={16} className="text-white drop-shadow-sm" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-accent-copper rounded-2xl rounded-tl-sm p-3">
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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-accent-copper-light to-accent-copper-dark flex items-center justify-center flex-shrink-0 shadow-sm border border-accent-copper/40">
                      <Bot size={16} className="text-white drop-shadow-sm" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-accent-copper rounded-2xl rounded-tl-sm p-3">
                        <p className="text-sm text-white mb-3">{msg.content}</p>
                        {msg.permissionData && msg.permissionData.isApproved === undefined && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handlePermissionResponse(msg.id, true, msg.permissionData!.queuedMessageId!)}
                              className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-full transition-colors"
                            >
                              <Check size={12} />
                              Yes
                            </button>
                            <button
                              onClick={() => handlePermissionResponse(msg.id, false, msg.permissionData!.queuedMessageId!)}
                              className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-full transition-colors"
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
                                ? 'bg-green-100 text-green-700' 
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
                      <div className="w-8 h-8 rounded-full bg-surface-hover/50 flex items-center justify-center flex-shrink-0">
                        {user?.profilePicture ? (
                          <img 
                            src={user.profilePicture} 
                            alt={chat.participantName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <UserIcon size={16} className="text-gray-600" />
                        )}
                      </div>
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
                      {!isFromCurrentUser && (
                        <button
                          onClick={() => handleToggleContext(msg.id)}
                          className={`mt-2 p-1.5 rounded-full transition-all duration-200 hover:scale-110 ${
                            isSaved 
                              ? 'bg-accent-copper/20 text-accent-copper hover:bg-accent-copper/30' 
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                          }`}
                          title={isSaved ? 'Remove from friend context' : 'Save to friend context'}
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
          
          {/* Typing Indicator */}
          {typingUsers.size > 0 && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-hover/50 flex items-center justify-center flex-shrink-0">
                {user?.profilePicture ? (
                  <img 
                    src={user.profilePicture} 
                    alt={chat.participantName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <UserIcon size={16} className="text-gray-600" />
                )}
              </div>
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
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                newMessage.trim()
                  ? newMessage.startsWith('@')
                    ? 'bg-gradient-to-b from-accent-copper-light to-accent-copper-dark text-white hover:shadow-md border border-accent-copper/40'
                    : 'bg-aqua text-white hover:bg-aqua-dark'
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
