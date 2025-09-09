import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, User, Loader2 } from 'lucide-react';
import { PublicUser } from '../services/userClient';
import { getDisplayName } from '../utils/nameHelpers';

interface FriendsDropdownProps {
  friends: PublicUser[];
  selectedFriend: PublicUser | null;
  onFriendSelect: (friend: PublicUser) => void;
  loading?: boolean;
  error?: string | null;
  placeholder?: string;
}

const FriendsDropdown: React.FC<FriendsDropdownProps> = ({
  friends,
  selectedFriend,
  onFriendSelect,
  loading = false,
  error = null,
  placeholder = "Search for a friend..."
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter friends based on search query with debouncing
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    
    const query = searchQuery.toLowerCase();
    return friends.filter(friend => {
      const displayName = getDisplayName(friend).toLowerCase();
      const bio = friend.bio?.toLowerCase() || '';
      return displayName.includes(query) || bio.includes(query);
    });
  }, [friends, searchQuery]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen || filteredFriends.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredFriends.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredFriends.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredFriends.length) {
          handleFriendSelect(filteredFriends[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleFriendSelect = (friend: PublicUser): void => {
    onFriendSelect(friend);
    setSearchQuery(getDisplayName(friend));
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleSearchChange = (value: string): void => {
    setSearchQuery(value);
    setHighlightedIndex(-1);
    
    if (value.trim() === '') {
      setIsDropdownOpen(false);
    } else {
      setIsDropdownOpen(true);
    }
  };

  const handleSearchFocus = (): void => {
    if (searchQuery.trim() !== '' || friends.length > 0) {
      setIsDropdownOpen(true);
    }
  };

  // Reset search when no friend is selected
  useEffect(() => {
    if (!selectedFriend) {
      setSearchQuery('');
      setIsDropdownOpen(false);
    }
  }, [selectedFriend]);

  const displayValue = selectedFriend ? getDisplayName(selectedFriend) : searchQuery;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={handleSearchFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          aria-label="Search for a friend to view memories"
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 ? `friend-option-${highlightedIndex}` : undefined
          }
          role="combobox"
          className="w-full pl-10 pr-10 py-2 text-sm border border-gray-200 rounded-ios focus:outline-none focus:ring-2 focus:ring-aqua focus:border-aqua focus:ring-offset-0 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        <div className="absolute right-3 top-3 flex items-center gap-1">
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          <ChevronDown 
            size={16} 
            className={`text-gray-400 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-ios">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Dropdown */}
      {isDropdownOpen && !error && (
        <div 
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-ios shadow-lg z-10 max-h-64 overflow-y-auto"
          role="listbox"
          aria-label="Friend search results"
        >
          {loading && filteredFriends.length === 0 ? (
            <div className="p-4 text-center">
              <Loader2 size={20} className="animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Loading friends...</p>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <User size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {searchQuery.trim() ? 'No friends found matching your search.' : 'No friends to display.'}
              </p>
            </div>
          ) : (
            filteredFriends.map((friend, index) => {
              const profilePicture = friend.profile_picture;
              const isHighlighted = index === highlightedIndex;
              
              return (
                <button
                  key={friend.id}
                  id={`friend-option-${index}`}
                  onClick={() => handleFriendSelect(friend)}
                  role="option"
                  aria-selected={selectedFriend?.id === friend.id}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-aqua focus:ring-offset-2 transition-colors motion-reduce:transition-none text-left ${
                    isHighlighted ? 'bg-gray-50' : ''
                  } ${
                    selectedFriend?.id === friend.id ? 'bg-aqua/10' : ''
                  }`}
                >
                  {profilePicture ? (
                    <img
                      src={profilePicture}
                      alt={getDisplayName(friend)}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User size={16} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 text-sm truncate">
                      {getDisplayName(friend)}
                    </h4>
                    {friend.bio && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {friend.bio}
                      </p>
                    )}
                  </div>
                  {selectedFriend?.id === friend.id && (
                    <div className="w-2 h-2 bg-aqua rounded-full flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default FriendsDropdown;