import React, { useState, useEffect, useRef } from 'react';
import { Send, User } from 'lucide-react';
import { nearbyUsers, chats } from '../data/mockData';
import { User as UserType } from '../types';
import { getFullName, getDisplayName, getInitials } from '../utils/nameHelpers';

interface IntelligentMessageBoxProps {
  onSendMessage: (message: string, recipientId?: string) => void;
}

const IntelligentMessageBox: React.FC<IntelligentMessageBoxProps> = ({ onSendMessage }): JSX.Element => {
  const [message, setMessage] = useState<string>('');
  const [suggestedRecipient, setSuggestedRecipient] = useState<UserType | null>(null);
  const [showSuggestion, setShowSuggestion] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get all potential recipients (users from chats + nearby users)
  const allUsers = [
    ...chats.map(chat => {
      const user = nearbyUsers.find(u => u.id === chat.participantId);
      return user ? { ...user, name: chat.participantName } : null;
    }).filter(Boolean) as UserType[],
    ...nearbyUsers.filter(user => !chats.some(chat => chat.participantId === user.id))
  ];

  const analyzeMessage = (text: string): UserType | null => {
    if (!text.trim()) return null;

    const words = text.toLowerCase().split(' ');
    let bestMatch: UserType | null = null;
    let highestScore = 0;

    allUsers.forEach(user => {
      let score = 0;
      
      // Check for name match
      const nameWords = getFullName(user).toLowerCase().split(' ');
      nameWords.forEach(nameWord => {
        if (words.some(word => word.includes(nameWord) || nameWord.includes(word))) {
          score += 10;
        }
      });

      // Check for interest/activity matches
      user.interests.forEach(interest => {
        if (words.some(word => 
          word.includes(interest.toLowerCase()) || 
          interest.toLowerCase().includes(word)
        )) {
          score += 5;
        }
      });

      // Check for activity context
      const activityKeywords = {
        'coffee': ['coffee', 'café', 'latte', 'espresso', 'brew'],
        'hiking': ['hike', 'hiking', 'trail', 'mountain', 'nature'],
        'film': ['movie', 'film', 'cinema', 'watch', 'screening'],
        'food': ['dinner', 'lunch', 'eat', 'restaurant', 'meal'],
        'workout': ['gym', 'exercise', 'workout', 'fitness', 'run'],
        'art': ['art', 'gallery', 'museum', 'exhibition', 'creative']
      };

      Object.entries(activityKeywords).forEach(([activity, keywords]) => {
        if (user.interests.includes(activity)) {
          keywords.forEach(keyword => {
            if (words.includes(keyword)) {
              score += 3;
            }
          });
        }
      });

      // Boost score for recent chats
      if (chats.some(chat => chat.participantId === user.id)) {
        score += 2;
      }

      // Boost score for available users
      if (user.isAvailable) {
        score += 1;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = user;
      }
    });

    return highestScore > 2 ? bestMatch : null;
  };

  useEffect(() => {
    const recipient = analyzeMessage(message);
    setSuggestedRecipient(recipient);
    setShowSuggestion(!!recipient && message.trim().length > 3);
  }, [message]);

  const handleSubmit = (): void => {
    if (message.trim()) {
      onSendMessage(message.trim(), suggestedRecipient?.id);
      setMessage('');
      setSuggestedRecipient(null);
      setShowSuggestion(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const adjustTextareaHeight = (): void => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-full max-w-sm px-4 z-40">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        {/* Suggestion Bar */}
        {showSuggestion && suggestedRecipient && (
          <div className="px-3 py-2 bg-aqua/5 border-b border-gray-100 flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-aqua">
              <User size={12} />
              <span className="font-medium">Suggesting:</span>
              <div className="flex items-center gap-1">
                {suggestedRecipient.profilePicture ? (
                  <img 
                    src={suggestedRecipient.profilePicture} 
                    alt={getDisplayName(suggestedRecipient)}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[8px] text-gray-600 font-medium">
                    {getInitials(suggestedRecipient)}
                  </div>
                )}
                <span className="font-semibold">{getDisplayName(suggestedRecipient)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex items-end gap-2 p-3">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Start typing your message - I'll find the right person..."
            className="flex-1 resize-none border-none outline-none text-gray-900 placeholder-gray-400 text-sm leading-5 min-h-[20px] max-h-20 overflow-y-auto"
            rows={1}
          />
          <button
            onClick={handleSubmit}
            disabled={!message.trim()}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              message.trim() 
                ? 'bg-aqua text-white hover:bg-aqua-dark' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntelligentMessageBox;
