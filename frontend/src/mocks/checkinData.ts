import { CheckIn, SocialAccount, Opportunity, Tag } from '../types/checkin';

// Common tag suggestions for auto-complete
export const COMMON_TAGS = [
  'coffee', 'work', 'travel', 'food', 'workout', 'friends', 'family', 'weekend',
  'nature', 'city', 'beach', 'hiking', 'reading', 'music', 'art', 'gaming',
  'studying', 'shopping', 'cooking', 'movie', 'concert', 'party', 'celebration',
  'mindfulness', 'productivity', 'learning', 'creative', 'adventure', 'relaxing'
];

// AI tag suggestions based on content
export const generateAISuggestions = (text: string, hasLocation: boolean, hasMedia: boolean): Tag[] => {
  const suggestions: Tag[] = [];
  
  // Activity-based suggestions
  if (text.toLowerCase().includes('coffee') || text.toLowerCase().includes('café')) {
    suggestions.push(createAITag('coffee', 0.95));
  }
  if (text.toLowerCase().includes('work') || text.toLowerCase().includes('office')) {
    suggestions.push(createAITag('productivity', 0.88));
  }
  if (text.toLowerCase().includes('gym') || text.toLowerCase().includes('workout')) {
    suggestions.push(createAITag('fitness', 0.92));
  }
  if (text.toLowerCase().includes('beach') || text.toLowerCase().includes('ocean')) {
    suggestions.push(createAITag('beach', 0.96));
  }
  if (text.toLowerCase().includes('food') || text.toLowerCase().includes('restaurant')) {
    suggestions.push(createAITag('dining', 0.89));
  }

  // Mood-based suggestions
  if (text.includes('!') || text.toLowerCase().includes('excited') || text.toLowerCase().includes('amazing')) {
    suggestions.push(createAITag('excited', 0.82));
  }
  if (text.toLowerCase().includes('peaceful') || text.toLowerCase().includes('calm')) {
    suggestions.push(createAITag('mindfulness', 0.85));
  }
  if (text.toLowerCase().includes('tired') || text.toLowerCase().includes('exhausted')) {
    suggestions.push(createAITag('tired', 0.78));
  }

  // Context-based suggestions
  if (hasLocation) {
    suggestions.push(createAITag('location-shared', 0.94));
  }
  if (hasMedia) {
    suggestions.push(createAITag('photo-moment', 0.91));
  }

  // Time-based suggestions
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) {
    suggestions.push(createAITag('morning', 0.87));
  } else if (hour >= 17 && hour < 21) {
    suggestions.push(createAITag('evening', 0.84));
  }

  return suggestions.slice(0, 4); // Limit to 4 suggestions
};

const createAITag = (label: string, confidence: number): Tag => ({
  id: `ai-${label}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
  label,
  type: 'ai',
  confidence,
  color: getTagColor(label)
});

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

// Mock historical check-ins
export const generateMockCheckIns = (): CheckIn[] => {
  const mockTexts = [
    "Great coffee meeting with the team this morning! Planning some exciting projects 🚀",
    "Beautiful sunset walk by the beach. Sometimes you need to slow down and appreciate the moment.",
    "Productive workout session at the gym. Feeling energized for the week ahead!",
    "Exploring this new restaurant downtown. The pasta here is incredible!",
    "Weekend coding session with some good music. Making progress on my side project.",
  ];

  return mockTexts.map((text, index) => ({
    id: `mock-checkin-${index}`,
    text,
    mediaAttachments: index % 3 === 0 ? [createMockMediaAttachment()] : [],
    fileAttachments: [],
    voiceNote: null,
    locationAttachment: index % 4 === 0 ? createMockLocation() : null,
    tags: generateMockTags(text, 2 + Math.floor(Math.random() * 3)),
    timestamp: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000 - Math.random() * 12 * 60 * 60 * 1000)
  }));
};

const createMockMediaAttachment = () => ({
  id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
  type: 'image' as const,
  url: `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
  name: 'photo.jpg'
});

const createMockLocation = () => ({
  id: `location-${Date.now()}`,
  name: ['Downtown Café', 'Sunset Beach', 'City Gym', 'Central Park', 'Local Library'][Math.floor(Math.random() * 5)],
  coordinates: { lat: 37.7749 + (Math.random() - 0.5) * 0.1, lng: -122.4194 + (Math.random() - 0.5) * 0.1 }
});

