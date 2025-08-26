
import React, { useState } from 'react';
import { Ban } from 'lucide-react';
import { blockUser, getBlockingErrorMessage, AuthServiceError } from '../services/userClient';
import ConfirmationModal from './ConfirmationModal';

interface BlockButtonProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outline' | 'minimal';
  className?: string;
  onBlock?: (userId: string) => void; // Optional callback when user is blocked
}

const BlockButton: React.FC<BlockButtonProps> = ({ 
  userId, 
  size = 'medium', 
  variant = 'default',
  className = '',
  onBlock
}): JSX.Element => {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirmation(true);
  };

  const confirmBlock = async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    
    try {
      await blockUser(userId);
      
      // Handle callback separately to not fail the entire operation if callback fails
      try {
        onBlock?.(userId);
      } catch (callbackError) {
        console.error('Block callback failed:', callbackError);
        // Don't fail the entire operation if callback fails
      }
      
      setShowConfirmation(false);
    } catch (err: any) {
      console.error('Block user action failed:', err);
      
      // Handle AuthServiceError properly
      if (err instanceof AuthServiceError) {
        setError(getBlockingErrorMessage(err.error));
      } else {
        setError('Failed to block user. Please try again.');
      }
      
      // Don't close the modal on error - let user see the error and decide
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBlock = (): void => {
    setShowConfirmation(false);
    setError(undefined);
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
    <>
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

      {/* Block Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={cancelBlock}
        onConfirm={confirmBlock}
        title="Block User"
        message="Are you sure you want to block this user? This will prevent both of you from seeing each other's profiles and messaging each other."
        confirmText="Block"
        cancelText="Cancel"
        confirmButtonClass="bg-red-500 hover:bg-red-600 text-white"
        loading={isLoading}
        error={error}
      />
    </>
  );
};

export default BlockButton;

