import React from 'react';
import { Sparkles, Edit, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { generateAISummary, friends } from '../data/mockData';
import { getDisplayName } from '../utils/nameHelpers';

interface AISummaryCardProps {
  friendId: string;
  onEditClick: () => void;
  onRefresh?: () => void;
}

const AISummaryCard: React.FC<AISummaryCardProps> = ({ 
  friendId, 
  onEditClick, 
  onRefresh 
}) => {
  const friend = friends.find(f => f.id === friendId);
  const aiSummary = generateAISummary(friendId);
  
  if (!friend) return null;

  const profilePicture = friend.profileMedia?.thumbnail || friend.profilePicture;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="ios-card p-4 bg-gradient-to-br from-aqua/5 to-blue/5 border border-aqua/20"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={profilePicture}
              alt={getDisplayName(friend)}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-aqua rounded-full flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{getDisplayName(friend)}</h3>
            <p className="text-xs text-gray-500">AI Summary</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-aqua hover:bg-aqua/10 rounded-full transition-colors"
              aria-label="Refresh AI summary"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            onClick={onEditClick}
            className="p-2 text-gray-400 hover:text-aqua hover:bg-aqua/10 rounded-full transition-colors"
            aria-label="Edit notes"
          >
            <Edit size={14} />
          </button>
        </div>
      </div>

      {/* AI Summary Content */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-aqua" />
          <span className="text-xs font-medium text-aqua">AI-Generated Summary</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          {aiSummary}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onEditClick}
          className="flex-1 px-3 py-2 text-xs font-medium text-aqua bg-aqua/10 hover:bg-aqua/15 rounded-ios transition-colors"
        >
          View & Edit Notes
        </button>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-ios transition-colors"
          >
            Regenerate
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-3 text-center">
        AI summaries are generated from your personal notes
      </p>
    </motion.div>
  );
};

export default AISummaryCard;
