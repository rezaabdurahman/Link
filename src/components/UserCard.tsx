import React from 'react';
import { MapPin, Users } from 'lucide-react';
import { User } from '../types';

interface UserCardProps {
  user: User;
  onClick?: () => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onClick }): JSX.Element => {
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
            className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full aspect-square bg-gray-200 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <div className="text-gray-500 text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        
        {/* Status indicator - top right */}
        {user.isAvailable && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-accent-green rounded-full border-2 border-white" />
        )}
        {!user.isAvailable && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-accent-orange rounded-full border-2 border-white" />
        )}
        
        {/* Bottom Overlay Content */}
        <div className="overlay-content absolute bottom-0 left-0 right-0 p-2">
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
