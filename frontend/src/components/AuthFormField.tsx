import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AuthFormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password';
  placeholder: string;
  icon: LucideIcon;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: 'on' | 'off';
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  register: any; // react-hook-form register function - using any for compatibility
  rightElement?: React.ReactNode;
}

const AuthFormField: React.FC<AuthFormFieldProps> = ({
  label,
  name,
  type = 'text',
  placeholder,
  icon: Icon,
  error,
  disabled = false,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  showPasswordToggle = false,
  showPassword = false,
  onTogglePassword,
  register,
  rightElement,
}) => {
  const inputType = showPasswordToggle && showPassword ? 'text' : type;
  const inputId = `${name}-input`;
  const errorId = `${name}-error`;

  return (
    <div className="space-y-2">
      <label 
        htmlFor={inputId}
        className="block text-sm font-semibold text-gray-900"
      >
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Icon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          {...register(name)}
          id={inputId}
          type={inputType}
          placeholder={placeholder}
          className={`
            ios-text-field w-full pl-11 pr-${rightElement || showPasswordToggle ? '12' : '4'} py-4
            focus:hover-glow transition-all duration-200
            ${error 
              ? 'border-red-300 focus:ring-red-500/50 focus:border-red-500' 
              : 'border-gray-200'
            }
          `}
          disabled={disabled}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />
        {(rightElement || showPasswordToggle) && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            {showPasswordToggle && onTogglePassword ? (
              <button
                type="button"
                onClick={onTogglePassword}
                className="text-gray-400 hover:text-gray-600"
                disabled={disabled}
                aria-label="Toggle password visibility"
              >
                {rightElement}
              </button>
            ) : (
              rightElement
            )}
          </div>
        )}
      </div>
      {error && (
        <p 
          id={errorId}
          className="text-red-600 text-sm font-medium"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default AuthFormField;
