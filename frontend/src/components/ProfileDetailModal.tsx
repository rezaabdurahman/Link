import React, { useState } from 'react';
import { X, MessageCircle, Instagram, Twitter, Facebook, MapPin, Users, EyeOff } from 'lucide-react';
import { User, Chat } from '../types';
import ConversationModal from './ConversationModal';

interface ProfileDetailModalProps {
  user: User;
  onClose: () => void;
  onHide?: (userId: string) => void;
}

const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({ user, onClose, onHide }): JSX.Element => {
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isFriend, setIsFriend] = useState<boolean>(false);

  const handleAddFriend = (): void => {
    setIsFriend(!isFriend);
  };

  const handleHideUser = (): void => {
    if (onHide) {
      onHide(user.id);
      onClose(); // Close the modal after hiding
    }
  };

  // Create a Chat object for ConversationModal
  const chatData: Chat = {
    id: `chat-${user.id}`,
    participantId: user.id,
    participantName: user.profileType === 'public' ? user.name : 'Private Profile',
    participantAvatar: user.profilePicture || '',
    lastMessage: {
      id: 'last-msg',
      senderId: user.id,
      receiverId: 'current-user',
      content: "Hey there! 👋",
      timestamp: new Date(Date.now() - 300000),
      type: 'text'
    },
    unreadCount: 0,
    conversationSummary: 'Recent conversation',
    priority: 1,
    messages: []
  };

  const socialLinks = [
    { platform: 'Instagram', icon: Instagram, handle: '@' + user.name.toLowerCase().replace(' ', '_') },
    { platform: 'Twitter', icon: Twitter, handle: '@' + user.name.toLowerCase().replace(' ', '_') },
    { platform: 'Facebook', icon: Facebook, handle: user.name },
  ];

  // Mock additional photos
  const additionalPhotos = [
    user.profilePicture,
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1494790108755-2616b612b5ab?w=150&h=150&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-5 pb-0">
          <h2 className="text-2xl font-bold m-0 text-gradient-aqua">
            Profile
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors duration-200 flex items-center justify-center"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {/* Profile Header */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              {user.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.name}
                  className="w-30 h-30 rounded-full object-cover border-2 border-white/20 shadow-lg"
                />
              ) : (
                <div className="w-30 h-30 rounded-full bg-surface-hover border-2 border-white/20 shadow-lg flex items-center justify-center">
                  <div className="text-text-muted text-4xl font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              {user.isAvailable && (
                <div className="absolute bottom-2 right-2 w-5 h-5 bg-aqua rounded-full border-2 border-surface-dark" />
              )}
            </div>
            
            {user.profileType === 'public' ? (
              <h3 className="text-3xl font-bold mb-2 text-gradient-primary">
                {user.name}, {user.age}
              </h3>
            ) : (
              <h3 className="text-3xl font-bold mb-2 text-gradient-primary">
                Private Profile
              </h3>
            )}
            
            {/* Distance and Mutual Friends */}
            <div className="flex justify-center gap-4 mb-4">
              <div className="flex items-center gap-1">
                <MapPin size={16} className="text-text-secondary" />
                <span className="text-text-secondary text-sm">
                  {user.location.proximityMiles} miles away
                </span>
              </div>
              
              {user.mutualFriends.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users size={16} className="text-aqua" />
                  <span className="text-aqua text-sm font-medium">
                    {user.mutualFriends.length} mutual friends
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsChatOpen(true)}
                className="flex-1 max-w-36 bg-aqua hover:bg-aqua-dark text-white font-semibold py-3 px-6 rounded-ios transition-all duration-200 flex items-center justify-center gap-2 hover-glow"
              >
                <MessageCircle size={16} />
                Message
              </button>
              {onHide && (
                <button
                  onClick={handleHideUser}
                  className="flex-1 max-w-36 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-ios transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <EyeOff size={16} />
                  Hide
                </button>
              )}
            </div>
          </div>

          {/* Bio */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              About
            </h4>
            <p className="text-secondary" style={{ 
              fontSize: '16px', 
              lineHeight: '1.5'
            }}>
              {user.bio}
            </p>
          </div>

          {/* Interests */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
              Interests
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {user.interests.map((interest, index) => (
                <span
                  key={index}
                  style={{
                    background: 'rgba(0, 122, 255, 0.2)',
                    color: '#007AFF',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>

          {/* Social Media - only show for public profiles */}
          {user.profileType === 'public' && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                Connect
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {socialLinks.map((social, index) => (
                  <div
                    key={index}
                    className="ios-card"
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <social.icon size={20} className="text-accent" />
                    <span style={{ fontSize: '16px' }}>{social.handle}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos - only show for public profiles */}
          {user.profileType === 'public' && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                Photos
              </h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px' 
              }}>
                {additionalPhotos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`${user.name} photo ${index + 1}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ConversationModal */}
        <ConversationModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          chat={chatData}
          onAddFriend={handleAddFriend}
          isFriend={isFriend}
        />
      </div>
    </div>
  );
};

export default ProfileDetailModal;
