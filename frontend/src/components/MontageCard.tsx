import React, { useState } from 'react';
import { Clock, MapPin, Tag, Play } from 'lucide-react';
import { MontageItem } from '../types/montage';

interface MontageCardProps {
  item: MontageItem;
  onItemClick: (checkinId: string) => void;
  className?: string;
}

const MontageCard: React.FC<MontageCardProps> = ({ 
  item, 
  onItemClick, 
  className = '' 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Helper function to format time ago
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
  };

  // Get media display info
  const getMediaInfo = () => {
    const { widget_metadata, widget_type } = item;
    
    if (widget_type === 'media' && widget_metadata.media_url) {
      return {
        url: widget_metadata.thumbnail_url || widget_metadata.media_url,
        isVideo: widget_metadata.media_type === 'video',
        duration: widget_metadata.duration,
      };
    }
    
    return null;
  };

  // Get fallback thumbnail based on widget type
  const getFallbackThumbnail = () => {
    const { widget_type } = item;
    
    switch (widget_type) {
      case 'text':
        return 'bg-blue-500';
      case 'location':
        return 'bg-green-500';
      case 'activity':
        return 'bg-orange-500';
      case 'mood':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Format video duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const mediaInfo = getMediaInfo();
  const timeAgo = formatTimeAgo(item.created_at);
  const tags = item.widget_metadata.tags || [];
  const location = item.widget_metadata.location;

  const handleClick = () => {
    onItemClick(item.checkin_id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`relative flex-shrink-0 w-32 h-40 rounded-lg overflow-hidden bg-surface-hover shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.02] ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View check-in from ${timeAgo} ago`}
    >
      {/* Media/Thumbnail */}
      <div className="w-full h-24 relative overflow-hidden">
        {mediaInfo && !imageError ? (
          <>
            <img
              src={mediaInfo.url}
              alt={item.widget_metadata.description || 'Montage item'}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
            {!imageLoaded && (
              <div className={`absolute inset-0 ${getFallbackThumbnail()} animate-pulse flex items-center justify-center`}>
                <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              </div>
            )}
            {/* Video indicator */}
            {mediaInfo.isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                  <Play size={12} className="text-white ml-0.5" />
                </div>
              </div>
            )}
            {/* Duration indicator */}
            {mediaInfo.isVideo && mediaInfo.duration && (
              <div className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded text-white text-xs">
                {formatDuration(mediaInfo.duration)}
              </div>
            )}
          </>
        ) : (
          <div className={`w-full h-full ${getFallbackThumbnail()} flex items-center justify-center`}>
            <div className="text-white text-xs font-medium capitalize">
              {item.widget_type}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2 h-16 flex flex-col justify-between">
        {/* Description/Tags */}
        <div className="flex-1 overflow-hidden">
          {item.widget_metadata.description ? (
            <p className="text-text-primary text-xs line-clamp-2 mb-1">
              {item.widget_metadata.description}
            </p>
          ) : tags.length > 0 ? (
            <div className="flex flex-wrap gap-0.5 mb-1">
              {tags.slice(0, 2).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-aqua/20 text-aqua rounded text-xs font-medium"
                >
                  <Tag size={8} />
                  {tag}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="text-text-secondary text-xs">+{tags.length - 2}</span>
              )}
            </div>
          ) : (
            <div className="text-text-secondary text-xs capitalize">
              {item.widget_type} content
            </div>
          )}
        </div>

        {/* Footer - Time and Location */}
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <span>{timeAgo}</span>
          </div>
          {location && (
            <div className="flex items-center gap-1 truncate max-w-16">
              <MapPin size={10} />
              <span className="truncate">{location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white/0 hover:bg-white/5 transition-colors duration-200 pointer-events-none" />
    </div>
  );
};

export default MontageCard;
