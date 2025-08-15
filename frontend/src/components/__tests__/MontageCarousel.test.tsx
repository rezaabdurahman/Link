// import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MontageCarousel from '../MontageCarousel';
import { MontageItem } from '../../types/montage';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock MontageCard component
jest.mock('../MontageCard', () => {
  return function MockMontageCard({ item, onItemClick }: any) {
    return (
      <div 
        data-testid={`montage-card-${item.checkin_id}`}
        onClick={() => onItemClick(item.checkin_id)}
      >
        {item.widget_metadata.description || item.widget_type}
      </div>
    );
  };
});

// Mock SkeletonShimmer component
jest.mock('../SkeletonShimmer', () => {
  return function MockSkeletonShimmer({ className }: any) {
    return <div className={className} data-testid="skeleton-shimmer" />;
  };
});

const mockMontageItems: MontageItem[] = [
  {
    checkin_id: 'checkin-1',
    widget_type: 'media',
    widget_metadata: {
      media_url: 'https://example.com/image1.jpg',
      media_type: 'image',
      description: 'Morning coffee',
      tags: ['coffee', 'morning'],
    },
    created_at: '2024-01-15T08:00:00Z',
  },
  {
    checkin_id: 'checkin-2',
    widget_type: 'text',
    widget_metadata: {
      description: 'Great lunch',
      tags: ['food', 'lunch'],
    },
    created_at: '2024-01-15T12:00:00Z',
  },
  {
    checkin_id: 'checkin-3',
    widget_type: 'media',
    widget_metadata: {
      media_url: 'https://example.com/video1.mp4',
      media_type: 'video',
      description: 'Workout session',
      tags: ['fitness', 'gym'],
    },
    created_at: '2024-01-15T18:00:00Z',
  },
];

describe('MontageCarousel', () => {
  const mockOnItemClick = jest.fn();
  const mockOnLoadMore = jest.fn();

  beforeEach(() => {
    mockOnItemClick.mockClear();
    mockOnLoadMore.mockClear();
  });

  it('renders montage items correctly', () => {
    render(
      <MontageCarousel
        items={mockMontageItems}
        onItemClick={mockOnItemClick}
      />
    );

    // Check that all items are rendered
    expect(screen.getByTestId('montage-card-checkin-1')).toBeInTheDocument();
    expect(screen.getByTestId('montage-card-checkin-2')).toBeInTheDocument();
    expect(screen.getByTestId('montage-card-checkin-3')).toBeInTheDocument();

    // Check item content
    expect(screen.getByText('Morning coffee')).toBeInTheDocument();
    expect(screen.getByText('Great lunch')).toBeInTheDocument();
    expect(screen.getByText('Workout session')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    render(
      <MontageCarousel
        items={[]}
        onItemClick={mockOnItemClick}
        isLoading={true}
      />
    );

    // Check that skeleton loaders are shown
    const skeletons = screen.getAllByTestId('skeleton-shimmer');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state when there is an error', () => {
    render(
      <MontageCarousel
        items={[]}
        onItemClick={mockOnItemClick}
        hasError={true}
        errorMessage="Failed to load montage"
      />
    );

    expect(screen.getByText('Unable to load montage')).toBeInTheDocument();
    expect(screen.getByText('Failed to load montage')).toBeInTheDocument();
  });

  it('shows empty state when no items and not loading', () => {
    render(
      <MontageCarousel
        items={[]}
        onItemClick={mockOnItemClick}
        isLoading={false}
      />
    );

    expect(screen.getByText('No montage items yet')).toBeInTheDocument();
    expect(screen.getByText('Check-ins with media will appear here')).toBeInTheDocument();
  });

  it('handles item click interactions', () => {
    render(
      <MontageCarousel
        items={mockMontageItems}
        onItemClick={mockOnItemClick}
      />
    );

    // Click on first item
    fireEvent.click(screen.getByTestId('montage-card-checkin-1'));
    expect(mockOnItemClick).toHaveBeenCalledWith('checkin-1');

    // Click on second item
    fireEvent.click(screen.getByTestId('montage-card-checkin-2'));
    expect(mockOnItemClick).toHaveBeenCalledWith('checkin-2');
  });

  it('shows navigation arrows when items overflow', () => {
    // Mock scrollWidth to be larger than clientWidth to trigger arrows
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 300,
    });

    render(
      <MontageCarousel
        items={mockMontageItems}
        onItemClick={mockOnItemClick}
      />
    );

    // Initially no arrows should be visible since scrollLeft is 0
    expect(screen.queryByLabelText('Scroll left')).not.toBeInTheDocument();
    
    // Right arrow should be available if there's overflow
    expect(screen.getByLabelText('Scroll right')).toBeInTheDocument();
  });

  it('shows loading more indicator when loading more items', () => {
    render(
      <MontageCarousel
        items={mockMontageItems}
        onItemClick={mockOnItemClick}
        isLoadingMore={true}
        hasMore={true}
        onLoadMore={mockOnLoadMore}
      />
    );

    // Check for loading more indicator
    const loadingIndicators = screen.getAllByRole('generic').filter(el => 
      el.className.includes('animate-spin')
    );
    expect(loadingIndicators.length).toBeGreaterThan(0);
  });

  it('has proper accessibility attributes', () => {
    render(
      <MontageCarousel
        items={mockMontageItems}
        onItemClick={mockOnItemClick}
      />
    );

    // Check for region role and aria-label
    const carousel = screen.getByRole('region');
    expect(carousel).toHaveAttribute('aria-label', 'Montage carousel');

    // Check for scrollbar role
    const scrollContainer = screen.getByRole('scrollbar');
    expect(scrollContainer).toHaveAttribute('aria-orientation', 'horizontal');
    expect(scrollContainer).toHaveAttribute('tabIndex', '0');
  });

  it('handles keyboard navigation', () => {
    // Mock scroll functions
    const mockScrollBy = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      value: mockScrollBy,
      configurable: true,
    });

    // Mock scroll properties to enable navigation
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      value: 300,
      configurable: true,
    });

    render(
      <MontageCarousel
        items={mockMontageItems}
        onItemClick={mockOnItemClick}
      />
    );

    const scrollContainer = screen.getByRole('scrollbar');

    // Test left arrow key
    fireEvent.keyDown(scrollContainer, { key: 'ArrowLeft' });
    // Should scroll left (negative value)
    expect(mockScrollBy).toHaveBeenCalledWith({
      left: expect.any(Number),
      behavior: 'smooth',
    });

    mockScrollBy.mockClear();

    // Test right arrow key
    fireEvent.keyDown(scrollContainer, { key: 'ArrowRight' });
    // Should scroll right (positive value)
    expect(mockScrollBy).toHaveBeenCalledWith({
      left: expect.any(Number),
      behavior: 'smooth',
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <MontageCarousel
        items={mockMontageItems}
        onItemClick={mockOnItemClick}
        className="custom-carousel-class"
      />
    );

    const carousel = container.firstChild as HTMLElement;
    expect(carousel).toHaveClass('custom-carousel-class');
  });

  it('shows scroll indicators based on item count', () => {
    render(
      <MontageCarousel
        items={mockMontageItems}
        onItemClick={mockOnItemClick}
      />
    );

    // Should show indicators for the items
    const indicators = screen.getAllByRole('generic').filter(el =>
      el.className.includes('bg-aqua rounded-full') && el.className.includes('w-1.5 h-1.5')
    );
    
    // Should have at least one indicator
    expect(indicators.length).toBeGreaterThan(0);
  });
});
