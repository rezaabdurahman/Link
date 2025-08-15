import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Undo2, X } from 'lucide-react';

interface CheckInSnackbarProps {
  isVisible: boolean;
  onViewProfile: () => void;
  onUndo: () => void;
  onClose?: () => void;
}

const CheckInSnackbar: React.FC<CheckInSnackbarProps> = ({ 
  isVisible, 
  onViewProfile, 
  onUndo, 
  onClose 
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto"
        >
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Success Message */}
              <div className="flex items-center flex-1">
                <p className="text-sm font-medium text-gray-900 flex-1">Successfully checked in!</p>
              </div>

              {/* Action Buttons - moved to same row and right-aligned */}
              <div className="flex gap-2 ml-4">
                <button
                  onClick={onViewProfile}
                  className="flex items-center gap-1 px-2 py-1 bg-aqua hover:bg-aqua-dark text-white rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
                >
                  <Eye size={12} />
                  View
                </button>
                <button
                  onClick={onUndo}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
                >
                  <Undo2 size={12} />
                  Undo
                </button>
              </div>

              {/* Close Button - optional */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 ml-2"
                  aria-label="Close"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CheckInSnackbar;
