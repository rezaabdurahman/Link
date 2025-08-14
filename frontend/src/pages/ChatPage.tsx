import React, { useState, useEffect } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Chat } from '../types';
import ChatListItem from '../components/ChatListItem';
import IntelligentMessageBox from '../components/IntelligentMessageBox';
import AnimatedSearchInput from '../components/AnimatedSearchInput';
import { isFeatureEnabled } from '../config/featureFlags';
import RankToggle from '../components/RankToggle';
import ConversationModal from '../components/ConversationModal';
import AddFriendModal from '../components/AddFriendModal';
import { getConversations, conversationToChat } from '../services/chatClient';
import { useAuth } from '../contexts/AuthContext';

type SortOption = 'priority' | 'time' | 'unread' | 'discover';

const ChatPage: React.FC = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [conversationModalOpen, setConversationModalOpen] = useState<boolean>(false);
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [addFriendModalOpen, setAddFriendModalOpen] = useState<boolean>(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const { token } = useAuth();

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await getConversations({ limit: 50 });
        const convertedChats = response.data.map((conversation, index) => ({
          ...conversationToChat(conversation),
          priority: index + 1, // Set priority based on API order
        }));
        
        setChats(convertedChats);
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
        setError('Failed to load conversations. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [token]);

  const filteredChats = chats.filter(chat => {
    // Text search filter
    const matchesSearch = chat.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.conversationSummary.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Discover filter: only show non-friends
    if (sortBy === 'discover') {
      return matchesSearch && !chat.isFriend;
    }
    
    return matchesSearch;
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return a.priority - b.priority;
      case 'time':
        return b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime();
      case 'unread':
        return b.unreadCount - a.unreadCount;
      case 'discover':
        // For discover, sort by most recent messages from non-friends
        return b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime();
      default:
        return 0;
    }
  });

  const handleChatClick = (chat: Chat): void => {
    setSelectedChat(chat);
    setInitialMessage('');
    setConversationModalOpen(true);
  };

  const handleSendMessage = (message: string, recipientId?: string): void => {
    if (recipientId) {
      // Find the chat with this recipient
      const existingChat = chats.find(chat => chat.participantId === recipientId);
      
      if (existingChat) {
        // Open existing chat with the message
        setSelectedChat(existingChat);
        setInitialMessage(message);
        setConversationModalOpen(true);
      } else {
        // Create a new chat entry for this recipient (in a real app, this would be handled by the backend)
        console.log('Creating new chat with:', recipientId, 'Message:', message);
        // For now, we'll just log it since we don't have a full chat creation flow
      }
    }
  };

  const handleCloseConversation = (): void => {
    setConversationModalOpen(false);
    setSelectedChat(null);
    setInitialMessage('');
  };


  return (
    <div className="ios-safe-area" style={{ padding: '0 20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
        paddingTop: '20px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>
            Chats
          </h1>
          <p className="text-secondary" style={{ fontSize: '14px' }}>
            {sortedChats.reduce((sum, chat) => sum + chat.unreadCount, 0)} unread messages
          </p>
        </div>
        <button
          onClick={() => setAddFriendModalOpen(true)}
          className="w-10 h-10 bg-aqua hover:bg-aqua-dark text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md"
          title="Add Friend"
        >
          <UserPlus size={20} />
        </button>
      </div>

      {/* Search */}
      <AnimatedSearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        suggestions={[
          'who is into raving?',
          'Who is into volleyball?',
          "Who's going to Coachella next year?",
          "Who's gonna be in France this September?",
          'who loves indie films?',
          'who wants to grab coffee?',
          'who is into yoga?'
        ]}
        className="mb-6"
      />

      {/* Rank Toggle */}
      <div className="flex justify-end mb-6">
        <RankToggle value={sortBy} onChange={setSortBy} />
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: 'rgba(235, 235, 245, 0.6)'
        }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua mx-auto mb-4"></div>
          <p>Loading conversations...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: '#ef4444'
        }}>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-aqua text-white rounded-lg hover:bg-aqua-dark transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Chat List */}
      {!loading && !error && (
        <div style={{ marginBottom: '140px' }}>
          {sortedChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              onClick={() => handleChatClick(chat)}
              enableAISummary={isFeatureEnabled('AI_CONVERSATION_SUMMARIES')}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && sortedChats.length === 0 && searchQuery && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: 'rgba(235, 235, 245, 0.6)'
        }}>
          <Search size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>No conversations found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Empty Conversations State */}
      {!loading && !error && sortedChats.length === 0 && !searchQuery && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: 'rgba(235, 235, 245, 0.6)'
        }}>
          <p>No conversations yet. Start chatting to see them here!</p>
        </div>
      )}

      {/* Intelligent Message Box */}
      {isFeatureEnabled('INTELLIGENT_MESSAGE_BOX') && (
        <IntelligentMessageBox onSendMessage={handleSendMessage} />
      )}

      {/* Conversation Modal */}
      <ConversationModal 
        isOpen={conversationModalOpen}
        onClose={handleCloseConversation}
        chat={selectedChat}
        initialMessage={initialMessage}
      />

      {/* Add Friend Modal */}
      <AddFriendModal
        isOpen={addFriendModalOpen}
        onClose={() => setAddFriendModalOpen(false)}
      />
    </div>
  );
};

export default ChatPage;
