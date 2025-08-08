import React from 'react';
import { Plus } from 'lucide-react';
import { Story, User } from '../types';
import { nearbyUsers } from '../data/mockData';

interface StoriesBarProps {
  stories: Story[];
}

const StoriesBar: React.FC<StoriesBarProps> = ({ stories }): JSX.Element => {
  const handleStoryClick = (story: Story): void => {
    console.log('View story:', story.id);
    // Here you would implement story viewing logic
  };

  const handleAddStory = (): void => {
    console.log('Add new story');
    // Here you would implement story creation
  };

  const getUserById = (userId: string): User | undefined => {
    return nearbyUsers.find(user => user.id === userId);
  };

  return (
    <div style={{ 
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <h3 style={{ 
        fontSize: '16px', 
        fontWeight: '600', 
        marginBottom: '12px',
        color: 'rgba(235, 235, 245, 0.8)'
      }}>
        Stories
      </h3>
      
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {/* Add Story Button */}
        <div
          onClick={handleAddStory}
          className="haptic-light"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            minWidth: '64px'
          }}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(118, 118, 128, 0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed rgba(255, 255, 255, 0.3)'
          }}>
            <Plus size={24} color="rgba(235, 235, 245, 0.6)" />
          </div>
          <span style={{
            fontSize: '12px',
            color: 'rgba(235, 235, 245, 0.6)',
            textAlign: 'center'
          }}>
            Your Story
          </span>
        </div>

        {/* Stories */}
        {stories.map((story) => {
          const user = getUserById(story.userId);
          if (!user) return null;

          const hasViewed = story.viewers.includes('1'); // Current user ID is '1'

          return (
            <div
              key={story.id}
              onClick={() => handleStoryClick(story)}
              className="haptic-light"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                minWidth: '64px'
              }}
            >
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                padding: '2px',
                background: hasViewed 
                  ? 'rgba(255, 255, 255, 0.3)' 
                  : 'linear-gradient(45deg, #007AFF, #FF9500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={user.profilePicture}
                  alt={user.name}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #000'
                  }}
                />
              </div>
              <span style={{
                fontSize: '12px',
                color: hasViewed ? 'rgba(235, 235, 245, 0.6)' : 'rgba(235, 235, 245, 0.8)',
                textAlign: 'center',
                maxWidth: '64px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user.name.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StoriesBar;
