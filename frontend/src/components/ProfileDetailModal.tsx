import React, { useState, useEffect } from 'react';
import { X, MessageCircle, MapPin, Users, EyeOff } from 'lucide-react';
import { FaInstagram, FaTwitter, FaFacebook, FaLinkedin, FaTiktok, FaSnapchat, FaYoutube } from 'react-icons/fa';
import { User, Chat } from '../types';
import ConversationModal from './ConversationModal';
import FriendButton from './FriendButton';
import IconActionButton from './IconActionButton';
import { useFriendRequests } from '../hooks/useFriendRequests';
import { getUserProfile, UserProfileResponse, getProfileErrorMessage } from '../services/userClient';

interface ProfileDetailModalProps {
  userId: string;
  onClose: () => void;
  onHide?: (userId: string) => void;
}

// Helper function to convert UserProfileResponse to User type
const mapUserProfileToUser = (profile: UserProfileResponse): User => {
  return {
    id: profile.id,
    name: `${profile.first_name} ${profile.last_name}`.trim(),
    age: profile.age || (profile.date_of_birth ? 
      Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
      25), // Use age from backend or calculate it, fallback to 25
    profilePicture: profile.profile_picture || undefined,
    bio: profile.bio || 'No bio available',
    interests: profile.interests || [], // Use interests from backend
    location: {
      lat: 0, // Will need to be added to backend
      lng: 0, // Will need to be added to backend
      proximityMiles: Math.floor(Math.random() * 10) + 1 // fallback
    },
    isAvailable: true, // fallback
    mutualFriends: profile.mutual_friends ? Array(profile.mutual_friends).fill('').map(() => 'friend') : [], // Convert count to array
    connectionPriority: 'regular' as const,
    lastSeen: new Date(profile.last_login_at || Date.now()),
    profileType: 'public' as const // Will be determined by privacy settings
  };
};

