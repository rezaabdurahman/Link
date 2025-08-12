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
  register: (name: string) => object; // react-hook-form register function
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
            w-full pl-11 pr-${rightElement || showPasswordToggle ? '12' : '4'} py-4 bg-surface-card border rounded-2xl
            text-gray-900 placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-aqua/50 focus:border-aqua
            transition-colors duration-200
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
