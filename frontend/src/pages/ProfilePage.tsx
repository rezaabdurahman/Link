import React, { useState } from 'react';
import { Edit, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FaInstagram, FaTwitter, FaLinkedin } from 'react-icons/fa';
import { currentUser } from '../data/mockData';
import ProfileDetailModal from '../components/ProfileDetailModal';
import { useAuth } from '../contexts/AuthContext';

const ProfilePage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const handleSettingsClick = (): void => {
    navigate('/settings');
  };

  const handleEditProfile = (): void => {
    setShowProfileModal(true);
  };

  const handleCloseProfileModal = (): void => {
    setShowProfileModal(false);
  };

  // Handle broken images
  const handleImageError = (photoUrl: string) => {
    setBrokenImages(prev => new Set([...prev, photoUrl]));
  };

  // Mock additional photos for demonstration (since currentUser might not have them)
  const additionalPhotos = [
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1494790108755-2616c6c5a72b?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=400&h=400&fit=crop&crop=face'
  ].filter(photo => photo && !brokenImages.has(photo));

  return (
    <div className="ios-safe-area" style={{ padding: '0 20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px',
        paddingTop: '20px'
      }}>
        <h1 className="text-gradient-aqua" style={{ fontSize: '28px', fontWeight: '700' }}>
          Profile
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleEditProfile}
            style={{
              background: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#06b6d4',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
            className="haptic-light"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={handleSettingsClick}
            style={{
              background: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#06b6d4',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
            className="haptic-light"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Profile Detail - Using ProfileDetailModal style */}
      <div 
        className="ios-card" 
        style={{
          position: 'relative',
          margin: '0 auto',
          marginBottom: '32px',
          maxWidth: '400px',
          padding: '0',
          background: 'white',
          border: 'none',
          boxShadow: 'none'
        }}
      >
        {/* Scrollable Content */}
        <div>
          {/* Profile Title */}
          <div className="px-4 pt-4 pb-1">
            <h2 className="text-xl font-bold m-0 text-gradient-aqua">
              Your User Card
            </h2>
          </div>

          {/* Instagram-style Profile Header */}
          <div className="flex gap-4 items-center px-4 mb-1">
            {/* Profile Picture - Left Side */}
            <div className="relative flex-shrink-0">
              <img
                src={currentUser.profilePicture}
                alt={currentUser.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-lg"
              />
              {currentUser.isAvailable && (
                <div className="absolute bottom-1 right-1 w-4 h-4 bg-aqua rounded-full border-2 border-surface-dark" />
              )}
            </div>
            
            {/* Name, Age, Meta Info - Right Side */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold mb-1 text-gradient-primary">
                {currentUser.name}, {currentUser.age}
              </h3>
              
              {/* Distance, Social Links */}
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-text-secondary text-xs">
                    📍 San Francisco, CA
                  </span>
                </div>
                
                {/* Social Media Links */}
                <div className="flex gap-1">
                  <a
                    href="https://instagram.com/alexthompson"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover-glow group"
                    title="@alexthompson"
                  >
                    <FaInstagram 
                      size={12} 
                      className="text-pink-500 hover:text-pink-600 transition-colors"
                    />
                  </a>
                  <a
                    href="https://twitter.com/alexthompson"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover-glow group"
                    title="@alexthompson"
                  >
                    <FaTwitter 
                      size={12} 
                      className="text-blue-400 hover:text-blue-500 transition-colors"
                    />
                  </a>
                  <a
                    href="https://linkedin.com/in/alexthompson"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover-glow group"
                    title="Alex Thompson"
                  >
                    <FaLinkedin 
                      size={12} 
                      className="text-blue-700 hover:text-blue-800 transition-colors"
                    />
                  </a>
                </div>
              </div>

              {/* Bio */}
              <div className="mb-1">
                <p className="text-text-secondary text-sm leading-relaxed">
                  {currentUser.bio}
                </p>
              </div>
            </div>
          </div>

          {/* Interests */}
          <div className="px-4 mb-1 mt-3">
            <div className="mb-2 border-t border-gray-300/30 w-16 mx-auto"></div>
            <p className="text-text-primary text-sm mb-1 font-bold">
              Interest Montages
            </p>
            <div className="flex flex-wrap gap-1.5">
              {currentUser.interests.map((interest, index) => (
                <span
                  key={index}
                  className="bg-aqua/20 text-aqua px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>

          {/* Photos - scrollable, similar to ProfileDetailModal */}
          {additionalPhotos.length > 0 && (
            <>
              {/* Divider line before photos */}
              <div className="mx-4 mb-1 border-t border-white/10"></div>
              
              <div className="px-4 mb-2">
                <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  <div className="grid grid-cols-2 gap-2">
                    {additionalPhotos.map((photo, index) => (
                      <img
                        key={photo}
                        src={photo}
                        alt={`${currentUser.name}'s photo ${index + 1}`}
                        className="w-full aspect-square rounded-lg object-cover cursor-pointer hover:scale-105 transition-transform duration-200 hover-glow"
                        onError={() => handleImageError(photo)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="ios-card" style={{ padding: '20px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#000000' }}>
          Your Connections
        </h3>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#06b6d4',
              marginBottom: '4px'
            }}>
              12
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Active Chats
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#06b6d4',
              marginBottom: '4px'
            }}>
              3
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Close Friends
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#06b6d4',
              marginBottom: '4px'
            }}>
              8
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              This Month
            </div>
          </div>
        </div>
      </div>

      {/* Profile Detail Modal for editing */}
      {showProfileModal && (
        <ProfileDetailModal
          userId={currentUser.id}
          onClose={handleCloseProfileModal}
        />
      )}
    </div>
  );
};

export default ProfilePage;
