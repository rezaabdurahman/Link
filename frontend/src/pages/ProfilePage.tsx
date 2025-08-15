import React, { useState, useRef } from 'react';
import { 
  Edit, Settings, Send, Camera, MapPin, Hash, Mic, Paperclip, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FaInstagram, FaTwitter, FaLinkedin } from 'react-icons/fa';
import { currentUser } from '../data/mockData';
import ProfileDetailModal from '../components/ProfileDetailModal';
import { motion } from 'framer-motion';

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

const COMMON_TAGS = [
  'coffee', 'workout', 'music', 'food', 'travel', 'work', 'friends', 
  'family', 'nature', 'art', 'reading', 'coding', 'gaming', 'sports'
];

const ProfilePage: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  
  // Share thoughts state (copied from CheckinPage)
  const [searchText, setSearchText] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
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

  const getTagColor = (label: string): string => {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
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
    
    // TODO: Implement actual posting logic
    console.log('Posting thought:', searchText);
    
    // Reset form
    setSearchText('');
    setMediaAttachments([]);
    setFileAttachments([]);
    setVoiceNote(null);
    setLocationAttachment(null);
    setManualTags([]);
    setIsSearchFocused(false);
  };

  const hasAttachments = mediaAttachments.length > 0 || fileAttachments.length > 0 || voiceNote || locationAttachment;

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

          {/* Share Your Thoughts Section - Exact copy from CheckinPage */}
          <div className="px-4 mb-4 mt-4">
            <div className="mb-2 border-t border-gray-300/30 w-16 mx-auto"></div>
            <h3 className="text-sm font-bold mb-3 text-text-primary">Share Your Thoughts</h3>
            <div className="ios-card" style={{ padding: '16px', margin: '0' }}>
            {/* Search/Text Input Area */}
            <div 
              className={`relative transition-all duration-200 mb-4`}
              style={{
                borderRadius: '12px',
                background: '#f5f5f5'
              }}
            >
              <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <textarea
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="What's happening?"
                  style={{
                    flex: '1',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#000000',
                    fontSize: '16px',
                    resize: 'none',
                    minHeight: '20px',
                    maxHeight: '120px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                  }}
                  rows={1}
                />
                <button
                  onClick={handlePost}
                  className={`p-2 rounded-full transition-all duration-200 hover:scale-105 flex items-center justify-center flex-shrink-0 ${
                    (searchText.trim() || hasAttachments) 
                      ? 'bg-aqua hover:bg-aqua-dark' 
                      : 'bg-gray-300 hover:bg-gray-400 cursor-not-allowed'
                  }`}
                  style={{ width: '32px', height: '32px' }}
                  disabled={!(searchText.trim() || hasAttachments)}
                >
                  <Send size={16} className="text-white" fill="currentColor" />
                </button>
              </div>
            </div>

            {/* Attachment Options */}
            <div style={{ marginBottom: '16px' }}>
              {/* Attachment Buttons */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: hasAttachments ? '12px' : '0',
                overflowX: 'auto',
                paddingBottom: '4px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                <style>{`
                  div::-webkit-scrollbar { display: none; }
                `}</style>
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-aqua hover:bg-aqua-dark text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap"
                >
                  <Camera size={14} />
                  Media
                </button>

                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap ${
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
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-aqua hover:bg-aqua-dark text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap"
                >
                  <MapPin size={14} />
                  Location
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-aqua hover:bg-aqua-dark text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap"
                >
                  <Paperclip size={14} />
                  Files
                </button>
              </div>

              {/* Media Attachments Preview */}
              {mediaAttachments.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {mediaAttachments.map((media) => (
                      <div key={media.id} className="relative">
                        <img
                          src={media.url}
                          alt={media.name}
                          style={{
                            width: '70px',
                            height: '70px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}
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

              {/* File Attachments Preview */}
              {fileAttachments.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  {fileAttachments.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        marginBottom: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Paperclip size={14} color="#06b6d4" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500' }}>{file.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{file.size}</div>
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

              {/* Voice Note Preview */}
              {voiceNote && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    background: 'rgba(6, 182, 212, 0.1)',
                    borderRadius: '6px',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    marginBottom: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mic size={14} color="#06b6d4" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#06b6d4' }}>Voice Note</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{voiceNote.duration}s</div>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveVoiceNote}
                    className="w-5 h-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}

              {/* Location Preview */}
              {locationAttachment && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    background: 'rgba(6, 182, 212, 0.1)',
                    borderRadius: '6px',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    marginBottom: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={14} color="#06b6d4" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#06b6d4' }}>{locationAttachment.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Location attached</div>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveLocation}
                    className="w-5 h-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}

              {/* Manual Tags Input */}
              <div style={{ marginBottom: '16px', marginTop: '20px' }}>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash size={16} className="text-aqua" />
                    <span className="text-sm font-medium text-text-primary">Tags</span>
                  </div>
                  
                  {/* Manual Tags Display */}
                  {manualTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {manualTags.map((tag) => (
                        <motion.span
                          key={tag.id}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          #{tag.label}
                          <button
                            onClick={() => handleRemoveManualTag(tag.id)}
                            className="ml-1 hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center"
                          >
                            <X size={8} />
                          </button>
                        </motion.span>
                      ))}
                    </div>
                  )}
                  
                  {/* Tag Input */}
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
                      className="w-full px-3 py-2 text-sm rounded-ios bg-surface-hover focus:bg-surface-primary focus:outline-none transition-all"
                      style={{ border: 'none' }}
                    />
                    
                    {/* Tag Suggestions Dropdown */}
                    {showTagSuggestions && getFilteredTagSuggestions().length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-surface-card border border-surface-border rounded-ios shadow-card z-10 max-h-32 overflow-y-auto"
                      >
                        {getFilteredTagSuggestions().map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleAddTag(suggestion)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors"
                          >
                            #{suggestion}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

            </div>
            </div>
          </div>

          {/* Interests */}
          <div className="px-4 mb-1 mt-3">
            <div className="mb-2 border-t border-gray-300/30 w-16 mx-auto"></div>
            <p className="text-text-primary text-sm mb-1 font-bold">
              Interest Montages
            </p>
            <div className="flex flex-wrap gap-1.5">
              {currentUser.interests.map((interest, index) => (
                <span
                  key={index}
                  className="bg-aqua/20 text-aqua px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
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
    </div>
  );
};

export default ProfilePage;
