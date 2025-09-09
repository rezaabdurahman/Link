import React, { useState, useEffect } from 'react';
import { Chat } from '../types';
import { getConversationSummaryWithFallback } from '../services/summarygenClient';
import { useFeatureConsent, useConsentSelectors } from '../stores/consentStore';
import { AIConsentModal } from './consent/AIConsentModal';

interface ChatListItemProps {
  chat: Chat;
  onClick: () => void;
  onProfileClick?: (participantId: string) => void; // New prop for profile picture clicks
  enableAISummary?: boolean; // Optional prop to enable AI summary fetching
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onClick, onProfileClick, enableAISummary = false }): JSX.Element => {
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isLoadingAISummary, setIsLoadingAISummary] = useState<boolean>(false);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  
  // Consent management
  const { canUseChatSummaries, requireAIConsent } = useFeatureConsent();
  const { hasAIProcessingConsent } = useConsentSelectors();
  
  // Fetch AI summary if enabled and user has consent
  useEffect(() => {
    if (!enableAISummary) return;
    
    const fetchAISummary = async () => {
      // Check if user has required consents for AI features
      if (!canUseChatSummaries) {
        console.log('AI summary skipped: User consent required');
        setAiSummary('');
        return;
      }
      
      setIsLoadingAISummary(true);
      try {
        // Validate consent before making API call
        requireAIConsent();
        
        const summary = await getConversationSummaryWithFallback(
          chat.id, 
          chat.conversationSummary || 'No summary available'
        );
        setAiSummary(summary);
      } catch (error) {
        if (error instanceof Error && error.name === 'ConsentValidationError') {
          console.log('AI summary blocked: Missing consent -', error.message);
          setAiSummary('');
          // Optionally show consent modal
          // setShowConsentModal(true);
        } else {
          console.warn(`Failed to fetch AI summary for chat ${chat.id}:`, error);
          setAiSummary(chat.conversationSummary || 'No summary available');
        }
      } finally {
        setIsLoadingAISummary(false);
      }
    };
    
    fetchAISummary();
  }, [chat.id, chat.conversationSummary, enableAISummary, canUseChatSummaries, requireAIConsent]);
  
  // Determine which summary to display
  const displaySummary = enableAISummary 
    ? (aiSummary || chat.conversationSummary || 'No summary available')
    : (chat.conversationSummary || 'No summary available');

  // Handle consent modal actions
  const handleConsentAccept = () => {
    setShowConsentModal(false);
    // Refresh will be triggered by the useEffect when consent state changes
  };

  const handleConsentDecline = () => {
    setShowConsentModal(false);
  };
  
  // Show consent prompt for AI features
  const handleShowConsentPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConsentModal(true);
  };
  
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString();
  };

  // Create accessible description for screen readers
  const accessibleLabel = `${chat.participantName}, ${
    chat.unreadCount > 0 ? `${chat.unreadCount} unread message${chat.unreadCount > 1 ? 's' : ''}, ` : ''
  }last message: ${chat.lastMessage.content}, ${formatTime(chat.lastMessage.timestamp)}`;

  return (
    <article 
      className="haptic-light focus:outline-none focus:ring-2 focus:ring-aqua/50 focus:ring-offset-2 rounded-lg"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 0',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        cursor: 'pointer'
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={accessibleLabel}
      aria-describedby={`chat-summary-${chat.id || chat.participantId}`}
    >
      {/* Profile Picture */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={chat.participantAvatar}
          alt={chat.participantName}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the chat click
            onProfileClick?.(chat.participantId);
          }}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            objectFit: 'cover',
            cursor: onProfileClick ? 'pointer' : 'inherit',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (onProfileClick) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 122, 255, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (onProfileClick) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        />
      </div>

      {/* Chat Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '4px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: chat.unreadCount > 0 ? '#1f2937' : '#374151',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {chat.participantName}
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {formatTime(chat.lastMessage.timestamp)}
            </span>
            {chat.unreadCount > 0 && (
              <div style={{
                background: '#007AFF',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '10px',
                minWidth: '18px',
                textAlign: 'center'
              }}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </div>
            )}
          </div>
        </div>

        {/* Conversation Summary */}
        <div style={{
          fontSize: '12px',
          color: '#06b6d4',
          margin: '0 0 6px 0',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>Summary:</span>
          {enableAISummary && isLoadingAISummary ? (
            <span style={{ 
              fontSize: '10px',
              color: '#9ca3af',
              fontStyle: 'italic'
            }}>
              Generating...
            </span>
          ) : enableAISummary && !canUseChatSummaries ? (
            <button
              onClick={handleShowConsentPrompt}
              style={{
                background: 'none',
                border: '1px solid #06b6d4',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '10px',
                color: '#06b6d4',
                cursor: 'pointer',
                fontStyle: 'italic',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#06b6d4';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#06b6d4';
              }}
            >
              Enable AI
            </button>
          ) : (
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {displaySummary}
            </span>
          )}
        </div>

        {/* Last Message */}
        <p style={{
          fontSize: '14px',
          color: chat.unreadCount > 0 ? '#374151' : '#6b7280',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          // Add italic styling for pseudo-chats (blank conversations)
          fontStyle: (!chat.id && chat.lastMessage.content === 'Start a conversation') ? 'italic' : 'normal',
          opacity: (!chat.id && chat.lastMessage.content === 'Start a conversation') ? 0.7 : 1
        }}>
          {chat.lastMessage.senderId !== '1' && chat.lastMessage.content !== 'Start a conversation' && (
            <span style={{ fontWeight: '500' }}>{chat.participantName}: </span>
          )}
          {chat.lastMessage.content}
        </p>
      </div>

      {/* AI Consent Modal */}
      {showConsentModal && (
        <AIConsentModal
          isOpen={showConsentModal}
          onClose={() => setShowConsentModal(false)}
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
          showDataAnonymization={true}
        />
      )}
    </article>
  );
};

export default ChatListItem;
