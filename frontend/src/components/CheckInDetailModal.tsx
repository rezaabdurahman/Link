import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Hash, Paperclip, Mic, Globe, Users, Lock, Calendar, Heart, MessageCircle, Share } from 'lucide-react';
import { getCheckIn } from '../services/checkinClient';
import { CheckIn } from '../types/checkin';
import { convertBackendCheckInToFrontend } from '../utils/checkinTransformers';

interface CheckInDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkInId: string | null;
}

const CheckInDetailModal: React.FC<CheckInDetailModalProps> = ({
  isOpen,
  onClose,
  checkInId
}) => {
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch check-in data when modal opens and checkInId changes
  useEffect(() => {
    if (!isOpen || !checkInId) {
      setCheckIn(null);
      setError(null);
      return;
    }

    let isMounted = true;

    const fetchCheckInData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await getCheckIn(checkInId);
        
        // Prevent state updates if component has unmounted
        if (!isMounted) return;
        
        // Convert API check-in to frontend format using shared utility
        const convertedCheckIn = convertBackendCheckInToFrontend(data);
        setCheckIn(convertedCheckIn);
      } catch (err) {
        console.error('Failed to fetch check-in:', err);
        if (isMounted) {
          setError('Failed to load check-in details');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCheckInData();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    };
  }, [isOpen, checkInId]);

  const handleClose = () => {
    setCheckIn(null);
    setError(null);
    onClose();
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case 'public':
        return <Globe size={14} className="text-green-600" />;
      case 'friends':
        return <Users size={14} className="text-blue-600" />;
      case 'private':
        return <Lock size={14} className="text-gray-600" />;
      default:
        return <Globe size={14} className="text-green-600" />;
    }
  };

  const getPrivacyLabel = (privacy: string) => {
    switch (privacy) {
      case 'public':
        return 'Public';
      case 'friends':
        return 'Friends only';
      case 'private':
        return 'Private';
      default:
        return 'Public';
    }
  };

  return (
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
            className="w-full max-w-lg bg-white rounded-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Check-In Details</h2>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua"></div>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="text-red-500 text-center mb-4">{error}</div>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}

              {checkIn && !isLoading && !error && (
                <div className="space-y-6">
                  {/* Timestamp and Privacy */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatTimestamp(checkIn.timestamp)}
                    </div>
                    <div className="flex items-center gap-1">
                      {getPrivacyIcon(checkIn.privacy || 'public')}
                      {getPrivacyLabel(checkIn.privacy || 'public')}
                    </div>
                  </div>

                  {/* Text Content */}
                  {checkIn.text && (
                    <div className="text-gray-900 leading-relaxed">
                      {checkIn.text}
                    </div>
                  )}

                  {/* Media Attachments */}
                  {checkIn.mediaAttachments.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Hash size={16} className="text-aqua" />
                        Media
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {checkIn.mediaAttachments.map((media) => (
                          <div key={media.id} className="relative rounded-lg overflow-hidden bg-gray-100">
                            {media.type === 'image' ? (
                              <img
                                src={media.url}
                                alt={media.name}
                                className="w-full h-32 object-cover"
                              />
                            ) : (
                              <video
                                src={media.url}
                                className="w-full h-32 object-cover"
                                controls
                                preload="metadata"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Voice Note */}
                  {checkIn.voiceNote && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Mic size={16} className="text-aqua" />
                        Voice Note
                      </h3>
                      <div className="flex items-center justify-between p-4 bg-aqua/10 rounded-lg border border-aqua/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-aqua rounded-full flex items-center justify-center">
                            <Mic size={16} className="text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-aqua">Voice Recording</div>
                            <div className="text-xs text-gray-500">{checkIn.voiceNote.duration}s</div>
                          </div>
                        </div>
                        {checkIn.voiceNote.url !== '#' && (
                          <audio controls className="max-w-[200px]">
                            <source src={checkIn.voiceNote.url} />
                            Your browser does not support the audio element.
                          </audio>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {checkIn.locationAttachment && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <MapPin size={16} className="text-aqua" />
                        Location
                      </h3>
                      <div className="p-4 bg-aqua/10 rounded-lg border border-aqua/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-aqua rounded-full flex items-center justify-center">
                            <MapPin size={16} className="text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-aqua">{checkIn.locationAttachment.name}</div>
                            {checkIn.locationAttachment.coordinates && (
                              <div className="text-xs text-gray-500">
                                {checkIn.locationAttachment.coordinates.lat.toFixed(4)}, {checkIn.locationAttachment.coordinates.lng.toFixed(4)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* File Attachments */}
                  {checkIn.fileAttachments.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Paperclip size={16} className="text-aqua" />
                        Files
                      </h3>
                      <div className="space-y-2">
                        {checkIn.fileAttachments.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="w-8 h-8 bg-aqua rounded-lg flex items-center justify-center">
                              <Paperclip size={14} className="text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{file.name}</div>
                              <div className="text-xs text-gray-500">{file.size}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {checkIn.tags.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Hash size={16} className="text-aqua" />
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {checkIn.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-aqua text-white"
                          >
                            #{tag.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons - TODO: Implement functionality */}
                  <div className="flex items-center justify-center gap-4 pt-6 border-t border-gray-100">
                    <button 
                      className="flex items-center gap-2 px-4 py-2 text-gray-400 bg-gray-50 rounded-lg cursor-not-allowed"
                      disabled
                      title="Coming soon"
                    >
                      <Heart size={16} />
                      <span className="text-sm font-medium">Like</span>
                    </button>
                    <button 
                      className="flex items-center gap-2 px-4 py-2 text-gray-400 bg-gray-50 rounded-lg cursor-not-allowed"
                      disabled
                      title="Coming soon"
                    >
                      <MessageCircle size={16} />
                      <span className="text-sm font-medium">Comment</span>
                    </button>
                    <button 
                      className="flex items-center gap-2 px-4 py-2 text-gray-400 bg-gray-50 rounded-lg cursor-not-allowed"
                      disabled
                      title="Coming soon"
                    >
                      <Share size={16} />
                      <span className="text-sm font-medium">Share</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CheckInDetailModal;