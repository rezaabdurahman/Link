import React from 'react';
import { Search } from 'lucide-react';
import { useTypingAnimation } from '../hooks/useTypingAnimation';

interface AnimatedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  className?: string;
}

const AnimatedSearchInput: React.FC<AnimatedSearchInputProps> = ({
  value,
  onChange,
  suggestions = [
    'find me a tall guy with blue eyes',
    'find me a venture capitalist',
    'find me someone into hiking',
    'find me a coffee enthusiast',
    'find me a creative soul'
  ],
  className = ''
}): JSX.Element => {
  const { displayText } = useTypingAnimation({
    texts: suggestions,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
    loop: true
  });

  return (
    <div className={`relative ${className}`}>
      <Search 
        size={20} 
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted pointer-events-none z-10" 
      />
      
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ios-text-field w-full pl-11 pr-4 py-2.5 bg-surface-hover/60 border-none rounded-ios text-black placeholder:text-transparent focus:ring-2 focus:ring-aqua/50 relative z-0"
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
