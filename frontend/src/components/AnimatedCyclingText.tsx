import React, { useState, useEffect } from 'react';

interface AnimatedCyclingTextProps {
  words: string[];
  className?: string;
  duration?: number; // Duration each word is displayed (in ms)
  animationDuration?: number; // Duration of the transition animation (in ms)
}

const AnimatedCyclingText: React.FC<AnimatedCyclingTextProps> = ({
  words,
  className = '',
  duration = 2500,
  animationDuration = 500,
}): JSX.Element => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  useEffect(() => {
    if (words.length <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      
      // After animation duration, change the word and reset animation
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
        setIsAnimating(false);
      }, animationDuration / 2);
      
    }, duration);

    return () => clearInterval(interval);
  }, [words.length, duration, animationDuration]);

  return (
    <span 
      className={`
        inline-block relative
        ${className}
      `}
    >
      <span
        className={`
          inline-block transition-all ease-out
          ${isAnimating 
            ? 'opacity-0 transform translate-y-1' 
            : 'opacity-100 transform translate-y-0'
          }
        `}
        style={{
          transitionDuration: `${animationDuration}ms`,
          transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {words[currentIndex]}
      </span>
    </span>
  );
};

export default AnimatedCyclingText;
