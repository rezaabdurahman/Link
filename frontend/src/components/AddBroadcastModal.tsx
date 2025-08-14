import React, { useState, useEffect } from 'react';

interface AddBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (broadcast: string) => Promise<void> | void;
  isSubmitting?: boolean;
  currentBroadcast?: string;
}

const AddBroadcastModal: React.FC<AddBroadcastModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isSubmitting = false, 
  currentBroadcast = '' 
}): JSX.Element | null => {
  const [broadcastText, setBroadcastText] = useState<string>('');

  // Pre-fill with current broadcast when modal opens
  useEffect(() => {
    if (isOpen) {
      setBroadcastText(currentBroadcast);
    }
  }, [isOpen, currentBroadcast]);

  if (!isOpen) return null;

  const handleSubmit = async (): Promise<void> => {
    if (broadcastText.trim() && !isSubmitting) {
      try {
        await onSubmit(broadcastText.trim());
        setBroadcastText('');
      } catch (error) {
        // Error handling is done in the parent component
        console.error('Submit error:', error);
      }
    }
  };

  const handleCancel = (): void => {
    if (!isSubmitting) {
      setBroadcastText('');
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget && !isSubmitting) {
      handleCancel();
    }
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape' && !isSubmitting) {
      handleCancel();
    }
  };

  const isFormValid = broadcastText.trim().length > 0;
  const hasChanges = broadcastText.trim() !== currentBroadcast;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="bg-white rounded-3xl max-w-md w-full mx-4 overflow-hidden shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="px-6 py-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {currentBroadcast ? 'Edit Broadcast' : 'Add Broadcast'}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Share what you want people to know — it'll appear on your card in the discovery grid.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <textarea
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder="e.g. Just moved in and looking to make friends with neighbors"
            className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-aqua focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            maxLength={200}
            disabled={isSubmitting}
            aria-label="Broadcast message"
          />
          <div className="text-right mt-2">
            <span className="text-xs text-gray-400">
              {broadcastText.length}/200
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || !hasChanges || isSubmitting}
            className="flex-1 px-4 py-2.5 bg-aqua text-white font-medium rounded-xl hover:bg-aqua-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              currentBroadcast ? 'Update' : 'Create'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBroadcastModal;
