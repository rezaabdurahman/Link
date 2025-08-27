import { CheckIn } from '../types/checkin';
import { CheckIn as BackendCheckIn, Source } from '../services/checkinClient';

/**
 * Convert a backend check-in response to frontend format
 * This utility ensures consistent data transformation across components
 */
export const convertBackendCheckInToFrontend = (backendCheckIn: BackendCheckIn): CheckIn => {
  return {
    id: backendCheckIn.id,
    text: backendCheckIn.text_content || '',
    mediaAttachments: backendCheckIn.media_attachments.map(media => ({
      id: media.id,
      type: media.media_type,
      url: media.file_url,
      name: media.file_name,
    })),
    fileAttachments: backendCheckIn.file_attachments.map(file => ({
      id: file.id,
      name: file.file_name,
      size: file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'Unknown size',
      type: file.mime_type || 'application/octet-stream',
    })),
    voiceNote: backendCheckIn.voice_note ? {
      id: backendCheckIn.voice_note.id,
      duration: backendCheckIn.voice_note.duration_seconds,
      url: backendCheckIn.voice_note.file_url,
    } : null,
    locationAttachment: backendCheckIn.location ? {
      id: backendCheckIn.location.id,
      name: backendCheckIn.location.location_name || 'Location',
      coordinates: {
        lat: backendCheckIn.location.latitude,
        lng: backendCheckIn.location.longitude,
      },
    } : null,
    tags: backendCheckIn.tags.map(tag => ({
      id: tag.id,
      label: tag.tag_name,
      type: 'manual' as const,
      color: '#14b8a6',
    })),
    privacy: backendCheckIn.privacy,
    source: backendCheckIn.source || 'manual',
    source_metadata: backendCheckIn.source_metadata,
    timestamp: new Date(backendCheckIn.created_at),
  };
};

/**
 * Convert multiple backend check-ins to frontend format
 */
export const convertBackendCheckInsToFrontend = (backendCheckIns: BackendCheckIn[]): CheckIn[] => {
  return backendCheckIns.map(convertBackendCheckInToFrontend);
};

// Extended CheckIn interface used in ProfileDetailModal
export interface ExtendedCheckIn extends CheckIn {
  source?: Source;
  instagramData?: {
    username: string;
    profilePicture: string;
    likes: number;
    imageUrl: string;
    caption: string;
    hashtags: string[];
  };
}

/**
 * Convert a backend check-in response to ExtendedCheckIn format used in ProfileDetailModal
 */
export const convertBackendCheckInToExtended = (backendCheckIn: BackendCheckIn): ExtendedCheckIn => {
  const baseCheckIn = convertBackendCheckInToFrontend(backendCheckIn);
  
  // Build Instagram-specific data from source metadata if available
  let instagramData;
  if (backendCheckIn.source === 'instagram' && backendCheckIn.source_metadata) {
    const metadata = backendCheckIn.source_metadata;
    instagramData = {
      username: metadata.username || backendCheckIn.source_username || '',
      profilePicture: metadata.profile_picture || '',
      likes: metadata.likes_count || 0,
      imageUrl: backendCheckIn.media_attachments[0]?.file_url || '',
      caption: metadata.caption || backendCheckIn.text_content || '',
      hashtags: metadata.hashtags || []
    };
  }
  
  return {
    ...baseCheckIn,
    source: backendCheckIn.source || 'manual',
    instagramData
  };
};