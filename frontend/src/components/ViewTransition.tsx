import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ViewTransitionProps {
  children: React.ReactNode;
  viewKey: string; // Unique key for the current view (e.g., 'grid' or 'feed')
  className?: string;
  animate?: boolean; // Allow disabling animation for browsers without JS
}

/**
 * ViewTransition component provides smooth animated transitions when switching between different views.
 * Uses Framer Motion for enhanced animations with fallback to CSS transitions.
 */
const ViewTransition: React.FC<ViewTransitionProps> = ({ 
  children, 
  viewKey, 
  className = '', 
  animate = true 
}) => {
  // Animation variants for simple fade in/out transitions
  const variants = {
    initial: {
      opacity: 0,
    },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.25,
        ease: [0.25, 0.1, 0.25, 1], // Smooth easing for natural fade
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.2,
        ease: [0.4, 0.0, 1, 1], // Slightly faster fade out
      },
    },
  };

  if (!animate) {
    // Fallback for browsers without JS animation support
    return (
      <div className={`transition-opacity duration-200 ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default ViewTransition;
