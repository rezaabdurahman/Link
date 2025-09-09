import { User, Chat, Opportunity, SocialNote, CloseFriend } from '../types';
import { CheckIn } from '../services/checkinClient';
import { PublicUser, PrivacySettings } from '../services/userClient';
import { getDisplayName } from '../utils/nameHelpers';

export const currentUser: User = {
  id: '1',
  first_name: 'Alex',
  last_name: 'Thompson',
  age: 28,
  profilePicture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
  bio: 'Love indie films, hiking, and good coffee conversations',
  interests: ['indie films', 'hiking', 'coffee', 'photography', 'travel'],
  location: {
    lat: 37.7749,
    lng: -122.4194,
    proximityMiles: 1.2
  },
  isAvailable: true,
  mutualFriends: [],
  connectionPriority: 'regular',
  lastSeen: new Date(),
  profileType: 'public'
};

export const nearbyUsers: User[] = [
  {
    id: '2',
    first_name: 'Reza',
    last_name: 'Abdurahman',
    age: 30,
    profileMedia: {
      type: 'video',
      url: '/videos/jamie-profile.mov',
      thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face',
      duration: 15
    },
    bio: 'Film enthusiast, volleyball player, coffee lover',
    interests: ['indie films', 'volleyball', 'coffee', 'books'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 0.3
    },
    isAvailable: true,
    mutualFriends: ['Sarah Wilson'],
    connectionPriority: 'want-closer',
    lastSeen: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    broadcast: 'Founder of this app ! Give me feedback',
    profileType: 'private'
  },
  {
    id: '3',
    first_name: 'Marcus',
    last_name: 'Rodriguez',
    age: 30,
    profilePicture: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop&crop=face',
    bio: 'Tech entrepreneur, rock climbing enthusiast',
    interests: ['rock climbing', 'tech', 'startups', 'hiking'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 1.2
    },
    isAvailable: true,
    mutualFriends: ['David Kim', 'Sarah Wilson'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    profileType: 'public'
  },
  {
    id: '4',
    first_name: 'Emma',
    last_name: 'Johnson',
    age: 24,
    profileMedia: {
      type: 'video',
      url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_640x360_1mb.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop&crop=face',
      duration: 12
    },
    bio: 'Artist, yoga instructor, nature lover',
    interests: ['art', 'yoga', 'nature', 'photography', 'coffee'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 0.8
    },
    isAvailable: true,
    mutualFriends: ['Lisa Park'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    broadcast: 'Hosting a sunrise yoga session in Golden Gate Park tomorrow!',
    profileType: 'public'
  },
  {
    id: '5',
    first_name: 'Anonymous',
    last_name: 'User',
    age: 27,
    profilePicture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    bio: 'Prefers to stay anonymous until we connect',
    interests: ['privacy', 'mystery', 'books', 'philosophy'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 2.1
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    profileType: 'public'
  },
  {
    id: '6',
    first_name: 'Sofia',
    last_name: 'Martinez',
    age: 29,
    profilePicture: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150&h=150&fit=crop&crop=face',
    bio: 'Interior designer, plant mom, weekend baker',
    interests: ['design', 'plants', 'baking', 'architecture'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 1.5
    },
    isAvailable: true,
    mutualFriends: ['Anna Lee'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 20 * 60 * 1000),
    broadcast: 'Anyone want to join me for weekend plant shopping at the nursery?',
    profileType: 'public'
  },
  {
    id: '7',
    first_name: 'Ryan',
    last_name: 'O\'Connor',
    age: 32,
    profilePicture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    bio: 'Software developer, musician, craft beer enthusiast',
    interests: ['coding', 'music', 'craft beer', 'gaming'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 0.9
    },
    isAvailable: true,
    mutualFriends: ['Mike Johnson'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 60 * 60 * 1000),
    profileType: 'public'
  },
  {
    id: '8',
    first_name: 'Zoe',
    last_name: 'Kim',
    age: 25,
    profileMedia: {
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1521566652839-697aa473761a?w=400&h=500&fit=crop&crop=face',
      duration: 18
    },
    bio: 'Fashion photographer, travel blogger, sushi lover',
    interests: ['photography', 'fashion', 'travel', 'sushi'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 1.8
    },
    isAvailable: true,
    mutualFriends: ['Emma Johnson', 'Lisa Park'],
    connectionPriority: 'want-closer',
    lastSeen: new Date(Date.now() - 10 * 60 * 1000),
    broadcast: 'Doing a street photography walk through Chinatown this Saturday - who wants to come?',
    profileType: 'public'
  },
  {
    id: '9',
    first_name: 'Alex',
    last_name: 'Rivera',
    age: 28,
    profilePicture: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=face',
    bio: 'Marine biologist, surfer, ocean conservation advocate',
    interests: ['surfing', 'marine biology', 'ocean conservation', 'diving'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 2.3
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 25 * 60 * 1000),
    profileType: 'public'
  },
  {
    id: '10',
    first_name: 'Maya',
    last_name: 'Patel',
    age: 26,
    profilePicture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    bio: 'Data scientist, marathon runner, chess player',
    interests: ['data science', 'running', 'chess', 'AI'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 0.7
    },
    isAvailable: true,
    mutualFriends: ['David Kim'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 35 * 60 * 1000),
    profileType: 'public'
  },
  {
    id: '11',
    first_name: 'Jordan',
    last_name: 'Taylor',
    age: 30,
    profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    bio: 'Chef, food blogger, wine connoisseur',
    interests: ['cooking', 'wine', 'food blogging', 'restaurants'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 1.4
    },
    isAvailable: true,
    mutualFriends: ['Sofia Martinez'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 40 * 60 * 1000),
    broadcast: 'Hosting a wine tasting dinner party Friday night - message me for details!',
    profileType: 'public'
  },
  {
    id: '12',
    first_name: 'Casey',
    last_name: 'Brown',
    age: 27,
    profilePicture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    bio: 'Graphic designer, skateboard enthusiast, vinyl collector',
    interests: ['graphic design', 'skateboarding', 'vinyl records', 'street art'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 1.1
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 50 * 60 * 1000),
    profileType: 'public'
  },
  {
    id: '13',
    first_name: 'Aria',
    last_name: 'Singh',
    age: 24,
    profilePicture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    bio: 'Medical student, classical violinist, tea enthusiast',
    interests: ['medicine', 'violin', 'classical music', 'tea'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 1.9
    },
    isAvailable: true,
    mutualFriends: ['Maya Patel'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 55 * 60 * 1000),
    profileType: 'public'
  },
  {
    id: '14',
    first_name: 'Sam',
    last_name: 'Cooper',
    age: 31,
    profilePicture: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face',
    bio: 'Podcast host, comedy writer, dog walker',
    interests: ['podcasting', 'comedy', 'writing', 'dogs'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 0.6
    },
    isAvailable: true,
    mutualFriends: ['Ryan O\'Connor'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 15 * 60 * 1000),
    broadcast: 'Taking my golden retriever to the dog park every morning - join us!',
    profileType: 'public'
  },
  {
    id: '15',
    first_name: 'Luna',
    last_name: 'Zhang',
    age: 28,
    profilePicture: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop&crop=face',
    bio: 'Astronomer, sci-fi writer, stargazing guide',
    interests: ['astronomy', 'sci-fi', 'writing', 'stargazing'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 2.0
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 30 * 60 * 1000),
    profileType: 'public'
  },
  {
    id: '16',
    first_name: 'River',
    last_name: 'Jackson',
    age: 26,
    profilePicture: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
    bio: 'Environmental lawyer, rock climber, zero-waste advocate',
    interests: ['environmental law', 'rock climbing', 'sustainability', 'hiking'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 1.3
    },
    isAvailable: false,
    mutualFriends: ['Alex Rivera', 'Marcus Rodriguez'],
    connectionPriority: 'want-closer',
    lastSeen: new Date(Date.now() - 65 * 60 * 1000),
    profileType: 'public'
  },
  {
    id: '17',
    first_name: 'Jane',
    last_name: 'Doe',
    age: 26,
    profilePicture: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    bio: 'Designer, coffee enthusiast, weekend hiker',
    interests: ['design', 'coffee', 'hiking', 'photography'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityMiles: 0.5
    },
    isAvailable: true,
    mutualFriends: ['Sofia Martinez'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 10 * 60 * 1000),
    profileType: 'public'
  }
];

export const chats: Chat[] = [
  {
    id: 'chat1',
    participantId: '2',
    participantName: 'Jamie Chen',
    participantAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg1',
      senderId: '2',
      receiverId: '1',
      content: "That indie film festival sounds amazing! When is it?",
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 2,
    conversationSummary: "Planning to attend indie film festival together",
    priority: 1,
    isFriend: true
  },
  {
    id: 'chat2',
    participantId: '3',
    participantName: 'Marcus Rodriguez',
    participantAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg2',
      senderId: '1',
      receiverId: '3',
      content: "Thanks for the startup event recommendation!",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 0,
    conversationSummary: "Discussed local startup events and networking",
    priority: 2,
    isFriend: true
  },
  {
    id: 'chat3',
    participantId: '4',
    participantName: 'Emma Johnson',
    participantAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg3',
      senderId: '4',
      receiverId: '1',
      content: "The yoga class was amazing! We should definitely go together next time 🧘‍♀️",
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 1,
    conversationSummary: "Shared yoga and art gallery recommendations",
    priority: 3,
    isFriend: false
  },
  {
    id: 'chat4',
    participantId: '8',
    participantName: 'Zoe Kim',
    participantAvatar: 'https://images.unsplash.com/photo-1521566652839-697aa473761a?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg4',
      senderId: '8',
      receiverId: '1',
      content: "Would love to show you some street photography spots around Chinatown!",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 0,
    conversationSummary: "Photography walk planning and camera gear discussion",
    priority: 4,
    isFriend: false
  },
  {
    id: 'chat5',
    participantId: '11',
    participantName: 'Jordan Taylor',
    participantAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg5',
      senderId: '1',
      receiverId: '11',
      content: "Your wine tasting event sounds incredible! Any spots left?",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 2,
    conversationSummary: "Wine tasting dinner party invitation and food pairing tips",
    priority: 5,
    isFriend: false
  },
  {
    id: 'chat6',
    participantId: '6',
    participantName: 'Sofia Martinez',
    participantAvatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg6',
      senderId: '6',
      receiverId: '1',
      content: "Want to come plant shopping this weekend? Found a great nursery!",
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 1,
    conversationSummary: "Weekend plant shopping plans and interior design tips",
    priority: 6,
    isFriend: true
  },
  {
    id: 'chat7',
    participantId: '7',
    participantName: 'Ryan O\'Connor',
    participantAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg7',
      senderId: '1',
      receiverId: '7',
      content: "That craft beer recommendation was spot on! Thanks!",
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 0,
    conversationSummary: "Craft beer recommendations and coding project discussion",
    priority: 7,
    isFriend: true
  },
  {
    id: 'chat8',
    participantId: '9',
    participantName: 'Alex Rivera',
    participantAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg8',
      senderId: '9',
      receiverId: '1',
      content: "Beach cleanup this Saturday - want to join us? 🌊",
      timestamp: new Date(Date.now() - 15 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 3,
    conversationSummary: "Ocean conservation activities and surfing plans",
    priority: 8,
    isFriend: false
  },
  {
    id: 'chat9',
    participantId: '10',
    participantName: 'Maya Patel',
    participantAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg9',
      senderId: '10',
      receiverId: '1',
      content: "Marathon training group meets at 6am - you in?",
      timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 0,
    conversationSummary: "Marathon training schedule and data science projects",
    priority: 9,
    isFriend: true
  },
  {
    id: 'chat10',
    participantId: '12',
    participantName: 'Casey Brown',
    participantAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg10',
      senderId: '1',
      receiverId: '12',
      content: "Your design portfolio is incredible! Any tips for beginners?",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 1,
    conversationSummary: "Graphic design tips and skateboarding meetups",
    priority: 10,
    isFriend: false
  },
  {
    id: 'chat11',
    participantId: '13',
    participantName: 'Aria Singh',
    participantAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg11',
      senderId: '13',
      receiverId: '1',
      content: "Violin recital next Friday - would love to see you there!",
      timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 2,
    conversationSummary: "Classical music performances and medical school stories",
    priority: 11,
    isFriend: true
  },
  {
    id: 'chat12',
    participantId: '14',
    participantName: 'Sam Cooper',
    participantAvatar: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg12',
      senderId: '14',
      receiverId: '1',
      content: "Dog park meetup tomorrow at 8am - bringing my golden retriever!",
      timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 0,
    conversationSummary: "Dog walking schedules and podcast collaboration ideas",
    priority: 12,
    isFriend: false
  },
  {
    id: 'chat13',
    participantId: '15',
    participantName: 'Luna Zhang',
    participantAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg13',
      senderId: '1',
      receiverId: '15',
      content: "Stargazing trip sounds amazing! When's the next clear night?",
      timestamp: new Date(Date.now() - 42 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 1,
    conversationSummary: "Astronomy observations and sci-fi book recommendations",
    priority: 13,
    isFriend: true
  },
  {
    id: 'chat14',
    participantId: '16',
    participantName: 'River Jackson',
    participantAvatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg14',
      senderId: '16',
      receiverId: '1',
      content: "Environmental law seminar this weekend - interested in joining?",
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 3,
    conversationSummary: "Environmental activism and rock climbing adventures",
    priority: 14,
    isFriend: false
  },
  {
    id: 'chat15',
    participantId: '5',
    participantName: '(anonymous)',
    participantAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    lastMessage: {
      id: 'msg15',
      senderId: '5',
      receiverId: '1',
      content: "Philosophy discussion group meets Thursdays - you should come!",
      timestamp: new Date(Date.now() - 54 * 60 * 60 * 1000),
      type: 'text'
    },
    unreadCount: 0,
    conversationSummary: "Philosophy discussions and book club recommendations",
    priority: 15,
    isFriend: false
  }
];


export const opportunities: Opportunity[] = [
  {
    id: 'opp1',
    type: 'ai-suggestion',
    title: 'Coffee catch-up with Jamie',
    description: "Jamie mentioned loving coffee and you both haven't met in person yet. Perfect time for a casual meetup!",
    suggestedFriends: ['2'],
    activityType: 'lunch',
    location: 'Mission District'
  },
  {
    id: 'opp2',
    type: 'reminder',
    title: "It's been 6 weeks since you talked to Marcus",
    description: "You both have Saturday free. Here are some events you might enjoy together.",
    suggestedFriends: ['3'],
    activityType: 'event',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
  },
  {
    id: 'opp3',
    type: 'seasonal',
    title: 'Weekend farmers market visit',
    description: 'Perfect weather for exploring the local farmers market with friends who love fresh produce',
    suggestedFriends: ['2', '4'],
    activityType: 'other',
    location: 'Ferry Building Marketplace'
  }
];

// Friends list - users that are friends with current user based on chat.isFriend
export const friends: User[] = nearbyUsers.filter(user => {
  const chat = chats.find(c => c.participantId === user.id);
  return chat?.isFriend === true;
});

// Mock privacy settings for API-compatible friends
const defaultPrivacySettings: PrivacySettings = {
  show_age: true,
  show_location: true,
  show_mutual_friends: true,
  show_name: true,
  show_social_media: true,
  show_montages: true,
  show_checkins: true,
};

// API-compatible friends data (matches PublicUser interface)
export const apiFriends: PublicUser[] = [
  {
    id: '2',
    email: 'reza@link.app',
    username: 'rezaabdurahman',
    first_name: 'Reza',
    last_name: 'Abdurahman',
    date_of_birth: '1993-03-15',
    profile_picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face',
    bio: 'Film enthusiast, volleyball player, coffee lover. Founder of this app! Give me feedback.',
    location: 'San Francisco, CA',
    interests: ['indie films', 'volleyball', 'coffee', 'books', 'startups'],
    social_links: [
      { platform: 'twitter', url: 'https://twitter.com/rezaabdurahman', username: 'rezaabdurahman' }
    ],
    additional_photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&crop=face'
    ],
    privacy_settings: defaultPrivacySettings,
    email_verified: true,
    created_at: '2023-01-15T08:00:00Z',
    updated_at: '2024-12-20T10:30:00Z',
    profile_visibility: 'public' as const,
    is_friend: true,
    mutual_friends_count: 5,
    last_active: '2024-12-20T09:45:00Z',
  },
  {
    id: '3',
    email: 'marcus@example.com',
    username: 'marcusrodriguez',
    first_name: 'Marcus',
    last_name: 'Rodriguez',
    date_of_birth: '1993-08-22',
    profile_picture: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop&crop=face',
    bio: 'Tech entrepreneur, rock climbing enthusiast',
    location: 'Oakland, CA',
    interests: ['rock climbing', 'tech', 'startups', 'hiking'],
    social_links: [
      { platform: 'linkedin', url: 'https://linkedin.com/in/marcusrodriguez', username: 'marcusrodriguez' }
    ],
    additional_photos: [],
    privacy_settings: defaultPrivacySettings,
    email_verified: true,
    created_at: '2023-02-10T12:00:00Z',
    updated_at: '2024-12-19T16:15:00Z',
    profile_visibility: 'public' as const,
    is_friend: true,
    mutual_friends_count: 3,
    last_active: '2024-12-19T18:20:00Z',
  },
  {
    id: '4',
    email: 'emma@example.com',
    username: 'emmajohnson',
    first_name: 'Emma',
    last_name: 'Johnson',
    date_of_birth: '1999-11-05',
    profile_picture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop&crop=face',
    bio: 'Artist, yoga instructor, nature lover',
    location: 'Berkeley, CA',
    interests: ['art', 'yoga', 'nature', 'photography', 'coffee'],
    social_links: [
      { platform: 'instagram', url: 'https://instagram.com/emmajohnsonart', username: 'emmajohnsonart' }
    ],
    additional_photos: [
      'https://images.unsplash.com/photo-1494790108755-2616c96d3380?w=400&h=500&fit=crop&crop=face'
    ],
    privacy_settings: defaultPrivacySettings,
    email_verified: true,
    created_at: '2023-03-20T14:30:00Z',
    updated_at: '2024-12-18T11:45:00Z',
    profile_visibility: 'public' as const,
    is_friend: true,
    mutual_friends_count: 2,
    last_active: '2024-12-18T20:10:00Z',
  },
  {
    id: '5',
    email: 'david@example.com',
    username: 'davidkim',
    first_name: 'David',
    last_name: 'Kim',
    date_of_birth: '1995-06-18',
    profile_picture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    bio: 'Software engineer, musician, cat lover',
    location: 'Palo Alto, CA',
    interests: ['programming', 'music', 'cats', 'gaming'],
    social_links: [
      { platform: 'github', url: 'https://github.com/davidkim', username: 'davidkim' }
    ],
    additional_photos: [],
    privacy_settings: defaultPrivacySettings,
    email_verified: true,
    created_at: '2023-04-12T09:15:00Z',
    updated_at: '2024-12-17T13:22:00Z',
    profile_visibility: 'private' as const,
    is_friend: true,
    mutual_friends_count: 4,
    last_active: '2024-12-17T19:35:00Z',
  }
];

// Close friends - subset of friends using the API-compatible format
export const closeFriends: CloseFriend[] = [
  { userId: '2', addedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Reza - added 1 week ago
  { userId: '3', addedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, // Marcus - added 2 weeks ago
];

// API-compatible close friends list (what the API would return)
export const apiCloseFriends: PublicUser[] = apiFriends.filter(friend => 
  closeFriends.some(cf => cf.userId === friend.id)
);

// Social notes about friends
export const socialNotes: SocialNote[] = [
  {
    id: 'note1',
    friendId: '2',
    text: 'Reza loves discussing indie films, especially European cinema. Has a passion for volleyball and plays every Tuesday. Owns the app we\'re using - very entrepreneurial mindset.',
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'note2',
    friendId: '2',
    text: 'Mentioned wanting feedback on the app. Should ask him about new features and user experience.',
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'note3',
    friendId: '3',
    text: 'Marcus is really into rock climbing and runs a tech startup. Good connection for networking events. Always has interesting insights about the startup ecosystem.',
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'note4',
    friendId: '6',
    text: 'Sofia has amazing taste in interior design. Could collaborate on home projects. Loves plants and baking - always brings homemade treats to gatherings.',
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'note5',
    friendId: '7',
    text: 'Ryan is incredibly knowledgeable about craft beer. Great musician - plays guitar in a local band. Works as a software developer but passionate about music.',
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'note6',
    friendId: '9',
    text: 'Maya is training for a marathon - very disciplined with her running schedule. Data scientist with expertise in AI. Great chess player.',
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'note7',
    friendId: '11',
    text: 'Aria is a medical student and talented violinist. Has sophisticated taste in classical music. Loves trying different types of tea.',
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'note8',
    friendId: '13',
    text: 'Luna has incredible knowledge about astronomy and writes sci-fi stories. Great stargazing guide - knows all the best spots around the city.',
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
  }
];

// Helper function to generate AI summary of notes for a friend
export const generateAISummary = (friendId: string): string => {
  const friendNotes = socialNotes.filter(note => note.friendId === friendId);
  const friend = friends.find(f => f.id === friendId);
  
  if (!friend || friendNotes.length === 0) {
    return `No notes available for ${friend ? getDisplayName(friend) : 'this friend'} yet.`;
  }
  
  // Mock AI-generated summaries based on the notes
  const summaries: { [key: string]: string } = {
    '2': 'Reza is the entrepreneurial founder with a passion for indie films and volleyball. Currently seeking user feedback for app improvements.',
    '3': 'Marcus is a tech entrepreneur and rock climbing enthusiast. Great networking contact with valuable startup insights.',
    '6': 'Sofia is a creative interior designer who loves plants and baking. Known for bringing homemade treats and having excellent design taste.',
    '7': 'Ryan is a multitalented software developer and musician with deep knowledge of craft beer. Plays guitar in a local band.',
    '9': 'Maya is a disciplined marathon runner and AI-focused data scientist. Also skilled at chess with a structured approach to challenges.',
    '11': 'Aria balances medical studies with classical violin performance. Has refined taste in music and enjoys exploring different teas.',
    '13': 'Luna combines astronomical expertise with sci-fi writing. Excellent stargazing guide who knows the best observation spots in the city.'
  };
  
  return summaries[friendId] || `${getDisplayName(friend)} is an interesting person with diverse interests and experiences.`;
};

// Mock check-in data
export const mockCheckIns: CheckIn[] = [
  {
    id: '1',
    user_id: '1', // Alex Thompson (current user)
    text_content: 'Perfect morning for a hike in Golden Gate Park! The fog is finally lifting 🌤️',
    privacy: 'public',
    media_attachments: [
      {
        id: 'media_1',
        media_type: 'image',
        file_name: 'golden_gate_hike.jpg',
        file_url: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=500&h=300&fit=crop',
        thumbnail_url: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=150&h=150&fit=crop',
        file_size: 245760,
        mime_type: 'image/jpeg'
      }
    ],
    location: {
      id: 'loc_1',
      location_name: 'Golden Gate Park',
      latitude: 37.7694,
      longitude: -122.4862,
      address: 'Golden Gate Park, San Francisco, CA'
    },
    tags: [
      { id: 'tag_1', tag_name: 'hiking' },
      { id: 'tag_2', tag_name: 'nature' },
      { id: 'tag_3', tag_name: 'sf' }
    ],
    file_attachments: [],
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    user_id: '2', // Reza
    text_content: 'Just launched a new feature! Coffee-fueled coding session paying off ☕️',
    privacy: 'public',
    media_attachments: [
      {
        id: 'media_2',
        media_type: 'image',
        file_name: 'coding_setup.jpg',
        file_url: 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=500&h=300&fit=crop',
        thumbnail_url: 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=150&h=150&fit=crop',
        file_size: 189432,
        mime_type: 'image/jpeg'
      }
    ],
    location: {
      id: 'loc_2', 
      location_name: 'Blue Bottle Coffee',
      latitude: 37.7849,
      longitude: -122.4094,
      address: '66 Mint St, San Francisco, CA 94103'
    },
    tags: [
      { id: 'tag_4', tag_name: 'coding' },
      { id: 'tag_5', tag_name: 'coffee' },
      { id: 'tag_6', tag_name: 'startup' }
    ],
    file_attachments: [],
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    user_id: '3', // Marcus
    text_content: 'Conquered this route today! The view from the top was absolutely worth it 🧗‍♂️',
    privacy: 'friends',
    media_attachments: [
      {
        id: 'media_3',
        media_type: 'video',
        file_name: 'climbing_video.mp4',
        file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=150&h=150&fit=crop',
        file_size: 1248576,
        duration_seconds: 45,
        mime_type: 'video/mp4'
      }
    ],
    location: {
      id: 'loc_3',
      location_name: 'Mission Cliffs',
      latitude: 37.7599,
      longitude: -122.4148,
      address: '2295 Harrison St, San Francisco, CA 94110'
    },
    tags: [
      { id: 'tag_7', tag_name: 'climbing' },
      { id: 'tag_8', tag_name: 'fitness' },
      { id: 'tag_9', tag_name: 'achievement' }
    ],
    file_attachments: [],
    voice_note: {
      id: 'voice_1',
      file_name: 'post_climb_thoughts.wav',
      file_url: '/audio/post_climb_thoughts.wav',
      duration_seconds: 30,
      file_size: 480000
    },
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '4',
    user_id: '6', // Sofia
    text_content: 'New plant babies arrived today! My apartment is turning into a jungle and I love it 🌱',
    privacy: 'public',
    media_attachments: [
      {
        id: 'media_4',
        media_type: 'image',
        file_name: 'new_plants.jpg',
        file_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=500&h=300&fit=crop',
        thumbnail_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=150&h=150&fit=crop',
        file_size: 334856,
        mime_type: 'image/jpeg'
      }
    ],
    tags: [
      { id: 'tag_10', tag_name: 'plants' },
      { id: 'tag_11', tag_name: 'home' },
      { id: 'tag_12', tag_name: 'green' }
    ],
    file_attachments: [],
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    updated_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '5',
    user_id: '1', // Alex Thompson
    text_content: 'Just watched an incredible indie film at the Castro Theatre. The cinematography was stunning!',
    privacy: 'public',
    media_attachments: [],
    location: {
      id: 'loc_4',
      location_name: 'Castro Theatre',
      latitude: 37.7609,
      longitude: -122.4350,
      address: '429 Castro St, San Francisco, CA 94114'
    },
    tags: [
      { id: 'tag_13', tag_name: 'film' },
      { id: 'tag_14', tag_name: 'indie' },
      { id: 'tag_15', tag_name: 'castro' }
    ],
    file_attachments: [
      {
        id: 'file_1',
        file_name: 'movie_ticket.pdf',
        file_url: '/files/movie_ticket.pdf',
        file_size: 45632,
        mime_type: 'application/pdf'
      }
    ],
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  }
];

// Helper function to get user's check-ins
export const getUserCheckIns = (userId: string): CheckIn[] => {
  return mockCheckIns.filter(checkIn => checkIn.user_id === userId);
};

// Helper function to get public check-ins for discovery
export const getPublicCheckIns = (): CheckIn[] => {
  return mockCheckIns.filter(checkIn => checkIn.privacy === 'public');
};
