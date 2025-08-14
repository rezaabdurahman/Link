import React, { useState, useEffect } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Chat, Message } from '../types';
import ChatListItem from '../components/ChatListItem';
import IntelligentMessageBox from '../components/IntelligentMessageBox';
import AnimatedSearchInput from '../components/AnimatedSearchInput';
import { isFeatureEnabled } from '../config/featureFlags';
import RankToggle from '../components/RankToggle';
import ConversationModal from '../components/ConversationModal';
import AddMyContactModal from '../components/AddMyContactModal';
import { getConversations, conversationToChat, createConversation } from '../services/chatClient';
import { unifiedSearch, UnifiedSearchRequest, isUnifiedSearchError, getUnifiedSearchErrorMessage } from '../services/unifiedSearchClient';
// Legacy import - this will show deprecation warnings in console
import { searchFriends, PublicUser } from '../services/userClient';
import { useAuth } from '../contexts/AuthContext';
import { SearchResultsSkeleton } from '../components/SkeletonShimmer';
import FixedHeader from '../components/layout/FixedHeader';

type SortOption = 'priority' | 'time' | 'unread' | 'discover';

const ChatPage: React.FC = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [conversationModalOpen, setConversationModalOpen] = useState<boolean>(false);
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [addMyContactModalOpen, setAddMyContactModalOpen] = useState<boolean>(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // New state for friend search results
  const [friendResults, setFriendResults] = useState<PublicUser[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  
  const { token } = useAuth();

  // Helper function to create a blank message for pseudo-chats
  const createBlankMessage = (): Message => ({
    id: '',
    senderId: '',
    receiverId: '',
    content: 'Start a conversation',
    timestamp: new Date(),
    type: 'text'
  });

  // Helper function to create a pseudo-chat from a friend
  const createPseudoChat = (friend: PublicUser): Chat => ({
    id: '',
    participantId: friend.id,
    participantName: `${friend.first_name} ${friend.last_name}`,
    participantAvatar: friend.profile_picture || '/default-avatar.png',
    lastMessage: createBlankMessage(),
    unreadCount: 0,
    conversationSummary: '',
    priority: 999, // Lower priority for pseudo-chats
    isFriend: true
  });

  // Debounced search effect for friend results - NEW unified search implementation
  useEffect(() => {
    const searchFriendsDebounced = async (query: string) => {
      if (!query.trim()) {
        setFriendResults([]);
        return;
      }

      try {
        setSearchLoading(true);
        
        // Use the new unified search with 'friends' scope
        const searchRequest: UnifiedSearchRequest = {
          query: query.trim(),
          scope: 'friends', // Search within user's friends only
          pagination: {
            limit: 20,
          },
        };

        const response = await unifiedSearch(searchRequest);
        
        // Convert User[] to PublicUser[] for backward compatibility
        const friends: PublicUser[] = response.users.map(user => ({
          id: user.id,
          email: '', // Not available in unified search response
          username: user.name.toLowerCase().replace(' ', '_'),
          first_name: user.name.split(' ')[0],
          last_name: user.name.split(' ')[1] || '',
          profile_picture: user.profilePicture,
          bio: user.bio,
          interests: user.interests,
          social_links: {},
          additional_photos: [],
          privacy_settings: {},
          is_friend: true,
          mutual_friends_count: user.mutualFriends?.length || 0,
          last_active: user.lastSeen?.toISOString(),
        }));
        
        setFriendResults(friends);
        
        // Log search metadata for debugging
        if (response.metadata) {
          console.log('Friend search metadata:', response.metadata);
        }
        
      } catch (err) {
        console.error('Failed to search friends:', err);
        
        // Fallback to legacy search on error
        if (isUnifiedSearchError(err)) {
          console.warn('Unified search failed, falling back to legacy search:', getUnifiedSearchErrorMessage(err));
          try {
            const response = await searchFriends(query, { limit: 20 });
            setFriendResults(response.friends);
          } catch (legacyErr) {
            console.error('Legacy search also failed:', legacyErr);
            setFriendResults([]);
          }
        } else {
          setFriendResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      searchFriendsDebounced(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

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

  // Create combined list of existing chats and friend search results
  const combinedList = React.useMemo(() => {
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

    // If no search query, just return filtered chats
    if (!searchQuery.trim()) {
      return filteredChats;
    }

    // Combine existing chats with friend search results
    const combinedItems = [...filteredChats];
    
    // Add pseudo-chats for friends that don't have existing conversations
    friendResults.forEach(friend => {
      const existingChat = chats.find(chat => chat.participantId === friend.id);
      if (!existingChat) {
        combinedItems.push(createPseudoChat(friend));
      }
    });

    return combinedItems;
  }, [chats, friendResults, searchQuery, sortBy]);

  /**
   * Sorts the combined chat list based on the selected sort option.
   * 
   * @description Sort behaviors:
   * - priority: Lower number = higher priority (1 is highest priority)
   * - time: Most recent messages first (descending timestamp)
   * - unread: Highest unread count first (descending count)
   * - discover: Non-friend conversations by recency (filtered in combinedList)
   * 
   * @see ChatPage-Sort-Logic.md for detailed documentation
   */
  const sortedChats = [...combinedList].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        // Lower priority number = higher importance (1 > 2 > 3...)
        return a.priority - b.priority;
      case 'time':
        // Most recent messages first
        return b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime();
      case 'unread':
        // Highest unread count first
        return b.unreadCount - a.unreadCount;
      case 'discover':
        // For discover mode, sort non-friends by most recent messages
        return b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime();
      default:
        return 0;
    }
  });

  // Helper function to open a conversation modal
  const openConversation = (chat: Chat, message: string = ''): void => {
    setSelectedChat(chat);
    setInitialMessage(message);
    setConversationModalOpen(true);
  };

  const handleChatClick = async (chat: Chat): Promise<void> => {
    try {
      if (chat.id) {
        // Existing conversation - open directly
        openConversation(chat);
      } else {
        // No existing conversation - create new one
        const conversation = await createConversation({ 
          type: 'direct', 
          participant_ids: [chat.participantId] 
        });
        
        // Convert to Chat object
        const newChat = conversationToChat(conversation);
        
        // Add to chats list
        setChats(prev => [newChat, ...prev]);
        
        // Open the new conversation
        openConversation(newChat);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      // Still try to open the chat for demo purposes, but log the error
      openConversation(chat);
    }
  };

  const handleSendMessage = (message: string, recipientId?: string): void => {
    if (recipientId) {
      // Find the chat with this recipient
      const existingChat = chats.find(chat => chat.participantId === recipientId);
      
      if (existingChat) {
        // Open existing chat with the message
        openConversation(existingChat, message);
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

  const handleSearchEnter = (): void => {
    // Trigger immediate search without debounce when user presses Enter
    if (searchQuery.trim()) {
      // The search is already handled by the debounced effect,
      // but we can force immediate execution here if needed
      console.log('Executing search for:', searchQuery);
    }
  };


  return (
    <div className="flex flex-col min-h-screen">
      {/* Fixed Header Section */}
      <FixedHeader>
        {/* Header */}
        <div className="flex justify-between items-center py-3">
          <div>
            <h1 className="text-2xl font-bold text-gradient-aqua leading-tight">
              Chats
            </h1>
            <p className="text-secondary text-sm">
              {sortedChats.reduce((sum, chat) => sum + chat.unreadCount, 0)} unread messages
            </p>
          </div>
          <button
            onClick={() => setAddMyContactModalOpen(true)}
            className="w-7 h-7 rounded-full bg-transparent text-aqua hover:bg-aqua/10 transition-all duration-200 flex items-center justify-center"
            title="Add to My Contacts"
          >
            <UserPlus size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="pb-2">
          <AnimatedSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onEnter={handleSearchEnter}
            suggestions={[
              'who is into raving?',
              'Who is into volleyball?',
              "Who's going to Coachella next year?",
              "Who's gonna be in France this September?",
              'who loves indie films?',
              'who wants to grab coffee?',
              'who is into yoga?'
            ]}
            className=""
            loading={searchLoading}
            aria-label="Search for friends and conversations"
            aria-describedby="search-help"
          />
        </div>

        {/* Rank Toggle */}
        <div className="flex justify-end pb-2">
          <RankToggle value={sortBy} onChange={setSortBy} />
        </div>
      </FixedHeader>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="pt-4 px-4">
          <div className="max-w-sm mx-auto">

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

      {/* Search Loading State with Skeleton */}
      {searchLoading && searchQuery.trim() && (
        <div className="mb-6" role="region" aria-label="Search results loading">
          <SearchResultsSkeleton count={3} />
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
        <div data-testid="chat-list" style={{ marginBottom: '20px', paddingBottom: '4px' }}>
          {sortedChats.map((chat) => (
            <ChatListItem
              key={chat.id || `pseudo-${chat.participantId}`}
              chat={chat}
              onClick={() => handleChatClick(chat)}
              enableAISummary={isFeatureEnabled('AI_CONVERSATION_SUMMARIES')}
              data-testid="chat-item"
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

          </div>
        </div>
      </div>

      {/* Conversation Modal */}
      <ConversationModal 
        isOpen={conversationModalOpen}
        onClose={handleCloseConversation}
        chat={selectedChat}
        initialMessage={initialMessage}
      />

      {/* Add My Contact Modal */}
      <AddMyContactModal
        isOpen={addMyContactModalOpen}
        onClose={() => setAddMyContactModalOpen(false)}
      />
    </div>
  );
};

export default ChatPage;
