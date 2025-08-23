import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserCard from '../UserCard';
import { User } from '../../types';
import { getDisplayName } from '../../utils/nameHelpers';

// Mock the nameHelpers since we're testing UserCard, not the helpers
jest.mock('../../utils/nameHelpers', () => ({
  getDisplayName: jest.fn(),
  getFullName: jest.fn(),
  getInitials: jest.fn(),
}));

const mockGetDisplayName = getDisplayName as jest.MockedFunction<typeof getDisplayName>;

describe('UserCard', () => {
  const mockUser: User = {
    id: '1',
    first_name: 'Jane',
    last_name: 'Smith',
    age: 28,
    profilePicture: 'https://example.com/jane.jpg',
    bio: 'Software engineer passionate about React',
    interests: ['technology', 'music', 'travel'],
    location: {
      lat: 40.7128,
      lng: -74.0060,
      proximityMiles: 1.5
    },
    isAvailable: true,
    mutualFriends: ['John Doe', 'Alice Johnson'],
    connectionPriority: 'want-closer',
    lastSeen: new Date('2023-12-01T10:00:00Z'),
    profileType: 'public',
    profileMedia: {
      type: 'image',
      url: 'https://example.com/jane-full.jpg',
      thumbnail: 'https://example.com/jane.jpg'
    },
    broadcast: 'Looking for coffee buddies!'
  };

  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplayName.mockReturnValue('Jane');
  });

  describe('Vertical Layout', () => {
    it('should render user information in vertical layout', () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.getByText('Software engineer passionate about React')).toBeInTheDocument();
      expect(screen.getByText('1.5 miles away')).toBeInTheDocument();
    });

    it('should show interests in vertical layout', () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.getByText('technology')).toBeInTheDocument();
      expect(screen.getByText('music')).toBeInTheDocument();
      expect(screen.getByText('travel')).toBeInTheDocument();
    });

    it('should show broadcast message when available', () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.getByText('Looking for coffee buddies!')).toBeInTheDocument();
    });

    it('should show mutual friends count', () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.getByText('2 mutual friends')).toBeInTheDocument();
    });

    it('should show friend button when enabled', () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.getByText('Add Friend')).toBeInTheDocument();
    });

    it('should hide friend button when disabled', () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={false}
        />
      );

      expect(screen.queryByText('Add Friend')).not.toBeInTheDocument();
    });
  });

  describe('Grid Layout', () => {
    it('should render user information in grid layout', () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={false}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
    });

    it('should show different information in grid vs vertical layout', () => {
      const { rerender } = render(
        <UserCard
          user={mockUser}
          isVerticalLayout={false}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      // In grid layout, should show age
      expect(screen.getByText('28')).toBeInTheDocument();

      rerender(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      // In vertical layout, should show more details
      expect(screen.getByText('Software engineer passionate about React')).toBeInTheDocument();
    });
  });

  describe('Media Handling', () => {
    it('should display image when profileMedia is image type', () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      const image = screen.getByAltText('Jane');
      expect(image).toHaveAttribute('src', 'https://example.com/jane.jpg');
    });

    it('should display video when profileMedia is video type', () => {
      const userWithVideo = {
        ...mockUser,
        profileMedia: {
          type: 'video' as const,
          url: 'https://example.com/jane-video.mp4',
          thumbnail: 'https://example.com/jane-thumb.jpg'
        }
      };

      render(
        <UserCard
          user={userWithVideo}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      const video = screen.getByTitle('Profile video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', 'https://example.com/jane-video.mp4');
    });

    it('should fallback to profilePicture when no profileMedia', () => {
      const userWithoutMedia = {
        ...mockUser,
        profileMedia: undefined
      };

      render(
        <UserCard
          user={userWithoutMedia}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      const image = screen.getByAltText('Jane');
      expect(image).toHaveAttribute('src', 'https://example.com/jane.jpg');
    });
  });

  describe('Interactions', () => {
    it('should call onClick when card is clicked', async () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.click(card);

      await waitFor(() => {
        expect(mockOnClick).toHaveBeenCalledWith(mockUser);
      });
    });

    it('should handle friend button click without triggering card click', async () => {
      render(
        <UserCard
          user={mockUser}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      const friendButton = screen.getByText('Add Friend');
      fireEvent.click(friendButton);

      // Friend button click should not trigger the card onClick
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle user without bio', () => {
      const userWithoutBio = {
        ...mockUser,
        bio: ''
      };

      render(
        <UserCard
          user={userWithoutBio}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.queryByText('Software engineer passionate about React')).not.toBeInTheDocument();
    });

    it('should handle user without interests', () => {
      const userWithoutInterests = {
        ...mockUser,
        interests: []
      };

      render(
        <UserCard
          user={userWithoutInterests}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.queryByText('technology')).not.toBeInTheDocument();
    });

    it('should handle user without mutual friends', () => {
      const userWithoutMutualFriends = {
        ...mockUser,
        mutualFriends: []
      };

      render(
        <UserCard
          user={userWithoutMutualFriends}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.queryByText('mutual friends')).not.toBeInTheDocument();
    });

    it('should handle singular mutual friend', () => {
      const userWithOneMutualFriend = {
        ...mockUser,
        mutualFriends: ['John Doe']
      };

      render(
        <UserCard
          user={userWithOneMutualFriend}
          isVerticalLayout={true}
          onClick={mockOnClick}
          showFriendButton={true}
        />
      );

      expect(screen.getByText('1 mutual friend')).toBeInTheDocument();
    });
  });
});