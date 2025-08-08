import React from 'react';
import { MapPin, Users } from 'lucide-react';
import { User } from '../types';
import ScrollingText from './ScrollingText';
import { currentUser } from '../data/mockData';

interface UserCardProps {
  user: User;
  onClick?: () => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onClick }): JSX.Element => {
  // Calculate mutual interests with current user
  const mutualInterests = user.interests.filter(interest => 
    currentUser.interests.includes(interest)
  );
  
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
        
        {/* Status indicator - top right */}
        {user.isAvailable && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-aqua rounded-full border-2 border-white" />
        )}
        {!user.isAvailable && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-accent-copper rounded-full border-2 border-white" />
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
