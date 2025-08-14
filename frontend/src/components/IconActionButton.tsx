import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button, ButtonVariant, ButtonSize } from './ui/Button';

interface IconActionButtonProps {
  label: string;                   // aria-label for accessibility
  Icon: LucideIcon;               // Lucide icon component
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  title?: string;                 // tooltip text
  loading?: boolean;
}

// Map legacy size names to new standardized sizes
const mapLegacySize = (size: 'small' | 'medium' | 'large'): ButtonSize => {
  const sizeMap = {
    small: 'sm' as const,
    medium: 'md' as const, 
    large: 'lg' as const,
  };
  return sizeMap[size];
};

// Map legacy variants to new standardized variants
const mapLegacyVariant = (variant: 'primary' | 'secondary' | 'danger'): ButtonVariant => {
  const variantMap = {
    primary: 'primary' as const,
    secondary: 'outline' as const,  // Map secondary to outline for icon buttons
    danger: 'danger' as const,
  };
  return variantMap[variant];
};

const IconActionButton: React.FC<IconActionButtonProps> = ({
  label,
  Icon,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  size = 'medium',
  title,
  loading = false,
  ...props
}): JSX.Element => {
  const mappedSize = mapLegacySize(size);
  const mappedVariant = mapLegacyVariant(variant);

  // Icon-only button style overrides
  const iconButtonStyles = {
    xs: 'w-8 h-8 p-0',      // 32px square
    sm: 'w-10 h-10 p-0',    // 40px square  
    md: 'w-12 h-12 p-0',    // 48px square
    lg: 'w-14 h-14 p-0',    // 56px square
    xl: 'w-16 h-16 p-0',    // 64px square
  };

  const iconButtonClass = `
    ${iconButtonStyles[mappedSize]}
    rounded-full
    hover-glow
    focus-visible:ring-offset-0
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <Button
      variant={mappedVariant}
      size={mappedSize}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      aria-label={label}
      title={title || label}
      className={iconButtonClass}
      icon={Icon}
      {...props}
    >
      <span className="sr-only">{label}</span>
    </Button>
  );
};

export default IconActionButton;
