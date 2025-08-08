import React, { useState } from 'react';
import { nearbyUsers, currentUser } from '../data/mockData';
import { User } from '../types';
import UserCard from '../components/UserCard';
import ProfileDetailModal from '../components/ProfileDetailModal';
import AnimatedSearchInput from '../components/AnimatedSearchInput';
import AddCuesModal from '../components/AddCuesModal';

const DiscoveryPage: React.FC = (): JSX.Element => {
  const [isAvailable, setIsAvailable] = useState<boolean>(currentUser.isAvailable);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddCuesModalOpen, setIsAddCuesModalOpen] = useState<boolean>(false);

  const filteredUsers = nearbyUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.interests.some(interest => 
      interest.toLowerCase().includes(searchQuery.toLowerCase())
    ) ||
    user.bio.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleAvailability = (): void => {
    setIsAvailable(!isAvailable);
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
        <div className="flex flex-col gap-2">
          <button
            onClick={toggleAvailability}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              isAvailable 
                ? 'bg-accent-green text-white hover:bg-accent-green/80' 
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isAvailable ? 'bg-white' : 'bg-accent-orange'
              }`} />
              {isAvailable ? 'Available' : 'Busy'}
            </div>
          </button>
          {isAvailable && (
            <button
              onClick={handleOpenAddCues}
              className="px-4 py-2 rounded-full text-sm font-medium bg-aqua/10 text-aqua border border-aqua/30 hover:bg-aqua/20 transition-all duration-200"
            >
              Add Cues
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <AnimatedSearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        suggestions={[
          'find me a tall guy with blue eyes',
          'find me another solo traveler',
          'find me a venture capitalist',
          'find me someone who loves art',
          'find me a fitness enthusiast',
          'find me a foodie',
          'find me a book lover'
        ]}
        className="mb-6"
      />

      {/* Availability Status */}
      {isAvailable && (
        <div className="bg-accent-green/10 border border-accent-green/30 rounded-card p-4 mb-6 fade-in">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-accent-green rounded-full" />
            <span className="text-accent-green text-sm font-medium">
              You're available for connections
            </span>
          </div>
        </div>
      )}

      {/* Users Grid */}
      <div className="grid grid-cols-2 gap-4 mb-24">
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
        />
      )}

      {/* Add Cues Modal */}
      <AddCuesModal
        isOpen={isAddCuesModalOpen}
        onClose={handleCloseAddCues}
        onSubmit={handleSubmitCue}
      />
    </div>
  );
};

export default DiscoveryPage;
