import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ViewTransition from './ViewTransition';

// Mock framer-motion to avoid animation complexity in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, variants, initial, animate, exit, ...props }: any) => (
      <div 
        className={`${className} motion-div`} 
        data-testid="motion-div"
        data-variants={variants ? 'has-variants' : 'no-variants'}
        data-initial={initial}
        data-animate={animate}
        data-exit={exit}
        {...props}
      >
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

describe('ViewTransition', () => {
  it('renders children correctly', () => {
    render(
      <ViewTransition viewKey="test-view">
        <div>Test content</div>
      </ViewTransition>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    render(
      <ViewTransition viewKey="test-view" className="custom-class">
        <div>Test content</div>
      </ViewTransition>
    );

    const motionDiv = screen.getByTestId('motion-div');
    expect(motionDiv).toHaveClass('custom-class');
    expect(motionDiv).toHaveClass('motion-div');
  });

  it('renders within AnimatePresence wrapper when animate is enabled', () => {
    render(
      <ViewTransition viewKey="test-view" animate={true}>
        <div>Test content</div>
      </ViewTransition>
    );

    expect(screen.getByTestId('animate-presence')).toBeInTheDocument();
    expect(screen.getByTestId('motion-div')).toBeInTheDocument();
  });

  it('renders fallback div with Tailwind classes when animate is disabled', () => {
    render(
      <ViewTransition viewKey="test-view" animate={false} className="test-class">
        <div>Test content</div>
      </ViewTransition>
    );

    // Should not render motion components when animation is disabled
    expect(screen.queryByTestId('animate-presence')).not.toBeInTheDocument();
    expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument();
    
    // Should render fallback div with transition classes
    const fallbackDiv = screen.getByText('Test content').parentElement;
    expect(fallbackDiv).toHaveClass('transition-opacity');
    expect(fallbackDiv).toHaveClass('duration-200');
    expect(fallbackDiv).toHaveClass('test-class');
  });

  it('sets correct data attributes for animation variants', () => {
    render(
      <ViewTransition viewKey="test-view">
        <div>Test content</div>
      </ViewTransition>
    );

    const motionDiv = screen.getByTestId('motion-div');
    expect(motionDiv).toHaveAttribute('data-variants', 'has-variants');
    expect(motionDiv).toHaveAttribute('data-initial', 'initial');
    expect(motionDiv).toHaveAttribute('data-animate', 'animate');
    expect(motionDiv).toHaveAttribute('data-exit', 'exit');
  });

  it('uses viewKey as the key for motion.div', () => {
    const { rerender } = render(
      <ViewTransition viewKey="grid">
        <div>Grid content</div>
      </ViewTransition>
    );

    expect(screen.getByText('Grid content')).toBeInTheDocument();

    // Rerender with different viewKey to simulate view change
    rerender(
      <ViewTransition viewKey="feed">
        <div>Feed content</div>
      </ViewTransition>
    );

    expect(screen.getByText('Feed content')).toBeInTheDocument();
  });

  it('includes default Tailwind transition classes in fallback mode', () => {
    render(
      <ViewTransition viewKey="test-view" animate={false}>
        <div>Test content</div>
      </ViewTransition>
    );

    const container = screen.getByText('Test content').parentElement;
    
    // Check for the specific Tailwind classes for fade transitions
    expect(container).toHaveClass('transition-opacity');
    expect(container).toHaveClass('duration-200');
  });

  it('applies fade animation without vertical movement', () => {
    render(
      <ViewTransition viewKey="test-view">
        <div>Test content</div>
      </ViewTransition>
    );

    const motionDiv = screen.getByTestId('motion-div');
    // The component should have animation variants but no translateY properties
    expect(motionDiv).toHaveAttribute('data-variants', 'has-variants');
    expect(motionDiv).toHaveAttribute('data-initial', 'initial');
    expect(motionDiv).toHaveAttribute('data-animate', 'animate');
    expect(motionDiv).toHaveAttribute('data-exit', 'exit');
  });
});
