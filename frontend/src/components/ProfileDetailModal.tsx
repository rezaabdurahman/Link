import React, { useState, useEffect, useRef } from 'react';
import { X, MessageCircle, MapPin, Users, Clock, Edit3, Trash2, Share, Plus, HelpCircle, Megaphone, Shield, Globe, Lock } from 'lucide-react';
import { FaInstagram, FaTwitter, FaFacebook, FaLinkedin, FaTiktok, FaSnapchat, FaYoutube } from 'react-icons/fa';
import { User, Chat } from '../types';
import { CheckIn, Privacy } from '../types/checkin';
import ConversationModal from './ConversationModal';
import FriendButton from './FriendButton';
import BlockButton from './BlockButton';
import CheckInModal from './CheckInModal';
import CheckInDetailModal from './CheckInDetailModal';
import { useFriendRequests } from '../hooks/useFriendRequests';
import { getUserProfile, UserProfileResponse, getProfileErrorMessage } from '../services/userClient';
import { useMontage } from '../hooks/useMontage';
import MontageCarousel from './MontageCarousel';
import { motion } from 'framer-motion';
import { getUserBroadcast, PublicBroadcastResponse, getBroadcastErrorMessage, isBroadcastError } from '../services/broadcastClient';
import { getDisplayName, getInitials } from '../utils/nameHelpers';
import { getOrCreateDirectConversation, conversationToDirectChat } from '../services/chatClient';
import { useAuth } from '../contexts/AuthContext';
import { 
  getUserCheckIns, 
  createCheckIn, 
  updateCheckIn, 
  deleteCheckIn, 
  convertCheckInDataToRequest,
  getCheckInErrorMessage,
  isCheckInError,
  type CheckInApiError
} from '../services/checkinClient';
import { updateProfile, UpdateProfileRequest } from '../services/userClient';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { convertBackendCheckInToExtended, ExtendedCheckIn } from '../utils/checkinTransformers';

interface ProfileDetailModalProps {
  userId: string;
  onClose: () => void;
  onBlock?: (userId: string) => void;
  mode?: 'own' | 'other'; // 'own' for viewing own profile, 'other' for viewing others
  isEmbedded?: boolean; // true when used in ProfilePage, false when used as modal
  showMontageByDefault?: boolean; // true to show montage section by default
  isEditing?: boolean; // true when in editing mode
  bioEditTrigger?: number; // number that changes to trigger bio editing
}

// Helper function to determine if content should be shown based on privacy settings
const shouldShowContent = (
  profile: UserProfileResponse, 
  contentType: 'name' | 'age' | 'location' | 'social_media' | 'montages' | 'checkins' | 'mutual_friends',
  mode: 'own' | 'other'
): boolean => {
  // Always show everything for own profile
  if (mode === 'own') return true;
  
  // For public profiles, show everything
  if (profile.profile_visibility === 'public') return true;
  
  // For private profiles, check granular settings only if not a friend
  // Note: The backend already handles friend logic and returns appropriate data
  // If data exists in the response, it means we're allowed to see it
  return profile.privacy_settings?.[`show_${contentType}`] ?? true;
};

// Helper function to convert UserProfileResponse to User type
const mapUserProfileToUser = (profile: UserProfileResponse, mode: 'own' | 'other' = 'other'): User => {
  return {
    id: profile.id,
    first_name: shouldShowContent(profile, 'name', mode) ? profile.first_name : '',
    last_name: shouldShowContent(profile, 'name', mode) ? profile.last_name : '',
    age: shouldShowContent(profile, 'age', mode) ? (profile.age ?? (profile.date_of_birth ? 
      Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
      25)) : 25, // Use age from backend or calculate it, fallback to 25
    profilePicture: profile.profile_picture || undefined, // Always show profile picture
    bio: shouldShowContent(profile, 'montages', mode) ? (profile.bio || 'No bio available') : 'This user has chosen to keep their bio private.',
    interests: shouldShowContent(profile, 'montages', mode) ? (profile.interests || []) : [], // Use interests from backend if allowed
    location: {
      lat: 0, // Will need to be added to backend
      lng: 0, // Will need to be added to backend
      proximityMiles: shouldShowContent(profile, 'location', mode) ? Math.floor(Math.random() * 10) + 1 : 0 // fallback
    },
    isAvailable: true, // fallback
    mutualFriends: shouldShowContent(profile, 'mutual_friends', mode) ? 
      (profile.mutual_friends ? Array(profile.mutual_friends).fill('').map(() => 'friend') : []) : [], // Convert count to array if allowed
    connectionPriority: 'regular' as const,
    lastSeen: shouldShowContent(profile, 'checkins', mode) ? new Date(profile.last_login_at || Date.now()) : new Date(),
    profileType: profile.profile_visibility === 'public' ? 'public' as const : 'private' as const,
    privacy_settings: profile.privacy_settings
  };
};

// Extended CheckIn interface for modal use


