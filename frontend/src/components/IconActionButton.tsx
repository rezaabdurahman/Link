import React from 'react';
import { LucideIcon } from 'lucide-react';

interface IconActionButtonProps {
  label: string;                   // aria-label for accessibility
  Icon: LucideIcon;               // Lucide icon component
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  title?: string;                 // tooltip text
}

const IconActionButton: React.FC<IconActionButtonProps> = ({
  label,
  Icon,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  size = 'medium',
  title
}): JSX.Element => {
  // Define size classes
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16'
  };

  // Define icon sizes
  const iconSizes = {
    small: 16,
    medium: 20,
    large: 24
  };

  // Define variant classes
  const variantClasses = {
    primary: 'bg-aqua hover:bg-aqua-dark text-white',
    secondary: 'bg-surface-hover hover:bg-surface-card text-text-secondary hover:text-text-primary',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };

  const baseClasses = `
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    rounded-full 
    flex 
    items-center 
    justify-center 
    hover-glow 
    transition-all 
    duration-200 
    focus:outline-none 
    focus:ring-2 
    focus:ring-aqua/50 
    focus:ring-offset-2 
    focus:ring-offset-surface-dark
    disabled:opacity-50 
    disabled:cursor-not-allowed 
    disabled:hover:bg-opacity-50
    haptic-light
  `.replace(/\s+/g, ' ').trim();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title || label}
      className={`${baseClasses} ${className}`}
    >
      <Icon size={iconSizes[size]} />
    </button>
  );
};

export default IconActionButton;
