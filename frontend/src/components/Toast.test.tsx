import React from 'react';
import { render } from '@testing-library/react';
import Toast from './Toast';

describe('Toast Component', () => {
  const defaultProps = {
    message: 'Test message',
    type: 'success' as const,
    isVisible: true,
    onClose: jest.fn(),
    duration: 3000,
  };

  it('should render without crashing', () => {
    const { container } = render(<Toast {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { container } = render(
      <Toast {...defaultProps} isVisible={false} />
    );
    expect(container.firstChild).toBeNull();
  });
});
