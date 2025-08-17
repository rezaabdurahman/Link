import React, { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isFeatureEnabled } from '../config/featureFlags';

interface ExpandableFABProps {
  /**
   * Controls whether the FAB is visible (should be based on user availability)
   */
  isVisible: boolean;
  /**
   * Callback for opening the Add Cues modal
   */
  onOpenAddCues: () => void;
  /**
   * Callback for opening the Add Broadcast modal
   */
  onOpenAddBroadcast: () => void;
  /**
   * Callback for opening the Check-in modal
   */
  onOpenCheckIn: () => void;
  /**
   * Whether cues feature is currently active/enabled for the user
   */
  isCuesActive?: boolean;
  /**
   * Whether broadcast feature is currently active/enabled for the user
   */
  isBroadcastActive?: boolean;
}

/**
 * Expandable Floating Action Button that shows sub-FABs for Cue, Broadcast, and Check-in actions
 * Follows the design system with proper animations and accessibility
 */
const ExpandableFAB: React.FC<ExpandableFABProps> = memo(({
  isVisible,
  onOpenAddCues,
  onOpenAddBroadcast,
  onOpenCheckIn,
  isCuesActive = false,
  isBroadcastActive = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleSubFABClick = useCallback((action: () => void) => {
    action();
    setIsExpanded(false); // Close expanded state after action
  }, []);

  // Check which features are enabled
  const isCuesEnabled = isFeatureEnabled('DISCOVERY_CUES');
  const isBroadcastEnabled = isFeatureEnabled('DISCOVERY_BROADCAST');

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-6 z-20">
      {/* Sub-FABs - positioned absolutely relative to main FAB */}
      <AnimatePresence>
        {isExpanded && (
          <div className="absolute bottom-0 right-0">
            {/* Check-in FAB - positioned at -120° (up-left) */}
            <motion.div
              className="absolute"
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{ opacity: 1, scale: 1, x: -75, y: -130 }}
              exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 20,
                mass: 0.8,
                delay: 0
              }}
            >
              <motion.button
                onClick={() => handleSubFABClick(onOpenCheckIn)}
                className="relative w-10 h-10 bg-gradient-to-br from-aqua to-accent-sand text-white rounded-full shadow-lg hover:scale-105 transition-all duration-150 flex items-center justify-center hover:shadow-xl"
                aria-label="Check in"
                title="Check in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 11-3 3-2-2" />
                </svg>
              </motion.button>
            </motion.div>

            {/* Cues FAB - positioned at -142.5° (left-up) - only if feature enabled */}
            {isCuesEnabled && (
              <motion.div
                className="absolute"
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: -120, y: -92 }}
                exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 20,
                  mass: 0.8,
                  delay: 0.05
                }}
              >
                <motion.button
                  onClick={() => handleSubFABClick(onOpenAddCues)}
                  className="relative w-10 h-10 bg-gradient-to-br from-aqua to-accent-sand text-white rounded-full shadow-lg hover:scale-105 transition-all duration-150 flex items-center justify-center hover:shadow-xl"
                  aria-label="Add Social Cues"
                  title="Add Social Cues"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {/* Cues Status Badge */}
                  <div className={`absolute -top-2 -right-2 px-1 py-0.5 rounded-full text-[8px] font-semibold text-white border border-white/20 ${
                    isCuesActive ? 'bg-accent-copper' : 'bg-gray-400'
                  }`}>
                    {isCuesActive ? 'ON' : 'OFF'}
                  </div>
                </motion.button>
              </motion.div>
            )}

            {/* Broadcast FAB - positioned at -165° (left) - only if feature enabled */}
            {isBroadcastEnabled && (
              <motion.div
                className="absolute"
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: -145, y: -39 }}
                exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 20,
                  mass: 0.8,
                  delay: 0.10
                }}
              >
                <motion.button
                  onClick={() => handleSubFABClick(onOpenAddBroadcast)}
                  className="relative w-10 h-10 bg-gradient-to-br from-aqua to-accent-sand text-white rounded-full shadow-lg hover:scale-105 transition-all duration-150 flex items-center justify-center hover:shadow-xl"
                  aria-label="Create Broadcast"
                  title="Create Broadcast"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  {/* Broadcast Status Badge */}
                  <div className={`absolute -top-2 -right-2 px-1 py-0.5 rounded-full text-[8px] font-semibold text-white border border-white/20 ${
                    isBroadcastActive ? 'bg-accent-copper' : 'bg-gray-400'
                  }`}>
                    {isBroadcastActive ? 'ON' : 'OFF'}
                  </div>
                </motion.button>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        onClick={toggleExpanded}
        className="w-14 h-14 bg-gradient-to-br from-aqua to-accent-sand text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Close create menu" : "Open create menu"}
        title={isExpanded ? "Close" : "Create"}
        whileTap={{ scale: 0.95 }}
      >
        <motion.svg
          className="w-6 h-6 group-hover:scale-110 transition-transform duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: isExpanded ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, mass: 0.8 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </motion.svg>
      </motion.button>

      {/* Backdrop to close when clicking outside - only visible when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 -z-10"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

ExpandableFAB.displayName = 'ExpandableFAB';

export default ExpandableFAB;