const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({ userId, onClose, onHide }): JSX.Element => {
  const [user, setUser] = useState<User | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  
  // Use the friendship hook to get real friendship status
  const { getFriendshipStatus } = useFriendRequests();
  const friendshipStatus = getFriendshipStatus(userId).status;

  // Fetch user profile data when modal mounts or userId changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      
      setLoading(true);
      setError(undefined);
      
      try {
        const profileResponse = await getUserProfile(userId);
        const mappedUser = mapUserProfileToUser(profileResponse);
        setUser(mappedUser);
        setProfileResponse(profileResponse); // Store the full response
      } catch (err: any) {
        console.error('Failed to fetch user profile:', err);
        setError(getProfileErrorMessage(err.error || err, userId));
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  // Determine if users are friends based on friendship status
  const isFriend = friendshipStatus === 'friends';
  
  const handleFriendAction = (action: string, success: boolean) => {
    if (success) {
      console.log(`Friend action ${action} completed successfully`);
      // The friendship hook will automatically update the status
      // We can add any additional UI feedback here if needed
    }
  };

  const handleHideUser = (): void => {
    if (onHide && user) {
      onHide(user.id);
      onClose(); // Close the modal after hiding
    }
  };


  const handleModalKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Create a Chat object for ConversationModal (only when user is available)
  const chatData: Chat | null = user ? {
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
  } : null;

  // We'll need the original profile response to get social links and photos
  const [profileResponse, setProfileResponse] = useState<UserProfileResponse | undefined>(undefined);
  
  // Map social links from backend with appropriate brand icons
  const getSocialIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('instagram')) return FaInstagram;
    if (platformLower.includes('twitter') || platformLower.includes('x.com')) return FaTwitter;
    if (platformLower.includes('facebook')) return FaFacebook;
    if (platformLower.includes('linkedin')) return FaLinkedin;
    if (platformLower.includes('tiktok')) return FaTiktok;
    if (platformLower.includes('snapchat')) return FaSnapchat;
    if (platformLower.includes('youtube')) return FaYoutube;
    return MessageCircle; // fallback icon
  };

  const socialLinks = profileResponse?.social_links?.map(link => ({
    platform: link.platform,
    icon: getSocialIcon(link.platform),
    handle: link.username ? `@${link.username}` : link.url,
    url: link.url
  })) || [];

  // Use additional photos from backend and filter out broken ones
  const additionalPhotos = profileResponse?.additional_photos?.filter(photo => 
    photo && !brokenImages.has(photo)
  ) || [];

  // Handle broken images
  const handleImageError = (photoUrl: string) => {
    setBrokenImages(prev => new Set([...prev, photoUrl]));
  };

  // Loading skeleton component
  const ProfileSkeleton = () => (
    <div className="text-center mb-6">
      <div className="relative inline-block mb-4">
        <div className="w-30 h-30 rounded-full bg-surface-hover border-2 border-white/20 shadow-lg animate-pulse" />
      </div>
      <div className="h-8 bg-surface-hover rounded mb-2 animate-pulse" />
      <div className="h-4 bg-surface-hover rounded w-3/4 mx-auto mb-4 animate-pulse" />
      <div className="flex gap-3 justify-center">
        <div className="flex-1 max-w-36 h-12 bg-surface-hover rounded-ios animate-pulse" />
        <div className="flex-1 max-w-36 h-12 bg-surface-hover rounded-ios animate-pulse" />
      </div>
    </div>
  );

  // Error display component
  const ErrorDisplay = ({ errorMessage }: { errorMessage: string }) => (
    <div className="text-center py-8">
      <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
        <p className="text-red-400 font-medium">Unable to load profile</p>
        <p className="text-red-300 text-sm mt-1">{errorMessage}</p>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-aqua hover:bg-aqua-dark text-white rounded-lg transition-colors"
      >
        Retry
      </button>
    </div>
  );

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      onKeyDown={handleModalKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 pb-0">
          <h2 className="text-2xl font-bold m-0 text-gradient-aqua">
            Profile
          </h2>
          <div className="flex items-center gap-2">
            {/* Only Hide and Close buttons in header */}
            {user && onHide && (
              <IconActionButton
                Icon={EyeOff}
                label="Hide user"
                onClick={handleHideUser}
                variant="secondary"
                size="small"
              />
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors duration-200 flex items-center justify-center"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[80vh] overflow-y-auto scrollbar-hide">
          {loading && <ProfileSkeleton />}
          
          {error && <ErrorDisplay errorMessage={error} />}
          
          {user && !loading && !error && (
            <>
              {/* Profile Header */}
              <div className="text-center mb-4 p-5 pb-0">
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
                
                {/* Distance, Mutual Friends & Social Links */}
                <div className="flex justify-center items-center gap-4 mb-4 flex-wrap">
                  {/* Distance */}
                  <div className="flex items-center gap-1">
                    <MapPin size={16} className="text-text-secondary" />
                    <span className="text-text-secondary text-sm">
                      {user.location.proximityMiles} mi
                    </span>
                  </div>
                  
                  {/* Mutual Friends */}
                  {user.mutualFriends.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Users size={16} className="text-aqua" />
                      <span className="text-aqua text-sm font-medium">
                        {user.mutualFriends.length} mutuals
                      </span>
                    </div>
                  )}
                  
                  {/* Social Media Links - same row */}
                  {user.profileType === 'public' && socialLinks.length > 0 && (
                    <div className="flex gap-2">
                      {socialLinks.map((social, index) => {
                        const IconComponent = social.icon;
                        const getSocialIconColor = (platform: string) => {
                          const platformLower = platform.toLowerCase();
                          if (platformLower.includes('instagram')) return 'text-pink-500 hover:text-pink-600';
                          if (platformLower.includes('twitter') || platformLower.includes('x.com')) return 'text-blue-400 hover:text-blue-500';
                          if (platformLower.includes('facebook')) return 'text-blue-600 hover:text-blue-700';
                          if (platformLower.includes('linkedin')) return 'text-blue-700 hover:text-blue-800';
                          if (platformLower.includes('tiktok')) return 'text-black hover:text-gray-800';
                          if (platformLower.includes('snapchat')) return 'text-yellow-400 hover:text-yellow-500';
                          if (platformLower.includes('youtube')) return 'text-red-600 hover:text-red-700';
                          return 'text-aqua hover:text-aqua-dark';
                        };
                        
                        return (
                          <a
                            key={index}
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover-glow group"
                            title={social.handle}
                          >
                            <IconComponent 
                              size={16} 
                              className={`${getSocialIconColor(social.platform)} transition-colors`}
                            />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-5 mb-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={18} />
                    Send a message
                  </button>
                  <FriendButton
                    userId={user.id}
                    size="large"
                    variant="outline"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="px-5 mb-3">
                <h4 className="text-lg font-semibold mb-2 text-text-primary">
                  About
                </h4>
                <p className="text-text-secondary text-base leading-relaxed">
                  {user.bio}
                </p>
              </div>

              {/* Interests */}
              <div className="px-5 mb-3">
                <h4 className="text-lg font-semibold mb-2 text-text-primary">
                  Interests
                </h4>
                <div className="flex flex-wrap gap-2">
                  {user.interests && user.interests.length > 0 ? (
                    user.interests.map((interest, index) => (
                      <span
                        key={index}
                        className="bg-aqua/20 text-aqua px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm"
                      >
                        {interest}
                      </span>
                    ))
                  ) : (
                    <span className="text-text-secondary text-sm">No interests listed</span>
                  )}
                </div>
              </div>

              {/* Photos - only show for public profiles */}
              {user.profileType === 'public' && additionalPhotos.length > 0 && (
                <div className="px-5 mb-5">
                  <h4 className="text-lg font-semibold mb-2 text-text-primary">
                    Photos
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {additionalPhotos.map((photo, index) => (
                      <img
                        key={photo}
                        src={photo}
                        alt={`${user.name}'s photo ${index + 1}`}
                        className="w-full aspect-square rounded-xl object-cover cursor-pointer hover:scale-105 transition-transform duration-200 hover-glow"
                        onError={() => handleImageError(photo)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ConversationModal */}
        {chatData && (
          <ConversationModal
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            chat={chatData}
            onAddFriend={() => handleFriendAction('send', true)}
            isFriend={isFriend}
          />
        )}
      </div>
    </div>
  );
};

export default ProfileDetailModal;
