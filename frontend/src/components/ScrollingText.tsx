import React, { useEffect, useRef, useState } from 'react';

interface ScrollingTextProps {
  text: string;
  className?: string;
}

const ScrollingText: React.FC<ScrollingTextProps> = ({ text, className = '' }): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        setShouldScroll(textWidth > containerWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div 
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap ${className}`}
    >
      <span
        ref={textRef}
        className={`inline-block ${shouldScroll ? 'animate-scroll-text' : ''}`}
        style={{
          animationDuration: shouldScroll ? '12s' : '0s', // Fixed duration for consistency
          animationDelay: '2s' // Increased delay for better sync
        }}
      >
        {text}
      </span>
    </div>
  );
};

export default ScrollingText;
