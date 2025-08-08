import React from 'react';
import { Clock, MapPin, Users, Sparkles, Calendar, X, Check } from 'lucide-react';
import { Opportunity, User } from '../types';
import { nearbyUsers } from '../data/mockData';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onAccept: () => void;
  onDismiss: () => void;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, onAccept, onDismiss }): JSX.Element => {
  const getTypeIcon = (): React.ReactNode => {
    switch (opportunity.type) {
      case 'reminder':
        return <Clock size={20} color="#FF9500" />;
      case 'ai-suggestion':
        return <Sparkles size={20} color="#007AFF" />;
      case 'seasonal':
        return <Calendar size={20} color="#34C759" />;
      case 'group-pairing':
        return <Users size={20} color="#FF69B4" />;
      default:
        return <Calendar size={20} color="#007AFF" />;
    }
  };

  const getTypeColor = (): string => {
    switch (opportunity.type) {
      case 'reminder':
        return 'rgba(255, 149, 0, 0.1)';
      case 'ai-suggestion':
        return 'rgba(0, 122, 255, 0.1)';
      case 'seasonal':
        return 'rgba(52, 199, 89, 0.1)';
      case 'group-pairing':
        return 'rgba(255, 105, 180, 0.1)';
      default:
        return 'rgba(0, 122, 255, 0.1)';
    }
  };

  const getTypeBorderColor = (): string => {
    switch (opportunity.type) {
      case 'reminder':
        return 'rgba(255, 149, 0, 0.3)';
      case 'ai-suggestion':
        return 'rgba(0, 122, 255, 0.3)';
      case 'seasonal':
        return 'rgba(52, 199, 89, 0.3)';
      case 'group-pairing':
        return 'rgba(255, 105, 180, 0.3)';
      default:
        return 'rgba(0, 122, 255, 0.3)';
    }
  };

  const getSuggestedFriends = (): (User | undefined)[] => {
    return opportunity.suggestedFriends.map(friendId => 
      nearbyUsers.find(user => user.id === friendId)
    ).filter(Boolean);
  };

  const formatDueDate = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString();
  };

  const suggestedFriends = getSuggestedFriends();

  return (
    <div 
      className="ios-card fade-in" 
      style={{ 
        padding: '20px', 
        marginBottom: '16px',
        background: getTypeColor(),
        borderColor: getTypeBorderColor()
      }}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {getTypeIcon()}
          <div>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600',
              marginBottom: '4px'
            }}>
              {opportunity.title}
            </h3>
            {opportunity.dueDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} className="text-secondary" />
                <span className="text-secondary" style={{ fontSize: '12px' }}>
                  {formatDueDate(opportunity.dueDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-secondary" style={{ 
        fontSize: '14px', 
        lineHeight: '1.4',
        marginBottom: '16px'
      }}>
        {opportunity.description}
      </p>

      {/* Suggested Friends */}
      {suggestedFriends.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Users size={16} className="text-accent" />
            <span className="text-accent" style={{ fontSize: '12px', fontWeight: '500' }}>
              Suggested friends
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {suggestedFriends.slice(0, 3).map((friend) => (
              <div key={friend?.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <img
                  src={friend?.profilePicture}
                  alt={friend?.name}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
                <span style={{ fontSize: '12px', color: 'rgba(235, 235, 245, 0.8)' }}>
                  {friend?.name.split(' ')[0]}
                </span>
              </div>
            ))}
            {suggestedFriends.length > 3 && (
              <span style={{ 
                fontSize: '12px', 
                color: 'rgba(235, 235, 245, 0.6)',
                marginLeft: '4px'
              }}>
                +{suggestedFriends.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Location */}
      {opportunity.location && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          marginBottom: '16px'
        }}>
          <MapPin size={12} className="text-secondary" />
          <span className="text-secondary" style={{ fontSize: '12px' }}>
            {opportunity.location}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            color: 'rgba(235, 235, 245, 0.6)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background 0.2s ease'
          }}
          className="haptic-light"
        >
          <X size={16} />
          Dismiss
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
          style={{
            flex: 2,
            background: '#007AFF',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background 0.2s ease'
          }}
          className="haptic-light"
        >
          <Check size={16} />
          Let's do it!
        </button>
      </div>
    </div>
  );
};

export default OpportunityCard;
