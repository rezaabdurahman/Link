import React, { useState } from 'react';
import { nearbyUsers, currentUser } from '../data/mockData';
import { User } from '../types';
import UserCard from '../components/UserCard';
import ProfileDetailModal from '../components/ProfileDetailModal';
import AnimatedSearchInput from '../components/AnimatedSearchInput';
import AddCuesModal from '../components/AddCuesModal';
import AddBroadcastModal from '../components/AddBroadcastModal';
import Toast from '../components/Toast';

const DiscoveryPage: React.FC = (): JSX.Element => {
  const [isAvailable, setIsAvailable] = useState<boolean>(currentUser.isAvailable);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddCuesModalOpen, setIsAddCuesModalOpen] = useState<boolean>(false);
  const [isAddBroadcastModalOpen, setIsAddBroadcastModalOpen] = useState<boolean>(false);
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({ 
    isVisible: false, 
    message: '', 
    type: 'success' 
  });

  const filteredUsers = nearbyUsers.filter(user =>
    !hiddenUserIds.has(user.id) && // Exclude hidden users
    (user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.interests.some(interest => 
      interest.toLowerCase().includes(searchQuery.toLowerCase())
    ) ||
    user.bio.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleAvailability = (): void => {
    const newAvailability = !isAvailable;
    setIsAvailable(newAvailability);
    
    // Show toast notification
    const message = newAvailability 
      ? "You're now discoverable by others nearby" 
      : "You've been removed from the discovery grid";
    
    setToast({
      isVisible: true,
      message,
      type: 'success'
    });
  };
  
  const handleCloseToast = (): void => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleUserClick = (user: User): void => {
    setSelectedUser(user);
  };

  const handleCloseProfile = (): void => {
    setSelectedUser(null);
  };

  const handleOpenAddCues = (): void => {
    setIsAddCuesModalOpen(true);
  };

  const handleCloseAddCues = (): void => {
    setIsAddCuesModalOpen(false);
  };

  const handleSubmitCue = (cue: string): void => {
    // Here you would typically save the cue to your backend/state
    console.log('New social cue:', cue);
    // For now, just close the modal
  };

  const handleOpenAddBroadcast = (): void => {
    setIsAddBroadcastModalOpen(true);
  };

  const handleCloseAddBroadcast = (): void => {
    setIsAddBroadcastModalOpen(false);
  };

  const handleSubmitBroadcast = (broadcast: string): void => {
    // Here you would typically save the broadcast to your backend/state
    console.log('New broadcast:', broadcast);
    // For now, just close the modal
  };

  const handleHideUser = (userId: string): void => {
    setHiddenUserIds(prev => new Set([...prev, userId]));
    // Here you would typically save the hidden user to your backend
    console.log('User hidden:', userId);
  };

  return (
    <div className="ios-safe-area px-5">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pt-5">
        <div>
          <h1 className="text-3xl font-bold mb-1 text-gradient-aqua">
            Discover
          </h1>
          <p className="text-text-secondary text-sm">
            {filteredUsers.length} people nearby
          </p>
        </div>
        <div className="flex flex-col gap-2 w-32">
          {/* Toggle Switch for Availability */}
          <div className="flex items-center gap-3 justify-end">
            <span className={`text-sm font-medium transition-colors duration-200 ${
              isAvailable ? 'text-aqua' : 'text-gray-500'
            }`}>
              {isAvailable ? 'Available' : 'Busy'}
            </span>
            <button
              onClick={toggleAvailability}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
                isAvailable 
                  ? 'bg-aqua' 
                  : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                  isAvailable ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {/* Fixed height container for buttons to prevent layout shift */}
          <div className="h-8 flex justify-end">
            {isAvailable && (
              <div className="flex gap-2">
                <button
                  onClick={handleOpenAddCues}
                  className="px-3 py-2 rounded-full text-xs font-medium bg-aqua/20 text-aqua hover:bg-aqua/30 transition-all duration-200"
                >
                  Cues
                </button>
                <button
                  onClick={handleOpenAddBroadcast}
                  className="px-3 py-2 rounded-full text-xs font-medium bg-aqua text-white hover:bg-aqua-dark transition-all duration-200"
                >
                  Broadcast
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <AnimatedSearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        suggestions={[
          'tall blond guy by the bar you here?',
          'find me another solo traveler',
          'I need funding for my startup',
          'find me someone who loves art',
          'find me a fitness enthusiast',
          'find me a foodie',
          'find me a book lover'
        ]}
        className="mb-6"
      />


      {/* Users Grid - Instagram style */}
      <div className="grid grid-cols-2 gap-1 mb-24">
        {filteredUsers.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onClick={() => handleUserClick(user)}
          />
        ))}
      </div>

      {/* Profile Detail Modal */}
      {selectedUser && (
        <ProfileDetailModal
          user={selectedUser}
          onClose={handleCloseProfile}
          onHide={handleHideUser}
        />
      )}

      {/* Add Cues Modal */}
      <AddCuesModal
        isOpen={isAddCuesModalOpen}
        onClose={handleCloseAddCues}
        onSubmit={handleSubmitCue}
      />

      {/* Add Broadcast Modal */}
      <AddBroadcastModal
        isOpen={isAddBroadcastModalOpen}
        onClose={handleCloseAddBroadcast}
        onSubmit={handleSubmitBroadcast}
      />
      
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={handleCloseToast}
      />
    </div>
  );
};

export default DiscoveryPage;
