import React, { useState } from 'react';
import { Search, ChevronDown, User } from 'lucide-react';
import { friends } from '../data/mockData';
import { User as UserType } from '../types';
import AISummaryCard from './AISummaryCard';
import { getDisplayName, getFullName } from '../utils/nameHelpers';

interface SocialNotesSectionProps {
  onFriendSelect?: (friendId: string) => void;
}

const SocialNotesSection: React.FC<SocialNotesSectionProps> = ({ onFriendSelect }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Filter friends based on search query
  const filteredFriends = friends.filter(friend =>
    getFullName(friend).toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.bio.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // const activeFriend = activeFriendId ? friends.find(f => f.id === activeFriendId) : null;

  const handleFriendSelect = (friend: UserType): void => {
    setActiveFriendId(friend.id);
    setSearchQuery(getDisplayName(friend));
    setIsDropdownOpen(false);
    onFriendSelect?.(friend.id);
  };

  const handleSearchChange = (value: string): void => {
    setSearchQuery(value);
    if (value.trim() === '') {
      setActiveFriendId(null);
      setIsDropdownOpen(false);
    } else {
      setIsDropdownOpen(true);
    }
  };

  const handleSearchFocus = (): void => {
    if (searchQuery.trim() !== '') {
      setIsDropdownOpen(true);
    }
  };

  return (
    <div className="ios-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <User size={20} className="text-aqua" />
        <h2 className="text-lg font-semibold text-text-primary">Social Notes</h2>
      </div>

      {/* Search Input with Dropdown */}
      <div className="relative mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            placeholder="Search for a friend..."
            aria-label="Search for a friend to view notes"
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
            role="combobox"
            className="w-full pl-10 pr-10 py-2 text-sm border border-gray-200 rounded-ios focus:outline-none focus:ring-2 focus:ring-aqua focus:border-aqua focus:ring-offset-0 transition-colors"
          />
          <ChevronDown 
            size={16} 
            className={`absolute right-3 top-3 text-gray-400 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>

        {/* Dropdown */}
        {isDropdownOpen && filteredFriends.length > 0 && (
          <div 
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-ios shadow-lg z-10 max-h-48 overflow-y-auto"
            role="listbox"
            aria-label="Friend search results"
          >
            {filteredFriends.map((friend) => {
              const profilePicture = friend.profileMedia?.thumbnail || friend.profilePicture;
              
              return (
                <button
                  key={friend.id}
                  onClick={() => handleFriendSelect(friend)}
                  role="option"
                  aria-selected={activeFriendId === friend.id}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-aqua focus:ring-offset-2 transition-colors motion-reduce:transition-none text-left"
                >
                  <img
                    src={profilePicture}
                    alt={getDisplayName(friend)}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm">{getDisplayName(friend)}</h4>
                    <p className="text-xs text-gray-500 line-clamp-1">{friend.bio}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Summary Card */}
      {activeFriendId && (
        <AISummaryCard 
          friendId={activeFriendId}
          onEditClick={() => {
            if (onFriendSelect && activeFriendId) {
              onFriendSelect(activeFriendId);
            }
          }}
        />
      )}

      {/* Empty State */}
      {!activeFriendId && (
        <div className="text-center py-8 text-gray-500">
          <User size={48} className="mx-auto mb-3 opacity-30" />
          <h3 className="font-medium mb-2">Select a friend</h3>
          <p className="text-sm">Search and select a friend to view their notes and AI summary</p>
        </div>
      )}
    </div>
  );
};

export default SocialNotesSection;
