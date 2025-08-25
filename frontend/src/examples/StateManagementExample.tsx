import React from 'react';
import { useUIStore, useDiscoveryStore, useChatStore, useUserPreferencesStore } from '../stores';
import { useDiscoveryData, useChatsData } from '../hooks';

const StateManagementExample: React.FC = (): JSX.Element => {
  // Zustand stores
  const { 
    toast, 
    showToast, 
    isGridView, 
    toggleGridView,
    modals,
    openModal,
    closeModal 
  } = useUIStore();

  const {
    searchQuery,
    searchResults,
    isSearching,
    activeFilters,
    setSearchQuery,
    addInterestFilter,
    removeInterestFilter,
    hasActiveFilters,
    clearFilters
  } = useDiscoveryStore();

  const {
    chats,
    sortBy,
    setSortBy,
    getSortedChats,
    getUnreadCount,
    messageDrafts,
    setMessageDraft,
    getMessageDraft
  } = useChatStore();

  const {
    preferences,
    setPreference,
    getEffectiveTheme,
    shouldReduceMotion,
    exportPreferences,
    importPreferences
  } = useUserPreferencesStore();

  // SWR hooks
  const { 
    users: discoveryUsers, 
    isLoading: discoveryLoading 
  } = useDiscoveryData();

  const { 
    chats: swrChats, 
    isLoading: chatsLoading 
  } = useChatsData();

  const handleExportPreferences = () => {
    const exported = exportPreferences();
    navigator.clipboard.writeText(exported);
    showToast('Preferences copied to clipboard!', 'success');
  };

  const handleImportPreferences = () => {
    navigator.clipboard.readText().then(text => {
      const success = importPreferences(text);
      if (success) {
        showToast('Preferences imported successfully!', 'success');
      } else {
        showToast('Failed to import preferences', 'error');
      }
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">State Management Example</h1>
      
      {/* UI Store Example */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">UI Store</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex gap-4">
            <button
              onClick={() => showToast('Success message!', 'success')}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Show Success Toast
            </button>
            <button
              onClick={() => showToast('Error message!', 'error')}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Show Error Toast
            </button>
            <button
              onClick={toggleGridView}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Toggle Grid View ({isGridView ? 'Grid' : 'List'})
            </button>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => openModal('isProfileDetailModalOpen', 'user-123')}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Open Profile Modal
            </button>
            <button
              onClick={() => closeModal('isProfileDetailModalOpen')}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Close Profile Modal
            </button>
          </div>
          
          <div className="text-sm text-gray-600">
            Modal Open: {modals.isProfileDetailModalOpen ? 'Yes' : 'No'} | 
            Selected User: {modals.selectedUserId || 'None'}
          </div>
        </div>
      </div>

      {/* Discovery Store Example */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Discovery Store</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search query..."
              className="px-3 py-2 border rounded"
            />
            <button
              onClick={() => addInterestFilter('Technology')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Tech Filter
            </button>
            <button
              onClick={() => removeInterestFilter('Technology')}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Remove Tech Filter
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear Filters
            </button>
          </div>
          
          <div className="text-sm text-gray-600">
            Search Query: "{searchQuery}" | 
            Results: {searchResults.length} | 
            Searching: {isSearching ? 'Yes' : 'No'} | 
            Active Filters: {hasActiveFilters() ? 'Yes' : 'No'} | 
            Interests: [{activeFilters.interests.join(', ')}]
          </div>
          
          <div className="text-sm text-gray-600">
            SWR Discovery Users: {discoveryUsers.length} | 
            Loading: {discoveryLoading ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      {/* Chat Store Example */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Chat Store</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex gap-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border rounded"
            >
              <option value="priority">Priority</option>
              <option value="time">Time</option>
              <option value="unread">Unread</option>
            </select>
            <button
              onClick={() => setMessageDraft('conv-1', 'Hello world!')}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Set Draft
            </button>
            <span className="py-2 text-sm">
              Draft: "{getMessageDraft('conv-1')}"
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            Store Chats: {chats.length} | 
            Sorted Chats: {getSortedChats().length} | 
            Unread Count: {getUnreadCount()} | 
            Sort By: {sortBy}
          </div>
          
          <div className="text-sm text-gray-600">
            SWR Chats: {swrChats.length} | 
            Loading: {chatsLoading ? 'Yes' : 'No'}
          </div>
          
          <div className="text-sm text-gray-600">
            Message Drafts: {Object.keys(messageDrafts).length} |
            {Object.entries(messageDrafts).map(([convId, draft]) => (
              <span key={convId} className="ml-2">
                {convId}: "{draft.substring(0, 20)}{draft.length > 20 ? '...' : ''}"
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* User Preferences Store Example */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">User Preferences Store</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.defaultGridView}
                onChange={(e) => setPreference('defaultGridView', e.target.checked)}
                className="mr-2"
              />
              Default Grid View
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.autoRefreshResults}
                onChange={(e) => setPreference('autoRefreshResults', e.target.checked)}
                className="mr-2"
              />
              Auto Refresh Results
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.showClickLikelihoods}
                onChange={(e) => setPreference('showClickLikelihoods', e.target.checked)}
                className="mr-2"
              />
              Show Click Likelihoods
            </label>
          </div>
          
          <div className="flex gap-4">
            <select
              value={preferences.theme}
              onChange={(e) => setPreference('theme', e.target.value as any)}
              className="px-3 py-2 border rounded"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            
            <select
              value={preferences.imageQuality}
              onChange={(e) => setPreference('imageQuality', e.target.value as any)}
              className="px-3 py-2 border rounded"
            >
              <option value="low">Low Quality</option>
              <option value="medium">Medium Quality</option>
              <option value="high">High Quality</option>
            </select>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleExportPreferences}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Export Preferences
            </button>
            <button
              onClick={handleImportPreferences}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Import Preferences
            </button>
          </div>
          
          <div className="text-sm text-gray-600">
            Theme: {preferences.theme} (Effective: {getEffectiveTheme()}) | 
            Reduced Motion: {shouldReduceMotion() ? 'Yes' : 'No'} | 
            Max Distance: {preferences.maxSearchDistance}km
          </div>
        </div>
      </div>

      {/* Toast Display */}
      {toast.isVisible && (
        <div className={`fixed top-4 right-4 p-4 rounded shadow-lg z-50 ${
          toast.type === 'success' 
            ? 'bg-green-500 text-white' 
            : toast.type === 'error' 
            ? 'bg-red-500 text-white'
            : 'bg-blue-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default StateManagementExample;