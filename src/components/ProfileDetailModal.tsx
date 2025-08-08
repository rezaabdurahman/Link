import React, { useState } from 'react';
import { X, MessageCircle, UserPlus, Instagram, Twitter, Facebook, MapPin, Users, Send, Minimize2 } from 'lucide-react';
import { User } from '../types';

interface ProfileDetailModalProps {
  user: User;
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: Date;
}

const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({ user, onClose }): JSX.Element => {
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Hey there! 👋`,
      sender: 'them',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
    }
  ]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isFriend, setIsFriend] = useState<boolean>(false);

  const handleSendMessage = (): void => {
    if (newMessage.trim()) {
      const message: Message = {
        id: Date.now().toString(),
        text: newMessage.trim(),
        sender: 'me',
        timestamp: new Date(),
      };
      setMessages([...messages, message]);
      setNewMessage('');
    }
  };

  const handleAddFriend = (): void => {
    setIsFriend(!isFriend);
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
                <div className="absolute bottom-2 right-2 w-5 h-5 bg-accent-green rounded-full border-2 border-surface-dark" />
              )}
            </div>
            
            <h3 className="text-3xl font-bold mb-2 text-gradient-primary">
              {user.name}, {user.age}
            </h3>
            
            {/* Distance and Mutual Friends */}
            <div className="flex justify-center gap-4 mb-4">
              <div className="flex items-center gap-1">
                <MapPin size={16} className="text-text-secondary" />
                <span className="text-text-secondary text-sm">
                  {user.location.proximityKm}km away
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
              
              <button
                onClick={handleAddFriend}
                className={`flex-1 max-w-36 font-semibold py-3 px-6 rounded-ios transition-all duration-200 flex items-center justify-center gap-2 ${
                  isFriend 
                    ? 'bg-white/20 hover:bg-white/30 text-white' 
                    : 'bg-accent-green hover:bg-accent-green/80 text-white hover-glow'
                }`}
              >
                <UserPlus size={16} />
                {isFriend ? 'Friends' : 'Add Friend'}
              </button>
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

          {/* Social Media */}
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

          {/* Photos */}
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
        </div>

        {/* Chat Window */}
        {isChatOpen && (
          <div 
            className="chat-window"
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              width: '300px',
              height: '400px',
              background: 'rgba(28, 28, 30, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1001
            }}
          >
            {/* Chat Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '12px',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'rgba(235, 235, 245, 0.8)'
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: '16px', fontWeight: '600' }}>
                  {user.name}
                </span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(235, 235, 245, 0.6)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <Minimize2 size={16} />
              </button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    alignSelf: message.sender === 'me' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%'
                  }}
                >
                  <div
                    style={{
                      background: message.sender === 'me' ? '#007AFF' : 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '16px',
                      fontSize: '14px',
                      lineHeight: '1.3'
                    }}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div style={{
              padding: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              gap: '8px'
            }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                style={{
                  background: newMessage.trim() ? '#007AFF' : 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s ease'
                }}
              >
                <Send size={16} color="white" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileDetailModal;
