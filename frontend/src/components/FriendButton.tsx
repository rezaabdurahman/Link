import React from 'react';
import { UserPlus, UserMinus, Clock, Check } from 'lucide-react';
import { useFriendRequests } from '../hooks/useFriendRequests';

interface FriendButtonProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outline' | 'minimal';
  className?: string;
}

interface FriendButtonMiniProps {
  userId: string;
  className?: string;
}

const FriendButton: React.FC<FriendButtonProps> = ({ 
  userId, 
  size = 'medium', 
  variant = 'default',
  className = '' 
}): JSX.Element => {
  const { 
    getFriendshipStatus, 
    sendFriendRequest, 
    removeFriend, 
    isLoading 
  } = useFriendRequests();

  const friendshipStatus = getFriendshipStatus(userId);
  
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (friendshipStatus.status === 'friends') {
        await removeFriend(userId);
      } else if (friendshipStatus.canSendRequest) {
        await sendFriendRequest(userId);
      }
    } catch (error) {
      console.error('Friend button action failed:', error);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'px-2 py-1 text-xs';
      case 'large':
        return 'px-6 py-3 text-base';
      case 'medium':
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const getVariantClasses = () => {
    const baseClasses = 'font-medium rounded-full transition-all duration-200 flex items-center gap-2 hover-scale';
    
    switch (variant) {
      case 'outline':
        return `${baseClasses} border-2 bg-transparent hover:bg-gray-50`;
      case 'minimal':
        return `${baseClasses} bg-transparent hover:bg-gray-100`;
      case 'default':
      default:
        return `${baseClasses} shadow-sm hover:shadow-md hover-glow`;
    }
  };

  const getStatusStyles = () => {
    switch (friendshipStatus.status) {
      case 'friends':
        return variant === 'outline' 
          ? 'border-red-500 text-red-600 hover:bg-red-50' 
          : 'bg-red-500 text-white hover:bg-red-600';
      
      case 'pending_sent':
        return variant === 'outline'
          ? 'border-gray-400 text-gray-600 hover:bg-gray-50'
          : 'bg-gray-400 text-white cursor-not-allowed';
      
      case 'pending_received':
        return variant === 'outline'
          ? 'border-aqua text-aqua hover:bg-aqua/10'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300';
      
      case 'none':
      default:
        return variant === 'outline'
          ? 'border-aqua text-aqua hover:bg-aqua/10'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300';
    }
  };

  const getButtonText = () => {
    switch (friendshipStatus.status) {
      case 'friends':
        return size === 'small' ? '' : 'Remove';
      case 'pending_sent':
        return size === 'small' ? '' : 'Pending';
      case 'pending_received':
        return size === 'small' ? '' : 'Accept';
      case 'none':
      default:
        return size === 'small' ? '' : 'Add Friend';
    }
  };

  const getIcon = () => {
    const iconSize = size === 'small' ? 14 : size === 'large' ? 20 : 16;
    
    switch (friendshipStatus.status) {
      case 'friends':
        return <UserMinus size={iconSize} />;
      case 'pending_sent':
        return <Clock size={iconSize} />;
      case 'pending_received':
        return <Check size={iconSize} />;
      case 'none':
      default:
        return <UserPlus size={iconSize} />;
    }
  };

  const isDisabled = friendshipStatus.status === 'pending_sent' || isLoading;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        ${getVariantClasses()}
        ${getSizeClasses()}
        ${getStatusStyles()}
        ${isDisabled ? 'opacity-70 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {getIcon()}
      {size !== 'small' && getButtonText()}
    </button>
  );
};

// Mini version for overlays and compact spaces
export const FriendButtonMini: React.FC<FriendButtonMiniProps> = ({ 
  userId, 
  className = '' 
}): JSX.Element => {
  const { 
    getFriendshipStatus, 
    sendFriendRequest, 
    removeFriend, 
    isLoading 
  } = useFriendRequests();

  const friendshipStatus = getFriendshipStatus(userId);
  
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (friendshipStatus.status === 'friends') {
        await removeFriend(userId);
      } else if (friendshipStatus.canSendRequest) {
        await sendFriendRequest(userId);
      }
    } catch (error) {
      console.error('Friend button action failed:', error);
    }
  };

  const getStatusStyles = () => {
    switch (friendshipStatus.status) {
      case 'friends':
        return 'bg-red-500 hover:bg-red-600';
      case 'pending_sent':
        return 'bg-gray-400 cursor-not-allowed';
      case 'pending_received':
        return 'bg-gray-200 text-gray-800 hover:bg-gray-300';
      case 'none':
      default:
        return 'bg-gray-200 text-gray-800 hover:bg-gray-300';
    }
  };

  const getIcon = () => {
    switch (friendshipStatus.status) {
      case 'friends':
        return <UserMinus size={14} />;
      case 'pending_sent':
        return <Clock size={14} />;
      case 'pending_received':
        return <Check size={14} />;
      case 'none':
      default:
        return <UserPlus size={14} />;
    }
  };

  const isDisabled = friendshipStatus.status === 'pending_sent' || isLoading;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        w-8 h-8 rounded-full text-white flex items-center justify-center
        shadow-lg backdrop-blur-sm transition-all duration-200
        ${getStatusStyles()}
        ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110'}
        ${className}
      `}
    >
      {getIcon()}
    </button>
  );
};

export default FriendButton;