// Privacy helper function
const getPrivacyDisplay = (privacy?: Privacy) => {
  switch (privacy) {
    case 'public':
      return { icon: Globe, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Public' };
    case 'friends':
      return { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Friends' };
    case 'private':
      return { icon: Lock, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Private' };
    default:
      return { icon: Globe, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Public' };
  }
};

// Time formatting utility
const formatTimeAgo = (timestamp: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return timestamp.toLocaleDateString();
};

const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({ 
  userId, 
  onClose, 
  onBlock, 
  mode = 'other',
  isEmbedded = false,
  showMontageByDefault: _showMontageByDefault = false,
  isEditing: _isEditing = false,
  bioEditTrigger
}): JSX.Element => {
  const { user: currentUser } = useAuth();
  const checkInsEnabled = useFeatureFlag('enable_checkins');
  const [user, setUser] = useState<User | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isLookingUpConversation, setIsLookingUpConversation] = useState<boolean>(false);
  const [conversationLookupError, setConversationLookupError] = useState<string | undefined>(undefined);
  const [selectedMontageInterest, setSelectedMontageInterest] = useState<string | undefined>(undefined);
  
  // Check-ins state
  const [checkIns, setCheckIns] = useState<ExtendedCheckIn[]>([]);
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showCheckInDetailModal, setShowCheckInDetailModal] = useState<boolean>(false);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);
  const [checkInsLoading, setCheckInsLoading] = useState<boolean>(false);
  const [checkInsError, setCheckInsError] = useState<string | undefined>(undefined);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState<boolean>(false);
  const [editingCheckInId, setEditingCheckInId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [editingPrivacy, setEditingPrivacy] = useState<Privacy>('public');
  
  // Bio editing state
  const [isBioEditing, setIsBioEditing] = useState<boolean>(false);
  const [editingBio, setEditingBio] = useState<string>('');
  const [isBioSaving, setIsBioSaving] = useState<boolean>(false);
  const [bioError, setBioError] = useState<string | undefined>(undefined);
  
  // Broadcast state
  const [broadcast, setBroadcast] = useState<PublicBroadcastResponse | null>(null);
  const [, setBroadcastLoading] = useState<boolean>(false);
  const [, setBroadcastError] = useState<string | undefined>(undefined);
  
  // State to preserve scroll position during montage filter changes
  const [preserveScrollPosition, setPreserveScrollPosition] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Load check-ins from API when component mounts or userId changes
  useEffect(() => {
    // Create an abort controller for this request
    const abortController = new AbortController();
    let isCancelled = false;

    const loadCheckIns = async () => {
      if (!userId) {
        if (!isCancelled) {
          setCheckIns([]);
        }
        return;
      }
      
      // Load check-ins for all users - backend will filter based on privacy settings
      // For own profile: all check-ins
      // For other users: only public check-ins (filtered by backend)
      
      if (!isCancelled) {
        setCheckInsLoading(true);
        setCheckInsError(undefined);
      }
      
      try {
        const checkInsResponse = await getUserCheckIns(
          mode === 'own' ? undefined : userId, // Pass userId for other users' profiles
          {
            page: 1,
            page_size: 20,
            privacy: mode === 'own' ? undefined : 'public' // Backend enforces public-only for other users
          }
        );
        
        if (!isCancelled) {
          if (checkInsResponse && checkInsResponse.checkins && Array.isArray(checkInsResponse.checkins)) {
            const convertedCheckIns = checkInsResponse.checkins.map(convertBackendCheckInToExtended);
            setCheckIns(convertedCheckIns);
            setCheckInsError(undefined); // Clear any previous errors
          } else {
            setCheckInsError('Invalid response from server');
            setCheckIns([]);
          }
        }
      } catch (error: any) {
        if (!isCancelled) {
          const errorMessage = isCheckInError(error) 
            ? getCheckInErrorMessage(error as unknown as CheckInApiError) 
            : 'Failed to load check-ins. Please try again.';
          setCheckInsError(errorMessage);
          
          // Don't set check-ins on error - leave empty to show error state
          setCheckIns([]);
        }
      } finally {
        if (!isCancelled) {
          setCheckInsLoading(false);
        }
      }
    };

    loadCheckIns();

    // Cleanup function to cancel the request if component unmounts or dependencies change
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [userId, mode]);
  
  // Check-ins handlers
  const handleEditCheckin = (checkinId: string): void => {
    const currentCheckIn = checkIns.find(c => c.id === checkinId);
    if (!currentCheckIn) return;
    
    setEditingCheckInId(checkinId);
    setEditingText(currentCheckIn.text);
    setEditingPrivacy(currentCheckIn.privacy || 'public');
  };
  
  const handleSaveEdit = async (): Promise<void> => {
    if (!editingCheckInId || editingText.trim() === '') return;
    
    const originalCheckIn = checkIns.find(c => c.id === editingCheckInId);
    const originalText = originalCheckIn?.text || '';
    const originalPrivacy = originalCheckIn?.privacy || 'public';
    
    // Check if anything actually changed
    if (editingText.trim() === originalText && editingPrivacy === originalPrivacy) {
      handleCancelEdit();
      return;
    }
    
    try {
      const updateRequest = {
        text_content: editingText.trim(),
        privacy: editingPrivacy
      };
      
      const updatedCheckIn = await updateCheckIn(editingCheckInId, updateRequest);
      const updatedExtendedCheckIn = convertBackendCheckInToExtended(updatedCheckIn);
      
      // Update local state
      setCheckIns(prev => prev.map(c => 
        c.id === editingCheckInId ? updatedExtendedCheckIn : c
      ));
      
      handleCancelEdit();
    } catch (error: any) {
      setCheckInsError(
        isCheckInError(error) 
          ? getCheckInErrorMessage(error as unknown as CheckInApiError) 
          : 'Failed to update check-in. Please try again.'
      );
    }
  };
  
  const handleCancelEdit = (): void => {
    setEditingCheckInId(null);
    setEditingText('');
    setEditingPrivacy('public');
  };
  
  const handleShareCheckin = (_checkin: CheckIn): void => {
    // TODO: Implement share functionality (could copy link, open share modal, etc.)
  };
  
  const handleDeleteCheckin = async (checkinId: string): Promise<void> => {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this check-in?')) {
      return;
    }
    
    try {
      await deleteCheckIn(checkinId);
      
      // Remove from local state
      setCheckIns(prev => prev.filter(c => c.id !== checkinId));
    } catch (error: any) {
      setCheckInsError(
        isCheckInError(error) 
          ? getCheckInErrorMessage(error as unknown as CheckInApiError) 
          : 'Failed to delete check-in. Please try again.'
      );
    }
  };
  
  // Effect to handle external bio edit trigger
  useEffect(() => {
    if (bioEditTrigger && bioEditTrigger > 0 && user && mode === 'own') {
      setEditingBio(user.bio || '');
      setIsBioEditing(true);
      setBioError(undefined);
    }
  }, [bioEditTrigger, user, mode]);

  // Bio editing handlers
  
  const handleCancelBioEdit = (): void => {
    setIsBioEditing(false);
    setEditingBio('');
    setBioError(undefined);
  };
  
  const handleSaveBio = async (): Promise<void> => {
    if (!user || isBioSaving) return;
    
    const trimmedBio = editingBio.trim();
    
    // Check if bio actually changed
    if (trimmedBio === user.bio) {
      handleCancelBioEdit();
      return;
    }
    
    setIsBioSaving(true);
    setBioError(undefined);
    
    try {
      const updateData: UpdateProfileRequest = {
        bio: trimmedBio
      };
      
      const updatedProfile = await updateProfile(updateData);
      
      // Update local user state with new bio
      setUser(prev => prev ? {
        ...prev,
        bio: updatedProfile.bio || 'No bio available'
      } : prev);
      
      // Update profile response as well
      setProfileResponse(prev => prev ? {
        ...prev,
        bio: updatedProfile.bio
      } : prev);
      
      // Exit editing mode
      setIsBioEditing(false);
      setEditingBio('');
      
    } catch (error: any) {
      console.error('Failed to update bio:', error);
      setBioError(
        error?.error?.message || error?.message || 'Failed to update bio. Please try again.'
      );
    } finally {
      setIsBioSaving(false);
    }
  };

  // Handle new check-in submission
  const handleNewCheckInSubmit = async (checkInData: any): Promise<void> => {
    setIsSubmittingCheckIn(true);
    
    try {
      // Convert modal data to API format with user-selected privacy
      const createRequest = convertCheckInDataToRequest(checkInData, checkInData.privacy);
      
      // Create check-in via API
      const createdCheckIn = await createCheckIn(createRequest);
      
      // Convert back to frontend format
      const newExtendedCheckIn = convertBackendCheckInToExtended(createdCheckIn);
      
      // Add to front of check-ins array
      setCheckIns(prev => [newExtendedCheckIn, ...prev]);
      
      // Close modal
      setShowCheckInModal(false);
      
    } catch (error: any) {
      setCheckInsError(
        isCheckInError(error) 
          ? getCheckInErrorMessage(error as unknown as CheckInApiError) 
          : 'Failed to create check-in. Please try again.'
      );
      
      // Don't close modal on error - let user retry
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };
  
  // Use the friendship hook to get real friendship status
  const { getFriendshipStatus } = useFriendRequests();
  const friendshipStatus = getFriendshipStatus(userId).status;
  
  // Montage hook for fetching user's montage data
  const {
    items: montageItems,
    isLoading: isMontageLoading,
    error: montageError,
    hasMore: hasMontageMore,
    isLoadingMore: isMontageLoadingMore,
    loadMore: loadMoreMontage,
  } = useMontage(userId, selectedMontageInterest, {
    initialPageSize: 10,
    errorRetryCount: 2,
  });
  
  // Effect to restore scroll position after montage filter changes
  useEffect(() => {
    if (preserveScrollPosition > 0 && scrollContainerRef.current && !isMontageLoading) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = preserveScrollPosition;
          setPreserveScrollPosition(0); // Reset after restoring
        }
      }, 50); // Small delay to ensure content is rendered
      
      return () => clearTimeout(timer);
    }
    // Return undefined cleanup for cases where there's no scroll restoration needed
    return undefined;
  }, [preserveScrollPosition, isMontageLoading, montageItems]);


  // Fetch user profile data when modal mounts or userId changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      
      setLoading(true);
      setError(undefined);
      
      try {
        const profileResponse = await getUserProfile(userId);
        const mappedUser = mapUserProfileToUser(profileResponse, mode);
        setUser(mappedUser);
        setProfileResponse(profileResponse); // Store the full response
      } catch (err: any) {
        console.error('Failed to fetch user profile:', err);
        setError(getProfileErrorMessage(err.error || err, userId));
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);
  
  // Fetch user's broadcast when modal mounts or userId changes
  useEffect(() => {
    const fetchUserBroadcast = async () => {
      if (!userId) return;
      
      setBroadcastLoading(true);
      setBroadcastError(undefined);
      setBroadcast(null);
      
      try {
        const broadcastResponse = await getUserBroadcast(userId);
        setBroadcast(broadcastResponse);
      } catch (err: any) {
        // Only set error for non-404 errors (404 means no broadcast exists)
        if (isBroadcastError(err) && err.code !== 404) {
          console.error('Failed to fetch user broadcast:', err);
          setBroadcastError(getBroadcastErrorMessage(err));
        }
        // If 404, just leave broadcast as null (user has no broadcast)
      } finally {
        setBroadcastLoading(false);
      }
    };

    fetchUserBroadcast();
  }, [userId]);

  // Determine if users are friends based on friendship status
  const isFriend = friendshipStatus === 'friends';
  
  const handleFriendAction = (action: string, success: boolean) => {
    if (success) {
      console.log(`Friend action ${action} completed successfully`);
      // The friendship hook will automatically update the status
      // We can add any additional UI feedback here if needed
    }
  };

  
  // Track active conversation lookups to prevent race conditions
  const activeLookups = useRef<Set<string>>(new Set());
  
  // Handle message button click with conversation lookup
  const handleMessageButtonClick = async (): Promise<void> => {
    if (!user || activeLookups.current.has(user.id) || isLookingUpConversation) return;
    
    activeLookups.current.add(user.id);
    
    setIsLookingUpConversation(true);
    setConversationLookupError(undefined);
    
    try {
      // Get existing conversation or create new one
      const conversation = await getOrCreateDirectConversation(user.id);
      
      if (conversation) {
        // Convert conversation to Chat format with explicit parameters
        const chatFromConversation = conversationToDirectChat(
          conversation,
          currentUser?.id, // Current user ID to filter out from participants
          {
            isFriend: isFriend, // Real friendship status
            priority: 1 // Default priority
          }
        );
        setChatData(chatFromConversation);
      } else {
        // Fallback: create new conversation chat object if API failed
        setChatData(createChatFromUser(user));
      }
      
      // Open the conversation modal
      setIsChatOpen(true);
      
    } catch (error: any) {
      console.error('Failed to get or create conversation:', error);
      setConversationLookupError(
        error?.message || 'Unable to load conversation. Please try again.'
      );
      
      // Still allow opening modal with new conversation as fallback
      setChatData(createChatFromUser(user));
      setIsChatOpen(true);
      
    } finally {
      setIsLookingUpConversation(false);
      activeLookups.current.delete(user.id);
    }
  };

  // Handle montage item click - open existing check-in detail modal
  const handleMontageItemClick = (checkinId: string): void => {
    setSelectedCheckInId(checkinId);
    setShowCheckInDetailModal(true);
  };
  
  const handleCloseCheckInDetailModal = () => {
    setShowCheckInDetailModal(false);
    setSelectedCheckInId(null);
  };

  // Get top 5 interests for montage toggle pills
  const getTopInterests = (interests: string[]): string[] => {
    return interests.slice(0, 5);
  };


  const handleModalKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // State for managing conversation data
  const [chatData, setChatData] = useState<Chat | null>(null);
  
  // Helper function to create chat data from user
  const createChatFromUser = (user: User, existingConversation?: any): Chat => {
    return {
      id: existingConversation?.id || undefined, // Use real ID if available, undefined for new conversations
      participantId: user.id,
      participantName: (() => {
        // For public profiles, always show name
        if (user.profileType === 'public') {
          return getDisplayName(user);
        }
        
        // For private profiles, check if we have name data (respects privacy settings and friend status)
        if (user.first_name && user.first_name.trim() !== '') {
          return getDisplayName(user);
        }
        
        // Fallback to "Private Profile" when name is restricted
        return 'Private Profile';
      })(),
      participantAvatar: user.profilePicture || '',
      lastMessage: existingConversation?.lastMessage || {
        id: 'placeholder-msg',
        senderId: user.id,
        receiverId: 'current-user',
        content: "Hey there! 👋",
        timestamp: new Date(Date.now() - 300000),
        type: 'text'
      },
      unreadCount: existingConversation?.unreadCount || 0,
      conversationSummary: existingConversation?.conversationSummary || 'Recent conversation',
      priority: 1,
      messages: existingConversation?.messages || [],
      isFriend: isFriend // Use the real friendship status
    };
  };

  // We'll need the original profile response to get social links and photos
  const [profileResponse, setProfileResponse] = useState<UserProfileResponse | undefined>(undefined);
  
  // Map social links from backend with appropriate brand icons (only if allowed by privacy settings)
  const shouldShowSocialLinks = profileResponse ? shouldShowContent(profileResponse, 'social_media', mode) : false;
  
  const getSocialIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('instagram')) return FaInstagram;
    if (platformLower.includes('twitter') || platformLower.includes('x.com')) return FaTwitter;
    if (platformLower.includes('facebook')) return FaFacebook;
    if (platformLower.includes('linkedin')) return FaLinkedin;
    if (platformLower.includes('tiktok')) return FaTiktok;
    if (platformLower.includes('snapchat')) return FaSnapchat;
    if (platformLower.includes('youtube')) return FaYoutube;
    return MessageCircle; // fallback icon
  };

  const socialLinks = (shouldShowSocialLinks && profileResponse?.social_links) ? profileResponse.social_links.map(link => ({
    platform: link.platform,
    icon: getSocialIcon(link.platform),
    handle: link.username ? `@${link.username}` : link.url,
    url: link.url
  })) : [];

  // Loading skeleton component
  const ProfileSkeleton = () => (
    <div className="text-center mb-6">
      <div className="relative inline-block mb-4">
        <div className="w-30 h-30 rounded-full bg-surface-hover border-2 border-white/20 shadow-lg animate-pulse" />
      </div>
      <div className="h-8 bg-surface-hover rounded mb-2 animate-pulse" />
      <div className="h-4 bg-surface-hover rounded w-3/4 mx-auto mb-4 animate-pulse" />
      <div className="flex gap-3 justify-center">
        <div className="flex-1 max-w-36 h-12 bg-surface-hover rounded-ios animate-pulse" />
        <div className="flex-1 max-w-36 h-12 bg-surface-hover rounded-ios animate-pulse" />
      </div>
    </div>
  );

  // Error display component
  const ErrorDisplay = ({ errorMessage }: { errorMessage: string }) => (
    <div className="text-center py-8">
      <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
        <p className="text-red-400 font-medium">Unable to load profile</p>
        <p className="text-red-300 text-sm mt-1">{errorMessage}</p>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-aqua hover:bg-aqua-dark text-white rounded-lg transition-colors"
      >
        Retry
      </button>
    </div>
  );

  // Content component to avoid duplication
  const ProfileContent = () => (
    <>
      {/* Scrollable Content */}
      <div 
        ref={scrollContainerRef}
        className={isEmbedded ? "" : "max-h-[80vh] overflow-y-auto scrollbar-hide"}
      >
          {loading && <ProfileSkeleton />}
          
          {error && <ErrorDisplay errorMessage={error} />}
          
          {user && !loading && !error && (
            <>
              {/* Profile Title - Only show for other users */}
              {mode !== 'own' && (
                <div className="flex justify-between items-center px-4 pt-0 pb-1">
                  <h2 className="text-xl font-bold m-0 text-gradient-aqua">
                    Profile
                  </h2>
                </div>
              )}

              {/* Instagram-style Profile Header */}
              <div className="flex gap-4 items-center px-4 mb-1">
                {/* Profile Picture - Left Side */}
                <div className="relative flex-shrink-0">
                  {user.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={getDisplayName(user)}
                      className="w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-surface-hover border-2 border-white/20 shadow-lg flex items-center justify-center">
                      <div className="text-text-muted text-xl font-bold">
                        {getInitials(user)}
                      </div>
                    </div>
                  )}
                  {user.isAvailable && (
                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-aqua rounded-full border-2 border-surface-dark" />
                  )}
                </div>
                
                {/* Name, Age, Meta Info and Action Buttons - Right Side */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gradient-primary">
                      {user.first_name || user.last_name ? (
                        <>
                          {getDisplayName(user)}
                          {user.age && `, ${user.age}`}
                        </>
                      ) : (
                        'Private Profile'
                      )}
                    </h3>
                    {/* Privacy Badge */}
                    {user.profileType === 'private' && mode !== 'own' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                        <Shield size={12} />
                        Private
                      </span>
                    )}
                  </div>
                  
                  {/* Distance, Mutual Friends & Social Links */}
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    {/* Distance - only show if location is allowed */}
                    {user.location.proximityMiles > 0 && (
                      <div className="flex items-center gap-1">
                        <MapPin size={14} className="text-text-secondary" />
                        <span className="text-text-secondary text-xs">
                          {user.location.proximityMiles} mi
                        </span>
                      </div>
                    )}
                    
                    {/* Mutual Friends */}
                    {user.mutualFriends.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users size={14} className="text-aqua" />
                        <span className="text-aqua text-xs font-medium">
                          {user.mutualFriends.length} mutuals
                        </span>
                      </div>
                    )}
                    
                    {/* Social Media Links - same row */}
                    {shouldShowSocialLinks && socialLinks.length > 0 && (
                      <div className="flex gap-1">
                        {socialLinks.map((social, index) => {
                          const IconComponent = social.icon;
                          const getSocialIconColor = (platform: string) => {
                            const platformLower = platform.toLowerCase();
                            if (platformLower.includes('instagram')) return 'text-pink-500 hover:text-pink-600';
                            if (platformLower.includes('twitter') || platformLower.includes('x.com')) return 'text-blue-400 hover:text-blue-500';
                            if (platformLower.includes('facebook')) return 'text-blue-600 hover:text-blue-700';
                            if (platformLower.includes('linkedin')) return 'text-blue-700 hover:text-blue-800';
                            if (platformLower.includes('tiktok')) return 'text-black hover:text-gray-800';
                            if (platformLower.includes('snapchat')) return 'text-yellow-400 hover:text-yellow-500';
                            if (platformLower.includes('youtube')) return 'text-red-600 hover:text-red-700';
                            return 'text-aqua hover:text-aqua-dark';
                          };
                          
                          return (
                            <a
                              key={index}
                              href={social.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover-glow group"
                              title={social.handle}
                            >
                              <IconComponent 
                                size={12} 
                                className={`${getSocialIconColor(social.platform)} transition-colors`}
                              />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bio - moved here between meta info and action buttons */}
                  <div className="mb-1">
                    {mode === 'own' && isBioEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingBio}
                          onChange={(e) => setEditingBio(e.target.value)}
                          className="w-full text-text-secondary text-sm leading-relaxed border border-gray-300 rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-aqua focus:border-aqua"
                          rows={3}
                          maxLength={500}
                          placeholder="Tell others about yourself..."
                          disabled={isBioSaving}
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <button
                              onClick={handleCancelBioEdit}
                              disabled={isBioSaving}
                              className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveBio}
                              disabled={isBioSaving || editingBio.trim() === ''}
                              className="px-3 py-1 text-xs bg-aqua hover:bg-aqua-dark text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {isBioSaving ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent" />
                                  Saving...
                                </>
                              ) : (
                                'Save'
                              )}
                            </button>
                          </div>
                          <span className="text-xs text-gray-500">
                            {editingBio.length}/500
                          </span>
                        </div>
                        {bioError && (
                          <p className="text-red-500 text-xs">{bioError}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-text-secondary text-sm leading-relaxed">
                        {user.bio}
                      </p>
                    )}
                  </div>
                  
                  {/* Action Buttons - Now inline with profile */}
                  <div className="flex gap-1.5">
                    {mode !== 'own' && (
                      <>
                        <button
                          onClick={handleMessageButtonClick}
                          disabled={isLookingUpConversation}
                          className={`bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-1.5 px-3 rounded-md transition-colors duration-200 flex items-center justify-center gap-1 text-xs min-w-0 ${isLookingUpConversation ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isLookingUpConversation ? (
                            <div className="animate-spin rounded-full h-3 w-3 border border-gray-600 border-t-transparent" />
                          ) : (
                            <MessageCircle size={12} />
                          )}
                          {isLookingUpConversation ? 'Loading...' : 'Message'}
                        </button>
                        <FriendButton
                          userId={user.id}
                          size="medium"
                          variant="default"
                          className="bg-gray-200 hover:bg-gray-300 !text-gray-800 font-medium py-1.5 px-3 rounded-md transition-colors duration-200 [&>*]:!text-gray-800 [&_svg]:!text-gray-800 text-xs min-w-0 whitespace-nowrap"
                        />
                        <BlockButton
                          userId={user.id}
                          size="small"
                          variant="default"
                          className="bg-red-500 hover:bg-red-600 text-white py-1.5 px-2 rounded-md transition-colors duration-200 text-xs min-w-0"
                          onBlock={onBlock}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Broadcast Section - Show when user has a broadcast */}
              {broadcast && (
                <div className="px-4 mb-4">
                  {/* Broadcast divider */}
                  <div className="mb-3 border-t border-gray-300/30 w-16 mx-auto"></div>
                  
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-text-primary">Broadcast</h3>
                      <Megaphone size={14} className="text-aqua" />
                    </div>
                  </div>

                  {/* Broadcast Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface-card rounded-card p-4 border border-surface-border shadow-card relative overflow-hidden"
                  >
                    {/* Subtle background accent */}
                    <div className="absolute inset-0 opacity-[0.02]">
                      <div className="absolute top-2 right-2 w-12 h-12 bg-aqua rounded-full"></div>
                      <div className="absolute bottom-4 left-4 w-8 h-8 bg-aqua rounded-full"></div>
                    </div>
                    
                    <div className="relative z-10">
                      {/* Broadcast message */}
                      <p className="text-sm text-text-primary leading-relaxed font-medium">
                        {broadcast.message}
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Check-ins Section (read-only for others, editable for own) */}
              {checkInsEnabled && (mode === 'own' || (profileResponse && shouldShowContent(profileResponse, 'checkins', mode))) && (
              <div className="px-4 mb-4">
                  {/* Check-ins divider */}
                  <div className="mb-3 border-t border-gray-300/30 w-16 mx-auto"></div>
                  
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-text-primary">Check-Ins</h3>
                      <button
                        onClick={() => setShowHelpModal(true)}
                        className="w-5 h-5 rounded-full bg-transparent text-aqua hover:bg-aqua/10 transition-all duration-200 flex items-center justify-center"
                        title="What happens when you check-in?"
                      >
                        <HelpCircle size={14} />
                      </button>
                    </div>
                    {mode === 'own' && checkIns.length > 0 && (
                      <button
                        onClick={() => setShowCheckInModal(true)}
                        className="flex items-center justify-center w-8 h-8 bg-aqua hover:bg-aqua-dark text-white rounded-full transition-all duration-200 hover:scale-105"
                        title="Add new check-in"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>

                  {/* Check-ins Loading State */}
                  {checkInsLoading ? (
                    <div className="text-center py-6">
                      <div className="animate-spin rounded-full h-8 w-8 border border-aqua border-t-transparent mx-auto mb-2" />
                      <p className="text-text-secondary text-sm">Loading check-ins...</p>
                    </div>
                  ) : checkInsError && checkIns.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-red-500 text-sm mb-2">Failed to load check-ins</p>
                      <p className="text-text-secondary text-xs mb-3">{checkInsError}</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-medium transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : checkIns.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-text-secondary text-sm mb-2">
                        {mode === 'own' 
                          ? 'No check-ins yet' 
                          : profileResponse && shouldShowContent(profileResponse, 'checkins', mode)
                            ? 'No public check-ins yet'
                            : 'Check-ins are private'
                        }
                      </p>
                      {mode === 'own' && (
                        <button
                          onClick={() => setShowCheckInModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-aqua hover:bg-aqua-dark text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                        >
                          <Plus size={16} />
                          Share your first thought
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Horizontal scrollable container */}
                      <div 
                        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none'
                        }}
                      >
                        {checkIns.map((checkin, index) => (
                          <motion.div
                            key={checkin.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`${
                              checkin.source === 'instagram'
                                ? 'rounded-lg overflow-hidden'
                                : 'bg-white/50 rounded-lg p-3 border border-white/20'
                            } flex-shrink-0`}
                            style={{
                              minWidth: '250px',
                              maxWidth: '280px',
                              maxHeight: '480px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                              ...(checkin.source === 'instagram' && {
                                background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
                                padding: '2px'
                              })
                            }}
                          >
                            {checkin.source === 'instagram' && checkin.instagramData ? (
                              /* Instagram Post Layout */
                              <div className="flex flex-col h-full bg-white rounded-lg">
                                {/* Instagram Header */}
                                <div className="flex items-center justify-between p-3 pb-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white shadow-sm">
                                      <img
                                        src={checkin.instagramData.profilePicture}
                                        alt="Instagram User"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold text-gray-900 text-xs">{checkin.instagramData.username}</span>
                                      <FaInstagram size={10} className="text-pink-500" />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">{formatTimeAgo(checkin.timestamp)}</span>
                                  </div>
                                </div>
                                
                                {/* Instagram Image */}
                                <div className="relative mb-3">
                                  <img
                                    src={checkin.instagramData.imageUrl}
                                    alt="Instagram Post"
                                    className="w-full h-48 object-cover"
                                  />
                                  <div className="absolute top-2 left-2">
                                    <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                      <div className="w-1 h-1 bg-aqua rounded-full animate-pulse"></div>
                                      <span>Reposted</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Instagram Content */}
                                <div className="px-3 pb-2">
                                  {/* Likes */}
                                  <div className="mb-2">
                                    <span className="font-semibold text-xs text-gray-900">{checkin.instagramData.likes} likes</span>
                                  </div>
                                  
                                  {/* Caption */}
                                  <div className="text-xs text-gray-700 leading-relaxed mb-2">
                                    <span className="font-semibold text-gray-900">{checkin.instagramData.username}</span>{' '}
                                    <span>{checkin.instagramData.caption}</span>
                                    {checkin.instagramData.hashtags.length > 0 && (
                                      <div className="text-gray-500 text-xs mt-1">
                                        {checkin.instagramData.hashtags.join(' ')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* User-Generated Tags */}
                                <div className="px-3 pb-3 border-t border-gray-200/30">
                                  <div className="flex items-center justify-between mb-1 pt-2">
                                    <span className="text-xs font-medium text-gray-600">Your Tags</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 items-center">
                                    {checkin.tags.map((tag) => (
                                      <span
                                        key={tag.id}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-aqua text-white"
                                      >
                                        #{tag.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Regular Check-in Layout */
                              <>
                                {/* Check-in Header */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Clock size={11} className="text-gray-500" />
                                    <span className="text-xs text-gray-500">{formatTimeAgo(checkin.timestamp)}</span>
                                    {/* Privacy Badge */}
                                    {(() => {
                                      const privacyDisplay = getPrivacyDisplay(checkin.privacy);
                                      const PrivacyIcon = privacyDisplay.icon;
                                      return (
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${privacyDisplay.bgColor} ${privacyDisplay.color}`}>
                                          <PrivacyIcon size={10} />
                                          {privacyDisplay.label}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  
                                  {mode === 'own' && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleEditCheckin(checkin.id)}
                                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                                        title="Edit"
                                      >
                                        <Edit3 size={11} className="text-gray-500" />
                                      </button>
                                      <button
                                        onClick={() => handleShareCheckin(checkin)}
                                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                                        title="Share"
                                      >
                                        <Share size={11} className="text-gray-500" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCheckin(checkin.id)}
                                        className="p-1 hover:bg-red-500/20 rounded-full transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 size={11} className="text-red-500" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Check-in Content */}
                                {editingCheckInId === checkin.id ? (
                                  <div className="mb-2">
                                    <textarea
                                      value={editingText}
                                      onChange={(e) => setEditingText(e.target.value)}
                                      className="w-full text-sm text-gray-700 leading-relaxed border border-gray-300 rounded px-2 py-1 resize-none"
                                      rows={2}
                                      maxLength={280}
                                      autoFocus
                                    />
                                    {/* Privacy selector for editing */}
                                    <div className="flex gap-1 mt-2 mb-1">
                                      <button
                                        onClick={() => setEditingPrivacy('public')}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                                          editingPrivacy === 'public'
                                            ? 'bg-green-100 text-green-700 border border-green-300'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        <Globe size={10} />
                                        Public
                                      </button>
                                      <button
                                        onClick={() => setEditingPrivacy('friends')}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                                          editingPrivacy === 'friends'
                                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        <Users size={10} />
                                        Friends
                                      </button>
                                      <button
                                        onClick={() => setEditingPrivacy('private')}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                                          editingPrivacy === 'private'
                                            ? 'bg-gray-100 text-gray-700 border border-gray-400'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        <Lock size={10} />
                                        Private
                                      </button>
                                    </div>
                                    <div className="flex justify-end gap-1 mt-1">
                                      <button
                                        onClick={handleCancelEdit}
                                        className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={handleSaveEdit}
                                        className="px-2 py-1 text-xs bg-aqua hover:bg-aqua-dark text-white rounded transition-colors"
                                        disabled={editingText.trim() === ''}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-700 mb-2 leading-relaxed">
                                    {checkin.text}
                                  </p>
                                )}
                                
                                {/* Location */}
                                {checkin.locationAttachment && (
                                  <div className="flex items-center gap-1 mb-2">
                                    <MapPin size={11} className="text-aqua" />
                                    <span className="text-xs text-aqua truncate">{checkin.locationAttachment.name}</span>
                                  </div>
                                )}
                                
                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 items-center">
                                  {checkin.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag.id}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-aqua text-white"
                                    >
                                      #{tag.label}
                                    </span>
                                  ))}
                                  {checkin.tags.length > 3 && (
                                    <span className="text-xs text-gray-500 px-1">
                                      +{checkin.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </motion.div>
                        ))}
                      </div>
                      
                      {/* Scroll Indicator */}
                      {checkIns.length > 1 && (
                        <div className="flex justify-center mt-2">
                          <div className="flex gap-1">
                            {checkIns.slice(0, Math.min(checkIns.length, 5)).map((_, index) => (
                              <div
                                key={index}
                                className="w-1.5 h-1.5 rounded-full bg-gray-300"
                                style={{ opacity: index === 0 ? 1 : 0.3 }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Montage Section - Show for both own and other modes */}
              <div className="px-4 mb-4">
                {/* Montage divider */}
                <div className="mb-3 border-t border-gray-300/30 w-16 mx-auto"></div>
                
                {/* Montage section header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-text-primary">
                      {mode === 'own' ? 'Your Montage' : `${getDisplayName(user)}'s Montage`}
                    </h3>
                  </div>
                  {mode === 'own' && !isEmbedded && (
                    <div className="flex items-center gap-2">
                      {/* Refresh button for own profile */}
                      <button
                        onClick={() => window.location.reload()} // TODO: Replace with proper refresh action
                        className="p-1.5 hover:bg-surface-hover rounded-full transition-colors"
                        title="Refresh montage"
                      >
                        <svg 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          className="text-text-secondary hover:text-text-primary transition-colors"
                        >
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Montage toggle pills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={() => {
                      // Preserve scroll position before filter change
                      if (scrollContainerRef.current) {
                        setPreserveScrollPosition(scrollContainerRef.current.scrollTop);
                      }
                      setSelectedMontageInterest(undefined);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      selectedMontageInterest === undefined
                        ? 'bg-aqua text-white shadow-sm'
                        : 'bg-surface-hover text-text-secondary hover:bg-aqua/10 hover:text-aqua'
                    }`}
                  >
                    All
                  </button>
                  {user.interests && getTopInterests(user.interests).map((interest, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        // Preserve scroll position before filter change
                        if (scrollContainerRef.current) {
                          setPreserveScrollPosition(scrollContainerRef.current.scrollTop);
                        }
                        setSelectedMontageInterest(interest);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                        selectedMontageInterest === interest
                          ? 'bg-aqua text-white shadow-sm'
                          : 'bg-surface-hover text-text-secondary hover:bg-aqua/10 hover:text-aqua'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>

                {/* Montage carousel */}
                <MontageCarousel
                  items={montageItems}
                  onItemClick={handleMontageItemClick}
                  isLoading={isMontageLoading}
                  hasError={!!montageError}
                  errorMessage={montageError || undefined}
                  onLoadMore={hasMontageMore ? loadMoreMontage : undefined}
                  hasMore={hasMontageMore}
                  isLoadingMore={isMontageLoadingMore}
                  className="min-h-[180px]"
                  mode={mode}
                  userName={getDisplayName(user)}
                />
              </div>

            </>
          )}
      </div>

      {/* ConversationModal */}
      {chatData && (
        <ConversationModal
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setConversationLookupError(undefined);
          }}
          chat={chatData}
          onAddFriend={() => handleFriendAction('send', true)}
          isFriend={isFriend}
        />
      )}
      
      {/* Conversation Lookup Error */}
      {conversationLookupError && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-500 text-white p-3 rounded-lg shadow-lg z-50">
          <p className="text-sm font-medium">Failed to load conversation</p>
          <p className="text-xs opacity-90">{conversationLookupError}</p>
        </div>
      )}
      
      {/* Check-In Modal */}
      {mode === 'own' && (
        <CheckInModal
          isOpen={showCheckInModal}
          onClose={() => setShowCheckInModal(false)}
          onSubmit={handleNewCheckInSubmit}
          isSubmitting={isSubmittingCheckIn}
        />
      )}
      
      {/* Check-In Detail Modal */}
      <CheckInDetailModal
        isOpen={showCheckInDetailModal}
        onClose={handleCloseCheckInDetailModal}
        checkInId={selectedCheckInId}
      />
      
      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">What happens when you check-in?</h3>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
              
              {/* Content */}
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-aqua/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-aqua">1</span>
                  </div>
                  <p><strong className="text-gray-900">Friends get summaries:</strong> When you chat with friends, they'll see a summary of your recent check-ins to stay connected with what's happening in your life.</p>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-aqua/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-aqua">2</span>
                  </div>
                  <p><strong className="text-gray-900">Bio updates:</strong> Friends can see your check-in details in your profile bio, giving them insight into your current interests and activities.</p>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-aqua/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-aqua">3</span>
                  </div>
                  <p><strong className="text-gray-900">Interest montage:</strong> The tags from your check-ins automatically update your profile's interest montage, showing friends what you're genuinely passionate about.</p>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-aqua/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-aqua">4</span>
                  </div>
                  <p><strong className="text-gray-900">Smart opportunities:</strong> Your check-ins help us suggest relevant social opportunities, events, and connections based on your interests and activities.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );

  // Return content with or without modal wrapper based on embedded flag
  if (isEmbedded) {
    return (
      <div 
        className="ios-card" 
        style={{
          position: 'relative',
          margin: '0 auto',
          marginBottom: '32px',
          maxWidth: '400px',
          padding: '0',
          background: 'white',
          border: 'none',
          boxShadow: 'none'
        }}
      >
        <ProfileContent />
      </div>
    );
  }

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      onKeyDown={handleModalKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Fixed Header - Only Close Button */}
        <div className="flex justify-end items-center px-3 pt-2 pb-1">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors duration-200 flex items-center justify-center"
          >
            <X size={16} className="text-black" />
          </button>
        </div>

        <ProfileContent />
      </div>
    </div>
  );
};

export default ProfileDetailModal;
