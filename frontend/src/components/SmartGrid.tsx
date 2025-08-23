import React from 'react';
import { User } from '../types';
import { 
  UserWithLikelihood, 
  GridChunk, 
  // getGridPositions,
  logGridChunks 
} from '../services/clickLikelihoodClient';
import { getDisplayName } from '../utils/nameHelpers';

interface SmartGridProps {
  chunks: GridChunk[];
  onUserClick: (user: User) => void;
  showAnimation: boolean;
  className?: string;
}

interface GridUserCardProps {
  user: UserWithLikelihood;
  onClick: (user: User) => void;
  isProminent?: boolean;
  style?: React.CSSProperties;
  animationDelay?: number;
  showAnimation: boolean;
}

const GridUserCard: React.FC<GridUserCardProps> = ({ 
  user, 
  onClick, 
  isProminent = false, 
  style,
  animationDelay = 0,
  showAnimation
}) => {
  // Video state
  const [isVideoLoaded, setIsVideoLoaded] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Intersection Observer for autoplay
  React.useEffect(() => {
    if (!videoRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play();
            setIsPlaying(true);
          } else {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.5 } // Start playing when 50% visible
    );

    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  // Determine if user has video or image
  const hasVideo = user.profileMedia?.type === 'video';
  const mediaSource = hasVideo ? user.profileMedia?.thumbnail : user.profilePicture;
  const videoSource = hasVideo ? user.profileMedia?.url : undefined;

  return (
    <div
      className={`opacity-0 w-full h-full ${showAnimation ? 'animate-card-entrance' : ''}`}
      style={{
        ...style,
        animationDelay: showAnimation ? `${animationDelay}ms` : '0ms',
        animationFillMode: 'forwards'
      }}
    >
      <button
        onClick={() => onClick(user)}
        className={`
          relative w-full h-full overflow-hidden bg-gray-100 
          hover:scale-[1.01] transition-all duration-300 ease-out
          ${isProminent ? 'rounded-xl shadow-sm' : 'rounded-md'}
          block
        `}
      >
        {/* Show video if available */}
        {hasVideo && videoSource ? (
          <>
            <video
              ref={videoRef}
              src={videoSource}
              poster={mediaSource}
              className="w-full h-full object-cover"
              playsInline
              loop
              muted
              onLoadedData={() => setIsVideoLoaded(true)}
              onError={() => setIsVideoLoaded(false)}
            />
            {!isVideoLoaded && (
              <img
                src={mediaSource}
                alt={getDisplayName(user)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </>
        ) : (
          <img
            src={mediaSource}
            alt={getDisplayName(user)}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Video indicator - only show when video is paused */}
        {hasVideo && !isPlaying && (
          <div className={`
            absolute ${isProminent ? 'top-3 right-3 w-6 h-6' : 'top-2 right-2 w-5 h-5'} 
            bg-black/60 rounded-full flex items-center justify-center
          `}>
            <svg 
              className={`${isProminent ? 'w-4 h-4' : 'w-3 h-3'} text-white`} 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}

      </button>
    </div>
  );
};

interface GridChunkComponentProps {
  chunk: GridChunk;
  onUserClick: (user: User) => void;
  showAnimation: boolean;
  baseAnimationDelay: number;
}

const GridChunkComponent: React.FC<GridChunkComponentProps> = ({ 
  chunk, 
  onUserClick, 
  showAnimation, 
  baseAnimationDelay 
}) => {
  // Calculate positions using absolute positioning for perfect alignment
  const cellSize = 'calc((100% - 4px) / 3)'; // Account for 2px gaps (0.5 * 4)
  const gap = '2px';
  
  // Position calculations for 3x3 grid
  const getAbsolutePosition = (col: number, row: number, spanCols: number = 1, spanRows: number = 1) => {
    const left = col === 1 ? '0%' : col === 2 ? `calc(${cellSize} + ${gap})` : `calc(2 * ${cellSize} + 2 * ${gap})`;
    const top = row === 1 ? '0%' : row === 2 ? `calc(${cellSize} + ${gap})` : `calc(2 * ${cellSize} + 2 * ${gap})`;
    const width = spanCols === 1 ? cellSize : `calc(2 * ${cellSize} + ${gap})`;
    const height = spanRows === 1 ? cellSize : `calc(2 * ${cellSize} + ${gap})`;
    
    return { left, top, width, height };
  };

  // Define positions based on alternating pattern
  const positions = chunk.is2x2TopLeft 
    ? {
        prominent: getAbsolutePosition(1, 1, 2, 2), // Top-left 2x2
        regular: [
          getAbsolutePosition(3, 1), // Top-right
          getAbsolutePosition(3, 2), // Middle-right  
          getAbsolutePosition(1, 3), // Bottom-left
          getAbsolutePosition(2, 3), // Bottom-center
          getAbsolutePosition(3, 3), // Bottom-right
        ]
      }
    : {
        prominent: getAbsolutePosition(2, 1, 2, 2), // Top-right 2x2
        regular: [
          getAbsolutePosition(1, 1), // Top-left
          getAbsolutePosition(1, 2), // Middle-left
          getAbsolutePosition(1, 3), // Bottom-left
          getAbsolutePosition(2, 3), // Bottom-center
          getAbsolutePosition(3, 3), // Bottom-right
        ]
      };

  return (
    <div className="relative w-full aspect-square">
      {/* Prominent User (2x2) */}
      <div 
        className="absolute overflow-hidden"
        style={positions.prominent}
      >
        <GridUserCard
          user={chunk.prominentUser}
          onClick={onUserClick}
          isProminent={true}
          animationDelay={baseAnimationDelay}
          showAnimation={showAnimation}
        />
      </div>

      {/* Regular Users (1x1 each) */}
      {chunk.regularUsers.map((user, index) => {
        const position = positions.regular[index];
        if (!position) return null;
        
        return (
          <div
            key={user.id}
            className="absolute overflow-hidden"
            style={position}
          >
            <GridUserCard
              user={user}
              onClick={onUserClick}
              isProminent={false}
              animationDelay={baseAnimationDelay + (index + 1) * 30}
              showAnimation={showAnimation}
            />
          </div>
        );
      })}

      {/* Empty cells for visual balance */}
      {Array.from({ length: Math.max(0, 5 - chunk.regularUsers.length) }).map((_, index) => {
        const position = positions.regular[chunk.regularUsers.length + index];
        if (!position) return null;
        
        return (
          <div 
            key={`empty-${index}`} 
            className="absolute overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 rounded-md opacity-30 border border-gray-100"
            style={position}
          />
        );
      })}
    </div>
  );
};

const SmartGrid: React.FC<SmartGridProps> = ({ 
  chunks, 
  onUserClick, 
  showAnimation, 
  className = '' 
}) => {
  // Log grid analysis in development
  React.useEffect(() => {
    if (chunks.length > 0) {
      logGridChunks(chunks);
    }
  }, [chunks]);

  return (
    <div className={`flex flex-col space-y-1 ${className}`}>
      {chunks.map((chunk, chunkIndex) => {
        // Stagger chunk animations
        const baseAnimationDelay = chunkIndex * 200 + 100; // 200ms between chunks
        
        return (
          <GridChunkComponent
            key={`chunk-${chunk.chunkIndex}`}
            chunk={chunk}
            onUserClick={onUserClick}
            showAnimation={showAnimation}
            baseAnimationDelay={baseAnimationDelay}
          />
        );
      })}
    </div>
  );
};

export default SmartGrid;
