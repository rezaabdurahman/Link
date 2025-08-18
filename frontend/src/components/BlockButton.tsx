
import React, { useState } from 'react';
import { Ban } from 'lucide-react';
import { blockUser } from '../services/userClient';

interface BlockButtonProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outline' | 'minimal';
  className?: string;
}

const BlockButton: React.FC<BlockButtonProps> = ({ 
  userId, 
  size = 'medium', 
  variant = 'default',
  className = '' 
}): JSX.Element => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsLoading(true);
    try {
      await blockUser(userId);
    } catch (error) {
      console.error('Block button action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'p-2';
      case 'large':
        return 'p-4';
      case 'medium':
      default:
        return 'p-3';
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
    return variant === 'outline' 
      ? 'border-red-500 text-red-600 hover:bg-red-50' 
      : 'bg-red-500 text-white hover:bg-red-600';
  };

  const getIcon = () => {
    const iconSize = size === 'small' ? 14 : size === 'large' ? 20 : 16;
    return <Ban size={iconSize} />;
  };

  const isDisabled = isLoading;

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
    </button>
  );
};

export default BlockButton;

