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
    icon: 'instagram',
    connected: true,
    username: '@johndoe',
    importEnabled: true
  },
  {
    id: 'x',
    provider: 'x',
    name: 'X (Twitter)',
    icon: 'twitter',
    connected: false
  },
  {
    id: 'facebook',
    provider: 'facebook',
    name: 'Facebook',
    icon: 'facebook',
    connected: true,
    username: 'John Doe',
    importEnabled: false
  },
  {
    id: 'spotify',
    provider: 'spotify',
    name: 'Spotify',
    icon: 'spotify',
    connected: true,
    username: 'john.doe',
    importEnabled: true
  },
  {
    id: 'linkedin',
    provider: 'linkedin',
    name: 'LinkedIn',
    icon: 'linkedin',
    connected: false
  },
  {
    id: 'tiktok',
    provider: 'tiktok',
    name: 'TikTok',
    icon: 'tiktok',
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
