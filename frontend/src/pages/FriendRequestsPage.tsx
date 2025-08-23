import React, { useState } from 'react';
import { ArrowLeft, Check, X, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFriendRequests } from '../hooks/useFriendRequests';
import { AuthUser } from '../types';
import { getDisplayName, getInitials } from '../utils/nameHelpers';

const FriendRequestsPage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const { 
    pendingReceivedRequests, 
    sentRequests, 
    acceptFriendRequest, 
    declineFriendRequest, 
    cancelSentRequest,
    isLoading 
  } = useFriendRequests();
  
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');

  const handleAccept = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await declineFriendRequest(requestId);
    } catch (error) {
      console.error('Failed to decline friend request:', error);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await cancelSentRequest(requestId);
    } catch (error) {
      console.error('Failed to cancel friend request:', error);
    }
  };

  const renderUserRequest = (user: AuthUser, requestId: string, type: 'received' | 'sent') => (
    <div key={requestId} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100">
      <div className="flex items-center space-x-3">
        <div className="relative">
          {user.profile_picture ? (
            <img
              src={user.profile_picture}
              alt={getDisplayName(user)}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 font-semibold text-lg">
                {getInitials(user)}
              </span>
            </div>
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{getDisplayName(user)}</h3>
          <p className="text-sm text-gray-500">{user.location || 'Location not set'}</p>
          {/* Note: mutual friends count would need to be added to AuthUser or fetched separately */}
        </div>
      </div>
      
      <div className="flex space-x-2">
        {type === 'received' ? (
          <>
            <button
              onClick={() => handleAccept(requestId)}
              className="p-2 bg-aqua text-white rounded-full hover:bg-aqua/90 transition-colors"
              disabled={isLoading}
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => handleDecline(requestId)}
              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              disabled={isLoading}
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <button
            onClick={() => handleCancel(requestId)}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-sm mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Friend Requests</h1>
            <div className="w-9" /> {/* Spacer for centering */}
          </div>
          
          {/* Tab Navigation */}
          <div className="flex mt-4">
            <button
              onClick={() => setActiveTab('received')}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'received'
                  ? 'text-aqua border-aqua'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Received ({pendingReceivedRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sent'
                  ? 'text-aqua border-aqua'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Sent ({sentRequests.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-sm mx-auto px-4 py-6">
        {activeTab === 'received' ? (
          <div className="space-y-3">
            {pendingReceivedRequests.length > 0 ? (
              pendingReceivedRequests.map((request) =>
                renderUserRequest(request.user, request.id, 'received')
              )
            ) : (
              <div className="text-center py-12">
                <Users size={48} className="text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No friend requests</h3>
                <p className="text-gray-500 text-sm">
                  When someone sends you a friend request, it will appear here.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sentRequests.length > 0 ? (
              sentRequests.map((request) =>
                renderUserRequest(request.user, request.id, 'sent')
              )
            ) : (
              <div className="text-center py-12">
                <Users size={48} className="text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No sent requests</h3>
                <p className="text-gray-500 text-sm">
                  Friend requests you send will appear here until they're accepted or declined.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendRequestsPage;
