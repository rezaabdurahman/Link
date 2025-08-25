import React from 'react';
import { ArrowLeft, Check, X, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFriendRequestsData } from '../hooks/useFriendRequestsData';
import { useFriendRequestsStore, useUIStore } from '../stores';
import { AuthUser } from '../types';
import { getDisplayName, getInitials } from '../utils/nameHelpers';

const FriendRequestsPageRefactored: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const { activeTab, setActiveTab } = useFriendRequestsStore();
  
  const { 
    receivedRequests, 
    sentRequests,
    pendingReceivedCount,
    acceptRequest, 
    declineRequest, 
    cancelRequest,
    isRequestProcessing,
    isLoading 
  } = useFriendRequestsData({ enabled: true });

  const handleAccept = async (requestId: string) => {
    try {
      await acceptRequest(requestId);
      showToast('Friend request accepted!', 'success');
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      showToast(error instanceof Error ? error.message : 'Failed to accept request', 'error');
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await declineRequest(requestId);
      showToast('Friend request declined', 'success');
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      showToast(error instanceof Error ? error.message : 'Failed to decline request', 'error');
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await cancelRequest(requestId);
      showToast('Friend request cancelled', 'success');
    } catch (error) {
      console.error('Failed to cancel friend request:', error);
      showToast(error instanceof Error ? error.message : 'Failed to cancel request', 'error');
    }
  };

  const renderUserRequest = (user: AuthUser, requestId: string, type: 'received' | 'sent') => {
    const isProcessing = isRequestProcessing(requestId);
    
    return (
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
          </div>
        </div>
        
        <div className="flex space-x-2">
          {type === 'received' ? (
            <>
              <button
                onClick={() => handleAccept(requestId)}
                className="p-2 bg-aqua text-white rounded-full hover:bg-aqua/90 transition-colors disabled:opacity-50"
                disabled={isProcessing}
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => handleDecline(requestId)}
                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                disabled={isProcessing}
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => handleCancel(requestId)}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
              disabled={isProcessing}
            >
              {isProcessing ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    );
  };

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
              Received ({pendingReceivedCount})
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

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua"></div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="max-w-sm mx-auto px-4 py-6">
          {activeTab === 'received' ? (
            <div className="space-y-3">
              {receivedRequests.length > 0 ? (
                receivedRequests.map((request) =>
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
      )}
    </div>
  );
};

export default FriendRequestsPageRefactored;