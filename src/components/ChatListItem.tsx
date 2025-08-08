import React from 'react';
import { Chat } from '../types';

interface ChatListItemProps {
  chat: Chat;
  onClick: () => void;
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onClick }): JSX.Element => {
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

  return (
    <div 
      className="haptic-light"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 0',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        cursor: 'pointer'
      }}
      onClick={onClick}
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
          fontWeight: '500'
        }}>
          Last: {chat.conversationSummary}
        </p>

        {/* Last Message */}
        <p style={{
          fontSize: '14px',
          color: chat.unreadCount > 0 ? '#374151' : '#6b7280',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {chat.lastMessage.senderId !== '1' && (
            <span style={{ fontWeight: '500' }}>{chat.participantName}: </span>
          )}
          {chat.lastMessage.content}
        </p>
      </div>
    </div>
  );
};

export default ChatListItem;
