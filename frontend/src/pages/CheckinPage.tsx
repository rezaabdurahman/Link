import React, { useState, useRef, useReducer, useEffect } from 'react';
import { 
  Camera, Mic, MapPin, Paperclip, X, Send, Check, Loader2, 
  Edit3, Trash2, Share, Clock, Hash, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FixedHeader from '../components/layout/FixedHeader';
import SocialIcon from '../components/SocialIcon';

import { 
  CheckIn, SocialAccount, Tag, CheckinState, CheckinAction,
  MediaAttachment, FileAttachment, VoiceNote, LocationAttachment
} from '../types/checkin';
import {
  generateMockCheckIns, generateMockSocialAccounts, generateMockOpportunities,
  generateAISuggestions, generateOpportunitiesFromCheckin, COMMON_TAGS
} from '../mocks/checkinData';

// State reducer for managing all check-in page state
const checkinReducer = (state: CheckinState, action: CheckinAction): CheckinState => {
  switch (action.type) {
    case 'ADD_CHECKIN':
      return {
        ...state,
        checkIns: [action.payload, ...state.checkIns]
      };
    case 'UPDATE_CHECKIN':
      return {
        ...state,
        checkIns: state.checkIns.map(checkin => 
          checkin.id === action.payload.id 
            ? { ...checkin, ...action.payload.updates }
            : checkin
        )
      };
    case 'DELETE_CHECKIN':
      return {
        ...state,
        checkIns: state.checkIns.filter(checkin => checkin.id !== action.payload)
      };
    case 'ADD_AI_SUGGESTIONS':
      return {
        ...state,
        checkIns: state.checkIns.map(checkin => 
          checkin.id === action.payload.checkinId
            ? { 
                ...checkin, 
                aiSuggestionsPending: false,
                aiSuggestions: action.payload.suggestions 
              }
            : checkin
        )
      };
    case 'ACCEPT_TAG':
      return {
        ...state,
        checkIns: state.checkIns.map(checkin => {
          if (checkin.id === action.payload.checkinId && checkin.aiSuggestions) {
            const acceptedTag = checkin.aiSuggestions.find(tag => tag.id === action.payload.tagId);
            if (acceptedTag) {
              return {
                ...checkin,
                tags: [...checkin.tags, acceptedTag],
                aiSuggestions: checkin.aiSuggestions.filter(tag => tag.id !== action.payload.tagId)
              };
            }
          }
          return checkin;
        })
      };
    case 'REJECT_TAG':
      return {
        ...state,
        checkIns: state.checkIns.map(checkin => 
          checkin.id === action.payload.checkinId && checkin.aiSuggestions
            ? {
                ...checkin,
                aiSuggestions: checkin.aiSuggestions.filter(tag => tag.id !== action.payload.tagId)
              }
            : checkin
        )
      };
    case 'UPDATE_OPPORTUNITY':
      return {
        ...state,
        opportunities: state.opportunities.map(opp => 
          opp.id === action.payload.id
            ? { ...opp, status: action.payload.status }
            : opp
        )
      };
    case 'REFRESH_OPPORTUNITIES':
      return {
        ...state,
        opportunities: [...action.payload, ...state.opportunities.filter(opp => opp.status !== 'rejected')]
      };
    case 'UPDATE_SOCIAL_ACCOUNT':
      return {
        ...state,
        socialAccounts: state.socialAccounts.map(account => 
          account.id === action.payload.id
            ? { ...account, ...action.payload.updates }
            : account
        )
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    default:
      return state;
  }
};

const CheckinPage: React.FC = (): JSX.Element => {
  // Initialize state with mock data
  const [state, dispatch] = useReducer(checkinReducer, {
    checkIns: generateMockCheckIns(),
    opportunities: generateMockOpportunities(),
    socialAccounts: generateMockSocialAccounts(),
    isLoading: false
  });

  // Composer state
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
  // const [isPosting, setIsPosting] = useState<boolean>(false);
  
  // Edit mode state
  const [editingCheckinId, setEditingCheckinId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const opportunitiesRef = useRef<HTMLDivElement>(null);

  // Load social accounts from localStorage
  useEffect(() => {
    const savedAccounts = localStorage.getItem('socialAccounts');
    if (savedAccounts) {
      const accounts = JSON.parse(savedAccounts);
      accounts.forEach((account: SocialAccount) => {
        dispatch({
          type: 'UPDATE_SOCIAL_ACCOUNT',
          payload: { id: account.id, updates: account }
        });
      });
    }
  }, []);

  // Save social accounts to localStorage when they change
  useEffect(() => {
    localStorage.setItem('socialAccounts', JSON.stringify(state.socialAccounts));
  }, [state.socialAccounts]);

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
    
    // setIsPosting(true);
    
    // Create new check-in
    const newCheckin: CheckIn = {
      id: `checkin-${Date.now()}`,
      text: searchText,
      mediaAttachments: [...mediaAttachments],
      fileAttachments: [...fileAttachments],
      voiceNote: voiceNote ? { ...voiceNote } : null,
      locationAttachment: locationAttachment ? { ...locationAttachment } : null,
      tags: [...manualTags],
      aiSuggestionsPending: true,
      timestamp: new Date()
    };
    
    // Add check-in to state
    dispatch({ type: 'ADD_CHECKIN', payload: newCheckin });
    
    // Simulate AI processing delay
    setTimeout(() => {
      const aiSuggestions = generateAISuggestions(
        searchText, 
        !!locationAttachment, 
        mediaAttachments.length > 0
      );
      
      dispatch({
        type: 'ADD_AI_SUGGESTIONS',
        payload: {
          checkinId: newCheckin.id,
          suggestions: aiSuggestions
        }
      });
      
      // Generate new opportunities based on this check-in
      const newOpportunities = generateOpportunitiesFromCheckin(newCheckin);
      if (newOpportunities.length > 0) {
        dispatch({
          type: 'REFRESH_OPPORTUNITIES',
          payload: newOpportunities
        });
      }
    }, 1500);
    
    // Reset form
    setSearchText('');
    setMediaAttachments([]);
    setFileAttachments([]);
    setVoiceNote(null);
    setLocationAttachment(null);
    setManualTags([]);
    setIsSearchFocused(false);
    // setIsPosting(false);
  };

  // Social account management
  const handleToggleSocialAccount = (accountId: string) => {
    const account = state.socialAccounts.find(acc => acc.id === accountId);
    if (account) {
      dispatch({
        type: 'UPDATE_SOCIAL_ACCOUNT',
        payload: {
          id: accountId,
          updates: { connected: !account.connected }
        }
      });
    }
  };

  // Check-in management
  const handleEditCheckin = (checkinId: string) => {
    const checkin = state.checkIns.find(c => c.id === checkinId);
    if (checkin) {
      setEditingCheckinId(checkinId);
      setEditText(checkin.text);
    }
  };

  const handleSaveEdit = (checkinId: string) => {
    dispatch({
      type: 'UPDATE_CHECKIN',
      payload: {
        id: checkinId,
        updates: { text: editText }
      }
    });
    setEditingCheckinId(null);
    setEditText('');
  };

  const handleDeleteCheckin = (checkinId: string) => {
    if (confirm('Are you sure you want to delete this check-in?')) {
      dispatch({ type: 'DELETE_CHECKIN', payload: checkinId });
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
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(checkin.text);
      alert('Check-in text copied to clipboard!');
    }
  };

  // Opportunity management
  const handleOpportunityAction = (opportunityId: string, action: 'accepted' | 'rejected') => {
    dispatch({
      type: 'UPDATE_OPPORTUNITY',
      payload: { id: opportunityId, status: action }
    });
  };

  const handleAcceptTag = (checkinId: string, tagId: string) => {
    dispatch({
      type: 'ACCEPT_TAG',
      payload: { checkinId, tagId }
    });
  };

  const handleRejectTag = (checkinId: string, tagId: string) => {
    dispatch({
      type: 'REJECT_TAG',
      payload: { checkinId, tagId }
    });
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const hasAttachments = mediaAttachments.length > 0 || fileAttachments.length > 0 || voiceNote || locationAttachment;
  const pendingOpportunities = state.opportunities.filter(opp => opp.status === 'pending');
  // const hasValidContent = searchText.trim() || hasAttachments || manualTags.length > 0;

  const handleSocialAccountClick = (account: SocialAccount) => {
    if (account.connected) {
      // Show confirmation to disconnect
      if (confirm(`Disconnect from ${account.name}? Your check-ins will no longer be shared to this platform.`)) {
        handleToggleSocialAccount(account.id);
      }
    } else {
      // Show confirmation to connect
      if (confirm(`Connect to ${account.name}? Your check-ins will be automatically shared to this platform when you post.`)) {
        handleToggleSocialAccount(account.id);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <FixedHeader>
        <div className="flex justify-between items-center pb-6">
          <h1 className="text-2xl font-bold text-gradient-aqua">Check-in</h1>
          <button
            onClick={() => setShowHelpModal(true)}
            className="w-7 h-7 rounded-full bg-transparent text-aqua hover:bg-aqua/10 transition-all duration-200 flex items-center justify-center"
            title="What happens when you check-in?"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </FixedHeader>
      
      {/* Main Content - with more top padding to account for fixed header */}
      <div className="pt-28 pb-20 px-4">

        {/* Share Your Thoughts Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Share Your Thoughts</h2>
          <div className="ios-card" style={{ padding: '16px' }}>
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

        {/* Opportunities Carousel */}
        {pendingOpportunities.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Social Opportunities</h2>
            <div className="text-xs text-text-muted">Swipe to explore</div>
          </div>
          
          <div 
            ref={opportunitiesRef}
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`div::-webkit-scrollbar { display: none; }`}</style>
            {pendingOpportunities.map((opportunity) => (
              <motion.div
                key={opportunity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-shrink-0 w-64 ios-card p-4"
              >
                <div className="mb-3">
                  <div className="text-sm font-semibold text-text-primary mb-1">
                    {opportunity.title}
                  </div>
                  <div className="text-xs text-text-secondary line-clamp-2">
                    {opportunity.description}
                  </div>
                </div>
                
                {opportunity.details && (
                  <div className="text-xs text-text-muted mb-3">
                    {opportunity.details.date && (
                      <div className="flex items-center gap-1 mb-1">
                        <Clock size={10} />
                        <span>{opportunity.details.date}</span>
                      </div>
                    )}
                    {opportunity.details.location && (
                      <div className="flex items-center gap-1">
                        <MapPin size={10} />
                        <span>{opportunity.details.location}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpportunityAction(opportunity.id, 'rejected')}
                    className="flex-1 px-3 py-2 text-xs font-medium text-text-muted border border-surface-border rounded-ios hover:bg-surface-hover transition-colors"
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => handleOpportunityAction(opportunity.id, 'accepted')}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-aqua hover:bg-aqua-dark rounded-ios transition-colors"
                  >
                    {opportunity.actionLabel || 'Accept'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        )}

        {/* Check-in History */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Check-in History</h2>
            <div className="text-xs text-text-muted">{state.checkIns.length} posts</div>
          </div>
          
          {/* Connected Accounts Row */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-text-secondary">Connected:</span>
            <div className="flex items-center gap-2">
              {state.socialAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleSocialAccountClick(account)}
                  className={`transition-all duration-200 hover:scale-110 ${
                    account.connected ? 'opacity-100' : 'opacity-40 grayscale'
                  }`}
                  title={account.connected ? `Connected to ${account.name}` : `Connect to ${account.name}`}
                >
                  <SocialIcon provider={account.provider} size={20} />
                </button>
              ))}
            </div>
          </div>
        
        <AnimatePresence>
          {state.checkIns.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-text-muted"
            >
              <Hash size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No check-ins yet</p>
              <p className="text-xs mt-1">Share your first moment above!</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {state.checkIns.map((checkin) => (
                <motion.div
                  key={checkin.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="ios-card p-4"
                >
                  {/* Check-in Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <Clock size={12} />
                      <span>{formatTimeAgo(checkin.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditCheckin(checkin.id)}
                        className="p-1.5 hover:bg-surface-hover rounded-full transition-colors"
                      >
                        <Edit3 size={12} className="text-text-muted" />
                      </button>
                      <button
                        onClick={() => handleShareCheckin(checkin)}
                        className="p-1.5 hover:bg-surface-hover rounded-full transition-colors"
                      >
                        <Share size={12} className="text-text-muted" />
                      </button>
                      <button
                        onClick={() => handleDeleteCheckin(checkin.id)}
                        className="p-1.5 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Check-in Content */}
                  {editingCheckinId === checkin.id ? (
                    <div className="mb-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-surface-border rounded-ios bg-surface-hover focus:bg-surface-primary focus:border-aqua focus:outline-none resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleSaveEdit(checkin.id)}
                          className="px-3 py-1 text-xs font-medium text-white bg-aqua hover:bg-aqua-dark rounded-full transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingCheckinId(null)}
                          className="px-3 py-1 text-xs font-medium text-text-muted border border-surface-border rounded-full hover:bg-surface-hover transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    checkin.text && (
                      <div className="text-sm text-text-primary mb-3 leading-relaxed">
                        {checkin.text}
                      </div>
                    )
                  )}
                  
                  {/* Media Attachments */}
                  {checkin.mediaAttachments.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {checkin.mediaAttachments.map((media) => (
                        <img
                          key={media.id}
                          src={media.url}
                          alt={media.name}
                          className="w-full h-24 object-cover rounded-ios"
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Location */}
                  {checkin.locationAttachment && (
                    <div className="flex items-center gap-2 text-xs text-aqua mb-3">
                      <MapPin size={12} />
                      <span>{checkin.locationAttachment.name}</span>
                    </div>
                  )}
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {checkin.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        #{tag.label}
                      </span>
                    ))}
                  </div>
                  
                  {/* AI Suggestions */}
                  {checkin.aiSuggestionsPending && (
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Generating AI suggestions...</span>
                    </div>
                  )}
                  
                  {checkin.aiSuggestions && checkin.aiSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="border-t border-surface-border pt-2 mt-2"
                    >
                      <div className="text-xs text-text-muted mb-2">AI Suggestions:</div>
                      <div className="flex flex-wrap gap-1">
                        {checkin.aiSuggestions.map((suggestion) => (
                          <motion.div
                            key={suggestion.id}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex items-center gap-1 px-2 py-1 bg-surface-hover rounded-full text-xs"
                          >
                            <span>#{suggestion.label}</span>
                            <button
                              onClick={() => handleAcceptTag(checkin.id, suggestion.id)}
                              className="w-4 h-4 flex items-center justify-center hover:bg-aqua/20 rounded-full transition-colors"
                            >
                              <Check size={8} className="text-aqua" />
                            </button>
                            <button
                              onClick={() => handleRejectTag(checkin.id, suggestion.id)}
                              className="w-4 h-4 flex items-center justify-center hover:bg-red-100 rounded-full transition-colors"
                            >
                              <X size={8} className="text-red-400" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
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
      </div>
      
      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface-card rounded-2xl max-w-md w-full shadow-2xl"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-text-primary">What happens when you check-in?</h3>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
              
              {/* Content */}
              <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-aqua/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-aqua">1</span>
                  </div>
                  <p><strong className="text-text-primary">Friends get summaries:</strong> When you chat with friends, they'll see a summary of your recent check-ins to stay connected with what's happening in your life.</p>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-aqua/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-aqua">2</span>
                  </div>
                  <p><strong className="text-text-primary">Bio updates:</strong> Friends can see your check-in details in your profile bio, giving them insight into your current interests and activities.</p>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-aqua/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-aqua">3</span>
                  </div>
                  <p><strong className="text-text-primary">Interest montage:</strong> The tags from your check-ins automatically update your profile's interest montage, showing friends what you're genuinely passionate about.</p>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-aqua/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-aqua">4</span>
                  </div>
                  <p><strong className="text-text-primary">Smart opportunities:</strong> Your check-ins help us suggest relevant social opportunities, events, and connections based on your interests and activities.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CheckinPage;
