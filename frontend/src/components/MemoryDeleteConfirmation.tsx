import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { FriendMemory } from '../services/userClient';
import { formatDistanceToNow } from 'date-fns';

interface MemoryDeleteConfirmationProps {
  isOpen: boolean;
  memory: FriendMemory | null;
  friendName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const MemoryDeleteConfirmation: React.FC<MemoryDeleteConfirmationProps> = ({
  isOpen,
  memory,
  friendName,
  isDeleting,
  onConfirm,
  onCancel
}) => {
  if (!isOpen || !memory) return null;

  const formattedDate = formatDistanceToNow(new Date(memory.created_at), {
    addSuffix: true
  });

  // Truncate message content for preview
  const truncatedMessage = memory.message_content.length > 100 
    ? memory.message_content.substring(0, 100) + '...'
    : memory.message_content;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm motion-reduce:bg-black/75 motion-reduce:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
    >
      <div className="relative w-full max-w-md mx-4 bg-white rounded-modal shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h2 id="delete-modal-title" className="text-lg font-semibold text-gray-900">
                Delete Memory
              </h2>
              <p id="delete-modal-description" className="text-sm text-gray-500">
                This action cannot be undone
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete this memory with <strong>{friendName}</strong>?
            </p>

            {/* Memory Preview */}
            <div className="p-4 bg-gray-50 rounded-ios border border-gray-200">
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                <span>{formattedDate}</span>
                <span>•</span>
                <span>{memory.message_type} message</span>
              </div>
              
              <div className="text-sm text-gray-900 mb-3">
                "{truncatedMessage}"
              </div>
              
              {memory.notes && memory.notes.trim() && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Your notes:</p>
                  <p className="text-sm text-gray-800 italic">
                    {memory.notes.length > 80 
                      ? memory.notes.substring(0, 80) + '...'
                      : memory.notes
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-ios p-3 mb-6">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-red-800 font-medium mb-1">Warning</p>
                <p className="text-red-700">
                  This will permanently delete the memory and your personal notes. 
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-ios hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors motion-reduce:transition-none disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-ios hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              {isDeleting ? 'Deleting...' : 'Delete Memory'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryDeleteConfirmation;