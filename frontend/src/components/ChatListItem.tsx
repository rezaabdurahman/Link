import React, { useState, useEffect } from 'react';
import { Chat } from '../types';
import { getConversationSummaryWithFallback } from '../services/aiClient';

interface ChatListItemProps {
  chat: Chat;
  onClick: () => void;
  enableAISummary?: boolean; // Optional prop to enable AI summary fetching
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onClick, enableAISummary = false }): JSX.Element => {
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isLoadingAISummary, setIsLoadingAISummary] = useState<boolean>(false);
  
  // Fetch AI summary if enabled
  useEffect(() => {
    if (!enableAISummary) return;
    
    const fetchAISummary = async () => {
      setIsLoadingAISummary(true);
      try {
        const summary = await getConversationSummaryWithFallback(
          chat.id, 
          chat.conversationSummary || 'No summary available'
        );
        setAiSummary(summary);
      } catch (error) {
        console.warn(`Failed to fetch AI summary for chat ${chat.id}:`, error);
        setAiSummary(chat.conversationSummary || 'No summary available');
      } finally {
        setIsLoadingAISummary(false);
      }
    };
    
    fetchAISummary();
  }, [chat.id, chat.conversationSummary, enableAISummary]);
  
  // Determine which summary to display
  const displaySummary = enableAISummary 
    ? (aiSummary || chat.conversationSummary || 'No summary available')
    : (chat.conversationSummary || 'No summary available');
  
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
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
        />
        {chat.priority === 1 && (
          <div style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '16px',
            height: '16px',
            background: '#FF9500',
            borderRadius: '50%',
            border: '2px solid #000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '8px', fontWeight: 'bold' }}>★</span>
          </div>
        )}
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
        <p style={{
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
          ) : (
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {displaySummary}
            </span>
          )}
        </p>

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
    </article>
  );
};

export default ChatListItem;
