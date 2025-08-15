import React, { useState, useRef } from 'react';
import { 
  Edit, Settings, /* Send, */ Camera, MapPin, Hash, Mic, Paperclip, X, Plus, Clock, Edit3, Trash2, Share, /* Loader2, */ Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FaInstagram, FaTwitter, FaLinkedin } from 'react-icons/fa';
import { currentUser } from '../data/mockData';
import ProfileDetailModal from '../components/ProfileDetailModal';
import { motion, AnimatePresence } from 'framer-motion';

// Import types for the share thoughts functionality
interface MediaAttachment {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
}

interface FileAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
}

interface VoiceNote {
  id: string;
  duration: number;
  url: string;
}

interface LocationAttachment {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
}

interface Tag {
  id: string;
  label: string;
  type: 'manual' | 'ai';
  color: string;
}

interface CheckIn {
  id: string;
  text: string;
  mediaAttachments: MediaAttachment[];
  fileAttachments: FileAttachment[];
  voiceNote: VoiceNote | null;
  locationAttachment: LocationAttachment | null;
  tags: Tag[];
  aiSuggestions?: Tag[];
  aiSuggestionsPending?: boolean;
  timestamp: Date;
  source?: 'manual' | 'instagram' | 'twitter' | 'other';
  instagramData?: {
    username: string;
    profilePicture: string;
    likes: number;
    imageUrl: string;
    caption: string;
    hashtags: string[];
  };
}

const COMMON_TAGS = [
  'coffee', 'workout', 'music', 'food', 'travel', 'work', 'friends', 
  'family', 'nature', 'art', 'reading', 'coding', 'gaming', 'sports'
];

// Mock check-ins data
const generateMockCheckIns = (): CheckIn[] => [
  {
    id: 'checkin-instagram-1',
    text: 'Beautiful sunset at the beach today! 🌅 Nothing beats those golden hour vibes',
    mediaAttachments: [],
    fileAttachments: [],
    voiceNote: null,
    locationAttachment: null,
    tags: [
      { id: 'tag-ig-1', label: 'sunset', type: 'manual', color: '#F59E0B' },
      { id: 'tag-ig-2', label: 'beach', type: 'manual', color: '#3B82F6' }
    ],
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    source: 'instagram',
    instagramData: {
      username: 'alexthompson',
      profilePicture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
      likes: 247,
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
      caption: 'Beautiful sunset at the beach today! 🌅 Nothing beats those golden hour vibes',
      hashtags: ['#sunset', '#beach', '#goldenhour']
    }
  },
  {
    id: 'checkin-1',
    text: 'Just finished an amazing workout session at the gym! Feeling energized and ready to tackle the rest of the day.',
    mediaAttachments: [],
    fileAttachments: [],
    voiceNote: null,
    locationAttachment: { id: 'loc-1', name: 'FitnessFirst Gym', coordinates: { lat: 37.7749, lng: -122.4194 } },
    tags: [
      { id: 'tag-1', label: 'workout', type: 'manual', color: '#10B981' },
      { id: 'tag-2', label: 'fitness', type: 'ai', color: '#3B82F6' }
    ],
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    source: 'manual'
  },
  {
    id: 'checkin-2',
    text: 'Exploring the new coffee shop downtown. The vibes here are incredible!',
    mediaAttachments: [],
    fileAttachments: [],
    voiceNote: null,
    locationAttachment: { id: 'loc-2', name: 'Blue Bottle Coffee', coordinates: { lat: 37.7849, lng: -122.4094 } },
    tags: [
      { id: 'tag-3', label: 'coffee', type: 'manual', color: '#F59E0B' },
      { id: 'tag-4', label: 'exploration', type: 'ai', color: '#8B5CF6' }
    ],
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000) // 8 hours ago
  },
  {
    id: 'checkin-3',
    text: 'Weekend coding session with some lo-fi beats. Building something cool!',
    mediaAttachments: [],
    fileAttachments: [],
    voiceNote: null,
    locationAttachment: null,
    tags: [
      { id: 'tag-5', label: 'coding', type: 'manual', color: '#06B6D4' },
      { id: 'tag-6', label: 'weekend', type: 'ai', color: '#EC4899' }
    ],
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
  }
];

