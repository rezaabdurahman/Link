import React from 'react';
import { LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
  asChild?: boolean;
}

interface LoadingSpinnerProps {
  size?: ButtonSize;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4', 
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-spin rounded-full border-2 border-current border-t-transparent" />
    </div>
  );
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled = false,
  className = '',
  children,
  asChild = false,
  ...props
}) => {
  // Size classes using standardized tokens
  const sizeClasses = {
    xs: 'h-8 px-2 text-xs gap-1 rounded-md',      // 32px height
    sm: 'h-10 px-3 text-sm gap-2 rounded-ios',    // 40px height  
    md: 'h-12 px-4 text-base gap-2 rounded-ios',  // 48px height (default)
    lg: 'h-14 px-6 text-lg gap-3 rounded-ios',    // 56px height
    xl: 'h-16 px-8 text-xl gap-3 rounded-card',   // 64px height
  };

  // Icon sizes for each button size
  const iconSizes = {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
  };

  // Variant classes using design system tokens
  const variantClasses = {
    primary: `
      bg-aqua hover:bg-aqua-dark active:bg-aqua-deeper 
      text-text-inverse font-semibold
      shadow-sm hover:shadow-md hover:shadow-aqua/20
      disabled:bg-gray-300 disabled:shadow-none
    `,
    secondary: `
      bg-surface-hover hover:bg-surface-border active:bg-gray-300
      text-text-primary font-medium
      border border-surface-border hover:border-gray-300
      disabled:bg-gray-100 disabled:text-text-muted
    `,
    outline: `
      bg-transparent hover:bg-surface-hover active:bg-surface-border
      text-text-primary font-medium  
      border border-surface-border hover:border-aqua
      disabled:border-gray-200 disabled:text-text-muted
    `,
    ghost: `
      bg-transparent hover:bg-surface-hover active:bg-surface-border
      text-text-primary font-medium
      disabled:text-text-muted
    `,
    danger: `
      bg-semantic-danger hover:bg-red-600 active:bg-red-700
      text-text-inverse font-semibold
      shadow-sm hover:shadow-md hover:shadow-red-500/20
      disabled:bg-gray-300 disabled:shadow-none
    `,
  };

  const baseClasses = `
    inline-flex items-center justify-center
    transition-all duration-200 ease-in-out
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/50 focus-visible:ring-offset-2
    disabled:cursor-not-allowed disabled:opacity-60
    ${fullWidth ? 'w-full' : ''}
    ${loading ? 'cursor-wait' : ''}
  `.replace(/\s+/g, ' ').trim();

  const combinedClassName = `
    ${baseClasses}
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  const isDisabled = disabled || loading;

  const content = (
    <>
      {loading && <LoadingSpinner size={size} className="mr-2" />}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon size={iconSizes[size]} className="flex-shrink-0" />
      )}
      
      <span className={loading ? 'opacity-70' : ''}>
        {children}
      </span>
      
      {!loading && Icon && iconPosition === 'right' && (
        <Icon size={iconSizes[size]} className="flex-shrink-0" />
      )}
    </>
  );

  if (asChild) {
    // Return children with applied classes (for composition patterns)
    return React.cloneElement(
      React.Children.only(children) as React.ReactElement,
      {
        className: combinedClassName,
        disabled: isDisabled,
        ...props,
      }
    );
  }

  return (
    <button
      className={combinedClassName}
      disabled={isDisabled}
      {...props}
    >
      {content}
    </button>
  );
};

// Export LoadingSpinner for standalone use
export { LoadingSpinner };

export default Button;
