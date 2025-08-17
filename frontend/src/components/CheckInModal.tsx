import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MapPin, Hash, Mic, Paperclip, X } from 'lucide-react';

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
}

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (checkInData: CheckInData) => void;
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
  
  // Tag state
  const [manualTags, setManualTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [showTagSuggestions, setShowTagSuggestions] = useState<boolean>(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
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
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Media handlers
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

  const handleSubmit = () => {
    if (isSubmitting) return;
    
    const checkInData: CheckInData = {
      text: searchText,
      mediaAttachments,
      fileAttachments,
      voiceNote,
      locationAttachment,
      tags: manualTags,
    };
    
    onSubmit(checkInData);
    resetForm();
  };

  const hasAttachments = mediaAttachments.length > 0 || fileAttachments.length > 0 || voiceNote || locationAttachment;
  const canSubmit = (searchText.trim() || hasAttachments) && !isSubmitting;

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
