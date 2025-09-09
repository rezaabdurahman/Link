import React, { useEffect, useMemo } from 'react';
import { User } from 'lucide-react';
import { useSocialNotesStore } from '../stores/socialNotesStore';
import FriendsDropdown from './FriendsDropdown';
import FriendMemoriesList from './FriendMemoriesList';

interface SocialNotesSectionProps {
  onFriendSelect?: (friendId: string) => void;
  onEditMemory?: (memoryId: string, friendId: string) => void;
  onDeleteMemory?: (memoryId: string) => void;
}

const SocialNotesSection: React.FC<SocialNotesSectionProps> = ({ 
  onFriendSelect, 
  onEditMemory,
  onDeleteMemory 
}) => {
  const {
    friends,
    selectedFriend,
    memories,
    hasMoreMemories: hasMoreMap,
    loadingStates,
    errors,
    loadFriends,
    selectFriend,
    loadMemories,
    deleteMemory,
    clearErrors,
  } = useSocialNotesStore();

  // Get memories and hasMore for selected friend using useMemo to prevent re-renders
  const friendMemories = useMemo(() => {
    return selectedFriend ? (memories.get(selectedFriend.id) || []) : [];
  }, [selectedFriend, memories]);
  
  const hasMoreMemories = useMemo(() => {
    return selectedFriend ? (hasMoreMap.get(selectedFriend.id) || false) : false;
  }, [selectedFriend, hasMoreMap]);

  // Load friends on component mount
  useEffect(() => {
    loadFriends();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFriendSelect = (friend: any) => {
    selectFriend(friend);
    onFriendSelect?.(friend.id);
  };

  const handleLoadMoreMemories = () => {
    if (selectedFriend) {
      loadMemories(selectedFriend.id, true);
    }
  };

  const handleEditMemory = (memory: any) => {
    if (onEditMemory && selectedFriend) {
      onEditMemory(memory.id, selectedFriend.id);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (onDeleteMemory) {
      onDeleteMemory(memoryId);
    } else {
      await deleteMemory(memoryId);
    }
  };

  return (
    <div className="ios-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <User size={20} className="text-aqua" />
        <h2 className="text-lg font-semibold text-text-primary">Social Notes</h2>
      </div>

      {/* Friends Dropdown */}
      <div className="mb-6">
        <FriendsDropdown
          friends={friends}
          selectedFriend={selectedFriend}
          onFriendSelect={handleFriendSelect}
          loading={loadingStates.friends}
          error={errors.friends}
          placeholder="Search for a friend to view memories..."
        />
      </div>

      {/* Friend Memories List */}
      {selectedFriend ? (
        <FriendMemoriesList
          friend={selectedFriend}
          memories={friendMemories}
          loading={loadingStates.memories}
          hasMore={hasMoreMemories}
          error={errors.memories}
          deletingMemoryId={loadingStates.deleting}
          onLoadMore={handleLoadMoreMemories}
          onEditMemory={handleEditMemory}
          onDeleteMemory={handleDeleteMemory}
          onClearError={clearErrors}
        />
      ) : (
        /* Empty State */
        <div className="text-center py-12 text-gray-500">
          <User size={48} className="mx-auto mb-3 opacity-30" />
          <h3 className="font-medium mb-2">Select a friend</h3>
          <p className="text-sm">Search and select a friend to view your shared memories and personal notes</p>
        </div>
      )}
    </div>
  );
};

export default SocialNotesSection;
