import React, { useCallback } from 'react';
import { UserPlus } from 'lucide-react';
import { useChatData } from '../hooks/useChatData';
import { useChatStore, useUIStore, useUserPreferencesStore } from '../stores';
import { Chat } from '../types';
import ChatListItem from '../components/ChatListItem';
import AnimatedSearchInput from '../components/AnimatedSearchInput';
import { isFeatureEnabled } from '../config/featureFlags';
import RankToggle from '../components/RankToggle';
import ConversationModal from '../components/ConversationModal';
import AddMyContactModal from '../components/AddMyContactModal';
import ProfileDetailModal from '../components/ProfileDetailModal';
import { SearchResultsSkeleton } from '../components/SkeletonShimmer';
import FixedHeader from '../components/layout/FixedHeader';
import Toast from '../components/Toast';
import { recordUserAction } from '../services/priorityClient';

const ChatPageRefactored: React.FC = (): JSX.Element => {
  const { preferences } = useUserPreferencesStore();
  const { 
    toast, 
    showToast, 
    hideToast,
    modals, 
    openModal, 
    closeModal,
    openConversationModal,
    closeConversationModal
  } = useUIStore();

  const {
    searchQuery,
    sortBy,
    setSearchQuery,
    setSortBy,
  } = useChatStore();

  // SWR data fetching with automatic refresh based on preferences
  const { 
    combinedChatList,
    isLoading, 
    isSearching,
    isLoadingMore,
    searchHasMore,
    searchTotalResults,
    searchOffset,
    error, 
    createChat,
    loadMoreFriends,
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
      let finalChat = chat;
      
      if (!chat.id) {
        // No existing conversation - create new one (action recording handled in useChatData)
        finalChat = await createChat(chat.participantId);
      } else {
        // Existing conversation - record the interaction
        try {
          await recordUserAction({
            actionType: 'conversation_opened',
            conversationId: chat.id,
            metadata: {
              created_new: false,
              participant_id: chat.participantId,
              timestamp: new Date().toISOString(),
              from_priority_sort: sortBy === 'priority'
            }
          });
        } catch (actionError) {
          // Don't fail the main action if recording fails
          console.warn('Failed to record conversation interaction:', actionError);
        }
      }
      
      // Open conversation modal with selected chat
      openConversationModal(finalChat);
      
    } catch (error) {
      console.error('Failed to open conversation:', error);
      showToast('Failed to open conversation. Please try again.', 'error');
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
        
        {/* Load More Friends Button */}
        {searchQuery.trim() && searchHasMore && (
          <div className="flex flex-col items-center py-6 px-4">
            <p className="text-sm text-secondary mb-3 text-center">
              Showing {searchOffset} of {searchTotalResults} friends
            </p>
            <button
              onClick={loadMoreFriends}
              disabled={isLoadingMore}
              className="w-full max-w-xs px-6 py-3 bg-aqua text-white rounded-lg font-medium
                         hover:bg-aqua-dark active:scale-95 transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                         flex items-center justify-center gap-2"
              data-testid="load-more-friends"
            >
              {isLoadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Loading more friends...
                </>
              ) : (
                <>
                  Load More Friends
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                    +{searchTotalResults - searchOffset} remaining
                  </span>
                </>
              )}
            </button>
          </div>
        )}
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

        </div>
      </div>

      {/* Modals */}
      {modals.conversationModalOpen && modals.selectedChat && (
        <ConversationModal 
          isOpen={modals.conversationModalOpen}
          onClose={closeConversationModal}
          chat={modals.selectedChat}
          initialMessage={modals.initialMessage}
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