const ProfilePage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  
  // Check-ins state
  const [checkIns, setCheckIns] = useState<CheckIn[]>(generateMockCheckIns());
  const [showNewCheckinModal, setShowNewCheckinModal] = useState<boolean>(false);
  const [editingCheckinId, setEditingCheckinId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  // New check-in form state (for modal)
  const [searchText, setSearchText] = useState<string>('');
  // const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(null);
  const [locationAttachment, setLocationAttachment] = useState<LocationAttachment | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  
  // Tag input state
  const [manualTags, setManualTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [showTagSuggestions, setShowTagSuggestions] = useState<boolean>(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleSettingsClick = (): void => {
    navigate('/settings');
  };

  const handleEditProfile = (): void => {
    setShowProfileModal(true);
  };

  const handleCloseProfileModal = (): void => {
    setShowProfileModal(false);
  };

  // Handle broken images
  const handleImageError = (photoUrl: string) => {
    setBrokenImages(prev => new Set([...prev, photoUrl]));
  };

  // Share thoughts handlers (copied from CheckinPage)
  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const id = `media_${Date.now()}_${index}`;
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      
      setMediaAttachments(prev => [...prev, {
        id,
        type,
        url,
        name: file.name
      }]);
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const id = `file_${Date.now()}_${index}`;
      const size = (file.size / 1024).toFixed(1) + ' KB';
      
      setFileAttachments(prev => [...prev, {
        id,
        name: file.name,
        size,
        type: file.type
      }]);
    });
  };

  const handleAddLocation = () => {
    // Simulate location detection
    setLocationAttachment({
      id: 'location_' + Date.now(),
      name: 'Current Location',
      coordinates: { lat: 37.7749, lng: -122.4194 }
    });
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    
    // Simulate recording
    const interval = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= 60) {
          handleStopRecording();
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setVoiceNote({
      id: 'voice_' + Date.now(),
      duration: recordingDuration,
      url: '#'
    });
  };

  const handleRemoveMedia = (id: string) => {
    setMediaAttachments(prev => prev.filter(item => item.id !== id));
  };

  const handleRemoveFile = (id: string) => {
    setFileAttachments(prev => prev.filter(item => item.id !== id));
  };

  const handleRemoveVoiceNote = () => {
    setVoiceNote(null);
  };

  const handleRemoveLocation = () => {
    setLocationAttachment(null);
  };

  // Tag management functions
  const handleAddTag = (tagLabel: string) => {
    const newTag: Tag = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      label: tagLabel.toLowerCase(),
      type: 'manual',
      color: getTagColor(tagLabel)
    };
    setManualTags(prev => [...prev, newTag]);
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const handleRemoveManualTag = (tagId: string) => {
    setManualTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  const getTagColor = (_label: string): string => {
    // Use consistent aqua brand colors from design system
    return '#14b8a6'; // Primary aqua color from design system
  };

  const getFilteredTagSuggestions = () => {
    if (!tagInput.trim()) return [];
    return COMMON_TAGS.filter(tag => 
      tag.toLowerCase().includes(tagInput.toLowerCase()) &&
      !manualTags.some(existingTag => existingTag.label === tag)
    ).slice(0, 5);
  };

  const handlePost = async () => {
    if (!(searchText.trim() || hasAttachments)) return;
    
    // Create new check-in
    const newCheckin: CheckIn = {
      id: `checkin-${Date.now()}`,
      text: searchText,
      mediaAttachments: [...mediaAttachments],
      fileAttachments: [...fileAttachments],
      voiceNote: voiceNote ? { ...voiceNote } : null,
      locationAttachment: locationAttachment ? { ...locationAttachment } : null,
      tags: [...manualTags],
      timestamp: new Date()
    };
    
    // Add to front of check-ins array
    setCheckIns(prev => [newCheckin, ...prev]);
    
    // Reset form and close modal
    setSearchText('');
    setMediaAttachments([]);
    setFileAttachments([]);
    setVoiceNote(null);
    setLocationAttachment(null);
    setManualTags([]);
    // setIsSearchFocused(false);
    setShowNewCheckinModal(false);
  };

  const hasAttachments = mediaAttachments.length > 0 || fileAttachments.length > 0 || voiceNote || locationAttachment;

  // Tag editing state
  const [editingTagsCheckinId, setEditingTagsCheckinId] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState<Tag[]>([]);
  const [editTagInput, setEditTagInput] = useState<string>('');
  const [showEditTagSuggestions, setShowEditTagSuggestions] = useState<boolean>(false);
  const [showTagInput, setShowTagInput] = useState<Record<string, boolean>>({});

  // Check-in management
  const handleEditCheckin = (checkinId: string) => {
    const checkin = checkIns.find(c => c.id === checkinId);
    if (checkin) {
      setEditingCheckinId(checkinId);
      setEditText(checkin.text);
    }
  };

  // Tag editing functions
  const handleEditTags = (checkinId: string) => {
    const checkin = checkIns.find(c => c.id === checkinId);
    if (checkin) {
      setEditingTagsCheckinId(checkinId);
      setEditingTags([...checkin.tags]);
    }
  };

  const handleAddEditTag = (tagLabel: string) => {
    const newTag: Tag = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      label: tagLabel.toLowerCase(),
      type: 'manual',
      color: getTagColor(tagLabel)
    };
    setEditingTags(prev => [...prev, newTag]);
    setEditTagInput('');
    setShowEditTagSuggestions(false);
  };

  const handleRemoveEditTag = (tagId: string) => {
    setEditingTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  const handleSaveTagsEdit = (checkinId: string) => {
    setCheckIns(prev => prev.map(checkin => 
      checkin.id === checkinId 
        ? { ...checkin, tags: [...editingTags] }
        : checkin
    ));
    setEditingTagsCheckinId(null);
    setEditingTags([]);
    setEditTagInput('');
  };

  const getFilteredEditTagSuggestions = () => {
    if (!editTagInput.trim()) return [];
    return COMMON_TAGS.filter(tag => 
      tag.toLowerCase().includes(editTagInput.toLowerCase()) &&
      !editingTags.some(existingTag => existingTag.label === tag)
    ).slice(0, 5);
  };

  const handleSaveEdit = (checkinId: string) => {
    setCheckIns(prev => prev.map(checkin => 
      checkin.id === checkinId 
        ? { ...checkin, text: editText }
        : checkin
    ));
    setEditingCheckinId(null);
    setEditText('');
  };

  const handleDeleteCheckin = (checkinId: string) => {
    if (confirm('Are you sure you want to delete this check-in?')) {
      setCheckIns(prev => prev.filter(checkin => checkin.id !== checkinId));
    }
  };

  const handleShareCheckin = (checkin: CheckIn) => {
    if (navigator.share) {
      navigator.share({
        title: 'Check-in',
        text: checkin.text,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(checkin.text);
      alert('Check-in text copied to clipboard!');
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Mock additional photos for demonstration (since currentUser might not have them)
  const additionalPhotos = [
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1494790108755-2616c6c5a72b?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=400&h=400&fit=crop&crop=face'
  ].filter(photo => photo && !brokenImages.has(photo));

  return (
    <div className="ios-safe-area" style={{ padding: '0 20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px',
        paddingTop: '20px'
      }}>
        <h1 className="text-gradient-aqua" style={{ fontSize: '28px', fontWeight: '700' }}>
          Profile
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleEditProfile}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#06b6d4'
            }}
            className="haptic-light hover:bg-black/5 transition-colors"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={handleSettingsClick}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#06b6d4'
            }}
            className="haptic-light hover:bg-black/5 transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Profile Detail - Using ProfileDetailModal style */}
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
        {/* Scrollable Content */}
        <div>

          {/* Instagram-style Profile Header */}
          <div className="flex gap-4 items-center px-4 mb-1 pt-4">
            {/* Profile Picture - Left Side */}
            <div className="relative flex-shrink-0">
              <img
                src={currentUser.profilePicture}
                alt={currentUser.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-lg"
              />
              {currentUser.isAvailable && (
                <div className="absolute bottom-1 right-1 w-4 h-4 bg-aqua rounded-full border-2 border-surface-dark" />
              )}
            </div>
            
            {/* Name, Age, Meta Info - Right Side */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold mb-1 text-gradient-primary">
                {currentUser.name}, {currentUser.age}
              </h3>
              
              {/* Distance, Social Links */}
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-text-secondary text-xs">
                    📍 San Francisco, CA
                  </span>
                </div>
                
                {/* Social Media Links */}
                <div className="flex gap-1">
                  <a
                    href="https://instagram.com/alexthompson"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover-glow group"
                    title="@alexthompson"
                  >
                    <FaInstagram 
                      size={12} 
                      className="text-pink-500 hover:text-pink-600 transition-colors"
                    />
                  </a>
                  <a
                    href="https://twitter.com/alexthompson"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover-glow group"
                    title="@alexthompson"
                  >
                    <FaTwitter 
                      size={12} 
                      className="text-blue-400 hover:text-blue-500 transition-colors"
                    />
                  </a>
                  <a
                    href="https://linkedin.com/in/alexthompson"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover-glow group"
                    title="Alex Thompson"
                  >
                    <FaLinkedin 
                      size={12} 
                      className="text-blue-700 hover:text-blue-800 transition-colors"
                    />
                  </a>
                </div>
              </div>

              {/* Bio */}
              <div className="mb-1">
                <p className="text-text-secondary text-sm leading-relaxed">
                  {currentUser.bio}
                </p>
              </div>
            </div>
          </div>

          {/* Check-In & Check-ins */}
          <div className="px-4 mb-4 mt-4">
            <div className="mb-2 border-t border-gray-300/30 w-16 mx-auto"></div>
            
            {/* Section Header with Add Button */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text-primary">Check-In</h3>
              <button
                onClick={() => setShowNewCheckinModal(true)}
                className="flex items-center justify-center w-8 h-8 bg-aqua hover:bg-aqua-dark text-white rounded-full transition-all duration-200 hover:scale-105"
                title="Add new check-in"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Check-ins Horizontal Carousel */}
            <div style={{ padding: '12px', margin: '0', background: 'transparent' }}>
              {checkIns.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-text-secondary text-sm mb-2">No check-ins yet</p>
                  <button
                    onClick={() => setShowNewCheckinModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-aqua hover:bg-aqua-dark text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                  >
                    <Plus size={16} />
                    Share your first thought
                  </button>
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
                        className={`${checkin.source === 'instagram' 
                          ? 'bg-white rounded-lg overflow-hidden'
                          : 'bg-white/50 rounded-lg p-3'
                        } border ${checkin.source === 'instagram' 
                          ? 'border-white/20'
                          : 'border-white/20'
                        } flex-shrink-0 ios-card`}
                        style={{
                          minWidth: '250px', 
                          maxWidth: '280px',
                          maxHeight: '480px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}
                      >
                        {checkin.source === 'instagram' && checkin.instagramData ? (
                          /* Instagram Post Layout - Wrapped Container */
                          <div className="flex flex-col h-full">
                            {/* Instagram Card with Pink Border - Now includes Tags */}
                            <div 
                              className="bg-white rounded-lg overflow-hidden border-2 border-transparent flex-1"
                              style={{
                                backgroundImage: 'linear-gradient(white, white), linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                                backgroundOrigin: 'border-box',
                                backgroundClip: 'content-box, border-box'
                              }}
                            >
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

                              {/* User-Generated Tags Inside Pink Border */}
                              <div className="px-3 pb-3 border-t border-gray-200/30">
                                <div className="flex items-center justify-between mb-1 pt-2">
                                  <span className="text-xs font-medium text-gray-600">Your Tags</span>
                                </div>
                              
                              {editingTagsCheckinId === checkin.id ? (
                                /* Tag Editing Mode */
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1 items-center">
                                    {editingTags.map((tag) => (
                                      <motion.span
                                        key={tag.id}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-aqua text-white"
                                      >
                                        #{tag.label}
                                        <button
                                          onClick={() => handleRemoveEditTag(tag.id)}
                                          className="hover:bg-white/20 rounded-full w-3 h-3 flex items-center justify-center"
                                        >
                                          <X size={8} />
                                        </button>
                                      </motion.span>
                                    ))}
                                    
                                    {showTagInput[checkin.id] ? (
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={editTagInput}
                                          onChange={(e) => {
                                            setEditTagInput(e.target.value);
                                            setShowEditTagSuggestions(e.target.value.length > 0);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && editTagInput.trim()) {
                                              e.preventDefault();
                                              handleAddEditTag(editTagInput.trim());
                                            }
                                            if (e.key === 'Escape') {
                                              setShowTagInput(prev => ({ ...prev, [checkin.id]: false }));
                                              setShowEditTagSuggestions(false);
                                            }
                                          }}
                                          onBlur={(e) => {
                                            // Delay closing to allow clicking on suggestions
                                            setTimeout(() => {
                                              setShowTagInput(prev => ({ ...prev, [checkin.id]: false }));
                                              setShowEditTagSuggestions(false);
                                            }, 150);
                                          }}
                                          placeholder="Add tag..."
                                          className="w-20 px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:border-aqua"
                                          autoFocus
                                        />
                                        
                                        {showEditTagSuggestions && getFilteredEditTagSuggestions().length > 0 && (
                                          <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-24 overflow-y-auto min-w-24"
                                          >
                                            {getFilteredEditTagSuggestions().map((suggestion) => (
                                              <button
                                                key={suggestion}
                                                onClick={() => handleAddEditTag(suggestion)}
                                                className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50 transition-colors whitespace-nowrap"
                                              >
                                                #{suggestion}
                                              </button>
                                            ))}
                                          </motion.div>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setShowTagInput(prev => ({ ...prev, [checkin.id]: true }))}
                                        className="w-4 h-4 rounded-full bg-gray-300 hover:bg-gray-400 flex items-center justify-center transition-colors"
                                        title="Add tag"
                                      >
                                        <Plus size={10} className="text-gray-600" />
                                      </button>
                                    )}
                                  </div>
                                  
                                  <div className="flex gap-1 justify-center mt-2">
                                    <button
                                      onClick={() => handleSaveTagsEdit(checkin.id)}
                                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs font-medium transition-colors flex items-center gap-1"
                                    >
                                      <Check size={10} /> Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingTagsCheckinId(null);
                                        setShowTagInput(prev => ({ ...prev, [checkin.id]: false }));
                                      }}
                                      className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-full text-xs font-medium transition-colors flex items-center gap-1"
                                    >
                                      <X size={10} /> Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Tag Display Mode */
                                <div 
                                  className="flex flex-wrap gap-1 items-center cursor-pointer"
                                  onClick={() => handleEditTags(checkin.id)}
                                  title="Click to edit tags"
                                >
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
                                  {checkin.tags.length === 0 && (
                                    <span className="text-xs text-gray-400 italic">
                                      Click to add tags
                                    </span>
                                  )}
                                </div>
                              )}
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
                              </div>
                              
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
                            </div>

                            {/* Check-in Content */}
                            {editingCheckinId === checkin.id ? (
                              <div className="mb-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full p-2 text-sm rounded-md border border-gray-200 resize-none"
                                  style={{ minHeight: '50px' }}
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleSaveEdit(checkin.id)}
                                    className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs transition-colors"
                                  >
                                    <Check size={10} />
                                  </button>
                                  <button
                                    onClick={() => setEditingCheckinId(null)}
                                    className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-full text-xs transition-colors"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p 
                                className="text-sm text-gray-700 mb-2 leading-relaxed"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}
                              >
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

                            {/* Tags - Display or Edit Mode */}
                            {editingTagsCheckinId === checkin.id ? (
                              /* Tag Editing Mode for Regular Check-ins */
                              <div className="space-y-2 mb-2">
                                <div className="flex flex-wrap gap-1 items-center">
                                  {editingTags.map((tag) => (
                                    <motion.span
                                      key={tag.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-aqua text-white"
                                    >
                                      #{tag.label}
                                      <button
                                        onClick={() => handleRemoveEditTag(tag.id)}
                                        className="hover:bg-white/20 rounded-full w-3 h-3 flex items-center justify-center"
                                      >
                                        <X size={8} />
                                      </button>
                                    </motion.span>
                                  ))}
                                  
                                  {showTagInput[checkin.id] ? (
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={editTagInput}
                                        onChange={(e) => {
                                          setEditTagInput(e.target.value);
                                          setShowEditTagSuggestions(e.target.value.length > 0);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && editTagInput.trim()) {
                                            e.preventDefault();
                                            handleAddEditTag(editTagInput.trim());
                                          }
                                          if (e.key === 'Escape') {
                                            setShowTagInput(prev => ({ ...prev, [checkin.id]: false }));
                                            setShowEditTagSuggestions(false);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          // Delay closing to allow clicking on suggestions
                                          setTimeout(() => {
                                            setShowTagInput(prev => ({ ...prev, [checkin.id]: false }));
                                            setShowEditTagSuggestions(false);
                                          }, 150);
                                        }}
                                        placeholder="Add tag..."
                                        className="w-20 px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:border-aqua"
                                        autoFocus
                                      />
                                      
                                      {showEditTagSuggestions && getFilteredEditTagSuggestions().length > 0 && (
                                        <motion.div
                                          initial={{ opacity: 0, y: -5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-24 overflow-y-auto min-w-24"
                                        >
                                          {getFilteredEditTagSuggestions().map((suggestion) => (
                                            <button
                                              key={suggestion}
                                              onClick={() => handleAddEditTag(suggestion)}
                                              className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50 transition-colors whitespace-nowrap"
                                            >
                                              #{suggestion}
                                            </button>
                                          ))}
                                        </motion.div>
                                      )}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setShowTagInput(prev => ({ ...prev, [checkin.id]: true }))}
                                      className="w-5 h-5 rounded-full bg-gray-300 hover:bg-gray-400 flex items-center justify-center transition-colors"
                                      title="Add tag"
                                    >
                                      <Plus size={12} className="text-gray-600" />
                                    </button>
                                  )}
                                </div>
                                
                                <div className="flex gap-1 justify-center mt-2">
                                  <button
                                    onClick={() => handleSaveTagsEdit(checkin.id)}
                                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs font-medium transition-colors flex items-center gap-1"
                                  >
                                    <Check size={10} /> Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingTagsCheckinId(null);
                                      setShowTagInput(prev => ({ ...prev, [checkin.id]: false }));
                                    }}
                                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-full text-xs font-medium transition-colors flex items-center gap-1"
                                  >
                                    <X size={10} /> Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Tag Display Mode */
                              <div 
                                className="flex flex-wrap gap-1 items-center cursor-pointer"
                                onClick={() => handleEditTags(checkin.id)}
                                title="Click to edit tags"
                              >
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
                                {checkin.tags.length === 0 && (
                                  <span className="text-xs text-gray-400 italic">
                                    Click to add tags
                                  </span>
                                )}
                              </div>
                            )}
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
          </div>

          {/* Interests */}
          <div className="px-4 mb-1 mt-3">
            <div className="mb-2 border-t border-gray-300/30 w-16 mx-auto"></div>
            <p className="text-text-primary text-sm mb-1 font-bold">
              Montages
            </p>
            <div 
              className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                maxHeight: '28px' // height of single label + padding
              }}
            >
              {/* General label always shown first */}
              <span
                className="bg-aqua text-white px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
              >
                General
              </span>
              {/* Map through user interests */}
              {currentUser.interests.map((interest, index) => (
                <span
                  key={index}
                  className="bg-gray-100 text-gray-900 border border-gray-200 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>


          {/* Photos - scrollable, similar to ProfileDetailModal */}
          {additionalPhotos.length > 0 && (
            <>
              {/* Divider line before photos */}
              <div className="mx-4 mb-1 border-t border-white/10"></div>
              
              <div className="px-4 mb-2">
                <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  <div className="grid grid-cols-2 gap-2">
                    {additionalPhotos.map((photo, index) => (
                      <img
                        key={photo}
                        src={photo}
                        alt={`${currentUser.name}'s photo ${index + 1}`}
                        className="w-full aspect-square rounded-lg object-cover cursor-pointer hover:scale-105 transition-transform duration-200 hover-glow"
                        onError={() => handleImageError(photo)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>


      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleMediaUpload}
      />

      {/* Profile Detail Modal for editing */}
      {showProfileModal && (
        <ProfileDetailModal
          userId={currentUser.id}
          onClose={handleCloseProfileModal}
        />
      )}

      {/* New Check-in Modal */}
      <AnimatePresence>
        {showNewCheckinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50"
            onClick={() => setShowNewCheckinModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Check-In</h3>
                <button
                  onClick={() => setShowNewCheckinModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Text Input */}
              <div className="mb-4">
                <textarea
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full p-3 text-sm rounded-lg border border-gray-200 resize-none focus:outline-none focus:border-aqua transition-colors"
                  style={{ minHeight: '80px' }}
                  autoFocus
                />
              </div>

              {/* Attachment Buttons */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-aqua hover:bg-aqua-dark text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                >
                  <Camera size={14} />
                  Media
                </button>

                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-aqua hover:bg-aqua-dark text-white'
                  }`}
                >
                  <Mic size={14} />
                  {isRecording ? `Recording ${recordingDuration}s` : 'Voice'}
                </button>

                <button
                  onClick={handleAddLocation}
                  className="flex items-center gap-2 px-3 py-2 bg-aqua hover:bg-aqua-dark text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                >
                  <MapPin size={14} />
                  Location
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-aqua hover:bg-aqua-dark text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                >
                  <Paperclip size={14} />
                  Files
                </button>
              </div>

              {/* Attachments Preview */}
              {mediaAttachments.length > 0 && (
                <div className="mb-4">
                  <div className="flex gap-2 flex-wrap">
                    {mediaAttachments.map((media) => (
                      <div key={media.id} className="relative">
                        <img
                          src={media.url}
                          alt={media.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => handleRemoveMedia(media.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                        >
                          <X size={10} color="white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {fileAttachments.length > 0 && (
                <div className="mb-4">
                  {fileAttachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip size={14} className="text-aqua" />
                        <div>
                          <div className="text-sm font-medium">{file.name}</div>
                          <div className="text-xs text-gray-500">{file.size}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="w-5 h-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {voiceNote && (
                <div className="mb-4">
                  <div className="flex items-center justify-between p-3 bg-aqua/10 rounded-lg border border-aqua/30">
                    <div className="flex items-center gap-2">
                      <Mic size={14} className="text-aqua" />
                      <div>
                        <div className="text-sm font-medium text-aqua">Voice Note</div>
                        <div className="text-xs text-gray-500">{voiceNote.duration}s</div>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveVoiceNote}
                      className="w-5 h-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              )}

              {locationAttachment && (
                <div className="mb-4">
                  <div className="flex items-center justify-between p-3 bg-aqua/10 rounded-lg border border-aqua/30">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-aqua" />
                      <div>
                        <div className="text-sm font-medium text-aqua">{locationAttachment.name}</div>
                        <div className="text-xs text-gray-500">Location attached</div>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveLocation}
                      className="w-5 h-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              )}

              {/* Tags Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Hash size={16} className="text-aqua" />
                  <span className="text-sm font-medium text-gray-700">Tags</span>
                </div>
                
                {manualTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {manualTags.map((tag) => (
                      <motion.span
                        key={tag.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-aqua text-white"
                      >
                        #{tag.label}
                        <button
                          onClick={() => handleRemoveManualTag(tag.id)}
                          className="ml-1 hover:bg-white/20 rounded-full w-3 h-3 flex items-center justify-center"
                        >
                          <X size={8} />
                        </button>
                      </motion.span>
                    ))}
                  </div>
                )}
                
                <div className="relative">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setShowTagSuggestions(e.target.value.length > 0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        handleAddTag(tagInput.trim());
                      }
                      if (e.key === 'Escape') {
                        setShowTagSuggestions(false);
                      }
                    }}
                    placeholder="Add tags... (press Enter)"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-aqua transition-colors"
                  />
                  
                  {showTagSuggestions && getFilteredTagSuggestions().length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto"
                    >
                      {getFilteredTagSuggestions().map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleAddTag(suggestion)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                        >
                          #{suggestion}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handlePost}
                disabled={!(searchText.trim() || hasAttachments)}
                className={`w-full py-3 rounded-full font-medium transition-all duration-200 ${
                  (searchText.trim() || hasAttachments)
                    ? 'bg-aqua hover:bg-aqua-dark text-white hover:scale-[1.02]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Share Thought
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;
