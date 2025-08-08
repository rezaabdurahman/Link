import { useState, useEffect, useRef } from 'react';

interface UseTypingAnimationProps {
  texts: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  loop?: boolean;
}

interface UseTypingAnimationReturn {
  displayText: string;
  isTyping: boolean;
  isDeleting: boolean;
  currentIndex: number;
}

export const useTypingAnimation = ({
  texts,
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseDuration = 2000,
  loop = true
}: UseTypingAnimationProps): UseTypingAnimationReturn => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const currentText = texts[currentIndex];
    
    const handleTyping = () => {
      if (isDeleting) {
        // Deleting phase
        if (displayText.length > 0) {
          setDisplayText(prev => prev.slice(0, -1));
          timeoutRef.current = setTimeout(handleTyping, deletingSpeed);
        } else {
          // Finished deleting, move to next text
          setIsDeleting(false);
          setIsTyping(true);
          setCurrentIndex(prev => loop ? (prev + 1) % texts.length : Math.min(prev + 1, texts.length - 1));
        }
      } else {
        // Typing phase
        if (displayText.length < currentText.length) {
          setDisplayText(prev => currentText.slice(0, prev.length + 1));
          timeoutRef.current = setTimeout(handleTyping, typingSpeed);
        } else {
          // Finished typing, pause then start deleting
          setIsTyping(false);
          timeoutRef.current = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDuration);
        }
      }
    };

    timeoutRef.current = setTimeout(handleTyping, isDeleting ? deletingSpeed : typingSpeed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [displayText, currentIndex, isTyping, isDeleting, texts, typingSpeed, deletingSpeed, pauseDuration, loop]);

  return {
    displayText,
    isTyping,
    isDeleting,
    currentIndex
  };
};
