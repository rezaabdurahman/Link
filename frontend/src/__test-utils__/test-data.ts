// Standardized test data factories
import { User, Chat, Opportunity, SocialNote, CloseFriend } from '../types';
import { CheckIn } from '../services/checkinClient';

/**
 * Create a mock user for testing
 */
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-1',
  first_name: 'Test',
  last_name: 'User',
  age: 28,
  profilePicture: 'https://example.com/avatar.jpg',
  bio: 'Test bio for user',
  interests: ['technology', 'music'],
  location: {
    lat: 37.7749,
    lng: -122.4194,
    proximityMiles: 1.0
  },
  isAvailable: true,
  mutualFriends: [],
  connectionPriority: 'regular',
  lastSeen: new Date(),
  profileType: 'public',
  ...overrides
});

/**
 * Create a mock chat for testing
 */
export const createMockChat = (overrides: Partial<Chat> = {}): Chat => ({
  id: 'test-chat-1',
  participantId: 'test-user-2',
  participantName: 'Test Participant',
  participantAvatar: 'https://example.com/avatar.jpg',
  lastMessage: {
    id: 'test-msg-1',
    senderId: 'test-user-2',
    receiverId: 'test-user-1',
    content: 'Test message',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    type: 'text'
  },
  unreadCount: 0,
  conversationSummary: 'Test conversation summary',
  priority: 1,
  isFriend: false,
  ...overrides
});

/**
 * Create a mock opportunity for testing
 */
export const createMockOpportunity = (overrides: Partial<Opportunity> = {}): Opportunity => ({
  id: 'test-opp-1',
  type: 'ai-suggestion',
  title: 'Test Opportunity',
  description: 'Test opportunity description',
  suggestedFriends: ['test-user-2'],
  activityType: 'lunch',
  location: 'Test Location',
  ...overrides
});

/**
 * Create a mock social note for testing
 */
export const createMockSocialNote = (overrides: Partial<SocialNote> = {}): SocialNote => ({
  id: 'test-note-1',
  friendId: 'test-user-2',
  text: 'Test social note text',
  updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  ...overrides
});

/**
 * Create a mock close friend for testing
 */
export const createMockCloseFriend = (overrides: Partial<CloseFriend> = {}): CloseFriend => ({
  userId: 'test-user-2',
  addedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  ...overrides
});

/**
 * Create a mock check-in for testing
 */
export const createMockCheckIn = (overrides: Partial<CheckIn> = {}): CheckIn => ({
  id: 'test-checkin-1',
  user_id: 'test-user-1',
  text_content: 'Test check-in content',
  privacy: 'public',
  media_attachments: [],
  location: {
    id: 'test-loc-1',
    location_name: 'Test Location',
    latitude: 37.7749,
    longitude: -122.4194,
    address: 'Test Address, San Francisco, CA'
  },
  tags: [
    { id: 'test-tag-1', tag_name: 'test' }
  ],
  file_attachments: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

/**
 * Create multiple mock users
 */
export const createMockUsers = (count: number): User[] => {
  return Array.from({ length: count }, (_, index) => 
    createMockUser({
      id: `test-user-${index + 1}`,
      email: `test${index + 1}@example.com`,
      displayName: `Test User ${index + 1}`,
      firstName: `Test${index + 1}`,
    })
  );
};

/**
 * Mock API responses following the standardized data structure
 */
export const mockApiResponses = {
  users: {
    success: { users: createMockUsers(5), total: 5 },
    empty: { users: [], total: 0 },
    error: { error: 'Failed to fetch users' }
  },
  chats: {
    success: { chats: [createMockChat()], total: 1 },
    empty: { chats: [], total: 0 },
    error: { error: 'Failed to fetch chats' }
  },
  opportunities: {
    success: { opportunities: [createMockOpportunity()], total: 1 },
    empty: { opportunities: [], total: 0 },
    error: { error: 'Failed to fetch opportunities' }
  },
  checkIns: {
    success: { checkIns: [createMockCheckIn()], total: 1 },
    empty: { checkIns: [], total: 0 },
    error: { error: 'Failed to fetch check-ins' }
  },
  auth: {
    success: { user: createMockUser(), token: 'mock-token' },
    error: { error: 'Invalid credentials' }
  }
};

/**
 * Test data sets for different scenarios
 */
export const testDataSets = {
  emptyState: {
    users: [],
    chats: [],
    opportunities: [],
    socialNotes: []
  },
  singleUser: {
    users: [createMockUser()],
    chats: [createMockChat()],
    opportunities: [createMockOpportunity()],
    socialNotes: [createMockSocialNote()]
  },
  multipleUsers: {
    users: createMockUsers(10),
    chats: Array.from({ length: 5 }, (_, i) => createMockChat({ id: `chat-${i + 1}` })),
    opportunities: Array.from({ length: 3 }, (_, i) => createMockOpportunity({ id: `opp-${i + 1}` })),
    socialNotes: Array.from({ length: 8 }, (_, i) => createMockSocialNote({ id: `note-${i + 1}` }))
  }
};