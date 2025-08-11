import React, { useState } from 'react';

interface AddBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (broadcast: string) => void;
}

const AddBroadcastModal: React.FC<AddBroadcastModalProps> = ({ isOpen, onClose, onSubmit }): JSX.Element | null => {
  const [broadcastText, setBroadcastText] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (): void => {
    if (broadcastText.trim()) {
      onSubmit(broadcastText.trim());
      setBroadcastText('');
      onClose();
    }
  };

  const handleCancel = (): void => {
    setBroadcastText('');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-3xl max-w-md w-full mx-4 overflow-hidden shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="px-6 py-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Add Broadcast
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
            className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-aqua focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400"
            maxLength={200}
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
            className="flex-1 px-4 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!broadcastText.trim()}
            className="flex-1 px-4 py-2.5 bg-aqua text-white font-medium rounded-xl hover:bg-aqua-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBroadcastModal;
