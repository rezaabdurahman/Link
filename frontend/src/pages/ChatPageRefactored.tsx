import React, { useCallback } from 'react';
import { UserPlus } from 'lucide-react';
import { useChatData } from '../hooks/useChatData';
import { useChatStore, useUIStore, useUserPreferencesStore } from '../stores';
import { Chat } from '../types';
import ChatListItem from '../components/ChatListItem';
import IntelligentMessageBox from '../components/IntelligentMessageBox';
import AnimatedSearchInput from '../components/AnimatedSearchInput';
import { isFeatureEnabled } from '../config/featureFlags';
import RankToggle from '../components/RankToggle';
import ConversationModal from '../components/ConversationModal';
import AddMyContactModal from '../components/AddMyContactModal';
import ProfileDetailModal from '../components/ProfileDetailModal';
import { SearchResultsSkeleton } from '../components/SkeletonShimmer';
import FixedHeader from '../components/layout/FixedHeader';
import Toast from '../components/Toast';

const ChatPageRefactored: React.FC = (): JSX.Element => {
  const { preferences } = useUserPreferencesStore();
  const { 
    toast, 
    showToast, 
    hideToast,
    modals, 
    openModal, 
    closeModal 
  } = useUIStore();

  const {
    searchQuery,
    sortBy,
    setSearchQuery,
    setSortBy,
    setMessageDraft,
  } = useChatStore();

  // SWR data fetching with automatic refresh based on preferences
  const { 
    combinedChatList,
    isLoading, 
    isSearching,
    error, 
    createChat,
    totalUnreadCount,
  } = useChatData({ 
    enabled: true,
    refreshInterval: preferences.autoRefreshResults ? 30000 : 0,
    revalidateOnFocus: true 
  });

  // Event handlers
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, [setSearchQuery]);

  const handleChatClick = async (chat: Chat): Promise<void> => {
    try {
      if (!chat.id) {
        // No existing conversation - create new one
        await createChat(chat.participantId);
      }
      
      // Open conversation modal
      openModal('conversationModalOpen');
      // Note: You may want to add selectedChat state to uiStore modals
      
    } catch (error) {
      console.error('Failed to open conversation:', error);
      showToast('Failed to open conversation. Please try again.', 'error');
    }
  };

  const handleSendMessage = (message: string, recipientId?: string): void => {
    if (recipientId) {
      // Find the chat with this recipient
      const existingChat = combinedChatList.find(chat => chat.participantId === recipientId);
      
      if (existingChat) {
        // Store message draft and open chat
        setMessageDraft(existingChat.id || recipientId, message);
        handleChatClick(existingChat);
      } else {
        // Create a new chat entry for this recipient
        console.log('Creating new chat with:', recipientId, 'Message:', message);
        showToast('Starting new conversation...', 'success');
      }
    }
  };

  const handleProfileClick = (participantId: string): void => {
    openModal('isProfileDetailModalOpen', participantId);
  };

  const handleSearchEnter = (): void => {
    if (searchQuery.trim()) {
      console.log('Executing immediate search for:', searchQuery);
    }
  };

  // Render logic
  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: 'rgba(235, 235, 245, 0.6)'
        }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua mx-auto mb-4"></div>
          <p>Loading conversations...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: '#ef4444'
        }}>
          <p>{error.message || 'Failed to load conversations'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-aqua text-white rounded-lg hover:bg-aqua-dark transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    if (combinedChatList.length === 0 && searchQuery) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: 'rgba(235, 235, 245, 0.6)'
        }}>
          <p>No conversations found matching "{searchQuery}"</p>
        </div>
      );
    }

    if (combinedChatList.length === 0 && !searchQuery) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: 'rgba(235, 235, 245, 0.6)'
        }}>
          <p>No conversations yet. Start chatting to see them here!</p>
        </div>
      );
    }

    return (
      <>
        {/* Search Loading State with Skeleton */}
        {isSearching && searchQuery.trim() && (
          <div className="mb-6" role="region" aria-label="Search results loading">
            <SearchResultsSkeleton count={3} />
          </div>
        )}

        {/* Chat List */}
        <div data-testid="chat-list" style={{ marginBottom: '20px', paddingBottom: '4px' }}>
          {combinedChatList.map((chat) => (
            <ChatListItem
              key={chat.id || `pseudo-${chat.participantId}`}
              chat={chat}
              onClick={() => handleChatClick(chat)}
              onProfileClick={handleProfileClick}
              enableAISummary={isFeatureEnabled('AI_CONVERSATION_SUMMARIES')}
              data-testid="chat-item"
            />
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Fixed Header Section */}
      <FixedHeader>
        {/* Header */}
        <div className="flex justify-between items-center py-3">
          <div>
            <h1 className="text-2xl font-bold text-gradient-aqua-copper leading-tight">
              Chats
            </h1>
            <p className="text-secondary text-sm">
              {totalUnreadCount} unread messages
            </p>
          </div>
          <button
            onClick={() => openModal('isAddMyContactModalOpen')}
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
            onChange={handleSearchQueryChange}
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
            loading={isSearching}
            aria-label="Search for friends and conversations"
            aria-describedby="search-help"
          />
        </div>

        {/* Rank Toggle */}
        <div className="flex justify-end pb-2">
          <RankToggle 
            value={sortBy} 
            onChange={setSortBy} 
          />
        </div>
      </FixedHeader>

      {/* Scrollable Content Area */}
      <div className="pt-60 pb-4 px-4 min-h-screen">
        <div className="max-w-sm mx-auto">
          {renderContent()}

          {/* Intelligent Message Box */}
          {isFeatureEnabled('INTELLIGENT_MESSAGE_BOX') && (
            <IntelligentMessageBox onSendMessage={handleSendMessage} />
          )}
        </div>
      </div>

      {/* Modals */}
      {modals.conversationModalOpen && (
        <ConversationModal 
          isOpen={modals.conversationModalOpen}
          onClose={() => closeModal('conversationModalOpen')}
          chat={null} // TODO: Add selectedChat to uiStore
          initialMessage={""} // TODO: Get from message drafts
        />
      )}

      {modals.isAddMyContactModalOpen && (
        <AddMyContactModal
          isOpen={modals.isAddMyContactModalOpen}
          onClose={() => closeModal('isAddMyContactModalOpen')}
        />
      )}

      {modals.isProfileDetailModalOpen && modals.selectedUserId && (
        <ProfileDetailModal
          userId={modals.selectedUserId}
          onClose={() => closeModal('isProfileDetailModalOpen')}
        />
      )}

      {/* Toast Notification */}
      {toast.isVisible && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={hideToast}
        />
      )}
    </div>
  );
};

export default ChatPageRefactored;