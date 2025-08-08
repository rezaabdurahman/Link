import { User, Chat, Story, Opportunity } from '../types';

export const currentUser: User = {
  id: '1',
  name: 'Alex Thompson',
  age: 28,
  profilePicture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  bio: 'Love indie films, hiking, and good coffee conversations',
  interests: ['indie films', 'hiking', 'coffee', 'photography', 'travel'],
  location: {
    lat: 37.7749,
    lng: -122.4194,
    proximityKm: 2
  },
  isAvailable: true,
  mutualFriends: [],
  connectionPriority: 'regular',
  lastSeen: new Date()
};

export const nearbyUsers: User[] = [
  {
    id: '2',
    name: 'Jamie Chen',
    age: 26,
    profilePicture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    bio: 'Film enthusiast, volleyball player, coffee lover',
    interests: ['indie films', 'volleyball', 'coffee', 'books'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 0.5
    },
    isAvailable: true,
    mutualFriends: ['Sarah Wilson'],
    connectionPriority: 'want-closer',
    lastSeen: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    broadcast: 'Looking for someone to join me for the indie film festival this weekend!'
  },
  {
    id: '3',
    name: 'Marcus Rodriguez',
    age: 30,
    profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    bio: 'Tech entrepreneur, rock climbing enthusiast',
    interests: ['rock climbing', 'tech', 'startups', 'hiking'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 1.2
    },
    isAvailable: false,
    mutualFriends: ['David Kim', 'Sarah Wilson'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
  },
  {
    id: '4',
    name: 'Emma Johnson',
    age: 24,
    profilePicture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    bio: 'Artist, yoga instructor, nature lover',
    interests: ['art', 'yoga', 'nature', 'photography', 'coffee'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 0.8
    },
    isAvailable: true,
    mutualFriends: ['Lisa Park'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    broadcast: 'Hosting a sunrise yoga session in Golden Gate Park tomorrow!'
  },
  {
    id: '5',
    name: '(anonymous)',
    age: 27,
    profilePicture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
    bio: 'Prefers to stay anonymous until we connect',
    interests: ['privacy', 'mystery', 'books', 'philosophy'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 2.1
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 45 * 60 * 1000) // 45 minutes ago
  },
  {
    id: '6',
    name: 'Sofia Martinez',
    age: 29,
    profilePicture: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&h=150&fit=crop&crop=face',
    bio: 'Interior designer, plant mom, weekend baker',
    interests: ['design', 'plants', 'baking', 'architecture'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 1.5
    },
    isAvailable: true,
    mutualFriends: ['Anna Lee'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 20 * 60 * 1000),
    broadcast: 'Anyone want to join me for weekend plant shopping at the nursery?'
  },
  {
    id: '7',
    name: 'Ryan O\'Connor',
    age: 32,
    profilePicture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    bio: 'Software developer, musician, craft beer enthusiast',
    interests: ['coding', 'music', 'craft beer', 'gaming'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 0.9
    },
    isAvailable: false,
    mutualFriends: ['Mike Johnson'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 60 * 60 * 1000)
  },
  {
    id: '8',
    name: 'Zoe Kim',
    age: 25,
    profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    bio: 'Fashion photographer, travel blogger, sushi lover',
    interests: ['photography', 'fashion', 'travel', 'sushi'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 1.8
    },
    isAvailable: true,
    mutualFriends: ['Emma Johnson', 'Lisa Park'],
    connectionPriority: 'want-closer',
    lastSeen: new Date(Date.now() - 10 * 60 * 1000),
    broadcast: 'Doing a street photography walk through Chinatown this Saturday - who wants to come?'
  },
  {
    id: '9',
    name: 'Alex Rivera',
    age: 28,
    profilePicture: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face',
    bio: 'Marine biologist, surfer, ocean conservation advocate',
    interests: ['surfing', 'marine biology', 'ocean conservation', 'diving'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 2.3
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 25 * 60 * 1000)
  },
  {
    id: '10',
    name: 'Maya Patel',
    age: 26,
    profilePicture: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop&crop=face',
    bio: 'Data scientist, marathon runner, chess player',
    interests: ['data science', 'running', 'chess', 'AI'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 0.7
    },
    isAvailable: false,
    mutualFriends: ['David Kim'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 35 * 60 * 1000)
  },
  {
    id: '11',
    name: 'Jordan Taylor',
    age: 30,
    profilePicture: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=face',
    bio: 'Chef, food blogger, wine connoisseur',
    interests: ['cooking', 'wine', 'food blogging', 'restaurants'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 1.4
    },
    isAvailable: true,
    mutualFriends: ['Sofia Martinez'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 40 * 60 * 1000),
    broadcast: 'Hosting a wine tasting dinner party Friday night - message me for details!'
  },
  {
    id: '12',
    name: 'Casey Brown',
    age: 27,
    profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    bio: 'Graphic designer, skateboard enthusiast, vinyl collector',
    interests: ['graphic design', 'skateboarding', 'vinyl records', 'street art'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 1.1
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 50 * 60 * 1000)
  },
  {
    id: '13',
    name: 'Aria Singh',
    age: 24,
    profilePicture: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face',
    bio: 'Medical student, classical violinist, tea enthusiast',
    interests: ['medicine', 'violin', 'classical music', 'tea'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 1.9
    },
    isAvailable: false,
    mutualFriends: ['Maya Patel'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 55 * 60 * 1000)
  },
  {
    id: '14',
    name: 'Sam Cooper',
    age: 31,
    profilePicture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    bio: 'Podcast host, comedy writer, dog walker',
    interests: ['podcasting', 'comedy', 'writing', 'dogs'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 0.6
    },
    isAvailable: true,
    mutualFriends: ['Ryan O\'Connor'],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 15 * 60 * 1000),
    broadcast: 'Taking my golden retriever to the dog park every morning - join us!'
  },
  {
    id: '15',
    name: 'Luna Zhang',
    age: 28,
    profilePicture: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
    bio: 'Astronomer, sci-fi writer, stargazing guide',
    interests: ['astronomy', 'sci-fi', 'writing', 'stargazing'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 2.0
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(Date.now() - 30 * 60 * 1000)
  },
  {
    id: '16',
    name: 'River Jackson',
    age: 26,
    profilePicture: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face',
    bio: 'Environmental lawyer, rock climber, zero-waste advocate',
    interests: ['environmental law', 'rock climbing', 'sustainability', 'hiking'],
    location: {
      lat: 37.7749,
      lng: -122.4194,
      proximityKm: 1.3
    },
    isAvailable: false,
    mutualFriends: ['Alex Rivera', 'Marcus Rodriguez'],
    connectionPriority: 'want-closer',
    lastSeen: new Date(Date.now() - 65 * 60 * 1000)
  }
];

export const chats: Chat[] = [
  {
    id: 'chat1',
    participantId: '2',
    participantName: 'Jamie Chen',
    participantAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
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
    priority: 1
  },
  {
    id: 'chat2',
    participantId: '3',
    participantName: 'Marcus Rodriguez',
    participantAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
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
    priority: 2
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
    priority: 3
  }
];

export const stories: Story[] = [
  {
    id: 'story1',
    userId: '2',
    content: "Just discovered this amazing coffee shop in the Mission District! The indie vibes are perfect for afternoon writing sessions ☕️📚",
    media: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'],
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    viewers: ['1']
  },
  {
    id: 'story2',
    userId: '4',
    content: "Yoga session in Golden Gate Park this morning was incredible! Nothing beats outdoor practice 🧘‍♀️🌳",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    viewers: []
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
