import { getDisplayName, getFullName, getInitials, generateUsernameFromEmail } from '../nameHelpers';
import { User } from '../../types';

describe('nameHelpers', () => {
  const mockUser: User = {
    id: '1',
    first_name: 'John',
    last_name: 'Doe',
    age: 25,
    profilePicture: 'https://example.com/photo.jpg',
    bio: 'Test bio',
    interests: ['technology'],
    location: {
      lat: 40.7128,
      lng: -74.0060,
      proximityMiles: 2.5
    },
    isAvailable: true,
    mutualFriends: [],
    connectionPriority: 'regular',
    lastSeen: new Date(),
    profileType: 'public'
  };

  const mockUserWithoutLastName: User = {
    ...mockUser,
    last_name: undefined
  };

  describe('getDisplayName', () => {
    it('should return first name only', () => {
      expect(getDisplayName(mockUser)).toBe('John');
    });

    it('should handle user without last name', () => {
      expect(getDisplayName(mockUserWithoutLastName)).toBe('John');
    });

    it('should handle empty first name', () => {
      const userWithEmptyName = { ...mockUser, first_name: '' };
      expect(getDisplayName(userWithEmptyName)).toBe('');
    });
  });

  describe('getFullName', () => {
    it('should return full name when both first and last name exist', () => {
      expect(getFullName(mockUser)).toBe('John Doe');
    });

    it('should return only first name when last name is undefined', () => {
      expect(getFullName(mockUserWithoutLastName)).toBe('John');
    });

    it('should return only first name when last name is empty', () => {
      const userWithEmptyLastName = { ...mockUser, last_name: '' };
      expect(getFullName(userWithEmptyLastName)).toBe('John');
    });

    it('should trim result but preserve internal spacing', () => {
      const userWithSpaces = { ...mockUser, first_name: '  John  ', last_name: '  Doe  ' };
      expect(getFullName(userWithSpaces)).toBe('John     Doe');
    });
  });

  describe('getInitials', () => {
    it('should return first letter of first name capitalized', () => {
      expect(getInitials(mockUser)).toBe('J');
    });

    it('should handle lowercase first name', () => {
      const userLowercase = { ...mockUser, first_name: 'john' };
      expect(getInitials(userLowercase)).toBe('J');
    });

    it('should handle empty first name', () => {
      const userEmptyName = { ...mockUser, first_name: '' };
      expect(getInitials(userEmptyName)).toBe('');
    });

    it('should handle first name with special characters', () => {
      const userSpecialName = { ...mockUser, first_name: 'José' };
      expect(getInitials(userSpecialName)).toBe('J');
    });
  });

  describe('generateUsernameFromEmail', () => {
    it('should extract username from email', () => {
      expect(generateUsernameFromEmail('john.doe@example.com')).toBe('johndoe');
    });

    it('should handle email with numbers', () => {
      expect(generateUsernameFromEmail('user123@example.com')).toBe('user123');
    });

    it('should remove special characters except numbers', () => {
      expect(generateUsernameFromEmail('user.name+tag@example.com')).toBe('usernametag');
    });

    it('should convert to lowercase', () => {
      expect(generateUsernameFromEmail('John.DOE@Example.COM')).toBe('johndoe');
    });

    it('should handle emails with underscores', () => {
      expect(generateUsernameFromEmail('user_name@example.com')).toBe('username');
    });

    it('should handle emails with dashes', () => {
      expect(generateUsernameFromEmail('user-name@example.com')).toBe('username');
    });
  });
});