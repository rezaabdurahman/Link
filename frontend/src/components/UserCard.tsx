import React, { useRef, useState, useEffect } from 'react';
import { MapPin, Users, Play, Volume2, VolumeX } from 'lucide-react';
import { User } from '../types';
import ScrollingText from './ScrollingText';
import { currentUser } from '../data/mockData';
import { FriendButtonMini } from './FriendButton';

interface UserCardProps {
  user: User;
  onClick?: () => void;
  isVerticalLayout?: boolean;
  showFriendButton?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ user, onClick, isVerticalLayout = false, showFriendButton = true }): JSX.Element => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(true);

  // Calculate mutual interests with current user
  const mutualInterests = user.interests.filter(interest => 
    currentUser.interests.includes(interest)
  );

  // Get media source (prioritize new profileMedia, fallback to old profilePicture)
  const media = user.profileMedia || (user.profilePicture ? { type: 'image' as const, url: user.profilePicture } : null);

  // Handle video play/pause
  const handleVideoToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setShowPlayButton(true);
      } else {
        videoRef.current.play();
        setShowPlayButton(false);
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  // Handle mute toggle
  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Auto-play video when in view (optional)
  useEffect(() => {
    const video = videoRef.current;
    if (video && media?.type === 'video') {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            // Auto-play when 50% of video is visible
            video.play();
            setIsVideoPlaying(true);
            setShowPlayButton(false);
          } else {
            // Pause when out of view
            video.pause();
            setIsVideoPlaying(false);
            setShowPlayButton(true);
          }
        },
        { threshold: 0.5 }
      );
      
      observer.observe(video);
      
      return () => {
        observer.disconnect();
      };
    }
  }, [media?.type]);
  
  if (isVerticalLayout) {
    // Instagram-style feed layout
    return (
      <div 
        className="relative group cursor-pointer overflow-hidden mb-8 fade-in hover-glow" 
        onClick={onClick}
      >
        {/* Full-width Profile Media */}
        <div className="relative">
          {media ? (
            media.type === 'video' ? (
              <>
                <video
                  ref={videoRef}
                  src={media.url}
                  poster={media.thumbnail}
                  className="w-full aspect-[4/5] object-cover transition-transform duration-300 group-hover:scale-105"
                  loop
                  muted={isMuted}
                  playsInline
                  preload="metadata"
                />
                {/* Video Controls Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Play/Pause Button */}
                  {showPlayButton && (
                  <button
                    onClick={handleVideoToggle}
                    className="bg-black/50 backdrop-blur-sm rounded-full p-4 text-white hover:bg-black/70 transition-all duration-200 hover-scale"
                  >
                      <Play size={32} className="ml-1" fill="currentColor" />
                    </button>
                  )}
                </div>
                {/* Mute Toggle */}
                <button
                  onClick={handleMuteToggle}
                  className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-full p-2 text-white hover:bg-black/70 transition-all duration-200 hover-scale"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                {/* Video Duration Indicator */}
                {media.duration && (
                  <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 text-white text-xs">
                    {Math.floor(media.duration)}s
                  </div>
                )}
              </>
            ) : (
              <img
                src={media.url}
                alt={user.name}
                className="w-full aspect-[4/5] object-cover transition-transform duration-300 group-hover:scale-105"
              />
            )
          ) : (
            <div className="w-full aspect-[4/5] bg-gray-200 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <div className="text-gray-500 text-6xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          
          {/* Friend Button Overlay */}
          {showFriendButton && (
            <div 
              className="absolute top-3 right-3 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <FriendButtonMini userId={user.id} />
            </div>
          )}
          
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
            {/* Enable pointer events only for interactive elements */}
            {/* Top section - Name and Age */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white drop-shadow-lg mb-1">{user.name}, {user.age}</h3>
                <div className="flex items-center gap-3 text-white/90 text-sm">
                  <div className="flex items-center gap-1">
                    <MapPin size={16} className="drop-shadow-lg" />
                    <span className="drop-shadow-lg">{user.location.proximityMiles}mi away</span>
                  </div>
                  {user.mutualFriends.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Users size={16} className="drop-shadow-lg" />
                      <span className="drop-shadow-lg">{user.mutualFriends.length} mutual</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Bottom section - Broadcast and Interests */}
            <div className="space-y-3">
              {/* Broadcast */}
              {user.broadcast && (
                <div className="bg-black/40 backdrop-blur-sm rounded-ios px-4 py-3">
                  <ScrollingText 
                    text={user.broadcast}
                    className="text-white text-base drop-shadow-sm"
                  />
                </div>
              )}
              
              {/* Mutual Interests */}
              {mutualInterests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mutualInterests.slice(0, 4).map((interest, index) => (
                    <span
                      key={index}
                      className="bg-aqua/90 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm drop-shadow-lg"
                    >
                      {interest}
                    </span>
                  ))}
                  {mutualInterests.length > 4 && (
                    <span className="bg-aqua/90 text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-sm drop-shadow-lg">
                      +{mutualInterests.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Original grid layout (keeping for backwards compatibility)
  return (
    <div 
      className="relative group cursor-pointer overflow-hidden fade-in hover-glow" 
      onClick={onClick}
    >
      {/* Profile Picture */}
      <div className="relative gradient-overlay-bottom-strong">
        {user.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={user.name}
            className="w-full aspect-[2/3] object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-200 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <div className="text-gray-500 text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        
        {/* Friend Button Overlay */}
        {showFriendButton && (
          <div 
            className="absolute top-3 right-3 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <FriendButtonMini userId={user.id} />
          </div>
        )}
        
        {/* Bottom Overlay Content */}
        <div className="overlay-content absolute bottom-0 left-0 right-0 p-2 space-y-2">
          {/* User Broadcast */}
          {user.broadcast && (
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
              <ScrollingText 
                text={user.broadcast}
                className="text-white text-xs drop-shadow-sm"
              />
            </div>
          )}
          
          {/* Mutual Interests */}
          {mutualInterests.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mutualInterests.slice(0, 2).map((interest, index) => (
                <span
                  key={index}
                  className="bg-aqua/80 text-white px-2 py-0.5 rounded-full text-xs font-medium drop-shadow-sm"
                >
                  {interest}
                </span>
              ))}
              {mutualInterests.length > 2 && (
                <span className="bg-aqua/80 text-white px-2 py-0.5 rounded-full text-xs drop-shadow-sm">
                  ...
                </span>
              )}
            </div>
          )}
          
          {/* Distance and Mutual Friends */}
          <div className="flex items-center gap-3">
            {/* Distance */}
            <div className="flex items-center gap-1">
              <MapPin size={10} className="text-white drop-shadow-sm" />
              <span className="text-white text-xs drop-shadow-sm">
                {user.location.proximityMiles}mi
              </span>
            </div>
            
            {/* Mutual Friends */}
            {user.mutualFriends.length > 0 && (
              <div className="flex items-center gap-1">
                <Users size={10} className="text-white drop-shadow-sm" />
                <span className="text-white text-xs drop-shadow-sm">
                  {user.mutualFriends.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCard;
