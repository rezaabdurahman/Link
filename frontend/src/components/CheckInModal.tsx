import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MapPin, Hash, Mic, Paperclip, X, Upload, Globe, Users, Lock } from 'lucide-react';
import { 
  uploadMedia, 
  uploadFile, 
  uploadVoiceNote,
  createFilePreview, 
  revokeFilePreview, 
  getFileCategory,
  getUploadErrorMessage,
  type MediaUploadResponse,
  type UploadResponse,
  type VoiceUploadResponse,
  type UploadProgressCallback,
  type UploadApiError
} from '../services/uploadClient';

// Import types for the check-in functionality
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

interface CheckInData {
  text: string;
  mediaAttachments: MediaAttachment[];
  fileAttachments: FileAttachment[];
  voiceNote: VoiceNote | null;
  locationAttachment: LocationAttachment | null;
  tags: Tag[];
  privacy: 'public' | 'friends' | 'private';
}

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (checkInData: CheckInData) => Promise<void>;
  isSubmitting?: boolean;
}

const COMMON_TAGS = [
  'coffee', 'workout', 'music', 'food', 'travel', 'work', 'friends', 
  'family', 'nature', 'art', 'reading', 'coding', 'gaming', 'sports'
];

const CheckInModal: React.FC<CheckInModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isSubmitting = false 
}) => {
  // Form state
  const [searchText, setSearchText] = useState<string>('');
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(null);
  const [locationAttachment, setLocationAttachment] = useState<LocationAttachment | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  
  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>({});
  
  // Tag state
  const [manualTags, setManualTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [showTagSuggestions, setShowTagSuggestions] = useState<boolean>(false);
  
  // Privacy state
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    // Clean up any preview URLs
    mediaAttachments.forEach(attachment => {
      if (attachment.url.startsWith('blob:')) {
        revokeFilePreview(attachment.url);
      }
    });
    
    setSearchText('');
    setMediaAttachments([]);
    setFileAttachments([]);
    setVoiceNote(null);
    setLocationAttachment(null);
    setManualTags([]);
    setTagInput('');
    setShowTagSuggestions(false);
    setIsRecording(false);
    setRecordingDuration(0);
    setPrivacy('public');
    
    // Clear upload state
    setIsUploading(false);
    setUploadProgress({});
    setUploadErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Media handlers
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);
    const newMediaAttachments: MediaAttachment[] = [];
    const newUploadErrors: { [key: string]: string } = {};

    for (const file of Array.from(files)) {
      const tempId = `media_${Date.now()}_${Math.random()}`;
      const previewUrl = createFilePreview(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      
      // Add temporary attachment with preview
      const tempAttachment: MediaAttachment = {
        id: tempId,
        type,
        url: previewUrl,
        name: file.name
      };
      
      newMediaAttachments.push(tempAttachment);
      setMediaAttachments(prev => [...prev, tempAttachment]);
      
      try {
        const progressCallback: UploadProgressCallback = (progress) => {
          setUploadProgress(prev => ({ ...prev, [tempId]: progress }));
        };
        
        const uploadResult = await uploadMedia(file, {
          onProgress: progressCallback,
          generateThumbnail: true
        });
        
        // Update attachment with uploaded URL and thumbnail
        setMediaAttachments(prev => prev.map(attachment => 
          attachment.id === tempId 
            ? { ...attachment, url: uploadResult.file_url }
            : attachment
        ));
        
        // Clean up preview URL
        revokeFilePreview(previewUrl);
        
      } catch (error) {
        const errorMessage = getUploadErrorMessage(error as UploadApiError);
        newUploadErrors[tempId] = errorMessage;
        
        // Remove failed upload from attachments
        setMediaAttachments(prev => prev.filter(attachment => attachment.id !== tempId));
        revokeFilePreview(previewUrl);
      } finally {
        // Clear progress for this file
        setUploadProgress(prev => {
          const { [tempId]: _, ...rest } = prev;
          return rest;
        });
      }
    }
    
    setUploadErrors(prev => ({ ...prev, ...newUploadErrors }));
    setIsUploading(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);
    const newUploadErrors: { [key: string]: string } = {};

    for (const file of Array.from(files)) {
      const tempId = `file_${Date.now()}_${Math.random()}`;
      const size = (file.size / 1024).toFixed(1) + ' KB';
      
      // Add temporary attachment
      const tempAttachment: FileAttachment = {
        id: tempId,
        name: file.name,
        size,
        type: file.type
      };
      
      setFileAttachments(prev => [...prev, tempAttachment]);
      
      try {
        const progressCallback: UploadProgressCallback = (progress) => {
          setUploadProgress(prev => ({ ...prev, [tempId]: progress }));
        };
        
        const uploadResult = await uploadFile(file, {
          onProgress: progressCallback
        });
        
        // Update attachment with actual uploaded file data
        setFileAttachments(prev => prev.map(attachment => 
          attachment.id === tempId 
            ? { 
                ...attachment, 
                url: uploadResult.file_url, 
                name: uploadResult.file_name,
                size: uploadResult.file_size 
              }
            : attachment
        ));
        
      } catch (error) {
        const errorMessage = getUploadErrorMessage(error as UploadApiError);
        newUploadErrors[tempId] = errorMessage;
        
        // Remove failed upload from attachments
        setFileAttachments(prev => prev.filter(attachment => attachment.id !== tempId));
      } finally {
        // Clear progress for this file
        setUploadProgress(prev => {
          const { [tempId]: _, ...rest } = prev;
          return rest;
        });
      }
    }
    
    setUploadErrors(prev => ({ ...prev, ...newUploadErrors }));
    setIsUploading(false);
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

  const handleStopRecording = async () => {
    setIsRecording(false);
    
    try {
      // For now, create a temporary voice note
      // In a real implementation, you would capture audio from MediaRecorder
      const tempVoiceNote: VoiceNote = {
        id: 'voice_' + Date.now(),
        duration: recordingDuration,
        url: '#' // Placeholder URL
      };
      
      setVoiceNote(tempVoiceNote);
      
      // TODO: Implement actual audio recording and upload
      // const audioBlob = getRecordedAudio(); // Get from MediaRecorder
      // const audioFile = new File([audioBlob], 'voice-note.mp3', { type: 'audio/mp3' });
      // const uploadResult = await uploadVoiceNote(audioFile);
      // setVoiceNote({ ...tempVoiceNote, url: uploadResult.url });
      
    } catch (error) {
      console.error('Failed to process voice note:', error);
      // Handle error - maybe show a toast notification
    }
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
      color: '#14b8a6' // Primary aqua color
    };
    setManualTags(prev => [...prev, newTag]);
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const handleRemoveManualTag = (tagId: string) => {
    setManualTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  const getFilteredTagSuggestions = () => {
    if (!tagInput.trim()) return [];
    return COMMON_TAGS.filter(tag => 
      tag.toLowerCase().includes(tagInput.toLowerCase()) &&
      !manualTags.some(existingTag => existingTag.label === tag)
    ).slice(0, 5);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    const checkInData: CheckInData = {
      text: searchText,
      mediaAttachments,
      fileAttachments,
      voiceNote,
      locationAttachment,
      tags: manualTags,
      privacy,
    };
    
    try {
      await onSubmit(checkInData);
      resetForm(); // Only reset form on successful submission
    } catch (error) {
      // Error is handled by the parent component
      // Form stays open for user to retry
      console.error('CheckInModal: Submission failed', error);
    }
  };

  const hasAttachments = mediaAttachments.length > 0 || fileAttachments.length > 0 || voiceNote || locationAttachment;
  const canSubmit = (searchText.trim() || hasAttachments) && !isSubmitting && !isUploading;

  return (
    <>
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

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-md bg-white rounded-2xl p-6 max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Check-In</h3>
                <button
                  onClick={handleClose}
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

              {/* Upload Status */}
              {isUploading && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Upload size={14} className="text-blue-500" />
                    <span className="text-sm font-medium text-blue-700">Uploading files...</span>
                  </div>
                  {Object.entries(uploadProgress).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(uploadProgress).map(([fileId, progress]) => (
                        <div key={fileId} className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{Math.round(progress)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Upload Errors */}
              {Object.keys(uploadErrors).length > 0 && (
                <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-sm font-medium text-red-700 mb-1">Upload Errors:</div>
                  <div className="space-y-1">
                    {Object.entries(uploadErrors).map(([fileId, error]) => (
                      <div key={fileId} className="text-xs text-red-600">
                        • {error}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setUploadErrors({})}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Attachment Buttons */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={isUploading}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isUploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-aqua hover:bg-aqua-dark text-white'
                  }`}
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
                  disabled={isUploading}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isUploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-aqua hover:bg-aqua-dark text-white'
                  }`}
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

              {/* Privacy Selector */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Who can see this?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPrivacy('public')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      privacy === 'public'
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    <Globe size={16} />
                    Public
                  </button>
                  <button
                    onClick={() => setPrivacy('friends')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      privacy === 'friends'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    <Users size={16} />
                    Friends
                  </button>
                  <button
                    onClick={() => setPrivacy('private')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      privacy === 'private'
                        ? 'bg-gray-100 text-gray-700 border-2 border-gray-400'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    <Lock size={16} />
                    Private
                  </button>
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-500">
                    {privacy === 'public' && 'Visible to everyone'}
                    {privacy === 'friends' && 'Visible to friends only'}
                    {privacy === 'private' && 'Visible to you only'}
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full py-3 rounded-full font-medium transition-all duration-200 ${
                  canSubmit
                    ? 'bg-aqua hover:bg-aqua-dark text-white hover:scale-[1.02]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Sharing...' : 'Share Thought'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CheckInModal;
