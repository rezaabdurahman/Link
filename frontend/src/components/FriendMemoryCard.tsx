import React from 'react';
import { MessageCircle, Edit, Trash2, Calendar, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { FriendMemory } from '../services/userClient';
import { formatDistanceToNow } from 'date-fns';

interface FriendMemoryCardProps {
  memory: FriendMemory;
  onEditClick: () => void;
  onDeleteClick: () => void;
  isDeleting?: boolean;
}

const FriendMemoryCard: React.FC<FriendMemoryCardProps> = ({
  memory,
  onEditClick,
  onDeleteClick,
  isDeleting = false
}) => {
  // Format the date
  const formattedDate = formatDistanceToNow(new Date(memory.created_at), {
    addSuffix: true
  });

  // Get message type display information
  const getMessageTypeInfo = (messageType: string) => {
    switch (messageType.toLowerCase()) {
      case 'text':
        return { icon: MessageCircle, label: 'Text Message' };
      case 'image':
        return { icon: MessageCircle, label: 'Image Message' };
      case 'voice':
        return { icon: MessageCircle, label: 'Voice Message' };
      default:
        return { icon: MessageCircle, label: 'Message' };
    }
  };

  const messageTypeInfo = getMessageTypeInfo(memory.message_type);
  const MessageTypeIcon = messageTypeInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`ios-card p-4 bg-white border border-gray-200 ${
        isDeleting ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {/* Header with timestamp and actions */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar size={12} />
          <span>{formattedDate}</span>
          <span>•</span>
          <MessageTypeIcon size={12} />
          <span>{messageTypeInfo.label}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onEditClick}
            disabled={isDeleting}
            className="p-1.5 text-gray-400 hover:text-aqua hover:bg-aqua/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Edit memory notes"
            title="Edit notes"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={onDeleteClick}
            disabled={isDeleting}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Delete memory"
            title="Delete memory"
          >
            {isDeleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Message content */}
      <div className="mb-3">
        <div className="text-sm font-medium text-gray-700 mb-1">Message:</div>
        <div className="p-3 bg-gray-50 rounded-ios border-l-4 border-aqua/30">
          <p className="text-sm text-gray-900 leading-relaxed">
            {memory.message_content}
          </p>
        </div>
      </div>

      {/* Personal notes */}
      {memory.notes && memory.notes.trim() && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Your Notes:</div>
          <div className="p-3 bg-aqua/5 rounded-ios border border-aqua/20">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {memory.notes}
            </p>
          </div>
        </div>
      )}

      {/* Empty notes state */}
      {(!memory.notes || !memory.notes.trim()) && (
        <div className="border border-dashed border-gray-200 rounded-ios p-3">
          <p className="text-xs text-gray-400 text-center">
            No personal notes yet.{' '}
            <button
              onClick={onEditClick}
              disabled={isDeleting}
              className="text-aqua hover:text-aqua-dark underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add some notes
            </button>
          </p>
        </div>
      )}

      {/* Loading overlay when deleting */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-ios">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 size={16} className="animate-spin" />
            <span>Deleting...</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FriendMemoryCard;