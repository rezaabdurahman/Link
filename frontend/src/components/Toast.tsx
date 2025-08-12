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
  const baseColor = type === 'success' ? '6, 182, 212' : '239, 68, 68';
  const iconColor = '#ffffff';

  // Animation styles based on state
  const getAnimationStyles = () => {
    switch (animationState) {
      case 'entering':
        return {
          transform: 'translateY(100px) scale(0.8)',
          opacity: 0,
        };
      case 'visible':
        return {
          transform: 'translateY(0px) scale(1)',
          opacity: 1,
        };
      case 'exiting':
        return {
          transform: 'translateY(20px) scale(0.95)',
          opacity: 0,
        };
      default:
        return {
          transform: 'translateY(100px) scale(0.8)',
          opacity: 0,
        };
    }
  };

  // Get background opacity based on animation state for enhanced transparency effect
  const getBackgroundOpacity = () => {
    switch (animationState) {
      case 'entering':
        return 0;
      case 'visible':
        return type === 'success' ? 0.95 : 0.95;
      case 'exiting':
        return 0;
      default:
        return 0;
    }
  };

  // Get text opacity for smooth text fade transition
  const getTextOpacity = () => {
    switch (animationState) {
      case 'entering':
        return 0;
      case 'visible':
        return 1;
      case 'exiting':
        return 0;
      default:
        return 0;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px', // Above the navigation bar
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
          background: `rgba(${baseColor}, ${getBackgroundOpacity()})`,
          backdropFilter: `blur(${animationState === 'exiting' ? '10px' : '20px'})`,
          borderRadius: '16px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: animationState === 'exiting' 
            ? '0 6px 20px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.05)'
            : '0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
          border: `1px solid rgba(255, 255, 255, ${animationState === 'exiting' ? '0.1' : '0.25'})`,
          maxWidth: '90vw',
          minWidth: '280px',
          cursor: 'pointer',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.3s ease-out, backdrop-filter 0.3s ease-out, box-shadow 0.3s ease-out, border 0.3s ease-out',
          ...getAnimationStyles(),
        }}
      >
        <IconComponent 
          size={18} 
          style={{ 
            color: iconColor, 
            flexShrink: 0,
            opacity: getTextOpacity(),
            transition: 'opacity 0.3s ease-out'
          }} 
        />
        <span
          style={{
            color: iconColor,
            fontSize: '14px',
            fontWeight: '500',
            lineHeight: '1.3',
            wordBreak: 'break-word',
            flex: 1,
            opacity: getTextOpacity(),
            transition: 'opacity 0.3s ease-out'
          }}
        >
          {message}
        </span>
      </div>
    </div>
  );
};

export { Toast };
export default Toast;
