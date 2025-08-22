import React, { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { friends as allFriends, closeFriends } from '../data/mockData';
import { getDisplayName, getFullName } from '../utils/nameHelpers';

interface CloseFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedFriendIds: string[]) => void;
}

const CloseFriendsModal: React.FC<CloseFriendsModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initialize selected friends from current close friends list
  useEffect(() => {
    if (isOpen) {
      setSelectedFriendIds(closeFriends.map(cf => cf.userId));
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filter friends based on search query
  const filteredFriends = allFriends.filter(friend =>
    getFullName(friend).toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.interests.some(interest => 
      interest.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleToggleFriend = (friendId: string): void => {
    setSelectedFriendIds(prev => 
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSave = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      onSave(selectedFriendIds);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = (): void => {
    // Reset to original state
    setSelectedFriendIds(closeFriends.map(cf => cf.userId));
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm motion-reduce:bg-black/75 motion-reduce:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-friends-title"
      aria-describedby="close-friends-description"
    >
      <div className="relative w-full max-w-md mx-4 max-h-[90vh] bg-white rounded-modal shadow-xl overflow-hidden sm:max-w-sm max-[375px]:mx-0 max-[375px]:max-w-full max-[375px]:h-full max-[375px]:rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 id="close-friends-title" className="text-xl font-semibold text-gray-900">Close Friends</h2>
          <button
            onClick={handleCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 pb-4 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
              aria-label="Search friends"
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-ios focus:outline-none focus:ring-2 focus:ring-aqua focus:border-aqua focus:ring-offset-0 transition-colors"
            />
          </div>
          <p id="close-friends-description" className="text-xs text-gray-500 mt-2">
            Select friends to share close friend content with
          </p>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {filteredFriends.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No friends found</p>
              {searchQuery && (
                <p className="text-xs mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            <div className="p-2">
              {filteredFriends.map((friend) => {
                const isSelected = selectedFriendIds.includes(friend.id);
                const profilePicture = friend.profileMedia?.thumbnail || friend.profilePicture;
                
                return (
                  <button
                    key={friend.id}
                    onClick={() => handleToggleFriend(friend.id)}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? 'Remove' : 'Add'} ${getDisplayName(friend)} as close friend`}
                    className={`w-full flex items-center gap-3 p-3 rounded-ios hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-aqua focus:ring-offset-2 transition-colors motion-reduce:transition-none ${
                      isSelected ? 'bg-aqua/10 hover:bg-aqua/15' : ''
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={profilePicture}
                        alt={getDisplayName(friend)}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-aqua rounded-full flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 text-left">
                      <h3 className="font-medium text-gray-900">{getDisplayName(friend)}</h3>
                      <p className="text-sm text-gray-500 line-clamp-1">{friend.bio}</p>
                    </div>
                    
                    <div className={`w-5 h-5 border-2 rounded-full transition-colors ${
                      isSelected 
                        ? 'bg-aqua border-aqua' 
                        : 'border-gray-300 hover:border-aqua'
                    }`}>
                      {isSelected && <Check size={12} className="text-white m-0.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">
              {selectedFriendIds.length} friend{selectedFriendIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-ios hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 gradient-btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloseFriendsModal;
