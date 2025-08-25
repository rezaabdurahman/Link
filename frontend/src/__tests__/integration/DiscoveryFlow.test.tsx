import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import DiscoveryPage from '../../pages/DiscoveryPage';

// Mock the services
jest.mock('../../services/unifiedSearchClient', () => ({
  unifiedSearch: jest.fn(),
  isUnifiedSearchError: jest.fn(() => false),
  getUnifiedSearchErrorMessage: jest.fn(() => 'Mock error message')
}));


jest.mock('../../services/availabilityClient', () => ({
  getUserAvailability: jest.fn(),
  updateUserAvailability: jest.fn(),
  isAvailabilityError: jest.fn(() => false),
  getAvailabilityErrorMessage: jest.fn(() => 'Mock error')
}));

jest.mock('../../services/broadcastClient', () => ({
  createBroadcast: jest.fn(),
  updateBroadcast: jest.fn(),
  isBroadcastError: jest.fn(() => false),
  getBroadcastErrorMessage: jest.fn(() => 'Mock error')
}));

jest.mock('../../hooks/useFriendRequests', () => ({
  usePendingReceivedRequestsCount: () => ({ count: 2, isLoading: false })
}));

import { unifiedSearch } from '../../services/unifiedSearchClient';

const mockUnifiedSearch = unifiedSearch as jest.MockedFunction<typeof unifiedSearch>;

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

describe('Discovery Flow Integration', () => {
  const mockUsers = [
    {
      id: '1',
      first_name: 'Alice',
      last_name: 'Smith',
      age: 28,
      profilePicture: 'https://example.com/alice.jpg',
      bio: 'Love hiking and coffee',
      interests: ['hiking', 'coffee', 'reading'],
      location: { lat: 40.7128, lng: -74.0060, proximityMiles: 1.2 },
      isAvailable: true,
      mutualFriends: ['Bob Wilson'],
      connectionPriority: 'want-closer',
      lastSeen: new Date(),
      profileType: 'public'
    },
    {
      id: '2', 
      first_name: 'Charlie',
      last_name: 'Brown',
      age: 25,
      profilePicture: 'https://example.com/charlie.jpg',
      bio: 'Tech enthusiast',
      interests: ['technology', 'gaming'],
      location: { lat: 40.7128, lng: -74.0060, proximityMiles: 0.8 },
      isAvailable: true,
      mutualFriends: [],
      connectionPriority: 'regular',
      lastSeen: new Date(),
      profileType: 'public'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUnifiedSearch.mockResolvedValue({
      users: mockUsers,
      total: 2,
      hasMore: false,
      scope: 'discovery',
      query: '',
      filters: {
        maxDistance: 50,
        availableInterests: [],
        appliedFilters: {}
      },
      metadata: {
        searchTime: 150,
        source: 'database',
        relevanceScores: {}
      }
    });
  });

  describe('Initial Page Load', () => {
    it('should load and display users on initial render', async () => {
      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      // Should show loading state initially
      expect(screen.getByText('Discovering people nearby...')).toBeInTheDocument();

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();
      });

      // Verify search was called with correct parameters
      expect(mockUnifiedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'discovery',
          query: '',
          pagination: expect.objectContaining({
            limit: 20,
            offset: 0
          })
        })
      );
    });

    it('should display user information correctly', async () => {
      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Check if user details are displayed
      expect(screen.getByText('Love hiking and coffee')).toBeInTheDocument();
      expect(screen.getByText('1.2 miles away')).toBeInTheDocument();
      expect(screen.getByText('1 mutual friend')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should perform search when user types in search box', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Find and type in search input
      const searchInput = screen.getByPlaceholderText('Search for people...');
      await user.type(searchInput, 'hiking');

      // Wait for debounced search
      await waitFor(() => {
        expect(mockUnifiedSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            query: 'hiking',
            scope: 'discovery'
          })
        );
      }, { timeout: 1000 });
    });

    it('should clear search when clear button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Type in search
      const searchInput = screen.getByPlaceholderText('Search for people...');
      await user.type(searchInput, 'test search');

      // Clear search
      await user.clear(searchInput);

      // Should trigger new search with empty query
      await waitFor(() => {
        expect(mockUnifiedSearch).toHaveBeenLastCalledWith(
          expect.objectContaining({
            query: '',
            scope: 'discovery'
          })
        );
      });
    });
  });

  describe('Layout Toggle', () => {
    it('should toggle between grid and vertical layouts', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Find the layout toggle button (assuming it exists)
      const gridContainer = screen.getByTestId('user-grid');
      expect(gridContainer).toHaveClass('smart-grid-layout'); // Assuming this class indicates grid layout

      // Look for vertical layout toggle
      const layoutButton = screen.getByRole('button', { name: /layout/i });
      await user.click(layoutButton);

      // Should switch to vertical layout
      await waitFor(() => {
        expect(gridContainer).toHaveClass('vertical-layout');
      });
    });
  });

  describe('User Interactions', () => {
    it('should open user profile when user card is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Click on Alice's card
      const aliceCard = screen.getByText('Alice').closest('button');
      expect(aliceCard).toBeInTheDocument();
      
      await user.click(aliceCard!);

      // Should open profile modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Alice Smith')).toBeInTheDocument(); // Full name in modal
      });
    });

    it('should handle friend request when add friend button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Find and click add friend button
      const addFriendButtons = screen.getAllByText('Add Friend');
      expect(addFriendButtons.length).toBeGreaterThan(0);
      
      await user.click(addFriendButtons[0]);

      // Should show success message or change button state
      await waitFor(() => {
        expect(screen.getByText('Friend request sent')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when search fails', async () => {
      mockUnifiedSearch.mockRejectedValueOnce(new Error('Network error'));
      
      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });

    it('should show empty state when no users found', async () => {
      mockUnifiedSearch.mockResolvedValueOnce({
        users: [],
        total: 0,
        hasMore: false,
        scope: 'discovery',
        query: '',
        filters: {
          maxDistance: 50,
          availableInterests: [],
          appliedFilters: {}
        },
        metadata: {
          searchTime: 150,
          source: 'database',
          relevanceScores: {}
        }
      });

      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no people found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle mobile viewport correctly', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Check that mobile-specific layout is applied
      const gridContainer = screen.getByTestId('user-grid');
      expect(gridContainer).toHaveClass('mobile-optimized');
    });
  });

  describe('Performance', () => {
    it('should implement virtual scrolling for large user lists', async () => {
      // Mock a large number of users
      const manyUsers = Array.from({ length: 100 }, (_, i) => ({
        ...mockUsers[0],
        id: String(i + 1),
        first_name: `User${i + 1}`
      }));

      mockUnifiedSearch.mockResolvedValueOnce({
        users: manyUsers,
        total: 100,
        hasMore: false,
        scope: 'discovery',
        query: '',
        filters: {
          maxDistance: 50,
          availableInterests: [],
          appliedFilters: {}
        },
        metadata: {
          searchTime: 150,
          source: 'database',
          relevanceScores: {}
        }
      });

      render(
        <TestWrapper>
          <DiscoveryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('User1')).toBeInTheDocument();
      });

      // Should not render all 100 users at once (virtual scrolling)
      expect(screen.queryByText('User100')).not.toBeInTheDocument();
    });
  });
});