import React from 'react';
import { MapPin, Users } from 'lucide-react';
import { User } from '../types';
import ScrollingText from './ScrollingText';
import { currentUser } from '../data/mockData';

interface UserCardProps {
  user: User;
  onClick?: () => void;
  isVerticalLayout?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ user, onClick, isVerticalLayout = false }): JSX.Element => {
  // Calculate mutual interests with current user
  const mutualInterests = user.interests.filter(interest => 
    currentUser.interests.includes(interest)
  );
  
  if (isVerticalLayout) {
    // Instagram-style feed layout
    return (
      <div 
        className="relative group cursor-pointer overflow-hidden mb-8" 
        onClick={onClick}
      >
        {/* Full-width Profile Picture */}
        <div className="relative">
          {user.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.name}
              className="w-full aspect-[4/5] object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full aspect-[4/5] bg-gray-200 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <div className="text-gray-500 text-6xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            {/* Top section - Name and Age */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white drop-shadow-lg mb-1">{user.name}, {user.age}</h3>
                <div className="flex items-center gap-3 text-white/90 text-sm">
                  <div className="flex items-center gap-1">
                    <MapPin size={16} className="drop-shadow-lg" />
                    <span className="drop-shadow-lg">{user.location.proximityKm}km away</span>
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
      className="relative group cursor-pointer overflow-hidden" 
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
                {user.location.proximityKm}km
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
