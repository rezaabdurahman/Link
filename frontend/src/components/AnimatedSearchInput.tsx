import React from 'react';
import { Search } from 'lucide-react';
import { useTypingAnimation } from '../hooks/useTypingAnimation';

interface AnimatedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  suggestions?: string[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const AnimatedSearchInput: React.FC<AnimatedSearchInputProps> = ({
  value,
  onChange,
  onEnter,
  suggestions = [
    'find me a tall guy with blue eyes',
    'find me a venture capitalist',
    'find me someone into hiking',
    'find me a coffee enthusiast',
    'find me a creative soul'
  ],
  className = '',
  placeholder = 'Search...',
  disabled = false,
  loading = false,
  'aria-label': ariaLabel = 'Search input with animated suggestions',
  'aria-describedby': ariaDescribedBy
}): JSX.Element => {
  const { displayText } = useTypingAnimation({
    texts: suggestions,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
    loop: true
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && onEnter) {
      onEnter();
    }
  };

  return (
    <div className={`relative fade-in ${className}`}>
      <Search 
        size={20} 
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted pointer-events-none z-10" 
      />
      
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`ios-text-field w-full pl-11 pr-4 py-2.5 text-black placeholder:text-transparent relative z-0 fade-in ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        placeholder={value ? '' : placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-busy={loading}
        role="searchbox"
        autoComplete="off"
        spellCheck={false}
      />
      
      {/* Animated placeholder overlay */}
      {!value && (
        <div className="absolute left-11 top-1/2 transform -translate-y-1/2 pointer-events-none z-5">
          <span className="text-text-muted text-base select-none">
            {displayText}
            <span className="inline-block w-0.5 h-4 bg-aqua/70 ml-0.5 animate-cursor-blink" />
          </span>
        </div>
      )}
    </div>
  );
};

export default AnimatedSearchInput;
