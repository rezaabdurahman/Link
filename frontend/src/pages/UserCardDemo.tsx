import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UserCard from '../components/UserCard';
import { nearbyUsers } from '../data/mockData';
import { getDisplayName } from '../utils/nameHelpers';

const UserCardDemo: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const [isVerticalLayout, setIsVerticalLayout] = useState(true);
  const [showFriendButtons, setShowFriendButtons] = useState(true);

  const sampleUsers = nearbyUsers.slice(0, 6); // Show first 6 users

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-700" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">UserCard Demo</h1>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Layout:</label>
              <button
                onClick={() => setIsVerticalLayout(!isVerticalLayout)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  isVerticalLayout 
                    ? 'bg-aqua text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isVerticalLayout ? 'Vertical' : 'Grid'}
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Friend Buttons:</label>
              <button
                onClick={() => setShowFriendButtons(!showFriendButtons)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  showFriendButtons 
                    ? 'bg-aqua text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showFriendButtons ? 'Shown' : 'Hidden'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Content */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            {isVerticalLayout ? 'Vertical Feed Layout' : 'Grid Layout'}
          </h2>
          <p className="text-sm text-gray-600">
            Testing UserCard component with different layouts and configurations
          </p>
        </div>

        {isVerticalLayout ? (
          // Vertical Feed Layout
          <div className="max-w-sm mx-auto space-y-8">
            {sampleUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isVerticalLayout={true}
                showFriendButton={showFriendButtons}
                onClick={() => console.log('Clicked user:', getDisplayName(user))}
              />
            ))}
          </div>
        ) : (
          // Grid Layout
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sampleUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isVerticalLayout={false}
                showFriendButton={showFriendButtons}
                onClick={() => console.log('Clicked user:', getDisplayName(user))}
              />
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Demo Features</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Vertical Layout</h4>
              <ul className="space-y-1">
                <li>• Instagram-style feed cards</li>
                <li>• Full-width media display</li>
                <li>• Overlay content with gradients</li>
                <li>• Video playback support</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Grid Layout</h4>
              <ul className="space-y-1">
                <li>• Compact grid cards</li>
                <li>• Discovery page style</li>
                <li>• Hover animations</li>
                <li>• Responsive design</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCardDemo;