const generateMockTags = (text: string, count: number): Tag[] => {
  const relevantTags = COMMON_TAGS.filter(tag => 
    text.toLowerCase().includes(tag) || Math.random() < 0.3
  ).slice(0, count);
  
  return relevantTags.map(tag => ({
    id: `tag-${tag}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    label: tag,
    type: 'manual' as const,
    color: getTagColor(tag)
  }));
};

// Mock social accounts with brand logos
export const generateMockSocialAccounts = (): SocialAccount[] => [
  {
    id: 'instagram',
    provider: 'instagram',
    name: 'Instagram',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    connected: true,
    username: '@johndoe',
    importEnabled: true
  },
  {
    id: 'x',
    provider: 'x',
    name: 'X (Twitter)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    connected: false
  },
  {
    id: 'facebook',
    provider: 'facebook',
    name: 'Facebook',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    connected: true,
    username: 'John Doe',
    importEnabled: false
  },
  {
    id: 'spotify',
    provider: 'spotify',
    name: 'Spotify',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    ),
    connected: true,
    username: 'john.doe',
    importEnabled: true
  },
  {
    id: 'linkedin',
    provider: 'linkedin',
    name: 'LinkedIn',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    connected: false
  },
  {
    id: 'tiktok',
    provider: 'tiktok',
    name: 'TikTok',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
    connected: false
  }
];

// Mock opportunities
export const generateMockOpportunities = (): Opportunity[] => [
  {
    id: 'opp-1',
    type: 'event',
    title: 'Coffee Meetup',
    description: 'Sarah from your network is also into specialty coffee. Want to grab coffee together?',
    status: 'pending',
    actionLabel: 'Invite',
    details: {
      date: 'Tomorrow at 2:00 PM',
      location: 'Blue Bottle Coffee',
      personName: 'Sarah'
    }
  },
  {
    id: 'opp-2',
    type: 'activity',
    title: 'Beach Volleyball',
    description: 'There\'s a casual beach volleyball game this weekend near your recent beach check-in.',
    status: 'pending',
    actionLabel: 'Join',
    details: {
      date: 'Saturday at 10:00 AM',
      location: 'Sunset Beach',
      activity: 'Beach Volleyball'
    }
  },
  {
    id: 'opp-3',
    type: 'person',
    title: 'Reconnect with Mike',
    description: 'Mike posted about working out lately. You both seem to be into fitness!',
    status: 'pending',
    actionLabel: 'Message',
    details: {
      personName: 'Mike Thompson',
      activity: 'Fitness'
    }
  }
];

// Generate fresh opportunities based on latest check-in
export const generateOpportunitiesFromCheckin = (checkin: CheckIn): Opportunity[] => {
  const opportunities: Opportunity[] = [];
  const tags = checkin.tags.map(t => t.label.toLowerCase());
  
  if (tags.includes('coffee') || checkin.text.toLowerCase().includes('coffee')) {
    opportunities.push({
      id: `opp-coffee-${Date.now()}`,
      type: 'person',
      title: 'Coffee Connection',
      description: 'Emma also loves coffee and checked in at a café nearby recently.',
      status: 'pending',
      actionLabel: 'Connect',
      details: { personName: 'Emma', activity: 'Coffee' }
    });
  }
  
  if (tags.includes('workout') || tags.includes('gym') || tags.includes('fitness')) {
    opportunities.push({
      id: `opp-fitness-${Date.now()}`,
      type: 'activity',
      title: 'Group Workout',
      description: 'Join a fitness group meeting this week - perfect for your workout goals!',
      status: 'pending',
      actionLabel: 'Join',
      details: { date: 'Thursday at 7:00 AM', activity: 'Group Fitness' }
    });
  }
  
  if (checkin.locationAttachment) {
    opportunities.push({
      id: `opp-location-${Date.now()}`,
      type: 'place',
      title: 'Nearby Event',
      description: 'There\'s an interesting event happening close to your recent location.',
      status: 'pending',
      actionLabel: 'Explore',
      details: { location: checkin.locationAttachment.name, date: 'This weekend' }
    });
  }
  
  return opportunities.slice(0, 2); // Return max 2 new opportunities
};
