// Context exports for clean imports
export { AuthProvider, useAuth } from './AuthContext';
export type { default as AuthProviderType } from './AuthContext';

// Friendship hook export (not context-based, but logically grouped here)
export { useFriendship, clearFriendshipCache, updateFriendshipStatus } from '../hooks/useFriendship';
export type { UseFriendshipReturn } from '../hooks/useFriendship';
