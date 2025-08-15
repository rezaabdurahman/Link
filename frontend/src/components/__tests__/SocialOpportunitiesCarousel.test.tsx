import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SocialOpportunitiesCarousel from '../SocialOpportunitiesCarousel';
import type { Opportunity as CheckinOpportunity } from '../../types/checkin';

const mockOpportunities: CheckinOpportunity[] = [
  {
    id: '1',
    title: 'Coffee Chat',
    description: 'Meet for coffee at Blue Bottle',
    timestamp: new Date('2023-12-15T10:30:00'),
    status: 'pending',
    participantName: 'John Doe',
    participantAvatar: 'https://example.com/avatar1.jpg',
    location: 'Blue Bottle Coffee',
    type: 'social'
  },
  {
    id: '2', 
    title: 'Lunch Meeting',
    description: 'Business lunch discussion',
    timestamp: new Date('2023-12-16T12:00:00'),
    status: 'pending',
    participantName: 'Jane Smith',
    participantAvatar: 'https://example.com/avatar2.jpg',
    location: 'Restaurant XYZ',
    type: 'professional'
  }
];

const mockOnAction = jest.fn();

describe('SocialOpportunitiesCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders opportunities correctly', () => {
    render(
      <SocialOpportunitiesCarousel
        opportunities={mockOpportunities}
        onAction={mockOnAction}
      />
    );

    expect(screen.getByText('Coffee Chat')).toBeInTheDocument();
    expect(screen.getByText('Lunch Meeting')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('calls onAction with correct parameters when accept button is clicked', () => {
    render(
      <SocialOpportunitiesCarousel
        opportunities={mockOpportunities}
        onAction={mockOnAction}
      />
    );

    const acceptButtons = screen.getAllByText('Accept');
    fireEvent.click(acceptButtons[0]);

    expect(mockOnAction).toHaveBeenCalledWith('1', 'accepted');
  });

  it('calls onAction with correct parameters when decline button is clicked', () => {
    render(
      <SocialOpportunitiesCarousel
        opportunities={mockOpportunities}
        onAction={mockOnAction}
      />
    );

    const declineButtons = screen.getAllByText('Decline');
    fireEvent.click(declineButtons[0]);

    expect(mockOnAction).toHaveBeenCalledWith('1', 'rejected');
  });

  it('renders empty state when no opportunities provided', () => {
    render(
      <SocialOpportunitiesCarousel
        opportunities={[]}
        onAction={mockOnAction}
      />
    );

    // Since the component doesn't show any specific empty state, 
    // just verify it renders without crashing
    expect(screen.queryByText('Coffee Chat')).not.toBeInTheDocument();
  });
});
