import React, { useEffect, useRef, useCallback } from 'react';
import { Heart, Loader2, AlertCircle, Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { FriendMemory, PublicUser } from '../services/userClient';
import { getDisplayName } from '../utils/nameHelpers';
import FriendMemoryCard from './FriendMemoryCard';

interface FriendMemoriesListProps {
  friend: PublicUser;
  memories: FriendMemory[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  deletingMemoryId: string | null;
  onLoadMore: () => void;
  onEditMemory: (memory: FriendMemory) => void;
  onDeleteMemory: (memoryId: string) => void;
  onClearError: () => void;
}

const FriendMemoriesList: React.FC<FriendMemoriesListProps> = ({
  friend,
  memories,
  loading,
  hasMore,
  error,
  deletingMemoryId,
  onLoadMore,
  onEditMemory,
  onDeleteMemory,
  onClearError
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    const option = {
      root: null,
      rootMargin: '100px',
      threshold: 0
    };

    const observer = new IntersectionObserver(handleObserver, option);
    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [handleObserver, hasMore, loading]);

  // Auto-retry on error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        onClearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, onClearError]);

  const displayName = getDisplayName(friend);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <div className="relative">
          {friend.profile_picture ? (
            <img
              src={friend.profile_picture}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-aqua rounded-full flex items-center justify-center">
            <Heart size={12} className="text-white" fill="currentColor" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Memories with {displayName}</h3>
          <p className="text-sm text-gray-500">
            {memories.length === 0 && !loading
              ? 'No memories yet'
              : `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`}
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-ios p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-red-500" />
            <h4 className="font-medium text-red-800">Error loading memories</h4>
          </div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={onClearError}
            className="text-sm text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-ios transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Memories List */}
      <div ref={listRef} className="space-y-4">
        <AnimatePresence>
          {memories.map((memory) => (
            <FriendMemoryCard
              key={memory.id}
              memory={memory}
              onEditClick={() => onEditMemory(memory)}
              onDeleteClick={() => onDeleteMemory(memory.id)}
              isDeleting={deletingMemoryId === memory.id}
            />
          ))}
        </AnimatePresence>

        {/* Loading State - Initial Load */}
        {loading && memories.length === 0 && (
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="ios-card p-4 animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-200 rounded"></div>
                    <div className="w-20 h-3 bg-gray-200 rounded"></div>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-full h-4 bg-gray-200 rounded"></div>
                  <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {memories.length === 0 && !loading && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart size={24} className="text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">No memories yet</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
              You haven't saved any memories with {displayName} yet. 
              Memories are created when you save important messages from your conversations.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-aqua">
              <Plus size={16} />
              <span>Memories are saved from chat conversations</span>
            </div>
          </div>
        )}

        {/* Load More Trigger */}
        {hasMore && memories.length > 0 && (
          <div ref={loadMoreRef} className="py-8 text-center">
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading more memories...</span>
              </div>
            ) : (
              <button
                onClick={onLoadMore}
                className="text-sm text-aqua hover:text-aqua-dark underline focus:outline-none focus:ring-2 focus:ring-aqua focus:ring-offset-2 rounded"
              >
                Load more memories
              </button>
            )}
          </div>
        )}

        {/* End of List Indicator */}
        {!hasMore && memories.length > 0 && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-xs text-gray-400">
              <div className="w-8 h-px bg-gray-200"></div>
              <span>All memories loaded</span>
              <div className="w-8 h-px bg-gray-200"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendMemoriesList;