import React, { useState, useEffect } from 'react';
import { X, Sparkles, Save } from 'lucide-react';
import { socialNotes, friends, generateAISummary } from '../data/mockData';
import { SocialNote } from '../types';
import { getDisplayName } from '../utils/nameHelpers';

interface NoteEditModalProps {
  isOpen: boolean;
  friendId: string | null;
  onClose: () => void;
  onSave: (notes: SocialNote[]) => void;
  onGenerateAISummary?: (friendId: string) => void;
}

const NoteEditModal: React.FC<NoteEditModalProps> = ({
  isOpen,
  friendId,
  onClose,
  onSave,
  onGenerateAISummary
}) => {
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const friend = friendId ? friends.find(f => f.id === friendId) : null;

  // Load existing notes when modal opens
  useEffect(() => {
    if (isOpen && friendId) {
      const friendNotes = socialNotes
        .filter(note => note.friendId === friendId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(note => note.text)
        .join('\n\n');
      
      setNotes(friendNotes);
      setHasChanges(false);
    }
  }, [isOpen, friendId]);

  const handleNotesChange = (value: string): void => {
    setNotes(value);
    setHasChanges(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!friendId) return;
    
    setIsLoading(true);
    try {
      // Convert text to note objects (mock implementation)
      const noteTexts = notes.split('\n\n').filter(text => text.trim());
      const updatedNotes: SocialNote[] = noteTexts.map((text, index) => ({
        id: `note-${friendId}-${index}-${Date.now()}`,
        friendId,
        text: text.trim(),
        updatedAt: new Date()
      }));

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onSave(updatedNotes);
      setHasChanges(false);
      onClose();
    } finally {
      setIsLoading(false);
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

  const handleGenerateAISummary = (): void => {
    if (friendId && onGenerateAISummary) {
      onGenerateAISummary(friendId);
    }
  };

  if (!isOpen || !friend) return null;

  const profilePicture = friend.profileMedia?.thumbnail || friend.profilePicture;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm motion-reduce:bg-black/75 motion-reduce:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notes-modal-title"
      aria-describedby="notes-modal-description"
    >
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] bg-white rounded-modal shadow-xl overflow-hidden sm:max-w-lg max-[375px]:mx-0 max-[375px]:max-w-full max-[375px]:h-full max-[375px]:rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img
              src={profilePicture}
              alt={getDisplayName(friend)}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h2 id="notes-modal-title" className="text-xl font-semibold text-gray-900">Notes about {getDisplayName(friend)}</h2>
              <p id="notes-modal-description" className="text-sm text-gray-500">Edit your personal notes</p>
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
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Your Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={`Write your personal notes about ${getDisplayName(friend)} here...\n\nSeparate different topics with double line breaks to create multiple note entries.`}
              aria-describedby="notes-helper"
              className="w-full h-64 px-4 py-3 text-sm border border-gray-200 rounded-ios focus:outline-none focus:ring-2 focus:ring-aqua focus:border-aqua focus:ring-offset-0 transition-colors resize-none"
            />
            <p id="notes-helper" className="text-xs text-gray-500 mt-2">
              Tip: Use double line breaks to separate different topics or thoughts
            </p>
          </div>

          {/* AI Summary Preview */}
          <div className="mb-6 p-4 bg-aqua/5 border border-aqua/20 rounded-ios">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-aqua" />
              <h3 className="font-medium text-gray-900">Current AI Summary</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {friendId ? generateAISummary(friendId) : ''}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleGenerateAISummary}
              disabled={!notes.trim()}
              aria-label="Regenerate AI summary based on current notes"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-aqua bg-aqua/10 hover:bg-aqua/15 rounded-ios focus:outline-none focus:ring-2 focus:ring-aqua focus:ring-offset-2 transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} />
              Regenerate AI Summary
            </button>
            
            <div className="text-sm text-gray-500">
              {hasChanges && (
                <span className="text-orange-600">• Unsaved changes</span>
              )}
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
              aria-label="Save notes"
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

export default NoteEditModal;
