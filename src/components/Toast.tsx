import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type, 
  isVisible, 
  onClose, 
  duration = 3000 
}): JSX.Element | null => {
  const [shouldRender, setShouldRender] = useState(false);
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting'>('entering');

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setAnimationState('entering');
      
      // Trigger visible state after a brief delay
      const enterTimer = setTimeout(() => {
        setAnimationState('visible');
      }, 50);
      
      // Auto-dismiss timer
      const dismissTimer = setTimeout(() => {
        setAnimationState('exiting');
        setTimeout(() => {
          onClose();
        }, 400);
      }, duration);

      return () => {
        clearTimeout(enterTimer);
        clearTimeout(dismissTimer);
      };
    } else {
      setAnimationState('exiting');
      // Delay unmounting to allow exit animation
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 400);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  if (!shouldRender) return null;

  const IconComponent = type === 'success' ? CheckCircle : XCircle;
  const bgColor = type === 'success' ? 'rgba(6, 182, 212, 0.95)' : 'rgba(239, 68, 68, 0.95)';
  const iconColor = '#ffffff';

  // Animation styles based on state
  const getAnimationStyles = () => {
    switch (animationState) {
      case 'entering':
        return {
          transform: 'translateY(-100px) scale(0.8)',
          opacity: 0,
        };
      case 'visible':
        return {
          transform: 'translateY(0px) scale(1)',
          opacity: 1,
        };
      case 'exiting':
        return {
          transform: 'translateY(-50px) scale(0.9)',
          opacity: 0,
        };
      default:
        return {
          transform: 'translateY(-100px) scale(0.8)',
          opacity: 0,
        };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '60px', // Below the status bar
        left: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: animationState === 'exiting' ? 'none' : 'auto',
      }}
    >
      <div
        onClick={onClose}
        style={{
          background: bgColor,
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          maxWidth: '90vw',
          minWidth: '280px',
          cursor: 'pointer',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          ...getAnimationStyles(),
        }}
      >
        <IconComponent size={18} style={{ color: iconColor, flexShrink: 0 }} />
        <span
          style={{
            color: iconColor,
            fontSize: '14px',
            fontWeight: '500',
            lineHeight: '1.3',
            wordBreak: 'break-word',
            flex: 1,
          }}
        >
          {message}
        </span>
      </div>
    </div>
  );
};

export default Toast;
