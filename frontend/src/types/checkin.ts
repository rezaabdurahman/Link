export interface MediaAttachment {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  file?: File;
}

export interface FileAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  file?: File;
}

export interface VoiceNote {
  id: string;
  duration: number;
  url: string;
}

export interface LocationAttachment {
  id: string;
  name: string;
  coordinates?: { lat: number; lng: number };
}

export interface Tag {
  id: string;
  label: string;
  type: 'manual' | 'ai';
  confidence?: number; // For AI tags
  color?: string;
}

export interface CheckIn {
  id: string;
  text: string;
  mediaAttachments: MediaAttachment[];
  fileAttachments: FileAttachment[];
  voiceNote: VoiceNote | null;
  locationAttachment: LocationAttachment | null;
  tags: Tag[];
  aiSuggestionsPending?: boolean;
  aiSuggestions?: Tag[];
  timestamp: Date;
  editMode?: boolean;
}

export interface SocialAccount {
  id: string;
  provider: 'instagram' | 'x' | 'facebook' | 'spotify' | 'linkedin' | 'tiktok';
  name: string;
  icon: string;
  connected: boolean;
  username?: string;
  importEnabled?: boolean;
}

export interface Opportunity {
  id: string;
  type: 'event' | 'person' | 'activity' | 'place';
  title: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected';
  actionLabel?: string;
  details?: {
    date?: string;
    location?: string;
    personName?: string;
    activity?: string;
  };
}

export interface CheckinState {
  checkIns: CheckIn[];
  opportunities: Opportunity[];
  socialAccounts: SocialAccount[];
  isLoading: boolean;
}

export type CheckinAction = 
  | { type: 'ADD_CHECKIN'; payload: CheckIn }
  | { type: 'UPDATE_CHECKIN'; payload: { id: string; updates: Partial<CheckIn> } }
  | { type: 'DELETE_CHECKIN'; payload: string }
  | { type: 'ADD_AI_SUGGESTIONS'; payload: { checkinId: string; suggestions: Tag[] } }
  | { type: 'ACCEPT_TAG'; payload: { checkinId: string; tagId: string } }
  | { type: 'REJECT_TAG'; payload: { checkinId: string; tagId: string } }
  | { type: 'UPDATE_OPPORTUNITY'; payload: { id: string; status: 'accepted' | 'rejected' } }
  | { type: 'REFRESH_OPPORTUNITIES'; payload: Opportunity[] }
  | { type: 'UPDATE_SOCIAL_ACCOUNT'; payload: { id: string; updates: Partial<SocialAccount> } }
  | { type: 'SET_LOADING'; payload: boolean };
