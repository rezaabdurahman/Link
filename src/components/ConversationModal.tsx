import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Bot, User as UserIcon, Clock, MapPin, UserPlus } from 'lucide-react';
import { Chat, User, Message } from '../types';
import { nearbyUsers } from '../data/mockData';

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
  const [user, setUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && chat) {
      // Find the user from nearby users
      const foundUser = nearbyUsers.find(u => u.id === chat.participantId);
      setUser(foundUser || null);
      
      // Generate mock bot summary
      const botSummary: BotSummary = {
        id: `bot-${Date.now()}`,
        type: 'summary',
        content: generateBotSummary(foundUser || { name: chat.participantName }),
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        activities: generateMockActivities()
      };

      // Create some initial conversation messages for demonstration
      const initialMessages: Message[] = [
        {
          id: 'init1',
          senderId: chat.participantId,
          receiverId: 'current-user',
          content: "Hey! How's your week going?",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          type: 'text'
        },
        {
          id: 'init2', 
          senderId: 'current-user',
          receiverId: chat.participantId,
          content: "Pretty good! Been busy with work but looking forward to the weekend. How about you?",
          timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
          type: 'text'
        }
      ];
      
      // Set initial messages (mock conversation + bot summary)
      // Use initialMessages if chat.messages is undefined OR empty
      const chatMessages = (chat.messages && chat.messages.length > 0) ? chat.messages : initialMessages;
      
      // Only add bot summary for friends (isFriend === true)
      if (chat.isFriend) {
        setMessages([...chatMessages, botSummary]);
      } else {
        setMessages([...chatMessages]);
      }
      
      // Set initial message if provided
      if (initialMessage) {
        setNewMessage(initialMessage);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, chat, initialMessage]);

  const generateBotSummary = (user: any): string => {
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

  const handleSendMessage = () => {
    if (newMessage.trim() && chat) {
      const message: Message = {
        id: Date.now().toString(),
        content: newMessage.trim(),
        senderId: 'current-user',
        receiverId: chat.participantId,
        timestamp: new Date(),
        type: 'text'
      };

      setMessages(prev => [...prev, message]);
      setNewMessage('');
      
      // Simulate recipient response after a delay
      setTimeout(() => {
        const responses = [
          "Hey! Great to hear from you 😊",
          "Thanks for reaching out!",
          "Perfect timing! I was just thinking about you",
          "Absolutely! Let's catch up soon",
          "That sounds amazing! Tell me more"
        ];
        
        const response: Message = {
          id: (Date.now() + 1).toString(),
          content: responses[Math.floor(Math.random() * responses.length)],
          senderId: chat.participantId,
          receiverId: 'current-user',
          timestamp: new Date(),
          type: 'text'
        };

        setMessages(prev => [...prev, response]);
      }, 1000 + Math.random() * 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
                {user?.isAvailable ? '🟢 Available' : '⚫ Away'}
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
          {messages.map((message) => {
            if ('type' in message && message.type === 'summary') {
              // Bot summary message
              return (
                <div key={message.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-b from-accent-copper-light to-accent-copper-dark flex items-center justify-center flex-shrink-0 shadow-sm border border-accent-copper/40">
                    <Bot size={16} className="text-white drop-shadow-sm" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-accent-copper/20 rounded-2xl rounded-tl-sm p-3 border border-accent-copper/30">
                      <p className="text-sm text-gray-700 mb-3">{message.content}</p>
                      <div className="space-y-2">
                        {message.activities.map((activity, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <div className="w-1 h-1 rounded-full bg-aqua mt-2 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-gray-700">{activity.content}</p>
                              <div className="flex items-center gap-2 text-gray-500 mt-1">
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
              // Regular message
              const msg = message as Message;
              const isFromCurrentUser = msg.senderId === 'current-user';
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
                  <div className={`max-w-[80%] ${isFromCurrentUser ? 'text-right' : ''}`}>
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
                </div>
              );
            }
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-end gap-2 bg-surface-hover rounded-2xl p-3">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-sm resize-none min-h-[20px] max-h-20"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                newMessage.trim() 
                  ? 'bg-aqua text-white hover:bg-aqua-dark' 
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ConversationModal;
