import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { MontageItem } from '../types/montage';
import MontageCard from './MontageCard';
import SkeletonShimmer from './SkeletonShimmer';

interface MontageCarouselProps {
  items: MontageItem[];
  onItemClick: (checkinId: string) => void;
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

const MontageCarousel: React.FC<MontageCarouselProps> = ({
  items,
  onItemClick,
  isLoading = false,
  hasError = false,
  errorMessage,
  className = '',
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Card width + gap
  const CARD_WIDTH = 128; // w-32 = 128px
  const CARD_GAP = 12; // gap-3 = 12px
  const SCROLL_DISTANCE = CARD_WIDTH + CARD_GAP;

  // Check scroll position to update arrow states
  const updateScrollButtons = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // Scroll function with smooth animation
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;

    const scrollAmount = direction === 'left' ? -SCROLL_DISTANCE * 2 : SCROLL_DISTANCE * 2;
    containerRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && canScrollLeft) {
      e.preventDefault();
      scrollCarousel('left');
    } else if (e.key === 'ArrowRight' && canScrollRight) {
      e.preventDefault();
      scrollCarousel('right');
    }
  };

  // Load more when nearing the end
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onLoadMore || !hasMore || isLoadingMore) return;

    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;

    // Load more when 80% scrolled
    if (scrollPercentage > 0.8) {
      onLoadMore();
    }

    updateScrollButtons();
  }, [onLoadMore, hasMore, isLoadingMore, updateScrollButtons]);

  // Set up scroll listener and initial state
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial scroll state
    updateScrollButtons();

    // Add scroll listener with throttling
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', throttledHandleScroll);

    // Set up intersection observer for load more
    if (hasMore && onLoadMore) {
      const loadMoreTrigger = container.querySelector('.load-more-trigger');
      if (loadMoreTrigger) {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
              onLoadMore();
            }
          },
          { threshold: 0.1 }
        );
        observer.observe(loadMoreTrigger);
        
        return () => {
          container.removeEventListener('scroll', throttledHandleScroll);
          observer.disconnect();
        };
      }
    }

    return () => container.removeEventListener('scroll', throttledHandleScroll);
  }, [handleScroll, updateScrollButtons, hasMore, onLoadMore, isLoadingMore]);

  // Update scroll buttons when items change
  useEffect(() => {
    updateScrollButtons();
  }, [items.length, updateScrollButtons]);

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="flex gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-32 h-40 rounded-lg overflow-hidden bg-surface-hover">
          <SkeletonShimmer className="w-full h-24" />
          <div className="p-2">
            <SkeletonShimmer className="w-full h-3 mb-2" />
            <SkeletonShimmer className="w-2/3 h-3" />
          </div>
        </div>
      ))}
    </div>
  );

  // Error state
  const ErrorState = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle size={32} className="text-red-400 mb-2" />
      <p className="text-red-400 font-medium mb-1">Unable to load montage</p>
      <p className="text-red-300 text-sm">{errorMessage || 'Something went wrong'}</p>
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-16 h-16 bg-surface-hover rounded-full flex items-center justify-center mb-3">
        <div className="text-text-secondary text-2xl">📸</div>
      </div>
      <p className="text-text-secondary font-medium mb-1">No montage items yet</p>
      <p className="text-text-muted text-sm">Check-ins with media will appear here</p>
    </div>
  );

  if (isLoading && items.length === 0) {
    return (
      <div className={`relative ${className}`}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={className}>
        <ErrorState />
      </div>
    );
  }

  if (items.length === 0 && !isLoading) {
    return (
      <div className={className}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} role="region" aria-label="Montage carousel">
      {/* Navigation arrows */}
      {canScrollLeft && (
        <button
          onClick={() => scrollCarousel('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 hover:bg-white shadow-md rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft size={16} className="text-gray-700" />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scrollCarousel('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 hover:bg-white shadow-md rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight size={16} className="text-gray-700" />
        </button>
      )}

      {/* Carousel container */}
      <motion.div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory scroll-smooth"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={items.length}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          // Hide scrollbar but keep functionality
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {items.map((item, index) => (
          <motion.div
            key={`${item.checkin_id}-${index}`}
            className="snap-start"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 0.3, 
              delay: Math.min(index * 0.05, 0.3) // Staggered animation, max 0.3s delay
            }}
          >
            <MontageCard
              item={item}
              onItemClick={onItemClick}
              className="focus-within:ring-2 focus-within:ring-aqua/50 focus-within:ring-offset-2"
            />
          </motion.div>
        ))}

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="flex-shrink-0 w-32 h-40 rounded-lg bg-surface-hover flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-aqua/30 border-t-aqua rounded-full animate-spin" />
          </div>
        )}

        {/* Load more trigger (invisible) */}
        {hasMore && !isLoadingMore && (
          <div className="flex-shrink-0 w-1 h-full load-more-trigger" />
        )}
      </motion.div>

      {/* Scroll indicators */}
      <div className="flex justify-center mt-2 gap-1">
        {items.length > 0 && (
          <div className="flex gap-1 opacity-50">
            {[...Array(Math.min(Math.ceil(items.length / 4), 5))].map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-aqua rounded-full"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MontageCarousel;
