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
      className="ios-card haptic-light fade-in hover-glow group cursor-pointer p-4" 
      onClick={onClick}
    >
      {/* Profile Picture */}
      <div className="relative mb-3">
        {user.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={user.name}
            className="w-full aspect-square rounded-ios object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full aspect-square rounded-ios bg-surface-hover flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <div className="text-text-muted text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        {user.isAvailable && (
          <div className="online-indicator" />
        )}
        {!user.isAvailable && (
          <div className="offline-indicator" />
        )}
      </div>

      {/* User Info */}
      <div className="mb-3">
        <h3 className="text-base font-semibold mb-1 leading-tight text-gradient-primary">
          {user.name}, {user.age}
        </h3>
        
        {/* Distance and Mutual Friends */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1">
            <MapPin size={12} className="text-text-muted" />
            <span className="text-text-muted text-xs">
              {user.location.proximityKm}km away
            </span>
          </div>
          
          {user.mutualFriends.length > 0 && (
            <div className="flex items-center gap-1">
              <Users size={12} className="text-aqua" />
              <span className="text-aqua text-xs font-medium">
                {user.mutualFriends.length} mutual
              </span>
            </div>
          )}
        </div>

        {/* Bio */}
        <p className="text-text-secondary text-xs leading-tight mb-2 line-clamp-2">
          {user.bio}
        </p>

        {/* Interests */}
        <div className="flex flex-wrap gap-1">
          {user.interests.slice(0, 2).map((interest, index) => (
            <span
              key={index}
              className="bg-aqua/20 text-aqua px-2 py-0.5 rounded-full text-xs font-medium"
            >
              {interest}
            </span>
          ))}
          {user.interests.length > 2 && (
            <span className="bg-white/10 text-text-muted px-2 py-0.5 rounded-full text-xs">
              +{user.interests.length - 2}
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

export default UserCard;
