import React, { useState, useEffect } from 'react';
import { X, Save, MessageCircle, Calendar } from 'lucide-react';
import { FriendMemory } from '../services/userClient';
import { useSocialNotesStore } from '../stores/socialNotesStore';
import { formatDistanceToNow } from 'date-fns';

interface MemoryEditModalProps {
  isOpen: boolean;
  memory: FriendMemory | null;
  friendName: string;
  friendAvatar?: string;
  onClose: () => void;
}

const MemoryEditModal: React.FC<MemoryEditModalProps> = ({
  isOpen,
  memory,
  friendName,
  friendAvatar,
  onClose
}) => {
  const [notes, setNotes] = useState<string>('');
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  
  const { updateMemoryNotes, loadingStates, errors } = useSocialNotesStore();
  const isLoading = loadingStates.updating;
  const error = errors.updating;

  // Load existing notes when modal opens or memory changes
  useEffect(() => {
    if (isOpen && memory) {
      setNotes(memory.notes || '');
      setHasChanges(false);
    }
  }, [isOpen, memory]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNotes('');
      setHasChanges(false);
    }
  }, [isOpen]);

  const handleNotesChange = (value: string): void => {
    setNotes(value);
    setHasChanges(value !== (memory?.notes || ''));
  };

  const handleSave = async (): Promise<void> => {
    if (!memory || !hasChanges) return;
    
    try {
      await updateMemoryNotes(memory.id, notes);
      setHasChanges(false);
      onClose();
    } catch (err) {
      // Error is already handled by the store and displayed in UI
      console.error('Failed to save memory notes:', err);
    }
  };

  const handleCancel = (): void => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen || !memory) return null;

  const formattedDate = formatDistanceToNow(new Date(memory.created_at), {
    addSuffix: true
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm motion-reduce:bg-black/75 motion-reduce:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-modal-title"
      aria-describedby="memory-modal-description"
    >
      <div className="relative w-full max-w-3xl mx-4 max-h-[90vh] bg-white rounded-modal shadow-xl overflow-hidden sm:max-w-2xl max-[375px]:mx-0 max-[375px]:max-w-full max-[375px]:h-full max-[375px]:rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {friendAvatar ? (
              <img
                src={friendAvatar}
                alt={friendName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">
                  {friendName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h2 id="memory-modal-title" className="text-xl font-semibold text-gray-900">
                Memory with {friendName}
              </h2>
              <p id="memory-modal-description" className="text-sm text-gray-500">
                Edit your personal notes about this memory
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Original Message */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
              <Calendar size={14} />
              <span>{formattedDate}</span>
              <span>•</span>
              <MessageCircle size={14} />
              <span>{memory.message_type} message</span>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-ios border-l-4 border-aqua/30">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Original Message:</h3>
              <p className="text-gray-900 leading-relaxed">
                {memory.message_content}
              </p>
            </div>
          </div>

          {/* Notes Editor */}
          <div>
            <label htmlFor="memory-notes" className="block text-sm font-medium text-gray-700 mb-3">
              Your Personal Notes
            </label>
            <textarea
              id="memory-notes"
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={`Write your thoughts about this memory with ${friendName}...\n\nWhat made this message special? How did it make you feel? Any context you want to remember?`}
              className="w-full h-48 px-4 py-3 text-sm border border-gray-200 rounded-ios focus:outline-none focus:ring-2 focus:ring-aqua focus:border-aqua focus:ring-offset-0 transition-colors resize-none"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                Share your personal thoughts and feelings about this memory
              </p>
              <span className="text-xs text-gray-400">
                {notes.length} characters
              </span>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-ios">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500">
              {hasChanges && !isLoading && (
                <span className="text-orange-600">• Unsaved changes</span>
              )}
              {isLoading && (
                <span className="text-aqua">• Saving...</span>
              )}
            </div>
            
            <div className="text-xs text-gray-400">
              Memory saved {formattedDate}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-ios hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors motion-reduce:transition-none disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !hasChanges}
              aria-label="Save memory notes"
              className="flex-1 flex items-center justify-center gap-2 gradient-btn-sm focus:outline-none focus:ring-2 focus:ring-aqua focus:ring-offset-2 motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={14} />
              {isLoading ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryEditModal;